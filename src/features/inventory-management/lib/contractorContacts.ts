import type { InventoryContact } from "@/features/inventory-management/types";

export type ContactSortColumn = "company" | "name" | "tel" | "area";

export function extractContactAreas(contacts: InventoryContact[]): string[] {
  const areas = new Set<string>();
  for (const contact of contacts) {
    if (!contact.area) continue;
    for (const part of contact.area.split(";")) {
      const trimmed = part.trim();
      if (trimmed && trimmed.length < 50) areas.add(trimmed);
    }
  }
  return Array.from(areas).sort((a, b) => a.localeCompare(b));
}

export function filterContacts(
  contacts: InventoryContact[],
  options: {
    search: string;
    area: string;
    selectedOnly: boolean;
    selectedIds: Set<number>;
  }
): InventoryContact[] {
  const q = options.search.trim().toLowerCase();
  return contacts.filter((contact) => {
    if (options.selectedOnly && !options.selectedIds.has(contact.id)) {
      return false;
    }
    if (options.area !== "all" && !contact.area.includes(options.area)) {
      return false;
    }
    if (!q) return true;
    return (
      contact.company.toLowerCase().includes(q) ||
      contact.name.toLowerCase().includes(q) ||
      contact.area.toLowerCase().includes(q)
    );
  });
}

export function sortContacts(
  contacts: InventoryContact[],
  column: ContactSortColumn,
  ascending: boolean
): InventoryContact[] {
  return [...contacts].sort((a, b) => {
    const va = (a[column] ?? "").toLowerCase();
    const vb = (b[column] ?? "").toLowerCase();
    const cmp = va.localeCompare(vb);
    return ascending ? cmp : -cmp;
  });
}

export function primaryArea(area: string): string {
  if (!area) return "";
  return area.split(";")[0]?.trim() ?? "";
}
