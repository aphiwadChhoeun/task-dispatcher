import { expect, test } from "@playwright/test";
import { login, setMapPin, uniqueTitle, USERS } from "./helpers";

test.describe("dispatcher task creation", () => {
  test("creates a task, assigns it, and shows it on the task detail", async ({ page }) => {
    await login(page, USERS.dispatcher);
    await page.goto("/tasks/new");

    const title = uniqueTitle("Replace rooftop filter");
    await page.fill("#title", title);
    await page.selectOption("#type", "repair");
    await page.selectOption("#priority", "high");
    await page.selectOption("#taskerId", { label: "Alex Chen" });
    await expect(page.locator("#scheduledStart")).not.toHaveValue("");
    await expect(page.locator("#scheduledEnd")).not.toHaveValue("");

    await page.fill("#addressStreet", "500 Market St");
    await page.fill("#addressCity", "San Francisco");
    await page.fill("#addressState", "CA");
    await page.fill("#addressPostalCode", "94105");
    await page.fill("#customerName", "Casey Customer");
    await page.fill("#customerPhone", "415-555-0199");
    await page.fill("#instructions", "Check in with the building engineer first.");
    await setMapPin(page);

    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText("Alex Chen").first()).toBeVisible();
    await expect(page.getByText("Assigned", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Task created and assigned").first()).toBeVisible();

    const url = new URL(page.url());
    const taskId = url.pathname.split("/").at(-1);
    const response = await page.request.get(`/api/v1/tasks/${taskId}`);
    expect(response.status()).toBe(200);
    const data = (await response.json()) as {
      task: { status: string; taskerName: string; title: string };
    };
    expect(data.task.status).toBe("assigned");
    expect(data.task.taskerName).toBe("Alex Chen");
    expect(data.task.title).toBe(title);
  });
});
