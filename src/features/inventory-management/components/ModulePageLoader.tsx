"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function ModuleLoading() {
  return (
    <div
      className="flex flex-1 items-center justify-center py-16"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export const ProjectDetailsModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/ProjectDetailsModule").then(
      (m) => m.ProjectDetailsModule
    ),
  { loading: ModuleLoading }
);

export const DocumentAbstractionModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/DocumentAbstractionModule").then(
      (m) => m.DocumentAbstractionModule
    ),
  { loading: ModuleLoading }
);

export const ContractorDatabaseModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/ContractorDatabaseModule").then(
      (m) => m.ContractorDatabaseModule
    ),
  { loading: ModuleLoading }
);

export const EnquiryGenerationModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/EnquiryGenerationModule").then(
      (m) => m.EnquiryGenerationModule
    ),
  { loading: ModuleLoading }
);

export const ChasingTrackingModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/ChasingTrackingModule").then(
      (m) => m.ChasingTrackingModule
    ),
  { loading: ModuleLoading }
);

export const QuotationStorageModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/QuotationStorageModule").then(
      (m) => m.QuotationStorageModule
    ),
  { loading: ModuleLoading }
);

export const ContractorSelectionModule = dynamic(
  () =>
    import("@/features/inventory-management/modules/ContractorSelectionModule").then(
      (m) => m.ContractorSelectionModule
    ),
  { loading: ModuleLoading }
);
