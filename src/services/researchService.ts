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

export type QueryResultOutputs = {
  query?: string | null;
  refined_answer?: string | null;
  combined_answer?: string | null;
  contexts?: unknown;
};

/** Inline POST /query-neo4j shape used when updating the thread (no GET /results). */
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

// --- GET /chat-sessions/{job_id} ---

export type ChatSessionListEntry = {
  session_id: string;
  title: string;
  message_count: number;
};

export type ChatSessionsResponse = {
  status?: string;
  job_id?: string;
  sessions?: ChatSessionListEntry[];
};

const inFlightChatSessions = new Map<string, Promise<ChatSessionsResponse>>();

export async function fetchChatSessions(
  jobId: string
): Promise<ChatSessionsResponse> {
  const id = jobId.trim();
  if (!id) {
    return Promise.reject(new Error("fetchChatSessions: jobId is required"));
  }
  const existing = inFlightChatSessions.get(id);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const config: ResearchRequestConfig = { skipGlobalLoader: true };
      const { data } = await apiClient.get<ChatSessionsResponse>(
        `/chat-sessions/${encodeURIComponent(id)}`,
        config
      );
      return data;
    } catch (e) {
      console.log("fetchChatSessions failed", e);
      return { status: "error", sessions: [] as ChatSessionListEntry[] };
    } finally {
      inFlightChatSessions.delete(id);
    }
  })();

  inFlightChatSessions.set(id, pending);
  return pending;
}

// --- GET /chat-history/{job_id}/{session_id} ---

export type ChatHistoryTurn = {
  query: string;
  refined_answer: string;
  contexts?: unknown;
};

function pickString(
  row: Record<string, unknown>,
  keys: string[]
): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Normalizes chat-history JSON (shape may vary) into ordered user/assistant turns.
 */
export function normalizeChatHistoryPayload(data: unknown): ChatHistoryTurn[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    const fromArr = (() => {
      const turns: ChatHistoryTurn[] = [];
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const q = pickString(row, ["query", "user_message", "question"]);
        const combined = pickString(row, ["combined_answer"]);
        const refined = pickString(row, [
          "refined_answer",
          "answer",
          "response",
          "content",
        ]);
        const a = combined || refined;
        if (q || a) {
          const t: ChatHistoryTurn = { query: q, refined_answer: a };
          if ("contexts" in row) t.contexts = row.contexts;
          turns.push(t);
        }
      }
      return turns.length ? turns : null;
    })();
    if (fromArr) return fromArr;
    return [];
  }
  if (typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  if (root.data != null && typeof root.data === "object") {
    const nested = normalizeChatHistoryPayload(root.data);
    if (nested.length) return nested;
  }

  const tryArray = (arr: unknown): ChatHistoryTurn[] | null => {
    if (!Array.isArray(arr)) return null;
    const turns: ChatHistoryTurn[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const q = pickString(row, [
        "query",
        "user_message",
        "question",
        "prompt",
        "user",
      ]);
      const combined = pickString(row, ["combined_answer"]);
      const refined = pickString(row, [
        "refined_answer",
        "answer",
        "response",
        "assistant_message",
        "assistant",
        "content",
      ]);
      const a = combined || refined;
      if (q || a) {
        const t: ChatHistoryTurn = {
          query: q,
          refined_answer: a,
        };
        if ("contexts" in row) t.contexts = row.contexts;
        turns.push(t);
      }
    }
    return turns.length ? turns : null;
  };

  for (const key of ["messages", "history", "turns", "interactions", "chat"]) {
    const got = tryArray(root[key]);
    if (got && got.length) return got;
  }

  if (Array.isArray(root.messages)) {
    const turns: ChatHistoryTurn[] = [];
    let pendingUser = "";
    for (const m of root.messages) {
      if (!m || typeof m !== "object") continue;
      const row = m as Record<string, unknown>;
      const role =
        typeof row.role === "string" ? row.role.toLowerCase() : "";
      const content = pickString(row, ["content", "message", "text"]);
      if (role === "user" || role === "human") {
        pendingUser = content;
      } else if (
        role === "assistant" ||
        role === "ai" ||
        role === "bot" ||
        role === "model"
      ) {
        const t: ChatHistoryTurn = {
          query: pendingUser,
          refined_answer: content,
        };
        if ("contexts" in row) t.contexts = row.contexts;
        turns.push(t);
        pendingUser = "";
      }
    }
    if (turns.length) return turns;
  }

  return [];
}

const inFlightChatHistory = new Map<string, Promise<ChatHistoryTurn[]>>();

export async function fetchChatHistory(
  jobId: string,
  sessionId: string
): Promise<ChatHistoryTurn[]> {
  const jid = jobId.trim();
  const sid = sessionId.trim();
  if (!jid || !sid) return [];

  const key = `${jid}|${sid}`;
  const existing = inFlightChatHistory.get(key);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const config: ResearchRequestConfig = { skipGlobalLoader: true };
      const { data } = await apiClient.get<unknown>(
        `/chat-history/${encodeURIComponent(jid)}/${encodeURIComponent(sid)}`,
        config
      );
      return normalizeChatHistoryPayload(data);
    } catch (e) {
      console.log("fetchChatHistory failed", e);
      return [];
    } finally {
      inFlightChatHistory.delete(key);
    }
  })();

  inFlightChatHistory.set(key, pending);
  return pending;
}
