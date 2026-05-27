import type { ReactNode } from "react";
import { formatStatGbp } from "@/features/inventory-management/lib/contractorStats";
import type { ContractorHistoryRow, ContractorStat } from "@/features/inventory-management/types";

type ContractorHistoryPanelProps = {
  contractor: ContractorStat;
  threshold: number;
};

function ResultBadge({
  row,
  threshold,
}: {
  row: ContractorHistoryRow;
  threshold: number;
}) {
  const isLow =
    row.quoted != null && row.lowest != null && row.quoted <= row.lowest;
  const isWithin =
    row.quoted != null &&
    row.lowest != null &&
    row.quoted <= row.lowest * (1 + threshold / 100);
  const diff =
    row.quoted && row.lowest && !isLow
      ? `+${Math.round(((row.quoted - row.lowest) / row.lowest) * 100)}%`
      : null;

  let badge: ReactNode;
  if (row.status === "quote-received") {
    if (isLow) {
      badge = (
        <span className="inline-flex rounded-full border border-green-600/25 bg-[#EFF8EF] px-2 py-0.5 text-[10px] font-medium text-[#107C10]">
          ★ Lowest
        </span>
      );
    } else if (isWithin) {
      badge = (
        <span className="inline-flex rounded-full border border-teal-600/25 bg-[#EBF7F7] px-2 py-0.5 text-[10px] font-medium text-[#0D7377]">
          Within {threshold}%
        </span>
      );
    } else if (diff) {
      badge = (
        <span className="inline-flex rounded-full border border-amber-600/25 bg-[#FFF8E6] px-2 py-0.5 text-[10px] font-medium text-[#C47B00]">
          {diff}
        </span>
      );
    } else {
      badge = (
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Received
        </span>
      );
    }
  } else if (row.status === "declined") {
    badge = (
      <span className="inline-flex rounded-full border border-red-200 bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-medium text-[#C42B1C]">
        Declined
      </span>
    );
  } else if (row.status === "no-response") {
    badge = (
      <span className="inline-flex rounded-full border border-red-200 bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-medium text-[#C42B1C]">
        No Response
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
        {row.status.replace("-", " ")}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {badge}
      {row.response === "late" ? (
        <span className="inline-flex rounded-full border border-amber-600/25 bg-[#FFF8E6] px-2 py-0.5 text-[10px] font-medium text-[#C47B00]">
          Late
        </span>
      ) : null}
    </span>
  );
}

export function ContractorHistoryPanel({
  contractor,
  threshold,
}: ContractorHistoryPanelProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[18px] py-[11px]">
        <h3 className="text-sm font-bold text-[#1A1A2E]">Project History</h3>
        <span className="text-xs text-[#9BA3BF]">
          {contractor.history.length} records
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-[#F5F6FA] text-left">
              {["Project", "Trade", "Quoted", "Lowest", "Result"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]"
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {contractor.history.map((row) => (
              <tr
                key={`${row.proj}-${row.trade}`}
                className="border-b border-border hover:bg-[#F8F9FF]"
              >
                <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">
                  {row.proj}
                </td>
                <td className="px-3 py-2.5 text-[#4A5272]">{row.trade}</td>
                <td className="px-3 py-2.5 text-[#4A5272]">
                  {formatStatGbp(row.quoted)}
                </td>
                <td className="px-3 py-2.5 text-[#6B7399]">
                  {formatStatGbp(row.lowest)}
                </td>
                <td className="px-3 py-2.5">
                  <ResultBadge row={row} threshold={threshold} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
