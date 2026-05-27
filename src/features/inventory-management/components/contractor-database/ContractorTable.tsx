"use client";

import { Button } from "@/components/ui/Button";
import type { ContactSortColumn } from "@/features/inventory-management/lib/contractorContacts";
import { primaryArea } from "@/features/inventory-management/lib/contractorContacts";
import type { InventoryContact } from "@/features/inventory-management/types";
import { cn } from "@/lib/utils";

type ContractorTableProps = {
  contacts: InventoryContact[];
  selectedIds: Set<number>;
  sortColumn: ContactSortColumn;
  sortAscending: boolean;
  onSort: (column: ContactSortColumn) => void;
  onToggleSelect: (id: number) => void;
  onView: (contact: InventoryContact) => void;
};

function SortableHeader({
  label,
  column,
  activeColumn,
  ascending,
  onSort,
}: {
  label: string;
  column: ContactSortColumn;
  activeColumn: ContactSortColumn;
  ascending: boolean;
  onSort: (column: ContactSortColumn) => void;
}) {
  const active = activeColumn === column;
  return (
    <th className="px-4 py-2.5">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "text-left text-xs uppercase tracking-wide transition-colors hover:text-foreground",
          active ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (ascending ? " ↑" : " ↓") : null}
      </button>
    </th>
  );
}

export function ContractorTable({
  contacts,
  selectedIds,
  sortColumn,
  sortAscending,
  onSort,
  onToggleSelect,
  onView,
}: ContractorTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="w-9 px-4 py-2.5" />
            <SortableHeader
              label="Company"
              column="company"
              activeColumn={sortColumn}
              ascending={sortAscending}
              onSort={onSort}
            />
            <SortableHeader
              label="Contact Name"
              column="name"
              activeColumn={sortColumn}
              ascending={sortAscending}
              onSort={onSort}
            />
            <SortableHeader
              label="Telephone"
              column="tel"
              activeColumn={sortColumn}
              ascending={sortAscending}
              onSort={onSort}
            />
            <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
              Email
            </th>
            <SortableHeader
              label="Area"
              column="area"
              activeColumn={sortColumn}
              ascending={sortAscending}
              onSort={onSort}
            />
            <th className="w-[72px] px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {contacts.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                No contacts match the filter
              </td>
            </tr>
          ) : (
            contacts.map((contact) => {
              const selected = selectedIds.has(contact.id);
              const email =
                contact.email && contact.email.includes("@")
                  ? contact.email
                  : "";
              const emailDisplay =
                email.length > 36 ? `${email.slice(0, 36)}…` : email;

              return (
                <tr
                  key={contact.id}
                  className={cn(
                    "border-b border-border/60 transition-colors hover:bg-muted/40",
                    selected && "bg-primary/[0.04]"
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selected}
                      onChange={() => onToggleSelect(contact.id)}
                      aria-label={`Select ${contact.company}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {contact.company}
                    </div>
                    {contact.name ? (
                      <div className="text-xs text-muted-foreground">
                        {contact.name}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted-foreground">
                    {contact.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted-foreground">
                    {contact.tel || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        className="text-primary hover:underline"
                      >
                        {emailDisplay}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {primaryArea(contact.area) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(contact)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
