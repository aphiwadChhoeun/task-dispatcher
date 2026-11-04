import { z } from "zod";
import { emailSchema, optionalText, phoneSchema, uuidSchema } from "@/lib/validation";

export const taskerCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the tasker's name").max(120),
  email: emailSchema,
  phone: phoneSchema,
  skills: optionalText(500),
  vehicle: optionalText(200),
  availability: optionalText(500),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color")
    .default("#0f766e"),
});

export const taskerUpdateSchema = taskerCreateSchema.extend({
  taskerId: uuidSchema,
});

export const taskerStatusSchema = z.object({
  taskerId: uuidSchema,
  status: z.enum(["active", "deactivated"]),
});

export const resendInviteSchema = z.object({
  taskerId: uuidSchema,
});

export const taskerFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "invited", "deactivated"]).optional(),
});

export type TaskerFilters = z.infer<typeof taskerFiltersSchema>;

export function taskerFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): TaskerFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = taskerFiltersSchema.safeParse({
    q: first(params.q) || undefined,
    status: first(params.status) || undefined,
  });
  return parsed.success ? parsed.data : {};
}
