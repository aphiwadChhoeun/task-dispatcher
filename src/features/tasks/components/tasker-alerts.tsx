"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { useRealtime } from "@/features/realtime/use-realtime";
import { buttonVariants } from "@/components/ui/button";

type AlertItem = { taskId: string; title: string; at: number };

function playChime() {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.onended = () => context.close().catch(() => undefined);
  } catch {
    // audio is optional
  }
}

export function TaskerAlerts({ userId }: { userId: string }) {
  const [alert, setAlert] = useState<AlertItem | null>(null);
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  const { status } = useRealtime({
    onEvent: (event) => {
      if (event.type === "connected") refreshSoon();
      if (event.type === "task.assigned") {
        const payload = event.payload ?? {};
        if (typeof payload.taskerId === "string" && payload.taskerId !== userId) return;
        const taskId = typeof payload.taskId === "string" ? payload.taskId : "";
        const title = typeof payload.title === "string" ? payload.title : "New task assigned";
        setAlert({ taskId, title, at: Date.now() });
        playChime();
        navigator.vibrate?.([200, 80, 200]);
        if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("New task assigned", {
              body: title,
              icon: "/icons/icon-192.png",
              tag: taskId,
            });
          } catch {
            // notification may be blocked
          }
        }
        refreshSoon();
      }
      if (event.type === "task.status_changed" || event.type === "message.created" || event.type === "announcement.created") {
        refreshSoon();
      }
    },
    onPoll: refreshSoon,
    pollMs: 15_000,
  });

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), 12_000);
    return () => clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  if (!alert) {
    return (
      <p className="sr-only" aria-live="polite">
        {status === "open" ? "Live task updates connected" : "Polling for task updates"}
      </p>
    );
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-16 z-50 mx-auto max-w-md rounded-2xl border border-primary/25 bg-card p-3.5 shadow-lift sm:inset-x-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BellRing className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">New task assigned</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{alert.title}</p>
          <Link
            href={`/my-tasks/${alert.taskId}`}
            className={buttonVariants({ size: "sm", className: "mt-2" })}
          >
            Open task
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setAlert(null)}
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Dismiss alert"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
