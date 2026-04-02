"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PanelLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FolderTree, FolderNode } from "@/components/ui/FolderTree";
import { Button } from "@/components/ui/Button";
import { fetchProjectTree } from "@/services/projectService";
import { folderNodesFromProjectTreeResponse } from "@/lib/projectTreeNormalize";
import { toast } from "react-toastify";
import axios from "axios";
import { cn } from "@/lib/utils";
import { LibraryFileListing } from "@/components/library/LibraryFileListing";

function treeLoadErrorMessage(e: unknown): string {
  let message = "Could not load project library.";
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

export type OrganisationLibraryViewProps = {
  jobId: string;
  /** Set false on `/libraries?job_id=` — project dropdown is org-library only. */
  showProjectDropdown?: boolean;
  /** `/library` passes this so the project dropdown drives `jobId` and tree fetch. */
  onProjectJobIdChange?: (jobId: string) => void;
};

/** Shared tree + listing layout used by `/library` and `/libraries?job_id=`. */
export function OrganisationLibraryView({
  jobId,
  showProjectDropdown = true,
  onProjectJobIdChange,
}: OrganisationLibraryViewProps) {
  const [treeNodes, setTreeNodes] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(() =>
    Boolean(jobId.trim()) || !showProjectDropdown
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [projectPickerLoading, setProjectPickerLoading] = useState(
    () => showProjectDropdown
  );
  const [projectCatalogEmpty, setProjectCatalogEmpty] = useState(false);

  useEffect(() => {
    if (!showProjectDropdown) {
      setProjectPickerLoading(false);
      setProjectCatalogEmpty(false);
    }
  }, [showProjectDropdown]);

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

    (async () => {
      setTreeLoading(true);
      setLoadError(null);
      try {
        const raw = await fetchProjectTree(trimmed, ac.signal);
        if (cancelled) return;
        const nodes = folderNodesFromProjectTreeResponse(raw);
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
    setMobileSidebarOpen(false);
  }, []);

  const handleListingSelectedIdChange = useCallback((id: string | null) => {
    setSelectedId(id);
    setMobileSidebarOpen(false);
  }, []);

  const sidebarBody = (
    <>
      <h3 className="mb-3 text-sm font-medium">AutotenderAI Libraries</h3>
      <div className="max-h-[min(70vh,520px)] min-w-0 max-w-full overflow-y-auto overflow-x-hidden pr-1">
        {treeLoading && jobId.trim() ? (
          <div
            className="flex min-h-[120px] items-center justify-center py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : showProjectDropdown && projectPickerLoading ? (
          <div
            className="flex min-h-[120px] items-center justify-center py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : showProjectDropdown &&
          projectCatalogEmpty &&
          !jobId.trim() ? (
          <p className="text-sm text-muted-foreground">
            No projects available.
          </p>
        ) : showProjectDropdown &&
          !jobId.trim() &&
          !projectCatalogEmpty &&
          !projectPickerLoading ? (
          <p className="text-sm text-muted-foreground">
            Select a project above to view its library.
          </p>
        ) : loadError ? (
          <p className="text-sm text-muted-foreground">{loadError}</p>
        ) : treeNodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items in library.</p>
        ) : (
          <FolderTree
            nodes={treeNodes}
            selectedId={selectedId ?? undefined}
            onSelect={handleSelect}
          />
        )}
      </div>
      <h3 className="mt-4 text-sm font-medium">Connected Libraries</h3>
      <p className="mt-2 text-xs text-muted-foreground">None</p>
    </>
  );

  return (
    <>
      <div
        aria-hidden={!mobileSidebarOpen}
        onClick={() => setMobileSidebarOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          mobileSidebarOpen
            ? "opacity-100"
            : "pointer-events-none invisible opacity-0"
        )}
      />
      <div className="flex min-w-0 w-full max-w-full flex-col gap-6 lg:flex-row lg:items-start">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[min(100%,16rem)] max-w-[16rem] shrink-0 transition-transform duration-300 ease-out",
            "lg:relative lg:inset-auto lg:z-0 lg:w-64 lg:max-w-none lg:translate-x-0",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
          aria-hidden={false}
        >
          <Card className="h-full min-w-0 max-w-full overflow-hidden bg-sidebar/5 p-4">
            {sidebarBody}
          </Card>
        </aside>

        <div className="min-w-0 flex-1 lg:min-w-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted lg:hidden"
          >
            <PanelLeft className="h-4 w-4 shrink-0" />
            Libraries
          </button>

          <Card className="min-w-0 overflow-hidden">
            <LibraryFileListing
              jobId={jobId.trim()}
              selectedId={selectedId}
              onSelectedIdChange={handleListingSelectedIdChange}
              showProjectDropdown={showProjectDropdown}
              onProjectJobIdChange={onProjectJobIdChange}
              onProjectPickerLoadingChange={
                showProjectDropdown ? setProjectPickerLoading : undefined
              }
              onProjectCatalogState={
                showProjectDropdown ? setProjectCatalogEmpty : undefined
              }
              newButton={
                <Button size="sm" className="shrink-0">
                  New
                </Button>
              }
              sharedTree={{
                nodes: treeNodes,
                loading: treeLoading,
                error: loadError,
              }}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
