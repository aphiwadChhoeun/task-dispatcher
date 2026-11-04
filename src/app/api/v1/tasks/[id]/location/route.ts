import { z } from "zod";
import { assertApiMutation } from "@/lib/csrf";
import { apiError, json, parseJson } from "@/lib/api";
import { requireApiSession } from "@/features/auth/session";
import { recordTaskLocation } from "@/features/location/service";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional().nullable(),
  heading: z.number().optional().nullable(),
  speed: z.number().optional().nullable(),
  recordedAt: z.number().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertApiMutation(request);
    const session = await requireApiSession(request);
    const { id } = await params;
    const body = await parseJson(request, locationSchema);
    const result = await recordTaskLocation(session.user, id, body);
    return json({ ok: true, updatedAt: result.updatedAt });
  } catch (error) {
    return apiError(error);
  }
}
