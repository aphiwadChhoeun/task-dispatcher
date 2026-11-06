import { json, withSession } from "@/lib/api";
import { homeForRole } from "@/features/auth/session";

export async function GET(request: Request) {
  return withSession(request, async (session) => {
    return json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone,
        role: session.user.role,
        orgId: session.orgId,
        status: session.user.status,
      },
      membership: {
        id: session.membership.id,
        role: session.membership.role,
        status: session.membership.status,
      },
      organization: {
        id: session.organization.id,
        name: session.organization.name,
        slug: session.organization.slug,
      },
      home: homeForRole(session.user.role),
    });
  });
}
