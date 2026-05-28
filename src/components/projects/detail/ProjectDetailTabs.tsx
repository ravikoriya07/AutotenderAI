"use client";

import { resolveTabIcon } from "@/lib/project-detail/tabIcons";
import type { ProjectDetailTab } from "@/types/project-detail";
import { cn } from "@/lib/utils";

type ProjectDetailTabsProps = {
  tabs: ProjectDetailTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
};

export function ProjectDetailTabs({
  tabs,
  activeTabId,
  onTabChange,
}: ProjectDetailTabsProps) {
  return (
    <div className="border-b border-border bg-muted/30 px-1 sm:px-2">
      <div className="-mb-px flex gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = resolveTabIcon(tab.icon);
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-left text-sm font-medium transition-colors sm:px-4",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
