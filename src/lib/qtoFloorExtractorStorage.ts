/** One extracted floor region (CSS px on page + backend seed for replay). */
export type FloorExtractionPersistedV1 = {
  id: string;
  pageNumber: number;
  seedBackend: { x: number; y: number };
  seedCss: { x: number; y: number };
  cssPoly: { x: number; y: number }[];
  areaM2: number;
};

export type PersistedFloorExtractorV1 = {
  v: 1;
  extractions: FloorExtractionPersistedV1[];
};

function storageKey(jobId: string, path: string): string {
  return `qto-floor-extract:v1:${jobId}:${encodeURIComponent(path)}`;
}

export function saveQtoFloorExtractor(
  jobId: string,
  path: string,
  data: PersistedFloorExtractorV1
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(jobId, path), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function loadQtoFloorExtractor(
  jobId: string,
  path: string | null
): PersistedFloorExtractorV1 | null {
  if (!path || !jobId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobId, path));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PersistedFloorExtractorV1>;
    if (p.v !== 1 || !Array.isArray(p.extractions)) return null;
    return p as PersistedFloorExtractorV1;
  } catch {
    return null;
  }
}

export function clearQtoFloorExtractor(jobId: string, path: string | null): void {
  if (!path || !jobId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(jobId, path));
  } catch {
    /* ignore */
  }
}
