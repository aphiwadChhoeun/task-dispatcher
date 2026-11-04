import { expect, test } from "@playwright/test";
import { login, TASKS, USERS } from "./helpers";

test.describe("role isolation", () => {
  test("taskers cannot open dispatcher pages, other taskers' tasks, or dispatcher APIs", async ({ page }) => {
    await login(page, USERS.alex);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/my-tasks$/);

    await page.goto(`/my-tasks/${TASKS.mariaInProgress}`);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    await expect(page.getByText("Install two ADA door openers")).toHaveCount(0);

    const live = await page.request.get("/api/v1/live");
    expect(live.status()).toBe(403);

    const taskApi = await page.request.get(`/api/v1/tasks/${TASKS.mariaInProgress}`);
    expect(taskApi.status()).toBe(403);

    const deleteAttempt = await page.request.delete(`/api/v1/tasks/${TASKS.alexAssigned}`);
    expect(deleteAttempt.status()).toBe(403);
  });

  test("dispatchers are redirected away from the tasker screens", async ({ page }) => {
    await login(page, USERS.dispatcher);
    await page.goto("/my-tasks");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-tasks/${TASKS.alexAssigned}`);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
