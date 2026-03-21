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

type PostResult =
  | { ok: true; data: Record<string, unknown>; log: PipelineApiLog }
  | { ok: false; log: PipelineApiLog; errorMessage: string };

function parseErrorMessage(
  data: Record<string, unknown>,
  raw: string,
  res: Response
): string {
  const detail = data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return String(first.msg);
  }
  return raw || res.statusText || `HTTP ${res.status}`;
}

export async function postPipelineStep(
  step: ProcessingStepDef,
  body: Record<string, string>
): Promise<PostResult> {
  const url = `${API_BASE_URL}${step.endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: Record<string, unknown> | null = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  const log: PipelineApiLog = {
    at: new Date().toISOString(),
    stepId: step.id,
    stepName: step.name,
    endpoint: step.endpoint,
    url,
    payload: body,
    httpStatus: res.status,
    responseJson: data,
    rawBodyPreview:
      raw.length > RAW_PREVIEW_MAX
        ? `${raw.slice(0, RAW_PREVIEW_MAX)}… [truncated]`
        : raw,
    ok: res.ok,
  };

  if (!res.ok) {
    const msg = data
      ? parseErrorMessage(data, raw, res)
      : raw || res.statusText || `HTTP ${res.status}`;
    return { ok: false, log, errorMessage: msg };
  }

  return { ok: true, data: data ?? {}, log };
}
