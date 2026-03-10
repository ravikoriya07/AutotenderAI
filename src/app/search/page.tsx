"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { SearchBar } from "@/components/ui/SearchBar";

export default function SearchPage() {
  return (
    <DashboardLayout
      title="Search"
      searchPlaceholder="Search across your documents..."
    >
      <PageContainer>
        <div className="mx-auto max-w-2xl">
          <SearchBar placeholder="Search across your documents..." className="w-full" />
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
