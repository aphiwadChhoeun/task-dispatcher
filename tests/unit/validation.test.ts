import { describe, expect, it } from "vitest";
import { taskFormSchema } from "@/features/tasks/schemas";
import { taskStatusTransitionSchema } from "@/features/tasks/schemas";
import { grievanceCreateSchema } from "@/features/grievances/schemas";
import { validateUpload } from "@/features/files/validation";
import { config } from "@/config";

const validTask = {
  title: "Deliver the replacement pump",
  description: "Bring it to the loading dock.",
  type: "delivery" as const,
  priority: "high" as const,
  scheduledStart: "2026-11-04T09:00:00",
  scheduledEnd: "2026-11-04T11:00:00",
  taskerId: "33333333-3333-4333-8333-333333333333",
  addressStreet: "450 Bryant St",
  addressCity: "San Francisco",
  addressState: "CA",
  addressPostalCode: "94107",
  addressCountry: "US",
  lat: 37.7823,
  lng: -122.391,
};

describe("task validation", () => {
  it("accepts a complete task", () => {
    expect(taskFormSchema.safeParse(validTask).success).toBe(true);
  });

  it("requires a map pin", () => {
    const result = taskFormSchema.safeParse({ ...validTask, lat: "", lng: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("lat");
    }
  });

  it("requires the window to end after it starts", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      scheduledEnd: "2026-11-04T08:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status transitions payloads", () => {
    expect(
      taskStatusTransitionSchema.safeParse({
        taskId: validTask.taskerId,
        to: "flying",
      }).success,
    ).toBe(false);
  });
});

describe("grievance validation", () => {
  it("requires a meaningful description", () => {
    expect(
      grievanceCreateSchema.safeParse({
        taskId: validTask.taskerId,
        category: "unsafe_site",
        severity: "high",
        description: "too short",
      }).success,
    ).toBe(false);
    expect(
      grievanceCreateSchema.safeParse({
        taskId: validTask.taskerId,
        category: "unsafe_site",
        severity: "high",
        description: "The loading dock has no guardrail and the ramp is broken.",
      }).success,
    ).toBe(true);
  });
});

describe("upload validation", () => {
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("accepts a JPEG with matching magic bytes", async () => {
    const file = new File([jpegHeader], "photo.jpg", { type: "image/jpeg" });
    const result = await validateUpload(file, config.uploads.photoMimes);
    expect(result.ok).toBe(true);
  });

  it("rejects a spoofed file type", async () => {
    const file = new File([pngHeader], "photo.jpg", { type: "image/jpeg" });
    const result = await validateUpload(file, config.uploads.photoMimes);
    expect(result.ok).toBe(false);
  });

  it("rejects files that are too large", async () => {
    const file = new File([jpegHeader], "photo.jpg", { type: "image/jpeg" });
    const result = await validateUpload(file, config.uploads.photoMimes, 2);
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported MIME types", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const result = await validateUpload(file, config.uploads.photoMimes);
    expect(result.ok).toBe(false);
  });
});
