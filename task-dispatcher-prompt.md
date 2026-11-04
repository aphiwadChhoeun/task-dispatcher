# Task Dispatcher Web App

Build a mobile-friendly web application called **Task Dispatcher**. Dispatchers create and manage field tasks and monitor taskers. Taskers receive tasks on their phones, navigate to locations, update status, upload photos, and communicate with the dispatcher.

## Tech Stack (required)

- **Framework:** Next.js (latest stable, App Router, TypeScript, Server Components and Server Actions where appropriate)
- **Hosting/Runtime:** Cloudflare. Deploy to Cloudflare Workers using the OpenNext adapter (`@opennextjs/cloudflare`) with Wrangler.
- **Database:** Cloudflare D1 (SQLite) with Drizzle ORM. Use migrations.
- **File storage:** Cloudflare R2 for task photos and attachments.
- **Realtime:** Cloudflare Durable Objects with WebSockets for live location and status/chat updates. Use Durable Objects with the Hibernation API where possible.
- **Auth:** Email + password with secure, HTTP-only session cookies stored in D1 (or a KV-backed session store). Hash passwords with a Workers-compatible algorithm (e.g., PBKDF2 via Web Crypto). Do not use Node-only libraries that break on the Workers runtime.
- **Maps:** MapLibre GL JS with OpenStreetMap tiles (or Mapbox/Google Maps behind an adapter interface). Use a geocoding adapter so the provider can be swapped.
- **Styling:** Tailwind CSS plus a component library such as shadcn/ui.
- **Validation:** Zod, shared between client and server.
- **Testing:** Vitest for unit tests, Playwright for end-to-end tests of the core flows.

## User Roles

### 1. Dispatcher
- Logs in with email and password.
- Manages **taskers**: create, invite, deactivate, and view profiles.
- Manages **tasks** for each tasker: add, update, delete, reassign, and cancel.
- Each task includes:
  - Title and description
  - Task type/category
  - Priority (low, normal, high, urgent)
  - Scheduled date/time window
  - Address (structured fields: street, city, state, postal code, country) with a **map pin** that can be set by geocoding the address or by dragging the pin
  - Customer/contact name and phone (optional)
  - Notes and instructions
  - Attachments (reference photos, documents)
  - Status (see workflow below)
- Views a **dashboard** with:
  - Task list with filters (status, tasker, date, priority) and search
  - Kanban or table view of task status
  - Live map showing all active taskers' locations and their tasks
- Checks each task's **status history** and timeline (who changed what, when).
- Monitors a tasker's **live location** while a task is active (`in_progress` or `en_route`).
- Communicates with a tasker via a **per-task message thread**, with optional broadcast messages to all taskers.
- Reviews **grievances** raised by taskers: view, comment, change status (open, under review, resolved, rejected), and record the resolution.

### 2. Tasker
- Logs in on a phone browser (installable as a PWA, added to home screen).
- Sees a **"My Tasks"** list, with the newest assigned task highlighted.
- Receives new tasks in real time, with a visible alert and optional sound or vibration. Show a notification when the app is in the background, if supported.
- Opens a task to see the description, instructions, address, and a **map with directions** (open in Google Maps/Apple Maps via deep link, plus in-app route preview).
- Updates task status through the workflow.
- **Starts location sharing** when the task moves to `en_route` or `in_progress`, and stops it when the task is completed or cancelled. Show a persistent indicator while sharing. Ask for permission before sharing and explain why.
- Uploads photos as proof of work (before, during, after), with optional captions. Compress images in the browser before upload.
- Messages the dispatcher within the task thread.
- Files a **grievance** against a task (for example, wrong address, unsafe site, unfair assignment, payment issue) with a category, description, and optional photos.

## Task Status Workflow

```
assigned → accepted → en_route → in_progress → completed
    \          \           \            \
     → rejected  → cancelled  (dispatcher can cancel at any stage)
                              → on_hold (dispatcher or tasker can set, with reason)
```

- Every transition is recorded in an append-only `task_events` table (actor, from, to, timestamp, optional note, optional coordinates).
- Enforce allowed transitions on the server. Taskers can only perform transitions allowed for their role on their own tasks.
- Taskers can accept or reject within the assigned window. Rejection requires a reason and notifies the dispatcher.

## Live Location

- Use the browser Geolocation API via `watchPosition`, with high accuracy enabled while a task is active. Stop tracking when inactive.
- Send location updates over WebSocket to a Durable Object per tasker (or per dispatcher organization). Throttle updates (for example, every 5–10 seconds or when movement exceeds a threshold) to save battery and data.
- The Durable Object broadcasts to subscribed dispatchers. It persists the latest position in D1 and keeps a configurable history (for example, 7 days) for route replay.
- Dispatchers see a marker on the map with the tasker's name, status, and "last updated" time. Mark stale locations (no update in more than 2 minutes).
- Use a Wake Lock where supported to keep tracking active on the tasker's device. Document that iOS may pause background tracking and that the app should prompt the tasker to keep it open.
- Only share location while a task is active, and make the data retention policy configurable.

## Messaging

- Each task has a message thread between the dispatcher and the assigned tasker.
- Dispatchers can send broadcast announcements to all or selected taskers.
- Messages support text and image attachments.
- Deliver via WebSocket with a polling fallback. Show read receipts and unread counts.
- Push notifications (Web Push) for new tasks, status changes from the dispatcher, and new messages. Design the notification service behind an interface so it can be extended.

## Grievances

- A grievance links to a task and a tasker, and has: category, severity, description, attachments, status, assignee (dispatcher), resolution notes, and timestamps.
- Dispatchers see a grievance queue with filters and can comment, change status, and close.
- Taskers can see the status and dispatcher comments on their own grievances.
- Every grievance action is recorded in an audit log.

## Data Model (starting point)

- `organizations` (multi-tenant ready: every row scoped by `org_id`)
- `users` (id, org_id, role: `dispatcher` | `tasker` | `admin`, name, email, phone, password_hash, status)
- `taskers` (user_id, skills, vehicle, availability, color for map)
- `tasks` (id, org_id, tasker_id, created_by, title, description, type, priority, status, scheduled_start, scheduled_end, address fields, lat, lng, customer_name, customer_phone, created_at, updated_at)
- `task_events` (append-only status and audit log)
- `task_photos` (task_id, uploaded_by, r2_key, caption, kind: before/during/after/other, created_at)
- `messages` (thread_id, sender_id, body, attachments, created_at, read_at)
- `locations` (tasker_id, lat, lng, accuracy, heading, speed, recorded_at, task_id)
- `grievances` and `grievance_comments`
- `audit_logs` (actor, action, entity, entity_id, metadata, created_at)

Use UUIDs or ULIDs for IDs. Add indexes for `tasker_id`, `status`, `scheduled_start`, and `org_id`.

## Architecture and Expansion

Design for growth without over-engineering the MVP:

- **Feature-based folder structure**: `src/features/tasks`, `features/grievances`, `features/location`, `features/messaging`, `features/auth`, each with its own routes, actions, components, and tests.
- **Service interfaces** for maps, geocoding, notifications, storage, and email, with a Cloudflare or third-party implementation behind each.
- **Multi-tenancy ready**: all queries are scoped by `org_id` through a single data-access layer. The MVP can ship with one org.
- **Role and permission matrix** in one file (`src/lib/permissions.ts`), checked in middleware and in every server action. Make it easy to add roles such as `supervisor` or `client`.
- **Event-driven hooks**: task changes emit domain events (for example `task.assigned`, `task.status_changed`, `grievance.opened`) that other features can subscribe to. Future integrations such as invoicing, SMS, or analytics can hook in without touching core code.
- **Configuration** through environment variables and a typed config module (`src/config.ts`) for feature flags, retention periods, and map provider.
- **i18n-ready**: keep user-facing strings in a message file so languages can be added later.
- **Offline-tolerant tasker view**: cache the task list and details with a service worker. Queue status updates and photo uploads when offline and sync when the connection returns.
- **API layer**: expose a versioned REST or JSON API under `/api/v1` for mobile or third-party clients later, sharing the same services as the server actions.
- **Reporting-ready data**: keep `task_events` and `locations` in a shape that makes it easy to export or add dashboards later.

## Non-Functional Requirements

- Mobile-first responsive UI. Tap targets of at least 44px. Works on iOS Safari and Android Chrome.
- Secure by default: HTTPS only, secure cookies, CSRF protection for mutations, input validation on every endpoint, rate limiting on login, and R2 access through signed URLs or authenticated proxy routes.
- Photo uploads: max size and MIME type validation on both client and server. Strip EXIF GPS data from photos that are not needed for location proof, or store it as metadata only if the dispatcher requires it.
- Accessibility: WCAG 2.1 AA for core flows, including labels, focus states, and color contrast beyond status colors alone.
- Performance: task list loads in under 1 second on a 4G connection. Lazy-load the map.
- Logging and error tracking that works on Workers (for example, Workers Logs and Sentry or Cloudflare equivalent).
- Seed script that creates one dispatcher, three taskers, and sample tasks for local development.

## Deliverables

1. Project scaffold with Next.js, OpenNext for Cloudflare, Wrangler config (`wrangler.jsonc`) with D1, R2, and Durable Object bindings.
2. Database schema, Drizzle migrations, and seed data.
3. Authentication and role-based access control.
4. Dispatcher pages: dashboard, tasker management, task CRUD with map picker, live map, grievance queue, task detail with timeline and messages.
5. Tasker pages: my tasks, task detail, status actions, location sharing, photo upload, messaging, grievance form.
6. Durable Object for realtime location and messaging, with reconnection handling.
7. PWA manifest, service worker, and install prompt for taskers.
8. Tests: unit tests for the status state machine and permissions, and Playwright tests for: dispatcher creates and assigns a task, tasker accepts and completes it with a photo, dispatcher sees live location, and tasker files a grievance.
9. README with setup, local dev (`wrangler dev` / `next dev`), environment variables, deployment steps, and a list of extension points.
10. A short `docs/architecture.md` describing the data flow, realtime design, and how to add a new role or feature.

## Working Instructions

- Build in milestones and keep the app running after each one: (1) auth and roles, (2) task CRUD and assignment with maps, (3) tasker view and status workflow, (4) photos and messaging, (5) live location, (6) grievances, (7) PWA and offline support, (8) tests and deployment.
- Before writing code, state the assumptions you're making (for example, one organization for MVP, email login only, OpenStreetMap tiles). Proceed with reasonable defaults and list open questions at the end.
- Prefer simple, well-tested code over clever abstractions. Add comments only where behavior is not obvious.
- Do not store secrets in the repo. Use `.dev.vars` locally and `wrangler secret` in production.
- Every feature must respect the permission matrix. Test that taskers cannot access other taskers' tasks or dispatcher-only endpoints.
