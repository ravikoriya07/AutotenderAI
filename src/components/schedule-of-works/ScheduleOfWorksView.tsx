"use client";

import { useEffect, useRef, useState } from "react";
import { SOW_BODY_HTML } from "@/components/schedule-of-works/sowBodyHtml";
import { loadScheduleOfWorksEngine } from "@/lib/schedule-of-works/loadScheduleOfWorksEngine";
import "./schedule-of-works.css";

export function ScheduleOfWorksView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadScheduleOfWorksEngine()
      .then(() => {
        if (cancelled) return;
        setEngineReady(true);
        setEngineError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEngineError(
          err instanceof Error ? err.message : "Failed to initialize module"
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={rootRef} className="sow-module relative h-full min-h-0 w-full">
      <div
        className="flex h-full min-h-0 w-full flex-1"
        dangerouslySetInnerHTML={{ __html: SOW_BODY_HTML }}
        suppressHydrationWarning
      />
      {engineError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-6 text-sm text-destructive">
          {engineError}
        </div>
      ) : null}
      {!engineReady && !engineError ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-sm text-muted-foreground"
          aria-live="polite"
        >
          Loading Schedule of Works…
        </div>
      ) : null}
    </div>
  );
}
