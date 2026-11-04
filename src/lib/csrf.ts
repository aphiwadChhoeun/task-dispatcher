import "server-only";
import { headers } from "next/headers";
import { config } from "@/config";
import { ForbiddenError } from "@/lib/errors";

function allowedHosts(): string[] {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(config.app.origin).host);
  } catch {
    // ignore malformed APP_URL
  }
  for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!value) continue;
    try {
      hosts.add(new URL(value).host);
    } catch {
      // ignore
    }
  }
  return [...hosts];
}

/**
 * Server Action CSRF defense. Next.js verifies Origin against Host for Server
 * Actions already; this adds explicit checks (including `Sec-Fetch-Site`) and
 * a configurable allow-list for the deployment origin.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const fetchSite = h.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new ForbiddenError("Cross-site request blocked");
  }

  const source = h.get("origin") ?? h.get("referer");
  if (!source) return; // non-browser client

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    throw new ForbiddenError("Invalid request origin");
  }

  const requestHost = h.get("x-forwarded-host") ?? h.get("host");
  const allowed = new Set([...allowedHosts(), ...(requestHost ? [requestHost] : [])]);
  if (!allowed.has(sourceHost)) {
    throw new ForbiddenError("Request origin is not allowed");
  }
}

export function assertApiMutation(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new ForbiddenError("Cross-site request blocked");
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenError("Invalid request origin");
  }
  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const allowed = new Set([...allowedHosts(), ...(requestHost ? [requestHost] : [])]);
  if (!allowed.has(originHost)) {
    throw new ForbiddenError("Request origin is not allowed");
  }
}
