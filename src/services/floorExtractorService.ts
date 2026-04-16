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
 * `/extract_floor` response. Backend may omit `polygon` (legacy image-only);
 * when present, vertices are in analysis raster space unless noted — use
 * {@link normalizeFloorPolygonToPreviewBackend} before CSS mapping.
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
  /** Preview-scale (×2) polygon if API provides it */
  polygon?: Array<{ x: number; y: number }>;
  current_polygon?: Array<{ x: number; y: number }>;
};

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
