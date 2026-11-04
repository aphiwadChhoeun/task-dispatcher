import type { Role } from "@/lib/permissions";
import { signToken, verifyToken } from "@/lib/signed-token";

export type RealtimeTokenPayload = {
  sub: string;
  org: string;
  role: Role;
  name: string;
  exp: number;
};

const DEFAULT_TTL_SECONDS = 5 * 60;

export async function signRealtimeToken(
  user: { id: string; orgId: string; role: Role; name: string },
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return signToken(
    {
      sub: user.id,
      org: user.orgId,
      role: user.role,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies RealtimeTokenPayload,
    secret,
  );
}

export async function verifyRealtimeToken(
  token: string | null | undefined,
  secret: string,
): Promise<RealtimeTokenPayload | null> {
  const payload = await verifyToken<RealtimeTokenPayload>(token, secret);
  if (!payload?.sub || !payload.org || !payload.role) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  return payload;
}
