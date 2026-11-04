/**
 * Minimal structural types for the Cloudflare bindings we use.
 *
 * We intentionally avoid `@cloudflare/workers-types` globals here so the same
 * TypeScript project can also type browser code. Drizzle receives the D1
 * binding as an opaque value; all SQL that matters is typed at the query level.
 */
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string; contentDisposition?: string };
  customMetadata?: Record<string, string>;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: {
      httpMetadata?: { contentType?: string; contentDisposition?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

export interface DurableObjectStub {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}

export interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface CloudflareEnv {
  DB: D1Database;
  FILES: R2Bucket;
  REALTIME: DurableObjectNamespace;
  ASSETS: Fetcher;
  AUTH_SECRET?: string;
  APP_URL?: string;
  APP_NAME?: string;
  MAP_PROVIDER?: string;
  TILE_URL?: string;
  GEOCODER?: string;
  GEOCODER_URL?: string;
  ROUTING_PROVIDER?: string;
  ROUTING_URL?: string;
  SESSION_TTL_DAYS?: string;
  LOCATION_RETENTION_DAYS?: string;
  LOCATION_STALE_SECONDS?: string;
  LOCATION_THROTTLE_MS?: string;
  MAX_UPLOAD_BYTES?: string;
  ENABLE_PUSH?: string;
  NEXT_PUBLIC_REALTIME_URL?: string;
}
