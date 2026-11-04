import { ForbiddenError } from "@/lib/errors";
import type { Task } from "@/lib/db/schema";

export const ROLES = ["admin", "dispatcher", "tasker"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Single source of truth for authorization. Server actions and route handlers
 * call `can` / `assertCan`; feature layouts call `assertRole`. Add a role by
 * adding it to ROLES and giving it a set of actions here.
 */
export const PERMISSION_ACTIONS = [
  "tasks.read.all",
  "tasks.read.own",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.assign",
  "tasks.cancel",
  "tasks.status.update.any",
  "tasks.status.update.own",
  "taskers.read",
  "taskers.manage",
  "messages.read.all",
  "messages.read.own",
  "messages.send",
  "broadcasts.send",
  "grievances.read.all",
  "grievances.read.own",
  "grievances.create",
  "grievances.manage",
  "location.share",
  "location.read.all",
  "audit.read",
  "org.manage",
  "api.read",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

const DISPATCHER_ACTIONS: readonly PermissionAction[] = [
  "tasks.read.all",
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.assign",
  "tasks.cancel",
  "tasks.status.update.any",
  "taskers.read",
  "taskers.manage",
  "messages.read.all",
  "messages.send",
  "broadcasts.send",
  "grievances.read.all",
  "grievances.manage",
  "location.read.all",
  "audit.read",
  "api.read",
];

const TASKER_ACTIONS: readonly PermissionAction[] = [
  "tasks.read.own",
  "tasks.status.update.own",
  "taskers.read",
  "messages.read.own",
  "messages.send",
  "grievances.read.own",
  "grievances.create",
  "location.share",
  "api.read",
];

const ADMIN_ACTIONS: readonly PermissionAction[] = [
  ...new Set<PermissionAction>([...DISPATCHER_ACTIONS, ...TASKER_ACTIONS, "org.manage"]),
];

export const PERMISSION_MATRIX: Record<Role, readonly PermissionAction[]> = {
  admin: ADMIN_ACTIONS,
  dispatcher: DISPATCHER_ACTIONS,
  tasker: TASKER_ACTIONS,
};

export function isRole(value: string | null | undefined): value is Role {
  return value === "admin" || value === "dispatcher" || value === "tasker";
}

export function can(role: Role, action: PermissionAction): boolean {
  return PERMISSION_MATRIX[role].includes(action);
}

export function canAny(role: Role, actions: readonly PermissionAction[]): boolean {
  return actions.some((action) => can(role, action));
}

export function assertCan(role: Role, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new ForbiddenError(`Role "${role}" is not allowed to ${action}`);
  }
}

export function assertRole(role: Role, allowed: readonly Role[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError(`This area is only available to ${allowed.join(", ")}`);
  }
}

export function isDispatcherRole(role: Role): boolean {
  return role === "admin" || role === "dispatcher";
}

type UserLike = { id: string; role: Role; orgId: string };
type TaskLike = Pick<Task, "orgId" | "taskerId" | "status">;

export function canViewTask(user: UserLike, task: TaskLike): boolean {
  if (user.orgId !== task.orgId) return false;
  if (isDispatcherRole(user.role)) return can(user.role, "tasks.read.all");
  return can(user.role, "tasks.read.own") && task.taskerId === user.id;
}

export function assertCanViewTask(user: UserLike, task: TaskLike): void {
  if (!canViewTask(user, task)) throw new ForbiddenError("You cannot access this task");
}

export function canMutateTask(user: UserLike, task: TaskLike): boolean {
  if (user.orgId !== task.orgId) return false;
  if (isDispatcherRole(user.role)) return can(user.role, "tasks.update");
  return task.taskerId === user.id && can(user.role, "tasks.status.update.own");
}

export function canShareLocation(user: UserLike, task: TaskLike): boolean {
  return (
    user.orgId === task.orgId &&
    can(user.role, "location.share") &&
    task.taskerId === user.id &&
    (task.status === "en_route" || task.status === "in_progress")
  );
}

export function canReadTaskMessages(user: UserLike, task: TaskLike): boolean {
  if (user.orgId !== task.orgId) return false;
  if (isDispatcherRole(user.role)) return can(user.role, "messages.read.all");
  return task.taskerId === user.id && can(user.role, "messages.read.own");
}

export function canCommentOnGrievance(
  user: UserLike,
  grievance: { orgId: string; taskerId: string; assigneeId?: string | null },
): boolean {
  if (user.orgId !== grievance.orgId) return false;
  if (isDispatcherRole(user.role)) return can(user.role, "grievances.read.all");
  return can(user.role, "grievances.read.own") && grievance.taskerId === user.id;
}
