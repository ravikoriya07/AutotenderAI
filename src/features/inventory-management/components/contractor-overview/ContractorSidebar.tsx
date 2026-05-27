"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countSelectedForProjectTrade,
  getAllContractorContacts,
  getProjectTradeCompanyCount,
} from "@/features/inventory-management/lib/contractorDatabase";
import { DataStatusDot } from "@/features/inventory-management/components/ui/StatusBadge";
import { ALL_CONTRACTORS_ID } from "@/features/inventory-management/types/contractor-database";
import type { InventoryTrade } from "@/features/inventory-management/types";

type ContractorSidebarProps = {
  trades: InventoryTrade[];
  activeId: string | null;
  selectedContactIds: Set<number>;
  onSelect: (id: string) => void;
};

export function ContractorSidebar({
  trades,
  activeId,
  selectedContactIds,
  onSelect,
}: ContractorSidebarProps) {
  const allContacts = getAllContractorContacts();
  const allTotal = allContacts.length;
  const allSelected = allContacts.filter((c) =>
    selectedContactIds.has(c.id)
  ).length;
  const isAllActive = activeId === ALL_CONTRACTORS_ID;

  return (
    <aside className="flex w-full shrink-0 flex-col border-border bg-card lg:w-56 lg:border-r">
      <div className="border-b border-border px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Trades
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          From project abstract
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => onSelect(ALL_CONTRACTORS_ID)}
          className={cn(
            "flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-left transition-colors",
            isAllActive
              ? "border-l-2 border-l-primary bg-primary/5 font-medium text-primary"
              : "border-l-2 border-l-transparent text-foreground hover:bg-muted/60"
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">All Contractors</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {allTotal} companies
              {allSelected > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-primary">
                    {allSelected} selected
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        <div className="mx-4 my-1 border-t border-border" />
        <div className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Project Trades
        </div>

        {trades.map((trade) => {
          const active = trade.id === activeId;
          const count = getProjectTradeCompanyCount(trade.id);
          const selectedCount = countSelectedForProjectTrade(
            trade.id,
            selectedContactIds
          );

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
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px]">{trade.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {count} companies
                  {selectedCount > 0 ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-semibold text-primary">
                        {selectedCount} selected
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <DataStatusDot status={trade.dataStatus} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
