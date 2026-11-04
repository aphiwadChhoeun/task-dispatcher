"use client";

import { useState } from "react";
import { ExternalLink, Navigation, Route } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MapShell } from "@/components/maps/map-shell";
import type { MapMarker, MapRoute } from "@/features/maps/types";
import { formatAddress } from "@/lib/format";

type Props = {
  lat: number | null;
  lng: number | null;
  title: string;
  address: {
    addressStreet?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostalCode?: string | null;
    addressCountry?: string | null;
  };
};

export function DirectionsMap({ lat, lng, title, address }: Props) {
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (lat == null || lng == null) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
        This task does not have a location pin yet. Ask dispatch to add one.
      </p>
    );
  }

  const destination: [number, number] = [lng, lat];
  const addressLabel = formatAddress(address);
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const appleUrl = `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(title)}`;

  const previewRoute = () => {
    if (!navigator.geolocation) {
      setError("Your browser does not support geolocation.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const from: [number, number] = [position.coords.longitude, position.coords.latitude];
        setOrigin(from);
        try {
          const response = await fetch(
            `/api/v1/route?from=${from[1]},${from[0]}&to=${lat},${lng}`,
            { cache: "no-store" },
          );
          const data = await response.json();
          if (response.ok && data.route) {
            setRoute(data.route as MapRoute);
            setSummary(
              data.distance && data.duration
                ? `${(data.distance / 1000).toFixed(1)} km · ${Math.round(data.duration / 60)} min`
                : "Route preview",
            );
          } else {
            setRoute({
              type: "Feature",
              geometry: { type: "LineString", coordinates: [from, destination] },
            });
            setSummary("Direct line (routing service unavailable)");
          }
        } catch {
          setRoute({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [from, destination] },
          });
          setSummary("Direct line (routing service unavailable)");
        } finally {
          setLoading(false);
        }
      },
      (geoError) => {
        setLoading(false);
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was denied. Use the map links below instead."
            : "Could not get your current location.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const markers: MapMarker[] = [
    {
      id: "destination",
      lat,
      lng,
      label: title,
      description: addressLabel,
      kind: "task",
    },
  ];
  if (origin) {
    markers.push({
      id: "origin",
      lat: origin[1],
      lng: origin[0],
      label: "You",
      kind: "tasker",
      color: "#0d5f4c",
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={previewRoute} disabled={loading}>
          <Route className="size-4" aria-hidden />
          {loading ? "Finding route…" : "Preview route"}
        </Button>
        <a
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "default" })}
        >
          <Navigation className="size-4" aria-hidden />
          Google Maps
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <a
          href={appleUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "default" })}
        >
          Apple Maps
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
      <MapShell
        markers={markers}
        route={route}
        fitToMarkers
        center={destination}
        zoom={13}
        className="h-64 sm:h-80"
        ariaLabel="Directions preview"
      />
    </div>
  );
}
