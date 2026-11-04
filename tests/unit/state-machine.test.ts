import { describe, expect, it } from "vitest";
import {
  checkTransition,
  getAllowedTransitions,
  getTransitionOptions,
  isActive,
  isTerminal,
  showsLocation,
} from "@/features/tasks/state-machine";

const tasker = { role: "tasker" as const, isAssignedTasker: true };
const otherTasker = { role: "tasker" as const, isAssignedTasker: false };
const dispatcher = { role: "dispatcher" as const, isAssignedTasker: false };
const admin = { role: "admin" as const, isAssignedTasker: false };

describe("task status state machine", () => {
  it("allows the happy path only for the assigned tasker", () => {
    expect(checkTransition("assigned", "accepted", tasker)).toEqual({
      allowed: true,
      requiresNote: false,
    });
    expect(checkTransition("accepted", "en_route", tasker).allowed).toBe(true);
    expect(checkTransition("en_route", "in_progress", tasker).allowed).toBe(true);
    expect(checkTransition("in_progress", "completed", tasker).allowed).toBe(true);
    expect(checkTransition("assigned", "accepted", otherTasker).allowed).toBe(false);
  });

  it("requires a reason to reject or pause", () => {
    expect(checkTransition("assigned", "rejected", tasker)).toEqual({
      allowed: true,
      requiresNote: true,
    });
    expect(checkTransition("in_progress", "on_hold", tasker)).toEqual({
      allowed: true,
      requiresNote: true,
    });
  });

  it("lets dispatchers cancel or pause any non-terminal task", () => {
    for (const from of ["assigned", "accepted", "en_route", "in_progress", "on_hold"] as const) {
      expect(checkTransition(from, "cancelled", dispatcher).allowed).toBe(true);
      expect(checkTransition(from, "on_hold", dispatcher).allowed).toBe(from !== "on_hold");
    }
    expect(checkTransition("assigned", "cancelled", admin).allowed).toBe(true);
  });

  it("does not let dispatchers perform tasker forward transitions", () => {
    expect(checkTransition("assigned", "accepted", dispatcher).allowed).toBe(false);
    expect(checkTransition("in_progress", "completed", dispatcher).allowed).toBe(false);
  });

  it("resumes a paused task only to its saved status", () => {
    expect(checkTransition("on_hold", "assigned", tasker).allowed).toBe(true);
    expect(checkTransition("on_hold", "in_progress", tasker).allowed).toBe(true);
    expect(checkTransition("on_hold", "cancelled", tasker).allowed).toBe(false);

    expect(getTransitionOptions("on_hold", tasker, "in_progress")).toEqual([
      { to: "in_progress", requiresNote: false, destructive: false },
    ]);
    expect(getTransitionOptions("on_hold", tasker, "assigned")).toEqual([
      { to: "assigned", requiresNote: false, destructive: false },
    ]);
    expect(getTransitionOptions("on_hold", dispatcher, "in_progress")).toEqual([
      { to: "in_progress", requiresNote: false, destructive: false },
      { to: "cancelled", requiresNote: false, destructive: true },
    ]);
  });

  it("has no transitions out of terminal states", () => {
    for (const terminal of ["completed", "cancelled", "rejected"] as const) {
      expect(getAllowedTransitions(terminal, dispatcher)).toEqual([]);
      expect(getAllowedTransitions(terminal, tasker)).toEqual([]);
      expect(isTerminal(terminal)).toBe(true);
    }
  });

  it("rejects same-state and invalid jumps", () => {
    expect(checkTransition("assigned", "assigned", tasker).allowed).toBe(false);
    expect(checkTransition("assigned", "in_progress", tasker).allowed).toBe(false);
    expect(checkTransition("completed", "assigned", dispatcher).allowed).toBe(false);
  });

  it("classifies active and location-sharing statuses", () => {
    expect(isActive("on_hold")).toBe(true);
    expect(isActive("completed")).toBe(false);
    expect(showsLocation("en_route")).toBe(true);
    expect(showsLocation("in_progress")).toBe(true);
    expect(showsLocation("accepted")).toBe(false);
  });
});
