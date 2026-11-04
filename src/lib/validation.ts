import { z } from "zod";
import { TASK_STATUSES } from "@/features/tasks/state-machine";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Password is too long");

export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+()\-\s\d.]*$/, "Enter a valid phone number")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const uuidSchema = z.uuid("Invalid identifier");

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);

export const taskStatusSchema = z.enum([
  "assigned",
  "accepted",
  "en_route",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
  "on_hold",
]) satisfies z.ZodType<(typeof TASK_STATUSES)[number]>;

export const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const taskTypeSchema = z.enum([
  "delivery",
  "pickup",
  "inspection",
  "repair",
  "service",
  "other",
]);
export const photoKindSchema = z.enum(["before", "during", "after", "other"]);
export const grievanceCategorySchema = z.enum([
  "wrong_address",
  "unsafe_site",
  "unfair_assignment",
  "payment_issue",
  "customer_conduct",
  "other",
]);
export const grievanceSeveritySchema = z.enum(["low", "medium", "high"]);
export const grievanceStatusSchema = z.enum([
  "open",
  "under_review",
  "resolved",
  "rejected",
]);

export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  return schema.parse(raw);
}

export function flattenZodError(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}

export const emptyToNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

export const optionalText = (max = 5000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));
