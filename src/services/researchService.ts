import { apiClient } from "@/lib/apiClient";
import type { AxiosRequestConfig } from "axios";

type ResearchRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type QueryNeo4jPayload = {
  /** Project job_id (first message) or research job_id (follow-ups). */
  job_id: string;
  /** Empty on first message; server session id on follow-ups. */
  session_id?: string;
  query: string;
  show_sources: boolean;
  show_combined: boolean;
  database: string;
};

/** Single turn returned inline from `POST /query-neo4j` (no polling). */
export type QueryNeo4jInteraction = {
  query?: string | null;
  refined_answer?: string | null;
  combined_answer?: string | null;
  contexts?: unknown;
};

export type QueryNeo4jResponse = {
  job_id: string;
  status: string;
  session_id?: string;
  interaction?: QueryNeo4jInteraction;
};

/** One turn inside `outputs.chat_sessions[sessionId]`. */
export type ChatSessionTurn = {
  query?: string | null;
  refined_answer?: string | null;
  combined_answer?: string | null;
  contexts?: unknown;
};

export type QueryResultOutputs = {
  query?: string | null;
  refined_answer?: string | null;
  combined_answer?: string | null;
  contexts?: unknown;
  /** Map of Neo4j session UUID → ordered conversation turns. */
  chat_sessions?: Record<string, ChatSessionTurn[]>;
};

export type QueryResultResponse = {
  status: string;
  outputs?: QueryResultOutputs;
  error?: string | null;
  detail?: string;
};

/** Prefer combined answer for display when present. */
export function displayAnswerFromOutputs(
  outputs: QueryResultOutputs | undefined
): string {
  if (!outputs) return "";
  const c = outputs.combined_answer?.trim();
  if (c) return c;
  return outputs.refined_answer?.trim() ?? "";
}

export async function submitResearchQuery(
  payload: QueryNeo4jPayload
): Promise<QueryNeo4jResponse> {
  const config: ResearchRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.post<QueryNeo4jResponse>(
    "/query-neo4j",
    payload,
    config
  );
  return data as QueryNeo4jResponse;
}

export async function fetchResearchQueryResult(
  jobId: string
): Promise<QueryResultResponse> {
  const config: ResearchRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.get<QueryResultResponse>(
    `/results/${jobId}`,
    config
  );
  return data as QueryResultResponse;
}

