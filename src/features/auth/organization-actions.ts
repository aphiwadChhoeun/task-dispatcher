"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { findActiveMembershipForUser } from "./queries";
import {
  clearOrgSelectChallenge,
  createSession,
  destroySession,
  getOrgSelectChallengeUserId,
  getSession,
  homeForRole,
} from "./session";

const selectionSchema = z.object({
  membershipId: z.uuid("Invalid organization"),
});

/**
 * Opens a membership as the active organization. Works both after password
 * verification (using the short-lived challenge cookie) and from the tasker
 * organization switcher (using the current session).
 */
export async function selectOrganizationAction(formData: FormData): Promise<void> {
  try {
    await assertSameOrigin();
  } catch {
    redirect("/login?reason=session");
  }

  const parsed = selectionSchema.safeParse({
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success) redirect("/login?reason=session");

  const session = await getSession();
  let userId = session?.user.id ?? null;
  if (!userId) userId = await getOrgSelectChallengeUserId();
  if (!userId) redirect("/login?reason=session");

  const selected = await findActiveMembershipForUser(parsed.data.membershipId, userId);
  if (!selected || selected.user.status !== "active") {
    redirect("/select-organization?error=unavailable");
  }

  const headerStore = await headers();
  await destroySession();
  await clearOrgSelectChallenge();
  await createSession(selected.user, selected.membership, headerStore.get("user-agent"));
  redirect(homeForRole(selected.membership.role));
}
