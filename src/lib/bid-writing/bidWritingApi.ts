/**
 * API layer for bid-writing flows.
 *
 * Flask endpoints:
 * - GET  /bid/library/metadata      — Past Bid Library rows
 * - POST /bid/framework/{seq}       — Toggle framework status for a bid
 * - GET  /api/folders               — Qdrant folder counts for filters
 * - GET  /api/client_projects       — Client doc ingestion projects
 */

import { apiClient } from "@/lib/apiClient";
import type { ClientProjectOption, LibraryFolderOption, PastBid } from "./types";
import { MOCK_CLIENT_PROJECTS } from "./mockClientProjects";
import { MOCK_LIBRARY_FOLDERS } from "./mockBidFolders";

export async function fetchPastBids(): Promise<PastBid[]> {
  const response = await apiClient.get<PastBid[]>("/bid/library/metadata", {
    skipGlobalLoader: true,
  } as object);
  return Array.isArray(response.data) ? response.data : [];
}

export async function updateFrameworkStatus(
  seq: number,
  isFramework: boolean
): Promise<{ seq: number; is_framework: boolean }> {
  const response = await apiClient.post<{ seq: number; is_framework: boolean }>(
    `/bid/framework/${seq}`,
    { is_framework: isFramework },
    { skipGlobalLoader: true } as object
  );
  return response.data;
}

export async function fetchLibraryFolders(): Promise<LibraryFolderOption[]> {
  return MOCK_LIBRARY_FOLDERS;
}

export async function fetchClientProjects(): Promise<ClientProjectOption[]> {
  return MOCK_CLIENT_PROJECTS;
}
