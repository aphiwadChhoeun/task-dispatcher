"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, ShieldCheck, Square, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/features/realtime/use-realtime";
import { formatRelative } from "@/lib/format";
import { config } from "@/config";

type WakeLockSentinelLike = {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
};

type LastPosition = { time: number; lat: number | null; lng: number | null };

function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earth = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

export function LocationSharer({ taskId }: { taskId: string }) {
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const watchRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const lastRef = useRef<LastPosition>({ time: 0, lat: null, lng: null });
  const forceHttpRef = useRef(false);
  const sharingRef = useRef(false);

  const { send, status } = useRealtime({
    onEvent: (event) => {
      if (event.type === "location.rejected") {
        forceHttpRef.current = true;
      }
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const sendPosition = useCallback(
    async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy: nextAccuracy, heading, speed } = position.coords;
      const at = Date.now();
      const moved =
        lastRef.current.lat != null && lastRef.current.lng != null
          ? metresBetween(lastRef.current.lat, lastRef.current.lng, latitude, longitude)
          : Infinity;
      if (at - lastRef.current.time < config.location.throttleMs && moved < 12) return;

      lastRef.current = { time: at, lat: latitude, lng: longitude };
      setAccuracy(nextAccuracy);
      setLastSent(at);

      const payload = {
        type: "location.update",
        taskId,
        lat: latitude,
        lng: longitude,
        accuracy: nextAccuracy,
        heading: Number.isFinite(heading) ? heading : null,
        speed: Number.isFinite(speed) ? speed : null,
        recordedAt: position.timestamp,
      };

      const sent = !forceHttpRef.current && send(payload);
      if (!sent) {
        try {
          const response = await fetch(`/api/v1/tasks/${taskId}/location`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              lat: latitude,
              lng: longitude,
              accuracy: nextAccuracy,
              heading: Number.isFinite(heading) ? heading : null,
              speed: Number.isFinite(speed) ? speed : null,
              recordedAt: position.timestamp,
            }),
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            setError(data.error ?? "Could not send a location update");
          }
        } catch {
          setError("Location update failed. We will retry automatically.");
        }
      }
    },
    [send, taskId],
  );

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // already released
    }
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const api = (navigator as WakeLockNavigator).wakeLock;
      if (!api) return;
      const sentinel = await api.request("screen");
      sentinel.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
      wakeLockRef.current = sentinel;
    } catch {
      // Wake Lock is optional (iOS does not support it).
    }
  }, []);

  const stop = useCallback(
    async (stateOnly = false) => {
      sharingRef.current = false;
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      await releaseWakeLock();
      if (!stateOnly) {
        setSharing(false);
        setError(null);
      }
    },
    [releaseWakeLock],
  );

  const start = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("This browser does not support location sharing.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 2_000,
        });
      });
      sharingRef.current = true;
      setSharing(true);
      await requestWakeLock();
      await sendPosition(position);

      watchRef.current = navigator.geolocation.watchPosition(
        (next) => {
          if (!sharingRef.current) return;
          void sendPosition(next);
        },
        (geoError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setError("Location permission was denied. Enable it in your browser settings.");
            void stop();
          } else {
            setError("GPS signal was lost. Move to an open area and try again.");
          }
        },
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
      );
    } catch (geoError) {
      const code = (geoError as GeolocationPositionError)?.code;
      setError(
        code === 1
          ? "Location permission was denied. Enable location for this site in your browser settings."
          : "Could not get your current location. Try again outdoors or with location enabled.",
      );
    } finally {
      setStarting(false);
    }
  }, [requestWakeLock, sendPosition, stop]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && sharingRef.current && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void stop(true);
    };
  }, [requestWakeLock, stop]);

  return (
    <>
      {sharing ? (
        <div
          role="status"
          className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2 rounded-full border border-success/30 bg-card px-4 py-2 text-xs font-semibold text-success shadow-lg lg:bottom-4"
        >
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-success" />
          </span>
          Sharing location
          <span className="ml-auto font-normal text-muted-foreground">
            {lastSent ? formatRelative(lastSent, now) : "starting…"}
            {accuracy ? ` · ±${Math.round(accuracy)}m` : ""}
          </span>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Live location for dispatch
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            While you are en route or working, your dispatcher can see your live location and task
            status. Sharing stops automatically when the task is completed or cancelled.
          </p>
          <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
            On iPhone, background tracking may pause when the screen locks. Keep this page open while
            travelling.
          </p>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
          {sharing ? (
            <Button type="button" variant="destructive" onClick={() => void stop()}>
              <Square className="size-4" aria-hidden />
              Stop sharing
            </Button>
          ) : (
            <Button type="button" onClick={start} disabled={starting}>
              <MapPin className="size-4" aria-hidden />
              {starting ? "Starting…" : "Start sharing location"}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Transport: {status === "open" ? "live socket" : "HTTPS fallback"}
          </span>
        </div>
      </div>
    </>
  );
}
