import type { PastBid } from "@/lib/bid-writing/types";

/** Inline citations like `[6]` or `[41, 43]` in assistant answers. */
export const SOURCE_REFERENCE_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

export function parseSourceReferenceSeqs(inner: string): number[] {
  return inner
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

export function buildSourceLabelMapFromLibrary(bids: PastBid[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const bid of bids) {
    const name = (bid.project || bid.qdrant_project_name || "").trim();
    map.set(bid.seq, name || `Source ${bid.seq}`);
  }
  return map;
}

export function resolveSourceLabels(
  seqs: number[],
  sourceLabelBySeq?: ReadonlyMap<number, string>
): string[] {
  return seqs.map((seq) => sourceLabelBySeq?.get(seq) ?? `Source ${seq}`);
}

/** Build citation label map from API `sources` object (`{ "6": "Project name" }`). */
export function sourceLabelMapFromRecord(
  sources: Record<string, string> | null | undefined,
  base?: ReadonlyMap<number, string>
): ReadonlyMap<number, string> | undefined {
  if (!sources || Object.keys(sources).length === 0) {
    return base;
  }
  const merged = new Map<number, string>(base);
  for (const [key, label] of Object.entries(sources)) {
    const seq = parseInt(key, 10);
    if (Number.isFinite(seq) && typeof label === "string" && label.trim()) {
      merged.set(seq, label.trim());
    }
  }
  return merged.size > 0 ? merged : base;
}

export function sourcesRecordFromUnknown(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === "string" && val.trim()) out[key] = val.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}
