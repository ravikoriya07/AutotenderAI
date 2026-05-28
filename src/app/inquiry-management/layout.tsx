"use client";

import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InventoryWorkflowProvider } from "@/features/inventory-management/context/InventoryWorkflowContext";
import {
  getInventoryModule,
  INQUIRY_MANAGEMENT_LABEL,
} from "@/features/inventory-management/config/modules";

export default function InventoryManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const slug = pathname?.split("/").pop() ?? "";
  const moduleMeta = getInventoryModule(slug);

  return (
    <DashboardLayout
      title={moduleMeta?.label ?? INQUIRY_MANAGEMENT_LABEL}
      fullHeight
    >
      <InventoryWorkflowProvider>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </InventoryWorkflowProvider>
    </DashboardLayout>
  );
}
