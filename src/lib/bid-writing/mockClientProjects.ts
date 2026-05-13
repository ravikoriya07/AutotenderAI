import type { ClientProjectOption } from "./types";

/** Local-only samples; live UI uses `fetchClientProjects()`. */
export const MOCK_CLIENT_PROJECTS: ClientProjectOption[] = [
  {
    id: "mock-1",
    name: "Riverside HA — Capitals Programme",
    chunks: 842,
    uploaded_at: null,
  },
  {
    id: "mock-2",
    name: "Metro Borough — Planned Maintenance 2025",
    chunks: 1205,
    uploaded_at: null,
  },
  {
    id: "mock-3",
    name: "Southern Consortium — Decarbonisation Pilot",
    chunks: 633,
    uploaded_at: null,
  },
];
