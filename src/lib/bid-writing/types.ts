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

export type ClientProjectOption = {
  name: string;
  chunks: number;
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

export type DraftRecord = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type FilterPresetId = "high" | "full" | "custom";
