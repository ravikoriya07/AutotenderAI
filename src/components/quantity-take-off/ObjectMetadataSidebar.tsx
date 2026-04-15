"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { QtoSavedObjectEntryV1 } from "@/lib/qtoSavedObjectsStorage";

export type ObjectMetadataStatsMode = "count" | "wall" | "room";

export type ObjectMetadataPanelContentProps = {
  objectId: string;
  objectName: string;
  /** Symbol / door / search — read-only count */
  countDisplay: number;
  statsMode: ObjectMetadataStatsMode;
  /** Wall finder — read-only */
  totalWallLengthDisplay: string;
  totalWallsDisplay: number;
  /** Room finder — read-only */
  roomsFoundDisplay: number;
  totalAreaM2Display: string;
  onObjectIdChange: (value: string) => void;
  onObjectNameChange: (value: string) => void;
  errors: { objectId?: string; objectName?: string };
  onSave: () => void;
  saveDisabled: boolean;
  savedObjects: QtoSavedObjectEntryV1[];
  selectedSavedId: string | null;
  onSelectSaved: (id: string | null) => void;
  expandedSavedId: string | null;
  onToggleExpand: (id: string) => void;
  onExportAllJson: () => void;
  /** Anchor for scroll-into-view inside a unified sidebar */
  sectionRef?: React.Ref<HTMLDivElement>;
  sectionId?: string;
  className?: string;
  /** When false, only the saved-objects block is shown (e.g. after switching tools before a new analyze). */
  showObjectDataForm?: boolean;
};

/**
 * Object ID / name form + saved objects (no outer shell). Used inside the unified QTO right sidebar.
 */
export function ObjectMetadataPanelContent({
  objectId,
  objectName,
  countDisplay,
  statsMode,
  totalWallLengthDisplay,
  totalWallsDisplay,
  roomsFoundDisplay,
  totalAreaM2Display,
  onObjectIdChange,
  onObjectNameChange,
  errors,
  onSave,
  saveDisabled,
  savedObjects,
  selectedSavedId,
  onSelectSaved,
  expandedSavedId,
  onToggleExpand,
  onExportAllJson,
  sectionRef,
  sectionId,
  className,
  showObjectDataForm = true,
}: ObjectMetadataPanelContentProps) {
  const countId = React.useId();
  const wallLenId = React.useId();
  const wallNumId = React.useId();
  const roomNumId = React.useId();
  const roomAreaId = React.useId();
  const oid = React.useId();
  const oname = React.useId();

  return (
    <section
      ref={sectionRef}
      id={sectionId}
      className={cn(
        "mt-6 space-y-6 border-t border-border/60 pt-6",
        className
      )}
      aria-labelledby={
        showObjectDataForm && sectionId ? `${sectionId}-heading` : undefined
      }
    >
      {showObjectDataForm ? (
        <>
          <h3
            id={sectionId ? `${sectionId}-heading` : undefined}
            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Object data
          </h3>

          <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor={oid} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Object ID <span className="text-destructive">*</span>
          </label>
          <Input
            id={oid}
            value={objectId}
            onChange={(e) => onObjectIdChange(e.target.value)}
            placeholder="e.g. ID1"
            autoComplete="off"
            aria-invalid={Boolean(errors.objectId)}
            aria-describedby={errors.objectId ? `${oid}-err` : undefined}
            className={cn(errors.objectId && "border-destructive focus-visible:ring-destructive/30")}
          />
          {errors.objectId ? (
            <p id={`${oid}-err`} className="text-xs text-destructive" role="alert">
              {errors.objectId}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={oname} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Object name <span className="text-destructive">*</span>
          </label>
          <Input
            id={oname}
            value={objectName}
            onChange={(e) => onObjectNameChange(e.target.value)}
            placeholder="e.g. Socket"
            autoComplete="off"
            aria-invalid={Boolean(errors.objectName)}
            aria-describedby={errors.objectName ? `${oname}-err` : undefined}
            className={cn(errors.objectName && "border-destructive focus-visible:ring-destructive/30")}
          />
          {errors.objectName ? (
            <p id={`${oname}-err`} className="text-xs text-destructive" role="alert">
              {errors.objectName}
            </p>
          ) : null}
        </div>

        {statsMode === "wall" ? (
          <>
            <div className="space-y-1.5">
              <label
                htmlFor={wallLenId}
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Total wall length
              </label>
              <Input
                id={wallLenId}
                readOnly
                disabled
                value={totalWallLengthDisplay}
                className="cursor-not-allowed bg-muted/40 text-muted-foreground"
                aria-readonly="true"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={wallNumId}
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Total walls
              </label>
              <Input
                id={wallNumId}
                readOnly
                disabled
                value={String(totalWallsDisplay)}
                className="cursor-not-allowed bg-muted/40 text-muted-foreground"
                aria-readonly="true"
              />
              <p className="text-[11px] text-muted-foreground">
                Pre-filled from the last wall analysis response.
              </p>
            </div>
          </>
        ) : statsMode === "room" ? (
          <>
            <div className="space-y-1.5">
              <label
                htmlFor={roomNumId}
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Rooms found
              </label>
              <Input
                id={roomNumId}
                readOnly
                disabled
                value={String(roomsFoundDisplay)}
                className="cursor-not-allowed bg-muted/40 text-muted-foreground"
                aria-readonly="true"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={roomAreaId}
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Total area (m²)
              </label>
              <Input
                id={roomAreaId}
                readOnly
                disabled
                value={totalAreaM2Display}
                className="cursor-not-allowed bg-muted/40 text-muted-foreground"
                aria-readonly="true"
              />
              <p className="text-[11px] text-muted-foreground">
                Pre-filled from the last room analysis response.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor={countId} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Count <span className="text-destructive">*</span>
            </label>
            <Input
              id={countId}
              readOnly
              disabled
              value={String(countDisplay)}
              className="cursor-not-allowed bg-muted/40 text-muted-foreground"
              aria-readonly="true"
            />
            <p className="text-[11px] text-muted-foreground">
              Pre-filled from the last analyze or search response.
            </p>
          </div>
        )}

        <Button
          type="button"
          className="h-10 w-full"
          disabled={saveDisabled}
          onClick={onSave}
        >
          Save this object
        </Button>
      </div>
        </>
      ) : null}

      <div
        className={cn(
          "space-y-3",
          showObjectDataForm && "border-t border-border/60 pt-6"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Saved objects
          </h4>
          <span
            className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground"
            aria-label={`${savedObjects.length} saved`}
          >
            {savedObjects.length}
          </span>
        </div>

        {savedObjects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 px-3 py-4 text-center text-sm text-muted-foreground">
            No saved objects yet
          </p>
        ) : (
          <ul className="space-y-2" role="list">
            {[...savedObjects]
              .sort((a, b) => b.savedAt - a.savedAt)
              .map((entry) => {
                const expanded = expandedSavedId === entry.id;
                const selected = selectedSavedId === entry.id;
                return (
                  <li key={entry.id}>
                    <div
                      className={cn(
                        "overflow-hidden rounded-lg border transition-colors",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/25"
                          : "border-border/70 bg-card/40"
                      )}
                    >
                      <div className="flex min-w-0 items-stretch gap-0">
                        <button
                          type="button"
                          className={cn(
                            "min-w-0 flex-1 px-3 py-2.5 text-left text-sm font-medium leading-snug text-foreground",
                            "transition-colors hover:bg-muted/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                          )}
                          onClick={() => onSelectSaved(entry.id)}
                          aria-pressed={selected}
                        >
                          <span className="line-clamp-2">
                            {entry.objectId} — {entry.objectName}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="flex w-11 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          aria-label={expanded ? "Collapse" : "Expand"}
                          aria-expanded={expanded}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(entry.id);
                          }}
                        >
                          {expanded ? (
                            <ChevronUp className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                      {expanded ? (
                        <div className="border-t border-border/50 px-3 py-2.5 text-sm">
                          {entry.analysisKind === "walls" ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  Total wall length
                                </span>
                                <span className="tabular-nums font-medium text-foreground">
                                  {entry.totalWallLengthM != null
                                    ? `${entry.totalWallLengthM.toFixed(2)} m`
                                    : "—"}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  Total walls
                                </span>
                                <span className="tabular-nums font-medium text-foreground">
                                  {entry.count}
                                </span>
                              </div>
                            </>
                          ) : entry.analysisKind === "rooms" ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  Rooms found
                                </span>
                                <span className="tabular-nums font-medium text-foreground">
                                  {entry.count}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  Total area (m²)
                                </span>
                                <span className="tabular-nums font-medium text-foreground">
                                  {entry.totalAreaM2 != null
                                    ? entry.totalAreaM2.toFixed(2)
                                    : "—"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Count</span>
                              <span className="tabular-nums font-medium text-foreground">
                                {entry.count}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                            <span>ID: {entry.objectId}</span>
                            <span>Name: {entry.objectName}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          className="h-10 w-full border-primary/40 text-primary hover:bg-primary/10"
          disabled={savedObjects.length === 0}
          onClick={onExportAllJson}
        >
          Export all JSON
        </Button>
      </div>
    </section>
  );
}

export type ObjectMetadataSidebarProps = ObjectMetadataPanelContentProps & {
  open: boolean;
  onClose: () => void;
  className?: string;
  onTransitionEnd?: React.ComponentPropsWithoutRef<"aside">["onTransitionEnd"];
};

/**
 * Standalone right overlay (legacy). Prefer {@link ObjectMetadataPanelContent} inside the unified QTO sidebar.
 */
export function ObjectMetadataSidebar({
  open,
  onClose,
  className,
  onTransitionEnd,
  ...contentProps
}: ObjectMetadataSidebarProps) {
  return (
    <aside
      className={cn(
        "absolute bottom-0 right-0 top-0 z-[52] flex max-h-full min-h-0 flex-col",
        "border-l border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-md",
        "rounded-l-lg",
        "w-full min-w-0 sm:max-w-[min(100vw,400px)] sm:w-[360px]",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        open ? "translate-x-0" : "translate-x-full",
        className
      )}
      aria-modal="true"
      role="dialog"
      aria-label="Object metadata"
      aria-hidden={!open}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Object metadata</h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent",
            "text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/80 hover:text-foreground"
          )}
          aria-label="Close object metadata panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-4 pt-3 sm:px-3">
        <ObjectMetadataPanelContent {...contentProps} />
      </div>
    </aside>
  );
}
