import type { CSSProperties } from "react";
import type { Organization } from "@/lib/db/schema";

export const DEFAULT_ORGANIZATION_COLORS = {
  brandColor: "#0d5f4c",
  accentColor: "#b98132",
} as const;

export const ORGANIZATION_COLOR_SCHEMES = [
  { id: "forest", label: "Forest", brandColor: "#0d5f4c", accentColor: "#b98132" },
  { id: "ocean", label: "Ocean", brandColor: "#0b5f86", accentColor: "#e0a03a" },
  { id: "slate", label: "Slate", brandColor: "#334155", accentColor: "#0ea5a4" },
  { id: "plum", label: "Plum", brandColor: "#6d3b6d", accentColor: "#c68a2b" },
  { id: "ember", label: "Ember", brandColor: "#a33a2b", accentColor: "#d4a017" },
  { id: "indigo", label: "Indigo", brandColor: "#3f4b9e", accentColor: "#c48a2c" },
] as const;

export type OrganizationThemeInput = {
  brandColor: string;
  accentColor: string;
};

export type OrganizationThemeStyle = CSSProperties & Record<`--${string}`, string>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function safeHexColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Mixes `amount` (0–1) of `to` into `from`. */
function mixColor(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function foregroundFor(hex: string): "#0b1712" | "#ffffff" {
  // WCAG's contrast crossover point between white and near-black text.
  return relativeLuminance(hex) > 0.179 ? "#0b1712" : "#ffffff";
}

/**
 * Applies an organization's palette through the app's existing CSS variables.
 * Derived colors keep hover states, focus rings, and the dark shell consistent
 * without changing the rest of the design system.
 */
export function organizationThemeStyle(
  organization: Pick<Organization, "brandColor" | "accentColor"> | OrganizationThemeInput,
): OrganizationThemeStyle {
  const brand = safeHexColor(organization.brandColor, DEFAULT_ORGANIZATION_COLORS.brandColor);
  const accent = safeHexColor(organization.accentColor, DEFAULT_ORGANIZATION_COLORS.accentColor);

  return {
    "--primary": brand,
    "--primary-foreground": foregroundFor(brand),
    "--primary-hover": mixColor(brand, "#000000", 0.16),
    "--ring": brand,
    "--accent": accent,
    "--accent-foreground": foregroundFor(accent),
    "--sidebar": mixColor("#07110d", brand, 0.18),
    "--sidebar-foreground": "#edf0e8",
    "--sidebar-muted": "#93a29a",
    "--sidebar-border": "rgba(255,255,255,0.09)",
  };
}
