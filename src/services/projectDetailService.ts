import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";
import { normalizeProjectDetailResponse } from "@/lib/project-detail/normalizeProjectDetail";
import type {
  ProjectDetailData,
  ProjectDetailRawResponse,
} from "@/types/project-detail";

type DetailRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

/**
 * Fetches project detail tabs for `/projects/[id]`.
 * GET /details/:projectId (via `NEXT_PUBLIC_API_BASE_URL`).
 */
export async function fetchProjectDetail(
  projectId: string,
  signal?: AbortSignal
): Promise<ProjectDetailData> {
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("Invalid project.");
  }

  const config: DetailRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
  };

  const { data } = await apiClient.get<ProjectDetailRawResponse>(
    `/details/${encodeURIComponent(trimmed)}`,
    config
  );

  return normalizeProjectDetailResponse(trimmed, data);
}
