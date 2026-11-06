"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type PhotoViewerItem = {
  id: string;
  url: string;
  alt: string;
  kind: string;
  caption: string | null;
  uploaderName: string | null;
  createdAtLabel: string;
};

export function PhotoGalleryGrid({ photos }: { photos: PhotoViewerItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openViewer = (index: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setActiveIndex(index);
  };

  const closeViewer = useCallback(() => {
    setActiveIndex(null);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="group overflow-hidden rounded-2xl border border-border/85 bg-card shadow-card"
          >
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              aria-haspopup="dialog"
              aria-label={`View photo ${index + 1} of ${photos.length}: ${photo.alt}`}
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                openViewer(index, event.currentTarget);
              }}
              className="relative block overflow-hidden"
            >
              <img
                src={photo.url}
                alt={photo.alt}
                loading="lazy"
                draggable={false}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100 group-focus-within:bg-black/20 group-focus-within:opacity-100"
              >
                <span className="rounded-full bg-black/55 p-2 text-white shadow-lg">
                  <Maximize2 className="size-4" />
                </span>
              </span>
            </a>
            <div className="space-y-1 p-2.5">
              <Badge variant="secondary" className="capitalize">
                {photo.kind}
              </Badge>
              {photo.caption ? <p className="line-clamp-2 text-xs">{photo.caption}</p> : null}
              <p className="text-[11px] text-muted-foreground">
                {photo.uploaderName ?? "Tasker"} · {photo.createdAtLabel}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {activeIndex !== null ? (
        <PhotoLightbox
          photos={photos}
          index={activeIndex}
          onClose={closeViewer}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </>
  );
}

function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: PhotoViewerItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const multiple = photos.length > 1;

  const showPrevious = useCallback(() => {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }, [index, onIndexChange, photos.length]);

  const showNext = useCallback(() => {
    onIndexChange((index + 1) % photos.length);
  }, [index, onIndexChange, photos.length]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        if (!multiple) return;
        event.preventDefault();
        showPrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        if (!multiple) return;
        event.preventDefault();
        showNext();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [multiple, onClose, showNext, showPrevious]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[60] flex flex-col bg-[#07110d]/95 text-white backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-medium tabular-nums text-white/80">
            {index + 1} / {photos.length}
          </p>
          <p className="sr-only" aria-live="polite">
            {photo.alt}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-20"
        onClick={onClose}
      >
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.alt}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
        />

        {multiple ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              aria-label="Previous photo"
              className="absolute left-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:left-5"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              aria-label="Next photo"
              className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:right-5"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      <div className="border-t border-white/10 bg-black/30 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge variant="secondary" className="capitalize">
              {photo.kind}
            </Badge>
            <span className="text-xs text-white/70">
              {photo.uploaderName ?? "Tasker"} · {photo.createdAtLabel}
            </span>
          </div>
          {photo.caption ? (
            <p className="text-sm leading-relaxed text-white/90">{photo.caption}</p>
          ) : null}
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Open original
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
