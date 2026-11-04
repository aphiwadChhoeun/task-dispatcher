import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/features/auth/session-token";

const COOKIE_NAME = "td_session";

const TASKER_PATHS = ["/my-tasks", "/my-grievances"];
const DISPATCHER_PATHS = ["/dashboard", "/tasks", "/taskers", "/grievances", "/live", "/announcements"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Lightweight route gate. Full authorization (org scoping, ownership, role
 * permissions) is always re-checked in layouts and every server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;
  const session = secret ? await verifySessionToken(token, secret) : null;

  if (pathname === "/login" || pathname.startsWith("/invite/")) {
    return NextResponse.next();
  }

  const protectedPath = matches(pathname, TASKER_PATHS) || matches(pathname, DISPATCHER_PATHS);
  if (!protectedPath) return NextResponse.next();

  // If the cookie is absent we can reject without a DB round-trip. Invalid
  // signatures fall through to the server layout, which redirects cleanly.
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    url.searchParams.set("reason", "session");
    return NextResponse.redirect(url);
  }

  if (session) {
    if (session.role === "tasker" && matches(pathname, DISPATCHER_PATHS)) {
      return NextResponse.redirect(new URL("/my-tasks", request.url));
    }
    if (session.role !== "tasker" && matches(pathname, TASKER_PATHS)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/invite/:path*",
    "/dashboard/:path*",
    "/tasks/:path*",
    "/taskers/:path*",
    "/grievances/:path*",
    "/live/:path*",
    "/announcements/:path*",
    "/my-tasks/:path*",
    "/my-grievances/:path*",
  ],
};
