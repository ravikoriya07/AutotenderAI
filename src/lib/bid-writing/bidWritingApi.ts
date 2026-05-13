/**
 * API layer for bid-writing flows.
 *
 * Flask endpoints:
 * - GET  /bid/library/metadata      — Past Bid Library rows
 * - POST /bid/framework/{seq}       — Toggle framework status for a bid
 * - GET  /api/folders               — Qdrant folder counts for filters
 * - GET  /bid/client/projects       — Client doc ingestion projects
 * - GET  /bid/sessions              — Bid writing chat sessions (recent list)
 * - GET  /bid/sessions/{session_id} — Full session + messages
 * - DELETE /bid/sessions/{session_id} — Remove a bid writing session
 */

import { apiClient } from "@/lib/apiClient";
import type {
  BidSessionDetail,
  BidSessionSummary,
  ClientProjectOption,
  LibraryFolderOption,
  PastBid,
} from "./types";
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

type ClientProjectsApiResponse = {
  projects?: ClientProjectOption[];
  total?: number;
};

export async function fetchClientProjects(): Promise<ClientProjectOption[]> {
  const response = await apiClient.get<ClientProjectsApiResponse>("/bid/client/projects", {
    skipGlobalLoader: true,
  } as object);
  const projects = response.data?.projects;
  return Array.isArray(projects) ? projects : [];
}

type BidSessionsApiResponse = {
  sessions?: BidSessionSummary[];
};

export async function fetchBidSessions(): Promise<BidSessionSummary[]> {
  const response = await apiClient.get<BidSessionsApiResponse>("/bid/sessions", {
    skipGlobalLoader: true,
  } as object);
  const list = response.data?.sessions;
  return Array.isArray(list) ? list : [];
}

export async function fetchBidSession(sessionId: string): Promise<BidSessionDetail> {
  const response = await apiClient.get<BidSessionDetail>(
    `/bid/sessions/${encodeURIComponent(sessionId)}`,
    { skipGlobalLoader: true } as object
  );
  return response.data;
}

export async function deleteBidSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/bid/sessions/${encodeURIComponent(sessionId)}`, {
    skipGlobalLoader: true,
  } as object);
}
