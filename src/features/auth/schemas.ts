import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validation";

export const signupSchema = z
  .object({
    organizationName: z
      .string()
      .trim()
      .min(2, "Enter your organization name")
      .max(120, "Organization name is too long"),
    name: z.string().trim().min(2, "Enter your name").max(120, "Name is too long"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const acceptInviteTokenSchema = z.object({
  token: z.string().min(20),
});

export const acceptInviteSchema = z
  .object({
    token: z.string().min(20),
    name: z.string().trim().min(2, "Enter your name").max(120),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
