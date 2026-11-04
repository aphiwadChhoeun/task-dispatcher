import "server-only";
import { getEnv } from "@/lib/server-env";

export interface StoredFile {
  body: ReadableStream;
  contentType: string;
  size: number;
}

export interface FileStorage {
  put(
    key: string,
    data: ArrayBuffer,
    options: { contentType: string; fileName?: string },
  ): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
}

class R2FileStorage implements FileStorage {
  async put(
    key: string,
    data: ArrayBuffer,
    options: { contentType: string; fileName?: string },
  ): Promise<void> {
    const env = getEnv();
    if (!env.FILES) throw new Error("R2 binding `FILES` is not available");
    await env.FILES.put(key, data, {
      httpMetadata: {
        contentType: options.contentType,
        contentDisposition: options.fileName
          ? `inline; filename="${options.fileName.replaceAll('"', "")}"`
          : undefined,
      },
      customMetadata: { uploadedAt: new Date().toISOString() },
    });
  }

  async get(key: string): Promise<StoredFile | null> {
    const env = getEnv();
    if (!env.FILES) throw new Error("R2 binding `FILES` is not available");
    const object = await env.FILES.get(key);
    if (!object) return null;
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
      size: object.size,
    };
  }

  async delete(key: string): Promise<void> {
    const env = getEnv();
    if (!env.FILES) return;
    await env.FILES.delete(key);
  }
}

class MemoryFileStorage implements FileStorage {
  private readonly files = new Map<string, { data: ArrayBuffer; type: string }>();

  async put(key: string, data: ArrayBuffer, options: { contentType: string }): Promise<void> {
    this.files.set(key, { data, type: options.contentType });
  }

  async get(key: string): Promise<StoredFile | null> {
    const file = this.files.get(key);
    if (!file) return null;
    return {
      body: new Blob([file.data]).stream(),
      contentType: file.type,
      size: file.data.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

let storage: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (!storage) {
    try {
      const env = getEnv();
      storage = env.FILES ? new R2FileStorage() : new MemoryFileStorage();
    } catch {
      storage = new MemoryFileStorage();
    }
  }
  return storage;
}

/** Test helper. */
export function setStorageForTests(next: FileStorage | null): void {
  storage = next;
}
