import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const MOCK_SESSIONS = [
  "How does EQUANS Regrema...",
  "Bid strategy for framework...",
  "Compliance requirements...",
];

interface ResearchSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function ResearchSidebar({
  collapsed,
  onCollapsedChange,
}: ResearchSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden flex-col border-r border-border bg-[#f9fafb] transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-14" : "w-[260px]"
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="p-3">
            <Button variant="outline" className="w-full justify-center" size="sm">
              New Session
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              LAST WEEK
            </p>
            <ul className="space-y-1">
              {MOCK_SESSIONS.map((label, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}

