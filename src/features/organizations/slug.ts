import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

/** Converts an organization name into a stable, URL-safe slug. */
export function slugifyOrganizationName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return slug || "org";
}

async function slugExists(db: Db, slug: string): Promise<boolean> {
  const row = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .get();
  return Boolean(row);
}

/**
 * Returns an unused slug. The random fallback avoids a hard failure in the
 * unlikely event two signups race for every numeric suffix.
 */
export async function uniqueOrganizationSlug(db: Db, name: string): Promise<string> {
  const base = slugifyOrganizationName(name);

  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    if (!(await slugExists(db, candidate))) return candidate;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
