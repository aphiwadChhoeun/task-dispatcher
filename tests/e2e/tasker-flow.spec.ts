import { expect, test } from "@playwright/test";
import { login, TINY_PNG, uniqueTitle, USERS, waitForStatus } from "./helpers";

const ALEX_ID = "33333333-3333-4333-8333-333333333333";

test.describe("tasker task workflow", () => {
  test("accepts, travels, works, completes, and uploads proof", async ({ page, browser }) => {
    const setupContext = await browser.newContext();
    const setupPage = await setupContext.newPage();
    await login(setupPage, USERS.dispatcher);

    const title = uniqueTitle("Proof of work delivery");
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const createResponse = await setupPage.request.post("/api/v1/tasks", {
      data: {
        title,
        description: "A task created for the tasker workflow test.",
        type: "delivery",
        priority: "normal",
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        taskerId: ALEX_ID,
        addressStreet: "500 Market St",
        addressCity: "San Francisco",
        addressState: "CA",
        addressPostalCode: "94105",
        addressCountry: "US",
        lat: 37.7905,
        lng: -122.4005,
        customerName: "Workflow Test",
        customerPhone: "415-555-0101",
        instructions: "Use the loading dock.",
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as { task: { id: string } };
    const taskId = created.task.id;
    await setupContext.close();

    await login(page, USERS.alex);
    await page.goto(`/my-tasks/${taskId}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);

    await page.getByRole("button", { name: "Accept task" }).click();
    await waitForStatus(page, "Accepted");
    await expect(page.getByRole("button", { name: "Start driving" })).toBeVisible();

    await page.getByRole("button", { name: "Start driving" }).click();
    await waitForStatus(page, "En route");
    await expect(page.getByText("Live location for dispatch")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start sharing location" })).toBeVisible();

    await page.getByRole("button", { name: "Start work" }).click();
    await waitForStatus(page, "In progress");
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();

    await page.getByRole("button", { name: "Mark complete" }).click();
    await waitForStatus(page, "Completed");
    await expect(page.getByText("This task is completed.")).toBeVisible();

    const photoInput = page.locator('label:has-text("Choose photos") input[type="file"]');
    await photoInput.setInputFiles({
      name: "proof-of-work.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    const upload = page.getByRole("button", { name: "Upload photos" });
    await expect(upload).toBeEnabled({ timeout: 20_000 });

    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/tasks/${taskId}/photos`) &&
        response.request().method() === "POST",
    );
    await upload.click();
    const response = await uploadResponse;
    expect(response.status()).toBe(201);
    await expect(page.locator('img[src*="/api/files/"]').first()).toBeVisible();

    const taskResponse = await page.request.get(`/api/v1/tasks/${taskId}`);
    const data = (await taskResponse.json()) as { task: { status: string } };
    expect(data.task.status).toBe("completed");
  });
});
