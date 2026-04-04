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

export type QueryNeo4jResponse = {
  job_id: string;
  status: string;
  session_id?: string;
};

export type QueryStatusResponse = {
  status: string;
  outputs?: {
    refined_answer?: string | null;
    [key: string]: unknown;
  };
  error?: string | null;
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

export async function fetchResearchQueryStatus(
  jobId: string
): Promise<QueryStatusResponse> {
  const config: ResearchRequestConfig = { skipGlobalLoader: true };
  const { data } = await apiClient.get<QueryStatusResponse>(
    `/status/${jobId}`,
    config
  );
  return data as QueryStatusResponse;
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

