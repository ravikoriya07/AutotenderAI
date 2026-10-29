import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";
import { getAuthToken } from "@/lib/authStorage";
import { parseContentDispositionFilename } from "@/lib/downloadFilename";
import { assertSowWorkbookTemplateContent } from "@/lib/schedule-of-works/validateSowWorkbookTemplate";

type SowRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

export type SowFoundFile = {
  file_name: string;
  file_path: string;
};

export type SowFindResponse = {
  status: string;
  job_id: string;
  found_files?: SowFoundFile[];
  project_name?: string;
  client?: string;
};

export type SowTradeSplitMethod = "nbs" | "headings" | "ai";

export type SowTradeSplitOptions = {
  method: SowTradeSplitMethod;
  inclPrelims: boolean;
  inclBwic: boolean;
};

export const SOW_TRADE_SPLIT_DEFAULTS: SowTradeSplitOptions = {
  method: "ai",
  inclPrelims: true,
  inclBwic: true,
};

export type SowSplitSupportingFiles = {
  specifications?: File[];
  drawings?: File[];
  /** Optional revised schedule for comparison (POST split only). */
  revised_file?: File;
};

export type SowRevisionDiffItem = {
  desc?: string;
  qty?: number | string;
  unit?: string;
};

export type SowRevisionDiffChange = {
  ref?: string;
  status?: string;
  category?: string;
  change_type?: string;
  change_summary?: string;
  old_item?: SowRevisionDiffItem;
  new_item?: SowRevisionDiffItem;
};

export type SowRevisionDiff = {
  summary?: {
    new_items?: number;
    amended_items?: number;
    deleted_items?: number;
    unchanged_items?: number;
  };
  changes?: SowRevisionDiffChange[];
  revision_ref?: string;
  revision_title?: string;
  revision_date?: string;
};

export type SowSplitExistingRequest = SowTradeSplitOptions &
  SowSplitSupportingFiles & {
    type: "existing";
    file_path: string;
    /** Checked sheet indexes from POST /sow/sheets, sent once as a JSON array. */
    sheet_indexes: number[];
  };

export type SowSplitUploadRequest = SowTradeSplitOptions &
  SowSplitSupportingFiles & {
    type: "upload";
    file: File;
    /** Checked sheet indexes from POST /sow/sheets, sent once as a JSON array. */
    sheet_indexes: number[];
  };

export type SowSplitRequest = SowSplitExistingRequest | SowSplitUploadRequest;

function sowErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const data = body as {
    message?: unknown;
    error?: unknown;
    detail?: unknown;
  };
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail.trim();
  }
  if (Array.isArray(data.detail)) {
    const parts = data.detail
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "msg" in entry) {
          const msg = (entry as { msg?: unknown }).msg;
          return typeof msg === "string" ? msg : "";
        }
        return "";
      })
      .filter((value) => value.trim().length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  return null;
}

function appendOptionalSplitFiles(
  formData: FormData,
  files: File[] | undefined,
  fieldName: string
): void {
  if (!files?.length) return;
  for (const file of files) {
    formData.append(fieldName, file);
  }
}

async function parseSowApiError(
  res: Response,
  fallback?: string
): Promise<string> {
  let detail = fallback ?? `Trade split failed (${res.status})`;
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const message = sowErrorMessage(await res.json());
      if (message) detail = message;
    } else {
      const text = await res.text();
      if (text.trim()) detail = text.slice(0, 500);
    }
  } catch {
    /* keep default detail */
  }
  return detail;
}

async function sowBlobLooksLikeJsonError(blob: Blob): Promise<boolean> {
  const contentType = blob.type?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) return true;
  if (blob.size === 0 || blob.size > 65536) return false;
  try {
    const head = await blob.slice(0, 1).text();
    return head === "{";
  } catch {
    return false;
  }
}

async function messageFromSowJsonBlob(blob: Blob): Promise<string | null> {
  try {
    const text = await blob.text();
    return sowErrorMessage(JSON.parse(text));
  } catch {
    /* ignore */
  }
  return null;
}

export const SOW_WORKBOOK_INCLUDE_KEYS = [
  "wb-include-summary",
  "wb-include-sow",
  "wb-include-comps",
  "wb-include-psums",
  "wb-include-sc",
  "wb-include-links",
] as const;

export type SowWorkbookIncludeKey = (typeof SOW_WORKBOOK_INCLUDE_KEYS)[number];

export type SowWorkbookRequest = {
  /** Checked include keys; omit or leave empty to include all sections server-side */
  include?: SowWorkbookIncludeKey[];
  template?: File;
};

export type SowWorkbookResult = {
  blob: Blob;
  filename: string;
};

export type SowDownloadType = "trade" | "all" | "shared" | "schedule";

export type SowDownloadRequest = {
  type: SowDownloadType;
  /** Catalogue trade id, or `overarching:Name` for a pricing document. */
  tradeId?: string;
};

export type SowFileDownloadResult = SowWorkbookResult;

function fallbackSowDownloadFilename(
  type: SowDownloadType,
  tradeId?: string
): string {
  switch (type) {
    case "all":
      return "Trade_Pricing_Documents.zip";
    case "shared":
      return "Shared_Items_Schedule.xlsx";
    case "schedule":
      return "Full_Schedule.xlsx";
    case "trade":
    default: {
      const rawId = tradeId?.trim() || "";
      const source = rawId.toLowerCase().startsWith("overarching:")
        ? rawId.slice("overarching:".length)
        : rawId;
      const safe =
        source.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "_") ||
        "Trade";
      return `${safe}_Pricing.xlsx`;
    }
  }
}

async function parseSowFileResponse(
  res: Response,
  fallbackFilename: string,
  errorLabel: string
): Promise<SowFileDownloadResult> {
  if (!res.ok) {
    throw new Error(await parseSowApiError(res));
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error(`${errorLabel}: file is empty.`);
  }

  if (await sowBlobLooksLikeJsonError(blob)) {
    const apiMessage = await messageFromSowJsonBlob(blob);
    throw new Error(apiMessage ?? errorLabel);
  }

  const contentDisposition = res.headers.get("content-disposition");
  const filename =
    parseContentDispositionFilename(contentDisposition) ?? fallbackFilename;

  return { blob, filename };
}

export type SowSplitResponse = {
  status: string;
  tabs?: {
    trade_documents?: SowTradeDocument[];
    /** Trade Documents tab. Grouped by overarching name, plus catalogue rows set to N/A. */
    pricing_documents?: SowTradeDocument[];
    full_schedule?: SowFullScheduleItem[] | Record<string, SowFullScheduleItem[]>;
    shared_items?: SowSharedItem[];
    revision_diff?: SowRevisionDiff;
  };
};

export type SowTradeDocument = {
  id: string;
  label: string;
  /** NBS work-section codes (API may send `code` instead). */
  nbs?: string[];
  code?: string[];
  group?: string | null;
  section?: string;
  lineCount?: number;
  items?: SowTradeLineItem[];
  /** Names for the Full Schedule overarching dropdown. No ids. */
  overarching_trades?: string[];
  /** Set on a pricing document when the Excel id differs from `id`. */
  trade_id?: string;
  download_id?: string;
  overarching?: string;
  unallocated?: boolean;
};

export type SowTradeLineItem = {
  ref: string;
  desc: string;
  qty?: number | string;
  unit?: string;
  section?: string;
  note?: string;
};

export type SowFullScheduleItem = {
  item_key?: string;
  ref: string;
  desc: string;
  qty?: number | string;
  unit?: string;
  section?: string;
  source_sheet?: string;
  source_row?: number;
  tradeId?: string;
  tradeLabel?: string;
  overarching_trade?: string;
  match_confidence?: string;
  /** Shared-items card id when the row is ticked "Shared"; null when it is not. */
  shared_item_id?: string | null;
};

export type SowSharedItemTrade = {
  trade_id?: string;
  trade: string;
  nbs?: string;
  lead?: boolean;
  scope?: string;
  note?: string;
};

export type SowSharedItem = {
  id: string;
  ref: string;
  desc: string;
  version?: number;
  is_shared?: boolean;
  trades?: SowSharedItemTrade[];
};

/** Unwraps GET/POST split payloads that may nest tabs under data/result/etc. */
export function normalizeSowSplitResponse(
  raw: unknown
): SowSplitResponse | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return normalizeSowSplitResponse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;

  if (record.tabs && typeof record.tabs === "object") {
    return {
      status: String(record.status ?? "success"),
      tabs: record.tabs as SowSplitResponse["tabs"],
    };
  }

  for (const key of ["data", "result", "split_result", "payload"] as const) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const unwrapped = normalizeSowSplitResponse(nested);
      if (unwrapped) return unwrapped;
    }
  }

  if (Array.isArray(record.trade_documents)) {
    return {
      status: String(record.status ?? "success"),
      tabs: {
        trade_documents: record.trade_documents as SowTradeDocument[],
        pricing_documents: record.pricing_documents as SowTradeDocument[] | undefined,
        full_schedule: record.full_schedule as SowFullScheduleItem[] | undefined,
        shared_items: record.shared_items as SowSharedItem[] | undefined,
      },
    };
  }

  return null;
}

export function hasSavedSowSplitData(
  response: SowSplitResponse | null | undefined
): boolean {
  if (!response) return false;
  const trades = response.tabs?.trade_documents;
  const pricing = response.tabs?.pricing_documents;
  return (
    (Array.isArray(trades) && trades.length > 0) ||
    (Array.isArray(pricing) && pricing.length > 0)
  );
}

/**
 * Submits a schedule-of-works trade split job.
 * POST /sow/split/:job_id (multipart/form-data)
 */
export async function submitSowSplit(
  jobId: string,
  request: SowSplitRequest,
  signal?: AbortSignal
): Promise<SowSplitResponse> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }

  const formData = new FormData();
  formData.append("type", request.type);
  formData.append("method", request.method);
  formData.append("inclPrelims", String(request.inclPrelims));
  formData.append("inclBwic", String(request.inclBwic));

  const sheetIndexes = request.sheet_indexes
    .map((index) => Number(index))
    .filter((index) => Number.isInteger(index) && index >= 0);
  if (!sheetIndexes.length) {
    throw new Error("Select at least one sheet.");
  }
  formData.append("sheet_indexes", JSON.stringify(sheetIndexes));

  if (request.type === "existing") {
    const filePath = request.file_path.trim();
    if (!filePath) {
      throw new Error("Selected EMS file path is missing.");
    }
    formData.append("file_path", filePath);
  } else {
    formData.append("file", request.file);
  }

  appendOptionalSplitFiles(formData, request.specifications, "specifications");
  appendOptionalSplitFiles(formData, request.drawings, "drawings");
  if (request.revised_file) {
    formData.append("revised_file", request.revised_file);
  }

  const token = getAuthToken();
  const res = await fetch(
    `${API_BASE_URL}/sow/split/${encodeURIComponent(trimmed)}`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(await parseSowApiError(res));
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const raw: unknown = await res.json();
    const normalized = normalizeSowSplitResponse(raw);
    if (normalized) return normalized;
    if (raw && typeof raw === "object" && "status" in raw) {
      return raw as SowSplitResponse;
    }
  }

  return { status: "success" };
}

export type SowAllocationChanges = Record<string, string>;

/** item_key -> true to tick a row "Shared", false to untick it. */
export type SowSharedChanges = Record<string, boolean>;

export type SowAllocationsRequest = {
  changes?: SowAllocationChanges;
  overarching_changes?: SowAllocationChanges;
  shared_changes?: SowSharedChanges;
};

export type SowAllocationsResponse = {
  status: string;
  moved?: string[];
  overarching_updated?: string[];
  shared_changed?: string[];
  not_found?: string[];
  trade_line_counts?: Record<string, number>;
  active_shared_item_count?: number;
  tabs?: SowSplitResponse["tabs"];
};

function nonemptyAllocationMap(
  map: SowAllocationChanges | undefined
): SowAllocationChanges | null {
  if (!map) return null;
  const entries = Object.entries(map).filter(
    ([, value]) => String(value ?? "").trim() !== ""
  );
  if (!entries.length) return null;
  return Object.fromEntries(entries);
}

function nonemptySharedMap(
  map: SowSharedChanges | undefined
): SowSharedChanges | null {
  if (!map) return null;
  const entries = Object.entries(map).filter(
    ([key, value]) => key.trim() !== "" && typeof value === "boolean"
  );
  if (!entries.length) return null;
  return Object.fromEntries(entries);
}

/**
 * Persists Full Schedule trade re-allocations and "Shared" ticks.
 * PATCH /sow/allocations/:job_id (application/json)
 */
export async function patchSowAllocations(
  jobId: string,
  request: SowAllocationsRequest,
  signal?: AbortSignal
): Promise<SowAllocationsResponse> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }

  const changes = nonemptyAllocationMap(request.changes);
  const overarchingChanges = nonemptyAllocationMap(request.overarching_changes);
  const sharedChanges = nonemptySharedMap(request.shared_changes);
  if (!changes && !overarchingChanges && !sharedChanges) {
    throw new Error("No allocation changes to apply.");
  }

  const body: SowAllocationsRequest = {};
  if (changes) body.changes = changes;
  if (overarchingChanges) body.overarching_changes = overarchingChanges;
  if (sharedChanges) body.shared_changes = sharedChanges;

  const token = getAuthToken();
  const res = await fetch(
    `${API_BASE_URL}/sow/allocations/${encodeURIComponent(trimmed)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(await parseSowApiError(res));
  }

  const raw = (await res.json()) as SowAllocationsResponse;
  return {
    status: String(raw.status ?? "success"),
    moved: raw.moved,
    overarching_updated: raw.overarching_updated,
    shared_changed: raw.shared_changed,
    not_found: raw.not_found,
    trade_line_counts: raw.trade_line_counts,
    active_shared_item_count: raw.active_shared_item_count,
    tabs: raw.tabs,
  };
}

export type SowSharedItemTradeUpdate = {
  trade_id: string;
  scope?: string;
  note?: string;
};

export type SowSharedItemPatchRequest = {
  expected_version?: number;
  trades: SowSharedItemTradeUpdate[];
};

export type SowSharedItemPatchResponse = {
  status: string;
  job_id?: string;
  active_shared_item_count?: number;
  shared_item?: SowSharedItem;
};

/**
 * Saves the trades that should remain on a shared item.
 * PATCH /sow/shared-items/:job_id/:item_id
 */
export async function patchSowSharedItem(
  jobId: string,
  itemId: string,
  request: SowSharedItemPatchRequest,
  signal?: AbortSignal
): Promise<SowSharedItemPatchResponse> {
  const trimmedJobId = jobId.trim();
  const trimmedItemId = itemId.trim();
  if (!trimmedJobId || !trimmedItemId) {
    throw new Error("Invalid shared item.");
  }
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }
  if (!request.trades.length) {
    throw new Error("At least one trade must remain.");
  }

  const token = getAuthToken();
  const res = await fetch(
    `${API_BASE_URL}/sow/shared-items/${encodeURIComponent(trimmedJobId)}/${encodeURIComponent(trimmedItemId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(await parseSowApiError(res, `Could not update this shared item (${res.status})`));
  }

  const raw = (await res.json()) as SowSharedItemPatchResponse;
  return {
    status: String(raw.status ?? "success"),
    job_id: raw.job_id,
    active_shared_item_count: raw.active_shared_item_count,
    shared_item: raw.shared_item,
  };
}

/**
 * Downloads a SOW export file for a split job.
 * GET /sow/download/:job_id
 */
export async function downloadSowExport(
  jobId: string,
  request: SowDownloadRequest,
  signal?: AbortSignal
): Promise<SowFileDownloadResult> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }

  const tradeId = request.tradeId?.trim();
  if (request.type === "trade" && !tradeId) {
    throw new Error("A trade must be selected before downloading.");
  }

  const params = new URLSearchParams({ type: request.type });
  if (request.type === "trade" && tradeId) {
    params.set("trade_id", tradeId);
  }

  const token = getAuthToken();
  const res = await fetch(
    `${API_BASE_URL}/sow/download/${encodeURIComponent(trimmed)}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    }
  );

  return parseSowFileResponse(
    res,
    fallbackSowDownloadFilename(request.type, tradeId),
    "Download failed"
  );
}

/**
 * Builds and downloads the DCK Tender Workbook for a split job.
 * POST /sow/workbook/:job_id (multipart/form-data)
 */
export async function submitSowWorkbook(
  jobId: string,
  request: SowWorkbookRequest = {},
  signal?: AbortSignal
): Promise<SowWorkbookResult> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }
  if (!request.template) {
    throw new Error(
      "Please upload a DCK Tender Workbook template (.xlsx) before creating the workbook."
    );
  }

  const formData = new FormData();
  if (request.include?.length) {
    for (const key of request.include) {
      formData.append("include", key);
    }
  }
  await assertSowWorkbookTemplateContent(request.template);
  formData.append("template", request.template);

  const token = getAuthToken();
  const res = await fetch(
    `${API_BASE_URL}/sow/workbook/${encodeURIComponent(trimmed)}`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(await parseSowApiError(res));
  }

  return parseSowFileResponse(
    res,
    `DCK_Tender_Workbook_${trimmed}.xlsx`,
    "Workbook generation failed"
  );
}

/**
 * Loads a previously saved trade split for a project.
 * GET /sow/split/:job_id
 */
export async function fetchSavedSowSplit(
  jobId: string,
  signal?: AbortSignal
): Promise<SowSplitResponse | null> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }

  const config: SowRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
    // Cache-buster: the reload right after Apply must not get a stale browser-cached listing.
    params: { _ts: Date.now() },
    validateStatus: (status) => status === 200 || status === 404,
  };

  try {
    const { data, status } = await apiClient.get<unknown>(
      `/sow/split/${encodeURIComponent(trimmed)}`,
      config
    );

    if (status === 404 || data == null) return null;

    const normalized = normalizeSowSplitResponse(data);
    return hasSavedSowSplitData(normalized) ? normalized : null;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[schedule-of-works] GET /sow/split failed", err);
    return null;
  }
}

/**
 * Fetches schedule-of-works data for a project.
 * GET /sow/find/:job_id
 */
export async function fetchSowByJobId(
  jobId: string,
  signal?: AbortSignal
): Promise<SowFindResponse> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }

  const config: SowRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
  };

  const { data } = await apiClient.get<SowFindResponse>(
    `/sow/find/${encodeURIComponent(trimmed)}`,
    config
  );

  return data;
}

export type SowSupportingDocumentFile = {
  file_name: string;
  file_path: string;
};

export type SowSupportingDocumentsResponse = {
  status: string;
  job_id: string;
  specifications: SowSupportingDocumentFile[];
  drawings: SowSupportingDocumentFile[];
};

function normalizeSupportingDocumentFile(
  raw: unknown
): SowSupportingDocumentFile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const fileName =
    typeof row.file_name === "string" ? row.file_name.trim() : "";
  if (!fileName) return null;
  return {
    file_name: fileName,
    file_path: typeof row.file_path === "string" ? row.file_path : "",
  };
}

function normalizeSupportingDocumentsResponse(
  raw: unknown,
  jobId: string
): SowSupportingDocumentsResponse {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const specifications = Array.isArray(record.specifications)
    ? record.specifications
    : [];
  const drawings = Array.isArray(record.drawings) ? record.drawings : [];
  return {
    status: typeof record.status === "string" ? record.status : "",
    job_id: typeof record.job_id === "string" ? record.job_id : jobId,
    specifications: specifications
      .map(normalizeSupportingDocumentFile)
      .filter((item): item is SowSupportingDocumentFile => item !== null),
    drawings: drawings
      .map(normalizeSupportingDocumentFile)
      .filter((item): item is SowSupportingDocumentFile => item !== null),
  };
}

/**
 * Lists specification and drawing files already stored for a project.
 * GET /sow/supporting-documents/:job_id
 */
export async function fetchSowSupportingDocuments(
  jobId: string,
  signal?: AbortSignal
): Promise<SowSupportingDocumentsResponse> {
  const trimmed = jobId.trim();
  if (!trimmed) {
    throw new Error("Invalid job id.");
  }

  const config: SowRequestConfig = {
    skipGlobalLoader: true,
    ...(signal ? { signal } : {}),
  };

  const { data } = await apiClient.get<unknown>(
    `/sow/supporting-documents/${encodeURIComponent(trimmed)}`,
    config
  );
  const normalized = normalizeSupportingDocumentsResponse(data, trimmed);
  if (normalized.status && normalized.status !== "success") {
    throw new Error("Could not load specifications and drawings.");
  }
  return normalized;
}

export type SowSheetItem = {
  name: string;
  index: number;
  hidden: boolean;
};

export type SowSheetsResponse = {
  status: string;
  file_name: string;
  sheets: SowSheetItem[];
};

export type SowSheetsRequest =
  | { type: "upload"; file: File; jobId?: string }
  | { type: "existing"; jobId: string; filePath: string };

function normalizeSowSheetItem(raw: unknown, fallbackIndex: number): SowSheetItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const indexRaw = row.index;
  const index =
    typeof indexRaw === "number" && Number.isFinite(indexRaw)
      ? indexRaw
      : typeof indexRaw === "string" && indexRaw.trim() !== "" && Number.isFinite(Number(indexRaw))
        ? Number(indexRaw)
        : fallbackIndex;
  const name =
    typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : `Sheet ${index}`;
  return {
    name,
    index,
    hidden: row.hidden === true,
  };
}

function normalizeSowSheetsResponse(raw: unknown): SowSheetsResponse {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(record.sheets) ? record.sheets : [];
  return {
    status: typeof record.status === "string" ? record.status : "",
    file_name: typeof record.file_name === "string" ? record.file_name : "",
    sheets: list
      .map((item, index) => normalizeSowSheetItem(item, index))
      .filter((item): item is SowSheetItem => item !== null),
  };
}

/**
 * Lists workbook sheets for a schedule file.
 * POST /sow/sheets (multipart/form-data)
 */
export async function fetchSowSheets(
  request: SowSheetsRequest,
  signal?: AbortSignal
): Promise<SowSheetsResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }

  const formData = new FormData();
  formData.append("type", request.type);

  if (request.type === "upload") {
    formData.append("file", request.file);
    const jobId = request.jobId?.trim();
    if (jobId) formData.append("job_id", jobId);
  } else {
    const jobId = request.jobId.trim();
    const filePath = request.filePath.trim();
    if (!jobId) {
      throw new Error("A project is required to load sheets for an EMS file.");
    }
    if (!filePath) {
      throw new Error("Selected EMS file path is missing.");
    }
    formData.append("job_id", jobId);
    formData.append("file_path", filePath);
  }

  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}/sow/sheets`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    signal,
  });

  if (!res.ok) {
    throw new Error(await parseSowApiError(res, `Could not load sheets (${res.status})`));
  }

  const raw: unknown = await res.json();
  const normalized = normalizeSowSheetsResponse(raw);
  if (normalized.status && normalized.status !== "success") {
    throw new Error("Could not load sheets.");
  }
  return normalized;
}
