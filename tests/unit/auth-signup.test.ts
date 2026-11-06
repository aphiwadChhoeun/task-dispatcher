import { describe, expect, it } from "vitest";
import { signupSchema } from "@/features/auth/schemas";
import { slugifyOrganizationName } from "@/features/organizations/slug";

const validSignup = {
  organizationName: "Acme Field Services",
  name: "Dana Reyes",
  email: "Dana@Example.com",
  password: "Password123!",
  confirmPassword: "Password123!",
};

describe("organization signup", () => {
  it("accepts a complete signup and normalizes the email", () => {
    const result = signupSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("dana@example.com");
  });

  it("requires the passwords to match", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: "SomethingElse123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(
        true,
      );
    }
  });

  it("rejects a short organization name and invalid email", () => {
    expect(
      signupSchema.safeParse({
        ...validSignup,
        organizationName: "A",
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("creates stable URL-safe organization slugs", () => {
    expect(slugifyOrganizationName("Acme Field Services")).toBe("acme-field-services");
    expect(slugifyOrganizationName("  Café & Co.  ")).toBe("cafe-co");
    expect(slugifyOrganizationName("!!!")).toBe("org");
    expect(slugifyOrganizationName("A".repeat(80))).toHaveLength(48);
  });
});
