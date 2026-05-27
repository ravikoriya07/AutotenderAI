"use client";

import { Button } from "@/components/ui/Button";
import {
  formatQuoteGbp,
  getLowestQuoteValue,
  percentAboveLowest,
  sortQuotesByValue,
} from "@/features/inventory-management/lib/quotationStorage";
import type { QuoteRecord } from "@/features/inventory-management/types";

type ReceivedQuotesTableProps = {
  tradeLabel: string;
  quotes: QuoteRecord[];
  onAnalyse: () => void;
};

export function ReceivedQuotesTable({
  tradeLabel,
  quotes,
  onAnalyse,
}: ReceivedQuotesTableProps) {
  const lowest = getLowestQuoteValue(quotes);
  const sorted = sortQuotesByValue(quotes);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-[11px]">
        <h3 className="text-sm font-bold text-[#1A1A2E]">
          Received Quotations — {tradeLabel}
        </h3>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-green-600/25 bg-[#EFF8EF] px-2.5 py-0.5 text-xs font-medium text-[#107C10]">
            {quotes.length} received
          </span>
          <Button type="button" variant="outline" size="sm">
            + Upload
          </Button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <p className="px-6 py-8 text-center text-[13px] text-[#9BA3BF]">
          No quotations received for this trade yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-[#F5F6FA] text-left">
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Company
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  File
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Received
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-[#6B7399]">
                  Value
                </th>
                <th className="w-28 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((quote) => {
                const isLowest = lowest != null && quote.value === lowest;
                const diff =
                  lowest != null ? percentAboveLowest(quote.value, lowest) : 0;

                return (
                  <tr
                    key={`${quote.company}-${quote.file}`}
                    className="border-b border-border hover:bg-[#F8F9FF]"
                  >
                    <td className="px-3 py-2.5">
                      <span className="block text-[13px] font-semibold text-[#1A1A2E]">
                        {quote.company}
                      </span>
                      <span className="block text-[11.5px] text-[#6B7399]">
                        {quote.contact}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#0F6CBD]">
                      {quote.file}
                    </td>
                    <td className="px-3 py-2.5 text-[12.5px] text-[#4A5272]">
                      {quote.date}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="block text-[15px] font-bold text-[#1A1A2E]">
                        {formatQuoteGbp(quote.value)}
                      </span>
                      {isLowest ? (
                        <span className="mt-0.5 inline-flex items-center rounded-full border border-green-600/25 bg-[#EFF8EF] px-2 py-0.5 text-[10px] font-semibold text-[#107C10]">
                          ★ Lowest
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-[11px] text-[#C47B00]">
                          +{diff}% above
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#0F6CBD]"
                        >
                          Open
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#0F6CBD]"
                          onClick={onAnalyse}
                        >
                          Analyse
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
