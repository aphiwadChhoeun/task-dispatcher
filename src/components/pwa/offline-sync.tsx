"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { flushOfflineQueue } from "@/lib/offline-queue";

/** Flushes queued status changes and photos when the connection returns. */
export function OfflineSync() {
  const router = useRouter();
  const flushing = useRef(false);

  useEffect(() => {
    const flush = async () => {
      if (flushing.current || !navigator.onLine) return;
      flushing.current = true;
      try {
        const result = await flushOfflineQueue();
        if (result.statuses + result.photos > 0) {
          router.refresh();
        }
      } finally {
        flushing.current = false;
      }
    };

    void flush();
    window.addEventListener("online", flush);
    const interval = setInterval(flush, 60_000);
    return () => {
      window.removeEventListener("online", flush);
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
