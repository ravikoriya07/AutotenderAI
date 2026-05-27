"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ModuleShell } from "@/features/inventory-management/components/layout/ModuleShell";
import { SectionCard } from "@/features/inventory-management/components/ui/SectionCard";
import { SectionHeader } from "@/features/inventory-management/components/ui/SectionHeader";
import { TradeList } from "@/features/inventory-management/components/ui/TradeList";
import {
  fetchInventoryTrades,
  fetchStandardDocuments,
  fetchTradeDocuments,
} from "@/features/inventory-management/services/inventoryManagementService";
import type { InventoryTrade, TradeDocument } from "@/features/inventory-management/types";
import { cn } from "@/lib/utils";

export function DocumentAbstractionModule() {
  const [trades, setTrades] = useState<InventoryTrade[]>([]);
  const [activeTradeId, setActiveTradeId] = useState<string>("ict");
  const [standardDocs, setStandardDocs] = useState<string[]>([]);
  const [tradeDocs, setTradeDocs] = useState<TradeDocument[]>([]);
  const [selectedStd, setSelectedStd] = useState<Set<number>>(() => new Set());
  const [selectedTrade, setSelectedTrade] = useState<Set<number>>(() => new Set());

  const loadTrade = useCallback(async (tradeId: string) => {
    const [std, td] = await Promise.all([
      fetchStandardDocuments(),
      fetchTradeDocuments(tradeId),
    ]);
    setStandardDocs(std);
    setTradeDocs(td);
    setSelectedStd(new Set(std.map((_, i) => i)));
    setSelectedTrade(new Set(td.map((_, i) => i)));
  }, []);

  useEffect(() => {
    void fetchInventoryTrades().then((list) => {
      setTrades(list);
      if (list[0]) setActiveTradeId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (activeTradeId) void loadTrade(activeTradeId);
  }, [activeTradeId, loadTrade]);

  const activeTrade = trades.find((t) => t.id === activeTradeId);

  const toggleStd = (i: number, checked: boolean) => {
    setSelectedStd((prev) => {
      const next = new Set(prev);
      if (checked) next.add(i);
      else next.delete(i);
      return next;
    });
  };

  const toggleTradeDoc = (i: number, checked: boolean) => {
    setSelectedTrade((prev) => {
      const next = new Set(prev);
      if (checked) next.add(i);
      else next.delete(i);
      return next;
    });
  };

  return (
    <ModuleShell
      sidebar={
        <TradeList
          trades={trades}
          activeId={activeTradeId}
          onSelect={setActiveTradeId}
          title="Trades"
        />
      }
    >
      {activeTrade ? (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title={activeTrade.label}
              description="Select documents for this trade's enquiry package"
            />
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {selectedStd.size + selectedTrade.size} selected
            </span>
          </div>

          <SectionCard className="mb-4 border-l-4 border-l-teal-600">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-teal-800">
                  AI Document Analysis — {activeTrade.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recommends <strong>{standardDocs.length} standard</strong> +{" "}
                  <strong>{tradeDocs.length} trade-specific</strong> documents.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadTrade(activeTradeId)}>
                Re-run
              </Button>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <DocChecklistCard
              title="Standard Information"
              badge={`${selectedStd.size} / ${standardDocs.length}`}
              onToggleAll={() => {
                if (selectedStd.size === standardDocs.length) setSelectedStd(new Set());
                else setSelectedStd(new Set(standardDocs.map((_, i) => i)));
              }}
            >
              {standardDocs.map((doc, i) => (
                <label
                  key={doc}
                  className="flex cursor-pointer items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selectedStd.has(i)}
                    onChange={(e) => toggleStd(i, e.target.checked)}
                  />
                  <span className="text-sm">{doc}</span>
                </label>
              ))}
            </DocChecklistCard>

            <DocChecklistCard
              title="Trade-Specific"
              badge={`${selectedTrade.size} / ${tradeDocs.length}`}
              onToggleAll={() => {
                if (selectedTrade.size === tradeDocs.length) setSelectedTrade(new Set());
                else setSelectedTrade(new Set(tradeDocs.map((_, i) => i)));
              }}
            >
              {tradeDocs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No trade-specific documents
                </p>
              ) : (
                tradeDocs.map((doc, i) => (
                  <label
                    key={doc.name}
                    className="flex cursor-pointer items-start gap-3 border-b border-border/60 py-2.5 last:border-0"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={selectedTrade.has(i)}
                      onChange={(e) => toggleTradeDoc(i, e.target.checked)}
                    />
                    <div>
                      <div className="text-sm">{doc.name}</div>
                      <div className="text-xs text-muted-foreground">{doc.type}</div>
                    </div>
                  </label>
                ))
              )}
            </DocChecklistCard>
          </div>
        </>
      ) : null}
    </ModuleShell>
  );
}

function DocChecklistCard({
  title,
  badge,
  onToggleAll,
  children,
}: {
  title: string;
  badge: string;
  onToggleAll: () => void;
  children: ReactNode;
}) {
  return (
    <SectionCard
      header={
        <>
          <span className="text-sm font-semibold">{title}</span>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium")}>
              {badge}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={onToggleAll}>
              Toggle All
            </Button>
          </div>
        </>
      }
    >
      {children}
    </SectionCard>
  );
}
