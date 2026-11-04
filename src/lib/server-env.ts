import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/lib/cloudflare-types";

let devFallback: CloudflareEnv | null = null;

/**
 * Returns the Cloudflare bindings for the current request.
 * During `next dev`, the OpenNext adapter provides Miniflare-backed bindings.
 */
export function getEnv(): CloudflareEnv {
  try {
    return getCloudflareContext().env as unknown as CloudflareEnv;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // Only reached by scripts/tests that do not run inside Next.
      devFallback ??= {} as CloudflareEnv;
      return devFallback;
    }
    throw new Error(
      `Cloudflare bindings are unavailable. Did you call initOpenNextCloudflareForDev()? ${
        error instanceof Error ? error.message : ""
      }`,
    );
  }
}

export function getAuthSecret(): string {
  const env = getEnv();
  const secret = env.AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-change-me-4f8c2d1e9a7b6c5d4e3f2a1b0c9d8e7f";
  }
  throw new Error("AUTH_SECRET is not configured (use `wrangler secret put AUTH_SECRET`)");
}
