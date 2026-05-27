"use client";

import {
  computeContractorStats,
  contractorStatusColor,
  scoreColor,
} from "@/features/inventory-management/lib/contractorStats";
import type { ContractorStat } from "@/features/inventory-management/types";
import { cn } from "@/lib/utils";

type ContractorStatsSidebarProps = {
  contractors: ContractorStat[];
  activeId: number | null;
  search: string;
  threshold: number;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
};

export function ContractorStatsSidebar({
  contractors,
  activeId,
  search,
  threshold,
  onSearchChange,
  onSelect,
}: ContractorStatsSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-border bg-card lg:w-[260px] lg:border-r">
      <div className="border-b border-border px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#6B7399]">
        Contractors
      </div>
      <div className="border-b border-border px-3 py-2">
        <input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded border border-border bg-background px-2.5 text-[13px] text-[#1A1A2E]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {contractors.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[#9BA3BF]">No contractors found</p>
        ) : (
          contractors.map((contractor) => {
            const stats = computeContractorStats(contractor, threshold);
            const statusCol = contractorStatusColor(contractor.status);
            const active = contractor.id === activeId;

            return (
              <button
                key={contractor.id}
                type="button"
                onClick={() => onSelect(contractor.id)}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-border px-3.5 py-[11px] text-left transition-colors",
                  active ? "bg-[#EEF2F9]" : "hover:bg-muted/40"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-[13px] font-semibold text-[#1A1A2E]">
                    {contractor.company}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize"
                      style={{
                        color: statusCol,
                        backgroundColor: `${statusCol}18`,
                        borderColor: `${statusCol}28`,
                      }}
                    >
                      {contractor.status}
                    </span>
                    <span className="text-[10.5px] text-[#9BA3BF]">
                      {contractor.history.length} enquiries
                    </span>
                  </div>
                </div>
                <span
                  className="shrink-0 text-[17px] font-bold leading-none"
                  style={{ color: scoreColor(stats.score) }}
                >
                  {stats.score}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
