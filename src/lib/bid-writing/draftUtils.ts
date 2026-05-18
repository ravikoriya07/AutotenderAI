import type { DraftRecord } from "./types";

export const DRAFTS_UPDATED_EVENT = "autotender:drafts-updated" as const;

export const UPLOAD_DRAFT_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"] as const;

export function isAllowedUploadDraftFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return UPLOAD_DRAFT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Use uploaded filename (without extension) as draft title. */
export function titleFromUploadFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/i, "").trim();
  return base || "Uploaded draft";
}
export function formatDraftDisplayDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Subtitle for list rows: show updated time when present and differs from created. */
export function draftListDateLabel(createdAt: string, updatedAt?: string): string {
  const c = (createdAt ?? "").trim();
  const u = (updatedAt ?? "").trim();
  if (!c && !u) return "";
  if (!u || u === c) {
    return c ? `Created ${formatDraftDisplayDate(c)}` : "";
  }
  return `Updated ${formatDraftDisplayDate(u)}`;
}

export function mapBidDraftSummaryToRecord(d: {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  content?: string;
}): DraftRecord {
  return {
    id: d.id,
    title: d.title,
    content: typeof d.content === "string" ? d.content : "",
    createdAt: draftListDateLabel(d.created_at, d.updated_at),
    sources: null,
    web_sources: null,
  };
}

/** Normalize API `sources` object for draft detail. */
export function normalizeDraftSources(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function normalizeWebSources(raw: unknown): unknown[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw;
}