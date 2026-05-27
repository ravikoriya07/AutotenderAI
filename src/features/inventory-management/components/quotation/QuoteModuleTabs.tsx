"use client";

import { cn } from "@/lib/utils";

export type QuoteSubTab = "received" | "analysis" | "inbox";

type QuoteModuleTabsProps = {
  active: QuoteSubTab;
  onChange: (tab: QuoteSubTab) => void;
};

const TABS: { id: QuoteSubTab; label: string }[] = [
  { id: "received", label: "Received Quotes" },
  { id: "analysis", label: "AI Analysis" },
  { id: "inbox", label: "Inbox Monitor" },
];

/** Legacy `.ptab` underline navigation. */
export function QuoteModuleTabs({ active, onChange }: QuoteModuleTabsProps) {
  return (
    <div className="flex shrink-0 border-b border-border bg-card px-5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-[3px] border-transparent px-4 py-2.5 text-[13px] font-medium transition-colors",
            active === tab.id
              ? "border-[#1B3A6B] font-bold text-[#1B3A6B]"
              : "text-[#6B7399] hover:text-[#1A1A2E]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
