"use client";

import { useMemo } from "react";
import { ContractorStats } from "@/features/inventory-management/components/contractor-overview/ContractorStats";
import { TradeGroupSection } from "@/features/inventory-management/components/contractor-overview/TradeGroupSection";
import { SectionHeader } from "@/features/inventory-management/components/ui/SectionHeader";
import {
  buildContractorOverview,
  toContractorTradeId,
} from "@/features/inventory-management/lib/contractorDatabase";
import type { ContractorTradeCategory } from "@/features/inventory-management/types/contractor-database";

type ContractorOverviewProps = {
  selectedContactIds: Set<number>;
  onTradeSelect: (tradeId: string) => void;
};

export function ContractorOverview({
  selectedContactIds,
  onTradeSelect,
}: ContractorOverviewProps) {
  const overview = useMemo(
    () => buildContractorOverview(selectedContactIds),
    [selectedContactIds]
  );

  const handleTradeSelect = (trade: ContractorTradeCategory) => {
    onTradeSelect(toContractorTradeId(trade.dbKey, trade.projectTradeId));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="All Contractors"
        description={`${overview.stats.totalContractors} companies across all trades · ${overview.stats.selectedForEnquiry} selected`}
      />
      <ContractorStats stats={overview.stats} />
      <div className="space-y-8">
        {overview.groups.map((group) => (
          <TradeGroupSection
            key={group.title}
            group={group}
            onTradeSelect={handleTradeSelect}
          />
        ))}
      </div>
    </div>
  );
}
