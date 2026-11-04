import { drizzle } from "drizzle-orm/d1";
import { getEnv } from "@/lib/server-env";
import * as schema from "./schema";

export function getDb() {
  const env = getEnv();
  if (!env.DB) {
    throw new Error("D1 binding `DB` is not available");
  }
  // D1's runtime object is structural; passing it through keeps drizzle's
  // generated query types while avoiding Node-only Cloudflare type globals.
  return drizzle(env.DB as never, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
