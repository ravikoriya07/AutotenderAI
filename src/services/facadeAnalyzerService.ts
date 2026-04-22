import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import type { AutoCountRoi } from "@/services/autoCountService";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type FacadeRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type AnalyzeFacadeRequest = {
  job_id: string;
  file_path: string;
  roi: AutoCountRoi;
  /** Product default (matches spec / reference API). */
  pixel_to_meter: number;
  confidence: number;
};

/** One detected opening (usually a window); bbox fields optional if backend is metrics-only. */
export type FacadeDimension = {
  id: number;
  label?: string;
  area_m2?: number;
  height_m?: number;
  width_m?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
};

export type AnalyzeFacadeResponse = {
  success?: boolean;
  error?: string;
  mode?: string;
  facade_area?: number;
  net_area?: number;
  window_area?: number;
  window_count?: number;
  dimensions?: FacadeDimension[];
  /** Annotated PNG (Quantitites `abc.html` replaces canvas with this after analyze). */
  image?: string;
  /**
   * Pixel size of the same coordinate system as `dimensions` bboxes (e.g. YOLO input / letterbox).
   * If the model runs on a resized crop, set these so the UI can map when `image` is full-page
   * or a different resolution than the inference grid.
   */
  analysis_image_width?: number;
  analysis_image_height?: number;
};

export const FACADE_PIXEL_TO_METER = 0.01;

export async function postAnalyzeFacade(
  payload: AnalyzeFacadeRequest
): Promise<AnalyzeFacadeResponse> {
  const config: FacadeRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<AnalyzeFacadeResponse>(
    "/analyze_facade",
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
