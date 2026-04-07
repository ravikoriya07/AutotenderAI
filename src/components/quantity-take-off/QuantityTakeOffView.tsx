"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FolderTree, type FolderNode } from "@/components/ui/FolderTree";
import { fetchProjectTree } from "@/services/projectService";
import { folderNodesDrawingBranchFromProjectTreeResponse } from "@/lib/projectTreeNormalize";
import { nodeToProjectActionPath } from "@/lib/libraryListingUtils";
import { toast } from "react-toastify";
import axios from "axios";
import { cn } from "@/lib/utils";

function treeLoadErrorMessage(e: unknown): string {
  let message = "Could not load project tree.";
  if (axios.isAxiosError(e)) {
    const d = e.response?.data;
    if (typeof d === "string" && d.trim()) return d.trim();
    if (d && typeof d === "object" && "detail" in d) {
      const det = (d as { detail: unknown }).detail;
      if (typeof det === "string" && det.trim()) return det.trim();
      if (
        Array.isArray(det) &&
        det[0] &&
        typeof det[0] === "object" &&
        det[0] != null &&
        "msg" in det[0]
      ) {
        return String((det[0] as { msg: unknown }).msg);
      }
    }
  }
  return message;
}

export type QuantityTakeOffViewProps = {
  jobId: string;
};

/**
 * drawing → pdfs branch only — same tree component and styling as Organisation Library sidebar.
 */
export function QuantityTakeOffView({ jobId }: QuantityTakeOffViewProps) {
  const [treeNodes, setTreeNodes] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(() => Boolean(jobId.trim()));

  useEffect(() => {
    const trimmed = jobId.trim();
    if (!trimmed) {
      setTreeLoading(false);
      setLoadError(null);
      setTreeNodes([]);
      setSelectedId(null);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    setSelectedId(null);

    void (async () => {
      setTreeLoading(true);
      setLoadError(null);
      try {
        const raw = await fetchProjectTree(trimmed, ac.signal);
        if (cancelled) return;
        const nodes = folderNodesDrawingBranchFromProjectTreeResponse(raw);
        setTreeNodes(nodes);
        if (nodes.length > 0) {
          setSelectedId(nodes[0].id);
        } else {
          setSelectedId(null);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = treeLoadErrorMessage(e);
        setLoadError(msg);
        toast.error(msg);
        setTreeNodes([]);
        setSelectedId(null);
      } finally {
        if (!cancelled) setTreeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [jobId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleViewFile = useCallback(
    (node: FolderNode) => {
      const jid = jobId.trim();
      if (node.kind !== "file" || !jid) return;
      const path = nodeToProjectActionPath(node, treeNodes);
      if (!path) {
        toast.error("Could not resolve file path.");
        return;
      }
      const u = new URL(
        "/quantity-take-off/view",
        window.location.origin
      );
      u.searchParams.set("job_id", jid);
      u.searchParams.set("path", path);
      const w = window.open(u.toString(), "_blank", "noopener,noreferrer");
      if (!w) {
        toast.info("Allow pop-ups to open the drawing viewer.");
      }
    },
    [jobId, treeNodes]
  );

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4">
      <Card className="min-w-0 overflow-hidden p-4 sm:p-6">
        <h2 className="mb-1 text-sm font-medium text-foreground">
          Drawing files
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Only{" "}
          <span className="font-medium text-foreground/90">drawing → pdfs</span>{" "}
          from your project is shown.
        </p>
        <div
          className={cn(
            "max-h-[min(75dvh,560px)] min-h-[12rem] min-w-0 touch-pan-y overflow-y-auto overscroll-contain overflow-x-hidden rounded-lg border border-border/80 bg-muted/20 p-3 pr-2 sm:max-h-[min(70vh,560px)]"
          )}
        >
          {treeLoading && jobId.trim() ? (
            <div
              className="flex min-h-[160px] items-center justify-center py-10"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !jobId.trim() ? (
            <p className="text-sm text-muted-foreground">
              Select a project in the header to load drawing PDFs.
            </p>
          ) : loadError ? (
            <p className="text-sm text-muted-foreground">{loadError}</p>
          ) : treeNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No <span className="font-medium">drawing → pdfs</span> path was
              found for this project.
            </p>
          ) : (
            <FolderTree
              nodes={treeNodes}
              selectedId={selectedId ?? undefined}
              onSelect={handleSelect}
              defaultExpandAll
              fileLeafIcon="pdf"
              onViewFile={handleViewFile}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
