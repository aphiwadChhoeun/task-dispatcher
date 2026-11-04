import { redirect } from "next/navigation";
import { getSession, homeForRole } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(homeForRole(session.user.role));
}
