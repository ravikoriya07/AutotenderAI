import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type FloorRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

/** Matches `/extract_floor` body; `pixel_to_meter` is fixed per product spec. */
export const FLOOR_EXTRACT_PIXEL_TO_METER = 0.01;

export type FloorSeedPayload = {
  x: number;
  y: number;
};

export type ExtractFloorRequest = {
  job_id: string;
  file_path: string;
  seed: FloorSeedPayload;
  pixel_to_meter: number;
};

/**
 * `/extract_floor` response. Backend may omit polygon fields (legacy image-only);
 * when present, vertices are usually in backend preview space — use
 * {@link floorPolygonAnalysisToPreviewBackend} only when coords look like analysis raster (see QTO handler).
 */
export type ExtractFloorResponse = {
  success?: boolean;
  error?: string;
  new_area?: number;
  total_area?: number;
  room_count?: number;
  new_text?: string;
  image?: string;
  pixel_to_meter?: number;
  /** Primary field: ring in backend preview/analysis space — often `[[x,y], ...]` tuples. */
  new_polygon?: unknown;
  /** Legacy: `{ x, y }[]` preview-scale polygon */
  polygon?: Array<{ x: number; y: number }>;
  /** Legacy alias (reference script `current_polygon`) */
  current_polygon?: Array<{ x: number; y: number }>;
  all_rooms?: Array<{
    id?: number;
    polygon?: unknown;
    area_m2?: number;
    text?: string;
  }>;
};

/**
 * Normalizes API polygon forms to `{x,y}[]`:
 * - `[[x,y], [x,y], ...]` (new_polygon)
 * - `[{x,y}, ...]` (legacy)
 */
export function normalizeExtractFloorPolygon(
  raw: unknown
): { x: number; y: number }[] | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const pts: { x: number; y: number }[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && p.length >= 2) {
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    } else if (p && typeof p === "object" && !Array.isArray(p)) {
      const o = p as Record<string, unknown>;
      const x = Number(o.x);
      const y = Number(o.y);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    }
  }
  return pts.length >= 3 ? pts : null;
}

export async function postExtractFloor(
  payload: ExtractFloorRequest
): Promise<ExtractFloorResponse> {
  const config: FloorRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<ExtractFloorResponse>(
    "/extract_floor",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      seed: payload.seed,
      pixel_to_meter: payload.pixel_to_meter,
    },
    config
  );
  return data;
}
