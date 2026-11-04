import { json } from "@/lib/api";

export async function GET() {
  return json({ ok: true, service: "task-dispatcher", time: new Date().toISOString() });
}
