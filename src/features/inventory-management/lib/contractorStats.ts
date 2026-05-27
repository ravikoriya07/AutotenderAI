import type { ContractorStat } from "@/features/inventory-management/types";

export type ComputedContractorStats = {
  enquiries: number;
  quoted: number;
  declined: number;
  noResponse: number;
  wins: number;
  within: number;
  late: number;
  responseRate: number;
  competitiveness: number;
  reliability: number;
  onTime: number;
  score: number;
  threshold: number;
};

export function computeContractorStats(
  contractor: ContractorStat,
  threshold: number
): ComputedContractorStats {
  const history = contractor.history;
  const n = history.length;
  const quotedRows = history.filter(
    (row) => row.quoted != null && row.status === "quote-received"
  );
  const declined = history.filter((row) => row.status === "declined").length;
  const noResponse = history.filter((row) => row.status === "no-response").length;
  const wins = quotedRows.filter(
    (row) => row.quoted != null && row.lowest != null && row.quoted <= row.lowest
  ).length;
  const within = quotedRows.filter(
    (row) =>
      row.quoted != null &&
      row.lowest != null &&
      row.quoted <= row.lowest * (1 + threshold / 100)
  ).length;
  const late = history.filter((row) => row.response === "late").length;

  const responseRate = n ? Math.round((quotedRows.length / n) * 100) : 0;
  const competitiveness = quotedRows.length
    ? Math.round((within / quotedRows.length) * 100)
    : 0;
  const reliability = n
    ? Math.round(((n - declined - noResponse) / n) * 100)
    : 0;
  const onTime = quotedRows.length
    ? Math.round(((quotedRows.length - late) / quotedRows.length) * 100)
    : 100;

  const score = Math.round(
    responseRate * 0.3 +
      competitiveness * 0.4 +
      reliability * 0.2 +
      onTime * 0.1
  );

  return {
    enquiries: n,
    quoted: quotedRows.length,
    declined,
    noResponse,
    wins,
    within,
    late,
    responseRate,
    competitiveness,
    reliability,
    onTime,
    score,
    threshold,
  };
}

export function scoreColor(score: number): string {
  if (score >= 75) return "#107C10";
  if (score >= 50) return "#C47B00";
  return "#C42B1C";
}

export const CONTRACTOR_STATUS_COLORS: Record<string, string> = {
  preferred: "#0D7377",
  approved: "#0F6CBD",
  new: "#5B3DA8",
  inactive: "#9BA3BF",
};

export function contractorStatusColor(status: string): string {
  return CONTRACTOR_STATUS_COLORS[status] ?? "#0F6CBD";
}

export function formatStatGbp(value: number | null): string {
  if (value == null) return "—";
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}
