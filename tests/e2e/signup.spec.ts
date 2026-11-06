import { expect, test } from "@playwright/test";

test.describe("organization signup and tasker invitation", () => {
  test("a dispatcher creates an organization and invites a tasker into it", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const organizationName = `Northwind Field ${stamp}`;
    const dispatcher = {
      name: "Dana North",
      email: `dispatcher-${stamp}@example.com`,
      password: "Password123!",
    };
    const tasker = {
      name: "Taylor Field",
      email: `tasker-${stamp}@example.com`,
    };

    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your organization" })).toBeVisible();

    await page.fill("#organization-name", organizationName);
    await page.fill("#signup-name", dispatcher.name);
    await page.fill("#signup-email", dispatcher.email);
    await page.fill("#signup-password", dispatcher.password);
    await page.fill("#signup-confirm", dispatcher.password);
    await page.getByRole("button", { name: /Create organization/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(organizationName).first()).toBeVisible();
    // The new tenant must not see the seeded demo organization's data.
    await expect(page.getByText("Deliver replacement water pump")).toHaveCount(0);

    await page.goto("/taskers");
    await page.fill("#tasker-name", tasker.name);
    await page.fill("#tasker-email", tasker.email);
    await page.getByRole("button", { name: /Create & invite tasker/i }).click();

    await expect(page.getByText(/was invited/i)).toBeVisible();
    const inviteInput = page.locator('input[aria-label="Invite link"]');
    await expect(inviteInput).toBeVisible();
    const inviteUrl = await inviteInput.inputValue();

    await page.goto(inviteUrl);
    await expect(page.getByRole("heading", { name: `Join ${organizationName}` })).toBeVisible();

    await page.fill("#invite-name", tasker.name);
    await page.fill("#invite-password", "Password123!");
    await page.fill("#invite-confirm", "Password123!");
    await page.getByRole("button", { name: /Activate account/i }).click();

    await expect(page).toHaveURL(/\/my-tasks/);
    await expect(page.getByText(new RegExp(`Hi, Taylor.*${stamp}`))).toBeVisible();
    await expect(page.getByText("Deliver replacement water pump")).toHaveCount(0);
  });

  test("an existing tasker can join multiple organizations and switch between them", async ({
    page,
  }) => {
    const stamp = Date.now().toString(36);
    const firstOrg = `Cedar Crew ${stamp}`;
    const secondOrg = `Beacon Ops ${stamp}`;
    const tasker = {
      name: "Morgan Multi",
      email: `multi-${stamp}@example.com`,
      password: "Password123!",
    };

    // First organization: a brand-new tasker account is created.
    await page.goto("/signup");
    await page.fill("#organization-name", firstOrg);
    await page.fill("#signup-name", "Owner One");
    await page.fill("#signup-email", `owner-one-${stamp}@example.com`);
    await page.fill("#signup-password", tasker.password);
    await page.fill("#signup-confirm", tasker.password);
    await page.getByRole("button", { name: /Create organization/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/taskers");
    await page.fill("#tasker-name", tasker.name);
    await page.fill("#tasker-email", tasker.email);
    await page.getByRole("button", { name: /Create & invite tasker/i }).click();
    await expect(page.locator('input[aria-label="Invite link"]')).toBeVisible();
    let inviteUrl = await page.locator('input[aria-label="Invite link"]').inputValue();

    await page.goto(inviteUrl);
    await page.fill("#invite-name", tasker.name);
    await page.fill("#invite-password", tasker.password);
    await page.fill("#invite-confirm", tasker.password);
    await page.getByRole("button", { name: /Activate account/i }).click();
    await expect(page).toHaveURL(/\/my-tasks/);

    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Second organization: the existing tasker account is invited again.
    await page.goto("/signup");
    await page.fill("#organization-name", secondOrg);
    await page.fill("#signup-name", "Owner Two");
    await page.fill("#signup-email", `owner-two-${stamp}@example.com`);
    await page.fill("#signup-password", tasker.password);
    await page.fill("#signup-confirm", tasker.password);
    await page.getByRole("button", { name: /Create organization/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/taskers");
    await page.fill("#tasker-name", tasker.name);
    await page.fill("#tasker-email", tasker.email);
    await page.getByRole("button", { name: /Create & invite tasker/i }).click();
    await expect(page.getByText(/was invited/i)).toBeVisible();
    inviteUrl = await page.locator('input[aria-label="Invite link"]').inputValue();

    await page.goto(inviteUrl);
    await expect(
      page.getByText(/already have a Task Dispatcher account/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /Accept invitation/i }).click();
    await expect(page.getByText(/Invitation accepted/i)).toBeVisible();

    // Sign in as the tasker; both memberships are offered.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.fill("#email", tasker.email);
    await page.fill("#password", tasker.password);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page).toHaveURL(/\/select-organization/);
    await expect(page.getByText(firstOrg, { exact: true })).toBeVisible();
    await expect(page.getByText(secondOrg, { exact: true })).toBeVisible();

    await page
      .getByText(secondOrg, { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')]")
      .getByRole("button", { name: /Open workspace/i })
      .click();
    await expect(page).toHaveURL(/\/my-tasks/);
    await expect(page.getByText(new RegExp(`Hi, Morgan.*${stamp}`))).toBeVisible();
    await expect(page.getByText(new RegExp(secondOrg))).toBeVisible();

    await page.getByRole("link", { name: "Switch organization" }).click();
    await expect(page).toHaveURL(/\/select-organization/);
    await page
      .getByText(firstOrg, { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')]")
      .getByRole("button", { name: /Open workspace/i })
      .click();
    await expect(page).toHaveURL(/\/my-tasks/);
    await expect(page.getByText(new RegExp(firstOrg))).toBeVisible();
  });

  test("the same email cannot create a second organization", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = `duplicate-${stamp}@example.com`;

    await page.goto("/signup");
    await page.fill("#organization-name", `First Org ${stamp}`);
    await page.fill("#signup-name", "First Owner");
    await page.fill("#signup-email", email);
    await page.fill("#signup-password", "Password123!");
    await page.fill("#signup-confirm", "Password123!");
    await page.getByRole("button", { name: /Create organization/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/signup");
    await page.fill("#organization-name", `Second Org ${stamp}`);
    await page.fill("#signup-name", "Second Owner");
    await page.fill("#signup-email", email);
    await page.fill("#signup-password", "Password123!");
    await page.fill("#signup-confirm", "Password123!");
    await page.getByRole("button", { name: /Create organization/i }).click();

    await expect(
      page.getByText("An account with this email already exists. Sign in instead."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });
});
