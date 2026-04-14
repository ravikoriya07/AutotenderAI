"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  LayoutGrid,
  LayoutPanelLeft,
  List,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { FolderTree, type FolderNode } from "@/components/ui/FolderTree";
import {
  fetchProjectTree,
  fetchViewFile,
  toViewFileApiPath,
} from "@/services/projectService";
import { folderNodesDrawingBranchFromProjectTreeResponse } from "@/lib/projectTreeNormalize";
import { nodeToProjectActionPath } from "@/lib/libraryListingUtils";
import { useResearchProject } from "@/contexts/ResearchProjectContext";
import { toast } from "react-toastify";
import axios from "axios";
import { cn } from "@/lib/utils";
import {
  CadAnalyzerToolProvider,
  useCadAnalyzerTool,
} from "@/contexts/CadAnalyzerToolContext";
import { CadAnalyzerFloatingBridge } from "@/components/quantity-take-off/cad-analyzer/CadAnalyzerFloatingBridge";
import {
  CadPdfCanvasStack,
  type AutoCountRoiCss,
  type CadPdfCanvasStackHandle,
} from "@/components/quantity-take-off/cad-analyzer/CadPdfCanvasStack";
import { screenRectToBackend } from "@/lib/autoCountCoordinates";
import {
  clearQtoAutoCount,
  loadQtoAutoCount,
  saveQtoAutoCount,
  type AutoCountBackendState,
} from "@/lib/qtoAutoCountStorage";
import {
  appendQtoSavedObject,
  clearQtoSavedObjects,
  loadQtoSavedObjects,
  type QtoSavedObjectEntryV1,
  type QtoSavedObjectsFileV1,
} from "@/lib/qtoSavedObjectsStorage";
import { Button } from "@/components/ui/Button";
import {
  ToolOptionsSidebar,
  type ToolSidebarMode,
} from "@/components/quantity-take-off/ToolOptionsSidebar";
import { ObjectMetadataSidebar } from "@/components/quantity-take-off/ObjectMetadataSidebar";
import { postAutoCount } from "@/services/autoCountService";
import { postSearchText } from "@/services/searchTextService";

function findFileIdByStoragePath(
  nodes: FolderNode[],
  treeNodes: FolderNode[],
  targetPath: string
): string | null {
  for (const node of nodes) {
    if (node.kind === "file") {
      const p = nodeToProjectActionPath(node, treeNodes);
      if (p === targetPath) return node.id;
    }
    if (node.children?.length) {
      const id = findFileIdByStoragePath(
        node.children,
        treeNodes,
        targetPath
      );
      if (id) return id;
    }
  }
  return null;
}

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

function validateObjectMetadataForm(
  objectId: string,
  objectName: string
): { objectId?: string; objectName?: string } {
  const errors: { objectId?: string; objectName?: string } = {};
  const idT = objectId.trim();
  const nameT = objectName.trim();
  if (!idT) errors.objectId = "Object ID is required.";
  else if (idT.length > 200) {
    errors.objectId = "Object ID must be 200 characters or fewer.";
  }
  if (!nameT) errors.objectName = "Object name is required.";
  else if (nameT.length > 300) {
    errors.objectName = "Object name must be 300 characters or fewer.";
  }
  return errors;
}

export type QuantityTakeOffViewProps = {
  jobId: string;
};

/** Top-right stack: reopen chip when Auto Count is active but options panel closed; Analyze/Clear when applicable. */
function AutoCountRightFloatingStack({
  showToolbar,
  autoCountSidebarMounted,
  isAutoCountOpen,
  openSymbolOptionsPanel,
  showAnalyzeCard,
  analyzeCard,
}: {
  showToolbar: boolean;
  autoCountSidebarMounted: boolean;
  isAutoCountOpen: boolean;
  openSymbolOptionsPanel: () => void;
  showAnalyzeCard: boolean;
  analyzeCard: ReactNode;
}) {
  const { tool } = useCadAnalyzerTool();
  const showSymbolOptionsChip =
    showToolbar && tool === "autoCount" && !autoCountSidebarMounted;

  if (!showSymbolOptionsChip && !showAnalyzeCard) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-2 sm:right-3 sm:top-3",
        isAutoCountOpen ? "z-[45]" : "z-30"
      )}
    >
      {showSymbolOptionsChip ? (
        <button
          type="button"
          onClick={openSymbolOptionsPanel}
          className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/70 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm"
          aria-label="Open symbol options"
        >
          <SlidersHorizontal
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4"
            aria-hidden
          />
          <span className="min-w-0 truncate">Symbol options</span>
        </button>
      ) : null}
      {showAnalyzeCard ? analyzeCard : null}
    </div>
  );
}

/** Full-viewport blocking overlay for Auto Count analyze or Search Text (portal to `document.body`). */
function BlockingStatusOverlay({
  open,
  message,
}: {
  open: boolean;
  message: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-4 touch-none bg-black/75 backdrop-blur-[3px]"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        minHeight: "100dvh",
        zIndex: 2147483647,
        margin: 0,
      }}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <Loader2
        className="h-11 w-11 shrink-0 animate-spin text-primary"
        aria-hidden
      />
      <p className="text-base font-medium tracking-tight text-white">{message}</p>
    </div>,
    document.body
  );
}

/**
 * Light Figma-style layers panel: overlays the workspace only (no layout shift).
 * Full-width scrollable canvas; panel is absolute inside the card.
 */
export function QuantityTakeOffView({ jobId }: QuantityTakeOffViewProps) {
  const trimmedJobId = jobId.trim();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathFromUrl = searchParams.get("path")?.trim() ?? "";

  const replacePdfInUrl = useCallback(
    (path: string | null) => {
      if (path) {
        router.replace(`/quantity-take-off?path=${encodeURIComponent(path)}`, {
          scroll: false,
        });
      } else {
        router.replace("/quantity-take-off", { scroll: false });
      }
    },
    [router]
  );

  const { completedStepProjects: catalogProjects } = useResearchProject();

  const projectTitle = useMemo(() => {
    if (!trimmedJobId) return "Select a project";
    const p = catalogProjects.find((x) => x.job_id === trimmedJobId);
    return p?.project_name?.trim() || `${trimmedJobId.slice(0, 8)}…`;
  }, [trimmedJobId, catalogProjects]);

  const [drawerMounted, setDrawerMounted] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const translateOpenRef = useRef(translateOpen);
  translateOpenRef.current = translateOpen;
  const drawerUnmountTimeoutRef = useRef<number | null>(null);

  const clearDrawerUnmountTimeout = useCallback(() => {
    if (drawerUnmountTimeoutRef.current != null) {
      clearTimeout(drawerUnmountTimeoutRef.current);
      drawerUnmountTimeoutRef.current = null;
    }
  }, []);

  const clearAutoCountUnmountTimeout = useCallback(() => {
    if (autoCountUnmountTimeoutRef.current != null) {
      clearTimeout(autoCountUnmountTimeoutRef.current);
      autoCountUnmountTimeoutRef.current = null;
    }
  }, []);

  const clearObjectMetadataUnmountTimeout = useCallback(() => {
    if (objectMetadataUnmountTimeoutRef.current != null) {
      clearTimeout(objectMetadataUnmountTimeoutRef.current);
      objectMetadataUnmountTimeoutRef.current = null;
    }
  }, []);

  const [treeNodes, setTreeNodes] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(() => Boolean(trimmedJobId));
  const [selectedPdfPath, setSelectedPdfPath] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfPhase, setPdfPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  const [autoCountRoi, setAutoCountRoi] = useState<AutoCountRoiCss | null>(null);
  /** Backend coordinate space; overlay reprojects on zoom/pan */
  const [autoCountBackend, setAutoCountBackend] =
    useState<AutoCountBackendState | null>(null);
  const [autoCountLoading, setAutoCountLoading] = useState(false);

  const [autoCountSidebarMounted, setAutoCountSidebarMounted] = useState(false);
  const [isAutoCountOpen, setIsAutoCountOpen] = useState(false);
  /** Drives tool sidebar content and whether the floating Analyze button is shown */
  const [lastToolAction, setLastToolAction] = useState<ToolSidebarMode>("autoCount");
  const [searchTerm, setSearchTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchTextLoading, setSearchTextLoading] = useState(false);
  const [searchTextError, setSearchTextError] = useState<string | null>(null);
  const [objectMetadataSidebarMounted, setObjectMetadataSidebarMounted] =
    useState(false);
  const [isObjectMetadataOpen, setIsObjectMetadataOpen] = useState(false);
  const [rotationInvariant, setRotationInvariant] = useState(true);
  const [confidence, setConfidence] = useState(0.7);
  const autoCountUnmountTimeoutRef = useRef<number | null>(null);
  const objectMetadataUnmountTimeoutRef = useRef<number | null>(null);
  const isAutoCountOpenRef = useRef(isAutoCountOpen);
  isAutoCountOpenRef.current = isAutoCountOpen;
  const isObjectMetadataOpenRef = useRef(isObjectMetadataOpen);
  isObjectMetadataOpenRef.current = isObjectMetadataOpen;

  const [savedObjects, setSavedObjects] = useState<QtoSavedObjectEntryV1[]>([]);
  const [metadataObjectId, setMetadataObjectId] = useState("");
  const [metadataObjectName, setMetadataObjectName] = useState("");
  const [metadataCount, setMetadataCount] = useState(0);
  const [metadataErrors, setMetadataErrors] = useState<{
    objectId?: string;
    objectName?: string;
  }>({});
  const [selectedSavedObjectId, setSelectedSavedObjectId] = useState<
    string | null
  >(null);
  const [expandedSavedId, setExpandedSavedId] = useState<string | null>(null);

  const prevJobIdForTreeRef = useRef<string | null>(null);
  const cadCanvasRef = useRef<CadPdfCanvasStackHandle>(null);

  /** Restore open PDF from `?path=` on load / refresh / back-forward (do not clear when empty — avoids racing router.replace). */
  useEffect(() => {
    if (!trimmedJobId) return;
    if (pathFromUrl) {
      setSelectedPdfPath(pathFromUrl);
    }
  }, [trimmedJobId, pathFromUrl]);

  useEffect(() => {
    if (!trimmedJobId) {
      clearDrawerUnmountTimeout();
      clearAutoCountUnmountTimeout();
      setTranslateOpen(false);
      setDrawerMounted(false);
      setIsAutoCountOpen(false);
      setAutoCountSidebarMounted(false);
      setIsObjectMetadataOpen(false);
      setObjectMetadataSidebarMounted(false);
      clearObjectMetadataUnmountTimeout();
    }
  }, [
    trimmedJobId,
    clearDrawerUnmountTimeout,
    clearAutoCountUnmountTimeout,
    clearObjectMetadataUnmountTimeout,
  ]);

  useEffect(() => {
    return () => {
      clearDrawerUnmountTimeout();
      clearAutoCountUnmountTimeout();
      clearObjectMetadataUnmountTimeout();
    };
  }, [
    clearDrawerUnmountTimeout,
    clearAutoCountUnmountTimeout,
    clearObjectMetadataUnmountTimeout,
  ]);

  useEffect(() => {
    if (!trimmedJobId) {
      setTreeLoading(false);
      setLoadError(null);
      setTreeNodes([]);
      setSelectedId(null);
      setSelectedPdfPath(null);
      setPdfBlob(null);
      setPdfPhase("idle");
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    if (
      prevJobIdForTreeRef.current !== null &&
      prevJobIdForTreeRef.current !== trimmedJobId
    ) {
      setSelectedPdfPath(null);
      queueMicrotask(() => replacePdfInUrl(null));
    }
    prevJobIdForTreeRef.current = trimmedJobId;

    setSelectedId(null);

    void (async () => {
      setTreeLoading(true);
      setLoadError(null);
      try {
        const raw = await fetchProjectTree(trimmedJobId, ac.signal);
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
  }, [trimmedJobId, replacePdfInUrl]);

  useEffect(() => {
    setAutoCountLoading(false);
    if (!trimmedJobId || !selectedPdfPath?.trim()) {
      setAutoCountRoi(null);
      setAutoCountBackend(null);
      return;
    }
    const stored = loadQtoAutoCount(trimmedJobId, selectedPdfPath.trim());
    if (stored) {
      setAutoCountBackend({
        pageNumber: stored.pageNumber,
        roi: stored.roi,
        matches: stored.matches,
      });
      setAutoCountRoi(null);
    } else {
      setAutoCountRoi(null);
      setAutoCountBackend(null);
    }
  }, [trimmedJobId, selectedPdfPath]);

  useEffect(() => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) {
      setSavedObjects([]);
      return;
    }
    setSavedObjects(loadQtoSavedObjects(trimmedJobId, selectedPdfPath.trim()));
  }, [trimmedJobId, selectedPdfPath]);

  useEffect(() => {
    setSelectedSavedObjectId(null);
    setExpandedSavedId(null);
  }, [trimmedJobId, selectedPdfPath]);

  /** Highlight the file row that matches the open PDF (including after refresh). */
  useEffect(() => {
    if (!selectedPdfPath || treeNodes.length === 0) return;
    const id = findFileIdByStoragePath(treeNodes, treeNodes, selectedPdfPath);
    if (id) setSelectedId(id);
  }, [treeNodes, selectedPdfPath]);

  useEffect(() => {
    if (!trimmedJobId || !selectedPdfPath) {
      setPdfBlob(null);
      setPdfPhase("idle");
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    setPdfPhase("loading");
    setPdfBlob(null);

    void (async () => {
      try {
        const result = await fetchViewFile(
          trimmedJobId,
          toViewFileApiPath(selectedPdfPath),
          { signal: ac.signal }
        );
        if (cancelled) return;
        if (result.blob.size === 0) {
          setPdfPhase("error");
          return;
        }
        const ct = (result.contentType ?? "").toLowerCase();
        const probablyJsonError =
          ct.includes("application/json") ||
          (result.blob.size < 65536 &&
            (await result.blob.slice(0, 1).text()) === "{");
        if (probablyJsonError) {
          setPdfPhase("error");
          return;
        }
        setPdfBlob(result.blob);
        setPdfPhase("ready");
      } catch {
        if (!cancelled) setPdfPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      setPdfBlob(null);
    };
  }, [trimmedJobId, selectedPdfPath]);

  const closeDrawer = useCallback(() => {
    setTranslateOpen(false);
    clearDrawerUnmountTimeout();
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(() => setDrawerMounted(false), 0);
      return;
    }
    /* If transitionend never fires (browser quirks), still unmount so the open chip returns. */
    drawerUnmountTimeoutRef.current = window.setTimeout(() => {
      drawerUnmountTimeoutRef.current = null;
      setDrawerMounted(false);
    }, 350);
  }, [clearDrawerUnmountTimeout]);

  const handleAsideTransitionEnd = useCallback(
    (e: { target: EventTarget; currentTarget: EventTarget; propertyName: string }) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "transform") return;
      if (!translateOpenRef.current) {
        clearDrawerUnmountTimeout();
        setDrawerMounted(false);
      }
    },
    [clearDrawerUnmountTimeout]
  );

  const closeAutoCountPanel = useCallback(() => {
    setIsAutoCountOpen(false);
    clearAutoCountUnmountTimeout();
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(() => setAutoCountSidebarMounted(false), 0);
      return;
    }
    autoCountUnmountTimeoutRef.current = window.setTimeout(() => {
      autoCountUnmountTimeoutRef.current = null;
      setAutoCountSidebarMounted(false);
    }, 350);
  }, [clearAutoCountUnmountTimeout]);

  const openToolOptionsPanel = useCallback((mode: ToolSidebarMode) => {
    setLastToolAction(mode);
    clearAutoCountUnmountTimeout();
    if (!autoCountSidebarMounted) {
      setAutoCountSidebarMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAutoCountOpen(true));
      });
    } else {
      setIsAutoCountOpen(true);
    }
  }, [autoCountSidebarMounted, clearAutoCountUnmountTimeout]);

  const handleAutoCountToolSelect = useCallback(() => {
    setLastToolAction("autoCount");
  }, []);

  /** Open symbol options only after a ROI is committed (mouse/touch release), not when picking the tool. */
  const handleAutoCountRoiChange = useCallback(
    (roi: AutoCountRoiCss | null) => {
      setAutoCountRoi(roi);
      if (roi != null) {
        openToolOptionsPanel("autoCount");
      }
    },
    [openToolOptionsPanel]
  );

  const closeObjectMetadataPanel = useCallback(() => {
    setIsObjectMetadataOpen(false);
    clearObjectMetadataUnmountTimeout();
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(() => setObjectMetadataSidebarMounted(false), 0);
      return;
    }
    objectMetadataUnmountTimeoutRef.current = window.setTimeout(() => {
      objectMetadataUnmountTimeoutRef.current = null;
      setObjectMetadataSidebarMounted(false);
    }, 350);
  }, [clearObjectMetadataUnmountTimeout]);

  const openObjectMetadataPanel = useCallback(() => {
    clearObjectMetadataUnmountTimeout();
    if (!objectMetadataSidebarMounted) {
      setObjectMetadataSidebarMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsObjectMetadataOpen(true));
      });
    } else {
      setIsObjectMetadataOpen(true);
    }
  }, [objectMetadataSidebarMounted, clearObjectMetadataUnmountTimeout]);

  /**
   * Object metadata is only available after a successful Analyze (or restored session with results).
   * Use this for the "Object data" control — not immediately after Analyze in the handler (stale closure).
   */
  const tryOpenObjectMetadataPanel = useCallback(() => {
    if (!autoCountBackend) return;
    openObjectMetadataPanel();
  }, [autoCountBackend, openObjectMetadataPanel]);

  const handleSearchTextSubmit = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchTextError("Search text is required.");
      return;
    }
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    setSearchTextError(null);
    setSearchTextLoading(true);
    try {
      const res = await postSearchText({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        search_term: term,
        case_sensitive: caseSensitive,
      });
      const rawMatches = res.matches ?? [];
      const n = res.total_found ?? rawMatches.length ?? 0;
      const pageNumber = 1;
      const nextBackend: AutoCountBackendState = {
        pageNumber,
        roi: { x: 0, y: 0, width: 0, height: 0 },
        matches: rawMatches,
      };
      setAutoCountBackend(nextBackend);
      saveQtoAutoCount(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        ...nextBackend,
      });
      setMetadataCount(n);
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      closeAutoCountPanel();
      openObjectMetadataPanel();
      toast.success(
        n > 0 ? `Found ${n} match${n === 1 ? "" : "es"}` : "No matches"
      );
    } catch (e) {
      console.log("[qto] postSearchText failed", e);
      setSearchTextError("Search failed. Try again.");
      toast.error("Search text failed.");
    } finally {
      setSearchTextLoading(false);
    }
  }, [
    searchTerm,
    caseSensitive,
    trimmedJobId,
    selectedPdfPath,
    closeAutoCountPanel,
    openObjectMetadataPanel,
  ]);

  const handleAutoCountAsideTransitionEnd = useCallback(
    (e: { target: EventTarget; currentTarget: EventTarget; propertyName: string }) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "transform") return;
      if (!isAutoCountOpenRef.current) {
        clearAutoCountUnmountTimeout();
        setAutoCountSidebarMounted(false);
      }
    },
    [clearAutoCountUnmountTimeout]
  );

  const handleObjectMetadataAsideTransitionEnd = useCallback(
    (e: { target: EventTarget; currentTarget: EventTarget; propertyName: string }) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "transform") return;
      if (!isObjectMetadataOpenRef.current) {
        clearObjectMetadataUnmountTimeout();
        setObjectMetadataSidebarMounted(false);
      }
    },
    [clearObjectMetadataUnmountTimeout]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isObjectMetadataOpenRef.current) {
        closeObjectMetadataPanel();
        return;
      }
      if (isAutoCountOpenRef.current) {
        closeAutoCountPanel();
        return;
      }
      if (translateOpenRef.current) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer, closeAutoCountPanel, closeObjectMetadataPanel]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleViewFile = useCallback(
    (node: FolderNode) => {
      if (node.kind !== "file" || !trimmedJobId) return;
      const path = nodeToProjectActionPath(node, treeNodes);
      if (!path) {
        toast.error("Could not resolve file path.");
        return;
      }
      setSelectedPdfPath((prev) => {
        const next = prev === path ? null : path;
        queueMicrotask(() => {
          replacePdfInUrl(next);
        });
        return next;
      });
    },
    [trimmedJobId, treeNodes, replacePdfInUrl]
  );

  const toggleSidebar = useCallback(() => {
    if (!trimmedJobId) return;
    clearDrawerUnmountTimeout();
    if (!drawerMounted) {
      setDrawerMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTranslateOpen(true));
      });
    } else if (translateOpen) {
      setTranslateOpen(false);
    } else {
      setTranslateOpen(true);
    }
  }, [
    trimmedJobId,
    drawerMounted,
    translateOpen,
    clearDrawerUnmountTimeout,
  ]);

  const chipClassNameSticky = cn(
    "inline-flex w-fit max-w-[min(100%,40rem)] min-w-[16rem] shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/70 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm",
    !trimmedJobId && "cursor-not-allowed opacity-45"
  );

  /** Full-width header control inside the sidebar (no close button; dismiss via backdrop / Escape). */
  const chipClassNameSidebarHeader = cn(
    "flex w-full min-w-0 items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 text-left text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/70 sm:px-3 sm:py-2.5",
    !trimmedJobId && "cursor-not-allowed opacity-45"
  );

  const projectChipSticky = (
    <button
      type="button"
      disabled={!trimmedJobId}
      onClick={toggleSidebar}
      aria-expanded={Boolean(drawerMounted && translateOpen)}
      aria-controls="quantity-take-off-drawing-drawer"
      className={chipClassNameSticky}
    >
      <LayoutGrid
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{projectTitle}</span>
      <LayoutPanelLeft
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4"
        aria-hidden
      />
    </button>
  );

  const projectChipSidebarHeader = (
    <button
      type="button"
      disabled={!trimmedJobId}
      onClick={toggleSidebar}
      aria-expanded={Boolean(drawerMounted && translateOpen)}
      aria-controls="quantity-take-off-drawing-drawer"
      className={chipClassNameSidebarHeader}
    >
      <LayoutGrid
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{projectTitle}</span>
      <LayoutPanelLeft
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </button>
  );

  const muted = "text-muted-foreground";

  const layersBlock = !trimmedJobId ? (
    <p className={cn("text-xs leading-relaxed", muted)}>
      Select a project in the header to load drawings.
    </p>
  ) : treeLoading ? (
    <div
      className="flex min-h-[88px] flex-col items-center justify-center gap-2 py-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary sm:h-7 sm:w-7" />
      <span className={cn("text-xs", muted)}>Loading tree…</span>
    </div>
  ) : loadError ? (
    <p className={cn("text-xs leading-relaxed", muted)}>{loadError}</p>
  ) : (
    <div>
      {treeNodes.length === 0 ? (
        <p
          className={cn(
            "rounded-md border border-dashed border-border/80 px-2 py-2 text-xs leading-relaxed sm:px-2.5 sm:py-2.5",
            muted
          )}
        >
          No{" "}
          <span className="font-medium text-foreground">drawing → pdfs</span>{" "}
          path for this project.
        </p>
      ) : (
        <FolderTree
          nodes={treeNodes}
          selectedId={selectedId ?? undefined}
          onSelect={handleSelect}
          defaultExpandAll
          fileLeafIcon="pdf"
          onViewFile={handleViewFile}
          variant="light"
        />
      )}
    </div>
  );

  const canvasDrawer =
    drawerMounted ? (
      <>
        {/* Light backdrop: stronger on small screens for clarity */}
        <button
          type="button"
          aria-label="Close drawing files"
          className={cn(
            "absolute inset-0 z-20 transition-opacity duration-300 ease-out motion-reduce:transition-none",
            "bg-foreground/[0.04] max-md:bg-foreground/[0.06]",
            translateOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          )}
          onClick={closeDrawer}
        />
        <aside
          id="quantity-take-off-drawing-drawer"
          className={cn(
            "absolute bottom-0 left-0 top-0 z-30 flex max-h-full min-h-0 flex-col",
            "border-r border-border/70 bg-background/95 text-foreground shadow-md backdrop-blur-md",
            "rounded-r-lg",
            "w-[min(90vw,360px)] md:w-[280px] lg:w-[300px] xl:w-[320px]",
            "transition-transform duration-300 ease-out motion-reduce:transition-none",
            translateOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-modal="true"
          role="dialog"
          aria-hidden={!translateOpen}
          onTransitionEnd={handleAsideTransitionEnd}
        >
          <div className="shrink-0 border-b border-border/70 px-2 py-2 sm:px-2.5 sm:py-2.5">
            {projectChipSidebarHeader}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="px-2 pb-2 pt-2 sm:px-2.5 sm:pb-2.5 sm:pt-2.5">
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Layers
              </h3>
              {layersBlock}
            </div>
          </div>
        </aside>
      </>
    ) : null;

  const clearAutoCount = useCallback(() => {
    if (trimmedJobId && selectedPdfPath?.trim()) {
      const path = selectedPdfPath.trim();
      clearQtoAutoCount(trimmedJobId, path);
      clearQtoSavedObjects(trimmedJobId, path);
    }
    setAutoCountRoi(null);
    setAutoCountBackend(null);
    setAutoCountLoading(false);
    setSearchTerm("");
    setCaseSensitive(false);
    setSearchTextError(null);
    setSearchTextLoading(false);
    setLastToolAction("autoCount");
    setSelectedSavedObjectId(null);
    setExpandedSavedId(null);
    setSavedObjects([]);
    setMetadataObjectId("");
    setMetadataObjectName("");
    setMetadataCount(0);
    setMetadataErrors({});
    closeObjectMetadataPanel();
    closeAutoCountPanel();
  }, [
    trimmedJobId,
    selectedPdfPath,
    closeObjectMetadataPanel,
    closeAutoCountPanel,
  ]);

  const selectedSavedEntry = useMemo(() => {
    if (!selectedSavedObjectId) return undefined;
    return savedObjects.find((s) => s.id === selectedSavedObjectId);
  }, [selectedSavedObjectId, savedObjects]);

  const canvasAutoCountBackend =
    selectedSavedEntry?.canvasSnapshot ?? autoCountBackend;
  const emphasizeSavedHighlight = Boolean(selectedSavedEntry);

  const handleSaveObjectMetadata = useCallback(() => {
    if (!trimmedJobId || !selectedPdfPath?.trim() || !autoCountBackend) {
      toast.error("Nothing to save. Run Analyze first.");
      return;
    }
    const errs = validateObjectMetadataForm(metadataObjectId, metadataObjectName);
    setMetadataErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!Number.isFinite(metadataCount) || metadataCount < 0) {
      toast.error("Count must be a non-negative number.");
      return;
    }

    const idTrim = metadataObjectId.trim();
    const nameTrim = metadataObjectName.trim();
    const entry: QtoSavedObjectEntryV1 = {
      v: 1,
      id: crypto.randomUUID(),
      objectId: idTrim,
      objectName: nameTrim,
      count: metadataCount,
      savedAt: Date.now(),
      canvasSnapshot: {
        pageNumber: autoCountBackend.pageNumber,
        roi: { ...autoCountBackend.roi },
        matches: autoCountBackend.matches.map((m) => ({ ...m })),
      },
    };
    const next = appendQtoSavedObject(
      trimmedJobId,
      selectedPdfPath.trim(),
      entry
    );
    setSavedObjects(next);
    setMetadataObjectId("");
    setMetadataObjectName("");
    setMetadataErrors({});
    toast.success("Object saved.");
  }, [
    trimmedJobId,
    selectedPdfPath,
    autoCountBackend,
    metadataObjectId,
    metadataObjectName,
    metadataCount,
  ]);

  const handleExportSavedObjectsJson = useCallback(() => {
    if (!trimmedJobId || !selectedPdfPath?.trim() || savedObjects.length === 0)
      return;
    const payload: QtoSavedObjectsFileV1 = {
      version: 1,
      jobId: trimmedJobId,
      filePath: selectedPdfPath.trim(),
      exportedAt: Date.now(),
      objects: savedObjects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    const safe = trimmedJobId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 32);
    a.href = URL.createObjectURL(blob);
    a.download = `qto-saved-objects-${safe}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Export started.");
  }, [trimmedJobId, selectedPdfPath, savedObjects]);

  const handleAutoCountAnalyze = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    if (!autoCountRoi && !autoCountBackend) return;

    const analyzedPage =
      autoCountRoi?.pageNumber ?? autoCountBackend!.pageNumber;
    const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(
      analyzedPage
    );
    if (!metrics) {
      toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
      return;
    }
    const roiBackend = autoCountRoi
      ? screenRectToBackend(
          {
            x: autoCountRoi.x,
            y: autoCountRoi.y,
            width: autoCountRoi.width,
            height: autoCountRoi.height,
          },
          metrics
        )
      : autoCountBackend!.roi;

    setAutoCountLoading(true);
    try {
      const res = await postAutoCount({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        roi: roiBackend,
        rotation_invariant: rotationInvariant,
        confidence,
      });
      const rawMatches = res.matches ?? [];
      const next: AutoCountBackendState = {
        pageNumber: analyzedPage,
        roi: roiBackend,
        matches: rawMatches,
      };
      setAutoCountBackend(next);
      setAutoCountRoi(null);
      saveQtoAutoCount(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        ...next,
      });
      const n = res.total_found ?? res.matches?.length ?? 0;
      toast.success(
        n > 0 ? `Found ${n} match${n === 1 ? "" : "es"}` : "No matches"
      );
      setMetadataCount(n);
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      if (isAutoCountOpenRef.current) {
        closeAutoCountPanel();
      }
      openObjectMetadataPanel();
    } catch (e) {
      console.log("[qto] postAutoCount failed", e);
      toast.error("Auto count failed.");
    } finally {
      setAutoCountLoading(false);
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    autoCountRoi,
    autoCountBackend,
    rotationInvariant,
    confidence,
    closeAutoCountPanel,
    openObjectMetadataPanel,
  ]);

  /**
   * Show the canvas chip whenever the panel is not open. Using `translateOpen` (not `drawerMounted`)
   * restores the chip immediately on outside click; `drawerMounted` can lag until transition end.
   */
  const showOpenTrigger = !translateOpen;
  const showToolbar = pdfPhase === "ready" && Boolean(pdfBlob);
  const showAutoCountBar =
    pdfPhase === "ready" &&
    Boolean(pdfBlob) &&
    (autoCountRoi != null || autoCountBackend != null);

  return (
    <CadAnalyzerToolProvider>
      <BlockingStatusOverlay
        open={autoCountLoading || searchTextLoading}
        message={searchTextLoading ? "Searching…" : "Analyzing…"}
      />
      <div className="flex min-h-0 w-full max-w-full flex-1 flex-col bg-background">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none">
          <div
            className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background [background-image:linear-gradient(to_right,hsl(var(--border)/0.22)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.22)_1px,transparent_1px)] [background-size:22px_22px]"
            aria-label="Canvas"
          >
            {/* Full-width scrollable main — no card/container visual split */}
            <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {showOpenTrigger && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-start p-2 sm:p-2.5">
                  <div className="pointer-events-auto w-fit max-w-full">{projectChipSticky}</div>
                </div>
              )}
              <AutoCountRightFloatingStack
                showToolbar={showToolbar}
                autoCountSidebarMounted={autoCountSidebarMounted}
                isAutoCountOpen={isAutoCountOpen}
                openSymbolOptionsPanel={() => openToolOptionsPanel("autoCount")}
                showAnalyzeCard={showAutoCountBar}
                analyzeCard={
                  <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/85 p-1.5 shadow-lg backdrop-blur-sm">
                    {lastToolAction === "autoCount" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 min-w-[7.5rem] justify-center gap-1.5 border-primary/25 bg-background/60 text-foreground hover:bg-muted/80"
                        disabled={
                          (!autoCountRoi && !autoCountBackend) ||
                          !trimmedJobId ||
                          !selectedPdfPath?.trim() ||
                          autoCountLoading ||
                          searchTextLoading
                        }
                        onClick={() => void handleAutoCountAnalyze()}
                      >
                        {autoCountLoading ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5 shrink-0" />
                        )}
                        Analyze
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 min-w-[7.5rem] justify-center gap-1.5 border-border/80 bg-background/60 text-foreground hover:bg-muted/80"
                      disabled={!autoCountBackend || autoCountLoading || searchTextLoading}
                      onClick={tryOpenObjectMetadataPanel}
                      title={
                        autoCountBackend
                          ? "Open object metadata and saved objects"
                          : "Run Analyze first"
                      }
                    >
                      <List className="h-3.5 w-3.5 shrink-0" />
                      Object data
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 min-w-[7.5rem] justify-center gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      disabled={autoCountLoading || searchTextLoading}
                      onClick={clearAutoCount}
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      Clear
                    </Button>
                  </div>
                }
              />
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
                {pdfPhase === "error" ? (
                  <div
                    className="flex h-full min-h-[280px] w-full flex-1 flex-col items-center justify-center bg-muted/30"
                    role="region"
                    aria-label="Drawing preview unavailable"
                  >
                    <span className="text-xs text-muted-foreground sm:text-sm">
                      Could not render this PDF. Please choose another file.
                    </span>
                  </div>
                ) : pdfPhase === "loading" ? (
                  <div
                    className="flex h-full min-h-[280px] w-full flex-1 items-center justify-center bg-muted/20"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                ) : pdfBlob ? (
                  <CadPdfCanvasStack
                    ref={cadCanvasRef}
                    pdfBlob={pdfBlob}
                    className="min-h-0 flex-1"
                    autoCountRoi={autoCountRoi}
                    onAutoCountRoiChange={handleAutoCountRoiChange}
                    autoCountBackend={canvasAutoCountBackend}
                    emphasizeAutoCountHighlight={emphasizeSavedHighlight}
                  />
                ) : (
                  <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
                    <p className="max-w-sm text-center text-xs text-muted-foreground sm:text-sm">
                      {trimmedJobId
                        ? "Use the project chip to open the layers panel and browse drawing PDFs. The canvas is reserved for future viewing tools."
                        : "Select a project in the header to use Quantity take-off."}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {showToolbar ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-5 sm:px-4 sm:pb-6">
                <CadAnalyzerFloatingBridge
                  onSearchTextSelect={() => openToolOptionsPanel("searchText")}
                  onAutoCountToolSelect={handleAutoCountToolSelect}
                />
              </div>
            ) : null}
            {canvasDrawer}
            {autoCountSidebarMounted ? (
              <>
                <button
                  type="button"
                  aria-label="Close auto count options"
                  className={cn(
                    "absolute inset-0 z-40 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                    "bg-foreground/[0.04] max-md:bg-foreground/[0.06]",
                    isAutoCountOpen
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  )}
                  onClick={closeAutoCountPanel}
                />
                <ToolOptionsSidebar
                  mode={lastToolAction}
                  open={isAutoCountOpen}
                  onClose={closeAutoCountPanel}
                  rotationInvariant={rotationInvariant}
                  onRotationInvariantChange={setRotationInvariant}
                  confidence={confidence}
                  onConfidenceChange={setConfidence}
                  searchTerm={searchTerm}
                  onSearchTermChange={(v) => {
                    setSearchTerm(v);
                    if (searchTextError) setSearchTextError(null);
                  }}
                  caseSensitive={caseSensitive}
                  onCaseSensitiveChange={setCaseSensitive}
                  onSearchTextSubmit={() => void handleSearchTextSubmit()}
                  searchTextLoading={searchTextLoading}
                  searchTextError={searchTextError}
                  searchSubmitDisabled={
                    !trimmedJobId ||
                    !selectedPdfPath?.trim() ||
                    !searchTerm.trim()
                  }
                  onTransitionEnd={handleAutoCountAsideTransitionEnd}
                />
              </>
            ) : null}
            {objectMetadataSidebarMounted ? (
              <>
                <button
                  type="button"
                  aria-label="Close object metadata"
                  className={cn(
                    "absolute inset-0 z-[51] transition-opacity duration-300 ease-out motion-reduce:transition-none",
                    "bg-foreground/[0.06] max-md:bg-foreground/[0.08]",
                    isObjectMetadataOpen
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  )}
                  onClick={closeObjectMetadataPanel}
                />
                <ObjectMetadataSidebar
                  open={isObjectMetadataOpen}
                  onClose={closeObjectMetadataPanel}
                  objectId={metadataObjectId}
                  objectName={metadataObjectName}
                  countDisplay={metadataCount}
                  onObjectIdChange={(v) => {
                    setMetadataObjectId(v);
                    if (metadataErrors.objectId) {
                      setMetadataErrors((prev) => ({ ...prev, objectId: undefined }));
                    }
                  }}
                  onObjectNameChange={(v) => {
                    setMetadataObjectName(v);
                    if (metadataErrors.objectName) {
                      setMetadataErrors((prev) => ({ ...prev, objectName: undefined }));
                    }
                  }}
                  errors={metadataErrors}
                  onSave={handleSaveObjectMetadata}
                  saveDisabled={!autoCountBackend}
                  savedObjects={savedObjects}
                  selectedSavedId={selectedSavedObjectId}
                  onSelectSaved={(id) => {
                    setSelectedSavedObjectId((prev) =>
                      prev === id ? null : id
                    );
                  }}
                  expandedSavedId={expandedSavedId}
                  onToggleExpand={(id) =>
                    setExpandedSavedId((prev) => (prev === id ? null : id))
                  }
                  onExportAllJson={handleExportSavedObjectsJson}
                  onTransitionEnd={handleObjectMetadataAsideTransitionEnd}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </CadAnalyzerToolProvider>
  );
}
