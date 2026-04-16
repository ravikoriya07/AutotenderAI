import type { AutoCountRoi } from "@/services/autoCountService";
import type { AnalyzeFacadeResponse } from "@/services/facadeAnalyzerService";

export type FacadeBackendState = {
  pageNumber: number;
  roi: AutoCountRoi;
  response: AnalyzeFacadeResponse;
};

export type PersistedFacadeV1 = { v: 1 } & FacadeBackendState;

function storageKey(jobId: string, path: string): string {
  return `qto-facade:v1:${jobId}:${encodeURIComponent(path)}`;
}

export function saveQtoFacade(
  jobId: string,
  path: string,
  data: PersistedFacadeV1
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(jobId, path), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function loadQtoFacade(
  jobId: string,
  path: string | null
): PersistedFacadeV1 | null {
  if (!path || !jobId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId, path));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedFacadeV1>;
    if (
      p.v !== 1 ||
      typeof p.pageNumber !== "number" ||
      !p.roi ||
      typeof p.roi !== "object" ||
      !p.response ||
      typeof p.response !== "object"
    ) {
      return null;
    }
    return p as PersistedFacadeV1;
  } catch {
    return null;
  }
}

export function clearQtoFacade(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
