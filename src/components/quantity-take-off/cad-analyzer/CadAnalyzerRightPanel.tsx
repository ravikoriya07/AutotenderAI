"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/**
 * Object metadata + saved objects (static UI). On small screens: collapsible section below canvas.
 */
export function CadAnalyzerRightPanel() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const panelBody = (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Object metadata
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="cad-object-id" className="text-xs font-medium text-foreground">
              Object ID
            </label>
            <Input
              id="cad-object-id"
              placeholder="e.g. ID1"
              readOnly
              className="h-9 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cad-object-name" className="text-xs font-medium text-foreground">
              Object name
            </label>
            <Input
              id="cad-object-name"
              placeholder="e.g. Socket"
              readOnly
              className="h-9 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cad-object-count" className="text-xs font-medium text-foreground">
              Count
            </label>
            <Input
              id="cad-object-count"
              type="number"
              defaultValue={0}
              readOnly
              disabled
              className="h-9 bg-muted/40 tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cad-object-area" className="text-xs font-medium text-foreground">
              Area (m²)
            </label>
            <Input
              id="cad-object-area"
              type="number"
              defaultValue={801.01}
              step={0.01}
              readOnly
              disabled
              className="h-9 bg-muted/40 tabular-nums"
            />
          </div>
        </div>
      </div>

      <Button type="button" className="h-10 w-full" disabled>
        Save this object
      </Button>

      <div className="border-t border-border/80 pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Saved objects
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            0
          </span>
        </div>
        <div className="mb-4 min-h-[4rem] rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-center text-sm text-muted-foreground">
          No saved objects yet
        </div>
        <Button type="button" variant="secondary" className="h-9 w-full" disabled>
          Export all JSON
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex w-full min-w-0 flex-col lg:contents">
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-2 border-t border-border/80 bg-card px-3 py-2.5 text-left text-sm font-medium text-foreground shadow-sm lg:hidden"
        )}
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
      >
        <span className="flex items-center gap-2">
          <PanelRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          Properties
        </span>
        {mobileOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      <aside
        className={cn(
          "w-full min-w-0 flex-col border-t border-border/80 bg-card lg:flex lg:w-[17.5rem] lg:shrink-0 lg:border-l lg:border-t-0",
          mobileOpen ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain p-4 lg:max-h-none">
          {panelBody}
        </div>
      </aside>
    </div>
  );
}
