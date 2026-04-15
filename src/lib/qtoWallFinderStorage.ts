import type { AutoCountRoi } from "@/services/autoCountService";
import type { WallFinderApiResponse } from "@/services/wallFinderService";

export type WallFinderBackendState = {
  pageNumber: number;
  roi: AutoCountRoi;
  response: WallFinderApiResponse;
};

export type PersistedWallFinderV1 = { v: 1 } & WallFinderBackendState;

function storageKey(jobId: string, path: string): string {
  return `qto-wallfinder:v1:${jobId}:${encodeURIComponent(path)}`;
}

export function saveQtoWallFinder(
  jobId: string,
  path: string,
  data: PersistedWallFinderV1
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(jobId, path), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function loadQtoWallFinder(
  jobId: string,
  path: string | null
): PersistedWallFinderV1 | null {
  if (!path || !jobId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId, path));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedWallFinderV1>;
    if (
      p.v !== 1 ||
      typeof p.pageNumber !== "number" ||
      !p.roi ||
      !p.response ||
      typeof p.response !== "object"
    ) {
      return null;
    }
    return p as PersistedWallFinderV1;
  } catch {
    return null;
  }
}

export function clearQtoWallFinder(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
