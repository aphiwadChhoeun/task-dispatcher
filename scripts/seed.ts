import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../src/features/auth/password";
import { sha256Hex } from "../src/features/auth/session-token";

const now = Date.now();
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const DISPATCHER_ID = "22222222-2222-4222-8222-222222222222";
const ALEX_ID = "33333333-3333-4333-8333-333333333333";
const MARIA_ID = "44444444-4444-4444-8444-444444444444";
const SAM_ID = "55555555-5555-4555-8555-555555555555";
const JORDAN_ID = "66666666-6666-4666-8666-666666666666";
const INVITE_TOKEN = "demo-invite-jordan-2026";

const TASKS = [
  {
    id: "aaaaaaaa-0001-4000-8000-000000000001",
    taskerId: ALEX_ID,
    title: "Deliver replacement water pump",
    description:
      "Replace the failed circulation pump in the basement mechanical room. Customer has the new unit on site.",
    type: "delivery",
    priority: "urgent",
    status: "assigned",
    start: now + 2 * hour,
    end: now + 4 * hour,
    street: "450 Bryant St",
    city: "San Francisco",
    state: "CA",
    postal: "94107",
    lat: 37.7823,
    lng: -122.391,
    customerName: "Nina Patel",
    customerPhone: "+1 415 555 0134",
    instructions: "Check in at the loading dock. Bring the pump up using the freight elevator.",
    notes: "Gate code 4417.",
    created: now - 10 * minute,
  },
  {
    id: "aaaaaaaa-0002-4000-8000-000000000002",
    taskerId: MARIA_ID,
    title: "Quarterly fire safety inspection",
    description: "Walk the building, test extinguishers, and photograph each checkpoint.",
    type: "inspection",
    priority: "high",
    status: "accepted",
    start: now + 1 * hour,
    end: now + 3 * hour,
    street: "88 Kearny St",
    city: "San Francisco",
    state: "CA",
    postal: "94108",
    lat: 37.7886,
    lng: -122.4037,
    customerName: "Building concierge",
    customerPhone: "+1 415 555 0199",
    instructions: "Ask for the facilities binder at reception.",
    notes: null,
    created: now - 2 * hour,
  },
  {
    id: "aaaaaaaa-0003-4000-8000-000000000003",
    taskerId: SAM_ID,
    title: "Pick up signed contracts",
    description: "Collect the signed originals from the client and bring them to the office.",
    type: "pickup",
    priority: "normal",
    status: "en_route",
    start: now - 30 * minute,
    end: now + 1 * hour,
    street: "1 Market St",
    city: "San Francisco",
    state: "CA",
    postal: "94105",
    lat: 37.7936,
    lng: -122.3965,
    customerName: "Jordan at Acme",
    customerPhone: "+1 415 555 0166",
    instructions: "Front desk will have an envelope with your name.",
    notes: "Park in the 1 Market garage; validate at the desk.",
    created: now - 5 * hour,
  },
  {
    id: "aaaaaaaa-0004-4000-8000-000000000004",
    taskerId: MARIA_ID,
    title: "Install two ADA door openers",
    description: "Mount and calibrate push-button openers on the lobby restrooms.",
    type: "repair",
    priority: "high",
    status: "in_progress",
    start: now - 90 * minute,
    end: now + 2 * hour,
    street: "555 Mission St",
    city: "San Francisco",
    state: "CA",
    postal: "94105",
    lat: 37.7885,
    lng: -122.3985,
    customerName: "Elena Ruiz",
    customerPhone: "+1 415 555 0121",
    instructions: "Power down the door circuit before mounting.",
    notes: "Permit is in the office drawer.",
    created: now - 1 * hour,
  },
  {
    id: "aaaaaaaa-0005-4000-8000-000000000005",
    taskerId: SAM_ID,
    title: "Weekly route reconciliation",
    description: "Review last week's delivery slips against the dispatcher log.",
    type: "other",
    priority: "low",
    status: "completed",
    start: now - 1 * day,
    end: now - 1 * day + 2 * hour,
    street: "1200 Folsom St",
    city: "San Francisco",
    state: "CA",
    postal: "94103",
    lat: 37.7749,
    lng: -122.4135,
    customerName: null,
    customerPhone: null,
    instructions: null,
    notes: null,
    created: now - 2 * day,
  },
  {
    id: "aaaaaaaa-0006-4000-8000-000000000006",
    taskerId: MARIA_ID,
    title: "Replace lobby light fixtures",
    description: "Swap six failing fixtures above the reception desk.",
    type: "repair",
    priority: "normal",
    status: "on_hold",
    resumeStatus: "in_progress",
    start: now + 5 * hour,
    end: now + 7 * hour,
    street: "301 Howard St",
    city: "San Francisco",
    state: "CA",
    postal: "94105",
    lat: 37.7897,
    lng: -122.3946,
    customerName: "Marcus Lee",
    customerPhone: "+1 415 555 0108",
    instructions: "Use the freight entrance; lobby is open to the public.",
    notes: "On hold pending the correct fixture shipment.",
    created: now - 3 * hour,
  },
  {
    id: "aaaaaaaa-0007-4000-8000-000000000007",
    taskerId: ALEX_ID,
    title: "Deliver signage to pop-up",
    description: "Drop off the A-frame signs and window decals for the weekend pop-up.",
    type: "delivery",
    priority: "normal",
    status: "cancelled",
    start: now - 3 * hour,
    end: now - 2 * hour,
    street: "2 Embarcadero Center",
    city: "San Francisco",
    state: "CA",
    postal: "94111",
    lat: 37.7955,
    lng: -122.3997,
    customerName: "Pop-up manager",
    customerPhone: "+1 415 555 0177",
    instructions: null,
    notes: "Customer cancelled the event.",
    created: now - 8 * hour,
  },
  {
    id: "aaaaaaaa-0008-4000-8000-000000000008",
    taskerId: ALEX_ID,
    title: "Inventory spare parts cabinet",
    description: "Count and label spare gaskets, filters, and pump seals.",
    type: "inspection",
    priority: "low",
    status: "assigned",
    start: now + 1 * day,
    end: now + 1 * day + 3 * hour,
    street: "1400 16th St",
    city: "San Francisco",
    state: "CA",
    postal: "94103",
    lat: 37.7658,
    lng: -122.4003,
    customerName: null,
    customerPhone: null,
    instructions: "Binder and label maker are in the top drawer.",
    notes: null,
    created: now - 1 * day,
  },
];

const COMPLETED_EVENTS = [
  "assigned",
  "accepted",
  "en_route",
  "in_progress",
  "completed",
];

function sql(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function json(value: unknown): string {
  return sql(JSON.stringify(value));
}

function statusChain(task: (typeof TASKS)[number]): Array<{ from: string | null; to: string; at: number; actor: string; note?: string }> {
  if (task.status === "completed") {
    return COMPLETED_EVENTS.map((status, index) => ({
      from: index === 0 ? null : COMPLETED_EVENTS[index - 1],
      to: status,
      at: task.start + index * 20 * minute,
      actor: index === 0 ? DISPATCHER_ID : task.taskerId,
      note: index === 0 ? "Task created and assigned" : undefined,
    }));
  }
  if (task.status === "cancelled") {
    return [
      { from: null, to: "assigned", at: task.created, actor: DISPATCHER_ID, note: "Task created and assigned" },
      { from: "assigned", to: "cancelled", at: task.start + 30 * minute, actor: DISPATCHER_ID, note: "Customer cancelled the event" },
    ];
  }
  if (task.status === "on_hold") {
    return [
      { from: null, to: "assigned", at: task.created, actor: DISPATCHER_ID, note: "Task created and assigned" },
      { from: "assigned", to: "accepted", at: task.created + 15 * minute, actor: task.taskerId },
      { from: "accepted", to: "en_route", at: task.created + 30 * minute, actor: task.taskerId },
      { from: "en_route", to: "in_progress", at: task.created + 45 * minute, actor: task.taskerId },
      { from: "in_progress", to: "on_hold", at: task.created + 55 * minute, actor: task.taskerId, note: "Waiting on the correct fixture shipment" },
    ];
  }
  if (task.status === "in_progress") {
    return [
      { from: null, to: "assigned", at: task.created, actor: DISPATCHER_ID, note: "Task created and assigned" },
      { from: "assigned", to: "accepted", at: task.created + 10 * minute, actor: task.taskerId },
      { from: "accepted", to: "en_route", at: task.created + 15 * minute, actor: task.taskerId },
      { from: "en_route", to: "in_progress", at: task.created + 35 * minute, actor: task.taskerId },
    ];
  }
  if (task.status === "en_route") {
    return [
      { from: null, to: "assigned", at: task.created, actor: DISPATCHER_ID, note: "Task created and assigned" },
      { from: "assigned", to: "accepted", at: task.created + 10 * minute, actor: task.taskerId },
      { from: "accepted", to: "en_route", at: task.created + 20 * minute, actor: task.taskerId },
    ];
  }
  if (task.status === "accepted") {
    return [
      { from: null, to: "assigned", at: task.created, actor: DISPATCHER_ID, note: "Task created and assigned" },
      { from: "assigned", to: "accepted", at: task.created + 12 * minute, actor: task.taskerId },
    ];
  }
  return [
    { from: null, to: "assigned", at: task.created, actor: DISPATCHER_ID, note: "Task created and assigned" },
  ];
}

async function main() {
  const [dispatchHash, alexHash, mariaHash, samHash, jordanHash] = await Promise.all([
    hashPassword("Password123!"),
    hashPassword("Password123!"),
    hashPassword("Password123!"),
    hashPassword("Password123!"),
    hashPassword("Password123!"),
  ]);
  const inviteHash = await sha256Hex(INVITE_TOKEN);

  const lines: string[] = [];
  lines.push("-- Generated by scripts/seed.ts. Development data only.");
  lines.push("PRAGMA foreign_keys = OFF;");
  const tables = [
    "task_photos",
    "task_attachments",
    "task_events",
    "tasks",
    "messages",
    "thread_reads",
    "message_threads",
    "announcement_recipients",
    "announcements",
    "grievance_attachments",
    "grievance_comments",
    "grievances",
    "notifications",
    "push_subscriptions",
    "locations",
    "tasker_presence",
    "audit_logs",
    "login_attempts",
    "geocode_cache",
    "sessions",
    "invitations",
    "taskers",
    "users",
    "organizations",
  ];
  for (const table of tables) lines.push(`DELETE FROM ${table};`);

  lines.push("PRAGMA foreign_keys = ON;");
  lines.push(
    `INSERT INTO organizations (id, name, created_at) VALUES (${sql(ORG_ID)}, ${sql("Acme Field Services")}, ${now - 30 * day});`,
  );

  const people = [
    [DISPATCHER_ID, "Dana Reyes", "dispatch@example.com", "dispatcher", "+1 415 555 0100", dispatchHash],
    [ALEX_ID, "Alex Chen", "alex@example.com", "tasker", "+1 415 555 0101", alexHash],
    [MARIA_ID, "Maria Lopez", "maria@example.com", "tasker", "+1 415 555 0102", mariaHash],
    [SAM_ID, "Sam Patel", "sam@example.com", "tasker", "+1 415 555 0103", samHash],
    [JORDAN_ID, "Jordan Lee", "jordan@example.com", "tasker", "+1 415 555 0104", jordanHash],
  ] as const;

  for (const [id, name, email, role, phone, hash] of people) {
    const status = id === JORDAN_ID ? "invited" : "active";
    lines.push(
      `INSERT INTO users (id, org_id, role, name, email, phone, password_hash, status, created_at, updated_at) VALUES (${sql(id)}, ${sql(ORG_ID)}, ${sql(role)}, ${sql(name)}, ${sql(email)}, ${sql(phone)}, ${sql(hash)}, ${sql(status)}, ${now - 20 * day}, ${now - 20 * day});`,
    );
  }

  lines.push(
    `INSERT INTO invitations (id, org_id, user_id, created_by, expires_at, accepted_at, created_at) VALUES (${sql(inviteHash)}, ${sql(ORG_ID)}, ${sql(JORDAN_ID)}, ${sql(DISPATCHER_ID)}, ${now + 7 * day}, NULL, ${now - day});`,
  );

  const taskers = [
    [ALEX_ID, ["Plumbing", "Delivery"], "Cargo van", "Mon–Fri 8am–6pm", "#0f766e"],
    [MARIA_ID, ["Inspection", "Electrical"], "Pickup truck", "Mon–Sat 7am–5pm", "#7c3aed"],
    [SAM_ID, ["Courier", "Site visits"], "Sedan", "Weekdays 9am–7pm", "#b45309"],
    [JORDAN_ID, ["General labour"], null, null, "#1d4ed8"],
  ] as const;
  for (const [id, skills, vehicle, availability, color] of taskers) {
    lines.push(
      `INSERT INTO taskers (user_id, org_id, skills, vehicle, availability, color, created_at) VALUES (${sql(id)}, ${sql(ORG_ID)}, ${sql(JSON.stringify(skills))}, ${sql(vehicle)}, ${sql(availability)}, ${sql(color)}, ${now - 20 * day});`,
    );
  }

  for (const task of TASKS) {
    lines.push(
      `INSERT INTO tasks (id, org_id, tasker_id, created_by, title, description, type, priority, status, resume_status, scheduled_start, scheduled_end, address_street, address_city, address_state, address_postal_code, address_country, lat, lng, customer_name, customer_phone, notes, instructions, created_at, updated_at) VALUES (${sql(task.id)}, ${sql(ORG_ID)}, ${sql(task.taskerId)}, ${sql(DISPATCHER_ID)}, ${sql(task.title)}, ${sql(task.description)}, ${sql(task.type)}, ${sql(task.priority)}, ${sql(task.status)}, ${sql("resumeStatus" in task ? task.resumeStatus : null)}, ${task.start}, ${task.end}, ${sql(task.street)}, ${sql(task.city)}, ${sql(task.state)}, ${sql(task.postal)}, ${sql("US")}, ${task.lat}, ${task.lng}, ${sql(task.customerName)}, ${sql(task.customerPhone)}, ${sql(task.notes)}, ${sql(task.instructions)}, ${task.created}, ${now - 5 * minute});`,
    );

    const chain = statusChain(task);
    for (const event of chain) {
      lines.push(
        `INSERT INTO task_events (id, org_id, task_id, actor_id, from_status, to_status, note, lat, lng, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(task.id)}, ${sql(event.actor)}, ${sql(event.from)}, ${sql(event.to)}, ${sql(event.note ?? null)}, NULL, NULL, ${event.at});`,
      );
    }

    const threadId = `bbbbbbbb-${task.id.slice(9)}`;
    lines.push(
      `INSERT INTO message_threads (id, org_id, task_id, created_at) VALUES (${sql(threadId)}, ${sql(ORG_ID)}, ${sql(task.id)}, ${task.created});`,
    );

    if (task.id.endsWith("0001")) {
      lines.push(
        `INSERT INTO messages (id, org_id, thread_id, sender_id, body, attachments, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(threadId)}, ${sql(DISPATCHER_ID)}, ${sql("Hi Alex — the customer will meet you at the loading dock. Gate code is 4417.")}, NULL, ${now - 8 * minute});`,
      );
      lines.push(
        `INSERT INTO messages (id, org_id, thread_id, sender_id, body, attachments, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(threadId)}, ${sql(ALEX_ID)}, ${sql("Got it. Leaving in about 20 minutes.")}, NULL, ${now - 6 * minute});`,
      );
      lines.push(
        `INSERT INTO thread_reads (org_id, thread_id, user_id, last_read_at) VALUES (${sql(ORG_ID)}, ${sql(threadId)}, ${sql(ALEX_ID)}, ${now - 5 * minute});`,
      );
    }
    if (task.id.endsWith("0004")) {
      lines.push(
        `INSERT INTO messages (id, org_id, thread_id, sender_id, body, attachments, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(threadId)}, ${sql(MARIA_ID)}, ${sql("Power is off and the first opener is mounted. Starting calibration now.")}, NULL, ${now - 20 * minute});`,
      );
    }
  }

  const announcementId = crypto.randomUUID();
  lines.push(
    `INSERT INTO announcements (id, org_id, sender_id, body, created_at) VALUES (${sql(announcementId)}, ${sql(ORG_ID)}, ${sql(DISPATCHER_ID)}, ${sql("Heavy rain is expected after 4pm. Allow extra travel time and keep proof photos dry.")}, ${now - 2 * hour});`,
  );
  for (const userId of [ALEX_ID, MARIA_ID, SAM_ID, JORDAN_ID]) {
    lines.push(
      `INSERT INTO announcement_recipients (org_id, announcement_id, user_id, read_at) VALUES (${sql(ORG_ID)}, ${sql(announcementId)}, ${sql(userId)}, NULL);`,
    );
  }

  const grievanceId = crypto.randomUUID();
  lines.push(
    `INSERT INTO grievances (id, org_id, task_id, tasker_id, category, severity, description, status, assignee_id, resolution_notes, created_at, updated_at, resolved_at) VALUES (${sql(grievanceId)}, ${sql(ORG_ID)}, ${sql("aaaaaaaa-0005-4000-8000-000000000005")}, ${sql(SAM_ID)}, ${sql("payment_issue")}, ${sql("medium")}, ${sql("The mileage reimbursement on last week's route was short by 18 miles. Attaching the log separately.")}, ${sql("under_review")}, ${sql(DISPATCHER_ID)}, NULL, ${now - 1 * day}, ${now - 20 * hour}, NULL);`,
  );
  lines.push(
    `INSERT INTO grievance_comments (id, org_id, grievance_id, author_id, body, is_internal, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(grievanceId)}, ${sql(DISPATCHER_ID)}, ${sql("Thanks Sam — I'm checking the route log against the fuel card statement and will update you by Friday.")}, 0, ${now - 20 * hour});`,
  );
  lines.push(
    `INSERT INTO audit_logs (id, org_id, actor_id, action, entity, entity_id, metadata, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(SAM_ID)}, ${sql("grievance.opened")}, ${sql("grievance")}, ${sql(grievanceId)}, ${json({ category: "payment_issue" })}, ${now - 1 * day});`,
  );

  const presence = [
    [SAM_ID, "aaaaaaaa-0003-4000-8000-000000000003", "en_route", 37.7905, -122.4011, 8, now - 4 * minute],
    [MARIA_ID, "aaaaaaaa-0004-4000-8000-000000000004", "in_progress", 37.7885, -122.3985, 14, now - 5 * minute],
  ] as const;
  for (const [taskerId, taskId, taskStatus, lat, lng, accuracy, updatedAt] of presence) {
    lines.push(
      `INSERT INTO tasker_presence (tasker_id, org_id, task_id, task_status, lat, lng, accuracy, heading, speed, updated_at) VALUES (${sql(taskerId)}, ${sql(ORG_ID)}, ${sql(taskId)}, ${sql(taskStatus)}, ${lat}, ${lng}, ${accuracy}, NULL, NULL, ${updatedAt});`,
    );
  }

  for (let i = 0; i < 6; i += 1) {
    const recordedAt = now - (6 - i) * 2 * minute;
    lines.push(
      `INSERT INTO locations (id, org_id, tasker_id, task_id, lat, lng, accuracy, heading, speed, recorded_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(SAM_ID)}, ${sql("aaaaaaaa-0003-4000-8000-000000000003")}, ${37.7936 - i * 0.0006}, ${-122.3965 - i * 0.0008}, 9, NULL, 4.2, ${recordedAt});`,
    );
  }

  lines.push(
    `INSERT INTO notifications (id, org_id, user_id, type, title, body, link, read_at, created_at) VALUES (${sql(crypto.randomUUID())}, ${sql(ORG_ID)}, ${sql(ALEX_ID)}, ${sql("task.assigned")}, ${sql("New task assigned")}, ${sql("Deliver replacement water pump")}, ${sql("/my-tasks/aaaaaaaa-0001-4000-8000-000000000001")}, NULL, ${now - 10 * minute});`,
  );

  await mkdir(path.join(process.cwd(), ".wrangler"), { recursive: true });
  const outFile = path.join(process.cwd(), ".wrangler/seed.sql");
  await writeFile(outFile, `${lines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${outFile}`);
  console.log("Demo accounts (password: Password123!):");
  console.log("  dispatch@example.com  (dispatcher)");
  console.log("  alex@example.com      (tasker)");
  console.log("  maria@example.com     (tasker)");
  console.log("  sam@example.com       (tasker)");
  console.log(`Invite link: /invite/${INVITE_TOKEN} (jordan@example.com)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
