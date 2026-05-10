import type { ClientProjectOption } from "./types";

/** Mock `/api/client_projects` until wired to ingestion pipeline. */
export const MOCK_CLIENT_PROJECTS: ClientProjectOption[] = [
  { name: "Riverside HA — Capitals Programme", chunks: 842 },
  { name: "Metro Borough — Planned Maintenance 2025", chunks: 1205 },
  { name: "Southern Consortium — Decarbonisation Pilot", chunks: 633 },
];
