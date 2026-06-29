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

/** Response from `DELETE /bid/client/projects/{project_id}`. */
export type ClientProjectDeleteResponse = {
  status: string;
  project_id: string;
  project_name: string;
  chunks_deleted?: number;
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
  message_id?: string;
  ts?: string;
  sources?: Record<string, string> | null;
  web_sources?: unknown[] | null;
};

/** Request body for `POST /bid/drafts`. */
export type BidDraftCreateRequest = {
  message_id: string;
};

/** Supported formats for `POST /bid/export`. */
export type BidExportFormat = "pdf" | "docx" | "txt";

/** Chat export: `POST /bid/export` with `message_id`. */
export type BidMessageExportRequest = {
  format: BidExportFormat;
  message_id: string;
};

/** Draft editor export: `POST /bid/export` with `draft_id`. */
export type BidDraftExportRequest = {
  format: BidExportFormat;
  draft_id: string;
};

/** @deprecated Use `BidMessageExportRequest` — kept for existing call sites. */
export type BidExportRequest = BidMessageExportRequest;

/** Response from `POST /bid/drafts`. */
export type BidDraftRecord = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

/** Summary from `GET /bid/drafts` (`drafts[]`). */
export type BidDraftSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
};

/** Response shape for `GET /bid/drafts`. */
export type BidDraftsListApiResponse = {
  drafts?: BidDraftSummary[];
  total?: number;
};

/** Response from `DELETE /bid/drafts/{draft_id}`. */
export type BidDraftDeleteResponse = {
  status: string;
  id: string;
};

/** Tool ids accepted by `POST /bid/tools/run`. */
export type BidToolApiId =
  | "expand"
  | "shorten"
  | "formal"
  | "rephrase"
  | "spell_check"
  | "summarize";

/** Request body for `POST /bid/tools/run`. */
export type BidToolRunRequest = {
  tool: BidToolApiId;
  text: string;
  draft_id: string;
  target_words?: number;
};

/** Response from `POST /bid/upload_draft`. */
export type BidUploadDraftResponse = {
  text: string;
  filename: string;
  /** Present when the server creates/persists a draft record. */
  id?: string;
  title?: string;
};

/** Response from `POST /bid/library/ingest`. */
export type BidLibraryIngestResponse = {
  job_id: string;
};

/** Response from `GET /bid/library/jobs/{job_id}`. */
export type BidLibraryJobStatus = {
  status: string;
  error?: string;
};

/** Request body for `POST /bid/library/score/{seq}` — question name → score. */
export type BidLibraryScoreRequest = Record<string, number>;

/** Response from `POST /bid/library/score/{seq}`. */
export type BidLibraryScoreResponse = {
  seq: number;
  new_average_score: number;
  updated: boolean;
  message: string;
};

/** Response from `PUT /bid/drafts/{draft_id}`. */
export type BidDraftUpdateResponse = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

/** Detail from `GET /bid/drafts/{draft_id}`. */
export type BidDraftDetail = BidDraftRecord & {
  content?: string;
  text?: string;
  sources?: Record<string, string>;
  web_sources?: unknown[];
};

export type DraftRecord = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  sources?: Record<string, string> | null;
  web_sources?: unknown[] | null;
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

/** POST /bid/drafts/ask — Ask AI on a draft (SSE, same events as `/bid/chat`). */
export type BidDraftAskRequest = {
  question: string;
  draft_id: string;
  selected_text?: string;
};
