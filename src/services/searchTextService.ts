import { autoCountClient } from "@/lib/autoCountClient";
import type { AutoCountApiMatch } from "@/lib/autoCountCoordinates";
import {
  toAutoCountApiFilePath,
  type AutoCountRoi,
  type AutoCountAddItem,
} from "@/services/autoCountService";
import type { AxiosRequestConfig } from "axios";

type SearchTextRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

export type SearchTextRequest = {
  job_id: string;
  file_path: string;
  search_term: string;
  case_sensitive: boolean;
};

export type SearchTextResponse = {
  total_found?: number;
  matches?: AutoCountApiMatch[];
  mode?: string;
};

export type SearchTextAddItem = AutoCountAddItem & {
  text?: string;
};

export type SearchTextAddRequest = {
  job_id: string;
  file_path: string;
  item: AutoCountRoi | SearchTextAddItem;
};

export type SearchTextRemoveRequest = {
  job_id: string;
  file_path: string;
  item_id: string;
};

export type SearchTextMatchesApiResponse = {
  matches: AutoCountApiMatch[];
};

function toSearchTextAddItemBody(
  item: AutoCountRoi | SearchTextAddItem
): SearchTextAddItem {
  if ("w" in item && "h" in item) {
    const it = item as SearchTextAddItem;
    return {
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
      ...(typeof it.text === "string" && it.text.trim() !== ""
        ? { text: it.text.trim() }
        : {}),
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

function normalizeSearchTextMatchesPayload(raw: unknown): AutoCountApiMatch[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as AutoCountApiMatch[];
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const m = o.matches ?? o.data;
    if (Array.isArray(m)) return m as AutoCountApiMatch[];
  }
  return [];
}

export async function postSearchText(
  payload: SearchTextRequest
): Promise<SearchTextResponse> {
  const config: SearchTextRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<SearchTextResponse>(
    "/search_text",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      search_term: payload.search_term.trim(),
      case_sensitive: Boolean(payload.case_sensitive),
    },
    config
  );
  return data;
}

export async function postSearchTextAdd(
  payload: SearchTextAddRequest
): Promise<unknown> {
  const config: SearchTextRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/search_text/add",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item: toSearchTextAddItemBody(payload.item),
    },
    config
  );
  return data;
}

export async function postSearchTextRemove(
  payload: SearchTextRemoveRequest
): Promise<unknown> {
  const config: SearchTextRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post(
    "/search_text/remove",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      item_id: payload.item_id,
    },
    config
  );
  return data;
}

export async function getSearchTextMatches(params: {
  job_id: string;
  file_path: string;
}): Promise<SearchTextMatchesApiResponse> {
  const config: SearchTextRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.get<unknown>("/search_text/matches", {
    ...config,
    params: {
      job_id: params.job_id,
      file_path: toAutoCountApiFilePath(params.file_path),
    },
  });
  const matches = normalizeSearchTextMatchesPayload(data);
  return { matches };
}
