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

/** Response from `POST /bid/client/upload`. */
export type ClientZipUploadResponse = {
  job_id: string;
  project_id: string;
  project_name: string;
  status?: string;
};

/** Phases from `GET /bid/client/upload/progress/{job_id}`. */
export type ClientZipUploadPhase = "queued" | "extracting" | "ingesting" | "done" | "error" | string;

/** Progress payload from `GET /bid/client/upload/progress/{job_id}`. */
export type ClientZipUploadProgress = {
  phase: ClientZipUploadPhase;
  job_id?: string;
  project_id?: string;
  project_name?: string;
  done?: number;
  total?: number;
  chunks_uploaded?: number;
  error?: string;
  ingest_error?: string;
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

/** POST /bid/chat request (fields optional per filter / first-turn rules). */
export type BidChatRequestBody = {
  client_project_id: string;
  filter: FilterPresetId;
  question: string;
  use_web: boolean;
  allowed_seq?: number[];
  session_id?: string | null;
};
