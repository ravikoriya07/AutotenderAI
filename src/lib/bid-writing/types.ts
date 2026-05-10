/** Aligns with Flask `/api/library_metadata` entries (subset used in UI). */
export type PastBid = {
  seq: number;
  project: string;
  outcome: string;
  bid_type: string;
  submitted: string;
  quality_score_pct: number | null;
  quality_tier: "high_quality" | "medium_quality" | "other" | string;
  group: "won" | "lost" | "other";
  outcome_notes?: string;
  questions?: string[];
  price_quality_split?: string;
  value_gbp?: number;
  qdrant_project_name: string;
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
