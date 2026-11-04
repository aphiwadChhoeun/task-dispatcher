import { expect, type Page } from "@playwright/test";

export const USERS = {
  dispatcher: { email: "dispatch@example.com", password: "Password123!" },
  alex: { email: "alex@example.com", password: "Password123!" },
  maria: { email: "maria@example.com", password: "Password123!" },
  sam: { email: "sam@example.com", password: "Password123!" },
};

export const TASKS = {
  alexAssigned: "aaaaaaaa-0001-4000-8000-000000000001",
  mariaAccepted: "aaaaaaaa-0002-4000-8000-000000000002",
  samEnRoute: "aaaaaaaa-0003-4000-8000-000000000003",
  mariaInProgress: "aaaaaaaa-0004-4000-8000-000000000004",
  alexAssignedOlder: "aaaaaaaa-0008-4000-8000-000000000008",
};

export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
}

export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

export async function setMapPin(page: Page): Promise<void> {
  const lat = page.locator('input[name="lat"]');
  const canvas = page.locator(".maplibregl-canvas").first();
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 220, y: 130 } });
  await expect(lat).not.toHaveValue("");
}

export async function waitForStatus(page: Page, label: string): Promise<void> {
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}
