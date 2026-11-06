# Task Dispatcher

A mobile-first field service dispatch app built on **Next.js 16 + Cloudflare Workers**.
Dispatchers create and monitor work; taskers receive tasks on their phones, navigate, share
live location, upload proof photos, message dispatch, and file grievances.

## What is included

- **Self-serve organizations** — a dispatcher can create an organization and its first account at
  `/signup`; every task, message, location, and audit row stays scoped to that organization.
- **Organization memberships** — a global account can be a tasker in multiple organizations. Login
  lets the tasker choose a workspace, and the tasker header includes a switcher. Dispatchers are
  limited to one organization.
- **Dispatcher console** — dashboard with Kanban/list views, filters, live map, task CRUD with
  address geocoding and a draggable map pin, tasker management and invites, task timeline,
  per-task messaging, broadcasts, and a grievance queue.
- **Tasker PWA** — My Tasks with newest-assignment highlighting and realtime alerts, status
  workflow, directions, live location sharing, photo capture/compression, messaging, and
  grievance filing. Installable with offline caching and a queued-write sync.
- **Realtime** — one Durable Object per organization using the WebSocket Hibernation API, with
  signed short-lived socket tokens, reconnect/backoff, and polling fallback.
- **Cloudflare-native data** — D1 via Drizzle, R2 for files behind an authenticated proxy,
  PBKDF2 auth with D1-backed sessions.
- **Guardrails** — a single permission matrix, org-scoped data access, server-side state machine,
  Zod validation, CSRF/origin checks, login rate limiting, and MIME/size validation.
- **Tests** — Vitest for signup validation, organization slugs, the state machine, permissions,
  tokens, and validation; Playwright covers the end-to-end organization signup + invite,
  dispatcher, tasker, live-location, grievance, and role-isolation flows.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 + Drizzle ORM + generated SQL migrations |
| Files | Cloudflare R2 |
| Realtime | Cloudflare Durable Objects (Hibernation API) |
| Auth | Email/password, PBKDF2-SHA256 (100k iterations), HTTP-only signed session cookie, D1 sessions |
| Maps | MapLibre GL JS + OpenStreetMap raster tiles; Nominatim geocoding; OSRM route preview (all adapter-based) |
| Styling | Tailwind CSS v4 + shadcn-style local UI primitives |
| Validation | Zod |
| Unit / E2E | Vitest / Playwright |

## Quick start

Requirements: Node.js 20+ (tested on 24), npm, and a Cloudflare account for deployment.
Windows is supported for local development, though OpenNext itself recommends WSL/Linux for the
build step (see [Windows notes](#windows-notes)).

```bash
npm install

# Local secrets (both files are gitignored)
cp .env.example .env.local
cp .dev.vars.example .dev.vars

# Apply D1 migrations and seed the demo organization
npm run db:reset

# Fast UI development. WebSockets are not available in Next's dev server,
# so the app automatically falls back to polling.
npm run dev
```

For the full runtime (Durable Objects, real WebSockets, custom worker entry):

```bash
npm run preview
```

`preview` builds with OpenNext and starts `wrangler dev` on
[http://localhost:8787](http://localhost:8787). Use this when testing live location or realtime
messaging. `next dev` on port 3000 is faster for normal UI work.

### Create a new organization

Open [http://localhost:3000/signup](http://localhost:3000/signup) (or `:8787` under `preview`) and
enter an organization name, your name, email, and password. The first user becomes the
organization's dispatcher and is signed in. From **Taskers**, invite field staff. A new email creates
an account in that organization; an existing tasker account can accept the invite to add another
membership. Log in with email + password — one account can belong to multiple organizations as a
tasker, so those users choose a workspace after signing in.

### Demo accounts

Seeded by `npm run db:reset` (password for all accounts: `Password123!`):

| Role | Email |
| --- | --- |
| Dispatcher | `dispatch@example.com` |
| Tasker | `alex@example.com` |
| Tasker | `maria@example.com` |
| Tasker | `sam@example.com` |

There is also a pending invite for `jordan@example.com`:

```
http://localhost:3000/invite/demo-invite-jordan-2026   # next dev
http://localhost:8787/invite/demo-invite-jordan-2026   # preview
```

Change the port to match your dev server. Demo credentials are shown on the login screen only when
`NODE_ENV !== "production"`.

## Local development

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server on `:3000` with Miniflare-backed D1/R2. Realtime falls back to polling. |
| `npm run preview` | OpenNext build + `wrangler dev` on `:8787` with Durable Objects and WebSockets. |
| `npm run db:generate` | Generate a new Drizzle SQL migration into `drizzle/`. |
| `npm run db:migrate:local` | Apply migrations to the local D1 state. |
| `npm run db:seed` | Regenerate `.wrangler/seed.sql` from `scripts/seed.ts`. |
| `npm run db:seed:local` | Regenerate and apply seed data locally. |
| `npm run db:reset` | Delete local Wrangler state, remigrate, and reseed. |
| `npm run test` | Run Vitest unit tests. |
| `npm run test:e2e` | Build with OpenNext, reset/seed D1, start `wrangler dev`, and run Playwright. |
| `npm run typecheck` | TypeScript with no emit. |
| `npm run lint` | ESLint (Next config + React rules). |
| `npm run icons` | Regenerate PWA PNG icons from `public/icons/icon.svg`. |

### Notes on local development

- `next dev` cannot upgrade WebSockets; `/api/realtime/ws` returns 501 and clients poll instead.
  Everything else (D1, R2, auth, server actions) works through OpenNext's dev platform proxy.
- The Durable Object binding is reported as unavailable by Wrangler during `next dev`; this is
  expected. It works under `npm run preview` and in production.
- `.dev.vars` supplies secrets to `wrangler dev`; `.env.local` supplies them to Next. Keep both in
  sync for `AUTH_SECRET`. Neither file is committed.
- The seed script deletes application rows before inserting. Do not run it against production.

## Configuration

Server config is typed in `src/config.ts`; all values can be overridden by environment variables.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | dev fallback only | HMAC secret for session and realtime tokens. **Required in production.** |
| `APP_URL` | `http://localhost:3000` | Public origin used in invite links and origin checks. |
| `NEXT_PUBLIC_APP_URL` | `APP_URL` | Public origin baked into the client build. |
| `NEXT_PUBLIC_REALTIME_URL` | same origin | Optional separate realtime origin. Leave empty for the same worker. |
| `SESSION_TTL_DAYS` | `7` | Session lifetime. |
| `ORG_SELECT_TTL_SECONDS` | `600` | Lifetime of the signed workspace-selection challenge after login. |
| `MAX_LOGIN_ATTEMPTS` | `5` | Failed attempts per email inside the window. |
| `LOGIN_WINDOW_MINUTES` | `15` | Rate-limit window. |
| `INVITE_TTL_DAYS` | `7` | Invitation lifetime. |
| `LOCATION_RETENTION_DAYS` | `7` | D1 location-history retention. |
| `LOCATION_STALE_SECONDS` | `120` | Marker is stale after this long without an update. |
| `LOCATION_THROTTLE_MS` | `7000` | Client/DO location update throttle. |
| `NEXT_PUBLIC_LOCATION_STALE_SECONDS` | `120` | Client copy of the stale threshold (set alongside the server value). |
| `NEXT_PUBLIC_LOCATION_THROTTLE_MS` | `7000` | Client copy of the location throttle. |
| `MAX_UPLOAD_BYTES` | `8388608` | Max photo/document size (8 MB). |
| `MAP_PROVIDER` / `NEXT_PUBLIC_MAP_PROVIDER` | `osm` | Map adapter selector. |
| `NEXT_PUBLIC_TILE_URL` | OSM tiles | Raster tile URL. |
| `GEOCODER` / `GEOCODER_URL` | `nominatim` / public Nominatim | Geocoding adapter. Set `GEOCODER=none` to disable. |
| `GEOCODER_USER_AGENT` | `TaskDispatcher/1.0 (+APP_URL)` | Nominatim requires an identifying User-Agent. Do not use an `example.com` contact, which returns HTTP 403. |
| `ROUTING_PROVIDER` / `ROUTING_URL` | `osrm` / public OSRM | Route preview adapter. Set `ROUTING_PROVIDER=none` to disable. |
| `ENABLE_PUSH` | `false` | Enables the push sender hook (no-op until a sender is configured). |
| `ENABLE_PWA` | `true` | PWA feature flag. |

Public map values are inlined into the client bundle and must start with `NEXT_PUBLIC_`.
Nominatim/OSRM public endpoints are for development and low-volume use; use your own instance or a
commercial provider in production.

## Deployment to Cloudflare

1. **Authenticate Wrangler**

   ```bash
   npx wrangler login
   ```

2. **Create D1 and R2**

   ```bash
   npx wrangler d1 create task-dispatcher-db
   npx wrangler r2 bucket create task-dispatcher-files
   ```

   Copy the D1 `database_id` printed by Wrangler into `wrangler.jsonc` (replace the all-zero
   placeholder). Change `database_name` / `bucket_name` if you prefer different names.

3. **Set secrets and the public origin**

   ```bash
   npx wrangler secret put AUTH_SECRET
   # generate one with: openssl rand -base64 32
   ```

   Update `APP_URL` in `wrangler.jsonc` to your production URL (for example
   `https://dispatch.example.com`). Set `NEXT_PUBLIC_APP_URL` in `.env.local` (or your CI build
   environment) to the same value before building. Leave `NEXT_PUBLIC_REALTIME_URL` empty; the
   WebSocket is served by the same worker at `/api/realtime/ws`.

4. **Apply migrations**

   ```bash
   npm run db:migrate:remote
   ```

   Wrangler applies the Durable Object migration (`new_sqlite_classes`) during the first deploy.

5. **Deploy**

   ```bash
   npm run deploy
   ```

   `deploy` runs an OpenNext build and `wrangler deploy`. The custom entry point (`worker.ts`)
   re-exports the generated OpenNext handler plus the `RealtimeHub` Durable Object and intercepts
   `/api/realtime/ws`.

6. **Optional custom domain**: add a Workers route/custom domain in the Cloudflare dashboard, then
   update `APP_URL` and `NEXT_PUBLIC_APP_URL` and redeploy.

Do **not** run `npm run db:seed:local` against production. Organizations create themselves through
`/signup`, and dispatchers invite their taskers from the Taskers page. The seed script is for local
demo data only.

## Testing

```bash
npm run test        # 37 unit tests
npm run test:e2e    # builds, resets local D1, starts wrangler, runs Playwright
```

Playwright covers:

- A dispatcher signs up a new organization, invites a tasker, and the tasker activates the account
  into that organization.
- An existing tasker accepts a second organization invite, chooses a workspace at login, and
  switches organizations from the tasker header.
- Dispatcher creates a task with a map pin and assigns it.
- Tasker accepts, starts driving, starts work, completes, and uploads a proof photo.
- Dispatcher receives a live location over the realtime WebSocket.
- Tasker files a grievance; dispatcher reviews and comments; tasker sees the update.
- Taskers cannot open dispatcher routes, other taskers' tasks, or dispatcher APIs.

The E2E suite runs against the OpenNext/Wrangler build (`http://127.0.0.1:8787`) so Durable Objects,
WebSockets, the proxy, and R2 are exercised. It resets local D1 with `db:reset`; it never touches
remote data. Service workers are blocked in the test context to keep tests deterministic. Stop any
running `npm run preview` before running the suite (the web server owns port 8787).

## Project layout

```
src/
  app/                     routes: (dispatcher), (tasker), api/v1, files, login, signup, invite
  features/
    auth/                  password hashing, signed sessions, login/signup/invite actions
    organizations/         organization slug generation and tenant helpers
    tasks/                 schema, state machine, queries, services, actions, components
    taskers/               invite/manage taskers
    grievances/            grievance queue, filing, comments, audit
    messaging/             per-task threads and read receipts
    location/              live map, geolocation sharing, presence queries
    maps/                  MapLibre components, geocoding/routing adapters
    announcements/         broadcasts to taskers
    files/                 R2 adapter and validation
    notifications/         in-app notifications + pluggable push sender
    events/                domain event bus and default handlers
    realtime/              client hook and server broadcast helper
  components/              UI primitives, app shell, PWA helpers
  lib/                     db, permissions, csrf, validation, format, offline queue
  realtime/hub.ts          Durable Object (WebSocket Hibernation API)
  proxy.ts                 lightweight route/role gate
worker.ts                  custom OpenNext Worker entry
drizzle/                   generated SQL migrations
scripts/                   seed/reset/icons helpers
tests/                     Vitest unit + Playwright E2E
docs/architecture.md       deeper design notes
```

## Security notes

- Passwords use PBKDF2-SHA256 with 100,000 iterations (the Cloudflare WebCrypto limit is respected).
- Session cookies are HTTP-only, `SameSite=Lax`, `Secure` when served over HTTPS, and signed; the
  session row in D1 is authoritative for revocation.
- Server Actions re-check the permission matrix and origin/`Sec-Fetch-Site`; API mutations also
  require same-origin requests. Mutating `GET`s are not used.
- Every query in the data-access layer is scoped by `org_id` (and task ownership for taskers).
  Roles and membership status live in `memberships`, not on the global account.
- Invitations are bound to both the user and the organization. Accepting one activates a membership
  in that organization and never changes an existing account's password.
- Email is globally unique because it is the login identifier. One account can have many tasker
  memberships; dispatcher membership creation is restricted to organization signup.
- Login failures are rate-limited by email and IP in D1. Multi-organization accounts receive a
  short-lived signed challenge cookie before choosing a workspace; it is exchanged for a real
  session and grants no API access.
- R2 objects are never public: `/api/files/[...key]` requires a session, verifies the org prefix,
  and checks task/grievance access.
- Uploads are re-encoded in the browser (stripping EXIF GPS), then validated server-side by MIME,
  size, and magic bytes.
- Invitation tokens are stored only as SHA-256 hashes and are single-use.
- Realtime uses short-lived (5 minute) HMAC tokens in the WebSocket URL; the Durable Object verifies
  the token again and derives the user/org from it. Server broadcasts are protected by an internal
  secret header.
- Set `AUTH_SECRET` in production; the development fallback is intentionally obvious and should
  never be used in a deployed environment.

## PWA and offline behavior

- `public/manifest.webmanifest`, icons, and a service worker are included. The tasker layout shows
  an install prompt on Android/Chrome and instructions for iOS Safari.
- The service worker caches app-shell assets and tasker task pages (network-first) with `/offline`
  as a fallback.
- Status changes and photos made while offline are queued in IndexedDB and replayed when the
  connection returns. Messages require a connection.
- iOS Safari may suspend background geolocation when the screen locks; the LocationSharer UI warns
  the tasker to keep the page open. The Wake Lock API is used where supported.
- Web Push is behind a `NotificationSender` interface. In-app notifications and WebSocket alerts work
  now; configure a sender with VAPID keys to enable OS push.

## Windows notes

OpenNext warns that Windows is not fully supported. The app builds and runs under `wrangler dev` on
Windows in this repository, but if you hit build/runtime issues, use WSL or deploy from Linux CI. The
standard `next dev` path works natively.

## Assumptions and open questions

**Assumptions**

- Multi-tenant deployments are supported through self-serve organization signup. Dispatchers
  belong to exactly one organization; taskers can be active in multiple organizations and switch
  workspaces from the tasker header.
- Email is the login identifier and is unique across accounts. Organization membership, role, and
  status are separate from the account.
- No email delivery provider is configured, so invite links are shown to the dispatcher to
  copy/share (they are also passed to the pluggable email adapter).
- OSM tiles/Nominatim/OSRM are used through adapters; production should use self-hosted or paid
  providers with their usage policies and an API key.
- Dispatchers cannot perform tasker forward transitions (accept/start/complete); taskers own the
  field workflow. Dispatchers can cancel, pause, resume, reassign, and edit.
- Taskers can accept/reject only inside the scheduled window; after it closes, dispatch must
  reschedule.
- Photos are re-encoded to JPEG in the browser; EXIF GPS is therefore stripped. If location proof
  from EXIF is ever required, add an explicit metadata storage path.

**Open questions / next steps**

- Billing, invoicing, SMS, and analytics integrations (the domain-event bus is the intended hook).
- Inviting additional dispatchers and organization settings. The schema already supports multiple
  tasker memberships; dispatcher membership is intentionally one per account.
- Real Web Push (VAPID keys, subscription UI/endpoint) and email delivery.
- Route replay UI on top of `GET /api/v1/tasks/:id/history` and richer reporting exports.
- Supervisor/client roles (add entries to `src/lib/permissions.ts`; see architecture doc).
- Background location on iOS remains a platform limitation; consider a native wrapper if it becomes
  essential.

## Extension points

- **Roles/permissions** — `src/lib/permissions.ts` is the single matrix. Add a role, grant actions,
  then use `assertCan`/`requirePermission` in actions and `proxy.ts` for route hints.
- **Domain events** — `src/lib/events.ts` + `src/features/events/handlers.ts`. Subscribe for
  invoicing, SMS, analytics, or CRM sync.
- **Service adapters** — storage (`features/files/storage.ts`), geocoding/routing
  (`features/maps/*`), notifications (`features/notifications/service.ts`), email
  (`features/email/service.ts`). Each has a setter for swapping implementations.
- **API** — `/api/v1` reuses the same services as server actions. Add resources there for native or
  partner clients.
- **Reporting** — `task_events` is append-only and `locations` is retained per the configured window;
  add exports/dashboards without changing the write path.
- **i18n** — `src/i18n/messages.ts` centralizes shared strings; add a locale module and a lookup
  helper when needed.

See [`docs/architecture.md`](docs/architecture.md) for data flow, the realtime protocol, and a
step-by-step guide to adding a role or feature.
