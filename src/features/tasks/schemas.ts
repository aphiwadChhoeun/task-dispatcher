import { z } from "zod";
import {
  latitudeSchema,
  longitudeSchema,
  optionalText,
  phoneSchema,
  prioritySchema,
  taskStatusSchema,
  taskTypeSchema,
  uuidSchema,
} from "@/lib/validation";

const datetimeString = z
  .string()
  .trim()
  .min(1, "Choose a date and time")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date and time");

const coordinate = (schema: z.ZodType<number>) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema,
  );

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(3, "Give the task a title").max(140),
    description: optionalText(4000),
    type: taskTypeSchema,
    priority: prioritySchema,
    scheduledStart: datetimeString,
    scheduledEnd: datetimeString,
    taskerId: uuidSchema,
    addressStreet: z.string().trim().min(3, "Enter a street address").max(200),
    addressCity: z.string().trim().min(2, "Enter a city").max(120),
    addressState: z.string().trim().min(2, "Enter a state").max(80),
    addressPostalCode: z.string().trim().max(20).optional(),
    addressCountry: z.string().trim().min(2).max(80).default("US"),
    lat: coordinate(latitudeSchema),
    lng: coordinate(longitudeSchema),
    customerName: optionalText(120),
    customerPhone: phoneSchema,
    notes: optionalText(4000),
    instructions: optionalText(4000),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.scheduledStart).getTime();
    const end = new Date(value.scheduledEnd).getTime();
    if (Number.isFinite(start) && Number.isFinite(end)) {
      if (end <= start) {
        ctx.addIssue({
          code: "custom",
          path: ["scheduledEnd"],
          message: "The window must end after it starts",
        });
      }
      if (end - start > 14 * 24 * 60 * 60 * 1000) {
        ctx.addIssue({
          code: "custom",
          path: ["scheduledEnd"],
          message: "The window cannot be longer than 14 days",
        });
      }
    }
  });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskStatusTransitionSchema = z.object({
  taskId: uuidSchema,
  to: taskStatusSchema,
  note: optionalText(2000),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const reassignTaskSchema = z.object({
  taskId: uuidSchema,
  taskerId: uuidSchema,
  note: optionalText(500),
});

export const deleteTaskSchema = z.object({
  taskId: uuidSchema,
});

export const taskFiltersSchema = z.object({
  status: taskStatusSchema.or(z.literal("active")).or(z.literal("all")).optional(),
  taskerId: z.string().trim().max(64).optional(),
  priority: prioritySchema.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  q: z.string().trim().max(120).optional(),
  view: z.enum(["list", "kanban"]).optional(),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export function taskFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): TaskFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = taskFiltersSchema.safeParse({
    status: first(params.status),
    taskerId: first(params.taskerId) || undefined,
    priority: first(params.priority) || undefined,
    date: first(params.date) || undefined,
    q: first(params.q) || undefined,
    view: first(params.view) || undefined,
  });
  return parsed.success ? parsed.data : {};
}

export function taskFiltersToQuery(
  filters: TaskFilters,
  view?: string,
): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.taskerId) params.set("taskerId", filters.taskerId);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.date) params.set("date", filters.date);
  if (filters.q) params.set("q", filters.q);
  if (view && view !== "list") params.set("view", view);
  const value = params.toString();
  return value ? `?${value}` : "";
}


/** Shared client-side validation messages for uploads. */
export const uploadMetaSchema = z.object({
  kind: z.enum(["before", "during", "after", "other"]).default("other"),
  caption: z.string().trim().max(300).optional(),
});
