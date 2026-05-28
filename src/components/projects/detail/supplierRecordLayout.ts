export type SupplierFieldGroup = "title" | "highlight" | "contact" | "other";

export type SupplierField = { label: string; value: string };

const normalizeKey = (key: string) => key.trim().toLowerCase();

const TITLE_KEYS = new Set([
  "manufacturer",
  "supplier",
  "company",
  "company name",
  "name",
]);

const HIGHLIGHT_KEYS = new Set([
  "product reference",
  "product_reference",
  "product",
  "product ref",
]);

const CONTACT_KEYS = new Set([
  "address",
  "telephone",
  "phone",
  "tel",
  "mobile",
  "web",
  "website",
  "url",
  "email",
  "e-mail",
]);

/** Preferred display order for contact grid. */
const CONTACT_SORT_ORDER: string[] = [
  "telephone",
  "phone",
  "tel",
  "mobile",
  "email",
  "e-mail",
  "web",
  "website",
  "url",
  "address",
];

export function classifySupplierField(label: string): SupplierFieldGroup {
  const key = normalizeKey(label);
  if (TITLE_KEYS.has(key)) return "title";
  if (HIGHLIGHT_KEYS.has(key)) return "highlight";
  if (CONTACT_KEYS.has(key)) return "contact";
  return "other";
}

function contactSortIndex(label: string): number {
  const key = normalizeKey(label);
  const idx = CONTACT_SORT_ORDER.findIndex(
    (token) => key === token || key.includes(token)
  );
  return idx === -1 ? 999 : idx;
}

export function sortContactFields(fields: SupplierField[]): SupplierField[] {
  return [...fields].sort(
    (a, b) => contactSortIndex(a.label) - contactSortIndex(b.label)
  );
}

export function isFullWidthContact(label: string): boolean {
  const key = normalizeKey(label);
  return key.includes("address");
}

export function shortContactLabel(label: string): string {
  const key = normalizeKey(label);
  if (key.includes("address")) return "Address";
  if (key.includes("phone") || key.includes("tel")) return "Phone";
  if (key.includes("email")) return "Email";
  if (key.includes("web") || key.includes("url")) return "Website";
  return label;
}

export function partitionSupplierRecord(
  record: Record<string, string>
): {
  title: SupplierField | null;
  highlight: SupplierField | null;
  contact: SupplierField[];
  other: SupplierField[];
} {
  const entries = Object.entries(record).filter(
    ([, value]) => value.trim() !== ""
  );

  let title: SupplierField | null = null;
  let highlight: SupplierField | null = null;
  const contact: SupplierField[] = [];
  const other: SupplierField[] = [];

  for (const [label, value] of entries) {
    const item = { label, value };
    switch (classifySupplierField(label)) {
      case "title":
        if (!title) title = item;
        else other.push(item);
        break;
      case "highlight":
        if (!highlight) highlight = item;
        else other.push(item);
        break;
      case "contact":
        contact.push(item);
        break;
      default:
        other.push(item);
    }
  }

  if (!title && entries.length > 0) {
    const [label, value] = entries[0]!;
    title = { label, value };
    const rest = entries.slice(1);
    contact.length = 0;
    other.length = 0;
    for (const [l, v] of rest) {
      const item = { label: l, value: v };
      const group = classifySupplierField(l);
      if (group === "highlight" && !highlight) highlight = item;
      else if (group === "contact") contact.push(item);
      else other.push(item);
    }
  }

  return {
    title,
    highlight,
    contact: sortContactFields(contact),
    other,
  };
}

export function supplierRecordKey(
  record: Record<string, string>,
  index: number
): string {
  const { title, highlight } = partitionSupplierRecord(record);
  return (
    [title?.value, highlight?.value].filter(Boolean).join("|") ||
    `supplier-${index}`
  );
}
