/**
 * API layer for bid-writing flows.
 *
 * Flask endpoints:
 * - GET  /bid/library/metadata      — Past Bid Library rows
 * - POST /bid/framework/{seq}       — Toggle framework status for a bid
 * - GET  /api/folders               — Qdrant folder counts for filters
 * - GET  /bid/client/projects       — Client doc ingestion projects
 * - DELETE /bid/client/projects/{project_id} — Remove a client project
 * - POST /bid/client/upload         — Upload client project ZIP (`multipart/form-data`, field `file`)
 * - GET  /bid/client/upload/progress/{job_id} — ZIP ingest progress
 * - GET  /bid/sessions              — Bid writing chat sessions (recent list)
 * - GET  /bid/sessions/{session_id} — Full session + messages
 * - DELETE /bid/sessions/{session_id} — Remove a bid writing session
 * - POST /bid/chat — Bid assistant (SSE)
 * - POST /bid/drafts — Save assistant message as draft
 * - GET  /bid/drafts — List saved drafts
 * - GET  /bid/drafts/{draft_id} — Draft detail (content)
 * - DELETE /bid/drafts/{draft_id} — Delete a saved draft
 * - POST /bid/export — Export chat message or draft (PDF / DOCX / TXT blob)
 * - POST /bid/upload_draft — Extract text from uploaded draft file (multipart `file`)
 * - POST /bid/tools/run — Draft editor AI tools (SSE)
 * - POST /bid/drafts/ask — Ask AI on a draft (SSE)
 */

import { getAuthToken } from "@/lib/authStorage";
import { apiClient } from "@/lib/apiClient";
import { parseContentDispositionFilename } from "@/lib/downloadFilename";
import type {
  BidChatRequestBody,
  BidDraftAskRequest,
  BidDraftCreateRequest,
  BidDraftDeleteResponse,
  BidDraftDetail,
  BidDraftRecord,
  BidDraftSummary,
  BidDraftsListApiResponse,
  BidDraftExportRequest,
  BidExportFormat,
  BidExportRequest,
  BidMessageExportRequest,
  BidSessionDetail,
  BidSessionSummary,
  BidToolRunRequest,
  BidUploadDraftResponse,
  ClientProjectDeleteResponse,
  ClientProjectOption,
  ClientZipUploadProgress,
  ClientZipUploadResponse,
  LibraryFolderOption,
  PastBid,
} from "./types";
import { MOCK_LIBRARY_FOLDERS } from "./mockBidFolders";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://91.199.227.82:31655").replace(
  /\/$/,
  ""
);

export async function fetchPastBids(): Promise<PastBid[]> {
  const response = await apiClient.get<PastBid[]>("/bid/library/metadata", {
    skipGlobalLoader: true,
  } as object);
  return Array.isArray(response.data) ? response.data : [];
}

export async function updateFrameworkStatus(
  seq: number,
  isFramework: boolean
): Promise<{ seq: number; is_framework: boolean }> {
  const response = await apiClient.post<{ seq: number; is_framework: boolean }>(
    `/bid/framework/${seq}`,
    { is_framework: isFramework },
    { skipGlobalLoader: true } as object
  );
  return response.data;
}

export async function fetchLibraryFolders(): Promise<LibraryFolderOption[]> {
  return MOCK_LIBRARY_FOLDERS;
}

type ClientProjectsApiResponse = {
  projects?: ClientProjectOption[];
  total?: number;
};

export async function fetchClientProjects(): Promise<ClientProjectOption[]> {
  const response = await apiClient.get<ClientProjectsApiResponse>("/bid/client/projects", {
    skipGlobalLoader: true,
  } as object);
  const projects = response.data?.projects;
  return Array.isArray(projects) ? projects : [];
}

/**
 * POST /bid/client/upload — multipart body, field name `file`.
 * Uses fetch so the default axios JSON Content-Type does not break multipart boundaries.
 */
export async function uploadClientProjectZip(
  file: File,
  options?: { signal?: AbortSignal }
): Promise<ClientZipUploadResponse> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/bid/client/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    signal: options?.signal,
  });

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await res.json()) as Record<string, unknown>;
        const msg =
          (typeof j.message === "string" && j.message) ||
          (typeof j.error === "string" && j.error) ||
          (typeof j.detail === "string" && j.detail);
        if (msg) detail = msg;
      } else {
        const t = await res.text();
        if (t.trim()) detail = t.slice(0, 500);
      }
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as ClientZipUploadResponse;
  if (typeof data.job_id !== "string" || !data.job_id) {
    throw new Error("Upload response missing job_id");
  }
  return data;
}

export async function fetchClientUploadProgress(jobId: string): Promise<ClientZipUploadProgress> {
  const response = await apiClient.get<ClientZipUploadProgress>(
    `/bid/client/upload/progress/${encodeURIComponent(jobId)}`,
    { skipGlobalLoader: true } as object
  );
  const data = response.data;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid upload progress response");
  }
  return data;
}

export async function deleteClientProject(projectId: string): Promise<ClientProjectDeleteResponse> {
  const response = await apiClient.delete<ClientProjectDeleteResponse>(
    `/bid/client/projects/${encodeURIComponent(projectId)}`,
    { skipGlobalLoader: true } as object
  );
  const data = response.data;
  if (data && typeof data === "object") return data;
  return {
    status: "deleted",
    project_id: projectId,
    project_name: "",
  };
}

type BidSessionsApiResponse = {
  sessions?: BidSessionSummary[];
};

export async function fetchBidSessions(): Promise<BidSessionSummary[]> {
  const response = await apiClient.get<BidSessionsApiResponse>("/bid/sessions", {
    skipGlobalLoader: true,
  } as object);
  const list = response.data?.sessions;
  return Array.isArray(list) ? list : [];
}

export async function fetchBidSession(sessionId: string): Promise<BidSessionDetail> {
  const response = await apiClient.get<BidSessionDetail>(
    `/bid/sessions/${encodeURIComponent(sessionId)}`,
    { skipGlobalLoader: true } as object
  );
  return response.data;
}

export async function deleteBidSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/bid/sessions/${encodeURIComponent(sessionId)}`, {
    skipGlobalLoader: true,
  } as object);
}

export async function createBidDraft(messageId: string): Promise<BidDraftRecord> {
  const body: BidDraftCreateRequest = { message_id: messageId };
  const response = await apiClient.post<BidDraftRecord>("/bid/drafts", body, {
    skipGlobalLoader: true,
  } as object);
  const data = response.data;
  if (!data?.id) {
    throw new Error("Invalid draft response");
  }
  return data;
}

type AxiosLikeHeaders = {
  get?: (name: string) => unknown;
  [key: string]: unknown;
};

function getResponseHeader(headers: AxiosLikeHeaders, name: string): string | undefined {
  if (typeof headers.get === "function") {
    const v = headers.get(name);
    if (typeof v === "string" && v) return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) {
      const val = headers[k];
      if (typeof val === "string") return val;
      if (Array.isArray(val) && typeof val[0] === "string") return val[0];
    }
  }
  return undefined;
}

async function blobLooksLikeJsonError(blob: Blob): Promise<boolean> {
  const ct = blob.type?.toLowerCase() ?? "";
  if (ct.includes("application/json")) return true;
  if (blob.size === 0 || blob.size > 65536) return false;
  try {
    const head = await blob.slice(0, 1).text();
    return head === "{";
  } catch {
    return false;
  }
}

async function messageFromJsonBlob(blob: Blob): Promise<string | null> {
  try {
    const text = await blob.text();
    const data = JSON.parse(text) as {
      message?: string;
      detail?: string | { msg?: string }[];
      error?: string;
    };
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
    if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail.trim();
    if (Array.isArray(data.detail)) {
      const parts = data.detail
        .map((d) => (typeof d === "string" ? d : d?.msg))
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
      if (parts.length > 0) return parts.join("; ");
    }
  } catch {
    // ignore
  }
  return null;
}

function fallbackMessageExportFilename(format: BidExportFormat, messageId: string): string {
  const safeId = messageId.replace(/[^\w-]+/g, "").slice(0, 12) || "export";
  return `bid-response-${safeId}.${format}`;
}

function fallbackDraftExportFilename(
  format: BidExportFormat,
  draftId: string,
  title?: string
): string {
  const slug =
    title
      ?.trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 48) ||
    draftId.replace(/[^\w-]+/g, "").slice(0, 12) ||
    "draft";
  return `${slug}.${format}`;
}

export type BidExportResult = {
  blob: Blob;
  filename: string;
};

async function postBidExport(
  body: BidMessageExportRequest | BidDraftExportRequest,
  fallbackFilename: string
): Promise<BidExportResult> {
  const response = await apiClient.post<Blob>("/bid/export", body, {
    skipGlobalLoader: true,
    responseType: "blob",
    headers: { Accept: "*/*" },
  } as object);

  const blob = response.data instanceof Blob ? response.data : new Blob();
  if (blob.size === 0) {
    throw new Error("Export returned an empty file");
  }

  if (await blobLooksLikeJsonError(blob)) {
    const apiMsg = await messageFromJsonBlob(blob);
    throw new Error(apiMsg ?? "Export failed");
  }

  const contentDisposition = getResponseHeader(
    response.headers as AxiosLikeHeaders,
    "content-disposition"
  );
  const filename =
    parseContentDispositionFilename(contentDisposition) ?? fallbackFilename;

  return { blob, filename };
}

/** POST /bid/export — chat message (PDF / DOCX / TXT blob). */
export async function exportBidMessage(
  body: BidMessageExportRequest | BidExportRequest
): Promise<BidExportResult> {
  return postBidExport(
    body,
    fallbackMessageExportFilename(body.format, body.message_id)
  );
}

/** POST /bid/export — saved draft (PDF / DOCX / TXT blob). */
export async function exportBidDraft(
  body: BidDraftExportRequest,
  options?: { title?: string }
): Promise<BidExportResult> {
  return postBidExport(
    body,
    fallbackDraftExportFilename(body.format, body.draft_id, options?.title)
  );
}

/** Best-effort error message from failed export requests. */
export async function messageFromBidExportError(err: unknown): Promise<string> {
  let msg = "Could not export";
  if (err instanceof Error && err.message.trim()) {
    msg = err.message.trim();
  }
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: unknown } }).response;
    const data = res?.data;
    if (data instanceof Blob) {
      const fromApi = await messageFromJsonBlob(data);
      if (fromApi) return fromApi;
    } else if (data && typeof data === "object") {
      const d = data as { message?: string; detail?: string; error?: string };
      const fromApi = d.message || d.detail || d.error;
      if (typeof fromApi === "string" && fromApi.trim()) return fromApi.trim();
    }
  }
  return msg;
}

/** Trigger a browser download for an exported blob. */
export function triggerBidExportDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type BidDraftsListResult = {
  drafts: BidDraftSummary[];
  total: number;
};

export async function fetchBidDrafts(): Promise<BidDraftsListResult> {
  const response = await apiClient.get<BidDraftsListApiResponse>("/bid/drafts", {
    skipGlobalLoader: true,
  } as object);
  const list = response.data?.drafts;
  const drafts = Array.isArray(list) ? list : [];
  const totalRaw = response.data?.total;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw)
      ? totalRaw
      : drafts.length;
  return { drafts, total };
}

export async function fetchBidDraft(draftId: string): Promise<BidDraftDetail> {
  const response = await apiClient.get<BidDraftDetail>(
    `/bid/drafts/${encodeURIComponent(draftId)}`,
    { skipGlobalLoader: true } as object
  );
  const data = response.data;
  if (!data?.id) {
    throw new Error("Invalid draft response");
  }
  return data;
}

/**
 * POST /bid/upload_draft — multipart body, field name `file`.
 * PDF, DOCX, DOC, and TXT supported.
 */
export async function uploadBidDraft(
  file: File,
  options?: { signal?: AbortSignal }
): Promise<BidUploadDraftResponse> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/bid/upload_draft`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    signal: options?.signal,
  });

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await res.json()) as Record<string, unknown>;
        const msg =
          (typeof j.message === "string" && j.message) ||
          (typeof j.error === "string" && j.error) ||
          (typeof j.detail === "string" && j.detail);
        if (msg) detail = msg;
      } else {
        const t = await res.text();
        if (t.trim()) detail = t.slice(0, 500);
      }
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as BidUploadDraftResponse;
  if (typeof data.text !== "string") {
    throw new Error("Upload response missing text");
  }
  if (typeof data.filename !== "string" || !data.filename.trim()) {
    throw new Error("Upload response missing filename");
  }
  return data;
}

export async function deleteBidDraft(draftId: string): Promise<BidDraftDeleteResponse> {
  const response = await apiClient.delete<BidDraftDeleteResponse>(
    `/bid/drafts/${encodeURIComponent(draftId)}`,
    { skipGlobalLoader: true } as object
  );
  const data = response.data;
  if (!data?.id) {
    throw new Error("Invalid delete draft response");
  }
  return data;
}

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** SSE `data:` lines may use any casing; optional space after colon (RFC 8895). */
function extractSseDataPayload(line: string): string | null {
  const trimmed = stripBom(line.replace(/\r$/, "").trim());
  const m = /^data:\s*/i.exec(trimmed);
  if (!m) return null;
  const payload = trimmed.slice(m[0].length).trim();
  if (!payload || payload === "[DONE]") return null;
  return payload;
}

function parseJsonPayload(payload: string): unknown | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed) as unknown;
      } catch {
        return parsed;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseSseDataLine(line: string): unknown | null {
  const payload = extractSseDataPayload(line);
  if (payload === null) return null;
  return parseJsonPayload(payload);
}

function statusTextFromPayload(o: Record<string, unknown>): string {
  const pick = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return "";
  };
  const candidates = [
    o.message,
    o.msg,
    o.status_message,
    o.content,
    o.text,
    o.description,
  ];
  for (const c of candidates) {
    const s = pick(c).trim();
    if (s.length > 0) return s;
  }
  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    for (const c of [n.message, n.msg, n.content, n.text, n.description]) {
      const s = pick(c).trim();
      if (s.length > 0) return s;
    }
  }
  return "";
}

function answerTokenFromPayload(o: Record<string, unknown>): string {
  const tok = o.token;
  if (typeof tok === "string") return tok;
  const c = o.content;
  if (typeof c === "string") return c;
  const t = o.text;
  if (typeof t === "string") return t;
  return "";
}

export type StreamBidChatHandlers = {
  onSession?: (sessionId: string, messageId?: string) => void;
  onStatus?: (message: string) => void;
  onAnswerToken?: (token: string) => void;
  onDone?: (payload: { sources?: unknown; web_sources?: unknown; message_id?: string }) => void;
  onError?: (message: string) => void;
};

function sseEventKind(typ: unknown): string {
  return String(typ ?? "")
    .trim()
    .toLowerCase();
}

function sseErrorMessage(o: Record<string, unknown>): string {
  return (
    (typeof o.message === "string" && o.message) ||
    (typeof o.error === "string" && o.error) ||
    "Request failed"
  );
}

function processBidChatSseObject(
  o: Record<string, unknown>,
  handlers: StreamBidChatHandlers,
  options?: { throwOnError?: boolean }
): void {
  const kind = sseEventKind(o.type);
  if (kind === "session") {
    const sid = o.session_id;
    if (typeof sid === "string" && sid.length > 0) {
      const mid = o.message_id;
      handlers.onSession?.(sid, typeof mid === "string" ? mid : undefined);
    }
    return;
  }
  if (kind === "status") {
    const msg = statusTextFromPayload(o);
    if (msg.length > 0) handlers.onStatus?.(msg);
    return;
  }
  if (kind === "answer") {
    const piece = answerTokenFromPayload(o);
    if (piece.length > 0) handlers.onAnswerToken?.(piece);
    return;
  }
  if (kind === "done") {
    const mid = o.message_id;
    handlers.onDone?.({
      sources: o.sources,
      web_sources: o.web_sources,
      message_id: typeof mid === "string" ? mid : undefined,
    });
    return;
  }
  if (kind === "error") {
    const msg = sseErrorMessage(o);
    handlers.onError?.(msg);
    if (options?.throwOnError) {
      throw new Error(msg);
    }
  }
}

async function postBidSse(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return res;
}

async function readSseErrorDetail(res: Response, fallback: string): Promise<string> {
  let detail = fallback;
  const ct = res.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const j = (await res.json()) as Record<string, unknown>;
      const msg =
        (typeof j.message === "string" && j.message) ||
        (typeof j.error === "string" && j.error) ||
        (typeof j.detail === "string" && j.detail);
      if (msg) detail = msg;
    } else {
      const t = await res.text();
      if (t.trim()) detail = t.slice(0, 500);
    }
  } catch {
    // keep default detail
  }
  return detail;
}

export type StreamBidToolHandlers = {
  onToken?: (token: string) => void;
  onDone?: (payload?: { content?: string }) => void;
  onError?: (message: string) => void;
};

function toolTokenFromPayload(o: Record<string, unknown>): string {
  const tok = o.token;
  if (typeof tok === "string") return tok;
  const t = o.text;
  if (typeof t === "string") return t;
  const c = o.content;
  if (typeof c === "string") return c;
  return "";
}

async function consumeSseResponse(
  res: Response,
  processRawLine: (rawLine: string) => void
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body from stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        processRawLine(line);
      }
    }
    if (buffer.trim().length > 0) {
      processRawLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * POST /bid/tools/run with Server-Sent Events (`type: token` | `type: done`).
 */
export async function streamBidToolRun(
  body: BidToolRunRequest,
  handlers: StreamBidToolHandlers,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}/bid/tools/run`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!res.ok) {
    let detail = `Tool request failed (${res.status})`;
    const ct = res.headers.get("content-type") ?? "";
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as Record<string, unknown>;
        const msg =
          (typeof j.message === "string" && j.message) ||
          (typeof j.error === "string" && j.error) ||
          (typeof j.detail === "string" && j.detail);
        if (msg) detail = msg;
      } else {
        const t = await res.text();
        if (t.trim()) detail = t.slice(0, 500);
      }
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }

  function eventKind(typ: unknown): string {
    return String(typ ?? "")
      .trim()
      .toLowerCase();
  }

  await consumeSseResponse(res, (rawLine) => {
    const parsed = parseSseDataLine(rawLine);
    if (parsed === null) return;
    if (typeof parsed !== "object" || Array.isArray(parsed)) return;
    const o = parsed as Record<string, unknown>;
    const kind = eventKind(o.type);
    if (kind === "token") {
      const piece = toolTokenFromPayload(o);
      if (piece.length > 0) handlers.onToken?.(piece);
      return;
    }
    if (kind === "done") {
      const final =
        (typeof o.content === "string" && o.content) ||
        (typeof o.text === "string" && o.text) ||
        undefined;
      handlers.onDone?.(final ? { content: final } : undefined);
      return;
    }
    if (kind === "error") {
      const msg =
        (typeof o.message === "string" && o.message) ||
        (typeof o.error === "string" && o.error) ||
        "Tool failed";
      handlers.onError?.(msg);
    }
  });
}

/**
 * POST /bid/chat with Server-Sent Events (`data: {json}` lines).
 * Uses fetch + ReadableStream so the global axios loader is not triggered.
 */
export async function streamBidChat(
  body: BidChatRequestBody,
  handlers: StreamBidChatHandlers,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const res = await postBidSse("/bid/chat", body, options);
  if (!res.ok) {
    throw new Error(await readSseErrorDetail(res, `Chat request failed (${res.status})`));
  }

  await consumeSseResponse(res, (rawLine) => {
    const parsed = parseSseDataLine(rawLine);
    if (parsed === null) return;
    if (typeof parsed !== "object" || Array.isArray(parsed)) return;
    processBidChatSseObject(parsed as Record<string, unknown>, handlers);
  });
}

/**
 * POST /bid/drafts/ask — Ask AI on draft content (SSE; same event types as chat).
 */
export async function streamBidDraftAsk(
  body: BidDraftAskRequest,
  handlers: StreamBidChatHandlers,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const payload: BidDraftAskRequest = {
    question: body.question,
    draft_id: body.draft_id,
    ...(body.selected_text?.trim() ? { selected_text: body.selected_text.trim() } : {}),
  };

  const res = await postBidSse("/bid/drafts/ask", payload, options);
  if (!res.ok) {
    throw new Error(await readSseErrorDetail(res, `Ask AI request failed (${res.status})`));
  }

  await consumeSseResponse(res, (rawLine) => {
    const parsed = parseSseDataLine(rawLine);
    if (parsed === null) return;
    if (typeof parsed !== "object" || Array.isArray(parsed)) return;
    processBidChatSseObject(parsed as Record<string, unknown>, handlers, {
      throwOnError: true,
    });
  });
}
