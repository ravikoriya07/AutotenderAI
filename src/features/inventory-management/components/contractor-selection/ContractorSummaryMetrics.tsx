import {
  computeContractorStats,
  scoreColor,
} from "@/features/inventory-management/lib/contractorStats";
import type { ContractorStat } from "@/features/inventory-management/types";

type ContractorSummaryMetricsProps = {
  contractor: ContractorStat;
  threshold: number;
};

function MetricBox({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-[15px] py-[13px] text-center shadow-sm">
      <div
        className="text-[22px] font-bold leading-none"
        style={color ? { color } : { color: "#1A1A2E" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[#6B7399]">{label}</div>
    </div>
  );
}

export function ContractorSummaryMetrics({
  contractor,
  threshold,
}: ContractorSummaryMetricsProps) {
  const st = computeContractorStats(contractor, threshold);
  const winsColor = scoreColor(st.score);

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <MetricBox value={st.enquiries} label="Enquiries" />
      <MetricBox value={st.quoted} label="Quoted" />
      <MetricBox value={st.wins} label="Lowest" color={winsColor} />
      <MetricBox
        value={st.declined}
        label="Declined"
        color={st.declined > 1 ? "#C42B1C" : undefined}
      />
      <MetricBox
        value={st.noResponse}
        label="No Resp"
        color={st.noResponse > 0 ? "#C42B1C" : undefined}
      />
    </div>
  );
}
