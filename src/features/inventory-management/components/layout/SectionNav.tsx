"use client";

import { cn } from "@/lib/utils";

export type SectionNavItem = {
  id: string;
  label: string;
};

type SectionNavProps = {
  title?: string;
  items: SectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

export function SectionNav({
  title = "Sections",
  items,
  activeId,
  onSelect,
  className,
}: SectionNavProps) {
  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-border bg-card lg:w-52 lg:border-r",
        className
      )}
    >
      <div className="border-b border-border px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-row gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-x-visible lg:p-0">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "shrink-0 rounded-md border-l-0 px-3 py-2.5 text-left text-sm transition-colors lg:w-full lg:rounded-none lg:border-l-2",
                active
                  ? "border-primary bg-primary/5 font-medium text-primary lg:bg-muted/50"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
