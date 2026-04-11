import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";

type AutoCountRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

/** Rectangle in backend pdf.js space at PREVIEW_ZOOM / scale 2 (see autoCountCoordinates). */
export type AutoCountRoi = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AutoCountRequest = {
  job_id: string;
  /** Project-relative path; normalized to `extract_zip_output/...` when sent (see {@link toAutoCountApiFilePath}). */
  file_path: string;
  roi: AutoCountRoi;
  rotation_invariant: boolean;
  confidence: number;
};

/**
 * Backend `/auto_count` expects files under `extract_zip_output/` (unzipped tree), not the viewer `pdfs/` prefix.
 */
export function toAutoCountApiFilePath(projectRelativePath: string): string {
  const t = projectRelativePath.trim();
  if (t.startsWith("pdfs/")) {
    return `extract_zip_output/${t.slice("pdfs/".length)}`;
  }
  return t;
}

/** Match box in backend pdf.js space at scale 2; UI converts to CSS for overlay. */
export type AutoCountMatch = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

export type AutoCountResponse = {
  mode?: string;
  total_found?: number;
  matches?: AutoCountMatch[];
};

export async function postAutoCount(
  payload: AutoCountRequest
): Promise<AutoCountResponse> {
  const config: AutoCountRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<AutoCountResponse>(
    "/auto_count",
    {
      ...payload,
      file_path: toAutoCountApiFilePath(payload.file_path),
    },
    config
  );
  return data;
}
