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

export type SowSplitExistingRequest = SowTradeSplitOptions & {
  type: "existing";
  file_path: string;
};

export type SowSplitUploadRequest = SowTradeSplitOptions & {
  type: "upload";
  file: File;
};

export type SowSplitRequest = SowSplitExistingRequest | SowSplitUploadRequest;

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
    return (await res.json()) as SowSplitResponse;
  }

  return { status: "success" };
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
