import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import type { AutoCountRoi } from "@/services/autoCountService";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type WallFinderRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type WallFinderApiSegment = {
  /** For `POST /analyze_walls/remove`. */
  id?: string | number;
  item_id?: string;
  angle?: number;
  start: [number, number];
  end: [number, number];
  length_m?: number;
  length_px?: number;
};

/** Flexible JSON from `/analyze_walls`; segments may use alternate keys or point shapes. */
export type WallFinderApiResponse = {
  success?: boolean;
  mode?: string;
  roi_offset?: { x: number; y: number };
  dimensions?: WallFinderApiSegment[];
  segments?: WallFinderApiSegment[];
  /** Some backends use alternate keys for the wall line list. */
  wall_segments?: unknown[];
  walls?: unknown[];
  total_length_m?: number;
  total_walls?: number;
};

export type AnalyzeWallsRequest = {
  job_id: string;
  file_path: string;
  roi: AutoCountRoi;
  pixel_to_meter: number;
  confidence: number;
};

export type AnalyzeWallsAddItem = {
  start: { x: number; y: number };
  end: { x: number; y: number };
  length_m: number;
};

export type AnalyzeWallsAddRequest = {
  job_id: string;
  file_path: string;
  item: AnalyzeWallsAddItem;
};

export type AnalyzeWallsRemoveRequest = {
  job_id: string;
  file_path: string;
  item_id: string;
};

function normalizeWallsResponsePayload(
  data: unknown
): WallFinderApiResponse & { segments?: WallFinderApiSegment[] } {
  if (data == null) return { segments: [] };
  if (Array.isArray(data)) {
    return { segments: data as WallFinderApiSegment[] } as WallFinderApiResponse;
  }
  if (typeof data === "object") {
    return data as WallFinderApiResponse & { segments?: WallFinderApiSegment[] };
  }
  return { segments: [] };
}

/**
 * `GET /analyze_walls/segments` — source of truth after add/remove.
 */
export async function getAnalyzeWallsSegments(params: {
  job_id: string;
  file_path: string;
}): Promise<WallFinderApiResponse> {
  const config: WallFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.get<unknown>(
    "/analyze_walls/segments",
    {
      ...config,
      params: {
        job_id: params.job_id,
        file_path: toAutoCountApiFilePath(params.file_path),
      },
    }
  );
  return normalizeWallsResponsePayload(data);
}

export async function postAnalyzeWallsAdd(
  payload: AnalyzeWallsAddRequest
): Promise<unknown> {
  const config: WallFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/analyze_walls/add",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item: payload.item,
    },
    config
  );
  return data;
}

export async function postAnalyzeWallsRemove(
  payload: AnalyzeWallsRemoveRequest
): Promise<unknown> {
  const config: WallFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/analyze_walls/remove",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item_id: payload.item_id,
    },
    config
  );
  return data;
}

export async function postAnalyzeWalls(
  payload: AnalyzeWallsRequest
): Promise<WallFinderApiResponse> {
  const config: WallFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<WallFinderApiResponse>(
    "/analyze_walls",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      roi: payload.roi,
      pixel_to_meter: payload.pixel_to_meter,
      confidence: payload.confidence,
    },
    config
  );
  return data;
}
