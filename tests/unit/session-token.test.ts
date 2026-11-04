import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  newInvitationToken,
  newSessionId,
  sha256Hex,
  verifySessionToken,
} from "@/features/auth/session-token";
import { signRealtimeToken, verifyRealtimeToken } from "@/lib/realtime-token";

const SECRET = "test-secret-at-least-32-characters-long";

describe("signed session tokens", () => {
  it("round-trips a valid session payload", async () => {
    const sid = newSessionId();
    const token = await createSessionToken(
      { sid, sub: "user-1", org: "org-1", role: "dispatcher", name: "Dana" },
      SECRET,
      60,
    );
    const payload = await verifySessionToken(token, SECRET);
    expect(payload).toMatchObject({
      sid,
      sub: "user-1",
      org: "org-1",
      role: "dispatcher",
      name: "Dana",
    });
  });

  it("rejects a tampered payload or signature", async () => {
    const token = await createSessionToken(
      { sid: "sid", sub: "user-1", org: "org-1", role: "tasker", name: "Alex" },
      SECRET,
      60,
    );
    const [version, body, signature] = token.split(".");
    const decoded = JSON.parse(atob(body.replaceAll("-", "+").replaceAll("_", "/"))) as Record<
      string,
      unknown
    >;
    decoded.role = "admin";
    const tamperedBody = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(await verifySessionToken(`${version}.${tamperedBody}.${signature}`, SECRET)).toBeNull();

    const badSignature = `${signature.slice(0, -2)}aa`;
    expect(await verifySessionToken(`${version}.${body}.${badSignature}`, SECRET)).toBeNull();
    expect(await verifySessionToken(token, `${SECRET}-different`)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await createSessionToken(
      { sid: "sid", sub: "user-1", org: "org-1", role: "tasker", name: "Alex" },
      SECRET,
      -1,
    );
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("hashes session ids and invitation tokens", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toHaveLength(64);
    expect(await sha256Hex("hello")).toBe(hash);
    expect(await sha256Hex("hello!")).not.toBe(hash);
    expect(newInvitationToken()).not.toBe(newInvitationToken());
  });
});

describe("realtime tokens", () => {
  it("signs and verifies a short-lived socket token", async () => {
    const token = await signRealtimeToken(
      { id: "user-1", orgId: "org-1", role: "tasker", name: "Alex" },
      SECRET,
      60,
    );
    const payload = await verifyRealtimeToken(token, SECRET);
    expect(payload).toMatchObject({ sub: "user-1", org: "org-1", role: "tasker" });
  });

  it("rejects expired realtime tokens", async () => {
    const token = await signRealtimeToken(
      { id: "user-1", orgId: "org-1", role: "tasker", name: "Alex" },
      SECRET,
      -5,
    );
    expect(await verifyRealtimeToken(token, SECRET)).toBeNull();
  });
});
