# Architecture

## Runtime topology

```
Browser (dispatcher / tasker PWA)
        │  HTTPS + HTTP-only session cookie
        ▼
Cloudflare Worker  ──────────────────────────────────────────────┐
  worker.ts (custom entry)                                       │
    ├─ /api/realtime/ws  ──► RealtimeHub Durable Object (per org)│
    └─ everything else   ──► OpenNext generated Next.js handler  │
                                                                 │
Next.js App Router (Server Components / Server Actions)          │
    ├─ D1 (Drizzle)     ──► tasks, users, events, messages …     │
    ├─ R2 (FILES)       ──► photos, documents, chat attachments  │
    └─ outbound fetch   ──► Nominatim / OSRM / future email/push │
                                                                 │
Durable Object ── WebSocket Hibernation API ── broadcast to       │
                   dispatchers and the relevant tasker             │
        └─ persists latest position + history to D1               │
└────────────────────────────────────────────────────────────────┘
```

A single Worker deployable hosts both the Next app and the Durable Object. Next.js route handlers
cannot return a `101 Switching Protocols` response through the App Router pipeline, so `worker.ts`
intercepts `/api/realtime/ws` before OpenNext, verifies the signed realtime token, selects the org's
DO, and forwards the upgrade. Everything else goes to the generated OpenNext handler.

## Request and data flow

1. **Proxy (`src/proxy.ts`)** performs a lightweight route/role gate. It verifies the signed session
   cookie when `AUTH_SECRET` is available and redirects unauthenticated users or users entering the
   wrong area (tasker ↔ dispatcher). This is defense in depth, never the only check.
2. **Layouts** call `requireDispatcher()` / `requireTasker()` / `requireUser()`. These read the
   cookie, verify the signature, look up the D1 session row, and check that the user is active and
   belongs to the org encoded in the token.
3. **Reads** go through feature query modules (`features/*/queries.ts`). Every query takes an
   `orgId`, and tasker-facing queries add `taskerId` ownership. Reads return plain server data that
   is serialized into Server Components.
4. **Mutations** are Server Actions or `/api/v1` handlers. Both:
   - validate input with Zod (shared schemas live in each feature),
   - verify the permission matrix (`src/lib/permissions.ts`),
   - load the resource scoped by org and ownership,
   - enforce domain rules (task state machine, tasker active, assignment window, etc.),
   - write D1 and append to `task_events` / `audit_logs`,
   - publish a domain event.
5. **Files** go from browser → (client compression/re-encode) → R2 → metadata row in D1. Files are
   served by `/api/files/[...key]`, which authenticates, verifies the key belongs to the session's
   org, and checks task/grievance access before streaming from R2.
6. **Domain events** are published through `publishDomainEvent`. The default handler broadcasts the
   event via the org Durable Object and writes in-app notifications. Handler failures are logged and
   never roll back the mutation. Other features can subscribe with `onDomainEvent`.

## Authentication

- Password hash format: `pbkdf2-sha256$100000$<salt>$<hash>` using WebCrypto only.
- Session token (cookie): `v1.<base64url(payload)>.<base64url(HMAC)>`, payload contains a random
  session id, user id, org id, role, name, and expiry. The session id is stored hashed (SHA-256) in
  `sessions`; deleting that row revokes access immediately.
- Cookies are HTTP-only, `SameSite=Lax`, and `Secure` when the request is HTTPS. `proxy.ts` can
  verify the signature without a D1 read; layouts still check the DB row.
- Login rate limiting counts failed attempts by email and IP inside a D1-backed rolling window.
- Self-serve signup creates an `organizations` row, a global `users` account, and its first
  `dispatcher` membership in one D1 batch, derives a unique URL-safe organization slug, writes an
  audit event, and signs the dispatcher in. The client never chooses the organization id.
- `users` is the global account identity (email + password). `memberships` carries `org_id`, role,
  and membership status. Email is globally unique because it is the login identifier.
- A dispatcher has one membership. A tasker may have active memberships in multiple organizations.
  If login finds more than one active membership, it stores a short-lived signed
  `td_org_select` challenge cookie and redirects to `/select-organization`; choosing a workspace
  exchanges that challenge for a real session. The challenge grants no API access.
- Sessions store `user_id` + `org_id`. Resolution joins `memberships` on both and requires
  `memberships.status = active`, so deactivating a tasker in one organization does not break their
  access to another.
- Invitations are hashed at rest and single-use. Each invitation stores `org_id` and is joined
  against the user's membership in that organization. A new email activates the account and
  membership; an existing tasker account accepts the invite to activate an additional membership
  without changing its password. The invite link is shown to the dispatcher and the email adapter
  is called (no-op by default).
- The realtime token is a separate 5-minute HMAC token containing the same identity claims. It is
  sent in the WebSocket URL (not the session cookie) and re-verified by the Durable Object.

## Data model

D1/SQLite tables (see `src/lib/db/schema.ts`):

- `organizations`, `users` (global accounts), `memberships` (per-org role/status), `taskers`
  (per-org profile), `sessions`, `invitations`
- `tasks`, `task_events` (append-only), `task_photos`, `task_attachments`
- `message_threads`, `messages`, `thread_reads`
- `announcements`, `announcement_recipients`
- `locations`, `tasker_presence` (latest position materialized for map queries)
- `grievances`, `grievance_comments`, `grievance_attachments`
- `audit_logs`, `notifications`, `push_subscriptions`, `login_attempts`, `geocode_cache`

Indexes cover `org_id`, `tasker_id`, `status`, `scheduled_start`, thread/task time ordering, and
location time ordering. IDs are UUIDs generated with `crypto.randomUUID()`.

`task_events` is never updated or deleted by the app. `locations` is pruned by a daily DO alarm using
`LOCATION_RETENTION_DAYS`. `tasker_presence` is removed when a task reaches a terminal state so the
live map stops showing a stale marker.

## Task state machine

`src/features/tasks/state-machine.ts` owns the transition table and the UI/action checks.

```
assigned ──► accepted ──► en_route ──► in_progress ──► completed
   │            │            │             │
   │            └────────────┴─────────────┴──► cancelled   (dispatcher)
   ├──► rejected (tasker, reason)               └──► on_hold (either, reason)
   └──► on_hold ──► resume to saved status / cancelled
```

- Dispatchers may cancel or pause any non-terminal task; they cannot accept/start/complete.
- Taskers may only act on their own assigned task.
- Rejection and hold require a note; rejected/on_hold transitions are validated server-side.
- Accept/reject is rejected after the scheduled window closes.
- Every transition writes a `task_events` row with actor, from, to, note, optional coordinates.
- The action and the state machine are separate: the action loads/authorizes the task, the machine
  decides if the role/status pair is legal, then the write is committed.

## Realtime design

### Connection and authentication

`GET /api/realtime/ws?token=...` reaches `worker.ts` before Next. The worker:

1. requires `Upgrade: websocket` and a valid signed token,
2. checks the browser Origin against the request host / `APP_URL`,
3. gets `REALTIME.idFromName(orgId)` and forwards the request.

The DO verifies the token again and derives `userId`, `orgId`, role, and name. It calls
`state.acceptWebSocket(server, tags)` and stores the identity in the socket attachment. Hibernation
means idle orgs do not keep an isolate alive; D1 writes and broadcasts are triggered by incoming
messages.

### Client

`useRealtime` (client hook) fetches a token from `/api/v1/realtime/token`, connects, sends a ping
every 25 s, reconnects with exponential backoff, and reconnects on `online` / tab visibility. When
the socket is not open, it invokes `onPoll` every 6–15 s (depending on the screen). This is why the
UI works in `next dev` where WebSockets are unavailable.

### Protocol

Client → DO:

```json
{ "type": "ping" }
{ "type": "location.update", "taskId": "...", "lat": 37.79, "lng": -122.4,
  "accuracy": 8, "heading": null, "speed": 4.2, "recordedAt": 1730000000000 }
```

DO → client:

- `connected`, `pong`
- `presence.snapshot` (dispatchers on connect)
- `location.updated` (dispatchers)
- `location.ack` / `location.rejected` (sender)
- `task.assigned`, `task.status_changed`, `task.updated`, `task.deleted`
- `message.created`, `announcement.created`
- `grievance.opened`, `grievance.updated`, `grievance.comment_added`

Broadcast events carry an `audience` (`roles` and/or `userIds`). The DO only sends to sockets whose
attachment matches, so a tasker never receives another tasker's task/message events. Dispatchers
receive tasker events; taskers receive their own task/message/announcement events.

### Location throttling and persistence

- `watchPosition` with `enableHighAccuracy` is active only while the task is `en_route` or
  `in_progress`. The client throttles to one update per 7 s unless movement exceeds 12 m.
- The DO repeats a time/distance throttle as a safety net, validates that the task is assigned to
  the socket's tasker and is in an active sharing status, then inserts `locations` and upserts
  `tasker_presence` in one batch.
- Dispatchers mark a marker stale after `LOCATION_STALE_SECONDS` (default 120 s).
- A daily DO alarm deletes history older than `LOCATION_RETENTION_DAYS`.
- `GET /api/v1/live` is the polling fallback and the server-rendered map source.
- `GET /api/v1/tasks/:id/history` returns ordered points for route replay/reporting.

If the WebSocket send fails, the client POSTs to `/api/v1/tasks/:id/location`, which applies the same
authorization and persistence logic and publishes `location.updated` through the normal event bus.

## Permissions and multi-tenancy

`src/lib/permissions.ts` is the only permission matrix:

- `admin`: dispatcher actions + tasker actions + `org.manage`
- `dispatcher`: task CRUD/assign/cancel, tasker management, messages, broadcasts, grievance
  management, live locations, audit
- `tasker`: own tasks, own status transitions, own messages, own grievances, location sharing

`canViewTask`, `canShareLocation`, `canReadTaskMessages`, and `canCommentOnGrievance` add
resource-level ownership. Server actions call `requirePermission`/`assertCan`; API handlers call
`requireApiPermission`; layouts redirect by role. `proxy.ts` is a fast pre-check only.

Every tenant-owned table carries `org_id`. All queries in query modules include it, and cross-org
lookups are added to the tests (`permissions.spec.ts`). The session context includes the active
membership and organization, so layouts and `/api/v1/me` can display the tenant and role. Signing up
creates an isolated organization. Tasker invitations are bound to both the account and the
dispatcher's organization, and an invite can only activate the matching membership.

Roles are read from the active membership, not from the global account. This is what allows the same
tasker account to act as `tasker` in several organizations while a dispatcher remains single-org.
`taskers` is keyed by `(user_id, org_id)` so skills, vehicle, availability, and map color are
per-organization.

## Extension guide

### Add a role (e.g. `supervisor`)

1. Add `"supervisor"` to `ROLES` and extend `Role` in `src/lib/permissions.ts`.
2. Add an action list and entry in `PERMISSION_MATRIX`. Keep it explicit; never default to allow.
3. Decide the route prefix: add it to `DISPATCHER_PATHS` (or a new group) in `src/proxy.ts` and the
   relevant layout guard.
4. Add allowed transitions in `src/features/tasks/state-machine.ts` if the role can change statuses.
5. Add a unit test row in `tests/unit/permissions.test.ts`.
6. Update the sidebar/nav only if that role needs a UI.

### Add a feature (e.g. invoices)

1. Create `src/features/invoices/{schema,queries,service,actions,components}`.
2. Add tables to `src/lib/db/schema.ts` with `org_id` and indexes; run `npm run db:generate` and
   commit the SQL migration.
3. Add permissions actions (e.g. `invoices.manage`) to the matrix.
4. Use `requirePermission`, org-scoped queries, and Zod schemas in actions/API routes.
5. Emit domain events (`invoice.created`) and subscribe in another feature or integration.
6. Add a route under `(dispatcher)` or `/api/v1`; add tests for permission boundaries.

### Swap map/geocoding/routing

`features/maps/geocoding.ts` and `routing.ts` export provider interfaces with setters. Implement the
interface (Mapbox/Google geocoder, commercial router), then call the setter at startup or select it
from `config.maps`. MapLibre itself is isolated in `components/maps/map-shell.tsx`; changing tile
providers only requires a style/tile URL change in `config.ts`.

### Add push or email

- `features/notifications/service.ts` exposes `NotificationSender` + `setNotificationSender`.
  Implement Web Push (VAPID payload encryption) and register subscriptions using the existing
  `push_subscriptions` table.
- `features/email/service.ts` is the email port; implement a provider (Resend, Postmark,
  MailChannels) and call `setEmailService`. Invites already call `sendEmail` and fall back to logging.

## Observability and operations

- `observability.enabled` is on in `wrangler.jsonc`; Workers Logs receives structured JSON logs from
  `src/lib/observability.ts`.
- `reportError` accepts a replaceable `ErrorReporter` (plug in Sentry or a Cloudflare equivalent).
- The health endpoint is `/api/v1/health`.
- Local E2E uses the real Durable Object and R2 bindings via Wrangler, so it catches runtime-only
  issues (WebSocket upgrades, DO migrations, R2 streaming).
- The DO alarm is the only scheduled work; no Cron Trigger is required.

## Trade-offs and limits

- Taskers can belong to multiple organizations; dispatchers are intentionally limited to one.
  Additional dispatcher invites, organization settings, and per-organization display names remain
  future work. Account name/email are global and shared across memberships.
- The event bus is in-process per request. Durable side effects are written before publishing; the
  bus is for notifications/integrations, not for correctness.
- Realtime is one DO per organization. This is simple and sufficient for the MVP; per-tasker or
  sharded DOs are a later scale option.
- The public Nominatim/OSRM services are development defaults; they are not appropriate for a
  high-volume production deployment.
- `next dev` intentionally degrades realtime to polling; use `npm run preview` for the full path.
- Node.js Proxy (Next 16) is experimental in OpenNext; `proxy.ts` is deliberately thin, and every
  route/action still authorizes independently.
