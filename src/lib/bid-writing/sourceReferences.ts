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
