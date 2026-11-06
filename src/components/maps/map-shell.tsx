"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { config } from "@/config";
import { cn } from "@/lib/utils";
import type { MapMarker, MapRoute } from "@/features/maps/types";

export type { MapMarker, MapRoute } from "@/features/maps/types";

export type MapShellProps = {
  center?: [number, number];
  zoom?: number;
  markers: MapMarker[];
  route?: MapRoute | null;
  className?: string;
  fitToMarkers?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDrag?: (id: string, lat: number, lng: number) => void;
  ariaLabel?: string;
};

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

export function MapShell({
  center = DEFAULT_CENTER,
  zoom = 11.5,
  markers,
  route,
  className,
  fitToMarkers = false,
  onMapClick,
  onMarkerDrag,
  ariaLabel = "Map",
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const initializedRef = useRef(false);
  const fitDoneRef = useRef(false);
  const callbacksRef = useRef({ onMapClick, onMarkerDrag });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onMapClick, onMarkerDrag };
  }, [onMapClick, onMarkerDrag]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const markerMap = markersRef.current;

    async function init() {
      if (!containerRef.current || initializedRef.current) return;
      const container = containerRef.current;
      initializedRef.current = true;
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled) return;

      const style: StyleSpecification = {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [config.maps.tileUrl],
            tileSize: 256,
            attribution: config.maps.tileAttribution,
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      };

      map = new maplibregl.Map({
        container,
        style,
        center,
        zoom,
        attributionControl: { compact: true },
        maxZoom: 19,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      // MapLibre only listens for window resizes. Cards and split layouts can
      // change width without one, which leaves the canvas at its initial size.
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(container);
      requestAnimationFrame(() => map?.resize());

      map.on("click", (event) => {
        callbacksRef.current.onMapClick?.(event.lngLat.lat, event.lngLat.lng);
      });

      map.on("load", () => {
        if (!map || cancelled) return;
        map.resize();
        setReady(true);
        if (!fitToMarkers || fitDoneRef.current || markers.length === 0) return;
        fitDoneRef.current = true;
        if (markers.length === 1) {
          map.easeTo({ center: [markers[0].lng, markers[0].lat], zoom: 13.5, duration: 500 });
          return;
        }
        const bounds = new maplibregl.LngLatBounds();
        for (const marker of markers) bounds.extend([marker.lng, marker.lat]);
        map.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 600 });
      });
    }

    void init();

    return () => {
      cancelled = true;
      setReady(false);
      resizeObserver?.disconnect();
      for (const marker of markerMap.values()) marker.remove();
      markerMap.clear();
      map?.remove();
      mapRef.current = null;
      initializedRef.current = false;
      fitDoneRef.current = false;
    };
    // The map is created once; prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function syncMarkers() {
      const map = mapRef.current;
      if (!map) return;
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled) return;

      const ids = new Set(markers.map((marker) => marker.id));
      for (const [id, marker] of markersRef.current) {
        if (!ids.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }

      for (const item of markers) {
        const existing = markersRef.current.get(item.id);

        if (existing) {
          existing.setLngLat([item.lng, item.lat]);
          const element = existing.getElement();
          element.classList.toggle("td-marker--stale", Boolean(item.stale));
          element.setAttribute("aria-label", `${item.label} ${item.stale ? "(stale)" : ""}`);
          const label = element.querySelector("[data-marker-label]");
          if (label) label.textContent = item.label.slice(0, 2).toUpperCase();
          continue;
        }

        const element = document.createElement("button");
        element.type = "button";
        element.className = cn(
          "td-marker",
          item.kind === "task" && "td-marker--task",
          item.kind === "pin" && "td-marker--pin",
          item.stale && "td-marker--stale",
          item.kind === "tasker" && !item.stale && "td-pulse",
        );
        element.style.background = item.kind === "tasker" ? item.color ?? "#0f766e" : "#1f2937";
        element.setAttribute("aria-label", item.label);

        const span = document.createElement("span");
        span.dataset.markerLabel = "true";
        span.textContent =
          item.kind === "pin" ? "●" : item.kind === "task" ? "T" : item.label.slice(0, 2).toUpperCase();
        element.appendChild(span);

        const popupContent = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = item.label;
        popupContent.appendChild(title);
        if (item.description) {
          const desc = document.createElement("p");
          desc.textContent = item.description;
          popupContent.appendChild(desc);
        }
        if (item.href) {
          const link = document.createElement("a");
          link.href = item.href;
          link.textContent =
            item.hrefLabel ?? (item.kind === "tasker" ? "Open tasker profile →" : "Open task →");
          link.style.cssText =
            "display:inline-block;margin-top:6px;font-size:12px;font-weight:600;color:#0d5f4c";
          popupContent.appendChild(link);
        }

        const marker = new maplibregl.Marker({
          element,
          anchor: "center",
          draggable: Boolean(item.draggable),
        })
          .setLngLat([item.lng, item.lat])
          .setPopup(new maplibregl.Popup({ offset: 22, closeButton: false }).setDOMContent(popupContent))
          .addTo(map);

        if (item.draggable) {
          marker.on("dragend", () => {
            const position = marker.getLngLat();
            callbacksRef.current.onMarkerDrag?.(item.id, position.lat, position.lng);
          });
        }

        markersRef.current.set(item.id, marker);
      }
    }

    void syncMarkers();
    return () => {
      cancelled = true;
    };
  }, [markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const applyRoute = () => {
      const source = map.getSource("td-route") as { setData(data: unknown): void } | undefined;
      if (!route) {
        if (map.getLayer("td-route-line")) map.removeLayer("td-route-line");
        if (source) map.removeSource("td-route");
        return;
      }
      if (source) {
        source.setData(route);
        return;
      }
      map.addSource("td-route", { type: "geojson", data: route as never });
      map.addLayer({
        id: "td-route-line",
        type: "line",
        source: "td-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#0d5f4c",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    };

    applyRoute();

    if (route) {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;
      for (const [lng, lat] of route.geometry.coordinates) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 50, maxZoom: 14, duration: 500 },
      );
    }
  }, [route, ready]);

  useEffect(() => {
    if (!ready || !fitToMarkers || fitDoneRef.current || markers.length === 0) return;
    const map = mapRef.current;
    if (!map) return;
    fitDoneRef.current = true;
    if (markers.length === 1) {
      map.easeTo({ center: [markers[0].lng, markers[0].lat], zoom: 13.5, duration: 500 });
      return;
    }
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const marker of markers) {
      minLng = Math.min(minLng, marker.lng);
      minLat = Math.min(minLat, marker.lat);
      maxLng = Math.max(maxLng, marker.lng);
      maxLat = Math.max(maxLat, marker.lat);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 50, maxZoom: 14, duration: 600 },
    );
  }, [ready, fitToMarkers, markers]);

  const lastCenterRef = useRef(center);
  const centerLng = center[0];
  const centerLat = center[1];

  useEffect(() => {
    if (!ready) return;
    if (lastCenterRef.current[0] === centerLng && lastCenterRef.current[1] === centerLat) return;
    lastCenterRef.current = [centerLng, centerLat];
    mapRef.current?.easeTo({ center: [centerLng, centerLat], duration: 350 });
  }, [centerLng, centerLat, ready]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      className={cn(
        "relative z-0 h-64 w-full overflow-hidden rounded-2xl border border-border/85 bg-muted shadow-card sm:h-80",
        className,
      )}
    />
  );
}
