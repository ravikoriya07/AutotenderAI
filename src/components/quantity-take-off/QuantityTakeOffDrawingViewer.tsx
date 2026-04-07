"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { postProjectAction } from "@/services/projectService";
import { CadAnalyzerModule } from "@/components/quantity-take-off/cad-analyzer/CadAnalyzerModule";

/**
 * Reads `job_id` and `path` from the URL, downloads the file, and shows it inside the dashboard layout.
 */
export function QuantityTakeOffDrawingViewer() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobId || !path) {
      setPhase("error");
      return;
    }

    let cancelled = false;

    function revokeCurrent() {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }

    setPhase("loading");
    revokeCurrent();
    setBlobUrl(null);

    void (async () => {
      try {
        const result = await postProjectAction(jobId, "download", [path]);
        if (cancelled) return;
        if (result.kind !== "blob" || result.blob.size === 0) {
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
        const nextUrl = URL.createObjectURL(result.blob);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        revokeCurrent();
        objectUrlRef.current = nextUrl;
        setBlobUrl(nextUrl);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      revokeCurrent();
      setBlobUrl(null);
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
  } else if (phase === "loading" || phase === "idle" || !blobUrl) {
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
      <iframe
        title={path}
        src={blobUrl}
        className="h-full min-h-[min(52dvh,400px)] w-full flex-1 border-0 bg-muted/20"
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col">
      <CadAnalyzerModule canvasContent={canvasContent} />
    </div>
  );
}
