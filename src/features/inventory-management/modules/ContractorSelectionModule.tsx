"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/features/inventory-management/components/layout/ModuleShell";
import { ContractorByTradePanel } from "@/features/inventory-management/components/contractor-selection/ContractorByTradePanel";
import { ContractorHistoryPanel } from "@/features/inventory-management/components/contractor-selection/ContractorHistoryPanel";
import { ContractorProfileHeader } from "@/features/inventory-management/components/contractor-selection/ContractorProfileHeader";
import { ContractorScoreBreakdown } from "@/features/inventory-management/components/contractor-selection/ContractorScoreBreakdown";
import {
  ContractorStatsSidebar,
} from "@/features/inventory-management/components/contractor-selection/ContractorStatsSidebar";
import {
  ContractorStatsTabs,
  type ContractorStatsTab,
} from "@/features/inventory-management/components/contractor-selection/ContractorStatsTabs";
import { ContractorSummaryMetrics } from "@/features/inventory-management/components/contractor-selection/ContractorSummaryMetrics";
import { fetchContractorStats } from "@/features/inventory-management/services/inventoryManagementService";
import type { ContractorStat } from "@/features/inventory-management/types";

export function ContractorSelectionModule() {
  const [stats, setStats] = useState<ContractorStat[]>([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(10);
  const [activeTab, setActiveTab] = useState<ContractorStatsTab>("overview");

  useEffect(() => {
    void fetchContractorStats().then((list) => {
      setStats(list);
      if (list[0]) setActiveId(list[0].id);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter((s) => s.company.toLowerCase().includes(q));
  }, [stats, search]);

  const active = stats.find((s) => s.id === activeId);

  return (
    <ModuleShell
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      sidebar={
        <ContractorStatsSidebar
          contractors={filtered}
          activeId={activeId}
          search={search}
          threshold={threshold}
          onSearchChange={setSearch}
          onSelect={(id) => {
            setActiveId(id);
            setActiveTab("overview");
          }}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-2.5">
          <h2 className="text-sm font-semibold text-[#1A1A2E]">
            Contractor Statistics
          </h2>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-[#C47B00]">
            Competitive threshold:
            <input
              type="number"
              min={1}
              max={50}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 10)}
              className="h-8 w-[52px] rounded border border-border bg-background px-2 text-center text-[13px] text-[#1A1A2E]"
            />
            % above lowest
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {active ? (
            <>
              <ContractorProfileHeader
                contractor={active}
                threshold={threshold}
              />
              <ContractorSummaryMetrics
                contractor={active}
                threshold={threshold}
              />
              <ContractorStatsTabs active={activeTab} onChange={setActiveTab} />
              {activeTab === "overview" && (
                <ContractorScoreBreakdown
                  contractor={active}
                  threshold={threshold}
                />
              )}
              {activeTab === "by-trade" && (
                <ContractorByTradePanel
                  contractor={active}
                  threshold={threshold}
                />
              )}
              {activeTab === "history" && (
                <ContractorHistoryPanel
                  contractor={active}
                  threshold={threshold}
                />
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-[#9BA3BF]">
              <div className="text-[32px] opacity-25" aria-hidden>
                📊
              </div>
              <p className="text-sm font-semibold text-[#4A5272]">
                Select a contractor to view statistics
              </p>
            </div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
