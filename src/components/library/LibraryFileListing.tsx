"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import {
  Archive,
  ChevronLeft,
  Download,
  Loader2,
  Trash2,
} from "lucide-react";
import { fetchProjectTree } from "@/services/projectService";
import {
  fetchCompletedSteps,
  flattenProjectsFromCompletedSteps,
  type CompletedStepStat,
} from "@/services/statsService";
import {
  folderNodesFromProjectTreeResponse,
  formatBytes,
} from "@/lib/projectTreeNormalize";
import axios from "axios";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import {
  FileManagerItemIcon,
  getFileManagerIconKind,
} from "@/components/library/FileManagerItemIcon";
import type { FolderNode } from "@/components/ui/FolderTree";
import { buildIdMap, findPathToNode } from "@/lib/libraryListingUtils";

/** Parent-fetched tree so sidebar + listing share one GET /project-tree call. */
export type LibrarySharedTreeState = {
  nodes: FolderNode[];
  loading: boolean;
  error: string | null;
};

export type LibraryFileListingProps = {
  jobId: string;
  /** Optional: e.g. close mobile sidebar when navigating folders on Library page */
  onNavigate?: () => void;
  /** Controlled selection (Library page + sidebar tree). Omit for Extract page (internal only). */
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  /** When set, listing does not fetch; uses data from OrganisationLibraryView. */
  sharedTree?: LibrarySharedTreeState;
  /** Shown on the top toolbar right, before bulk actions (e.g. Organisation Library "New"). */
  newButton?: ReactNode;
  /** When false, hides the project step dropdown and skips stats fetch (e.g. `/libraries?job_id=`). */
  showProjectDropdown?: boolean;
  /** When set, dropdown value follows `jobId` and changes notify parent (Organisation Library dynamic project). */
  onProjectJobIdChange?: (jobId: string) => void;
  onProjectPickerLoadingChange?: (loading: boolean) => void;
  onProjectCatalogState?: (empty: boolean) => void;
};

export function LibraryFileListing({
  jobId,
  onNavigate,
  selectedId: selectedIdProp,
  onSelectedIdChange,
  sharedTree,
  newButton,
  showProjectDropdown = true,
  onProjectJobIdChange,
  onProjectPickerLoadingChange,
  onProjectCatalogState,
}: LibraryFileListingProps) {
  const controlled = onSelectedIdChange != null;
  const projectJobFromParent = Boolean(onProjectJobIdChange);
  const useSharedTree = sharedTree !== undefined;
  const [treeNodes, setTreeNodes] = useState<FolderNode[]>([]);
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<
    string | null
  >(null);

  const selectedId = controlled
    ? (selectedIdProp ?? null)
    : uncontrolledSelectedId;
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<CompletedStepStat[]>(
    []
  );
  const [stepsLoading, setStepsLoading] = useState(true);
  const [selectedProjectJobId, setSelectedProjectJobId] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);

  const nodeMap = useMemo(() => buildIdMap(treeNodes), [treeNodes]);

  const projectOptions = useMemo(
    () => flattenProjectsFromCompletedSteps(completedSteps),
    [completedSteps]
  );

  const selectedNode = useMemo(() => {
    if (!selectedId || treeNodes.length === 0) return null;
    return nodeMap.get(selectedId) ?? null;
  }, [selectedId, treeNodes, nodeMap]);

  const isFileSelected = selectedNode?.kind === "file";
  const folderChildren =
    selectedNode && selectedNode.kind !== "file"
      ? (selectedNode.children ?? [])
      : [];

  useEffect(() => {
    if (!useSharedTree || !sharedTree) return;
    setTreeNodes(sharedTree.nodes);
    setTreeLoading(sharedTree.loading);
    setLoadError(sharedTree.error);
  }, [
    useSharedTree,
    sharedTree?.nodes,
    sharedTree?.loading,
    sharedTree?.error,
  ]);

  useEffect(() => {
    if (!showProjectDropdown) {
      setStepsLoading(false);
      setCompletedSteps([]);
      setSelectedProjectJobId("");
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setStepsLoading(true);
    void (async () => {
      try {
        const rows = await fetchCompletedSteps({ signal: ac.signal });
        if (!cancelled) setCompletedSteps(rows);
      } finally {
        if (!cancelled) setStepsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [showProjectDropdown]);

  useEffect(() => {
    if (!showProjectDropdown) {
      onProjectPickerLoadingChange?.(false);
      return;
    }
    onProjectPickerLoadingChange?.(stepsLoading);
  }, [showProjectDropdown, stepsLoading, onProjectPickerLoadingChange]);

  useEffect(() => {
    if (!showProjectDropdown || stepsLoading) return;
    onProjectCatalogState?.(projectOptions.length === 0);
  }, [
    showProjectDropdown,
    stepsLoading,
    projectOptions.length,
    onProjectCatalogState,
  ]);

  useEffect(() => {
    if (useSharedTree) return;

    if (!jobId.trim()) {
      setTreeLoading(false);
      setLoadError(null);
      setTreeNodes([]);
      if (!controlled) setUncontrolledSelectedId(null);
      else onSelectedIdChange?.(null);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      setTreeLoading(true);
      setLoadError(null);
      try {
        const raw = await fetchProjectTree(jobId.trim(), ac.signal);
        if (cancelled) return;
        const nodes = folderNodesFromProjectTreeResponse(raw);
        setTreeNodes(nodes);
        if (nodes.length > 0) {
          if (!controlled) {
            setUncontrolledSelectedId((prev) => prev ?? nodes[0].id);
          }
        } else {
          if (!controlled) setUncontrolledSelectedId(null);
        }
      } catch (e) {
        if (cancelled) return;
        let message = "Could not load project library.";
        if (axios.isAxiosError(e)) {
          const d = e.response?.data;
          if (typeof d === "string" && d.trim()) message = d.trim();
          else if (d && typeof d === "object" && "detail" in d) {
            const det = (d as { detail: unknown }).detail;
            if (typeof det === "string" && det.trim()) message = det.trim();
            else if (Array.isArray(det) && det[0] && typeof det[0] === "object" && det[0] != null && "msg" in det[0]) {
              message = String((det[0] as { msg: unknown }).msg);
            }
          }
        }
        setLoadError(message);
        toast.error(message);
        setTreeNodes([]);
        if (!controlled) setUncontrolledSelectedId(null);
      } finally {
        if (!cancelled) setTreeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [jobId, controlled, useSharedTree, onSelectedIdChange]);

  const handleSelect = useCallback(
    (id: string) => {
      if (controlled) onSelectedIdChange?.(id);
      else setUncontrolledSelectedId(id);
      onNavigate?.();
    },
    [controlled, onSelectedIdChange, onNavigate]
  );

  useEffect(() => {
    setTableSelectedIds(new Set());
  }, [selectedId]);

  const toggleTableRow = useCallback((id: string) => {
    setTableSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllTable = useCallback(() => {
    setTableSelectedIds((prev) => {
      if (folderChildren.length === 0) return new Set();
      if (prev.size === folderChildren.length) return new Set();
      return new Set(folderChildren.map((c) => c.id));
    });
  }, [folderChildren]);

  const allTableSelected =
    folderChildren.length > 0 &&
    tableSelectedIds.size === folderChildren.length;
  const someTableSelected =
    tableSelectedIds.size > 0 && !allTableSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someTableSelected;
  }, [someTableSelected]);

  const breadcrumbPath = useMemo(() => {
    if (!selectedId || treeNodes.length === 0) return null;
    return findPathToNode(treeNodes, selectedId);
  }, [selectedId, treeNodes]);

  const breadcrumbParentId = useMemo(() => {
    if (!breadcrumbPath || breadcrumbPath.length < 2) return null;
    return breadcrumbPath[breadcrumbPath.length - 2]?.id ?? null;
  }, [breadcrumbPath]);

  const handleBack = useCallback(() => {
    if (breadcrumbParentId) handleSelect(breadcrumbParentId);
  }, [breadcrumbParentId, handleSelect]);

  const handleTableBodyClick = useCallback(
    (child: FolderNode, e: React.MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-row-action]")) return;
      if (el.closest('input[type="checkbox"]')) return;
      const isFolder = child.kind !== "file";
      if (isFolder) handleSelect(child.id);
      else console.log("file open", child.id, child.label);
    },
    [handleSelect]
  );

  const canNavigateBack = Boolean(breadcrumbPath && breadcrumbPath.length > 1);

  const showBreadcrumbRow =
    !treeLoading &&
    !loadError &&
    Boolean(selectedNode && breadcrumbPath && breadcrumbPath.length > 0);

  const selectItemsLabel = (
    <span className="shrink-0 text-sm text-muted-foreground">
      Select items to:
      {tableSelectedIds.size > 0 ? (
        <span className="ml-2 font-medium text-foreground">
          {tableSelectedIds.size} selected
        </span>
      ) : null}
    </span>
  );

  const projectSelectValue = projectJobFromParent
    ? projectOptions.length === 0 ||
        !jobId.trim() ||
        !projectOptions.some((p) => p.job_id === jobId.trim())
      ? ""
      : jobId.trim()
    : projectOptions.length === 0 ||
        !selectedProjectJobId ||
        !projectOptions.some((p) => p.job_id === selectedProjectJobId)
      ? ""
      : selectedProjectJobId;

  const projectSelectControl = stepsLoading ? (
    <div
      className="flex h-8 max-w-[11rem] items-center gap-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      <span className="text-xs text-muted-foreground">Loading projects…</span>
    </div>
  ) : (
    <div className="flex max-w-[11rem] shrink-0 items-center gap-1.5 sm:max-w-[13rem]">
      {useSharedTree && sharedTree?.loading && jobId.trim() ? (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin text-primary"
          aria-label="Loading library"
        />
      ) : null}
      <select
        aria-label="Select project"
        value={projectSelectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (onProjectJobIdChange) onProjectJobIdChange(v);
          else setSelectedProjectJobId(v);
        }}
        disabled={projectOptions.length === 0}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">
          {projectOptions.length === 0
            ? "No projects available"
            : "Select project"}
        </option>
        {projectOptions.map((p) => (
          <option key={p.job_id} value={p.job_id}>
            {p.project_name}
          </option>
        ))}
      </select>
    </div>
  );

  const bulkActionButtons = (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={tableSelectedIds.size === 0}
        onClick={() =>
          console.log("bulk download", Array.from(tableSelectedIds))
        }
      >
        <Download className="mr-2 h-4 w-4" />
        Bulk Download
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={tableSelectedIds.size === 0}
        onClick={() => console.log("archive", Array.from(tableSelectedIds))}
      >
        <Archive className="mr-2 h-4 w-4" />
        Archive
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={tableSelectedIds.size === 0}
        onClick={() => console.log("delete", Array.from(tableSelectedIds))}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </>
  );

  const selectItemsAndActions = (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2",
        showProjectDropdown
          ? "w-full sm:justify-end"
          : "ml-auto w-auto max-w-full justify-end sm:justify-end"
      )}
    >
      <div className="min-w-0 shrink-0">{selectItemsLabel}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        {bulkActionButtons}
        {newButton}
      </div>
    </div>
  );

  const selectRowToolbar = showProjectDropdown ? (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="w-auto min-w-0 shrink-0">{projectSelectControl}</div>
      {selectItemsAndActions}
    </div>
  ) : (
    <div className="flex w-full min-w-0 justify-end">{selectItemsAndActions}</div>
  );

  const breadcrumbNav =
    breadcrumbPath && breadcrumbPath.length > 0 ? (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-muted-foreground hover:text-foreground"
          disabled={!canNavigateBack}
          onClick={handleBack}
          aria-label="Go to parent folder"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          Back
        </Button>
        <nav
          className="flex min-w-0 flex-1 flex-wrap items-center text-sm"
          aria-label="Library path"
        >
          {breadcrumbPath.map((node, i) => (
            <span
              key={node.id}
              className="flex min-w-0 max-w-full items-center"
            >
              {i > 0 ? (
                <span
                  className="mx-1.5 shrink-0 text-muted-foreground/60"
                  aria-hidden
                >
                  /
                </span>
              ) : null}
              <button
                type="button"
                className={cn(
                  "min-w-0 truncate rounded px-0.5 text-left transition-colors hover:text-foreground hover:underline",
                  i === breadcrumbPath.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => handleSelect(node.id)}
                title={node.label}
              >
                {node.label}
              </button>
            </span>
          ))}
        </nav>
      </div>
    ) : null;

  const noJobEmptyBody =
    !jobId.trim() && showProjectDropdown ? (
      <div className="p-6 text-sm text-muted-foreground">
        Select a project above to view its library.
      </div>
    ) : !jobId.trim() ? (
      <div className="p-6 text-sm text-muted-foreground">Missing job id.</div>
    ) : null;

  return (
    <>
      <div className="border-b border-border/80 p-3 sm:p-4">
        {showBreadcrumbRow ? (
          <>
            <div className="mb-3 min-w-0">{selectRowToolbar}</div>
            <div className="min-w-0">{breadcrumbNav}</div>
          </>
        ) : (
          selectRowToolbar
        )}
      </div>

      {noJobEmptyBody}

      {!noJobEmptyBody && treeLoading ? (
        <div
          className="flex min-h-[200px] items-center justify-center py-12"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !noJobEmptyBody && loadError ? (
        <div className="p-6 text-sm text-muted-foreground">{loadError}</div>
      ) : !noJobEmptyBody && !selectedNode ? (
        <div className="p-6 text-sm text-muted-foreground">
          {treeNodes.length === 0
            ? "No items in library."
            : "Select a folder or file from the library tree."}
        </div>
      ) : !noJobEmptyBody && isFileSelected ? (
        <div>
          <div className="space-y-4 p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                File
              </p>
              <p
                className="mt-1 truncate text-sm font-medium text-foreground"
                title={selectedNode.label}
              >
                {selectedNode.label}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Size
              </p>
              <p className="mt-1 text-sm text-foreground">
                {selectedNode.size != null
                  ? formatBytes(selectedNode.size)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      ) : !noJobEmptyBody ? (
        <div>
          <div className="min-w-0 overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-11 px-2 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="rounded border-input"
                      checked={allTableSelected}
                      onChange={toggleSelectAllTable}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="min-w-0 py-3">Name</TableHead>
                  <TableHead className="hidden py-3 text-right sm:table-cell sm:w-28">
                    File Size
                  </TableHead>
                  <TableHead className="hidden py-3 lg:table-cell lg:w-40">
                    Last Modified
                  </TableHead>
                  <TableHead className="hidden py-3 xl:table-cell xl:w-32">
                    Modified By
                  </TableHead>
                  <TableHead className="w-[7.5rem] py-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folderChildren.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      This folder is empty.
                    </TableCell>
                  </TableRow>
                ) : (
                  folderChildren.map((child) => {
                    const isFolder = child.kind !== "file";
                    const iconKind = getFileManagerIconKind(
                      child.label,
                      isFolder
                    );
                    const sizeText =
                      !isFolder && child.size != null
                        ? formatBytes(child.size)
                        : "—";
                    const rowSelected = tableSelectedIds.has(child.id);

                    return (
                      <TableRow
                        key={child.id}
                        className={cn(
                          "group border-b transition-colors duration-150",
                          isFolder ? "cursor-pointer" : "cursor-default",
                          rowSelected
                            ? "bg-primary/10 hover:bg-primary/15"
                            : isFolder
                              ? "hover:bg-muted/60"
                              : "hover:bg-muted/40"
                        )}
                        onClick={(e) => handleTableBodyClick(child, e)}
                      >
                        <TableCell
                          className="px-2 py-3 align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-input"
                            checked={rowSelected}
                            onChange={() => toggleTableRow(child.id)}
                            aria-label={`Select ${child.label}`}
                          />
                        </TableCell>
                        <TableCell className="min-w-0 max-w-0 py-3">
                          <div className="flex min-w-0 items-center gap-2 pl-0.5">
                            <FileManagerItemIcon kind={iconKind} />
                            <span
                              className={cn(
                                "min-w-0 truncate text-left text-sm text-foreground",
                                isFolder && "font-semibold"
                              )}
                              title={child.label}
                            >
                              {child.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                          {sizeText}
                        </TableCell>
                        <TableCell className="hidden py-3 text-sm text-muted-foreground lg:table-cell">
                          —
                        </TableCell>
                        <TableCell className="hidden py-3 text-sm text-muted-foreground xl:table-cell">
                          —
                        </TableCell>
                        <TableCell
                          className="py-3 text-right align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-end gap-0.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                              rowSelected && "md:opacity-100"
                            )}
                            data-row-action
                          >
                            <button
                              type="button"
                              data-row-action
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Download"
                              onClick={() =>
                                console.log("download", child.id)
                              }
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              data-row-action
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Delete"
                              onClick={() =>
                                console.log("delete", child.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </>
  );
}
