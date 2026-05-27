"use client";

import { ProgressIndicator } from "@/features/inventory-management/components/contractor-overview/ProgressIndicator";
import type { ContractorTradeCategory } from "@/features/inventory-management/types/contractor-database";
import { cn } from "@/lib/utils";

type TradeCategoryCardProps = {
  trade: ContractorTradeCategory;
  onSelect: (trade: ContractorTradeCategory) => void;
};

export function TradeCategoryCard({ trade, onSelect }: TradeCategoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(trade)}
      className={cn(
        "flex w-full flex-col rounded-lg border border-border bg-card p-3.5 text-left shadow-sm transition-all",
        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="text-sm font-medium leading-snug text-foreground">
        {trade.label}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {trade.companyCount} companies
        {trade.selectedCount > 0 ? (
          <>
            {" "}
            ·{" "}
            <span className="font-semibold text-primary">
              {trade.selectedCount} sel
            </span>
          </>
        ) : null}
      </div>
      <div className="mt-3">
        <ProgressIndicator percent={trade.progressPercent} />
      </div>
    </button>
  );
}
