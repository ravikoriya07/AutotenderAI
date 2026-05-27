import { TradeCategoryCard } from "@/features/inventory-management/components/contractor-overview/TradeCategoryCard";
import type {
  ContractorTradeCategory,
  ContractorTradeGroup,
} from "@/features/inventory-management/types/contractor-database";

type TradeGroupSectionProps = {
  group: ContractorTradeGroup;
  onTradeSelect: (trade: ContractorTradeCategory) => void;
};

export function TradeGroupSection({ group, onTradeSelect }: TradeGroupSectionProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          {group.title}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {group.tradeCount} trades · {group.contractorCount}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {group.trades.map((trade) => (
          <TradeCategoryCard
            key={trade.dbKey}
            trade={trade}
            onSelect={onTradeSelect}
          />
        ))}
      </div>
    </section>
  );
}
