import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";
import { getAuthToken } from "@/lib/authStorage";

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

async function parseSowSplitError(res: Response): Promise<string> {
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

export type SowSplitResponse = {
  status: string;
  tabs?: {
    trade_documents?: SowTradeDocument[];
    full_schedule?: SowFullScheduleItem[];
    shared_items?: SowSharedItem[];
  };
};

export type SowTradeDocument = {
  id: string;
  label: string;
  nbs?: string[];
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
    throw new Error(await parseSowSplitError(res));
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
