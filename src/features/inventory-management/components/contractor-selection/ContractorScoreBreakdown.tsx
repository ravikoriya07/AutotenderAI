import {
  computeContractorStats,
} from "@/features/inventory-management/lib/contractorStats";
import type { ContractorStat } from "@/features/inventory-management/types";

type ContractorScoreBreakdownProps = {
  contractor: ContractorStat;
  threshold: number;
};

const METRIC_COLORS = {
  response: "#0F6CBD",
  competitiveness: "#0D7377",
  reliability: "#5B3DA8",
  onTime: "#C47B00",
} as const;

export function ContractorScoreBreakdown({
  contractor,
  threshold,
}: ContractorScoreBreakdownProps) {
  const st = computeContractorStats(contractor, threshold);

  const items = [
    {
      label: "Response Rate",
      percent: `${st.responseRate}%`,
      score: Math.round(st.responseRate * 0.3),
      max: 30,
      color: METRIC_COLORS.response,
    },
    {
      label: "Competitiveness",
      percent: `${st.competitiveness}%`,
      score: Math.round(st.competitiveness * 0.4),
      max: 40,
      color: METRIC_COLORS.competitiveness,
    },
    {
      label: "Reliability",
      percent: `${st.reliability}%`,
      score: Math.round(st.reliability * 0.2),
      max: 20,
      color: METRIC_COLORS.reliability,
    },
    {
      label: "On-Time",
      percent: `${st.onTime}%`,
      score: Math.round(st.onTime * 0.1),
      max: 10,
      color: METRIC_COLORS.onTime,
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[11px]">
        <h3 className="text-sm font-bold text-[#1A1A2E]">Score Breakdown</h3>
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-[#EFF6FC] px-2.5 py-0.5 text-xs font-medium text-[#0F6CBD]">
          {st.score} / 100
        </span>
      </div>
      <div className="px-5 py-1">
        {items.map((item) => {
          const barPercent = item.max
            ? Math.round((item.score / item.max) * 100)
            : 0;
          return (
            <div
              key={item.label}
              className="flex items-center border-b border-border py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[13px] font-semibold text-[#1A1A2E]">
                  {item.label}{" "}
                  <span className="text-[12px] font-normal text-[#6B7399]">
                    {item.percent}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded border border-border bg-[#F5F6FA]">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${barPercent}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <div
                  className="text-[17px] font-bold leading-none"
                  style={{ color: item.color }}
                >
                  {item.score}
                </div>
                <div className="text-[10px] text-[#9BA3BF]">/ {item.max}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
