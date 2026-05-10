/**
 * API stubs for bid-writing flows — replace implementations when backend routes exist.
 *
 * Expected Flask parity (reference `bid_writing/app.py`):
 * - POST `/chat` — SSE tokens + sources
 * - GET `/api/library_metadata` — Past Bid Library rows
 * - GET `/api/folders` — Qdrant folder counts for filters
 * - GET `/api/client_projects` — Client doc ingestion projects
 */

import type { ClientProjectOption, LibraryFolderOption, PastBid } from "./types";
import { MOCK_CLIENT_PROJECTS } from "./mockClientProjects";
import { MOCK_LIBRARY_FOLDERS } from "./mockBidFolders";
import { MOCK_PAST_BIDS } from "./mockPastBids";

export async function fetchPastBids(): Promise<PastBid[]> {
  return MOCK_PAST_BIDS;
}

export async function fetchLibraryFolders(): Promise<LibraryFolderOption[]> {
  return MOCK_LIBRARY_FOLDERS;
}

export async function fetchClientProjects(): Promise<ClientProjectOption[]> {
  return MOCK_CLIENT_PROJECTS;
}
