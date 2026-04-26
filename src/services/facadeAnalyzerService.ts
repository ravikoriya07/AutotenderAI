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
  /** Display / row id, or string key from the API. */
  id?: number | string;
  /** Stable id for `POST /analyze_facade/remove` when the API uses strings. */
  item_id?: string;
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

export type AnalyzeFacadeAddItem = {
  x: number;
  y: number;
  w: number;
  h: number;
  area_m2: number;
};

export type AnalyzeFacadeAddRequest = {
  job_id: string;
  file_path: string;
  item: AnalyzeFacadeAddItem;
};

export type AnalyzeFacadeRemoveRequest = {
  job_id: string;
  file_path: string;
  item_id: string;
};

function normalizeFacadeDimensionsArray(raw: unknown): FacadeDimension[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as FacadeDimension[];
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const d = o.dimensions ?? o.data;
    if (Array.isArray(d)) return d as FacadeDimension[];
  }
  return [];
}

/**
 * `GET /analyze_facade/dimensions` — source of truth for window list after add/remove.
 */
export async function getAnalyzeFacadeDimensions(params: {
  job_id: string;
  file_path: string;
}): Promise<{ dimensions: FacadeDimension[]; raw: unknown }> {
  const config: FacadeRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.get<unknown>("/analyze_facade/dimensions", {
    ...config,
    params: {
      job_id: params.job_id,
      file_path: toAutoCountApiFilePath(params.file_path),
    },
  });
  return { dimensions: normalizeFacadeDimensionsArray(data), raw: data };
}

export async function postAnalyzeFacadeAdd(
  payload: AnalyzeFacadeAddRequest
): Promise<unknown> {
  const config: FacadeRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/analyze_facade/add",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item: payload.item,
    },
    config
  );
  return data;
}

export async function postAnalyzeFacadeRemove(
  payload: AnalyzeFacadeRemoveRequest
): Promise<unknown> {
  const config: FacadeRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/analyze_facade/remove",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item_id: payload.item_id,
    },
    config
  );
  return data;
}
