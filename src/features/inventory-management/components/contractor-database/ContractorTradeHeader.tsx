import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ContractorTradeHeaderProps = {
  title: string;
  subtitle: string;
  selectedCount: number;
  onAddContact: () => void;
};

export function ContractorTradeHeader({
  title,
  subtitle,
  selectedCount,
  onAddContact,
}: ContractorTradeHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {selectedCount > 0 ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
          )}
        >
          {selectedCount} selected
        </span>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={onAddContact}>
        + Add Contact
      </Button>
      <Link
        href="/inventory-management/enquiry-generation"
        className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Confirm for Enquiry →
      </Link>
    </div>
  );
}
