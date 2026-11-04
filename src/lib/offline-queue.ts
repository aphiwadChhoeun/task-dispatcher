"use client";

/**
 * Small IndexedDB queue for offline tasker writes. Status changes and photos
 * are replayed in order when connectivity returns.
 */
const DB_NAME = "td-offline";
const DB_VERSION = 1;
const STATUS_STORE = "status";
const PHOTO_STORE = "photos";

export type QueuedStatus = {
  id: string;
  taskId: string;
  to: string;
  note?: string;
  taskTitle?: string;
  createdAt: number;
};

export type QueuedPhoto = {
  id: string;
  taskId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  kind: string;
  caption?: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATUS_STORE)) {
        db.createObjectStore(STATUS_STORE, { keyPath: "id" }).createIndex("taskId", "taskId");
      }
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "id" }).createIndex("taskId", "taskId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage error"));
  });
}

async function put<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  try {
    await requestToPromise(db.transaction(store, "readwrite").objectStore(store).put(value));
  } finally {
    db.close();
  }
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  try {
    return await requestToPromise(
      db.transaction(store, "readonly").objectStore(store).getAll() as IDBRequest<T[]>,
    );
  } finally {
    db.close();
  }
}

async function remove(store: string, id: string): Promise<void> {
  const db = await openDb();
  try {
    await requestToPromise(db.transaction(store, "readwrite").objectStore(store).delete(id));
  } finally {
    db.close();
  }
}

export async function enqueueStatus(input: Omit<QueuedStatus, "id" | "createdAt">): Promise<void> {
  await put<QueuedStatus>(STATUS_STORE, {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
}

export async function enqueuePhoto(input: Omit<QueuedPhoto, "id" | "createdAt">): Promise<void> {
  await put<QueuedPhoto>(PHOTO_STORE, {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
}

export async function getQueuedForTask(
  taskId: string,
): Promise<{ statuses: QueuedStatus[]; photos: QueuedPhoto[] }> {
  try {
    const [statuses, photos] = await Promise.all([
      getAll<QueuedStatus>(STATUS_STORE),
      getAll<QueuedPhoto>(PHOTO_STORE),
    ]);
    return {
      statuses: statuses.filter((item) => item.taskId === taskId),
      photos: photos.filter((item) => item.taskId === taskId),
    };
  } catch {
    return { statuses: [], photos: [] };
  }
}

export async function countQueued(): Promise<number> {
  try {
    const [statuses, photos] = await Promise.all([
      getAll<QueuedStatus>(STATUS_STORE),
      getAll<QueuedPhoto>(PHOTO_STORE),
    ]);
    return statuses.length + photos.length;
  } catch {
    return 0;
  }
}

export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openDb();
    await Promise.all([
      requestToPromise(db.transaction(STATUS_STORE, "readwrite").objectStore(STATUS_STORE).clear()),
      requestToPromise(db.transaction(PHOTO_STORE, "readwrite").objectStore(PHOTO_STORE).clear()),
    ]);
    db.close();
  } catch {
    // ignore
  }
}

export async function flushOfflineQueue(): Promise<{
  statuses: number;
  photos: number;
  failed: number;
}> {
  let statusCount = 0;
  let photoCount = 0;
  let failed = 0;

  let statuses: QueuedStatus[] = [];
  let photos: QueuedPhoto[] = [];
  try {
    [statuses, photos] = await Promise.all([
      getAll<QueuedStatus>(STATUS_STORE),
      getAll<QueuedPhoto>(PHOTO_STORE),
    ]);
  } catch {
    return { statuses: 0, photos: 0, failed: 0 };
  }

  for (const entry of statuses.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const response = await fetch(`/api/v1/tasks/${entry.taskId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: entry.to, note: entry.note }),
      });
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        await remove(STATUS_STORE, entry.id);
        if (response.ok) statusCount += 1;
        else failed += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  for (const entry of photos.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const formData = new FormData();
      formData.set("file", entry.blob, entry.filename);
      formData.set("kind", entry.kind);
      if (entry.caption) formData.set("caption", entry.caption);
      const response = await fetch(`/api/v1/tasks/${entry.taskId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        await remove(PHOTO_STORE, entry.id);
        if (response.ok) photoCount += 1;
        else failed += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { statuses: statusCount, photos: photoCount, failed };
}
