import type { CloudflareEnv } from "../lib/cloudflare-types";
import { config } from "../config";
import { verifyRealtimeToken } from "../lib/realtime-token";

type SocketRole = "admin" | "dispatcher" | "tasker";

type SocketMeta = {
  userId: string;
  orgId: string;
  role: SocketRole;
  name: string;
  lastLocationAt?: number;
  lastLat?: number | null;
  lastLng?: number | null;
};

type HibernatableWebSocket = WebSocket & {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
};

type DurableObjectState = {
  acceptWebSocket(socket: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  storage: {
    setAlarm(time: number): Promise<void>;
    getAlarm(): Promise<number | null>;
  };
};

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

type PresenceRow = {
  tasker_id: string;
  task_id: string | null;
  task_status: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: number;
  name: string;
  phone: string | null;
  color: string | null;
  task_title: string | null;
};

const DISPATCHER_AUDIENCE = { roles: ["admin", "dispatcher"] as SocketRole[] };
const DAY_MS = 24 * 60 * 60 * 1000;

function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earth = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

/**
 * One Durable Object per organization. Uses the WebSocket Hibernation API so
 * idle orgs cost nothing; the latest positions are persisted to D1 and live
 * updates are fanned out only to connected dispatchers.
 */
export class RealtimeHub {
  private readonly env: CloudflareEnv;
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, env: CloudflareEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/broadcast")) {
      return this.handleBroadcast(request);
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "Expected a WebSocket upgrade" }, 426);
    }

    const token = url.searchParams.get("token");
    const secret = this.env.AUTH_SECRET;
    const payload = secret ? await verifyRealtimeToken(token, secret) : null;
    if (!payload) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = payload.sub;
    const orgId = payload.org;
    const role = payload.role;
    const name = payload.name;

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1] as HibernatableWebSocket;

    this.state.acceptWebSocket(server, [`user:${userId}`, `role:${role}`, `org:${orgId}`]);
    server.serializeAttachment({
      userId,
      orgId,
      role,
      name,
      lastLocationAt: 0,
      lastLat: null,
      lastLng: null,
    } satisfies SocketMeta);

    server.send(
      JSON.stringify({
        type: "connected",
        at: Date.now(),
        payload: { userId, role, serverTime: Date.now() },
      }),
    );

    if (role === "admin" || role === "dispatcher") {
      const presence = await this.loadPresence(orgId);
      server.send(
        JSON.stringify({
          type: "presence.snapshot",
          at: Date.now(),
          payload: { items: presence },
        }),
      );
    }

    return new Response(null, { status: 101, webSocket: client } as unknown as ResponseInit);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }

    const meta = (ws as HibernatableWebSocket).deserializeAttachment() as SocketMeta | null;
    if (!meta) return;

    try {
      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
          break;
        case "location.update":
          await this.handleLocationUpdate(ws as HibernatableWebSocket, meta, data);
          break;
        default:
          ws.send(JSON.stringify({ type: "error", payload: { reason: "unknown_message_type" } }));
      }
    } catch (error) {
      console.error("[realtime] websocket message failed", error);
      try {
        ws.send(JSON.stringify({ type: "error", payload: { reason: "server_error" } }));
      } catch {
        // socket already closed
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      // already closed
    }
  }

  private async handleLocationUpdate(
    ws: HibernatableWebSocket,
    meta: SocketMeta,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (meta.role !== "tasker") {
      ws.send(JSON.stringify({ type: "location.rejected", payload: { reason: "not_a_tasker" } }));
      return;
    }

    const taskId = typeof data.taskId === "string" ? data.taskId : null;
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!taskId || !isValidCoordinate(lat, lng)) {
      ws.send(JSON.stringify({ type: "location.rejected", payload: { reason: "invalid_coordinates" } }));
      return;
    }

    const task = await this.env.DB.prepare(
      `SELECT id, status FROM tasks
       WHERE id = ? AND org_id = ? AND tasker_id = ? AND status IN ('en_route','in_progress')
       LIMIT 1`,
    )
      .bind(taskId, meta.orgId, meta.userId)
      .first<{ id: string; status: string }>();

    if (!task) {
      ws.send(
        JSON.stringify({
          type: "location.rejected",
          payload: { reason: "task_not_active" },
        }),
      );
      return;
    }

    const now = Date.now();
    const elapsed = now - (meta.lastLocationAt ?? 0);
    const moved =
      meta.lastLat != null && meta.lastLng != null
        ? metresBetween(meta.lastLat, meta.lastLng, lat, lng)
        : Number.POSITIVE_INFINITY;

    // Throttle by time or meaningful movement to save battery and D1 writes.
    if (
      elapsed < envNumber(this.env.LOCATION_THROTTLE_MS, config.location.throttleMs) &&
      moved < config.location.minDistanceMeters
    ) {
      ws.send(JSON.stringify({ type: "location.ack", payload: { taskId, skipped: true, at: now } }));
      return;
    }

    const recordedRaw = Number(data.recordedAt);
    const recordedAt = Number.isFinite(recordedRaw)
      ? Math.min(Math.max(recordedRaw, now - 5 * 60_000), now + 60_000)
      : now;

    const accuracy = Number.isFinite(Number(data.accuracy)) ? Number(data.accuracy) : null;
    const heading = Number.isFinite(Number(data.heading)) ? Number(data.heading) : null;
    const speed = Number.isFinite(Number(data.speed)) ? Number(data.speed) : null;

    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO locations
          (id, org_id, tasker_id, task_id, lat, lng, accuracy, heading, speed, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        meta.orgId,
        meta.userId,
        taskId,
        lat,
        lng,
        accuracy,
        heading,
        speed,
        recordedAt,
      ),
      this.env.DB.prepare(
        `INSERT INTO tasker_presence
          (tasker_id, org_id, task_id, task_status, lat, lng, accuracy, heading, speed, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tasker_id) DO UPDATE SET
           org_id = excluded.org_id,
           task_id = excluded.task_id,
           task_status = excluded.task_status,
           lat = excluded.lat,
           lng = excluded.lng,
           accuracy = excluded.accuracy,
           heading = excluded.heading,
           speed = excluded.speed,
           updated_at = excluded.updated_at`,
      ).bind(
        meta.userId,
        meta.orgId,
        taskId,
        task.status,
        lat,
        lng,
        accuracy,
        heading,
        speed,
        recordedAt,
      ),
    ]);

    meta.lastLocationAt = now;
    meta.lastLat = lat;
    meta.lastLng = lng;
    ws.serializeAttachment(meta);

    const event = {
      type: "location.updated",
      at: now,
      payload: {
        taskerId: meta.userId,
        taskerName: meta.name,
        taskId,
        taskStatus: task.status,
        lat,
        lng,
        accuracy,
        heading,
        speed,
        updatedAt: recordedAt,
        stale: false,
      },
    };
    this.broadcast(event, DISPATCHER_AUDIENCE);
    ws.send(JSON.stringify({ type: "location.ack", payload: { taskId, at: now } }));

    const alarm = await this.state.storage.getAlarm();
    if (!alarm) {
      await this.state.storage.setAlarm(Date.now() + DAY_MS);
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const secret = request.headers.get("x-internal-secret");
    if (!this.env.AUTH_SECRET || secret !== this.env.AUTH_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    let event: Record<string, unknown>;
    try {
      event = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const delivered = this.broadcast(event, event.audience as { roles?: SocketRole[]; userIds?: string[] } | undefined);
    return json({ ok: true, delivered });
  }

  private broadcast(
    event: Record<string, unknown> | { type: string; at: number; payload: unknown },
    audience?: { roles?: SocketRole[]; userIds?: string[] },
  ): number {
    const encoded = JSON.stringify(event);
    let delivered = 0;
    for (const ws of this.state.getWebSockets()) {
      const meta = (ws as HibernatableWebSocket).deserializeAttachment() as SocketMeta | null;
      if (!meta) continue;

      if (audience) {
        const roleMatch = audience.roles?.includes(meta.role) ?? false;
        const userMatch = audience.userIds?.includes(meta.userId) ?? false;
        if (!roleMatch && !userMatch) continue;
      }

      try {
        ws.send(encoded);
        delivered += 1;
      } catch {
        // dropped socket; hibernation cleans it up
      }
    }
    return delivered;
  }

  private async loadPresence(orgId: string): Promise<Record<string, unknown>[]> {
    const result = await this.env.DB.prepare(
      `SELECT p.tasker_id, p.task_id, p.task_status, p.lat, p.lng, p.accuracy,
              p.heading, p.speed, p.updated_at, u.name, u.phone, tk.color,
              t.title AS task_title
       FROM tasker_presence p
       JOIN users u ON u.id = p.tasker_id
       LEFT JOIN taskers tk ON tk.user_id = p.tasker_id
       LEFT JOIN tasks t ON t.id = p.task_id
       WHERE p.org_id = ?
       ORDER BY p.updated_at DESC`,
    )
      .bind(orgId)
      .all<PresenceRow>();

    const now = Date.now();
    const staleMs =
      envNumber(this.env.LOCATION_STALE_SECONDS, config.location.staleSeconds) * 1000;
    return (result.results ?? []).map((row) => ({
      taskerId: row.tasker_id,
      taskerName: row.name,
      taskerPhone: row.phone,
      color: row.color ?? "#0f766e",
      taskId: row.task_id,
      taskTitle: row.task_title,
      taskStatus: row.task_status,
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy,
      heading: row.heading,
      speed: row.speed,
      updatedAt: row.updated_at,
      stale: now - row.updated_at > staleMs,
    }));
  }

  /** Daily retention cleanup for location history. */
  async alarm(): Promise<void> {
    const retentionDays = envNumber(
      this.env.LOCATION_RETENTION_DAYS,
      config.location.retentionDays,
    );
    const cutoff = Date.now() - retentionDays * DAY_MS;
    try {
      await this.env.DB.prepare("DELETE FROM locations WHERE recorded_at < ?").bind(cutoff).run();
    } catch (error) {
      console.error("[realtime] location retention cleanup failed", error);
    }
    await this.state.storage.setAlarm(Date.now() + DAY_MS);
  }
}
