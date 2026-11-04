import { expect, test } from "@playwright/test";
import { login, TASKS, USERS } from "./helpers";

test.describe("live location", () => {
  test("dispatcher receives a tasker location over the realtime socket", async ({ browser }) => {
    const dispatcherContext = await browser.newContext();
    const dispatcherPage = await dispatcherContext.newPage();
    await login(dispatcherPage, USERS.dispatcher);

    const socketPromise = dispatcherPage.waitForEvent("websocket", {
      predicate: (socket) => socket.url().includes("/api/realtime/ws"),
      timeout: 30_000,
    });
    await dispatcherPage.goto("/live");
    const socket = await socketPromise;
    await expect(dispatcherPage.getByTestId("realtime-status")).toHaveText("Live", {
      timeout: 20_000,
    });

    const marker = dispatcherPage.locator('.td-marker[aria-label^="Sam Patel"]');
    await expect(marker).toBeVisible();
    const before = Date.now();

    const taskerContext = await browser.newContext({
      geolocation: { latitude: 37.795, longitude: -122.4005 },
      permissions: ["geolocation"],
    });
    const taskerPage = await taskerContext.newPage();
    await login(taskerPage, USERS.sam);
    await taskerPage.goto(`/my-tasks/${TASKS.samEnRoute}`);
    await taskerPage.getByRole("button", { name: "Start sharing location" }).click();
    await expect(taskerPage.getByText("Sharing location", { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });

    // The duplicate location POST would mean the WebSocket path failed.
    await expect(marker).not.toHaveClass(/td-marker--stale/, { timeout: 30_000 });
    expect(socket.isClosed()).toBe(false);

    const liveResponse = await dispatcherPage.request.get("/api/v1/live");
    expect(liveResponse.status()).toBe(200);
    const data = (await liveResponse.json()) as {
      items: Array<{ taskerName: string; lat: number; lng: number; updatedAt: number; stale: boolean }>;
    };
    const sam = data.items.find((item) => item.taskerName === "Sam Patel");
    expect(sam).toBeTruthy();
    expect(sam?.lat).toBeCloseTo(37.795, 3);
    expect(sam?.lng).toBeCloseTo(-122.4005, 3);
    expect(sam?.stale).toBe(false);
    expect((sam?.updatedAt ?? 0) >= before).toBe(true);

    await dispatcherContext.close();
    await taskerContext.close();
  });
});
