import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you are looking for could not be found.",
  robots: { index: false, follow: true },
};
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-card text-muted-foreground shadow-card">
        <Compass className="size-7" aria-hidden />
      </span>
      <p className="section-label mb-2">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The task, grievance, or page may have been removed, or you may not have access to it.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        Go home
      </Link>
    </main>
  );
}
