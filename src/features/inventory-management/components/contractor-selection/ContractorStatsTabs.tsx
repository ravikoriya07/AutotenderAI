"use client";

import { cn } from "@/lib/utils";

export type ContractorStatsTab = "overview" | "by-trade" | "history";

type ContractorStatsTabsProps = {
  active: ContractorStatsTab;
  onChange: (tab: ContractorStatsTab) => void;
};

const TABS: { id: ContractorStatsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "by-trade", label: "By Trade" },
  { id: "history", label: "History" },
];

export function ContractorStatsTabs({ active, onChange }: ContractorStatsTabsProps) {
  return (
    <div className="mb-3.5 flex overflow-hidden rounded-t-lg border-b border-border bg-card">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-[3px] px-4 py-2.5 text-[13px] transition-colors",
            active === tab.id
              ? "border-[#1B3A6B] font-bold text-[#1B3A6B]"
              : "border-transparent font-medium text-[#6B7399] hover:text-[#1A1A2E]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
