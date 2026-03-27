"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { FolderTree, type FolderNode } from "@/components/ui/FolderTree";
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
  PanelLeft,
  Trash2,
} from "lucide-react";
import { fetchProjectTree } from "@/services/projectService";
import {
  collectTreeStats,
  folderNodesFromProjectTreeResponse,
  formatBytes,
} from "@/lib/projectTreeNormalize";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import {
  FileManagerItemIcon,
  getFileManagerIconKind,
} from "@/components/library/FileManagerItemIcon";

/** Fixed job for project library tree (extract_zip_output). */
const PROJECT_LIBRARY_JOB_ID =
  "71918f2f-33b8-47e8-9e0f-6fcb553bb46e";

function buildIdMap(nodes: FolderNode[]): Map<string, FolderNode> {
  const m = new Map<string, FolderNode>();
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      m.set(n.id, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return m;
}

/** Path from tree root to the node with `targetId` (inclusive). */
function findPathToNode(
  nodes: FolderNode[],
  targetId: string,
  ancestors: FolderNode[] = []
): FolderNode[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return [...ancestors, n];
    if (n.children?.length) {
      const found = findPathToNode(n.children, targetId, [...ancestors, n]);
      if (found) return found;
    }
  }
  return null;
}

export default function LibraryPage() {
  const [treeNodes, setTreeNodes] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const nodeMap = useMemo(() => buildIdMap(treeNodes), [treeNodes]);

  const stats = useMemo(() => collectTreeStats(treeNodes), [treeNodes]);

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
    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      setTreeLoading(true);
      setLoadError(null);
      try {
        const raw = await fetchProjectTree(PROJECT_LIBRARY_JOB_ID, ac.signal);
        if (cancelled) return;
        const nodes = folderNodesFromProjectTreeResponse(raw);
        setTreeNodes(nodes);
        if (nodes.length > 0) {
          setSelectedId((prev) => prev ?? nodes[0].id);
        } else {
          setSelectedId(null);
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError("Could not load project library.");
        toast.error("Failed to load project tree.");
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
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMobileSidebarOpen(false);
  }, []);

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

  const breadcrumbBar =
    breadcrumbPath && breadcrumbPath.length > 0 ? (
      <div className="border-b border-border/80 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
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
      </div>
    ) : null;

  const sizeLine =
    stats.fileCount > 0
      ? `Total Size: ${formatBytes(stats.totalBytes)} · Files: ${stats.fileCount}`
      : treeLoading
        ? "Total Size: — · Files: —"
        : "Total Size: 0 B · Files: 0";

  const sidebarBody = (
    <>
      <h3 className="mb-3 text-sm font-medium">AutotenderAI Libraries</h3>
      <div className="max-h-[min(70vh,520px)] min-w-0 max-w-full overflow-y-auto overflow-x-hidden pr-1">
        {treeLoading ? (
          <div
            className="flex min-h-[120px] items-center justify-center py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
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
    <DashboardLayout
      title="Organisation Library"
      searchPlaceholder="Search your library..."
    >
      <PageContainer>
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
        <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
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

            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-muted-foreground">{sizeLine}</p>
              <Button size="sm" className="shrink-0">
                New
              </Button>
            </div>
            <Card className="min-w-0 overflow-hidden">
              <div className="border-b p-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Select items to:
                    {tableSelectedIds.size > 0 ? (
                      <span className="ml-2 font-medium text-foreground">
                        {tableSelectedIds.size} selected
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tableSelectedIds.size === 0}
                      onClick={() =>
                        console.log(
                          "bulk download",
                          Array.from(tableSelectedIds)
                        )
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Bulk Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tableSelectedIds.size === 0}
                      onClick={() =>
                        console.log("archive", Array.from(tableSelectedIds))
                      }
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tableSelectedIds.size === 0}
                      onClick={() =>
                        console.log("delete", Array.from(tableSelectedIds))
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              {treeLoading ? (
                <div
                  className="flex min-h-[200px] items-center justify-center py-12"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !selectedNode ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Select a folder or file from the library tree.
                </div>
              ) : isFileSelected ? (
                <div>
                  {breadcrumbBar}
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
              ) : (
                <div>
                  {breadcrumbBar}
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
                        <TableHead className="hidden py-3 xl:table-cell xl:w-24">
                          Status
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
                            colSpan={7}
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
                              : isFolder
                                ? "—"
                                : "—";
                          const rowSelected = tableSelectedIds.has(child.id);

                          return (
                            <TableRow
                              key={child.id}
                              className={cn(
                                "group border-b transition-colors duration-150",
                                isFolder
                                  ? "cursor-pointer"
                                  : "cursor-default",
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
                              <TableCell className="hidden py-3 text-sm text-muted-foreground xl:table-cell">
                                Current
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
              )}
            </Card>
          </div>
        </div>

      </PageContainer>
    </DashboardLayout>
  );
}
