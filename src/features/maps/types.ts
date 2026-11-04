/** Serializable map types shared by server and client components. */

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  description?: string;
  color?: string;
  kind?: "tasker" | "task" | "pin";
  stale?: boolean;
  href?: string;
  hrefLabel?: string;
  draggable?: boolean;
};

export type MapRoute = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};
