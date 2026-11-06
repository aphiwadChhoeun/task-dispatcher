import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { geocodeCache } from "@/lib/db/schema";
import { config } from "@/config";
import { AppError } from "@/lib/errors";
import { reportError } from "@/lib/observability";

export type GeocodeAddress = {
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
  address?: GeocodeAddress;
};

export interface GeocodingProvider {
  readonly name: string;
  geocode(query: string): Promise<GeocodeResult | null>;
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USER_AGENT = config.maps.geocoderUserAgent;

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

function toResult(place: NominatimPlace): GeocodeResult {
  const address = place.address ?? {};
  const street = [address.house_number, address.road].filter(Boolean).join(" ");
  return {
    lat: Number.parseFloat(place.lat),
    lng: Number.parseFloat(place.lon),
    label: place.display_name,
    address: {
      addressStreet: street || address.road || place.display_name.split(",")[0],
      addressCity: address.city ?? address.town ?? address.village ?? address.hamlet,
      addressState: address.state ?? address.county,
      addressPostalCode: address.postcode,
      addressCountry: address.country_code?.toUpperCase() ?? address.country,
    },
  };
}

/** OpenStreetMap Nominatim implementation of the geocoding port. */
class NominatimGeocoder implements GeocodingProvider {
  readonly name = "nominatim";

  async geocode(query: string): Promise<GeocodeResult | null> {
    const url = new URL("/search", config.maps.geocoderUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Geocoder responded ${response.status}`);
    const results = (await response.json()) as NominatimPlace[];
    if (!Array.isArray(results) || results.length === 0) return null;
    return toResult(results[0]);
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const url = new URL("/reverse", config.maps.geocoderUrl);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Geocoder responded ${response.status}`);
    const place = (await response.json()) as NominatimPlace;
    if (!place?.lat || !place?.lon) return null;
    return toResult(place);
  }
}

class NullGeocoder implements GeocodingProvider {
  readonly name = "none";
  async geocode(): Promise<GeocodeResult | null> {
    return null;
  }
  async reverse(): Promise<GeocodeResult | null> {
    return null;
  }
}

let provider: GeocodingProvider | null = null;

export function getGeocodingProvider(): GeocodingProvider {
  if (!provider) {
    provider = config.maps.geocoder === "nominatim" ? new NominatimGeocoder() : new NullGeocoder();
  }
  return provider;
}

export function setGeocodingProvider(next: GeocodingProvider | null): void {
  provider = next;
}

async function withCache(
  key: string,
  loader: () => Promise<GeocodeResult | null>,
): Promise<GeocodeResult | null> {
  const db = getDb();
  const cached = await db.select().from(geocodeCache).where(eq(geocodeCache.key, key)).get();
  if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      label: cached.label,
      ...(cached.address ? { address: JSON.parse(cached.address) as GeocodeAddress } : {}),
    };
  }

  const result = await loader();
  if (result) {
    await db
      .insert(geocodeCache)
      .values({
        key,
        lat: result.lat,
        lng: result.lng,
        label: result.label,
        address: result.address ? JSON.stringify(result.address) : null,
      })
      .onConflictDoUpdate({
        target: geocodeCache.key,
        set: {
          lat: result.lat,
          lng: result.lng,
          label: result.label,
          address: result.address ? JSON.stringify(result.address) : null,
          createdAt: new Date(),
        },
      });
  }
  return result;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 4) throw new AppError("Enter a more complete address", 422);
  if (config.maps.geocoder === "none") return null;

  return withCache(`geo:${normalise(trimmed)}`, async () => {
    try {
      return await getGeocodingProvider().geocode(trimmed);
    } catch (error) {
      reportError(error, { scope: "geocode.search" });
      throw new AppError("Address lookup is unavailable right now. Drop a pin instead.", 502);
    }
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (config.maps.geocoder === "none") return null;
  const key = `rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return withCache(key, async () => {
    try {
      return await getGeocodingProvider().reverse(lat, lng);
    } catch (error) {
      reportError(error, { scope: "geocode.reverse" });
      throw new AppError("Address lookup is unavailable right now.", 502);
    }
  });
}
