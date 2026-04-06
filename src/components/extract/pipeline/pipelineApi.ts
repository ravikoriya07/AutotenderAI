import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/apiClient";
import { API_BASE_URL } from "@/lib/processingPipelineConfig";
import type { ProcessingStepDef } from "@/lib/processingPipelineConfig";

export type PipelineApiLog = {
  at: string;
  stepId: number;
  stepName: string;
  endpoint: string;
  url: string;
  payload: Record<string, string>;
  httpStatus: number;
  responseJson: Record<string, unknown> | null;
  /** Truncated raw body for non-JSON or debugging */
  rawBodyPreview: string;
  ok: boolean;
};

const RAW_PREVIEW_MAX = 20_000;

type PipelineRequestConfig = AxiosRequestConfig & { skipGlobalLoader?: boolean };

type PostResult =
  | { ok: true; data: Record<string, unknown>; log: PipelineApiLog }
  | { ok: false; log: PipelineApiLog; errorMessage: string };

function parseErrorMessage(
  data: Record<string, unknown>,
  raw: string,
  httpStatus: number,
  statusText: string
): string {
  const detail = data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return String(first.msg);
  }
  return raw || statusText || `HTTP ${httpStatus}`;
}

function buildFullUrl(path: string): string {
  const base = (apiClient.defaults.baseURL ?? API_BASE_URL).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function postPipelineStep(
  step: ProcessingStepDef,
  body: Record<string, string>
): Promise<PostResult> {
  const path = step.endpoint.startsWith("/")
    ? step.endpoint
    : `/${step.endpoint}`;
  const fullUrl = buildFullUrl(path);
  const config: PipelineRequestConfig = { skipGlobalLoader: true };

  try {
    const { data, status } = await apiClient.post<unknown>(
      path,
      body,
      config
    );

    const responseData =
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data !== null
        ? (data as Record<string, unknown>)
        : {};

    const rawPreview =
      typeof data === "string"
        ? data.slice(0, RAW_PREVIEW_MAX)
        : JSON.stringify(data ?? {}).slice(0, RAW_PREVIEW_MAX);

    const log: PipelineApiLog = {
      at: new Date().toISOString(),
      stepId: step.id,
      stepName: step.name,
      endpoint: step.endpoint,
      url: fullUrl,
      payload: body,
      httpStatus: status,
      responseJson: responseData,
      rawBodyPreview: rawPreview,
      ok: true,
    };

    return { ok: true, data: responseData, log };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response) {
      const status = e.response.status;
      const rawData = e.response.data;
      let raw = "";
      let parsed: Record<string, unknown> | null = null;

      if (typeof rawData === "string") {
        raw = rawData;
        try {
          parsed = JSON.parse(rawData) as Record<string, unknown>;
        } catch {
          parsed = null;
        }
      } else if (rawData && typeof rawData === "object") {
        parsed = rawData as Record<string, unknown>;
        raw = JSON.stringify(rawData);
      }

      const msg = parsed
        ? parseErrorMessage(
            parsed,
            raw,
            status,
            e.response.statusText ?? ""
          )
        : raw || e.response.statusText || `HTTP ${status}`;

      const log: PipelineApiLog = {
        at: new Date().toISOString(),
        stepId: step.id,
        stepName: step.name,
        endpoint: step.endpoint,
        url: fullUrl,
        payload: body,
        httpStatus: status,
        responseJson: parsed,
        rawBodyPreview:
          raw.length > RAW_PREVIEW_MAX
            ? `${raw.slice(0, RAW_PREVIEW_MAX)}… [truncated]`
            : raw,
        ok: false,
      };

      return { ok: false, log, errorMessage: msg };
    }

    const msg =
      e instanceof Error ? e.message : "Network error — could not reach API.";
    const log: PipelineApiLog = {
      at: new Date().toISOString(),
      stepId: step.id,
      stepName: step.name,
      endpoint: step.endpoint,
      url: fullUrl,
      payload: body,
      httpStatus: 0,
      responseJson: null,
      rawBodyPreview: msg,
      ok: false,
    };
    return { ok: false, log, errorMessage: msg };
  }
}
