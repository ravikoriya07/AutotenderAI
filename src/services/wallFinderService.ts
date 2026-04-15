import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import type { AutoCountRoi } from "@/services/autoCountService";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type WallFinderRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type WallFinderApiSegment = {
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
