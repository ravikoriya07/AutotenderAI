"use client";

import { Button } from "@/components/ui/Button";
import { primaryArea } from "@/features/inventory-management/lib/contractorContacts";
import type { InventoryContact } from "@/features/inventory-management/types";

type ContactDetailPanelProps = {
  contact: InventoryContact;
  selected: boolean;
  onToggleSelection: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2.5 border-b border-border py-2 last:border-b-0">
      <div className="w-[60px] shrink-0 text-[11.5px] font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 flex-1 break-words text-[12.5px] leading-relaxed text-foreground">
        {value}
      </div>
    </div>
  );
}

export function ContactDetailPanel({
  contact,
  selected,
  onToggleSelection,
}: ContactDetailPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-0">
        <DetailRow label="Name" value={contact.name || "—"} />
        <DetailRow label="Phone" value={contact.tel || "—"} />
        <DetailRow label="Email" value={contact.email || "—"} />
        <DetailRow label="Area" value={primaryArea(contact.area) || "—"} />
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant={selected ? "secondary" : "default"}
          onClick={onToggleSelection}
        >
          {selected ? "✓ Added to Enquiry List" : "+ Add to Enquiry List"}
        </Button>
        <Button type="button" variant="outline">
          Edit Contact
        </Button>
      </div>
    </div>
  );
}
