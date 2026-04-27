"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  LayoutGrid,
  LayoutPanelLeft,
  SlidersHorizontal,
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
  type CadPdfCanvasStackHandle,
  type FloorAreaCssRegion,
} from "@/components/quantity-take-off/cad-analyzer/CadPdfCanvasStack";
import {
  backendPointToScreenCss,
  floorPolygonBackendToScreenCss,
  resolveFloorPolygonToPreviewBackend,
  pickWallSegmentsFromResponse,
  screenPointToBackend,
  screenRectToBackend,
  type AutoCountApiMatch,
  type AutoCountPageMetrics,
  type QtoCommittedRoi,
} from "@/lib/autoCountCoordinates";
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
  type FacadeSavedSnapshotV1,
  type FloorSavedSnapshotV1,
  type QtoSavedObjectEntryV1,
  type QtoSavedObjectsFileV1,
  type RoomFinderSavedSnapshotV1,
  type WallFinderSavedSnapshotV1,
} from "@/lib/qtoSavedObjectsStorage";
import {
  type ToolSidebarMode,
} from "@/components/quantity-take-off/ToolOptionsSidebar";
import { UnifiedQtoRightSidebar } from "@/components/quantity-take-off/UnifiedQtoRightSidebar";
import {
  clearQtoDoorFinder,
  loadQtoDoorFinder,
  saveQtoDoorFinder,
} from "@/lib/qtoDoorFinderStorage";
import {
  clearQtoWallFinder,
  loadQtoWallFinder,
  saveQtoWallFinder,
  type WallFinderBackendState,
} from "@/lib/qtoWallFinderStorage";
import {
  clearQtoRoomFinder,
  loadQtoRoomFinder,
  saveQtoRoomFinder,
  type RoomFinderBackendState,
} from "@/lib/qtoRoomFinderStorage";
import type { ObjectMetadataStatsMode } from "@/components/quantity-take-off/ObjectMetadataSidebar";
import Swal from "sweetalert2";
import {
  getAutoCountMatches,
  postAutoCount,
  postAutoCountAdd,
  postAutoCountRemove,
} from "@/services/autoCountService";
import {
  getSearchTextMatches,
  postSearchText,
  postSearchTextAdd,
  postSearchTextRemove,
} from "@/services/searchTextService";
import {
  getAnalyzeDoorsMatches,
  postAnalyzeDoors,
  postAnalyzeDoorsAdd,
  postAnalyzeDoorsRemove,
} from "@/services/doorFinderService";
import {
  getAnalyzeWallsSegments,
  postAnalyzeWalls,
  postAnalyzeWallsAdd,
  postAnalyzeWallsRemove,
  type WallFinderApiSegment,
} from "@/services/wallFinderService";
import {
  getAnalyzeRoomsRooms,
  pickRoomRowsFromResponse,
  postAnalyzeRooms,
  postAnalyzeRoomsAdd,
  postAnalyzeRoomsRemove,
  ROOM_FINDER_DEFAULT_PIXEL_TO_METER,
  type RoomFinderRoomRow,
} from "@/services/roomFinderService";
import {
  FLOOR_EXTRACT_PIXEL_TO_METER,
  normalizeExtractFloorPolygon,
  postExtractFloor,
} from "@/services/floorExtractorService";
import {
  clearQtoFloorExtractor,
  loadQtoFloorExtractor,
  saveQtoFloorExtractor,
  type FloorExtractionPersistedV1,
} from "@/lib/qtoFloorExtractorStorage";
import {
  clearQtoFacade,
  loadQtoFacade,
  saveQtoFacade,
  type FacadeBackendState,
} from "@/lib/qtoFacadeStorage";
import {
  FACADE_PIXEL_TO_METER,
  getAnalyzeFacadeDimensions,
  postAnalyzeFacade,
  postAnalyzeFacadeAdd,
  postAnalyzeFacadeRemove,
  type AnalyzeFacadeResponse,
} from "@/services/facadeAnalyzerService";
import { createClientId } from "@/lib/createClientId";
import type { AutoCountRoiCss } from "@/components/quantity-take-off/cad-analyzer/CadPdfCanvasStack";

const WALL_FINDER_PIXEL_TO_M = 0.01;

function committedRoiFromCanvasCss(
  roiCss: AutoCountRoiCss,
  getMetrics: (pageNumber: number) => AutoCountPageMetrics | null
): QtoCommittedRoi | null {
  const m = getMetrics(roiCss.pageNumber);
  if (!m) return null;
  return {
    pageNumber: roiCss.pageNumber,
    roi: screenRectToBackend(
      {
        x: roiCss.x,
        y: roiCss.y,
        width: roiCss.width,
        height: roiCss.height,
      },
      m
    ),
  };
}

type LastAnalyzeKind =
  | "autoCount"
  | "doorFinder"
  | "facade"
  | "wallFinder"
  | "roomFinder"
  | "floorArea"
  | "searchText";

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

/** Reopen chip when the unified options panel is closed (any canvas tool, including Select / Pan). */
function QtoRightSidebarReopenChip({
  showToolbar,
  autoCountSidebarMounted,
  lastToolAction,
  openToolOptionsPanel,
}: {
  showToolbar: boolean;
  autoCountSidebarMounted: boolean;
  lastToolAction: ToolSidebarMode;
  openToolOptionsPanel: (mode: ToolSidebarMode) => void;
}) {
  const { tool } = useCadAnalyzerTool();
  const isNavigationTool = tool === "pointer" || tool === "hand";
  const showChip = showToolbar && !autoCountSidebarMounted;

  const chipLabel = isNavigationTool
    ? "Your saved items"
    : lastToolAction === "doorFinder"
      ? "Door finder options"
      : lastToolAction === "facade"
        ? "Facade options"
        : lastToolAction === "wallFinder"
          ? "Wall finder options"
          : lastToolAction === "roomFinder"
            ? "Room finder options"
            : lastToolAction === "floorArea"
              ? "Floor area options"
              : lastToolAction === "searchText"
                ? "Search text options"
                : "Symbol options";
  const chipAria = isNavigationTool
    ? "Open your saved items and export"
    : lastToolAction === "doorFinder"
      ? "Open door finder options"
      : lastToolAction === "facade"
        ? "Open facade options"
        : lastToolAction === "wallFinder"
          ? "Open wall finder options"
          : lastToolAction === "roomFinder"
            ? "Open room finder options"
            : lastToolAction === "floorArea"
              ? "Open floor area options"
              : lastToolAction === "searchText"
                ? "Open search text options"
                : "Open symbol options";

  if (!showChip) return null;

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-30 flex flex-col items-end gap-2 sm:right-3 sm:top-3">
      <button
        type="button"
        onClick={() => openToolOptionsPanel(lastToolAction)}
        className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/70 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm"
        aria-label={chipAria}
      >
        <SlidersHorizontal
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4"
          aria-hidden
        />
        <span className="min-w-0 truncate">{chipLabel}</span>
      </button>
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

  const [treeNodes, setTreeNodes] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(() => Boolean(trimmedJobId));
  const [selectedPdfPath, setSelectedPdfPath] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfPhase, setPdfPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  const [autoCountRoi, setAutoCountRoi] = useState<QtoCommittedRoi | null>(null);
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
  const [searchTextManualSelectActive, setSearchTextManualSelectActive] =
    useState(false);
  /** Toolbar “Add Missing Count” — arms ROI for POST /auto_count/add only (not full detection). */
  const [autoCountManualAddActive, setAutoCountManualAddActive] =
    useState(false);
  /** Object ID/name form — shown only after a successful analyze/search, or when session storage restores results. Hidden when switching tools until the next success. */
  const [objectDataFormVisible, setObjectDataFormVisible] = useState(false);
  const [rotationInvariant, setRotationInvariant] = useState(true);
  const [confidence, setConfidence] = useState(0.7);
  const [doorFinderRoi, setDoorFinderRoi] = useState<QtoCommittedRoi | null>(
    null
  );
  const [doorFinderBackend, setDoorFinderBackend] =
    useState<AutoCountBackendState | null>(null);
  /** Mirrors `doorFinderBackend.matches` for API response handling (also persisted via session storage). */
  const [doorFinderResults, setDoorFinderResults] = useState<AutoCountApiMatch[]>(
    []
  );
  const [doorFinderLoading, setDoorFinderLoading] = useState(false);
  const [facadeRoi, setFacadeRoi] = useState<QtoCommittedRoi | null>(null);
  const [facadeBackend, setFacadeBackend] = useState<FacadeBackendState | null>(
    null
  );
  const [facadeLoading, setFacadeLoading] = useState(false);
  const [wallFinderRoi, setWallFinderRoi] = useState<QtoCommittedRoi | null>(
    null
  );
  const [wallFinderBackend, setWallFinderBackend] =
    useState<WallFinderBackendState | null>(null);
  const [wallFinderResults, setWallFinderResults] = useState<
    WallFinderApiSegment[]
  >([]);
  const [wallFinderLoading, setWallFinderLoading] = useState(false);
  const [roomFinderRoi, setRoomFinderRoi] = useState<QtoCommittedRoi | null>(
    null
  );
  const [roomFinderBackend, setRoomFinderBackend] =
    useState<RoomFinderBackendState | null>(null);
  const [roomResults, setRoomResults] = useState<RoomFinderRoomRow[]>([]);
  const [roomFinderLoading, setRoomFinderLoading] = useState(false);
  /** Floor `/extract_floor` — accumulated regions + optional pending click */
  const [floorExtractions, setFloorExtractions] = useState<
    FloorExtractionPersistedV1[]
  >([]);
  const [floorPendingSeed, setFloorPendingSeed] = useState<{
    pageNumber: number;
    seedBackend: { x: number; y: number };
  } | null>(null);
  const [floorExtractorLoading, setFloorExtractorLoading] = useState(false);
  const [lastFloorNewAreaM2, setLastFloorNewAreaM2] = useState<number | null>(
    null
  );
  const [lastAnalyzeKind, setLastAnalyzeKind] =
    useState<LastAnalyzeKind>("autoCount");
  const lastAnalyzeKindRef = useRef(lastAnalyzeKind);
  lastAnalyzeKindRef.current = lastAnalyzeKind;
  const autoCountUnmountTimeoutRef = useRef<number | null>(null);
  const isAutoCountOpenRef = useRef(isAutoCountOpen);
  isAutoCountOpenRef.current = isAutoCountOpen;
  const objectDataSectionRef = useRef<HTMLDivElement | null>(null);

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
  const prevQtoToolRef = useRef<ToolSidebarMode | null>(null);
  const cadCanvasRef = useRef<CadPdfCanvasStackHandle>(null);

  const scrollToObjectDataSection = useCallback(() => {
    requestAnimationFrame(() => {
      objectDataSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

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
    }
  }, [
    trimmedJobId,
    clearDrawerUnmountTimeout,
    clearAutoCountUnmountTimeout,
  ]);

  useEffect(() => {
    return () => {
      clearDrawerUnmountTimeout();
      clearAutoCountUnmountTimeout();
    };
  }, [
    clearDrawerUnmountTimeout,
    clearAutoCountUnmountTimeout,
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
    setDoorFinderLoading(false);
    setFacadeLoading(false);
    setWallFinderLoading(false);
    if (!trimmedJobId || !selectedPdfPath?.trim()) {
      setAutoCountRoi(null);
      setAutoCountBackend(null);
      setDoorFinderRoi(null);
      setDoorFinderBackend(null);
      setDoorFinderResults([]);
      setFacadeRoi(null);
      setFacadeBackend(null);
      setWallFinderRoi(null);
      setWallFinderBackend(null);
      setWallFinderResults([]);
      setRoomFinderRoi(null);
      setRoomFinderBackend(null);
      setRoomResults([]);
      setFloorExtractions([]);
      setFloorPendingSeed(null);
      setLastFloorNewAreaM2(null);
      setLastAnalyzeKind("autoCount");
      setObjectDataFormVisible(false);
      return;
    }
    const path = selectedPdfPath.trim();
    const storedAc = loadQtoAutoCount(trimmedJobId, path);
    const storedDf = loadQtoDoorFinder(trimmedJobId, path);
    const storedFacade = loadQtoFacade(trimmedJobId, path);
    const storedWf = loadQtoWallFinder(trimmedJobId, path);
    const storedRf = loadQtoRoomFinder(trimmedJobId, path);
    const storedFloor = loadQtoFloorExtractor(trimmedJobId, path);
    if (storedAc) {
      setAutoCountBackend({
        pageNumber: storedAc.pageNumber,
        roi: storedAc.roi,
        matches: storedAc.matches,
      });
    } else {
      setAutoCountBackend(null);
    }
    if (storedDf) {
      setDoorFinderBackend({
        pageNumber: storedDf.pageNumber,
        roi: storedDf.roi,
        matches: storedDf.matches,
      });
      setDoorFinderResults(storedDf.matches);
    } else {
      setDoorFinderBackend(null);
      setDoorFinderResults([]);
    }
    if (storedFacade) {
      setFacadeBackend({
        pageNumber: storedFacade.pageNumber,
        roi: storedFacade.roi,
        response: storedFacade.response,
      });
    } else {
      setFacadeBackend(null);
    }
    if (storedWf) {
      setWallFinderBackend({
        pageNumber: storedWf.pageNumber,
        roi: storedWf.roi,
        response: storedWf.response,
      });
      setWallFinderResults(
        pickWallSegmentsFromResponse(storedWf.response) as WallFinderApiSegment[]
      );
    } else {
      setWallFinderBackend(null);
      setWallFinderResults([]);
    }
    if (storedRf) {
      setRoomFinderBackend({
        pageNumber: storedRf.pageNumber,
        roi: storedRf.roi,
        response: storedRf.response,
      });
      setRoomResults(pickRoomRowsFromResponse(storedRf.response));
    } else {
      setRoomFinderBackend(null);
      setRoomResults([]);
    }
    if (storedFloor?.extractions?.length) {
      setFloorExtractions(storedFloor.extractions);
      const last =
        storedFloor.extractions[storedFloor.extractions.length - 1];
      setLastFloorNewAreaM2(last?.areaM2 ?? null);
    } else {
      setFloorExtractions([]);
      setLastFloorNewAreaM2(null);
    }
    setAutoCountRoi(null);
    setDoorFinderRoi(null);
    setFacadeRoi(null);
    setWallFinderRoi(null);
    setRoomFinderRoi(null);
    setFloorPendingSeed(null);
    if (storedAc?.source === "searchText") {
      setLastAnalyzeKind("searchText");
      void getSearchTextMatches({
        job_id: trimmedJobId,
        file_path: path,
      })
        .then(({ matches }) => {
          setAutoCountBackend((prev) => {
            if (!prev) return prev;
            const next: AutoCountBackendState = {
              ...prev,
              matches: matches as AutoCountBackendState["matches"],
            };
            saveQtoAutoCount(trimmedJobId, path, {
              v: 1,
              source: "searchText",
              ...next,
            });
            return next;
          });
          setMetadataCount(matches.length);
        })
        .catch((e) => {
          console.log("[qto] getSearchTextMatches on restore failed", e);
        });
    } else if (storedAc) setLastAnalyzeKind("autoCount");
    else if (storedDf) {
      setLastAnalyzeKind("doorFinder");
      void getAnalyzeDoorsMatches({
        job_id: trimmedJobId,
        file_path: path,
      })
        .then(({ matches }) => {
          setDoorFinderBackend((prev) => {
            if (!prev) return prev;
            const next: AutoCountBackendState = {
              ...prev,
              matches: matches as AutoCountBackendState["matches"],
            };
            saveQtoDoorFinder(trimmedJobId, path, { v: 1, ...next });
            return next;
          });
          setDoorFinderResults(matches);
          setMetadataCount(matches.length);
        })
        .catch((e) => {
          console.log("[qto] getAnalyzeDoorsMatches on restore failed", e);
        });
    } else if (storedFacade) setLastAnalyzeKind("facade");
    else if (storedWf) {
      setLastAnalyzeKind("wallFinder");
      void getAnalyzeWallsSegments({
        job_id: trimmedJobId,
        file_path: path,
      })
        .then((res) => {
          setWallFinderBackend((prev) => {
            if (!prev) return prev;
            const next: WallFinderBackendState = {
              ...prev,
              response: res,
            };
            saveQtoWallFinder(trimmedJobId, path, { v: 1, ...next });
            return next;
          });
          setWallFinderResults(
            pickWallSegmentsFromResponse(res) as WallFinderApiSegment[]
          );
        })
        .catch((e) => {
          console.log("[qto] getAnalyzeWallsSegments on restore failed", e);
        });
    } else if (storedRf) {
      setLastAnalyzeKind("roomFinder");
      void getAnalyzeRoomsRooms({
        job_id: trimmedJobId,
        file_path: path,
      })
        .then((res) => {
          setRoomFinderBackend((prev) => {
            if (!prev) return prev;
            const next: RoomFinderBackendState = {
              ...prev,
              response: res,
            };
            saveQtoRoomFinder(trimmedJobId, path, { v: 1, ...next });
            return next;
          });
          setRoomResults(pickRoomRowsFromResponse(res));
        })
        .catch((e) => {
          console.log("[qto] getAnalyzeRoomsRooms on restore failed", e);
        });
    }
    else if (storedFloor?.extractions?.length) setLastAnalyzeKind("floorArea");
    else setLastAnalyzeKind("autoCount");

    setObjectDataFormVisible(
      Boolean(
        storedAc ||
          storedDf ||
          storedFacade ||
          storedWf ||
          storedRf ||
          storedFloor?.extractions?.length
      )
    );
  }, [trimmedJobId, selectedPdfPath]);

  useEffect(() => {
    if (prevQtoToolRef.current === null) {
      prevQtoToolRef.current = lastToolAction;
      return;
    }
    if (prevQtoToolRef.current !== lastToolAction) {
      setObjectDataFormVisible(false);
    }
    prevQtoToolRef.current = lastToolAction;
  }, [lastToolAction]);

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

  /** Canvas emits CSS rects; store API-space ROI so overlays stay aligned on zoom/resize. */
  const commitRoiFromDrag = useCallback(
    (
      roiCss: AutoCountRoiCss | null,
      setRoi: (value: QtoCommittedRoi | null) => void,
      panelMode: ToolSidebarMode
    ) => {
      if (!roiCss) {
        setRoi(null);
        return;
      }
      const getM = (p: number) =>
        cadCanvasRef.current?.getAutoCountPageMetrics(p) ?? null;
      let committed = committedRoiFromCanvasCss(roiCss, getM);
      const apply = (c: QtoCommittedRoi | null) => {
        if (c) {
          setRoi(c);
          openToolOptionsPanel(panelMode);
        }
      };
      if (committed) {
        apply(committed);
        return;
      }
      requestAnimationFrame(() => {
        committed = committedRoiFromCanvasCss(roiCss, getM);
        apply(committed);
      });
    },
    [openToolOptionsPanel]
  );

  const handleAutoCountToolSelect = useCallback(() => {
    setLastToolAction("autoCount");
  }, []);

  const handleDoorFinderToolSelect = useCallback(() => {
    setLastToolAction("doorFinder");
  }, []);

  const handleFacadeToolSelect = useCallback(() => {
    setLastToolAction("facade");
  }, []);

  const handleWallFinderToolSelect = useCallback(() => {
    setLastToolAction("wallFinder");
  }, []);

  const handleRoomFinderToolSelect = useCallback(() => {
    setLastToolAction("roomFinder");
  }, []);

  /** Open symbol options only after a ROI is committed (mouse/touch release), not when picking the tool. */
  const handleAutoCountRoiChange = useCallback(
    (roi: AutoCountRoiCss | null) => {
      const panelMode: ToolSidebarMode =
        lastToolAction === "searchText" ? "searchText" : "autoCount";
      if (panelMode === "searchText" && roi) {
        setSearchTextManualSelectActive(false);
      }
      commitRoiFromDrag(roi, setAutoCountRoi, panelMode);
    },
    [commitRoiFromDrag, lastToolAction]
  );

  const handleDoorFinderRoiChange = useCallback(
    (roi: AutoCountRoiCss | null) => {
      commitRoiFromDrag(roi, setDoorFinderRoi, "doorFinder");
    },
    [commitRoiFromDrag]
  );

  const handleFacadeRoiChange = useCallback(
    (roi: AutoCountRoiCss | null) => {
      commitRoiFromDrag(roi, setFacadeRoi, "facade");
    },
    [commitRoiFromDrag]
  );

  const handleWallFinderRoiChange = useCallback(
    (roi: AutoCountRoiCss | null) => {
      commitRoiFromDrag(roi, setWallFinderRoi, "wallFinder");
    },
    [commitRoiFromDrag]
  );

  const handleRoomFinderRoiChange = useCallback(
    (roi: AutoCountRoiCss | null) => {
      commitRoiFromDrag(roi, setRoomFinderRoi, "roomFinder");
    },
    [commitRoiFromDrag]
  );

  const handleFloorAreaToolSelect = useCallback(() => {
    setLastToolAction("floorArea");
  }, []);

  const handleFloorAreaPlaceSeed = useCallback(
    (pageNumber: number, xCss: number, yCss: number) => {
      const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(pageNumber);
      if (!metrics) {
        toast.error(
          "Page layout not ready. Wait for the PDF to finish rendering."
        );
        return;
      }
      setFloorPendingSeed({
        pageNumber,
        seedBackend: screenPointToBackend(xCss, yCss, metrics),
      });
      openToolOptionsPanel("floorArea");
    },
    [openToolOptionsPanel]
  );

  const handleFloorExtract = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    if (!floorPendingSeed) {
      toast.error("Click inside a room on the drawing to set a seed point.");
      return;
    }
    const pageNum = floorPendingSeed.pageNumber;
    const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(pageNum);
    if (!metrics) {
      toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
      return;
    }
    const seedBackend = floorPendingSeed.seedBackend;
    setFloorExtractorLoading(true);
    try {
      const res = await postExtractFloor({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        seed: { x: seedBackend.x, y: seedBackend.y },
        pixel_to_meter: FLOOR_EXTRACT_PIXEL_TO_METER,
      });
      if (res.success === false || res.error) {
        toast.error(String(res.error ?? "Floor extraction failed."));
        return;
      }
      const area = res.new_area ?? 0;
      let cssPoly: { x: number; y: number }[] = [];
      let polygonRaw: { x: number; y: number }[] | undefined;
      let polygonPreviewBackend: { x: number; y: number }[] | undefined;
      const rawPoly =
        res.new_polygon ?? res.polygon ?? res.current_polygon;
      const pts = normalizeExtractFloorPolygon(rawPoly);
      if (pts) {
        polygonRaw = pts;
        polygonPreviewBackend = resolveFloorPolygonToPreviewBackend(
          pts,
          seedBackend
        );
        cssPoly = floorPolygonBackendToScreenCss(
          polygonPreviewBackend,
          metrics
        );
      }
      const id = createClientId();
      const seedCss = backendPointToScreenCss(seedBackend, metrics);
      const extraction: FloorExtractionPersistedV1 = {
        id,
        pageNumber: pageNum,
        seedBackend,
        seedCss,
        cssPoly,
        polygonRaw,
        polygonPreviewBackend,
        areaM2: area,
      };
      setFloorExtractions((prev) => {
        const next = [...prev, extraction];
        saveQtoFloorExtractor(trimmedJobId, selectedPdfPath.trim(), {
          v: 1,
          extractions: next,
        });
        return next;
      });
      setLastFloorNewAreaM2(area);
      setFloorPendingSeed(null);
      setLastAnalyzeKind("floorArea");
      setMetadataCount(0);
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setObjectDataFormVisible(true);
      scrollToObjectDataSection();
      toast.success(
        Number.isFinite(area) && area > 0
          ? `Floor area: ${area.toFixed(2)} m²`
          : "Floor extraction completed."
      );
    } catch (e) {
      console.log("[qto] postExtractFloor failed", e);
      toast.error("Floor extraction failed.");
    } finally {
      setFloorExtractorLoading(false);
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    floorPendingSeed,
    scrollToObjectDataSection,
  ]);

  const floorAreaCanvasSeeds = useMemo(() => {
    const list: Array<{
      pageNumber: number;
      seedBackend: { x: number; y: number };
    }> = [];
    for (const ex of floorExtractions) {
      list.push({
        pageNumber: ex.pageNumber,
        seedBackend: ex.seedBackend,
      });
    }
    if (floorPendingSeed) {
      list.push({
        pageNumber: floorPendingSeed.pageNumber,
        seedBackend: floorPendingSeed.seedBackend,
      });
    }
    return list;
  }, [floorExtractions, floorPendingSeed]);

  const floorAreaCanvasRegions = useMemo((): Array<
    FloorAreaCssRegion & { pageNumber: number }
  > => {
    return floorExtractions.map((ex) => ({
      pageNumber: ex.pageNumber,
      id: ex.id,
      cssPoly: ex.cssPoly,
      areaM2: ex.areaM2,
      seedCss: ex.seedCss,
      polygonRaw: ex.polygonRaw,
      polygonPreviewBackend: ex.polygonPreviewBackend,
      seedBackend: ex.seedBackend,
    }));
  }, [floorExtractions]);

  const metadataBackend = useMemo(() => {
    if (lastAnalyzeKind === "doorFinder") return doorFinderBackend;
    return autoCountBackend;
  }, [lastAnalyzeKind, doorFinderBackend, autoCountBackend]);

  const hasObjectMetadataSource = useMemo(() => {
    if (lastAnalyzeKind === "wallFinder") return wallFinderBackend != null;
    if (lastAnalyzeKind === "roomFinder") return roomFinderBackend != null;
    if (lastAnalyzeKind === "floorArea") return floorExtractions.length > 0;
    if (lastAnalyzeKind === "facade") return facadeBackend != null;
    return metadataBackend != null;
  }, [
    lastAnalyzeKind,
    wallFinderBackend,
    roomFinderBackend,
    metadataBackend,
    floorExtractions.length,
    facadeBackend,
  ]);

  const handleSearchTextSubmit = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchTextError("Search text is required.");
      return;
    }
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    setSearchTextError(null);
    setSearchTextManualSelectActive(false);
    setSearchTextLoading(true);
    try {
      await postSearchText({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        search_term: term,
        case_sensitive: caseSensitive,
      });
      const { matches: rawMatches } = await getSearchTextMatches({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
      });
      const n = rawMatches.length;
      const pageNumber = 1;
      const nextBackend: AutoCountBackendState = {
        pageNumber,
        roi: { x: 0, y: 0, width: 0, height: 0 },
        matches: rawMatches,
      };
      setAutoCountBackend(nextBackend);
      setLastAnalyzeKind("searchText");
      saveQtoAutoCount(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        source: "searchText",
        ...nextBackend,
      });
      setMetadataCount(n);
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      setObjectDataFormVisible(true);
      clearAutoCountUnmountTimeout();
      if (!autoCountSidebarMounted) {
        setAutoCountSidebarMounted(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAutoCountOpen(true);
            setLastToolAction("searchText");
            requestAnimationFrame(() => scrollToObjectDataSection());
          });
        });
      } else {
        setIsAutoCountOpen(true);
        setLastToolAction("searchText");
        requestAnimationFrame(() => scrollToObjectDataSection());
      }
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
    autoCountSidebarMounted,
    clearAutoCountUnmountTimeout,
    scrollToObjectDataSection,
  ]);

  const handleSearchTextManualSelectToggle = useCallback(() => {
    if (searchTextManualSelectActive) {
      setSearchTextManualSelectActive(false);
      setAutoCountRoi(null);
      return;
    }
    if (lastAnalyzeKind !== "searchText" || !autoCountBackend) {
      toast.error("Run Search first to enable manual add.");
      return;
    }
    setLastToolAction("searchText");
    setSearchTextManualSelectActive(true);
    setAutoCountRoi(null);
    setSearchTextError(null);
  }, [
    searchTextManualSelectActive,
    lastAnalyzeKind,
    autoCountBackend,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
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
  }, [closeDrawer, closeAutoCountPanel]);

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
            "w-[min(90vw,300px)] md:w-[280px] lg:w-[300px]",
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
      clearQtoDoorFinder(trimmedJobId, path);
      clearQtoFacade(trimmedJobId, path);
      clearQtoWallFinder(trimmedJobId, path);
      clearQtoRoomFinder(trimmedJobId, path);
      clearQtoFloorExtractor(trimmedJobId, path);
      clearQtoSavedObjects(trimmedJobId, path);
    }
    setAutoCountRoi(null);
    setAutoCountBackend(null);
    setDoorFinderRoi(null);
    setDoorFinderBackend(null);
    setDoorFinderResults([]);
    setFacadeRoi(null);
    setFacadeBackend(null);
    setWallFinderRoi(null);
    setWallFinderBackend(null);
    setWallFinderResults([]);
    setRoomFinderRoi(null);
    setRoomFinderBackend(null);
    setRoomResults([]);
    setFloorExtractions([]);
    setFloorPendingSeed(null);
    setLastFloorNewAreaM2(null);
    setFloorExtractorLoading(false);
    setAutoCountLoading(false);
    setDoorFinderLoading(false);
    setFacadeLoading(false);
    setWallFinderLoading(false);
    setRoomFinderLoading(false);
    setSearchTerm("");
    setCaseSensitive(false);
    setSearchTextError(null);
    setSearchTextLoading(false);
    setSearchTextManualSelectActive(false);
    setAutoCountManualAddActive(false);
    setLastToolAction("autoCount");
    setSelectedSavedObjectId(null);
    setExpandedSavedId(null);
    setSavedObjects([]);
    setMetadataObjectId("");
    setMetadataObjectName("");
    setMetadataCount(0);
    setMetadataErrors({});
    setObjectDataFormVisible(false);
    closeAutoCountPanel();
  }, [
    trimmedJobId,
    selectedPdfPath,
    closeAutoCountPanel,
  ]);

  useEffect(() => {
    if (lastToolAction !== "searchText" && searchTextManualSelectActive) {
      setSearchTextManualSelectActive(false);
    }
  }, [lastToolAction, searchTextManualSelectActive]);

  useEffect(() => {
    if (lastToolAction !== "autoCount" && autoCountManualAddActive) {
      setAutoCountManualAddActive(false);
      setAutoCountRoi(null);
    }
  }, [lastToolAction, autoCountManualAddActive]);

  const handleAutoCountManualAddToggle = useCallback(() => {
    if (autoCountManualAddActive) {
      setAutoCountManualAddActive(false);
      setAutoCountRoi(null);
      return;
    }
    if (lastAnalyzeKind !== "autoCount" || !autoCountBackend) {
      toast.error("Run Auto Count first to add missing symbols.");
      return;
    }
    setLastToolAction("autoCount");
    setAutoCountManualAddActive(true);
    setAutoCountRoi(null);
  }, [
    autoCountManualAddActive,
    lastAnalyzeKind,
    autoCountBackend,
  ]);

  const selectedSavedEntry = useMemo(() => {
    if (!selectedSavedObjectId) return undefined;
    return savedObjects.find((s) => s.id === selectedSavedObjectId);
  }, [selectedSavedObjectId, savedObjects]);

  /** Saved snapshots stay on the canvas; exclude the row selected for emphasis so we do not double-draw it. */
  const persistedSavedOverlaysForCanvas = useMemo(
    () => savedObjects.filter((s) => s.id !== selectedSavedObjectId),
    [savedObjects, selectedSavedObjectId]
  );

  const canvasAutoCountBackend = useMemo(() => {
    if (!selectedSavedEntry) return autoCountBackend;
    if (selectedSavedEntry.analysisKind === "walls") return autoCountBackend;
    return selectedSavedEntry.canvasSnapshot as AutoCountBackendState;
  }, [selectedSavedEntry, autoCountBackend]);

  const canvasDoorFinderBackend = useMemo(() => {
    if (!selectedSavedEntry) return doorFinderBackend;
    if (
      selectedSavedEntry.analysisKind === "walls" ||
      selectedSavedEntry.analysisKind === "rooms"
    ) {
      return doorFinderBackend;
    }
    return null;
  }, [selectedSavedEntry, doorFinderBackend]);

  const canvasWallFinderBackend = useMemo((): WallFinderBackendState | null => {
    if (!selectedSavedEntry) return wallFinderBackend;
    if (selectedSavedEntry.analysisKind === "walls") {
      const s = selectedSavedEntry.canvasSnapshot as WallFinderSavedSnapshotV1;
      return {
        pageNumber: s.pageNumber,
        roi: s.roi,
        response: s.response,
      };
    }
    return null;
  }, [selectedSavedEntry, wallFinderBackend]);

  const canvasRoomFinderBackend = useMemo((): RoomFinderBackendState | null => {
    if (!selectedSavedEntry) return roomFinderBackend;
    if (selectedSavedEntry.analysisKind === "rooms") {
      const s = selectedSavedEntry.canvasSnapshot as RoomFinderSavedSnapshotV1;
      return {
        pageNumber: s.pageNumber,
        roi: s.roi,
        response: s.response,
      };
    }
    return null;
  }, [selectedSavedEntry, roomFinderBackend]);

  const emphasizeSavedHighlight = Boolean(selectedSavedEntry);

  const handleSaveObjectMetadata = useCallback(() => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) {
      toast.error("Nothing to save. Run Analyze first.");
      return;
    }
    const errs = validateObjectMetadataForm(metadataObjectId, metadataObjectName);
    setMetadataErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const idTrim = metadataObjectId.trim();
    const nameTrim = metadataObjectName.trim();

    if (lastAnalyzeKind === "wallFinder") {
      if (!wallFinderBackend) {
        toast.error("Nothing to save. Run Analyze first.");
        return;
      }
      const tw = wallFinderBackend.response.total_walls ?? 0;
      const tl = wallFinderBackend.response.total_length_m ?? 0;
      if (!Number.isFinite(tw) || tw < 0) {
        toast.error("Invalid wall count from analysis.");
        return;
      }
      const snap: WallFinderSavedSnapshotV1 = {
        pageNumber: wallFinderBackend.pageNumber,
        roi: { ...wallFinderBackend.roi },
        response: wallFinderBackend.response,
      };
      const entry: QtoSavedObjectEntryV1 = {
        v: 1,
        id: createClientId(),
        objectId: idTrim,
        objectName: nameTrim,
        count: tw,
        savedAt: Date.now(),
        analysisKind: "walls",
        totalWallLengthM: tl,
        canvasSnapshot: snap,
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
      return;
    }

    if (lastAnalyzeKind === "roomFinder") {
      if (!roomFinderBackend) {
        toast.error("Nothing to save. Run Analyze first.");
        return;
      }
      const tr =
        roomFinderBackend.response.total_rooms ??
        pickRoomRowsFromResponse(roomFinderBackend.response).length;
      const ta = roomFinderBackend.response.total_area_m2 ?? 0;
      if (!Number.isFinite(tr) || tr < 0) {
        toast.error("Invalid room count from analysis.");
        return;
      }
      const snap: RoomFinderSavedSnapshotV1 = {
        pageNumber: roomFinderBackend.pageNumber,
        roi: { ...roomFinderBackend.roi },
        response: roomFinderBackend.response,
      };
      const entry: QtoSavedObjectEntryV1 = {
        v: 1,
        id: createClientId(),
        objectId: idTrim,
        objectName: nameTrim,
        count: tr,
        savedAt: Date.now(),
        analysisKind: "rooms",
        totalAreaM2: Number.isFinite(ta) ? ta : 0,
        canvasSnapshot: snap,
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
      return;
    }

    if (lastAnalyzeKind === "floorArea") {
      if (floorExtractions.length === 0) {
        toast.error("Nothing to save. Run Calculate Area first.");
        return;
      }
      const snap: FloorSavedSnapshotV1 = {
        extractions: floorExtractions.map((ex) => ({ ...ex })),
      };
      const totalArea = floorExtractions.reduce(
        (acc, e) => acc + (Number.isFinite(e.areaM2) ? e.areaM2 : 0),
        0
      );
      const entry: QtoSavedObjectEntryV1 = {
        v: 1,
        id: createClientId(),
        objectId: idTrim,
        objectName: nameTrim,
        count: floorExtractions.length,
        savedAt: Date.now(),
        analysisKind: "floor",
        totalAreaM2: totalArea,
        canvasSnapshot: snap,
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
      return;
    }

    if (lastAnalyzeKind === "facade") {
      if (!facadeBackend) {
        toast.error("Nothing to save. Run Analyze Facade first.");
        return;
      }
      const snap: FacadeSavedSnapshotV1 = {
        pageNumber: facadeBackend.pageNumber,
        roi: { ...facadeBackend.roi },
        response: facadeBackend.response,
      };
      const nw =
        facadeBackend.response.window_count ??
        facadeBackend.response.dimensions?.length ??
        0;
      const entry: QtoSavedObjectEntryV1 = {
        v: 1,
        id: createClientId(),
        objectId: idTrim,
        objectName: nameTrim,
        count: Number.isFinite(nw) ? nw : 0,
        savedAt: Date.now(),
        analysisKind: "facade",
        canvasSnapshot: snap,
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
      return;
    }

    if (!metadataBackend) {
      toast.error("Nothing to save. Run Analyze first.");
      return;
    }
    if (!Number.isFinite(metadataCount) || metadataCount < 0) {
      toast.error("Count must be a non-negative number.");
      return;
    }

    const entry: QtoSavedObjectEntryV1 = {
      v: 1,
      id: createClientId(),
      objectId: idTrim,
      objectName: nameTrim,
      count: metadataCount,
      savedAt: Date.now(),
      canvasSnapshot: {
        pageNumber: metadataBackend.pageNumber,
        roi: { ...metadataBackend.roi },
        matches: metadataBackend.matches.map((m) => ({ ...m })),
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
    lastAnalyzeKind,
    wallFinderBackend,
    roomFinderBackend,
    floorExtractions,
    facadeBackend,
    metadataBackend,
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

  const refreshAutoCountMatchesFromServer = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    const path = selectedPdfPath.trim();
    if (lastAnalyzeKind === "searchText") {
      const { matches } = await getSearchTextMatches({
        job_id: trimmedJobId,
        file_path: path,
      });
      setAutoCountBackend((prev) => {
        if (!prev) return prev;
        const next: AutoCountBackendState = {
          ...prev,
          matches: matches as AutoCountBackendState["matches"],
        };
        saveQtoAutoCount(trimmedJobId, path, {
          v: 1,
          source: "searchText",
          ...next,
        });
        return next;
      });
      setMetadataCount(matches.length);
      return;
    }
    const { matches } = await getAutoCountMatches({
      job_id: trimmedJobId,
      file_path: path,
    });
    setAutoCountBackend((prev) => {
      if (!prev) return prev;
      const next: AutoCountBackendState = {
        ...prev,
        matches: matches as AutoCountBackendState["matches"],
      };
      saveQtoAutoCount(trimmedJobId, path, {
        v: 1,
        ...next,
      });
      return next;
    });
    setMetadataCount(matches.length);
  }, [trimmedJobId, selectedPdfPath, lastAnalyzeKind]);

  const handleAutoCountRemoveMatch = useCallback(
    (matchId: string | number) => {
      if (!trimmedJobId || !selectedPdfPath?.trim() || autoCountLoading) return;
      void Swal.fire({
        title: "Remove match?",
        text: "Are you sure you want to remove this match?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "hsl(var(--destructive))",
      }).then((result) => {
        if (!result.isConfirmed) return;
        void (async () => {
          setAutoCountLoading(true);
          try {
            const path = selectedPdfPath.trim();
            if (lastAnalyzeKindRef.current === "searchText") {
              await postSearchTextRemove({
                job_id: trimmedJobId,
                file_path: path,
                item_id: String(matchId),
              });
            } else {
              await postAutoCountRemove({
                job_id: trimmedJobId,
                file_path: path,
                item_id: String(matchId),
              });
            }
            await refreshAutoCountMatchesFromServer();
            toast.success("Match removed.");
          } catch (e) {
            console.log("[qto] remove match failed", e);
            toast.error("Could not remove match.");
          } finally {
            setAutoCountLoading(false);
          }
        })();
      });
    },
    [
      trimmedJobId,
      selectedPdfPath,
      autoCountLoading,
      refreshAutoCountMatchesFromServer,
    ]
  );

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

    /** Backend + ROI: Search Text manual highlight, Auto Count manual add, or Auto Count re-detect. */
    if (autoCountBackend && autoCountRoi) {
      if (autoCountBackend.pageNumber !== autoCountRoi.pageNumber) {
        toast.error("Draw on the same page as the current analysis.");
        return;
      }

      if (lastAnalyzeKind === "searchText") {
        setAutoCountLoading(true);
        try {
          const path = selectedPdfPath.trim();
          const r = autoCountRoi.roi;
          await postSearchTextAdd({
            job_id: trimmedJobId,
            file_path: path,
            item: {
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
              ...(searchTerm.trim() ? { text: searchTerm.trim() } : {}),
            },
          });
          await refreshAutoCountMatchesFromServer();
          setAutoCountRoi(null);
          toast.success("Match added.");
          setObjectDataFormVisible(true);
          scrollToObjectDataSection();
        } catch (e) {
          console.log("[qto] manual add match failed", e);
          toast.error("Could not add match.");
        } finally {
          setAutoCountLoading(false);
        }
        return;
      }

      if (autoCountManualAddActive) {
        setAutoCountLoading(true);
        try {
          const path = selectedPdfPath.trim();
          await postAutoCountAdd({
            job_id: trimmedJobId,
            file_path: path,
            item: autoCountRoi.roi,
          });
          await refreshAutoCountMatchesFromServer();
          setAutoCountRoi(null);
          setAutoCountManualAddActive(false);
          setLastAnalyzeKind("autoCount");
          toast.success("Match added.");
          setObjectDataFormVisible(true);
          scrollToObjectDataSection();
        } catch (e) {
          console.log("[qto] manual add match failed", e);
          toast.error("Could not add match.");
        } finally {
          setAutoCountLoading(false);
        }
        return;
      }

      setAutoCountLoading(true);
      try {
        const path = selectedPdfPath.trim();
        const res = await postAutoCount({
          job_id: trimmedJobId,
          file_path: path,
          roi: autoCountRoi.roi,
          rotation_invariant: rotationInvariant,
          confidence,
        });
        const rawMatches = res.matches ?? [];
        const next: AutoCountBackendState = {
          pageNumber: analyzedPage,
          roi: autoCountRoi.roi,
          matches: rawMatches,
        };
        setAutoCountBackend(next);
        setAutoCountRoi(null);
        setLastAnalyzeKind("autoCount");
        saveQtoAutoCount(trimmedJobId, path, {
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
        setObjectDataFormVisible(true);
        scrollToObjectDataSection();
      } catch (e) {
        console.log("[qto] postAutoCount failed", e);
        toast.error("Auto count failed.");
      } finally {
        setAutoCountLoading(false);
      }
      return;
    }

    const roiBackend = autoCountRoi
      ? autoCountRoi.roi
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
      setLastAnalyzeKind("autoCount");
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
      setObjectDataFormVisible(true);
      scrollToObjectDataSection();
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
    scrollToObjectDataSection,
    refreshAutoCountMatchesFromServer,
    lastAnalyzeKind,
    searchTerm,
    autoCountManualAddActive,
  ]);

  const refreshDoorMatchesFromServer = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    const path = selectedPdfPath.trim();
    const { matches } = await getAnalyzeDoorsMatches({
      job_id: trimmedJobId,
      file_path: path,
    });
    setDoorFinderBackend((prev) => {
      if (!prev) return prev;
      const next: AutoCountBackendState = {
        ...prev,
        matches: matches as AutoCountBackendState["matches"],
      };
      saveQtoDoorFinder(trimmedJobId, path, { v: 1, ...next });
      return next;
    });
    setDoorFinderResults(matches);
    setMetadataCount(matches.length);
  }, [trimmedJobId, selectedPdfPath]);

  const handleDoorRemoveMatch = useCallback(
    (matchId: string | number) => {
      if (!trimmedJobId || !selectedPdfPath?.trim() || doorFinderLoading) return;
      void Swal.fire({
        title: "Remove door?",
        text: "Are you sure you want to remove this door highlight?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "hsl(var(--destructive))",
      }).then((result) => {
        if (!result.isConfirmed) return;
        void (async () => {
          setDoorFinderLoading(true);
          try {
            await postAnalyzeDoorsRemove({
              job_id: trimmedJobId,
              file_path: selectedPdfPath.trim(),
              item_id: String(matchId),
            });
            await refreshDoorMatchesFromServer();
            toast.success("Door removed.");
          } catch (e) {
            console.log("[qto] postAnalyzeDoorsRemove failed", e);
            toast.error("Could not remove door.");
          } finally {
            setDoorFinderLoading(false);
          }
        })();
      });
    },
    [
      trimmedJobId,
      selectedPdfPath,
      doorFinderLoading,
      refreshDoorMatchesFromServer,
    ]
  );

  const refreshWallSegmentsFromServer = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    const path = selectedPdfPath.trim();
    const res = await getAnalyzeWallsSegments({
      job_id: trimmedJobId,
      file_path: path,
    });
    const segs = pickWallSegmentsFromResponse(res) as WallFinderApiSegment[];
    setWallFinderBackend((prev) => {
      if (!prev) return prev;
      const next: WallFinderBackendState = {
        ...prev,
        response: res,
      };
      saveQtoWallFinder(trimmedJobId, path, { v: 1, ...next });
      return next;
    });
    setWallFinderResults(segs);
  }, [trimmedJobId, selectedPdfPath]);

  const handleWallRemoveSegment = useCallback(
    (itemId: string) => {
      if (!trimmedJobId || !selectedPdfPath?.trim() || wallFinderLoading) return;
      void Swal.fire({
        title: "Remove wall segment?",
        text: "This line will be removed from the wall list.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "hsl(var(--destructive))",
      }).then((result) => {
        if (!result.isConfirmed) return;
        void (async () => {
          setWallFinderLoading(true);
          try {
            await postAnalyzeWallsRemove({
              job_id: trimmedJobId,
              file_path: selectedPdfPath.trim(),
              item_id: itemId,
            });
            await refreshWallSegmentsFromServer();
            toast.success("Wall segment removed.");
          } catch (e) {
            console.log("[qto] postAnalyzeWallsRemove failed", e);
            toast.error("Could not remove wall segment.");
          } finally {
            setWallFinderLoading(false);
          }
        })();
      });
    },
    [
      trimmedJobId,
      selectedPdfPath,
      wallFinderLoading,
      refreshWallSegmentsFromServer,
    ]
  );

  const handleWallSegmentLineCommit = useCallback(
    (
      pageNumber: number,
      startCss: { x: number; y: number },
      endCss: { x: number; y: number }
    ) => {
      if (!trimmedJobId || !selectedPdfPath?.trim() || !wallFinderBackend) return;
      if (wallFinderBackend.pageNumber !== pageNumber) {
        toast.error("Draw on the same page as the wall analysis.");
        return;
      }
      const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(pageNumber);
      if (!metrics) {
        toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
        return;
      }
      const a = screenPointToBackend(startCss.x, startCss.y, metrics);
      const b = screenPointToBackend(endCss.x, endCss.y, metrics);
      const lenPx = Math.hypot(b.x - a.x, b.y - a.y);
      const length_m = lenPx * WALL_FINDER_PIXEL_TO_M;
      if (!Number.isFinite(length_m) || length_m < 0.0001) {
        toast.error("Line is too short.");
        return;
      }
      void (async () => {
        setWallFinderLoading(true);
        try {
          await postAnalyzeWallsAdd({
            job_id: trimmedJobId,
            file_path: selectedPdfPath.trim(),
            item: {
              start: { x: a.x, y: a.y },
              end: { x: b.x, y: b.y },
              length_m,
            },
          });
          await refreshWallSegmentsFromServer();
          toast.success("Wall segment added.");
        } catch (e) {
          console.log("[qto] postAnalyzeWallsAdd failed", e);
          toast.error("Could not add wall segment.");
        } finally {
          setWallFinderLoading(false);
        }
      })();
    },
    [
      trimmedJobId,
      selectedPdfPath,
      wallFinderBackend,
      refreshWallSegmentsFromServer,
    ]
  );

  const handleDoorFinderAnalyze = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    if (!doorFinderRoi && !doorFinderBackend) return;

    const analyzedPage =
      doorFinderRoi?.pageNumber ?? doorFinderBackend!.pageNumber;
    const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(
      analyzedPage
    );
    if (!metrics) {
      toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
      return;
    }
    const roiBackend = doorFinderRoi
      ? doorFinderRoi.roi
      : doorFinderBackend!.roi;

    if (doorFinderBackend && doorFinderRoi) {
      if (doorFinderBackend.pageNumber !== doorFinderRoi.pageNumber) {
        toast.error("Draw on the same page as the current analysis.");
        return;
      }
      setDoorFinderLoading(true);
      try {
        const path = selectedPdfPath.trim();
        const r = doorFinderRoi.roi;
        await postAnalyzeDoorsAdd({
          job_id: trimmedJobId,
          file_path: path,
          item: {
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            label: "door",
          },
        });
        await refreshDoorMatchesFromServer();
        setDoorFinderRoi(null);
        setLastAnalyzeKind("doorFinder");
        toast.success("Door added.");
        setObjectDataFormVisible(true);
        scrollToObjectDataSection();
      } catch (e) {
        console.log("[qto] postAnalyzeDoorsAdd failed", e);
        toast.error("Could not add door.");
      } finally {
        setDoorFinderLoading(false);
      }
      return;
    }

    setDoorFinderLoading(true);
    try {
      const res = await postAnalyzeDoors({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        roi: roiBackend,
        confidence,
        labels: ["door"] as const,
      });
      const rawMatches = res.matches ?? [];
      const next: AutoCountBackendState = {
        pageNumber: analyzedPage,
        roi: roiBackend,
        matches: rawMatches,
      };
      setDoorFinderBackend(next);
      setDoorFinderResults(rawMatches);
      setDoorFinderRoi(null);
      setLastAnalyzeKind("doorFinder");
      saveQtoDoorFinder(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        ...next,
      });
      const n = res.total_found ?? rawMatches.length ?? 0;
      toast.success(
        n > 0 ? `Found ${n} door${n === 1 ? "" : "s"}` : "No doors found"
      );
      setMetadataCount(n);
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      setObjectDataFormVisible(true);
      scrollToObjectDataSection();
    } catch (e) {
      console.log("[qto] postAnalyzeDoors failed", e);
      toast.error("Door finder failed.");
    } finally {
      setDoorFinderLoading(false);
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    doorFinderRoi,
    doorFinderBackend,
    confidence,
    scrollToObjectDataSection,
    refreshDoorMatchesFromServer,
  ]);

  const refreshFacadeDimensionsFromServer = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    const path = selectedPdfPath.trim();
    const { dimensions } = await getAnalyzeFacadeDimensions({
      job_id: trimmedJobId,
      file_path: path,
    });
    const dim = dimensions ?? [];
    setFacadeBackend((prev) => {
      if (!prev) return prev;
      const sum = dim.reduce((acc, d) => {
        const a = Number(d.area_m2);
        return acc + (Number.isFinite(a) && a > 0 ? a : 0);
      }, 0);
      const nextResponse: AnalyzeFacadeResponse = {
        ...prev.response,
        dimensions: dim,
        window_count: dim.length,
      };
      if (sum > 0) {
        nextResponse.window_area = sum;
      }
      const next: FacadeBackendState = {
        ...prev,
        response: nextResponse,
      };
      saveQtoFacade(trimmedJobId, path, { v: 1, ...next });
      return next;
    });
    setMetadataCount(dim.length);
  }, [trimmedJobId, selectedPdfPath]);

  const handleFacadeRemoveWindow = useCallback(
    (itemId: string) => {
      if (!trimmedJobId || !selectedPdfPath?.trim() || facadeLoading) return;
      void Swal.fire({
        title: "Remove window?",
        text: "Remove this window from the facade results?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "hsl(var(--destructive))",
      }).then((result) => {
        if (!result.isConfirmed) return;
        void (async () => {
          setFacadeLoading(true);
          try {
            await postAnalyzeFacadeRemove({
              job_id: trimmedJobId,
              file_path: selectedPdfPath.trim(),
              item_id: itemId,
            });
            await refreshFacadeDimensionsFromServer();
            toast.success("Window removed.");
          } catch (e) {
            console.log("[qto] postAnalyzeFacadeRemove failed", e);
            toast.error("Could not remove window.");
          } finally {
            setFacadeLoading(false);
          }
        })();
      });
    },
    [
      trimmedJobId,
      selectedPdfPath,
      facadeLoading,
      refreshFacadeDimensionsFromServer,
    ]
  );

  const handleFacadeAnalyze = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    if (!facadeRoi && !facadeBackend) return;

    const analyzedPage =
      facadeRoi?.pageNumber ?? facadeBackend!.pageNumber;
    const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(
      analyzedPage
    );
    if (!metrics) {
      toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
      return;
    }
    const roiBackend = facadeRoi ? facadeRoi.roi : facadeBackend!.roi;

    if (facadeBackend && facadeRoi) {
      if (facadeBackend.pageNumber !== facadeRoi.pageNumber) {
        toast.error("Draw on the same page as the current analysis.");
        return;
      }
      setFacadeLoading(true);
      try {
        const path = selectedPdfPath.trim();
        const r = facadeRoi.roi;
        const areaM2 =
          r.width *
          r.height *
          FACADE_PIXEL_TO_METER *
          FACADE_PIXEL_TO_METER;
        await postAnalyzeFacadeAdd({
          job_id: trimmedJobId,
          file_path: path,
          item: {
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            area_m2: areaM2,
          },
        });
        await refreshFacadeDimensionsFromServer();
        setFacadeRoi(null);
        toast.success("Window added.");
        setObjectDataFormVisible(true);
        scrollToObjectDataSection();
      } catch (e) {
        console.log("[qto] postAnalyzeFacadeAdd failed", e);
        toast.error("Could not add window.");
      } finally {
        setFacadeLoading(false);
      }
      return;
    }

    setFacadeLoading(true);
    try {
      const res = await postAnalyzeFacade({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        roi: roiBackend,
        pixel_to_meter: FACADE_PIXEL_TO_METER,
        confidence,
      });
      if (res.success === false || res.error) {
        toast.error(String(res.error ?? "Facade analysis failed."));
        return;
      }
      const next: FacadeBackendState = {
        pageNumber: analyzedPage,
        roi: roiBackend,
        response: res,
      };
      setFacadeBackend(next);
      setFacadeRoi(null);
      setLastAnalyzeKind("facade");
      saveQtoFacade(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        ...next,
      });
      const nw = res.window_count ?? res.dimensions?.length ?? 0;
      toast.success(
        nw > 0
          ? `Found ${nw} window${nw === 1 ? "" : "s"}`
          : "No windows detected in region"
      );
      setMetadataCount(nw);
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      setObjectDataFormVisible(true);
      scrollToObjectDataSection();
    } catch (e) {
      console.log("[qto] postAnalyzeFacade failed", e);
      toast.error("Facade analysis failed.");
    } finally {
      setFacadeLoading(false);
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    facadeRoi,
    facadeBackend,
    confidence,
    scrollToObjectDataSection,
    refreshFacadeDimensionsFromServer,
  ]);

  const handleWallFinderAnalyze = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    if (!wallFinderRoi && !wallFinderBackend) return;

    const analyzedPage =
      wallFinderRoi?.pageNumber ?? wallFinderBackend!.pageNumber;
    const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(
      analyzedPage
    );
    if (!metrics) {
      toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
      return;
    }

    if (wallFinderBackend && wallFinderRoi) {
      if (wallFinderBackend.pageNumber !== wallFinderRoi.pageNumber) {
        toast.error("Draw on the same page as the current analysis.");
        return;
      }
      const r = wallFinderRoi.roi;
      if (r.width <= 0 || r.height <= 0) {
        toast.error("Selection is too small.");
        return;
      }
      const midY = r.y + r.height / 2;
      const midX = r.x + r.width / 2;
      const { start, end } =
        r.width >= r.height
          ? {
              start: { x: r.x, y: midY },
              end: { x: r.x + r.width, y: midY },
            }
          : {
              start: { x: midX, y: r.y },
              end: { x: midX, y: r.y + r.height },
            };
      const lenPx = Math.hypot(end.x - start.x, end.y - start.y);
      const length_m = lenPx * WALL_FINDER_PIXEL_TO_M;

      setWallFinderLoading(true);
      try {
        await postAnalyzeWallsAdd({
          job_id: trimmedJobId,
          file_path: selectedPdfPath.trim(),
          item: { start, end, length_m },
        });
        await refreshWallSegmentsFromServer();
        setWallFinderRoi(null);
        setLastAnalyzeKind("wallFinder");
        toast.success("Wall segment added.");
        setObjectDataFormVisible(true);
        scrollToObjectDataSection();
      } catch (e) {
        console.log("[qto] postAnalyzeWallsAdd (from ROI) failed", e);
        toast.error("Could not add wall segment.");
      } finally {
        setWallFinderLoading(false);
      }
      return;
    }

    const roiBackend = wallFinderRoi
      ? wallFinderRoi.roi
      : wallFinderBackend!.roi;

    setWallFinderLoading(true);
    try {
      const res = await postAnalyzeWalls({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        roi: roiBackend,
        pixel_to_meter: WALL_FINDER_PIXEL_TO_M,
        confidence,
      });
      const segs = pickWallSegmentsFromResponse(res);
      setWallFinderResults(segs as WallFinderApiSegment[]);
      const next: WallFinderBackendState = {
        pageNumber: analyzedPage,
        roi: roiBackend,
        response: res,
      };
      setWallFinderBackend(next);
      setWallFinderRoi(null);
      setLastAnalyzeKind("wallFinder");
      saveQtoWallFinder(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        ...next,
      });
      const nw = res.total_walls ?? segs.length ?? 0;
      toast.success(
        res.success === false
          ? "Wall analysis completed with issues."
          : nw > 0
            ? `Found ${nw} wall segment${nw === 1 ? "" : "s"}`
            : "No walls found in region"
      );
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      setObjectDataFormVisible(true);
      scrollToObjectDataSection();
    } catch (e) {
      console.log("[qto] postAnalyzeWalls failed", e);
      toast.error("Wall finder failed.");
    } finally {
      setWallFinderLoading(false);
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    wallFinderRoi,
    wallFinderBackend,
    confidence,
    scrollToObjectDataSection,
    refreshWallSegmentsFromServer,
  ]);

  const refreshRoomRowsFromServer = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    const path = selectedPdfPath.trim();
    const res = await getAnalyzeRoomsRooms({
      job_id: trimmedJobId,
      file_path: path,
    });
    const rows = pickRoomRowsFromResponse(res);
    setRoomFinderBackend((prev) => {
      if (!prev) return prev;
      const next: RoomFinderBackendState = {
        ...prev,
        response: res,
      };
      saveQtoRoomFinder(trimmedJobId, path, { v: 1, ...next });
      return next;
    });
    setRoomResults(rows);
  }, [trimmedJobId, selectedPdfPath]);

  const handleRoomRemove = useCallback(
    (itemId: string) => {
      if (!trimmedJobId || !selectedPdfPath?.trim() || roomFinderLoading) return;
      void Swal.fire({
        title: "Remove room?",
        text: "This room polygon will be removed from the list.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "hsl(var(--destructive))",
      }).then((result) => {
        if (!result.isConfirmed) return;
        void (async () => {
          setRoomFinderLoading(true);
          try {
            await postAnalyzeRoomsRemove({
              job_id: trimmedJobId,
              file_path: selectedPdfPath.trim(),
              item_id: itemId,
            });
            await refreshRoomRowsFromServer();
            toast.success("Room removed.");
          } catch (e) {
            console.log("[qto] postAnalyzeRoomsRemove failed", e);
            toast.error("Could not remove room.");
          } finally {
            setRoomFinderLoading(false);
          }
        })();
      });
    },
    [
      trimmedJobId,
      selectedPdfPath,
      roomFinderLoading,
      refreshRoomRowsFromServer,
    ]
  );

  const handleRoomFinderAnalyze = useCallback(async () => {
    if (!trimmedJobId || !selectedPdfPath?.trim()) return;
    if (!roomFinderRoi && !roomFinderBackend) return;

    const analyzedPage =
      roomFinderRoi?.pageNumber ?? roomFinderBackend!.pageNumber;
    const metrics = cadCanvasRef.current?.getAutoCountPageMetrics(
      analyzedPage
    );
    if (!metrics) {
      toast.error("Page layout not ready. Wait for the PDF to finish rendering.");
      return;
    }

    if (roomFinderBackend && roomFinderRoi) {
      if (roomFinderBackend.pageNumber !== roomFinderRoi.pageNumber) {
        toast.error("Draw on the same page as the current analysis.");
        return;
      }
      const r = roomFinderRoi.roi;
      if (r.width <= 0 || r.height <= 0) {
        toast.error("Selection is too small.");
        return;
      }
      const m = ROOM_FINDER_DEFAULT_PIXEL_TO_METER;
      const item = {
        polygon: [
          { x: r.x, y: r.y },
          { x: r.x + r.width, y: r.y },
          { x: r.x + r.width, y: r.y + r.height },
          { x: r.x, y: r.y + r.height },
        ] as const,
        center: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
        area_m2: r.width * r.height * m * m,
      };

      setRoomFinderLoading(true);
      try {
        await postAnalyzeRoomsAdd({
          job_id: trimmedJobId,
          file_path: selectedPdfPath.trim(),
          item: {
            polygon: [...item.polygon],
            center: item.center,
            area_m2: item.area_m2,
          },
        });
        await refreshRoomRowsFromServer();
        setRoomFinderRoi(null);
        setLastAnalyzeKind("roomFinder");
        toast.success("Room added.");
        setObjectDataFormVisible(true);
        scrollToObjectDataSection();
      } catch (e) {
        console.log("[qto] postAnalyzeRoomsAdd failed", e);
        toast.error("Could not add room.");
      } finally {
        setRoomFinderLoading(false);
      }
      return;
    }

    const roiBackend = roomFinderRoi
      ? roomFinderRoi.roi
      : roomFinderBackend!.roi;

    setRoomFinderLoading(true);
    try {
      const res = await postAnalyzeRooms({
        job_id: trimmedJobId,
        file_path: selectedPdfPath.trim(),
        roi: roiBackend,
        pixel_to_meter: ROOM_FINDER_DEFAULT_PIXEL_TO_METER,
        confidence,
      });
      const rows = pickRoomRowsFromResponse(res);
      setRoomResults(rows);
      const next: RoomFinderBackendState = {
        pageNumber: analyzedPage,
        roi: roiBackend,
        response: res,
      };
      setRoomFinderBackend(next);
      setRoomFinderRoi(null);
      setLastAnalyzeKind("roomFinder");
      saveQtoRoomFinder(trimmedJobId, selectedPdfPath.trim(), {
        v: 1,
        ...next,
      });
      const nw = res.total_rooms ?? rows.length ?? 0;
      toast.success(
        res.success === false
          ? "Room analysis completed with issues."
          : nw > 0
            ? `Found ${nw} room${nw === 1 ? "" : "s"}`
            : "No rooms found in region"
      );
      setMetadataObjectId("");
      setMetadataObjectName("");
      setMetadataErrors({});
      setSelectedSavedObjectId(null);
      setExpandedSavedId(null);
      setObjectDataFormVisible(true);
      scrollToObjectDataSection();
    } catch (e) {
      console.log("[qto] postAnalyzeRooms failed", e);
      toast.error("Room finder failed.");
    } finally {
      setRoomFinderLoading(false);
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    roomFinderRoi,
    roomFinderBackend,
    confidence,
    scrollToObjectDataSection,
    refreshRoomRowsFromServer,
  ]);

  const objectMetadataStatsMode: ObjectMetadataStatsMode =
    lastAnalyzeKind === "wallFinder"
      ? "wall"
      : lastAnalyzeKind === "roomFinder"
        ? "room"
        : lastAnalyzeKind === "floorArea"
          ? "floor"
          : lastAnalyzeKind === "facade"
            ? "facade"
            : "count";
  const totalWallLengthDisplay = useMemo(() => {
    const m = wallFinderBackend?.response?.total_length_m;
    if (m == null || !Number.isFinite(m)) return "—";
    return `${m.toFixed(2)} m`;
  }, [wallFinderBackend]);
  const totalWallsDisplay = useMemo(() => {
    if (!wallFinderBackend) return 0;
    const t = wallFinderBackend.response?.total_walls;
    if (t != null && Number.isFinite(t)) return t;
    return pickWallSegmentsFromResponse(wallFinderBackend.response).length;
  }, [wallFinderBackend]);
  const roomsFoundDisplay = useMemo(() => {
    if (lastAnalyzeKind !== "roomFinder") return 0;
    if (!roomFinderBackend) return 0;
    const t = roomFinderBackend.response?.total_rooms;
    if (t != null && Number.isFinite(t)) return t;
    return pickRoomRowsFromResponse(roomFinderBackend.response).length;
  }, [lastAnalyzeKind, roomFinderBackend]);
  const totalAreaM2Display = useMemo(() => {
    const m = roomFinderBackend?.response?.total_area_m2;
    if (m == null || !Number.isFinite(m)) return "—";
    return m.toFixed(2);
  }, [roomFinderBackend]);
  const floorAreaM2Display = useMemo(() => {
    if (lastFloorNewAreaM2 == null || !Number.isFinite(lastFloorNewAreaM2)) {
      return "—";
    }
    return lastFloorNewAreaM2.toFixed(2);
  }, [lastFloorNewAreaM2]);
  const facadeWindowCountDisplay = useMemo(() => {
    if (lastAnalyzeKind !== "facade") return 0;
    const r = facadeBackend?.response;
    return r?.window_count ?? r?.dimensions?.length ?? 0;
  }, [lastAnalyzeKind, facadeBackend]);
  const facadeNetWindowAreaM2Display = useMemo(() => {
    if (lastAnalyzeKind !== "facade") return "—";
    const w = facadeBackend?.response?.window_area;
    if (w == null || !Number.isFinite(w)) return "—";
    return w.toFixed(2);
  }, [lastAnalyzeKind, facadeBackend]);

  /**
   * Show the canvas chip whenever the panel is not open. Using `translateOpen` (not `drawerMounted`)
   * restores the chip immediately on outside click; `drawerMounted` can lag until transition end.
   */
  const showOpenTrigger = !translateOpen;
  const showToolbar = pdfPhase === "ready" && Boolean(pdfBlob);

  const analyzeBusy =
    autoCountLoading ||
    searchTextLoading ||
    doorFinderLoading ||
    facadeLoading ||
    wallFinderLoading ||
    roomFinderLoading ||
    floorExtractorLoading;

  /** Clear removes session analysis, ROIs, saved items, and search text — disable when there is nothing to remove. */
  const hasClearableQtoData = useMemo(
    () =>
      savedObjects.length > 0 ||
      autoCountRoi != null ||
      autoCountBackend != null ||
      doorFinderRoi != null ||
      doorFinderBackend != null ||
      facadeRoi != null ||
      facadeBackend != null ||
      wallFinderRoi != null ||
      wallFinderBackend != null ||
      roomFinderRoi != null ||
      roomFinderBackend != null ||
      floorExtractions.length > 0 ||
      floorPendingSeed != null ||
      searchTerm.trim().length > 0,
    [
      savedObjects.length,
      autoCountRoi,
      autoCountBackend,
      doorFinderRoi,
      doorFinderBackend,
      facadeRoi,
      facadeBackend,
      wallFinderRoi,
      wallFinderBackend,
      roomFinderRoi,
      roomFinderBackend,
      floorExtractions.length,
      floorPendingSeed,
      searchTerm,
    ]
  );

  const clearActionDisabled = analyzeBusy || !hasClearableQtoData;

  const primaryAnalyzeLabel = useMemo(() => {
    switch (lastToolAction) {
      case "autoCount":
        if (
          autoCountRoi &&
          autoCountBackend &&
          autoCountManualAddActive
        ) {
          return "Add match";
        }
        return "Analyze";
      case "doorFinder":
        if (doorFinderBackend && doorFinderRoi) return "Add door";
        return "Find Doors";
      case "facade":
        if (facadeBackend && facadeRoi) return "Add window";
        return "Analyze Facade";
      case "wallFinder":
        if (wallFinderBackend && wallFinderRoi) return "Add wall";
        return "Find Walls";
      case "roomFinder":
        if (roomFinderBackend && roomFinderRoi) return "Add room";
        return "Find Rooms";
      case "floorArea":
        return "Calculate Area";
      case "searchText":
        if (autoCountBackend && autoCountRoi) return "Add highlight";
        return "Search";
      default:
        return "Analyze";
    }
  }, [
    lastToolAction,
    autoCountRoi,
    autoCountBackend,
    autoCountManualAddActive,
    facadeBackend,
    facadeRoi,
    doorFinderBackend,
    doorFinderRoi,
    wallFinderBackend,
    wallFinderRoi,
    roomFinderBackend,
    roomFinderRoi,
  ]);

  const primaryAnalyzeLoading = useMemo(() => {
    switch (lastToolAction) {
      case "autoCount":
        return autoCountLoading;
      case "doorFinder":
        return doorFinderLoading;
      case "facade":
        return facadeLoading;
      case "wallFinder":
        return wallFinderLoading;
      case "roomFinder":
        return roomFinderLoading;
      case "floorArea":
        return floorExtractorLoading;
      case "searchText":
        return searchTextLoading || autoCountLoading;
      default:
        return false;
    }
  }, [
    lastToolAction,
    autoCountLoading,
    doorFinderLoading,
    facadeLoading,
    wallFinderLoading,
    roomFinderLoading,
    floorExtractorLoading,
    searchTextLoading,
  ]);

  const primaryAnalyzeDisabled = useMemo(() => {
    if (!trimmedJobId || !selectedPdfPath?.trim() || analyzeBusy) return true;
    switch (lastToolAction) {
      case "autoCount":
        if (autoCountManualAddActive && autoCountBackend) {
          return !autoCountRoi;
        }
        return !autoCountRoi && !autoCountBackend;
      case "doorFinder":
        return !doorFinderRoi && !doorFinderBackend;
      case "facade":
        return !facadeRoi && !facadeBackend;
      case "wallFinder":
        return !wallFinderRoi && !wallFinderBackend;
      case "roomFinder":
        return !roomFinderRoi && !roomFinderBackend;
      case "floorArea":
        return floorPendingSeed == null;
      case "searchText":
        if (autoCountBackend && autoCountRoi) return false;
        return !searchTerm.trim();
      default:
        return true;
    }
  }, [
    trimmedJobId,
    selectedPdfPath,
    analyzeBusy,
    lastToolAction,
    autoCountRoi,
    autoCountBackend,
    autoCountManualAddActive,
    doorFinderRoi,
    doorFinderBackend,
    facadeRoi,
    facadeBackend,
    wallFinderRoi,
    wallFinderBackend,
    roomFinderRoi,
    roomFinderBackend,
    floorPendingSeed,
    searchTerm,
  ]);

  const runPrimaryAnalyze = useCallback(() => {
    switch (lastToolAction) {
      case "autoCount":
        return void handleAutoCountAnalyze();
      case "doorFinder":
        return void handleDoorFinderAnalyze();
      case "facade":
        return void handleFacadeAnalyze();
      case "wallFinder":
        return void handleWallFinderAnalyze();
      case "roomFinder":
        return void handleRoomFinderAnalyze();
      case "floorArea":
        return void handleFloorExtract();
      case "searchText":
        if (autoCountBackend && autoCountRoi) {
          return void handleAutoCountAnalyze();
        }
        return void handleSearchTextSubmit();
      default:
        return;
    }
  }, [
    lastToolAction,
    handleAutoCountAnalyze,
    handleDoorFinderAnalyze,
    handleFacadeAnalyze,
    handleWallFinderAnalyze,
    handleRoomFinderAnalyze,
    handleFloorExtract,
    handleSearchTextSubmit,
    autoCountBackend,
    autoCountRoi,
  ]);

  return (
    <CadAnalyzerToolProvider>
      <BlockingStatusOverlay
        open={
          autoCountLoading ||
          searchTextLoading ||
          doorFinderLoading ||
          facadeLoading ||
          wallFinderLoading ||
          roomFinderLoading ||
          floorExtractorLoading
        }
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
              <QtoRightSidebarReopenChip
                showToolbar={showToolbar}
                autoCountSidebarMounted={autoCountSidebarMounted}
                lastToolAction={lastToolAction}
                openToolOptionsPanel={openToolOptionsPanel}
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
                    enableTextSearchAreaSelect={searchTextManualSelectActive}
                    doorFinderRoi={doorFinderRoi}
                    onDoorFinderRoiChange={handleDoorFinderRoiChange}
                    autoCountBackend={canvasAutoCountBackend}
                    doorFinderBackend={canvasDoorFinderBackend}
                    facadeRoi={facadeRoi}
                    onFacadeRoiChange={handleFacadeRoiChange}
                    facadeBackend={facadeBackend}
                    wallFinderRoi={wallFinderRoi}
                    onWallFinderRoiChange={handleWallFinderRoiChange}
                    wallFinderBackend={canvasWallFinderBackend}
                    roomFinderRoi={roomFinderRoi}
                    onRoomFinderRoiChange={handleRoomFinderRoiChange}
                    roomFinderBackend={canvasRoomFinderBackend}
                    roomFinderPixelToMeter={ROOM_FINDER_DEFAULT_PIXEL_TO_METER}
                    emphasizeAutoCountHighlight={emphasizeSavedHighlight}
                    persistedSavedOverlays={persistedSavedOverlaysForCanvas}
                    floorAreaSeeds={floorAreaCanvasSeeds}
                    floorAreaRegions={floorAreaCanvasRegions}
                    onFloorAreaClick={handleFloorAreaPlaceSeed}
                    onAutoCountRemoveMatch={
                      emphasizeSavedHighlight
                        ? undefined
                        : handleAutoCountRemoveMatch
                    }
                    onFacadeRemoveWindow={
                      emphasizeSavedHighlight
                        ? undefined
                        : handleFacadeRemoveWindow
                    }
                    onDoorRemoveMatch={
                      emphasizeSavedHighlight
                        ? undefined
                        : handleDoorRemoveMatch
                    }
                    onWallRemoveSegment={
                      emphasizeSavedHighlight
                        ? undefined
                        : handleWallRemoveSegment
                    }
                    wallLineAddEnabled={
                      !emphasizeSavedHighlight && Boolean(wallFinderBackend)
                    }
                    onWallSegmentLineCommit={
                      emphasizeSavedHighlight
                        ? undefined
                        : handleWallSegmentLineCommit
                    }
                    onRoomRemove={
                      emphasizeSavedHighlight
                        ? undefined
                        : handleRoomRemove
                    }
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
                  searchTextAreaSelectionActive={searchTextManualSelectActive}
                  searchTextAreaSelectionDisabled={
                    lastAnalyzeKind !== "searchText" || !autoCountBackend
                  }
                  onSearchTextAreaSelectionToggle={handleSearchTextManualSelectToggle}
                  autoCountManualAddActive={autoCountManualAddActive}
                  autoCountManualAddDisabled={
                    lastAnalyzeKind !== "autoCount" || !autoCountBackend
                  }
                  onAutoCountManualAddToggle={handleAutoCountManualAddToggle}
                  onAutoCountToolSelect={handleAutoCountToolSelect}
                  onDoorFinderToolSelect={handleDoorFinderToolSelect}
                  onWallFinderToolSelect={handleWallFinderToolSelect}
                  onRoomFinderToolSelect={handleRoomFinderToolSelect}
                  onFloorAreaToolSelect={handleFloorAreaToolSelect}
                  onFacadeToolSelect={handleFacadeToolSelect}
                />
              </div>
            ) : null}
            {canvasDrawer}
            {autoCountSidebarMounted ? (
              <>
                <button
                  type="button"
                  aria-label="Close quantity take-off options"
                  className={cn(
                    "absolute inset-0 z-40 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                    "bg-foreground/[0.04] max-md:bg-foreground/[0.06]",
                    isAutoCountOpen
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  )}
                  onClick={closeAutoCountPanel}
                />
                <UnifiedQtoRightSidebar
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
                  searchTextLoading={searchTextLoading}
                  searchTextError={searchTextError}
                  onTransitionEnd={handleAutoCountAsideTransitionEnd}
                  objectDataSectionRef={objectDataSectionRef}
                  primaryAnalyzeLabel={primaryAnalyzeLabel}
                  onPrimaryAnalyze={runPrimaryAnalyze}
                  primaryAnalyzeDisabled={primaryAnalyzeDisabled}
                  primaryAnalyzeLoading={primaryAnalyzeLoading}
                  onClear={clearAutoCount}
                  clearDisabled={clearActionDisabled}
                  showObjectDataForm={objectDataFormVisible}
                  objectMetadata={{
                    objectId: metadataObjectId,
                    objectName: metadataObjectName,
                    countDisplay: metadataCount,
                    statsMode: objectMetadataStatsMode,
                    totalWallLengthDisplay,
                    totalWallsDisplay,
                    roomsFoundDisplay,
                    totalAreaM2Display,
                    floorAreaM2Display,
                    facadeWindowCountDisplay,
                    facadeNetWindowAreaM2Display,
                    onObjectIdChange: (v) => {
                      setMetadataObjectId(v);
                      if (metadataErrors.objectId) {
                        setMetadataErrors((prev) => ({
                          ...prev,
                          objectId: undefined,
                        }));
                      }
                    },
                    onObjectNameChange: (v) => {
                      setMetadataObjectName(v);
                      if (metadataErrors.objectName) {
                        setMetadataErrors((prev) => ({
                          ...prev,
                          objectName: undefined,
                        }));
                      }
                    },
                    errors: metadataErrors,
                    onSave: handleSaveObjectMetadata,
                    saveDisabled:
                      !hasObjectMetadataSource || analyzeBusy,
                    savedObjects,
                    selectedSavedId: selectedSavedObjectId,
                    onSelectSaved: (id) => {
                      setSelectedSavedObjectId((prev) =>
                        prev === id ? null : id
                      );
                    },
                    expandedSavedId,
                    onToggleExpand: (id) =>
                      setExpandedSavedId((prev) =>
                        prev === id ? null : id
                      ),
                    onExportAllJson: handleExportSavedObjectsJson,
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </CadAnalyzerToolProvider>
  );
}
