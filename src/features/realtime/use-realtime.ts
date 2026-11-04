"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RealtimeEvent = {
  type: string;
  at?: number;
  actorId?: string;
  payload?: Record<string, unknown>;
};

export type RealtimeStatus = "idle" | "connecting" | "open" | "polling";

export type UseRealtimeOptions = {
  enabled?: boolean;
  onEvent: (event: RealtimeEvent) => void;
  onPoll?: () => void | Promise<void>;
  pollMs?: number;
};

function buildSocketUrl(token: string): string {
  const configured = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
  const base = new URL(configured && configured.length > 0 ? configured : window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/api/realtime/ws";
  base.search = "";
  base.searchParams.set("token", token);
  return base.toString();
}

/**
 * One WebSocket with exponential-backoff reconnects and a polling fallback.
 * The server sends a short-lived signed token; the cookie is never exposed to
 * the socket URL.
 */
export function useRealtime({
  enabled = true,
  onEvent,
  onPoll,
  pollMs = 10_000,
}: UseRealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const onPollRef = useRef(onPoll);

  useEffect(() => {
    onEventRef.current = onEvent;
    onPollRef.current = onPoll;
  }, [onEvent, onPoll]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let disposed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    function clearReconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function startPolling() {
      if (disposed || pollTimer) return;
      setStatus("polling");
      const tick = () => {
        try {
          void onPollRef.current?.();
        } catch {
          // polling is best effort
        }
      };
      tick();
      pollTimer = setInterval(tick, pollMs);
    }

    function scheduleReconnect() {
      if (disposed) return;
      clearReconnect();
      const delay = Math.min(30_000, 1_000 * 2 ** attempt);
      attempt += 1;
      reconnectTimer = setTimeout(() => void connect(), delay);
    }

    async function connect() {
      if (disposed || socketRef.current?.readyState === WebSocket.OPEN) return;
      setStatus((current) => (current === "open" ? current : "connecting"));

      try {
        const response = await fetch("/api/v1/realtime/token", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(`Token request failed (${response.status})`);
        const data = (await response.json()) as { token?: string };
        if (!data.token || disposed) throw new Error("Missing realtime token");

        const socket = new WebSocket(buildSocketUrl(data.token));
        socketRef.current = socket;

        socket.onopen = () => {
          if (disposed) {
            socket.close();
            return;
          }
          attempt = 0;
          stopPolling();
          setStatus("open");
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, 25_000);
        };

        socket.onmessage = (message) => {
          try {
            const event = JSON.parse(String(message.data)) as RealtimeEvent;
            if (!event?.type || event.type === "pong") return;
            onEventRef.current(event);
          } catch {
            // ignore malformed frames
          }
        };

        socket.onclose = () => {
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = null;
          socketRef.current = null;
          if (disposed) return;
          startPolling();
          scheduleReconnect();
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        if (disposed) return;
        startPolling();
        scheduleReconnect();
      }
    }

    function handleOnline() {
      if (disposed) return;
      clearReconnect();
      attempt = 0;
      void connect();
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible" || disposed) return;
      if (!socketRef.current || socketRef.current.readyState > WebSocket.OPEN) {
        clearReconnect();
        attempt = 0;
        void connect();
      }
    }

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    void connect();

    return () => {
      disposed = true;
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearReconnect();
      stopPolling();
      if (pingTimer) clearInterval(pingTimer);
      socketRef.current?.close();
      socketRef.current = null;
      setStatus("idle");
    };
  }, [enabled, pollMs]);

  const send = useCallback((data: Record<string, unknown>): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { status, send };
}
