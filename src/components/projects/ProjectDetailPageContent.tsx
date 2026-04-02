"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  Scale,
  FileWarning,
  Users,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type DetailTabId =
  | "overview"
  | "tender-summary"
  | "contract-review"
  | "missing-documents"
  | "named-suppliers"
  | "competition";

const TAB_CONFIG: {
  id: DetailTabId;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tender-summary", label: "Tender Summary", icon: FileText },
  { id: "contract-review", label: "Contract Review", icon: Scale },
  { id: "missing-documents", label: "Missing Documents", icon: FileWarning },
  { id: "named-suppliers", label: "Named Suppliers", icon: Users },
  { id: "competition", label: "Competition", icon: Trophy },
];

const TENDER_SUMMARY_ROWS: { label: string; value: ReactNode }[] = [
  {
    label: "Project Name",
    value: "Queens Avenue Hostels – Refurbishment Phase 3",
  },
  {
    label: "Tender Return Date",
    value: "24th September 2025 @ 5pm",
  },
  {
    label: "Clarification Deadline",
    value: "18th September 2025 @ 5pm",
  },
  { label: "Client", value: "London Borough of Haringey" },
  { label: "Client Contact", value: "Regan Williams" },
  {
    label: "Contract Administrator",
    value: "Ridge & Partners LLP",
  },
  { label: "CA Contact", value: "Alex Maggs" },
  {
    label: "Principal Designer",
    value: "Matt Harrison - 07827303365",
  },
  { label: "PD Contact", value: "Iryna Yablonska" },
  {
    label: "Mech, Elec, and Struct Engineers",
    value: "Ridge & Partners LLP",
  },
  { label: "QS", value: "Ridge & Partners LLP" },
  { label: "QS Contact", value: "Shaun Haymer" },
  { label: "Building Control", value: "DCK CONSTRUCTION" },
  { label: "Project Budget", value: "£2,750,000" },
  {
    label: "Project Address/es",
    value: (
      <span className="block whitespace-pre-line">
        {[
          "39 Queens Avenue N10 3PE",
          "32 Queens Avenue N10 3PE",
          "9 Queens Avenue N10 3PE",
          "19 Princes Avenue N10 3LS",
        ].join("\n")}
      </span>
    ),
  },
  {
    label: "Project Description",
    value: (
      <div className="space-y-3 text-foreground">
        <p>
          Repairs and reinstatement works to four residential properties.
          Internal and external…
        </p>
        <p className="font-semibold text-foreground">All hostels:</p>
        <p>
          Victorian 3-storey semi-detached residential properties converted into
          a HMO. Each flat has th…
        </p>
        <p>
          The buildings are of a solid brickwork construction with suspended
          timber flooring. The found…
        </p>
        <p>
          tiles, clay tiles, lead and bitumen mineral roll. The fenestrations
          consist of a mixture of single-g…
        </p>
        <p>
          Internally the building has a mixture of carpet and vinyl floor
          finishes, timber skirting, and a mi…
        </p>
      </div>
    ),
  },
];

function TenderSummarySection() {
  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        Tender Summary
      </h2>
      <div className="divide-y divide-border border-t border-border">
        {TENDER_SUMMARY_ROWS.map((row) => (
          <div
            key={row.label}
            className="grid gap-3 py-4 sm:grid-cols-[minmax(0,18rem)_1fr] sm:gap-10 sm:py-5"
          >
            <div className="text-sm font-semibold text-muted-foreground">
              {row.label}
            </div>
            <div className="min-w-0 text-sm font-medium leading-relaxed text-foreground">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <p className="px-1 py-8 text-sm text-muted-foreground">
      {label} — content coming soon.
    </p>
  );
}

export function ProjectDetailPageContent({
  projectId,
}: {
  projectId: string;
}) {
  const [activeTab, setActiveTab] = useState<DetailTabId>("tender-summary");

  return (
    <>
      <Card
        key={projectId || "detail"}
        className="overflow-hidden border-border bg-card p-0 text-card-foreground shadow-sm"
      >
        <div className="border-b border-border bg-muted/30 px-1 sm:px-2">
          <div className="-mb-px flex gap-0 overflow-x-auto">
            {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-left text-sm font-medium transition-colors sm:px-4",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === "tender-summary" ? (
            <TenderSummarySection />
          ) : activeTab === "overview" ? (
            <PlaceholderTab label="Overview" />
          ) : activeTab === "contract-review" ? (
            <PlaceholderTab label="Contract Review" />
          ) : activeTab === "missing-documents" ? (
            <PlaceholderTab label="Missing Documents" />
          ) : activeTab === "named-suppliers" ? (
            <PlaceholderTab label="Named Suppliers" />
          ) : (
            <PlaceholderTab label="Competition" />
          )}
        </div>
      </Card>
    </>
  );
}
