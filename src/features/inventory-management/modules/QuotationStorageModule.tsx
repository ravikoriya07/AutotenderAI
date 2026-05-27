"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/features/inventory-management/components/layout/ModuleShell";
import { QuoteAiAnalysisPanel } from "@/features/inventory-management/components/quotation/QuoteAiAnalysisPanel";
import { QuoteInboxMonitor } from "@/features/inventory-management/components/quotation/QuoteInboxMonitor";
import {
  QuoteModuleTabs,
  type QuoteSubTab,
} from "@/features/inventory-management/components/quotation/QuoteModuleTabs";
import { QuoteStatCards } from "@/features/inventory-management/components/quotation/QuoteStatCards";
import { ReceivedQuotesTable } from "@/features/inventory-management/components/quotation/ReceivedQuotesTable";
import { TradeList } from "@/features/inventory-management/components/ui/TradeList";
import { getLowestQuoteValue } from "@/features/inventory-management/lib/quotationStorage";
import {
  QUOTE_AWAITING_TARGET,
  MOCK_QUOTES,
} from "@/features/inventory-management/data/mock-data";
import {
  fetchInboxMonitorItems,
  fetchInventoryTrades,
  fetchQuotesByTrade,
} from "@/features/inventory-management/services/inventoryManagementService";
import type { InboxMonitorItem, InventoryTrade } from "@/features/inventory-management/types";
import type { QuoteRecord } from "@/features/inventory-management/types";
import { cn } from "@/lib/utils";

export function QuotationStorageModule() {
  const [trades, setTrades] = useState<InventoryTrade[]>([]);
  const [activeTradeId, setActiveTradeId] = useState<string>("ict");
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxMonitorItem[]>([]);
  const [subTab, setSubTab] = useState<QuoteSubTab>("received");

  const loadQuotes = useCallback(async (tradeId: string) => {
    setQuotes(await fetchQuotesByTrade(tradeId));
  }, []);

  useEffect(() => {
    void fetchInventoryTrades().then((list) => {
      setTrades(list);
      if (list[0]) setActiveTradeId(list[0].id);
    });
    void fetchInboxMonitorItems().then(setInboxItems);
  }, []);

  useEffect(() => {
    if (activeTradeId) void loadQuotes(activeTradeId);
  }, [activeTradeId, loadQuotes]);

  const activeTrade = trades.find((t) => t.id === activeTradeId);
  const lowestValue = getLowestQuoteValue(quotes);
  const awaitingCount = Math.max(0, QUOTE_AWAITING_TARGET - quotes.length);

  const quoteCountByTrade = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const trade of trades) {
      counts[trade.id] = MOCK_QUOTES[trade.id]?.length ?? 0;
    }
    return counts;
  }, [trades]);

  return (
    <ModuleShell
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      sidebar={
        <TradeList
          trades={trades}
          activeId={activeTradeId}
          onSelect={setActiveTradeId}
          title="Trades"
          className="h-full min-h-0"
          getMeta={(trade) => {
            const count = quoteCountByTrade[trade.id] ?? 0;
            return (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  count > 0
                    ? "border border-green-600/25 bg-[#EFF8EF] text-[#107C10]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            );
          }}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <QuoteModuleTabs active={subTab} onChange={setSubTab} />

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-5">
          {subTab === "received" && (
            <>
              <QuoteStatCards
                receivedCount={quotes.length}
                lowestValue={lowestValue}
                awaitingCount={awaitingCount}
              />
              <ReceivedQuotesTable
                tradeLabel={activeTrade?.label ?? ""}
                quotes={quotes}
                onAnalyse={() => setSubTab("analysis")}
              />
            </>
          )}

          {subTab === "analysis" && (
            <QuoteAiAnalysisPanel
              quotes={quotes}
              tradeLabel={activeTrade?.label ?? "Trade"}
            />
          )}

          {subTab === "inbox" && <QuoteInboxMonitor items={inboxItems} />}
        </div>
      </div>
    </ModuleShell>
  );
}
