"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "td-notify-dismissed";

export function NotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (permission === "unsupported" || permission === "granted" || dismissed) return null;

  const ask = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border/85 bg-card px-3.5 py-2.5 shadow-card">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Bell className="size-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
        Turn on alerts for new tasks and messages.
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={ask}>
        <BellRing className="size-3.5" aria-hidden />
        Enable
      </Button>
      <button
        type="button"
        className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
      >
        Not now
      </button>
    </div>
  );
}
