/**
 * Signed, self-contained session tokens.
 *
 * The cookie value is `v1.<payload>.<signature>`. The payload carries a random
 * session id (`sid`) which is stored (hashed) in D1, so revocation is immediate
 * while the proxy can verify the signature without a database round-trip.
 */
import type { Role } from "@/lib/permissions";
import { base64UrlEncode, signToken, verifyToken } from "@/lib/signed-token";

export type SessionTokenPayload = {
  sid: string;
  sub: string;
  org: string;
  role: Role;
  name: string;
  exp: number; // unix seconds
};

export async function createSessionToken(
  payload: Omit<SessionTokenPayload, "exp">,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const full: SessionTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  return signToken(full, secret);
}

export async function verifySessionToken(
  token: string | null | undefined,
  secret: string,
): Promise<SessionTokenPayload | null> {
  const payload = await verifyToken<SessionTokenPayload>(token, secret);
  if (!payload?.sid || !payload?.sub || !payload?.org) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newSessionId(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export function newInvitationToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
}
