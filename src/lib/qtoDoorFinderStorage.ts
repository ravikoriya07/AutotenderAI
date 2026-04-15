import type { AutoCountBackendState } from "@/lib/qtoAutoCountStorage";

export type PersistedDoorFinderV1 = { v: 1 } & AutoCountBackendState;

function storageKey(jobId: string, path: string): string {
  return `qto-doorfinder:v1:${jobId}:${encodeURIComponent(path)}`;
}

export function saveQtoDoorFinder(
  jobId: string,
  path: string,
  data: PersistedDoorFinderV1
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(jobId, path), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function loadQtoDoorFinder(
  jobId: string,
  path: string | null
): PersistedDoorFinderV1 | null {
  if (!path || !jobId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId, path));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedDoorFinderV1>;
    if (
      p.v !== 1 ||
      typeof p.pageNumber !== "number" ||
      !p.roi ||
      !Array.isArray(p.matches)
    ) {
      return null;
    }
    return p as PersistedDoorFinderV1;
  } catch {
    return null;
  }
}

export function clearQtoDoorFinder(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
