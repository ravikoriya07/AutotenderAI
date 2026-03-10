"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your account and preferences."
    >
      <PageContainer>
        <Card className="p-6">
          <p className="text-muted-foreground">Settings content coming soon.</p>
        </Card>
      </PageContainer>
    </DashboardLayout>
  );
}
