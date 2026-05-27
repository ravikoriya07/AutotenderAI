import {
  computeContractorStats,
  formatStatGbp,
  scoreColor,
} from "@/features/inventory-management/lib/contractorStats";
import type { ContractorStat } from "@/features/inventory-management/types";

type ContractorByTradePanelProps = {
  contractor: ContractorStat;
  threshold: number;
};

export function ContractorByTradePanel({
  contractor,
  threshold,
}: ContractorByTradePanelProps) {
  const st = computeContractorStats(contractor, threshold);
  const byTrade = contractor.history.reduce<
    Record<string, ContractorStat["history"]>
  >((acc, row) => {
    if (!acc[row.trade]) acc[row.trade] = [];
    acc[row.trade].push(row);
    return acc;
  }, {});

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[18px] py-[11px]">
        <h3 className="text-sm font-bold text-[#1A1A2E]">By Trade</h3>
        <span className="text-xs text-[#9BA3BF]">
          Within {st.threshold}% of lowest = competitive
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-[#F5F6FA] text-left">
              {[
                "Trade",
                "Sent",
                "Quoted",
                "Lowest",
                "Competitive",
                "Declined",
                "No Resp",
                "Avg",
                "Score",
              ].map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7399]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byTrade).map(([trade, records]) => {
              const quoted = records.filter(
                (r) => r.quoted != null && r.status === "quote-received"
              );
              const wins = quoted.filter(
                (r) => r.quoted != null && r.lowest != null && r.quoted <= r.lowest
              );
              const within = quoted.filter(
                (r) =>
                  r.quoted != null &&
                  r.lowest != null &&
                  r.quoted <= r.lowest! * (1 + threshold / 100)
              );
              const declined = records.filter((r) => r.status === "declined");
              const noResp = records.filter((r) => r.status === "no-response");
              const avg = quoted.length
                ? Math.round(
                    quoted.reduce((sum, r) => sum + (r.quoted ?? 0), 0) /
                      quoted.length
                  )
                : null;
              const rr = records.length
                ? Math.round((quoted.length / records.length) * 100)
                : 0;
              const cr = quoted.length
                ? Math.round((within.length / quoted.length) * 100)
                : 0;
              const rel = records.length
                ? Math.round(
                    ((records.length - declined.length - noResp.length) /
                      records.length) *
                      100
                  )
                : 0;
              const tradeScore = Math.round(rr * 0.3 + cr * 0.4 + rel * 0.3);

              return (
                <tr key={trade} className="border-b border-border hover:bg-[#F8F9FF]">
                  <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">
                    {trade}
                  </td>
                  <td className="px-3 py-2.5 text-[#4A5272]">{records.length}</td>
                  <td className="px-3 py-2.5 text-[#4A5272]">{quoted.length}</td>
                  <td className="px-3 py-2.5">
                    {wins.length ? (
                      <span className="font-semibold text-[#107C10]">
                        {wins.length} ★
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {within.length ? (
                      <span className="text-[#0D7377]">{within.length}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {declined.length ? (
                      <span className="text-[#C42B1C]">{declined.length}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {noResp.length ? (
                      <span className="text-[#C42B1C]">{noResp.length}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[#4A5272]">
                    {avg != null ? formatStatGbp(avg) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-sm font-bold"
                      style={{ color: scoreColor(tradeScore) }}
                    >
                      {tradeScore}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
