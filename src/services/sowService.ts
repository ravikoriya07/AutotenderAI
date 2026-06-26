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
  };

export type SowSplitUploadRequest = SowTradeSplitOptions &
  SowSplitSupportingFiles & {
    type: "upload";
    file: File;
  };

export type SowSplitRequest = SowSplitExistingRequest | SowSplitUploadRequest;

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

async function parseSowApiError(res: Response): Promise<string> {
  let detail = `Trade split failed (${res.status})`;
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as Record<string, unknown>;
      const message =
        (typeof body.message === "string" && body.message) ||
        (typeof body.error === "string" && body.error) ||
        (typeof body.detail === "string" && body.detail);
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
    const data = JSON.parse(text) as {
      message?: string;
      detail?: string | { msg?: string }[];
      error?: string;
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
        .map((entry) => (typeof entry === "string" ? entry : entry?.msg))
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (parts.length > 0) return parts.join("; ");
    }
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
  /** Trade id slug for `type=trade` (e.g. preambles, demolitions). */
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
      const safe =
        tradeId?.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "_") ||
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
    full_schedule?: SowFullScheduleItem[];
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
  ref: string;
  desc: string;
  qty?: number | string;
  unit?: string;
  section?: string;
  tradeId?: string;
  tradeLabel?: string;
};

export type SowSharedItemTrade = {
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
  return Array.isArray(trades) && trades.length > 0;
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

export type SowAllocationsRequest = {
  changes: SowAllocationChanges;
};

export type SowAllocationsResponse = {
  status: string;
  moved?: string[];
  not_found?: string[];
  trade_line_counts?: Record<string, number>;
  tabs?: SowSplitResponse["tabs"];
};

/**
 * Persists Full Schedule trade re-allocations.
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

  const changes = request.changes ?? {};
  if (Object.keys(changes).length === 0) {
    throw new Error("No allocation changes to apply.");
  }

  const token = getAuthToken();
  const res = await fetch(
    `${API_BASE_URL}/sow/allocations/${encodeURIComponent(trimmed)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ changes }),
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
    not_found: raw.not_found,
    trade_line_counts: raw.trade_line_counts,
    tabs: raw.tabs,
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
