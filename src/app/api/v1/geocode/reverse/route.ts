import { apiError, json } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { reverseGeocode } from "@/features/maps/geocoding";

export async function GET(request: Request) {
  try {
    await requireApiSession(request);
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return json({ error: "Invalid coordinates" }, { status: 422 });
    }
    const result = await reverseGeocode(lat, lng);
    return json({ result });
  } catch (error) {
    return apiError(error);
  }
}
