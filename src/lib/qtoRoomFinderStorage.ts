import type { AutoCountRoi } from "@/services/autoCountService";
import type { RoomFinderApiResponse } from "@/services/roomFinderService";

export type RoomFinderBackendState = {
  pageNumber: number;
  roi: AutoCountRoi;
  response: RoomFinderApiResponse;
};

export type PersistedRoomFinderV1 = { v: 1 } & RoomFinderBackendState;

function storageKey(jobId: string, path: string): string {
  return `qto-roomfinder:v1:${jobId}:${encodeURIComponent(path)}`;
}

export function saveQtoRoomFinder(
  jobId: string,
  path: string,
  data: PersistedRoomFinderV1
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(jobId, path), JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function loadQtoRoomFinder(
  jobId: string,
  path: string | null
): PersistedRoomFinderV1 | null {
  if (!path || !jobId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId, path));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedRoomFinderV1>;
    if (
      p.v !== 1 ||
      typeof p.pageNumber !== "number" ||
      !p.roi ||
      !p.response ||
      typeof p.response !== "object"
    ) {
      return null;
    }
    return p as PersistedRoomFinderV1;
  } catch {
    return null;
  }
}

export function clearQtoRoomFinder(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
