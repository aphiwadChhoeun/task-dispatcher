import { json, withSession } from "@/lib/api";
import { getAuthSecret } from "@/lib/server-env";
import { signRealtimeToken } from "@/lib/realtime-token";

export async function GET(request: Request) {
  return withSession(request, async (session) => {
    const token = await signRealtimeToken(session.user, getAuthSecret(), 300);
    return json({ token, expiresIn: 300 });
  });
}
