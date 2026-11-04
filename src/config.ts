function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

const publicOrigin =
  process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const config = {
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME ?? "Task Dispatcher",
    origin: publicOrigin,
    timezone: process.env.APP_TIMEZONE ?? "America/Los_Angeles",
  },
  auth: {
    cookieName: "td_session",
    csrfCookieName: "td_csrf",
    sessionTtlDays: int(process.env.SESSION_TTL_DAYS, 7),
    maxLoginAttempts: int(process.env.MAX_LOGIN_ATTEMPTS, 5),
    loginWindowMinutes: int(process.env.LOGIN_WINDOW_MINUTES, 15),
    inviteTtlDays: int(process.env.INVITE_TTL_DAYS, 7),
  },
  uploads: {
    maxBytes: int(process.env.MAX_UPLOAD_BYTES, 8 * 1024 * 1024),
    photoMimes: ["image/jpeg", "image/png", "image/webp"] as const,
    documentMimes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "text/plain",
    ] as const,
  },
  location: {
    retentionDays: int(process.env.LOCATION_RETENTION_DAYS, 7),
    staleSeconds: int(
      process.env.NEXT_PUBLIC_LOCATION_STALE_SECONDS ?? process.env.LOCATION_STALE_SECONDS,
      120,
    ),
    throttleMs: int(
      process.env.NEXT_PUBLIC_LOCATION_THROTTLE_MS ?? process.env.LOCATION_THROTTLE_MS,
      7000,
    ),
    minDistanceMeters: int(process.env.LOCATION_MIN_DISTANCE_METERS, 12),
  },
  maps: {
    provider: process.env.NEXT_PUBLIC_MAP_PROVIDER ?? process.env.MAP_PROVIDER ?? "osm",
    tileUrl:
      process.env.NEXT_PUBLIC_TILE_URL ??
      process.env.TILE_URL ??
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution: "&copy; OpenStreetMap contributors",
    geocoder: process.env.GEOCODER ?? "nominatim",
    geocoderUrl: process.env.GEOCODER_URL ?? "https://nominatim.openstreetmap.org",
    routing: process.env.ROUTING_PROVIDER ?? "osrm",
    routingUrl: process.env.ROUTING_URL ?? "https://router.project-osrm.org",
  },
  features: {
    push: bool(process.env.ENABLE_PUSH),
    pwa: bool(process.env.ENABLE_PWA, true),
  },
  pagination: {
    pageSize: 50,
    maxPhotosPerTask: 30,
  },
} as const;

export type AppConfig = typeof config;
