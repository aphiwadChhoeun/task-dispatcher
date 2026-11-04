import { json, requireApiPermission, withSession } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listPresence } from "@/features/tasks/queries";

export async function GET(request: Request) {
  return withSession(request, async (session) => {
    requireApiPermission(session, "location.read.all");
    const items = await listPresence(getDb(), session.orgId);
    return json({ items });
  });
}
