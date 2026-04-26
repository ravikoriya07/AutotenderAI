import type { AutoCountRoi } from "@/services/autoCountService";
import type { AutoCountApiMatch } from "@/lib/autoCountCoordinates";

/** In-memory + sessionStorage payload for last analyze / restore (backend coordinate space). */
export type AutoCountBackendState = {
  pageNumber: number;
  roi: AutoCountRoi;
  matches: AutoCountApiMatch[];
};

/** `source: "searchText"` when overlays are synced via `/search_text/matches` (optional for older saves). */
export type PersistedAutoCountV1 = { v: 1; source?: "searchText" } & AutoCountBackendState;

function storageKey(jobId: string, path: string): string {
  return `qto-autocount:v1:${jobId}:${encodeURIComponent(path)}`;
}

export function saveQtoAutoCount(
  jobId: string,
  path: string,
  data: PersistedAutoCountV1
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(jobId, path), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function loadQtoAutoCount(
  jobId: string,
  path: string | null
): PersistedAutoCountV1 | null {
  if (!path || !jobId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId, path));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedAutoCountV1>;
    if (
      p.v !== 1 ||
      typeof p.pageNumber !== "number" ||
      !p.roi ||
      !Array.isArray(p.matches)
    ) {
      return null;
    }
    return p as PersistedAutoCountV1;
  } catch {
    return null;
  }
}

export function clearQtoAutoCount(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
