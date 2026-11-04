import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";
import { config } from "@/config";
import { RateLimitError } from "@/lib/errors";

function windowStart(): Date {
  return new Date(Date.now() - config.auth.loginWindowMinutes * 60_000);
}

async function failureCountForEmail(db: Db, email: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, windowStart()),
      ),
    );
  return Number(row?.n ?? 0);
}

async function failureCountForIp(db: Db, ip: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, windowStart()),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function assertLoginAllowed(db: Db, email: string, ip: string): Promise<void> {
  const [byEmail, byIp] = await Promise.all([
    failureCountForEmail(db, email),
    failureCountForIp(db, ip),
  ]);
  if (byEmail >= config.auth.maxLoginAttempts || byIp >= config.auth.maxLoginAttempts * 3) {
    throw new RateLimitError();
  }
}

export async function recordLoginAttempt(
  db: Db,
  email: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({ email, ip, success });
  if (Math.random() < 0.05) {
    await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60_000)))
      .catch(() => undefined);
  }
}

export async function clientIp(headerSource: Headers): Promise<string> {
  return (
    headerSource.get("cf-connecting-ip") ??
    headerSource.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
