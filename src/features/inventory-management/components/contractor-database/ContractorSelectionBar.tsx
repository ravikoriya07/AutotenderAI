import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { INQUIRY_MANAGEMENT_BASE } from "@/features/inventory-management/config/modules";

type ContractorSelectionBarProps = {
  selectedCount: number;
  onClear: () => void;
};

export function ContractorSelectionBar({
  selectedCount,
  onClear,
}: ContractorSelectionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
      <span className="text-sm font-semibold text-primary">
        {selectedCount} contacts selected
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Link
          href={`${INQUIRY_MANAGEMENT_BASE}/enquiry-generation`}
          className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Confirm for Enquiry →
        </Link>
      </div>
    </div>
  );
}
