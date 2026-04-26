import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import type { AutoCountMatch, AutoCountRoi } from "@/services/autoCountService";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type DoorFinderRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type AnalyzeDoorsRequest = {
  job_id: string;
  file_path: string;
  roi: AutoCountRoi;
  confidence: number;
  /** Static for now */
  labels: readonly ["door"];
};

export type AnalyzeDoorsResponse = {
  mode?: string;
  total_found?: number;
  matches?: AutoCountMatch[];
};

export type AnalyzeDoorsAddItem = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: "door";
};

export type AnalyzeDoorsAddRequest = {
  job_id: string;
  file_path: string;
  item: AnalyzeDoorsAddItem;
};

export type AnalyzeDoorsRemoveRequest = {
  job_id: string;
  file_path: string;
  item_id: string;
};

function normalizeDoorsMatchesPayload(raw: unknown): AutoCountMatch[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as AutoCountMatch[];
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const m = o.matches ?? o.data;
    if (Array.isArray(m)) return m as AutoCountMatch[];
  }
  return [];
}

/**
 * `GET /analyze_doors/matches` — source of truth after add/remove.
 */
export async function getAnalyzeDoorsMatches(params: {
  job_id: string;
  file_path: string;
}): Promise<{ matches: AutoCountMatch[] }> {
  const config: DoorFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.get<unknown>("/analyze_doors/matches", {
    ...config,
    params: {
      job_id: params.job_id,
      file_path: toAutoCountApiFilePath(params.file_path),
    },
  });
  return { matches: normalizeDoorsMatchesPayload(data) };
}

export async function postAnalyzeDoorsAdd(
  payload: AnalyzeDoorsAddRequest
): Promise<unknown> {
  const config: DoorFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/analyze_doors/add",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item: payload.item,
    },
    config
  );
  return data;
}

export async function postAnalyzeDoorsRemove(
  payload: AnalyzeDoorsRemoveRequest
): Promise<unknown> {
  const config: DoorFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/analyze_doors/remove",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item_id: payload.item_id,
    },
    config
  );
  return data;
}

export async function postAnalyzeDoors(
  payload: AnalyzeDoorsRequest
): Promise<AnalyzeDoorsResponse> {
  const config: DoorFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<AnalyzeDoorsResponse>(
    "/analyze_doors",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      roi: payload.roi,
      confidence: payload.confidence,
      labels: [...payload.labels],
    },
    config
  );
  return data;
}
