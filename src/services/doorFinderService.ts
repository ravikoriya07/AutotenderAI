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
