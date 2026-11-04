import { describe, expect, it } from "vitest";
import {
  assertCan,
  assertCanViewTask,
  can,
  canCommentOnGrievance,
  canMutateTask,
  canReadTaskMessages,
  canShareLocation,
  canViewTask,
  isDispatcherRole,
  PERMISSION_MATRIX,
} from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";

const task = {
  orgId: "org-1",
  taskerId: "tasker-1",
  status: "en_route" as const,
};

const tasker = { id: "tasker-1", orgId: "org-1", role: "tasker" as const };
const otherTasker = { id: "tasker-2", orgId: "org-1", role: "tasker" as const };
const dispatcher = { id: "dispatcher-1", orgId: "org-1", role: "dispatcher" as const };
const otherOrg = { id: "x", orgId: "org-2", role: "dispatcher" as const };

describe("permission matrix", () => {
  it("grants dispatchers task management and not tasker-only actions", () => {
    expect(can("dispatcher", "tasks.create")).toBe(true);
    expect(can("dispatcher", "tasks.assign")).toBe(true);
    expect(can("dispatcher", "grievances.manage")).toBe(true);
    expect(can("dispatcher", "grievances.create")).toBe(false);
    expect(can("dispatcher", "location.share")).toBe(false);
    expect(can("dispatcher", "org.manage")).toBe(false);
  });

  it("limits taskers to their own work", () => {
    expect(can("tasker", "tasks.read.own")).toBe(true);
    expect(can("tasker", "tasks.read.all")).toBe(false);
    expect(can("tasker", "tasks.create")).toBe(false);
    expect(can("tasker", "tasks.status.update.own")).toBe(true);
    expect(can("tasker", "tasks.status.update.any")).toBe(false);
    expect(can("tasker", "grievances.create")).toBe(true);
    expect(can("tasker", "broadcasts.send")).toBe(false);
  });

  it("lets admins do everything, including org management", () => {
    for (const action of PERMISSION_MATRIX.admin) {
      expect(can("admin", action)).toBe(true);
    }
    expect(can("admin", "org.manage")).toBe(true);
  });

  it("throws a forbidden error for disallowed actions", () => {
    expect(() => assertCan("tasker", "tasks.delete")).toThrow(ForbiddenError);
    expect(() => assertCan("dispatcher", "grievances.create")).toThrow(ForbiddenError);
    expect(() => assertCan("dispatcher", "tasks.update")).not.toThrow();
  });

  it("identifies dispatcher roles", () => {
    expect(isDispatcherRole("dispatcher")).toBe(true);
    expect(isDispatcherRole("admin")).toBe(true);
    expect(isDispatcherRole("tasker")).toBe(false);
  });
});

describe("resource-level access", () => {
  it("scopes tasks by organization", () => {
    expect(canViewTask(dispatcher, task)).toBe(true);
    expect(canViewTask(otherOrg, task)).toBe(false);
    expect(canViewTask(tasker, task)).toBe(true);
    expect(canViewTask(otherTasker, task)).toBe(false);
    expect(() => assertCanViewTask(otherTasker, task)).toThrow(ForbiddenError);
  });

  it("only allows taskers to mutate their own task", () => {
    expect(canMutateTask(tasker, task)).toBe(true);
    expect(canMutateTask(otherTasker, task)).toBe(false);
    expect(canMutateTask(dispatcher, task)).toBe(true);
  });

  it("only shares location for active assigned tasks", () => {
    expect(canShareLocation(tasker, task)).toBe(true);
    expect(canShareLocation(tasker, { ...task, status: "accepted" })).toBe(false);
    expect(canShareLocation(tasker, { ...task, status: "completed" })).toBe(false);
    expect(canShareLocation(otherTasker, task)).toBe(false);
    expect(canShareLocation(dispatcher, task)).toBe(false);
  });

  it("keeps message threads scoped to the task owner or dispatchers", () => {
    expect(canReadTaskMessages(tasker, task)).toBe(true);
    expect(canReadTaskMessages(otherTasker, task)).toBe(false);
    expect(canReadTaskMessages(dispatcher, task)).toBe(true);
  });

  it("limits grievance comments to dispatchers and the filing tasker", () => {
    const grievance = { orgId: "org-1", taskerId: "tasker-1" };
    expect(canCommentOnGrievance(dispatcher, grievance)).toBe(true);
    expect(canCommentOnGrievance(tasker, grievance)).toBe(true);
    expect(canCommentOnGrievance(otherTasker, grievance)).toBe(false);
    expect(canCommentOnGrievance(otherOrg, grievance)).toBe(false);
  });
});
