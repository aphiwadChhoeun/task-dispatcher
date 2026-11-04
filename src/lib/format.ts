import { config } from "@/config";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: config.app.timezone,
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: config.app.timezone,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: config.app.timezone,
});

export function asDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: Date | string | number | null | undefined): string {
  const date = asDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatDate(value: Date | string | number | null | undefined): string {
  const date = asDate(value);
  return date ? dateOnlyFormatter.format(date) : "—";
}

export function formatTime(value: Date | string | number | null | undefined): string {
  const date = asDate(value);
  return date ? timeFormatter.format(date) : "—";
}

export function formatWindow(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
): string {
  const s = asDate(start);
  const e = asDate(end);
  if (!s) return "Unscheduled";
  if (!e) return formatDateTime(s);
  return `${formatDate(s)}, ${formatTime(s)} – ${formatTime(e)}`;
}

export function formatRelative(value: Date | string | number | null | undefined, now = Date.now()): string {
  const date = asDate(value);
  if (!date) return "—";
  const diff = now - date.getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  if (abs < 45_000) return "just now";
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${minutes} min ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ${suffix}`;
  return formatDate(date);
}

export function formatLastSeen(value: Date | string | number | null | undefined): string {
  const date = asDate(value);
  if (!date) return "No location yet";
  return `Updated ${formatRelative(date)}`;
}

export function isStale(
  updatedAt: Date | string | number | null | undefined,
  staleSeconds = config.location.staleSeconds,
  now = Date.now(),
): boolean {
  const date = asDate(updatedAt);
  if (!date) return true;
  return now - date.getTime() > staleSeconds * 1000;
}

export function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(value: Date, days: number): Date {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format a Date for an `<input type="datetime-local">` in the browser's timezone. */
export function toDateTimeLocal(value: Date | string | number | null | undefined): string {
  const date = asDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAddress(parts: {
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
}): string {
  return [
    parts.addressStreet,
    [parts.addressCity, parts.addressState].filter(Boolean).join(", "),
    parts.addressPostalCode,
    parts.addressCountry,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
