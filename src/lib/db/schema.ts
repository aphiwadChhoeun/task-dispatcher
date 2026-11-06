import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/**
 * All application tables carry org_id. Every query in the data-access layer
 * must include it so the MVP can grow into a multi-tenant deployment without
 * a schema migration.
 */
export const organizations = sqliteTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    /** Stable, URL-safe identifier. Nullable for organizations created before self-serve signup. */
    slug: text("slug"),
    /** Optional uploaded brand logo stored in R2. */
    logoKey: text("logo_key"),
    brandColor: text("brand_color").notNull().default("#0d5f4c"),
    accentColor: text("accent_color").notNull().default("#b98132"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("organizations_slug_uq").on(t.slug)],
);

/**
 * Global account identity. Email and password live here, while organization
 * roles are represented by rows in `memberships`. This lets a tasker belong to
 * multiple organizations while keeping login unambiguous.
 *
 * `orgId` and `role` are legacy "primary organization" hints retained so the
 * migration can upgrade existing deployments without rebuilding the users
 * table. Application authorization always reads `memberships`.
 */
export const users = sqliteTable(
  "users",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["dispatcher", "tasker", "admin"] }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    status: text("status", { enum: ["active", "invited", "deactivated"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("users_org_idx").on(t.orgId),
    index("users_role_idx").on(t.orgId, t.role),
    uniqueIndex("users_email_uq").on(t.email),
  ],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["dispatcher", "tasker", "admin"] }).notNull(),
    status: text("status", { enum: ["active", "invited", "deactivated"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("memberships_org_user_uq").on(t.orgId, t.userId),
    index("memberships_user_idx").on(t.userId),
    index("memberships_org_role_idx").on(t.orgId, t.role),
    index("memberships_org_status_idx").on(t.orgId, t.status),
  ],
);

/** Tasker profile fields are per organization, not per global account. */
export const taskers = sqliteTable(
  "taskers",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    skills: text("skills"), // JSON string[]
    vehicle: text("vehicle"),
    availability: text("availability"), // free-form / JSON
    color: text("color").notNull().default("#0f766e"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.orgId] }),
    index("taskers_org_idx").on(t.orgId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the opaque cookie token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expiry_idx").on(t.expiresAt),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(), // sha256 of the invite token
    orgId: text("org_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("invitations_user_idx").on(t.userId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskerId: text("tasker_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type", {
      enum: ["delivery", "pickup", "inspection", "repair", "service", "other"],
    })
      .notNull()
      .default("service"),
    priority: text("priority", {
      enum: ["low", "normal", "high", "urgent"],
    })
      .notNull()
      .default("normal"),
    status: text("status", {
      enum: [
        "assigned",
        "accepted",
        "en_route",
        "in_progress",
        "completed",
        "rejected",
        "cancelled",
        "on_hold",
      ],
    })
      .notNull()
      .default("assigned"),
    resumeStatus: text("resume_status"),
    scheduledStart: integer("scheduled_start", { mode: "timestamp_ms" }),
    scheduledEnd: integer("scheduled_end", { mode: "timestamp_ms" }),
    addressStreet: text("address_street"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    addressPostalCode: text("address_postal_code"),
    addressCountry: text("address_country").default("US"),
    lat: real("lat"),
    lng: real("lng"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    notes: text("notes"),
    instructions: text("instructions"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("tasks_org_idx").on(t.orgId),
    index("tasks_tasker_idx").on(t.taskerId),
    index("tasks_status_idx").on(t.status),
    index("tasks_scheduled_idx").on(t.scheduledStart),
    index("tasks_org_status_idx").on(t.orgId, t.status),
    index("tasks_org_tasker_idx").on(t.orgId, t.taskerId),
  ],
);

export const taskEvents = sqliteTable(
  "task_events",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    note: text("note"),
    lat: real("lat"),
    lng: real("lng"),
    createdAt: createdAt(),
  },
  (t) => [
    index("task_events_task_idx").on(t.taskId, t.createdAt),
    index("task_events_org_idx").on(t.orgId, t.createdAt),
  ],
);

export const taskPhotos = sqliteTable(
  "task_photos",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").notNull(),
    r2Key: text("r2_key").notNull(),
    caption: text("caption"),
    kind: text("kind", { enum: ["before", "during", "after", "other"] })
      .notNull()
      .default("other"),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_photos_task_idx").on(t.taskId, t.createdAt)],
);

export const taskAttachments = sqliteTable(
  "task_attachments",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").notNull(),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_attachments_task_idx").on(t.taskId)],
);

export const messageThreads = sqliteTable(
  "message_threads",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("message_threads_task_uq").on(t.taskId),
    index("message_threads_org_idx").on(t.orgId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    threadId: text("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    attachments: text("attachments"), // JSON: {key,name,mime,size}[]
    createdAt: createdAt(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const threadReads = sqliteTable(
  "thread_reads",
  {
    orgId: text("org_id").notNull(),
    threadId: text("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.threadId, t.userId] }),
    index("thread_reads_org_idx").on(t.orgId),
  ],
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_org_idx").on(t.orgId, t.createdAt)],
);

export const announcementRecipients = sqliteTable(
  "announcement_recipients",
  {
    orgId: text("org_id").notNull(),
    announcementId: text("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    primaryKey({ columns: [t.announcementId, t.userId] }),
    index("announcement_recipients_org_idx").on(t.orgId),
  ],
);

export const locations = sqliteTable(
  "locations",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    taskerId: text("tasker_id").notNull(),
    taskId: text("task_id"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    accuracy: real("accuracy"),
    heading: real("heading"),
    speed: real("speed"),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("locations_tasker_time_idx").on(t.taskerId, t.recordedAt),
    index("locations_recorded_idx").on(t.recordedAt),
    index("locations_org_idx").on(t.orgId),
  ],
);

/** Materialized latest position per tasker so dispatcher maps load in one query. */
export const taskerPresence = sqliteTable(
  "tasker_presence",
  {
    taskerId: text("tasker_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    taskId: text("task_id"),
    taskStatus: text("task_status"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    accuracy: real("accuracy"),
    heading: real("heading"),
    speed: real("speed"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("presence_org_idx").on(t.orgId)],
);

export const grievances = sqliteTable(
  "grievances",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    taskerId: text("tasker_id").notNull(),
    category: text("category", {
      enum: [
        "wrong_address",
        "unsafe_site",
        "unfair_assignment",
        "payment_issue",
        "customer_conduct",
        "other",
      ],
    }).notNull(),
    severity: text("severity", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    description: text("description").notNull(),
    status: text("status", {
      enum: ["open", "under_review", "resolved", "rejected"],
    })
      .notNull()
      .default("open"),
    assigneeId: text("assignee_id"),
    resolutionNotes: text("resolution_notes"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("grievances_org_status_idx").on(t.orgId, t.status),
    index("grievances_tasker_idx").on(t.taskerId),
    index("grievances_task_idx").on(t.taskId),
  ],
);

export const grievanceComments = sqliteTable(
  "grievance_comments",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    grievanceId: text("grievance_id")
      .notNull()
      .references(() => grievances.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    isInternal: integer("is_internal", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (t) => [index("grievance_comments_grievance_idx").on(t.grievanceId, t.createdAt)],
);

export const grievanceAttachments = sqliteTable(
  "grievance_attachments",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    grievanceId: text("grievance_id")
      .notNull()
      .references(() => grievances.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").notNull(),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("grievance_attachments_grievance_idx").on(t.grievanceId)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"), // JSON
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_org_idx").on(t.orgId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.readAt),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint)],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: id(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    success: integer("success", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_email_idx").on(t.email, t.createdAt)],
);

export const geocodeCache = sqliteTable("geocode_cache", {
  key: text("key").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  label: text("label").notNull(),
  address: text("address"), // JSON GeocodeAddress
  createdAt: createdAt(),
});

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Tasker = typeof taskers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskEvent = typeof taskEvents.$inferSelect;
export type TaskPhoto = typeof taskPhotos.$inferSelect;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Grievance = typeof grievances.$inferSelect;
export type GrievanceAttachment = typeof grievanceAttachments.$inferSelect;
export type GrievanceComment = typeof grievanceComments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TaskStatus = Task["status"];
export type TaskPriority = Task["priority"];
export type UserRole = Membership["role"];
export type GrievanceStatus = Grievance["status"];
