import "server-only";
import { config } from "@/config";
import { reportError } from "@/lib/observability";
import type { MapRoute } from "@/features/maps/types";

export type RouteResult = {
  route: MapRoute;
  distance: number;
  duration: number;
  provider: string;
};

export interface RoutingProvider {
  readonly name: string;
  route(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<RouteResult | null>;
}

type OsrmResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }>;
};

class OsrmRouter implements RoutingProvider {
  readonly name = "osrm";

  async route(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<RouteResult | null> {
    const url = new URL(
      `/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
      config.maps.routingUrl,
    );
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "false");

    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Routing responded ${response.status}`);
    const data = (await response.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      route: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: route.geometry.coordinates },
      },
      distance: route.distance,
      duration: route.duration,
      provider: "osrm",
    };
  }
}

class NullRouter implements RoutingProvider {
  readonly name = "none";
  async route(): Promise<RouteResult | null> {
    return null;
  }
}

let provider: RoutingProvider | null = null;

export function getRoutingProvider(): RoutingProvider {
  if (!provider) {
    provider = config.maps.routing === "osrm" ? new OsrmRouter() : new NullRouter();
  }
  return provider;
}

export function setRoutingProvider(next: RoutingProvider | null): void {
  provider = next;
}

/** Returns null when the provider is unavailable; the client draws a direct line. */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResult | null> {
  if (config.maps.routing === "none") return null;
  try {
    return await getRoutingProvider().route(from, to);
  } catch (error) {
    reportError(error, { scope: "routing" });
    return null;
  }
}
