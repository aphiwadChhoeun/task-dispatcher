/**
 * Workers-friendly logging and error reporting. Swap the reporter for Sentry
 * or another provider without touching feature code.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export type ErrorContext = Record<string, unknown>;

export interface ErrorReporter {
  capture(error: unknown, context?: ErrorContext): void;
}

class ConsoleErrorReporter implements ErrorReporter {
  capture(error: unknown, context?: ErrorContext): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        message,
        stack: error instanceof Error ? error.stack : undefined,
        ...context,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

let reporter: ErrorReporter = new ConsoleErrorReporter();

export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

export function reportError(error: unknown, context?: ErrorContext): void {
  try {
    reporter.capture(error, context);
  } catch {
    // never let observability break a request
  }
}

export function log(level: LogLevel, message: string, context?: ErrorContext): void {
  const line = JSON.stringify({
    level,
    message,
    ...context,
    timestamp: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
