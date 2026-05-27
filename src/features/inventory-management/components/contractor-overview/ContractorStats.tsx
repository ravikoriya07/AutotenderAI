import { cn } from "@/lib/utils";
import type { ContractorOverviewStats } from "@/features/inventory-management/types/contractor-database";

type ContractorStatsProps = {
  stats: ContractorOverviewStats;
};

function StatCard({
  value,
  label,
  highlight,
}: {
  value: number | string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-sm">
      <div
        className={cn(
          "text-2xl font-bold leading-none tracking-tight",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function ContractorStats({ stats }: ContractorStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard value={stats.tradeCategories} label="Trade Categories" />
      <StatCard value={stats.totalContractors} label="Total Contractors" />
      <StatCard
        value={stats.selectedForEnquiry}
        label="Selected for Enquiry"
        highlight={stats.selectedForEnquiry > 0}
      />
    </div>
  );
}
