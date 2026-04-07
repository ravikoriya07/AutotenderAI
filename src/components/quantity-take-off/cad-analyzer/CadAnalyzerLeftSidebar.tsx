"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  DoorOpen,
  Info,
  LayoutGrid,
  LayoutTemplate,
  PanelLeft,
  PanelsTopLeft,
  ScanSearch,
  Type,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

const MODES = [
  {
    id: "cv",
    title: "Auto Count",
    desc: "Pixel-based matching",
    icon: CircleDot,
    defaultActive: true as const,
  },
  {
    id: "text",
    title: "Text Search",
    desc: "Find rotated text labels",
    icon: Type,
    defaultActive: false,
  },
  {
    id: "floor",
    title: "Floor Area",
    desc: "Calculate room boundaries",
    icon: LayoutGrid,
    defaultActive: false,
  },
  {
    id: "facade",
    title: "Facade",
    desc: "Net area & windows",
    icon: Building2,
    defaultActive: false,
  },
  {
    id: "door",
    title: "Door Finder",
    desc: "Auto detect doors",
    icon: DoorOpen,
    defaultActive: false,
  },
  {
    id: "wall",
    title: "Wall Finder",
    desc: "Auto detect walls & lengths",
    icon: PanelsTopLeft,
    defaultActive: false,
  },
  {
    id: "room",
    title: "Room Finder",
    desc: "Auto detect rooms & areas",
    icon: LayoutTemplate,
    defaultActive: false,
  },
] as const;

/**
 * Left column from `abc.html`: detection modes, per-mode options, upload, selection info, results.
 */
export function CadAnalyzerLeftSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarInner = (
    <div className="space-y-5 p-4">
      <div className="space-y-3">
        <SectionTitle>Detection mode</SectionTitle>
        <div className="space-y-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = Boolean(m.defaultActive);
            return (
              <div
                key={m.id}
                className={cn(
                  "flex cursor-default items-start gap-3 rounded-lg border p-2.5 transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 shadow-sm"
                    : "border-border/60 bg-background hover:bg-muted/40"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
                    active
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-border/80 text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
                <div className="flex shrink-0 items-center pt-1">
                  <input
                    type="radio"
                    name="cad-detection-mode"
                    value={m.id}
                    defaultChecked={active}
                    disabled
                    className="h-4 w-4 accent-primary"
                    aria-label={m.title}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Symbol options</SectionTitle>
        <label className="flex cursor-default items-center gap-2 text-sm text-foreground">
          <input type="checkbox" defaultChecked disabled className="h-4 w-4 rounded accent-primary" />
          <span>Detect rotated symbols</span>
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Confidence threshold</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.01}
              defaultValue={0.7}
              disabled
              className="min-w-0 flex-1 accent-primary"
            />
            <Input
              type="number"
              defaultValue={0.7}
              step={0.01}
              min={0.5}
              max={0.95}
              disabled
              className="h-8 w-[4.5rem] shrink-0 px-2 text-xs tabular-nums"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Search query</SectionTitle>
        <Input
          placeholder="e.g. L2-19, KITCHEN"
          disabled
          className="h-9 text-sm"
        />
        <label className="flex cursor-default items-center gap-2 text-sm text-foreground">
          <input type="checkbox" defaultChecked disabled className="h-4 w-4 rounded accent-primary" />
          <span>Case sensitive</span>
        </label>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Floor settings</SectionTitle>
        <InfoBox>Click inside a room. Scale is auto-calculated.</InfoBox>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Wall settings</SectionTitle>
        <InfoBox>Draw a box. Scale is auto-calculated.</InfoBox>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Room settings</SectionTitle>
        <InfoBox>Draw a box. Scale is auto-calculated.</InfoBox>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Facade settings</SectionTitle>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Confidence</span>
          <Input
            type="number"
            defaultValue={0.6}
            step={0.05}
            min={0.1}
            max={1}
            disabled
            className="h-9 w-24 text-sm tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Door settings</SectionTitle>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Select door types</span>
          <select
            multiple
            disabled
            className="min-h-[4.5rem] w-full rounded-md border border-input bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground"
            defaultValue={["Door"]}
          >
            <option value="Door">Door</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Confidence</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              defaultValue={0.4}
              disabled
              className="min-w-0 flex-1 accent-primary"
            />
            <Input
              type="number"
              defaultValue={0.4}
              step={0.05}
              min={0.1}
              max={1}
              disabled
              className="h-8 w-[4.5rem] shrink-0 px-2 text-xs tabular-nums"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center">
        <input type="file" accept=".pdf" disabled className="hidden" id="cad-pdf-upload" />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground/70" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">Drawing from project</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF is loaded from Quantity take-off. Standalone upload supports CAD drawings up to 200MB.
        </p>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <SectionTitle>Selection info</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(
            [
              ["Type", "—"],
              ["Size", "—"],
              ["Coords", "—"],
              ["Status", "Ready"],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2"
            >
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-0.5 font-mono text-xs text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ScanSearch className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Matches found
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-foreground">0</span>
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              CV
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex w-full min-w-0 flex-col lg:contents">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-border/80 bg-muted/20 px-3 py-2.5 text-left text-sm font-medium text-foreground lg:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
      >
        <span className="flex items-center gap-2">
          <PanelLeft className="h-4 w-4 text-muted-foreground" aria-hidden />
          Detection &amp; configuration
        </span>
        {mobileOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      <aside
        className={cn(
          "flex max-h-[min(55vh,440px)] min-w-0 flex-col border-b border-border/80 bg-card lg:max-h-none lg:w-[min(100%,20rem)] lg:shrink-0 lg:border-b-0 lg:border-r",
          mobileOpen ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:max-h-[min(78dvh,820px)]">
          {sidebarInner}
        </div>
      </aside>
    </div>
  );
}
