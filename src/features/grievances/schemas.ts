import { z } from "zod";
import { optionalText, uuidSchema } from "@/lib/validation";
import {
  grievanceCategorySchema,
  grievanceSeveritySchema,
  grievanceStatusSchema,
} from "@/lib/validation";

export const grievanceCreateSchema = z.object({
  taskId: uuidSchema,
  category: grievanceCategorySchema,
  severity: grievanceSeveritySchema,
  description: z.string().trim().min(20, "Describe what happened (at least 20 characters)").max(5000),
});

export const grievanceCommentSchema = z.object({
  grievanceId: uuidSchema,
  body: z.string().trim().min(2, "Write a comment").max(3000),
  isInternal: z.boolean().default(false),
});

export const grievanceUpdateSchema = z.object({
  grievanceId: uuidSchema,
  status: grievanceStatusSchema,
  assigneeId: z.string().optional(),
  resolutionNotes: optionalText(4000),
});

export const grievanceFiltersSchema = z.object({
  status: grievanceStatusSchema.or(z.literal("open_queue")).or(z.literal("all")).optional(),
  severity: grievanceSeveritySchema.optional(),
  category: grievanceCategorySchema.optional(),
  q: z.string().trim().max(120).optional(),
  taskerId: z.string().max(64).optional(),
});

export type GrievanceFilters = z.infer<typeof grievanceFiltersSchema>;
