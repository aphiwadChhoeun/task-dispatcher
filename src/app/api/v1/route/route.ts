import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { getRoute } from "@/features/maps/routing";

export async function GET(request: Request) {
  try {
    await requireApiSession(request);
    const url = new URL(request.url);
    const from = (url.searchParams.get("from") ?? "").split(",").map(Number);
    const to = (url.searchParams.get("to") ?? "").split(",").map(Number);
    if (
      from.length !== 2 ||
      to.length !== 2 ||
      !from.every(Number.isFinite) ||
      !to.every(Number.isFinite)
    ) {
      return json({ error: "Provide from and to as lat,lng" }, { status: 422 });
    }
    if (Math.abs(from[0]) > 90 || Math.abs(to[0]) > 90) {
      return json({ error: "Invalid coordinates" }, { status: 422 });
    }
    const result = await getRoute(
      { lat: from[0], lng: from[1] },
      { lat: to[0], lng: to[1] },
    );
    if (!result) return json({ route: null, error: "Routing service unavailable" });
    return json(result);
  } catch (error) {
    return apiError(error);
  }
}
