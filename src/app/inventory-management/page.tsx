import { redirect } from "next/navigation";
import { DEFAULT_INVENTORY_MODULE } from "@/features/inventory-management/config/modules";

export default function InventoryManagementIndexPage() {
  redirect(`/inventory-management/${DEFAULT_INVENTORY_MODULE}`);
}
