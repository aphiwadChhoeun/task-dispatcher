import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORGANIZATION_COLORS,
  organizationThemeStyle,
  safeHexColor,
} from "@/features/organizations/theme";

function styleFor(brandColor: string, accentColor: string): Record<string, string> {
  return organizationThemeStyle({ brandColor, accentColor }) as Record<string, string>;
}

describe("organization theme", () => {
  it("uses the organization palette for the primary and accent variables", () => {
    const style = styleFor("#0b5f86", "#e0a03a");
    expect(style["--primary"]).toBe("#0b5f86");
    expect(style["--accent"]).toBe("#e0a03a");
    expect(style["--ring"]).toBe("#0b5f86");
    expect(style["--primary-hover"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps button foreground text readable on light and dark colors", () => {
    expect(styleFor("#0b5f86", "#e0a03a")["--primary-foreground"]).toBe("#ffffff");
    expect(styleFor("#f5f0e8", "#ffffff")["--primary-foreground"]).toBe("#0b1712");
  });

  it("falls back to the default palette for invalid hex values", () => {
    expect(safeHexColor("not-a-color", DEFAULT_ORGANIZATION_COLORS.brandColor)).toBe(
      DEFAULT_ORGANIZATION_COLORS.brandColor,
    );
    const style = styleFor("nope", "#123456");
    expect(style["--primary"]).toBe(DEFAULT_ORGANIZATION_COLORS.brandColor);
    expect(style["--accent"]).toBe("#123456");
  });
});
