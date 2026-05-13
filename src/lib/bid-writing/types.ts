/** Aligns with Flask `GET /bid/library/metadata` entries. */
export type PastBid = {
  seq: number;
  project: string;
  qdrant_project_name: string;
  group: "won" | "lost" | "other";
  quality_tier: "high_quality" | "medium_quality" | "other" | string;
  quality_score_pct: number | null;
  outcome: string;
  submitted: string;
  bid_type: string;
  price_quality_split?: string;
  value_gbp?: number;
  is_framework?: boolean;
  questions?: string[];
  outcome_notes?: string;
};

export type LibraryFolderOption = {
  name: string;
  count: number;
};

/** Entry from `GET /bid/client/projects` (`projects[]`). */
export type ClientProjectOption = {
  id: string | null;
  name: string;
  chunks: number;
  uploaded_at: string | null;
};

export type ChatTurn = {
  question: string;
  answer: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatTurn[];
  createdAt: string;
  updatedAt: string;
};

/** Entry from `GET /bid/sessions` (`sessions[]`). */
export type BidSessionSummary = {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

/** Message from `GET /bid/sessions/{session_id}` (`messages[]`). */
export type BidSessionApiMessage = {
  role: string;
  content: string;
  ts?: string;
};

/** Response from `GET /bid/sessions/{session_id}`. */
export type BidSessionDetail = {
  job_id?: string;
  session_id: string;
  created_at?: string;
  updated_at?: string;
  title?: string;
  messages: BidSessionApiMessage[];
};

export type DraftRecord = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type FilterPresetId = "high" | "full" | "framework" | "custom";
