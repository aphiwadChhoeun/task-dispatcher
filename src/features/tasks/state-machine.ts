import type { TaskStatus } from "@/lib/db/schema";
import { isDispatcherRole, type Role } from "@/lib/permissions";

export const TASK_STATUSES = [
  "assigned",
  "accepted",
  "en_route",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
  "on_hold",
] as const;

export const ACTIVE_STATUSES: readonly TaskStatus[] = [
  "assigned",
  "accepted",
  "en_route",
  "in_progress",
  "on_hold",
];

export const LOCATION_SHARING_STATUSES: readonly TaskStatus[] = ["en_route", "in_progress"];

export const TERMINAL_STATUSES: readonly TaskStatus[] = ["completed", "rejected", "cancelled"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  assigned: "Assigned",
  accepted: "Accepted",
  en_route: "En route",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  on_hold: "On hold",
};

export const TASK_TYPE_LABELS = {
  delivery: "Delivery",
  pickup: "Pickup",
  inspection: "Inspection",
  repair: "Repair",
  service: "Service",
  other: "Other",
} as const;

export const TASK_PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
} as const;

export type TransitionActor = {
  role: Role;
  isAssignedTasker: boolean;
};

export type TransitionCheck =
  | { allowed: true; requiresNote: boolean }
  | { allowed: false; reason: string };

type Rule = {
  to: TaskStatus;
  dispatcher?: boolean;
  tasker?: boolean;
  requiresNote?: boolean;
};

/**
 * The transition table. Dispatchers may cancel or pause any non-terminal task
 * and resume a paused task. Taskers own the forward path for their tasks.
 */
const TRANSITIONS: Record<TaskStatus, readonly Rule[]> = {
  assigned: [
    { to: "accepted", tasker: true },
    { to: "rejected", tasker: true, requiresNote: true },
    { to: "cancelled", dispatcher: true },
    { to: "on_hold", dispatcher: true, tasker: true, requiresNote: true },
  ],
  accepted: [
    { to: "en_route", tasker: true },
    { to: "cancelled", dispatcher: true },
    { to: "on_hold", dispatcher: true, tasker: true, requiresNote: true },
  ],
  en_route: [
    { to: "in_progress", tasker: true },
    { to: "cancelled", dispatcher: true },
    { to: "on_hold", dispatcher: true, tasker: true, requiresNote: true },
  ],
  in_progress: [
    { to: "completed", tasker: true },
    { to: "cancelled", dispatcher: true },
    { to: "on_hold", dispatcher: true, tasker: true, requiresNote: true },
  ],
  on_hold: [
    { to: "assigned", dispatcher: true, tasker: true },
    { to: "accepted", dispatcher: true, tasker: true },
    { to: "en_route", dispatcher: true, tasker: true },
    { to: "in_progress", dispatcher: true, tasker: true },
    { to: "cancelled", dispatcher: true },
  ],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function getAllowedTransitions(
  from: TaskStatus,
  actor: TransitionActor,
): TaskStatus[] {
  return TRANSITIONS[from]
    .filter((rule) => {
      if (isDispatcherRole(actor.role) && rule.dispatcher) return true;
      return rule.tasker && actor.role === "tasker" && actor.isAssignedTasker;
    })
    .map((rule) => rule.to);
}

export function checkTransition(
  from: TaskStatus,
  to: TaskStatus,
  actor: TransitionActor,
): TransitionCheck {
  if (from === to) return { allowed: false, reason: "The task is already in that state" };

  const rule = TRANSITIONS[from].find((candidate) => candidate.to === to);
  if (!rule) {
    return {
      allowed: false,
      reason: `Cannot move a task from ${TASK_STATUS_LABELS[from]} to ${TASK_STATUS_LABELS[to]}`,
    };
  }

  const dispatcherAllowed = isDispatcherRole(actor.role) && rule.dispatcher === true;
  const taskerAllowed =
    actor.role === "tasker" && actor.isAssignedTasker && rule.tasker === true;

  if (!dispatcherAllowed && !taskerAllowed) {
    return { allowed: false, reason: "Your role cannot perform that transition" };
  }

  return { allowed: true, requiresNote: rule.requiresNote === true };
}

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}export function isActive(status: TaskStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function showsLocation(status: TaskStatus): boolean {
  return LOCATION_SHARING_STATUSES.includes(status);
}

export type TransitionOption = {
  to: TaskStatus;
  requiresNote: boolean;
  destructive: boolean;
};

/**
 * UI-facing transition list. Pausing exposes a single "resume" target (plus
 * cancel) so taskers cannot jump into an unrelated state when they resume.
 */
export function getTransitionOptions(
  from: TaskStatus,
  actor: TransitionActor,
  resumeStatus?: string | null,
): TransitionOption[] {
  let allowed = getAllowedTransitions(from, actor);
  if (from === "on_hold") {
    const resume = (resumeStatus as TaskStatus | null) ?? "accepted";
    allowed = allowed.filter((status) => status === resume || status === "cancelled");
  }

  return allowed.map((to) => {
    const check = checkTransition(from, to, actor);
    return {
      to,
      requiresNote: check.allowed ? check.requiresNote : false,
      destructive: to === "cancelled",
    };
  });
}
