import type { PastBid } from "@/lib/bid-writing/types";

/** Inline citations like `[6]` or `[41, 43]` in assistant answers. */
export const SOURCE_REFERENCE_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Long-form citations like `[SOURCE ID: 8]` from some assistant responses. */
export const SOURCE_ID_REFERENCE_PATTERN = /\[\s*SOURCE\s+ID\s*:\s*([^\]]+?)\s*\]/gi;

/** Web search citation marker. */
export const WEB_REFERENCE_PATTERN = /\[\s*WEB\s*\]/gi;

export type CitationRefMatch = {
  index: number;
  length: number;
  displayText: string;
  labels: string[];
};

function citationDisplayForSeqs(seqs: number[], raw: string): string {
  if (seqs.length === 1) return `[${seqs[0]}]`;
  if (seqs.length > 1) return `[${seqs.join(", ")}]`;
  return raw;
}

/** Find all inline citation markers in plain text (non-overlapping, left-to-right). */
export function findCitationRefMatches(
  text: string,
  sourceLabelBySeq?: ReadonlyMap<number, string>
): CitationRefMatch[] {
  const matches: CitationRefMatch[] = [];

  let m: RegExpExecArray | null;

  const sourceIdRe = new RegExp(SOURCE_ID_REFERENCE_PATTERN.source, "gi");
  while ((m = sourceIdRe.exec(text)) !== null) {
    const seqs = parseSourceReferenceSeqs(m[1]);
    matches.push({
      index: m.index,
      length: m[0].length,
      displayText: citationDisplayForSeqs(seqs, m[0]),
      labels: resolveSourceLabels(seqs, sourceLabelBySeq),
    });
  }

  const webRe = new RegExp(WEB_REFERENCE_PATTERN.source, "gi");
  while ((m = webRe.exec(text)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      displayText: "[WEB]",
      labels: ["Web source"],
    });
  }

  const numRe = new RegExp(SOURCE_REFERENCE_PATTERN.source, "g");
  while ((m = numRe.exec(text)) !== null) {
    const overlaps = matches.some(
      (hit) => m!.index >= hit.index && m!.index < hit.index + hit.length
    );
    if (overlaps) continue;
    const seqs = parseSourceReferenceSeqs(m[1]);
    matches.push({
      index: m.index,
      length: m[0].length,
      displayText: m[0],
      labels: resolveSourceLabels(seqs, sourceLabelBySeq),
    });
  }

  matches.sort((a, b) => a.index - b.index || b.length - a.length);

  const filtered: CitationRefMatch[] = [];
  let end = 0;
  for (const hit of matches) {
    if (hit.index < end) continue;
    filtered.push(hit);
    end = hit.index + hit.length;
  }
  return filtered;
}

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
