import { expect, test } from "@playwright/test";
import { login, TASKS, TINY_PNG, USERS, uniqueTitle } from "./helpers";

test.describe("grievances", () => {
  test("tasker files a grievance and dispatch reviews it", async ({ browser }) => {
    const taskerContext = await browser.newContext();
    const taskerPage = await taskerContext.newPage();
    await login(taskerPage, USERS.alex);
    await taskerPage.goto(`/my-tasks/${TASKS.alexAssignedOlder}/grievance`);

    const description = uniqueTitle("Unsafe loading area") + " — the ramp has no guardrail.";
    await taskerPage.selectOption("#category", "unsafe_site");
    await taskerPage.selectOption("#severity", "high");
    await taskerPage.fill("#description", description);
    await taskerPage.locator('input[name="photos"]').setInputFiles({
      name: "site.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await taskerPage.getByRole("button", { name: "File grievance" }).click();
    await expect(taskerPage).toHaveURL(/\/my-grievances\/[0-9a-f-]{36}$/);
    await expect(taskerPage.getByText(description)).toBeVisible();
    await expect(taskerPage.getByText("Open", { exact: true }).first()).toBeVisible();

    const grievanceUrl = new URL(taskerPage.url()).pathname;
    const dispatcherContext = await browser.newContext();
    const dispatcherPage = await dispatcherContext.newPage();
    await login(dispatcherPage, USERS.dispatcher);
    await dispatcherPage.goto(grievanceUrl.replace("/my-grievances/", "/grievances/"));

    await expect(dispatcherPage.getByText(description)).toBeVisible();
    await dispatcherPage.selectOption("#grievance-status", "under_review");
    await dispatcherPage.getByRole("button", { name: "Save grievance" }).click();
    await expect(dispatcherPage.getByText("Grievance updated")).toBeVisible();

    const comment = "We are sending a supervisor to inspect the ramp tomorrow morning.";
    await dispatcherPage.getByLabel("Comment").fill(comment);
    await dispatcherPage.getByRole("button", { name: "Post comment" }).click();
    await expect(dispatcherPage.getByText(comment)).toBeVisible();

    await taskerPage.reload();
    await expect(taskerPage.getByText("Under review", { exact: true }).first()).toBeVisible();
    await expect(taskerPage.getByText(comment)).toBeVisible();

    await dispatcherContext.close();
    await taskerContext.close();
  });
});
