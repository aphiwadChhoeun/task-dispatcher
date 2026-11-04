import { json } from "@/lib/api";

/**
 * This route only runs during `next dev`, where Next's server cannot upgrade
 * WebSockets. The custom Worker entry intercepts `/api/realtime/ws` in preview
 * and production. Clients fall back to polling when this returns 501.
 */
export async function GET() {
  return json(
    {
      error: "WebSocket upgrades are not available in this runtime",
      fallback: "polling",
    },
    { status: 501 },
  );
}
