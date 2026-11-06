import { z } from "zod";
import { DEFAULT_ORGANIZATION_COLORS } from "./theme";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color")
  .transform((value) => value.toLowerCase());

export const organizationSettingsSchema = z.object({
  brandColor: hexColor.default(DEFAULT_ORGANIZATION_COLORS.brandColor),
  accentColor: hexColor.default(DEFAULT_ORGANIZATION_COLORS.accentColor),
});
