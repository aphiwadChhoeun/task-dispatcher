import { config } from "@/config";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

export type ValidatedUpload = {
  mimeType: string;
  extension: string;
  size: number;
};

export type UploadValidationResult =
  | { ok: true; file: ValidatedUpload }
  | { ok: false; error: string };

async function sniffMime(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF") {
    return "application/pdf";
  }
  return null;
}

export async function validateUpload(
  file: File,
  allowed: readonly string[],
  maxBytes = config.uploads.maxBytes,
): Promise<UploadValidationResult> {
  if (!file || file.size === 0) return { ok: false, error: "Choose a file to upload" };
  if (file.size > maxBytes) {
    return { ok: false, error: `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)` };
  }

  const declared = file.type.toLowerCase();
  if (!allowed.includes(declared)) {
    return { ok: false, error: `Unsupported file type${declared ? `: ${declared}` : ""}` };
  }

  const sniffed = await sniffMime(file);
  if (declared.startsWith("image/") || declared === "application/pdf") {
    if (!sniffed || sniffed !== declared) {
      return { ok: false, error: "The file contents do not match its type" };
    }
  }

  return {
    ok: true,
    file: {
      mimeType: declared,
      extension: MIME_EXTENSIONS[declared] ?? "bin",
      size: file.size,
    },
  };
}

export function storageKey(
  orgId: string,
  scope: "tasks" | "grievances",
  entityId: string,
  extension: string,
  kind: "photo" | "attachment",
): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
  return `${orgId}/${scope}/${entityId}/${kind}-${crypto.randomUUID()}.${safeExt}`;
}

export function keyBelongsToOrg(key: string, orgId: string): boolean {
  return key.startsWith(`${orgId}/`);
}
