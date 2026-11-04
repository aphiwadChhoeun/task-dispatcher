import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invitations, users, type User } from "@/lib/db/schema";
import { sha256Hex } from "./session-token";

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  return (
    (await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()) ?? null
  );
}

export type InvitationDetails = {
  invitationId: string;
  user: User;
  orgId: string;
  expiresAt: Date;
};

export async function findInvitation(rawToken: string): Promise<InvitationDetails | null> {
  if (!rawToken || rawToken.length < 20) return null;
  const id = await sha256Hex(rawToken);
  const db = getDb();
  const row = await db
    .select({ invitation: invitations, user: users })
    .from(invitations)
    .innerJoin(users, eq(invitations.userId, users.id))
    .where(
      and(
        eq(invitations.id, id),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .get();

  if (!row) return null;
  return {
    invitationId: row.invitation.id,
    user: row.user,
    orgId: row.invitation.orgId,
    expiresAt: row.invitation.expiresAt,
  };
}

export async function findUserById(id: string): Promise<User | null> {
  return (await getDb().select().from(users).where(eq(users.id, id)).get()) ?? null;
}
