import { formatQuoteGbp } from "@/features/inventory-management/lib/quotationStorage";

type QuoteStatCardsProps = {
  receivedCount: number;
  lowestValue: number | null;
  awaitingCount: number;
};

function StatCard({
  value,
  label,
  valueClassName,
}: {
  value: string;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-sm">
      <div
        className={`text-2xl font-bold leading-none tracking-tight text-[#1A1A2E] ${valueClassName ?? ""}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-[#6B7399]">{label}</div>
    </div>
  );
}

export function QuoteStatCards({
  receivedCount,
  lowestValue,
  awaitingCount,
}: QuoteStatCardsProps) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard value={String(receivedCount)} label="Quotes Received" />
      <StatCard
        value={lowestValue != null ? formatQuoteGbp(lowestValue) : "—"}
        label="Lowest Quote"
        valueClassName="text-[#107C10]"
      />
      <StatCard value={String(awaitingCount)} label="Awaiting" />
    </div>
  );
}
