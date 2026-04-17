import type { AutoCountBackendState } from "@/lib/qtoAutoCountStorage";
import type { FloorExtractionPersistedV1 } from "@/lib/qtoFloorExtractorStorage";
import type { AutoCountRoi } from "@/services/autoCountService";
import type { AnalyzeFacadeResponse } from "@/services/facadeAnalyzerService";
import type { RoomFinderApiResponse } from "@/services/roomFinderService";
import type { WallFinderApiResponse } from "@/services/wallFinderService";

/** Persisted wall analysis for canvas replay (matches backend ROI + API body). */
export type WallFinderSavedSnapshotV1 = {
  pageNumber: number;
  roi: AutoCountBackendState["roi"];
  response: WallFinderApiResponse;
};

/** Persisted room analysis for canvas replay. */
export type RoomFinderSavedSnapshotV1 = {
  pageNumber: number;
  roi: AutoCountBackendState["roi"];
  response: RoomFinderApiResponse;
};

/** Persisted floor extractions for canvas replay (same shape as session storage). */
export type FloorSavedSnapshotV1 = {
  extractions: FloorExtractionPersistedV1[];
};

/** Facade analyze result for replay (structurally same as wall snapshot). */
export type FacadeSavedSnapshotV1 = {
  pageNumber: number;
  roi: AutoCountRoi;
  response: AnalyzeFacadeResponse;
};

export type QtoSavedObjectEntryV1 = {
  v: 1;
  id: string;
  objectId: string;
  objectName: string;
  /** Match count, total_walls, total_rooms, windows, or floor region count */
  count: number;
  savedAt: number;
  analysisKind?: "matches" | "walls" | "rooms" | "floor" | "facade";
  totalWallLengthM?: number;
  /** Room finder — combined area (m²); floor — sum of extracted regions (m²) */
  totalAreaM2?: number;
  canvasSnapshot:
    | AutoCountBackendState
    | WallFinderSavedSnapshotV1
    | RoomFinderSavedSnapshotV1
    | FloorSavedSnapshotV1
    | FacadeSavedSnapshotV1;
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

export function isMatchCanvasSnapshot(
  snap: unknown
): snap is AutoCountBackendState {
  if (!snap || typeof snap !== "object") return false;
  const s = snap as Record<string, unknown>;
  return (
    typeof s.pageNumber === "number" &&
    s.roi != null &&
    typeof s.roi === "object" &&
    typeof (s.roi as { x?: unknown }).x === "number" &&
    Array.isArray(s.matches)
  );
}

export function isWallCanvasSnapshot(
  snap: unknown
): snap is WallFinderSavedSnapshotV1 {
  if (!snap || typeof snap !== "object") return false;
  const s = snap as Record<string, unknown>;
  return (
    typeof s.pageNumber === "number" &&
    s.roi != null &&
    typeof s.roi === "object" &&
    typeof (s.roi as { x?: unknown }).x === "number" &&
    s.response != null &&
    typeof s.response === "object"
  );
}

/** Same structural check as wall snapshot; narrows `response` to {@link RoomFinderApiResponse}. */
export function isRoomCanvasSnapshot(
  snap: unknown
): snap is RoomFinderSavedSnapshotV1 {
  if (!snap || typeof snap !== "object") return false;
  const s = snap as Record<string, unknown>;
  return (
    typeof s.pageNumber === "number" &&
    s.roi != null &&
    typeof s.roi === "object" &&
    typeof (s.roi as { x?: unknown }).x === "number" &&
    s.response != null &&
    typeof s.response === "object"
  );
}

export function isFloorCanvasSnapshot(s: unknown): s is FloorSavedSnapshotV1 {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return Array.isArray(o.extractions);
}

function isValidEntry(x: unknown): x is QtoSavedObjectEntryV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const snap = o.canvasSnapshot;
  if (!snap || typeof snap !== "object") return false;
  const sk = snap as Record<string, unknown>;
  const base =
    o.v === 1 &&
    typeof o.id === "string" &&
    typeof o.objectId === "string" &&
    typeof o.objectName === "string" &&
    typeof o.count === "number" &&
    Number.isFinite(o.count) &&
    typeof o.savedAt === "number";
  if (!base) return false;
  if (isMatchCanvasSnapshot(sk)) {
    return true;
  }
  if (
    (o.analysisKind === "walls" || o.analysisKind === "rooms") &&
    isWallCanvasSnapshot(sk)
  ) {
    return true;
  }
  if (o.analysisKind === "facade" && isWallCanvasSnapshot(sk)) {
    return true;
  }
  if (o.analysisKind === "floor" && isFloorCanvasSnapshot(sk)) {
    return true;
  }
  return false;
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
