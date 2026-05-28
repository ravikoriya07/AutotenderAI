import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FileSearch,
  FileText,
  Mail,
  Package,
  Users,
  Workflow,
} from "lucide-react";

export const INQUIRY_MANAGEMENT_LABEL = "Inquiry Management";
export const INQUIRY_MANAGEMENT_BASE = "/inquiry-management";

/** @deprecated Use INQUIRY_MANAGEMENT_BASE */
export const INVENTORY_MANAGEMENT_BASE = INQUIRY_MANAGEMENT_BASE;

export type InventoryModuleSlug =
  | "project-details"
  | "document-abstraction"
  | "contractor-database"
  | "enquiry-generation"
  | "chasing-tracking"
  | "quotation-storage"
  | "contractor-selection";

export type InventoryModuleConfig = {
  slug: InventoryModuleSlug;
  href: `${typeof INQUIRY_MANAGEMENT_BASE}/${InventoryModuleSlug}`;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const INVENTORY_MODULES: InventoryModuleConfig[] = [
  {
    slug: "project-details",
    href: "/inquiry-management/project-details",
    label: "Project Details",
    description: "Core project information, dates, contract, and works scope.",
    icon: FileText,
  },
  {
    slug: "document-abstraction",
    href: "/inquiry-management/document-abstraction",
    label: "Document Abstraction",
    description: "Select standard and trade-specific documents per package.",
    icon: FileSearch,
  },
  {
    slug: "contractor-database",
    href: "/inquiry-management/contractor-database",
    label: "Contractor Database",
    description: "Review and select contractors by trade.",
    icon: Users,
  },
  {
    slug: "enquiry-generation",
    href: "/inquiry-management/enquiry-generation",
    label: "Enquiry Generation",
    description: "Compose, preview, and send tender enquiries.",
    icon: Mail,
  },
  {
    slug: "chasing-tracking",
    href: "/inquiry-management/chasing-tracking",
    label: "Chasing & Tracking",
    description: "Monitor responses, chasers, and enquiry status.",
    icon: Workflow,
  },
  {
    slug: "quotation-storage",
    href: "/inquiry-management/quotation-storage",
    label: "Quotation Storage",
    description: "Received quotes, AI analysis, and inbox monitoring.",
    icon: Package,
  },
  {
    slug: "contractor-selection",
    href: "/inquiry-management/contractor-selection",
    label: "Contractor Selection",
    description: "Historical performance and contractor statistics.",
    icon: BarChart3,
  },
];

export function getInventoryModule(slug: string): InventoryModuleConfig | undefined {
  return INVENTORY_MODULES.find((m) => m.slug === slug);
}

export const DEFAULT_INVENTORY_MODULE: InventoryModuleSlug = "project-details";
