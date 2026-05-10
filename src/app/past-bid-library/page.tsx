"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PastBidLibraryView } from "@/components/bid-writing/PastBidLibraryView";

export default function PastBidLibraryPage() {
  return (
    <DashboardLayout title="Past Bid Library">
      <PastBidLibraryView showInnerNav />
    </DashboardLayout>
  );
}
