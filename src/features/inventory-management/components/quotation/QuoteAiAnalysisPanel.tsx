"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  formatQuoteGbp,
  QUOTE_ANALYSIS_EXCLUSIONS,
  sortQuotesByValue,
} from "@/features/inventory-management/lib/quotationStorage";
import type { QuoteRecord } from "@/features/inventory-management/types";

type QuoteAiAnalysisPanelProps = {
  quotes: QuoteRecord[];
  tradeLabel: string;
};

type AnalysisState = "idle" | "loading" | "complete";

export function QuoteAiAnalysisPanel({
  quotes,
  tradeLabel,
}: QuoteAiAnalysisPanelProps) {
  const [state, setState] = useState<AnalysisState>("idle");

  const runAnalysis = useCallback(() => {
    if (!quotes.length) return;
    setState("loading");
    window.setTimeout(() => setState("complete"), 2000);
  }, [quotes.length]);

  if (!quotes.length) {
    return (
      <p className="py-10 text-center text-[13px] text-[#9BA3BF]">
        No quotations received for this trade yet
      </p>
    );
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 text-[32px] opacity-25" aria-hidden>
          🤖
        </div>
        <p className="text-sm font-semibold text-[#4A5272]">
          Select a trade then click Run AI Analysis
        </p>
        <p className="mt-1 text-xs text-[#9BA3BF]">
          {tradeLabel} — {quotes.length} quote{quotes.length === 1 ? "" : "s"}{" "}
          available
        </p>
        <Button type="button" className="mt-4" onClick={runAnalysis}>
          ✦ Run AI Analysis
        </Button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <p className="py-12 text-center text-sm font-semibold text-[#0F6CBD]">
        🤖 Analysing {quotes.length} quotes...
      </p>
    );
  }

  const sorted = sortQuotesByValue(quotes);
  const lowest = sorted[0];
  const second = sorted[1];
  const savings =
    second != null ? formatQuoteGbp(second.value - lowest.value) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-[13px]"
        style={{
          background: "linear-gradient(135deg, #EEF5FF, #F5F0FF)",
        }}
      >
        <h3 className="text-sm font-bold text-[#1B3A6B]">🤖 AI Analysis Complete</h3>
        <Button type="button" variant="outline" size="sm">
          Export
        </Button>
      </div>
      <div className="space-y-4 px-5 py-[18px]">
        <div className="rounded-md border border-green-600/20 bg-[#EFF8EF] px-4 py-3.5 text-[13px] leading-relaxed text-[#4A5272]">
          ★ <strong>{lowest.company}</strong> offers the lowest quote at{" "}
          <strong>{formatQuoteGbp(lowest.value)}</strong>.
          {savings && second ? (
            <>
              {" "}
              Saving {savings} vs {second.company}. Review T&amp;Cs before
              placing order.
            </>
          ) : (
            " Review T&amp;Cs before placing order."
          )}
        </div>
        <div>
          <h4 className="mb-2.5 text-[13px] font-bold text-[#1A1A2E]">
            ⚠ Key Exclusions to Clarify
          </h4>
          <ul className="divide-y divide-border">
            {QUOTE_ANALYSIS_EXCLUSIONS.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 py-2 text-[13px] text-[#4A5272]"
              >
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-600/25 bg-[#FFF8E6] px-2 py-0.5 text-[10px] font-semibold text-[#C47B00]">
                  FLAG
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setState("idle")}
        >
          Run again
        </Button>
      </div>
    </div>
  );
}
