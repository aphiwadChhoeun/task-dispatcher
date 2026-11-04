import { apiError, json, requireApiPermission } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { getTaskById, taskLocationHistory } from "@/features/tasks/queries";

/** Location history for route replay / reporting. Dispatcher-only. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession(request);
    requireApiPermission(session, "location.read.all");
    const { id } = await params;
    const db = getDb();
    const task = await getTaskById(db, session.orgId, id);
    if (!task) return json({ error: "Task not found" }, { status: 404 });
    const points = await taskLocationHistory(db, session.orgId, id, 500);
    return json({
      items: points
        .map((point) => ({
          lat: point.lat,
          lng: point.lng,
          accuracy: point.accuracy,
          heading: point.heading,
          speed: point.speed,
          recordedAt: point.recordedAt.toISOString(),
        }))
        .reverse(),
    });
  } catch (error) {
    return apiError(error);
  }
}
