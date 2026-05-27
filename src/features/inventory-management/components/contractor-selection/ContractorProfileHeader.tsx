import {
  computeContractorStats,
  contractorStatusColor,
  scoreColor,
} from "@/features/inventory-management/lib/contractorStats";
import type { ContractorStat } from "@/features/inventory-management/types";

type ScoreRingProps = {
  score: number;
};

export function ScoreRing({ score }: ScoreRingProps) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="#E8EAF0"
          strokeWidth="7"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-lg font-bold"
        style={{ color }}
      >
        {score}
      </div>
    </div>
  );
}

type ContractorProfileHeaderProps = {
  contractor: ContractorStat;
  threshold: number;
};

export function ContractorProfileHeader({
  contractor,
  threshold,
}: ContractorProfileHeaderProps) {
  const stats = computeContractorStats(contractor, threshold);
  const statusCol = contractorStatusColor(contractor.status);

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={stats.score} />
          <div className="min-w-0 flex-1">
            <h2 className="mb-1 text-[19px] font-bold text-[#1A1A2E]">
              {contractor.company}
            </h2>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize"
                style={{
                  color: statusCol,
                  backgroundColor: `${statusCol}18`,
                  borderColor: `${statusCol}28`,
                }}
              >
                {contractor.status}
              </span>
              <span className="text-[13px] text-[#6B7399]">{contractor.region}</span>
              <span className="text-[13px] text-[#6B7399]">
                {contractor.trades.join(" · ")}
              </span>
            </div>
            <p className="text-[11.5px] text-[#9BA3BF]">
              Weighted: response 30% · competitiveness 40% · reliability 20% ·
              on-time 10%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
