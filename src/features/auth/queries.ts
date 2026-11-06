import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  invitations,
  memberships,
  organizations,
  users,
  type Membership,
  type Organization,
  type User,
} from "@/lib/db/schema";
import { sha256Hex } from "./session-token";

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  return (
    (await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()) ?? null
  );
}

export async function findUserById(id: string): Promise<User | null> {
  return (await getDb().select().from(users).where(eq(users.id, id)).get()) ?? null;
}

export type MembershipWithOrganization = {
  membership: Membership;
  organization: Organization;
};

export async function listActiveMembershipsForUser(
  userId: string,
): Promise<MembershipWithOrganization[]> {
  return getDb()
    .select({ membership: memberships, organization: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")))
    .orderBy(organizations.name);
}

export async function countActiveMembershipsForUser(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
  return rows.length;
}

export async function findActiveMembershipForUser(
  membershipId: string,
  userId: string,
): Promise<{ membership: Membership; organization: Organization; user: User } | null> {
  const row = await getDb()
    .select({ membership: memberships, organization: organizations, user: users })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.id, membershipId),
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
      ),
    )
    .get();
  return row ?? null;
}

export type InvitationDetails = {
  invitationId: string;
  user: User;
  membership: Membership;
  orgId: string;
  organizationName: string;
  expiresAt: Date;
};

export async function findInvitation(rawToken: string): Promise<InvitationDetails | null> {
  if (!rawToken || rawToken.length < 20) return null;
  const id = await sha256Hex(rawToken);
  const db = getDb();
  const row = await db
    .select({
      invitation: invitations,
      user: users,
      membership: memberships,
      organizationName: organizations.name,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.userId, users.id))
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, invitations.userId),
        eq(memberships.orgId, invitations.orgId),
      ),
    )
    .innerJoin(organizations, eq(invitations.orgId, organizations.id))
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
    membership: row.membership,
    orgId: row.invitation.orgId,
    organizationName: row.organizationName,
    expiresAt: row.invitation.expiresAt,
  };
}
