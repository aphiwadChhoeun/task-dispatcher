"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { MapShell } from "@/components/maps/map-shell";
import type { MapMarker } from "@/features/maps/types";
import { useRealtime, type RealtimeEvent } from "@/features/realtime/use-realtime";
import { config } from "@/config";
import { formatRelative } from "@/lib/format";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LivePresence = {
  taskerId: string;
  taskerName: string;
  taskerPhone: string | null;
  color: string;
  taskId: string | null;
  taskTitle: string | null;
  taskStatus: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updatedAt: number;
  stale: boolean;
};

export type LiveTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskerId: string | null;
  lat: number;
  lng: number;
  addressCity: string | null;
  addressStreet: string | null;
};

type Props = {
  initialPresence: LivePresence[];
  tasks?: LiveTask[];
  onlyTaskerId?: string;
  showTaskMarkers?: boolean;
  className?: string;
  emptyMessage?: string;
};

export function LiveMap({
  initialPresence,
  tasks: initialTasks = [],
  onlyTaskerId,
  showTaskMarkers = true,
  className,
  emptyMessage = "No tasker locations shared yet.",
}: Props) {
  const [presence, setPresence] = useState<LivePresence[]>(initialPresence);
  const [tasks, setTasks] = useState<LiveTask[]>(initialTasks);
  const [now, setNow] = useState(() => Date.now());
  const [updated, setUpdated] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);

  const applyPresence = (incoming: Partial<LivePresence> & { taskerId?: string }) => {
    const taskerId = incoming.taskerId;
    if (!taskerId) return;
    setPresence((current) => {
      const index = current.findIndex((item) => item.taskerId === taskerId);
      const next: LivePresence = {
        taskerId,
        taskerName: incoming.taskerName ?? "Tasker",
        taskerPhone: incoming.taskerPhone ?? null,
        color: incoming.color ?? "#0f766e",
        taskId: incoming.taskId ?? null,
        taskTitle: incoming.taskTitle ?? null,
        taskStatus: incoming.taskStatus ?? null,
        lat: Number(incoming.lat ?? 0),
        lng: Number(incoming.lng ?? 0),
        accuracy: incoming.accuracy ?? null,
        heading: incoming.heading ?? null,
        speed: incoming.speed ?? null,
        updatedAt: Number(incoming.updatedAt ?? Date.now()),
        stale: Boolean(incoming.stale),
      };
      if (index === -1) return [...current, next];
      const copy = [...current];
      copy[index] = { ...copy[index], ...next };
      return copy;
    });
    setUpdated(Date.now());
  };

  const handleEvent = (event: RealtimeEvent) => {
    if (event.type === "presence.snapshot") {
      const items = event.payload?.items;
      if (Array.isArray(items)) setPresence(items as LivePresence[]);
      setUpdated(Date.now());
      return;
    }
    if (event.type === "location.updated") {
      const payload = event.payload ?? {};
      if (typeof payload.taskerId !== "string") return;
      applyPresence({
        ...(payload as Partial<LivePresence>),
        taskerId: payload.taskerId,
        stale: false,
        updatedAt: Number(payload.updatedAt ?? Date.now()),
      });
      return;
    }
    if (event.type === "task.status_changed") {
      const payload = event.payload ?? {};
      const taskId = typeof payload.taskId === "string" ? payload.taskId : null;
      const status = typeof payload.status === "string" ? payload.status : null;
      if (!taskId || !status) return;
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, status } : task)),
      );
      if (["completed", "cancelled", "rejected"].includes(status)) {
        setPresence((current) => current.filter((item) => item.taskId !== taskId));
      }
    }
  };

  const poll = async () => {
    try {
      const response = await fetch("/api/v1/live", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { items?: LivePresence[] };
      if (Array.isArray(data.items)) {
        setPresence(data.items);
        setUpdated(Date.now());
      }
    } catch {
      // fall back silently; next poll will retry
    }
  };

  const { status } = useRealtime({
    onEvent: handleEvent,
    onPoll: poll,
    pollMs: 10_000,
  });

  const staleMs = config.location.staleSeconds * 1000;

  const markers = useMemo<MapMarker[]>(() => {
    const result: MapMarker[] = [];

    for (const item of presence) {
      if (onlyTaskerId && item.taskerId !== onlyTaskerId) continue;
      const stale = item.stale || now - item.updatedAt > staleMs;
      result.push({
        id: `tasker:${item.taskerId}`,
        lat: item.lat,
        lng: item.lng,
        label: item.taskerName,
        description: `${item.taskStatus ? titleCase(item.taskStatus) : "No active task"} · ${formatRelative(
          item.updatedAt,
          now,
        )}${stale ? " · stale" : ""}`,
        color: item.color,
        kind: "tasker",
        stale,
        href: `/taskers/${item.taskerId}`,
        hrefLabel: "Open tasker profile →",
      });
    }

    if (showTaskMarkers) {
      for (const task of tasks) {
        if (onlyTaskerId && task.taskerId !== onlyTaskerId) continue;
        if (!["assigned", "accepted", "en_route", "in_progress", "on_hold"].includes(task.status)) {
          continue;
        }
        result.push({
          id: `task:${task.id}`,
          lat: task.lat,
          lng: task.lng,
          label: task.title,
          description: `${titleCase(task.status)} · ${[task.addressStreet, task.addressCity]
            .filter(Boolean)
            .join(", ")}`,
          kind: "task",
          href: `/tasks/${task.id}`,
        });
      }
    }

    return result;
  }, [presence, tasks, onlyTaskerId, showTaskMarkers, now, staleMs]);

  const visiblePresence = onlyTaskerId
    ? presence.filter((item) => item.taskerId === onlyTaskerId)
    : presence;

  return (
    <div className={cn("relative", className)}>
      <MapShell
        markers={markers}
        fitToMarkers
        center={[-122.4194, 37.7749]}
        zoom={11.5}
        ariaLabel="Live tasker map"
      />
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm">
          <Radio
            className={cn("size-3.5", status === "open" ? "text-success" : "text-warning")}
            aria-hidden
          />
          <span data-testid="realtime-status">
            {status === "open" ? "Live" : status === "idle" ? "Paused" : "Polling"}
          </span>
        </span>
        <span className="pointer-events-auto rounded-full border border-border bg-card/95 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
          {visiblePresence.length} sharing · updated {formatRelative(updated, now)}
        </span>
      </div>
      {visiblePresence.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <p className="rounded-lg bg-card/95 px-4 py-2 text-center text-sm text-muted-foreground shadow-sm">
            {emptyMessage}
          </p>
        </div>
      ) : null}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-sm">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#0f766e]" aria-hidden /> Tasker
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#1f2937]" aria-hidden /> Task
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-zinc-400" aria-hidden /> Stale (&gt;2m)
        </span>
      </div>
    </div>
  );
}
