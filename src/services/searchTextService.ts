import { autoCountClient } from "@/lib/autoCountClient";
import type { AutoCountApiMatch } from "@/lib/autoCountCoordinates";
import { toAutoCountApiFilePath } from "@/services/autoCountService";
import type { AxiosRequestConfig } from "axios";

type SearchTextRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type SearchTextRequest = {
  job_id: string;
  file_path: string;
  search_term: string;
  case_sensitive: boolean;
};

export type SearchTextResponse = {
  total_found?: number;
  matches?: AutoCountApiMatch[];
  mode?: string;
};

export async function postSearchText(
  payload: SearchTextRequest
): Promise<SearchTextResponse> {
  const config: SearchTextRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<SearchTextResponse>(
    "/search_text",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      search_term: payload.search_term.trim(),
      case_sensitive: Boolean(payload.case_sensitive),
    },
    config
  );
  return data;
}
