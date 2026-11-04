import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, ForbiddenError, UnauthorizedError, toAppError } from "@/lib/errors";
import { assertCan, type PermissionAction } from "@/lib/permissions";
import { requireApiSession, type SessionContext } from "@/features/auth/session";
import { reportError } from "@/lib/observability";

export function json(data: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export function apiError(error: unknown): NextResponse {
  const appError = toAppError(error);
  if (appError.status >= 500) {
    reportError(error, { scope: "api" });
  }
  return json(
    { error: appError.message, code: appError.code, details: appError.details },
    { status: appError.status },
  );
}

export async function withSession(
  request: Request,
  handler: (session: SessionContext) => Promise<Response>,
): Promise<Response> {
  try {
    const session = await requireApiSession(request);
    return await handler(session);
  } catch (error) {
    return apiError(error);
  }
}

export function requireApiPermission(
  session: SessionContext,
  action: PermissionAction,
  message?: string,
): void {
  try {
    assertCan(session.user.role, action);
  } catch {
    throw new ForbiddenError(message ?? "You do not have permission to do that");
  }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AppError("Expected application/json", 415, "unsupported_media_type");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("Invalid JSON body", 400);
  }
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError("Invalid input", 422, "validation_error", error.flatten());
    }
    throw error;
  }
}

export function assertFound<T>(value: T | null | undefined, message = "Not found"): T {
  if (value === null || value === undefined) throw new AppError(message, 404, "not_found");
  return value;
}

export { UnauthorizedError, ForbiddenError };
