"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { InboxMonitorItem } from "@/features/inventory-management/types";

type QuoteInboxMonitorProps = {
  items: InboxMonitorItem[];
};

export function QuoteInboxMonitor({ items: initialItems }: QuoteInboxMonitorProps) {
  const [items, setItems] = useState(initialItems);

  const needsFiling = items.filter((item) => !item.filed).length;

  const handleFile = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, filed: true, trade: item.trade || "L10 - WINDOWS" }
          : item
      )
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-[11px]">
        <h3 className="text-sm font-bold text-[#1A1A2E]">Outlook Inbox Monitor</h3>
        {needsFiling > 0 ? (
          <span className="inline-flex items-center rounded-full border border-amber-600/25 bg-[#FFF8E6] px-2.5 py-0.5 text-xs font-medium text-[#C47B00]">
            {needsFiling} needs filing
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-green-600/25 bg-[#EFF8EF] px-2.5 py-0.5 text-xs font-medium text-[#107C10]">
            All filed
          </span>
        )}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center gap-3 border-b border-border px-[18px] py-3 last:border-b-0"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor: item.filed ? "#107C10" : "#C47B00",
            }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#1A1A2E]">{item.company}</p>
            <p className="text-[11.5px] text-[#6B7399]">{item.subject}</p>
            <p className="text-[11px] text-[#9BA3BF]">{item.from}</p>
          </div>
          <div className="shrink-0 text-right text-[11.5px] text-[#9BA3BF]">
            {item.received}
            <div className="mt-0.5">
              {item.filed ? (
                <span className="inline-flex items-center rounded-full border border-green-600/25 bg-[#EFF8EF] px-2 py-0.5 text-[10px] font-medium text-[#107C10]">
                  ✓ {item.trade}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-amber-600/25 bg-[#FFF8E6] px-2 py-0.5 text-[10px] font-medium text-[#C47B00]">
                  Needs Filing
                </span>
              )}
            </div>
          </div>
          {!item.filed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleFile(item.id)}
            >
              File Now
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
