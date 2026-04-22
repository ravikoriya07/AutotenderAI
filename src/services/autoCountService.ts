import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";

type AutoCountRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

/** Rectangle in backend pdf.js space at PREVIEW_ZOOM / scale 2 (see autoCountCoordinates). */
export type AutoCountRoi = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AutoCountRequest = {
  job_id: string;
  /** Project-relative path; normalized to `extract_zip_output/...` when sent (see {@link toAutoCountApiFilePath}). */
  file_path: string;
  roi: AutoCountRoi;
  rotation_invariant: boolean;
  confidence: number;
};

/**
 * Backend `/auto_count` expects files under `extract_zip_output/` (unzipped tree), not the viewer `pdfs/` prefix.
 */
export function toAutoCountApiFilePath(projectRelativePath: string): string {
  const t = projectRelativePath.trim();
  if (t.startsWith("pdfs/")) {
    return `extract_zip_output/${t.slice("pdfs/".length)}`;
  }
  return t;
}

/** Match box in backend pdf.js space at scale 2; UI converts to CSS for overlay. */
export type AutoCountMatch = {
  /** Stable id from `/auto_count` / `/auto_count/matches` — required for `POST /auto_count/remove`. */
  id?: string | number;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

export type AutoCountResponse = {
  mode?: string;
  total_found?: number;
  matches?: AutoCountMatch[];
};

export async function postAutoCount(
  payload: AutoCountRequest
): Promise<AutoCountResponse> {
  const config: AutoCountRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<AutoCountResponse>(
    "/auto_count",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      roi: payload.roi,
      /** Must mirror UI "Detect rotated symbols": checked → true, unchecked → false */
      rotation_invariant: Boolean(payload.rotation_invariant),
      confidence: payload.confidence,
    },
    config
  );
  return data;
}

/** Body shape required by `POST /auto_count/add` (matches backend validation). */
export type AutoCountAddItem = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AutoCountAddRequest = {
  job_id: string;
  file_path: string;
  /**
   * Manual box in backend preview space.
   * Pass either `{ x, y, w, h }` or ROI-style `{ x, y, width, height }` — both are accepted here.
   */
  item: AutoCountRoi | AutoCountAddItem;
};

function toAutoCountAddItemBody(
  item: AutoCountRoi | AutoCountAddItem
): AutoCountAddItem {
  if ("w" in item && "h" in item) {
    return {
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    };
  }
  const r = item as AutoCountRoi;
  return {
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
  };
}

export type AutoCountRemoveRequest = {
  job_id: string;
  file_path: string;
  item_id: string;
};

export async function postAutoCountAdd(
  payload: AutoCountAddRequest
): Promise<unknown> {
  const config: AutoCountRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/auto_count/add",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item: toAutoCountAddItemBody(payload.item),
    },
    config
  );
  return data;
}

export async function postAutoCountRemove(
  payload: AutoCountRemoveRequest
): Promise<unknown> {
  const config: AutoCountRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/auto_count/remove",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item_id: payload.item_id,
    },
    config
  );
  return data;
}

/** Same shape as `AutoCountApiMatch` in `autoCountCoordinates` (avoid circular imports). */
export type AutoCountMatchRow = {
  id?: string | number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  score?: number;
  confidence?: number;
};

/** Normalized rows for UI (backend preview space). */
export type AutoCountMatchesApiResponse = {
  matches: AutoCountMatchRow[];
};

function normalizeMatchesPayload(raw: unknown): AutoCountMatchRow[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as AutoCountMatchRow[];
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const m = o.matches ?? o.data;
    if (Array.isArray(m)) return m as AutoCountMatchRow[];
  }
  return [];
}

export async function getAutoCountMatches(params: {
  job_id: string;
  file_path: string;
}): Promise<AutoCountMatchesApiResponse> {
  const config: AutoCountRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.get<unknown>("/auto_count/matches", {
    ...config,
    params: {
      job_id: params.job_id,
      file_path: toAutoCountApiFilePath(params.file_path),
    },
  });
  const matches = normalizeMatchesPayload(data);
  return { matches };
}
