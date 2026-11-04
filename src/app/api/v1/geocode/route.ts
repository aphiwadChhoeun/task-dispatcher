import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { geocodeAddress } from "@/features/maps/geocoding";

export async function GET(request: Request) {
  try {
    await requireApiSession(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (query.length < 4) return json({ result: null });
    const result = await geocodeAddress(query);
    return json({ result });
  } catch (error) {
    return apiError(error);
  }
}
