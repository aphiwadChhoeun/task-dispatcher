"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[client] unhandled route error", error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-warning/20 bg-warning/[0.06] text-warning shadow-card">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <p className="section-label mb-2">Something went wrong</p>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">The request could not be completed</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Try again; if the problem continues, contact your dispatcher.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
