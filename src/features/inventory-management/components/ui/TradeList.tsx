"use client";

import { cn } from "@/lib/utils";
import type { InventoryTrade } from "@/features/inventory-management/types";
import { DataStatusDot } from "@/features/inventory-management/components/ui/StatusBadge";

type TradeListProps = {
  trades: InventoryTrade[];
  activeId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  subtitle?: string;
  getMeta?: (trade: InventoryTrade) => React.ReactNode;
  className?: string;
};

export function TradeList({
  trades,
  activeId,
  onSelect,
  title = "Trades",
  subtitle,
  getMeta,
  className,
}: TradeListProps) {
  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col overflow-hidden border-border bg-card lg:w-56 lg:border-r",
        className
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {trades.map((trade) => {
          const active = trade.id === activeId;
          return (
            <button
              key={trade.id}
              type="button"
              onClick={() => onSelect(trade.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-left text-sm transition-colors",
                active
                  ? "border-l-2 border-l-primary bg-primary/5 font-medium text-primary"
                  : "border-l-2 border-l-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="min-w-0 truncate">{trade.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {getMeta?.(trade)}
                <DataStatusDot status={trade.dataStatus} />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
