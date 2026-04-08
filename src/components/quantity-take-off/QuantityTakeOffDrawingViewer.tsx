"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fetchViewFile, toViewFileApiPath } from "@/services/projectService";
import { CadAnalyzerModule } from "@/components/quantity-take-off/cad-analyzer/CadAnalyzerModule";
import { CadPdfCanvasStack } from "@/components/quantity-take-off/cad-analyzer/CadPdfCanvasStack";

/**
 * Reads `job_id` and `path` from the URL, loads the file via GET /view-file, and shows it in the CAD canvas.
 */
export function QuantityTakeOffDrawingViewer() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  useEffect(() => {
    if (!jobId || !path) {
      setPhase("error");
      return;
    }

    let cancelled = false;

    setPhase("loading");
    setPdfBlob(null);

    void (async () => {
      try {
        const result = await fetchViewFile(jobId, toViewFileApiPath(path));
        if (cancelled) return;
        if (result.blob.size === 0) {
          setPhase("error");
          return;
        }
        const ct = (result.contentType ?? "").toLowerCase();
        const probablyJsonError =
          ct.includes("application/json") ||
          (result.blob.size < 65536 &&
            (await result.blob.slice(0, 1).text()) === "{");
        if (probablyJsonError) {
          setPhase("error");
          return;
        }
        if (cancelled) return;
        setPdfBlob(result.blob);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      setPdfBlob(null);
    };
  }, [jobId, path]);

  let canvasContent: ReactNode;
  if (phase === "error") {
    canvasContent = (
      <div
        className="flex h-full min-h-[280px] w-full flex-1 flex-col items-center justify-center bg-muted/30"
        role="region"
        aria-label="Drawing preview unavailable"
      >
        <span className="sr-only">Drawing preview unavailable.</span>
      </div>
    );
  } else if (phase === "loading" || phase === "idle" || !pdfBlob) {
    canvasContent = (
      <div
        className="flex h-full min-h-[280px] w-full flex-1 items-center justify-center bg-muted/20"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  } else {
    canvasContent = (
      <CadPdfCanvasStack
        pdfBlob={pdfBlob}
        className="min-h-[min(52dvh,400px)] flex-1"
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col">
      <CadAnalyzerModule canvasContent={canvasContent} />
    </div>
  );
}
