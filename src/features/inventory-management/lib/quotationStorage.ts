import type { QuoteRecord } from "@/features/inventory-management/types";

export function formatQuoteGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

export function getLowestQuoteValue(quotes: QuoteRecord[]): number | null {
  if (!quotes.length) return null;
  return Math.min(...quotes.map((q) => q.value));
}

export function sortQuotesByValue(quotes: QuoteRecord[]): QuoteRecord[] {
  return [...quotes].sort((a, b) => a.value - b.value);
}

export function percentAboveLowest(value: number, lowest: number): number {
  if (lowest <= 0) return 0;
  return Math.round(((value - lowest) / lowest) * 100);
}

export const QUOTE_ANALYSIS_EXCLUSIONS = [
  "Fire escape provisions — confirm requirement before order",
  "Payment terms — confirm credit terms or programme payments to match cash flow",
  "Delivery restrictions — confirm site access for delivery vehicle",
  "Specification freeze required before order — size changes incur cost and delay",
] as const;
