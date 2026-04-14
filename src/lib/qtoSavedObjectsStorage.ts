import type { AutoCountBackendState } from "@/lib/qtoAutoCountStorage";

export type QtoSavedObjectEntryV1 = {
  v: 1;
  id: string;
  objectId: string;
  objectName: string;
  count: number;
  savedAt: number;
  canvasSnapshot: AutoCountBackendState;
};

export type QtoSavedObjectsFileV1 = {
  version: 1;
  jobId: string;
  filePath: string;
  exportedAt: number;
  objects: QtoSavedObjectEntryV1[];
};

function storageKey(jobId: string, path: string): string {
  return `qto-saved-objects:v1:${jobId}:${encodeURIComponent(path)}`;
}

function isValidEntry(x: unknown): x is QtoSavedObjectEntryV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const snap = o.canvasSnapshot as AutoCountBackendState | undefined;
  return (
    o.v === 1 &&
    typeof o.id === "string" &&
    typeof o.objectId === "string" &&
    typeof o.objectName === "string" &&
    typeof o.count === "number" &&
    Number.isFinite(o.count) &&
    typeof o.savedAt === "number" &&
    snap != null &&
    typeof snap.pageNumber === "number" &&
    snap.roi != null &&
    typeof (snap.roi as { x?: unknown }).x === "number" &&
    Array.isArray(snap.matches)
  );
}

export function loadQtoSavedObjects(
  jobId: string,
  path: string | null
): QtoSavedObjectEntryV1[] {
  if (!path || !jobId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(jobId, path));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

export function saveQtoSavedObjectsList(
  jobId: string,
  path: string,
  list: QtoSavedObjectEntryV1[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(jobId, path), JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
}

export function appendQtoSavedObject(
  jobId: string,
  path: string,
  entry: QtoSavedObjectEntryV1
): QtoSavedObjectEntryV1[] {
  const prev = loadQtoSavedObjects(jobId, path);
  const next = [...prev, entry];
  saveQtoSavedObjectsList(jobId, path, next);
  return next;
}

/** Remove all saved objects for this job + drawing path (e.g. on Clear). */
export function clearQtoSavedObjects(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
