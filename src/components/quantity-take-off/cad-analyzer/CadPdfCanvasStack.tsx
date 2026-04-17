"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";
import {
  BACKEND_PDF_VIEWPORT_SCALE,
  backendMatchesToScreen,
  backendPointToScreenCss,
  backendRoiToScreenCss,
  facadeDimensionsToScreenBoxes,
  floorPolygonBackendToScreenCss,
  resolveFloorPolygonToPreviewBackend,
  roomFinderResponseToScreenPolygons,
  wallFinderResponseToScreenDrawItems,
  type AutoCountPageMetrics,
  type QtoCommittedRoi,
  type RoomPolygonScreen,
  type WallSegmentScreen,
} from "@/lib/autoCountCoordinates";
import type { AutoCountBackendState } from "@/lib/qtoAutoCountStorage";
import type { FacadeBackendState } from "@/lib/qtoFacadeStorage";
import type { FloorExtractionPersistedV1 } from "@/lib/qtoFloorExtractorStorage";
import {
  isFloorCanvasSnapshot,
  isMatchCanvasSnapshot,
  isRoomCanvasSnapshot,
  isWallCanvasSnapshot,
  type FacadeSavedSnapshotV1,
  type QtoSavedObjectEntryV1,
} from "@/lib/qtoSavedObjectsStorage";
import type { RoomFinderBackendState } from "@/lib/qtoRoomFinderStorage";
import { ROOM_FINDER_DEFAULT_PIXEL_TO_METER } from "@/services/roomFinderService";
import type { WallFinderBackendState } from "@/lib/qtoWallFinderStorage";
import type { AutoCountMatch } from "@/services/autoCountService";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

/** Avoid GPU/memory blowups on extreme zoom. */
const MAX_CANVAS_EDGE_PX = 8192;
const MAX_BASE_FIT = 4;

/** Top-right remove affordance — must match `drawMatchBoxes` autoCount branch. */
function hitTestAutoCountRemoveCorner(
  localX: number,
  localY: number,
  boxes: AutoCountMatch[]
): number | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const m = boxes[i]!;
    const mx = m.x;
    const my = m.y;
    const mw = m.w;
    const mh = m.h;
    if (mw <= 0 || mh <= 0) continue;
    const side = Math.max(
      14,
      Math.min(20, Math.min(mw, mh) * 0.35, mw * 0.45)
    );
    const pad = Math.min(3, mw * 0.04);
    const cx = mx + mw - pad - side / 2;
    const cy = my + pad + side / 2;
    const r = side / 2 + 2;
    const dx = localX - cx;
    const dy = localY - cy;
    if (dx * dx + dy * dy <= r * r) return i;
  }
  return null;
}

/** Backend may send page as string (persisted JSON); compare numerically. */
function backendPageMatches(
  backendPage: number | string | undefined,
  pageNumber: number
): boolean {
  const n = Number(backendPage);
  return Number.isFinite(n) && n === pageNumber;
}

export type AutoCountRoiCss = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type { QtoCommittedRoi };

type CssRect = { x: number; y: number; width: number; height: number };

type PageAnnotationLayer = {
  /** Auto Count ROI (blue) */
  committedRoiAuto: CssRect | null;
  /** Door Finder ROI (emerald) */
  committedRoiDoor: CssRect | null;
  /** Facade ROI (green ring) */
  committedRoiFacade: CssRect | null;
  /** Wall Finder ROI (amber ring) */
  committedRoiWall: CssRect | null;
  draftRoi: CssRect | null;
  matchesAuto: AutoCountMatch[];
  /** Door Finder — teal boxes */
  matchesDoor: AutoCountMatch[];
  /** Facade — numbered green window boxes */
  facadeWindows: { box: AutoCountMatch; id: number }[];
  /** Wall Finder — segments with measurement labels (purple lines / red markers; not match boxes) */
  wallSegments: WallSegmentScreen[];
  /** Room Finder — dashed ROI (blue) */
  committedRoiRoom: CssRect | null;
  /** Room Finder — filled polygons + area labels (per-room colors) */
  roomPolygons: RoomPolygonScreen[];
  /** Floor area — pending click markers (CSS px) */
  floorSeeds: { x: number; y: number }[];
  /** Floor area — extracted regions (CSS px polygon + seed + area) */
  floorRegions: FloorAreaCssRegion[];
  /** Stronger strokes when a saved object is selected in the metadata panel */
  emphasize?: boolean;
  /** Draw remove affordance on auto count boxes (hit-test uses same corner). */
  autoCountShowRemoveCorners?: boolean;
  /** Only the first N entries in `matchesAuto` are server matches (rest may be saved snapshots). */
  autoCountRemoveMarkerCount?: number;
};

/** One floor extraction overlay — prefer backend fields; CSS is legacy / fallback. */
export type FloorAreaCssRegion = {
  id: string;
  cssPoly: { x: number; y: number }[];
  areaM2: number;
  seedCss: { x: number; y: number };
  /** Normalized API vertices before analysis/preview resolution (preferred). */
  polygonRaw?: { x: number; y: number }[];
  polygonPreviewBackend?: { x: number; y: number }[];
  seedBackend?: { x: number; y: number };
};

function floorExtractionToOverlayRegion(
  ex: FloorExtractionPersistedV1,
  metrics: AutoCountPageMetrics | null
): FloorAreaCssRegion {
  const rest: FloorAreaCssRegion = {
    id: ex.id,
    cssPoly: ex.cssPoly,
    areaM2: ex.areaM2,
    seedCss: ex.seedCss,
    polygonRaw: ex.polygonRaw,
    polygonPreviewBackend: ex.polygonPreviewBackend,
    seedBackend: ex.seedBackend,
  };
  if (!metrics || !ex.seedBackend) {
    return rest;
  }
  if (ex.polygonRaw && ex.polygonRaw.length >= 3) {
    const previewRing = resolveFloorPolygonToPreviewBackend(
      ex.polygonRaw,
      ex.seedBackend
    );
    return {
      ...rest,
      cssPoly: floorPolygonBackendToScreenCss(previewRing, metrics),
      seedCss: backendPointToScreenCss(ex.seedBackend, metrics),
    };
  }
  if (ex.polygonPreviewBackend && ex.polygonPreviewBackend.length >= 3) {
    return {
      ...rest,
      cssPoly: floorPolygonBackendToScreenCss(
        ex.polygonPreviewBackend,
        metrics
      ),
      seedCss: backendPointToScreenCss(ex.seedBackend, metrics),
    };
  }
  return {
    ...rest,
    seedCss: backendPointToScreenCss(ex.seedBackend, metrics),
  };
}

function drawMatchBoxes(
  octx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  matches: AutoCountMatch[],
  opts: {
    emphasize: boolean;
    variant: "autoCount" | "doorFinder";
    showRemoveCorners?: boolean;
    /** Draw remove icon only on matchesAuto[0..count-1] when server+saved merged. */
    removeMarkerMax?: number;
  }
) {
  const emph = opts.emphasize;
  const fill =
    opts.variant === "doorFinder"
      ? emph
        ? "rgba(13, 148, 136, 0.35)"
        : "rgba(20, 184, 166, 0.24)"
      : emph
        ? "rgba(217, 119, 6, 0.28)"
        : "rgba(124, 58, 237, 0.22)";
  const stroke =
    opts.variant === "doorFinder"
      ? emph
        ? "#0f766e"
        : "#0d9488"
      : emph
        ? "#b45309"
        : "#6d28d9";

  for (let mi = 0; mi < matches.length; mi++) {
    const m = matches[mi]!;
    octx.setLineDash([]);
    const mx = m.x * sx;
    const my = m.y * sy;
    const mw = m.w * sx;
    const mh = m.h * sy;
    if (
      !Number.isFinite(mx) ||
      !Number.isFinite(my) ||
      !Number.isFinite(mw) ||
      !Number.isFinite(mh) ||
      mw <= 0 ||
      mh <= 0
    ) {
      continue;
    }
    octx.fillStyle = fill;
    octx.fillRect(mx, my, mw, mh);
    octx.strokeStyle = stroke;
    octx.lineWidth = emph
      ? Math.max(2, 2.5 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.strokeRect(mx, my, mw, mh);

    const allowRemove =
      opts.variant === "autoCount" &&
      opts.showRemoveCorners &&
      (opts.removeMarkerMax == null || mi < opts.removeMarkerMax);
    if (allowRemove) {
      const dpr = window.devicePixelRatio || 1;
      const side = Math.max(
        14,
        Math.min(20, Math.min(mw, mh) * 0.35, mw * 0.45)
      );
      const pad = Math.min(3, mw * 0.04);
      const cx = mx + mw - pad - side / 2;
      const cy = my + pad + side / 2;
      octx.beginPath();
      octx.arc(cx, cy, side / 2 + 1, 0, Math.PI * 2);
      octx.fillStyle = "rgba(255, 255, 255, 0.92)";
      octx.fill();
      octx.strokeStyle = "rgba(220, 38, 38, 0.95)";
      octx.lineWidth = Math.max(1.5, 1.8 / dpr);
      octx.stroke();
      const arm = side * 0.22;
      octx.strokeStyle = "#b91c1c";
      octx.lineWidth = Math.max(1.5, 1.75 / dpr);
      octx.beginPath();
      octx.moveTo(cx - arm, cy - arm);
      octx.lineTo(cx + arm, cy + arm);
      octx.moveTo(cx + arm, cy - arm);
      octx.lineTo(cx - arm, cy + arm);
      octx.stroke();
    }
  }
}

/** Facade `/analyze_facade` — green fills, dark green strokes, centered id labels. */
function drawFacadeWindowBoxes(
  octx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  items: { box: AutoCountMatch; id: number }[],
  emphasize: boolean
) {
  const dpr = window.devicePixelRatio || 1;
  const fill = emphasize
    ? "rgba(22, 163, 74, 0.42)"
    : "rgba(34, 197, 94, 0.32)";
  const stroke = emphasize ? "#15803d" : "#16a34a";
  const fontPx = Math.max(11, Math.min(22, 14 * Math.min(sx, sy)));

  for (const { box: m, id } of items) {
    const mx = m.x * sx;
    const my = m.y * sy;
    const mw = m.w * sx;
    const mh = m.h * sy;
    if (
      !Number.isFinite(mx) ||
      !Number.isFinite(my) ||
      !Number.isFinite(mw) ||
      !Number.isFinite(mh) ||
      mw <= 0 ||
      mh <= 0
    ) {
      continue;
    }
    octx.fillStyle = fill;
    octx.fillRect(mx, my, mw, mh);
    octx.strokeStyle = stroke;
    octx.lineWidth = emphasize
      ? Math.max(2, 2.5 / dpr)
      : Math.max(1.5, 2 / dpr);
    octx.setLineDash([]);
    octx.strokeRect(mx, my, mw, mh);

    const label = String(id);
    octx.font = `bold ${fontPx}px Arial, ui-sans-serif, sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    const cx = mx + mw / 2;
    const cy = my + mh / 2;
    const tw = octx.measureText(label).width;
    octx.fillStyle = "rgba(255, 255, 255, 0.92)";
    octx.fillRect(
      cx - tw / 2 - 4 * sx,
      cy - fontPx * 0.55,
      tw + 8 * sx,
      fontPx * 1.1
    );
    octx.fillStyle = "#14532d";
    octx.fillText(label, cx, cy);
  }
}

/** Wall Finder visualization (aligned with `Quantitites_Project/static/script.js` `drawOverlay` wall branch). */
function drawWallFinderSegments(
  octx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  segments: WallSegmentScreen[],
  emphasize: boolean
) {
  if (segments.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const lineW = emphasize
    ? Math.max(3, 5 / dpr)
    : Math.max(2.5, 4 / dpr);
  const dotR = Math.max(3, 4 / dpr);
  const fontSize = Math.max(11, Math.min(20, 14 * sx));

  for (const seg of segments) {
    const x1 = seg.x1 * sx;
    const y1 = seg.y1 * sy;
    const x2 = seg.x2 * sx;
    const y2 = seg.y2 * sy;
    if (
      !Number.isFinite(x1) ||
      !Number.isFinite(y1) ||
      !Number.isFinite(x2) ||
      !Number.isFinite(y2)
    ) {
      continue;
    }

    octx.beginPath();
    octx.moveTo(x1, y1);
    octx.lineTo(x2, y2);
    octx.strokeStyle = emphasize
      ? "rgba(91, 33, 182, 0.95)"
      : "rgba(128, 0, 128, 0.85)";
    octx.lineWidth = lineW;
    octx.lineCap = "round";
    octx.lineJoin = "round";
    octx.setLineDash([]);
    octx.stroke();

    octx.beginPath();
    octx.arc(x1, y1, dotR, 0, Math.PI * 2);
    octx.fillStyle = "#ef4444";
    octx.fill();
    octx.beginPath();
    octx.arc(x2, y2, dotR, 0, Math.PI * 2);
    octx.fillStyle = "#ef4444";
    octx.fill();

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const vertical = Math.abs(dy) >= Math.abs(dx) * 1.1;

    const text =
      seg.lengthM > 0 && Number.isFinite(seg.lengthM)
        ? `${seg.lengthM.toFixed(2)}m`
        : "—";
    octx.font = `bold ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    const tw = octx.measureText(text).width;
    const pad = 4 * sx;
    const boxW = tw + pad * 2;
    const boxH = fontSize + 8;

    octx.save();
    octx.translate(midX, midY);
    if (vertical) {
      octx.rotate(-Math.PI / 2);
    }
    octx.fillStyle = "rgba(255, 255, 255, 0.92)";
    octx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    octx.fillStyle = "#ef4444";
    octx.fillText(text, 0, 0);
    octx.restore();
  }
}

/**
 * One distinct color per room list index. The reference script uses `idx % 5`, which makes
 * rooms 0 and 5 (and 1 and 6, …) share the same blue — we spread hue by the golden angle instead.
 */
function roomFinderColorForIndex(idx: number): {
  fill: string;
  stroke: string;
  text: string;
} {
  const goldenDeg = 137.508;
  const hue = (idx * goldenDeg + 14) % 360;
  return {
    fill: `hsla(${hue}, 66%, 52%, 0.32)`,
    stroke: `hsla(${hue}, 74%, 36%, 0.9)`,
    text: `hsl(${hue}, 70%, 22%)`,
  };
}

function drawRoomFinderPolygons(
  octx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  polys: RoomPolygonScreen[],
  emphasize: boolean
) {
  if (polys.length === 0) return;
  const s = Math.min(sx, sy);
  const lineWRef = 2 * s;
  const lineW = emphasize ? Math.max(lineWRef, 2.5 * s) : lineWRef;
  const fontPx = Math.max(11, Math.min(20, Math.round(13 * s)));

  for (let idx = 0; idx < polys.length; idx++) {
    const poly = polys[idx]!;
    const clr = roomFinderColorForIndex(idx);
    const pts = poly.cssPoly;
    if (pts.length < 3) continue;

    octx.beginPath();
    octx.moveTo(pts[0]!.x * sx, pts[0]!.y * sy);
    for (let i = 1; i < pts.length; i++) {
      octx.lineTo(pts[i]!.x * sx, pts[i]!.y * sy);
    }
    octx.closePath();
    octx.fillStyle = clr.fill;
    octx.fill();
    octx.strokeStyle = clr.stroke;
    octx.lineWidth = lineW;
    octx.setLineDash([]);
    octx.stroke();

    const a = poly.areaM2;
    const text =
      Number.isFinite(a) && a > 0 ? `${a.toFixed(1)}m²` : "—";
    octx.font = `bold ${fontPx}px Arial, "Helvetica Neue", Helvetica, ui-sans-serif, sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "alphabetic";
    const lx = poly.centerX * sx;
    const ly = poly.centerY * sy;
    const tw = octx.measureText(text).width;
    octx.fillStyle = "rgba(255, 255, 255, 0.85)";
    octx.fillRect(lx - tw / 2 - 4 * s, ly - 12 * s, tw + 8 * s, 16 * s);
    octx.fillStyle = clr.text;
    octx.fillText(text, lx, ly);
  }
}

/** `/extract_floor` — green fill + red seed crosses (reference `drawOverlay` floor seed). */
function drawFloorAreaOverlay(
  octx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  seeds: { x: number; y: number }[],
  regions: FloorAreaCssRegion[],
  emphasize: boolean
) {
  const s = Math.min(sx, sy);
  const fillG = "rgba(34, 197, 94, 0.28)";
  const strokeG = "rgba(22, 163, 74, 0.92)";
  const lineW = emphasize ? Math.max(2.5 * s, 2) : 2 * s;

  for (const region of regions) {
    const pts = region.cssPoly;
    const label = `${region.areaM2.toFixed(1)}m²`;
    const sc = region.seedCss;
    if (pts.length >= 3) {
      octx.beginPath();
      octx.moveTo(pts[0]!.x * sx, pts[0]!.y * sy);
      for (let i = 1; i < pts.length; i++) {
        octx.lineTo(pts[i]!.x * sx, pts[i]!.y * sy);
      }
      octx.closePath();
      octx.fillStyle = fillG;
      octx.fill();
      octx.strokeStyle = strokeG;
      octx.lineWidth = lineW;
      octx.setLineDash([]);
      octx.stroke();
    } else {
      const r = 22 * s;
      octx.beginPath();
      octx.arc(sc.x * sx, sc.y * sy, r, 0, Math.PI * 2);
      octx.fillStyle = fillG;
      octx.fill();
      octx.strokeStyle = strokeG;
      octx.lineWidth = lineW;
      octx.stroke();
    }
    const lx = sc.x * sx;
    const ly = sc.y * sy;
    octx.font = `bold ${Math.max(11, Math.round(13 * s))}px Arial, ui-sans-serif, sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    const tw = octx.measureText(label).width;
    octx.fillStyle = "rgba(255, 255, 255, 0.88)";
    octx.fillRect(lx - tw / 2 - 4 * s, ly - 10 * s, tw + 8 * s, 18 * s);
    octx.fillStyle = "#14532d";
    octx.fillText(label, lx, ly);
  }

  octx.strokeStyle = "#ef4444";
  octx.lineWidth = Math.max(2, 2 * s);
  octx.setLineDash([]);
  const arm = 14 * s;
  for (const seed of seeds) {
    const cx = seed.x * sx;
    const cy = seed.y * sy;
    octx.beginPath();
    octx.moveTo(cx - arm, cy);
    octx.lineTo(cx + arm, cy);
    octx.moveTo(cx, cy - arm);
    octx.lineTo(cx, cy + arm);
    octx.stroke();
  }
}

function drawPageAnnotations(
  octx: CanvasRenderingContext2D,
  bufW: number,
  bufH: number,
  cssW: number,
  cssH: number,
  layer: PageAnnotationLayer
) {
  const emph = layer.emphasize === true;
  const sx = bufW / Math.max(cssW, 1);
  const sy = bufH / Math.max(cssH, 1);
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = 1;
  octx.globalCompositeOperation = "source-over";
  octx.clearRect(0, 0, bufW, bufH);
  octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));

  if (layer.committedRoiAuto) {
    const r = layer.committedRoiAuto;
    octx.strokeStyle = emph ? "#d97706" : "#2563eb";
    octx.lineWidth = emph
      ? Math.max(2.5, 3 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.setLineDash([]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));
  }
  if (layer.committedRoiDoor) {
    const r = layer.committedRoiDoor;
    octx.strokeStyle = emph ? "#0f766e" : "#059669";
    octx.lineWidth = emph
      ? Math.max(2.5, 3 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.setLineDash([]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));
  }
  if (layer.committedRoiFacade) {
    const r = layer.committedRoiFacade;
    octx.strokeStyle = emph ? "#15803d" : "#22c55e";
    octx.lineWidth = emph
      ? Math.max(2.5, 3 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.setLineDash([4, 3]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.setLineDash([]);
    octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));
  }
  if (layer.committedRoiWall) {
    const r = layer.committedRoiWall;
    octx.strokeStyle = emph ? "#1d4ed8" : "#2563eb";
    octx.lineWidth = emph
      ? Math.max(2.5, 3 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.setLineDash([8, 4]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.setLineDash([]);
    octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));
  }
  if (layer.committedRoiRoom) {
    const r = layer.committedRoiRoom;
    octx.strokeStyle = emph ? "#1d4ed8" : "#2563eb";
    octx.lineWidth = emph
      ? Math.max(2.5, 3 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.setLineDash([6, 4]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.setLineDash([]);
    octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));
  }
  if (layer.draftRoi) {
    const r = layer.draftRoi;
    octx.strokeStyle = "#60a5fa";
    octx.setLineDash([6, 4]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.setLineDash([]);
  }
  drawMatchBoxes(octx, sx, sy, layer.matchesAuto, {
    emphasize: emph,
    variant: "autoCount",
    showRemoveCorners: layer.autoCountShowRemoveCorners === true,
    removeMarkerMax: layer.autoCountRemoveMarkerCount,
  });
  drawMatchBoxes(octx, sx, sy, layer.matchesDoor, {
    emphasize: emph,
    variant: "doorFinder",
  });
  drawFacadeWindowBoxes(octx, sx, sy, layer.facadeWindows, emph);
  drawWallFinderSegments(octx, sx, sy, layer.wallSegments, emph);
  drawFloorAreaOverlay(
    octx,
    sx,
    sy,
    layer.floorSeeds,
    layer.floorRegions,
    emph
  );
  drawRoomFinderPolygons(octx, sx, sy, layer.roomPolygons, emph);
}

type PdfPageRowProps = {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  maxWidth: number;
  zoomScale: number;
  pageWrapperRef: (el: HTMLDivElement | null) => void;
  autoCountLayer: PageAnnotationLayer;
  onPageMetrics?: (
    pageNumber: number,
    metrics: AutoCountPageMetrics | null
  ) => void;
};

/**
 * Single page: PDF raster on bottom canvas, transparent overlay on top (matches `abc.html` canvas-stack).
 */
function PdfPageRow({
  pdfDoc,
  pageNumber,
  maxWidth,
  zoomScale,
  pageWrapperRef,
  autoCountLayer,
  onPageMetrics,
}: PdfPageRowProps) {
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef(autoCountLayer);
  layerRef.current = autoCountLayer;

  useEffect(() => {
    if (maxWidth <= 0) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let page: PDFPageProxy | null = null;

    void (async () => {
      try {
        page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !page) return;

        const backendVp = page.getViewport({ scale: BACKEND_PDF_VIEWPORT_SCALE });

        const base = page.getViewport({ scale: 1 });
        const fitToWidth = Math.min(maxWidth / base.width, MAX_BASE_FIT);
        let effectiveScale = fitToWidth * zoomScale;

        const outputScale = window.devicePixelRatio || 1;

        const canvas = pdfRef.current;
        const overlay = overlayRef.current;
        if (!canvas || !overlay) return;

        const clampViewport = (scale: number) => page!.getViewport({ scale });

        let viewport = clampViewport(effectiveScale);
        let w = Math.floor(viewport.width * outputScale);
        let h = Math.floor(viewport.height * outputScale);
        if (w > MAX_CANVAS_EDGE_PX || h > MAX_CANVAS_EDGE_PX) {
          const factor = Math.min(
            MAX_CANVAS_EDGE_PX / Math.max(w, 1),
            MAX_CANVAS_EDGE_PX / Math.max(h, 1)
          );
          effectiveScale *= factor;
          viewport = clampViewport(effectiveScale);
          w = Math.floor(viewport.width * outputScale);
          h = Math.floor(viewport.height * outputScale);
        }

        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        overlay.width = w;
        overlay.height = h;
        overlay.style.width = canvas.style.width;
        overlay.style.height = canvas.style.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const transform: [number, number, number, number, number, number] = [
          outputScale,
          0,
          0,
          outputScale,
          0,
          0,
        ];

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          ...(outputScale !== 1 ? { transform } : {}),
        });
        await renderTask.promise;
        if (cancelled) return;

        const cssW = Math.floor(viewport.width);
        const cssH = Math.floor(viewport.height);
        onPageMetrics?.(pageNumber, {
          backendBaseWidth: backendVp.width,
          backendBaseHeight: backendVp.height,
          cssWidth: cssW,
          cssHeight: cssH,
        });

        const octx = overlay.getContext("2d");
        if (octx) {
          drawPageAnnotations(
            octx,
            w,
            h,
            viewport.width,
            viewport.height,
            layerRef.current
          );
        }
      } catch {
        /* cancelled render or destroyed doc */
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* ignore */
      }
      page?.cleanup();
    };
  }, [pdfDoc, pageNumber, maxWidth, zoomScale, onPageMetrics]);

  /**
   * Redraw annotations when ROI/matches change without full PDF re-render.
   * Retries with rAF until bitmap canvases are sized (avoids racing the async PDF render).
   */
  useLayoutEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 240;

    const tick = () => {
      if (cancelled) return;
      const overlay = overlayRef.current;
      const canvas = pdfRef.current;
      if (
        !overlay ||
        !canvas ||
        canvas.width === 0 ||
        canvas.height === 0 ||
        overlay.width === 0
      ) {
        if (attempts++ < maxAttempts) {
          rafId = requestAnimationFrame(tick);
        }
        return;
      }
      const octx = overlay.getContext("2d");
      if (!octx) return;
      const cssW = parseFloat(canvas.style.width) || 1;
      const cssH = parseFloat(canvas.style.height) || 1;
      drawPageAnnotations(
        octx,
        overlay.width,
        overlay.height,
        cssW,
        cssH,
        autoCountLayer
      );
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [autoCountLayer, zoomScale, maxWidth]);

  return (
    <div
      ref={pageWrapperRef}
      data-pdf-page={pageNumber}
      className="relative mx-auto block w-max max-w-full"
    >
      <canvas
        ref={pdfRef}
        className="relative z-0 block bg-white shadow-sm"
      />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute left-0 top-0 z-[2] block [transform:translateZ(0)]"
        aria-hidden
      />
    </div>
  );
}

type TransformState = {
  scale: number;
  pointX: number;
  pointY: number;
};

export type CadPdfCanvasStackProps = {
  pdfBlob: Blob;
  className?: string;
  /** Committed ROI in backend preview space (stable under zoom/resize). Drag callbacks still emit CSS. */
  autoCountRoi?: QtoCommittedRoi | null;
  onAutoCountRoiChange?: (roi: AutoCountRoiCss | null) => void;
  doorFinderRoi?: QtoCommittedRoi | null;
  onDoorFinderRoiChange?: (roi: AutoCountRoiCss | null) => void;
  /** Last analyze in backend space; overlay reprojects to CSS when layout/zoom changes */
  autoCountBackend?: AutoCountBackendState | null;
  doorFinderBackend?: AutoCountBackendState | null;
  facadeRoi?: QtoCommittedRoi | null;
  onFacadeRoiChange?: (roi: AutoCountRoiCss | null) => void;
  facadeBackend?: FacadeBackendState | null;
  wallFinderRoi?: QtoCommittedRoi | null;
  onWallFinderRoiChange?: (roi: AutoCountRoiCss | null) => void;
  wallFinderBackend?: WallFinderBackendState | null;
  roomFinderRoi?: QtoCommittedRoi | null;
  onRoomFinderRoiChange?: (roi: AutoCountRoiCss | null) => void;
  roomFinderBackend?: RoomFinderBackendState | null;
  /** Same value as `/analyze_rooms` `pixel_to_meter` (area fallback / label consistency). */
  roomFinderPixelToMeter?: number;
  /** Thicker amber emphasis when a saved object is selected (metadata panel) */
  emphasizeAutoCountHighlight?: boolean;
  /** Persisted saved analyses — merged into the overlay so they stay visible across tools */
  persistedSavedOverlays?: QtoSavedObjectEntryV1[];
  /** Floor area — seed points in backend preview space (stable under zoom). */
  floorAreaSeeds?: Array<{
    pageNumber: number;
    seedBackend: { x: number; y: number };
  }>;
  floorAreaRegions?: Array<FloorAreaCssRegion & { pageNumber: number }>;
  onFloorAreaClick?: (pageNumber: number, xCss: number, yCss: number) => void;
  /** Server-side match index; only when live auto count (not saved-object snapshot). */
  onAutoCountRemoveMatch?: (matchIndex: number) => void;
};

export type CadPdfCanvasStackHandle = {
  getAutoCountPageMetrics: (
    pageNumber: number
  ) => AutoCountPageMetrics | null;
};

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;

function normalizeRect(ax: number, ay: number, bx: number, by: number): CssRect {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  return {
    x,
    y,
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

/**
 * Pan & zoom: zoom is baked into pdf.js render resolution (sharp). Wrapper uses translate only.
 */
export const CadPdfCanvasStack = forwardRef<
  CadPdfCanvasStackHandle,
  CadPdfCanvasStackProps
>(function CadPdfCanvasStack(
  {
    pdfBlob,
    className,
    autoCountRoi = null,
    onAutoCountRoiChange,
    doorFinderRoi = null,
    onDoorFinderRoiChange,
    autoCountBackend = null,
    doorFinderBackend = null,
    facadeRoi = null,
    onFacadeRoiChange,
    facadeBackend = null,
    wallFinderRoi = null,
    onWallFinderRoiChange,
    wallFinderBackend = null,
    roomFinderRoi = null,
    onRoomFinderRoiChange,
    roomFinderBackend = null,
    roomFinderPixelToMeter = ROOM_FINDER_DEFAULT_PIXEL_TO_METER,
    emphasizeAutoCountHighlight = false,
    persistedSavedOverlays = [],
    floorAreaSeeds = [],
    floorAreaRegions = [],
    onFloorAreaClick,
    onAutoCountRemoveMatch,
  },
  ref
) {
  const { tool } = useCadAnalyzerTool();
  const pageMetricsRef = useRef<Map<number, AutoCountPageMetrics>>(new Map());
  /** Bumps when any page reports metrics so layerForPage re-reads refs after zoom/resize. */
  const [metricsTick, setMetricsTick] = useState(0);

  const handlePageMetrics = useCallback(
    (pageNumber: number, metrics: AutoCountPageMetrics | null) => {
      const m = pageMetricsRef.current;
      if (metrics) m.set(pageNumber, metrics);
      else m.delete(pageNumber);
      setMetricsTick((t) => t + 1);
    },
    []
  );

  useImperativeHandle(
    ref,
    () => ({
      getAutoCountPageMetrics: (pageNumber: number) =>
        pageMetricsRef.current.get(pageNumber) ?? null,
    }),
    []
  );
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const zoomContentRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    pointX: 0,
    pointY: 0,
  });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const initialFitRef = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const panStartRef = useRef({ startX: 0, startY: 0 });

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const setPageRef = useCallback((index: number, el: HTMLDivElement | null) => {
    pageRefs.current[index] = el;
  }, []);

  /** ROI drag in page-local CSS px */
  const [draftRoi, setDraftRoi] = useState<{
    pageIndex: number;
    rect: CssRect;
  } | null>(null);
  const [isRoiDragging, setIsRoiDragging] = useState(false);
  const roiDragRef = useRef<{
    mode: "autoCount" | "doorFinder" | "facade" | "wallFinder" | "roomFinder";
    pageIndex: number;
    startLocalX: number;
    startLocalY: number;
    curLocalX: number;
    curLocalY: number;
  } | null>(null);

  const findPageIndex = useCallback((clientX: number, clientY: number) => {
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        return i;
      }
    }
    return -1;
  }, []);

  const clientToPageLocal = useCallback(
    (clientX: number, clientY: number, pageIndex: number) => {
      const el = pageRefs.current[pageIndex];
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    },
    []
  );

  const resetZoomToFit = useCallback(() => {
    const zc = zoomContainerRef.current;
    const zcontent = zoomContentRef.current;
    if (!zc || !zcontent) return;
    const containerW = zc.clientWidth;
    const containerH = zc.clientHeight;
    const contentW = zcontent.offsetWidth;
    const contentH = zcontent.offsetHeight;
    if (
      containerW === 0 ||
      containerH === 0 ||
      contentW === 0 ||
      contentH === 0
    ) {
      return;
    }
    const prev = transformRef.current;
    const fit = Math.min(
      (containerW - 40) / contentW,
      (containerH - 40) / contentH,
      1
    );
    setTransform({
      scale: Math.min(Math.max(prev.scale * fit, ZOOM_MIN), ZOOM_MAX),
      pointX: (containerW - contentW * fit) / 2,
      pointY: (containerH - contentH * fit) / 2,
    });
  }, []);

  useEffect(() => {
    const el = zoomContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setMaxWidth(Math.max(0, el.clientWidth - 8));
    });
    ro.observe(el);
    setMaxWidth(Math.max(0, el.clientWidth - 8));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;

        const data = await pdfBlob.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
        doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        setPdfDoc(doc);
        initialFitRef.current = false;
      } catch {
        if (!cancelled) setPdfDoc(null);
      }
    })();

    return () => {
      cancelled = true;
      setPdfDoc(null);
      void doc?.destroy();
    };
  }, [pdfBlob]);

  useEffect(() => {
    pageMetricsRef.current.clear();
  }, [pdfBlob]);

  useEffect(() => {
    const zcontent = zoomContentRef.current;
    if (!zcontent || !pdfDoc) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (initialFitRef.current) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (zcontent.offsetWidth > 0 && zcontent.offsetHeight > 0) {
          resetZoomToFit();
          initialFitRef.current = true;
        }
      }, 200);
    });
    ro.observe(zcontent);
    return () => {
      ro.disconnect();
      if (debounce) clearTimeout(debounce);
    };
  }, [pdfDoc, resetZoomToFit]);

  useEffect(() => {
    const zc = zoomContainerRef.current;
    if (!zc) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = zc.getBoundingClientRect();
      const prev = transformRef.current;
      const cx = e.clientX - rect.left - prev.pointX;
      const cy = e.clientY - rect.top - prev.pointY;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(
        Math.max(prev.scale * factor, ZOOM_MIN),
        ZOOM_MAX
      );
      const ratio = newScale / prev.scale;
      setTransform({
        scale: newScale,
        pointX: e.clientX - rect.left - cx * ratio,
        pointY: e.clientY - rect.top - cy * ratio,
      });
    };

    zc.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () =>
      zc.removeEventListener("wheel", onWheel, { capture: true } as AddEventListenerOptions);
  }, []);

  /** Shared hit-test for remove chips (Select/pointer has no ROI overlay — hits handled on root). */
  const pickAutoCountRemoveIndex = useCallback(
    (clientX: number, clientY: number): number | null => {
      if (!onAutoCountRemoveMatch || !autoCountBackend) return null;
      const pageIndex = findPageIndex(clientX, clientY);
      if (pageIndex < 0) return null;
      if (autoCountBackend.pageNumber !== pageIndex + 1) return null;
      const metrics = pageMetricsRef.current.get(pageIndex + 1);
      if (!metrics) return null;
      const local = clientToPageLocal(clientX, clientY, pageIndex);
      const boxes = backendMatchesToScreen(
        autoCountBackend.matches,
        metrics
      );
      return hitTestAutoCountRemoveCorner(local.x, local.y, boxes);
    },
    [autoCountBackend, onAutoCountRemoveMatch, findPageIndex, clientToPageLocal]
  );

  const onRootPointerDownForRemove = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      if (tool !== "pointer") return;
      if (!onAutoCountRemoveMatch || !autoCountBackend) return;
      const clientX =
        "touches" in e && e.touches.length > 0
          ? e.touches[0].clientX
          : (e as ReactMouseEvent).clientX;
      const clientY =
        "touches" in e && e.touches.length > 0
          ? e.touches[0].clientY
          : (e as ReactMouseEvent).clientY;
      const removeIx = pickAutoCountRemoveIndex(clientX, clientY);
      if (removeIx == null) return;
      e.preventDefault();
      e.stopPropagation();
      onAutoCountRemoveMatch(removeIx);
    },
    [tool, autoCountBackend, onAutoCountRemoveMatch, pickAutoCountRemoveIndex]
  );

  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (e.button !== 0) return;
      if (tool === "pointer") {
        onRootPointerDownForRemove(e);
        return;
      }
      if (tool !== "hand") return;
      e.preventDefault();
      const prev = transformRef.current;
      panStartRef.current = {
        startX: e.clientX - prev.pointX,
        startY: e.clientY - prev.pointY,
      };
      setIsDragging(true);
    },
    [tool, onRootPointerDownForRemove]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const s = panStartRef.current;
      setTransform((t) => ({
        ...t,
        pointX: e.clientX - s.startX,
        pointY: e.clientY - s.startY,
      }));
    };

    const onUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const endRoiDrag = useCallback(() => {
    const d = roiDragRef.current;
    roiDragRef.current = null;
    setDraftRoi(null);
    setIsRoiDragging(false);
    if (!d) return;
    const onCommit =
      d.mode === "doorFinder"
        ? onDoorFinderRoiChange
        : d.mode === "facade"
          ? onFacadeRoiChange
          : d.mode === "wallFinder"
            ? onWallFinderRoiChange
            : d.mode === "roomFinder"
              ? onRoomFinderRoiChange
              : onAutoCountRoiChange;
    if (!onCommit) return;
    const w = Math.abs(d.curLocalX - d.startLocalX);
    const h = Math.abs(d.curLocalY - d.startLocalY);
    if (w < 4 || h < 4) {
      return;
    }
    const rect = normalizeRect(
      d.startLocalX,
      d.startLocalY,
      d.curLocalX,
      d.curLocalY
    );
    onCommit({
      pageNumber: d.pageIndex + 1,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  }, [
    onAutoCountRoiChange,
    onDoorFinderRoiChange,
    onFacadeRoiChange,
    onWallFinderRoiChange,
    onRoomFinderRoiChange,
  ]);

  const updateRoiDrag = useCallback(
    (clientX: number, clientY: number) => {
      const d = roiDragRef.current;
      if (!d) return;
      const local = clientToPageLocal(clientX, clientY, d.pageIndex);
      d.curLocalX = local.x;
      d.curLocalY = local.y;
      const rect = normalizeRect(
        d.startLocalX,
        d.startLocalY,
        d.curLocalX,
        d.curLocalY
      );
      setDraftRoi({ pageIndex: d.pageIndex, rect });
    },
    [clientToPageLocal]
  );

  const onRoiPointerDown = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      if (
        tool !== "autoCount" &&
        tool !== "doorFinder" &&
        tool !== "facade" &&
        tool !== "wallFinder" &&
        tool !== "roomFinder"
      )
        return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (tool === "autoCount") {
        const removeIx = pickAutoCountRemoveIndex(clientX, clientY);
        if (removeIx != null) {
          e.preventDefault();
          e.stopPropagation();
          onAutoCountRemoveMatch?.(removeIx);
          return;
        }
      }

      const pageIndex = findPageIndex(clientX, clientY);
      if (pageIndex < 0) return;
      const local = clientToPageLocal(clientX, clientY, pageIndex);

      e.preventDefault();
      e.stopPropagation();
      roiDragRef.current = {
        mode:
          tool === "doorFinder"
            ? "doorFinder"
            : tool === "facade"
              ? "facade"
              : tool === "wallFinder"
                ? "wallFinder"
                : tool === "roomFinder"
                  ? "roomFinder"
                  : "autoCount",
        pageIndex,
        startLocalX: local.x,
        startLocalY: local.y,
        curLocalX: local.x,
        curLocalY: local.y,
      };
      setDraftRoi({
        pageIndex,
        rect: {
          x: local.x,
          y: local.y,
          width: 0,
          height: 0,
        },
      });
      setIsRoiDragging(true);
    },
    [
      tool,
      findPageIndex,
      clientToPageLocal,
      pickAutoCountRemoveIndex,
      onAutoCountRemoveMatch,
    ]
  );

  useEffect(() => {
    if (!isRoiDragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!roiDragRef.current) return;
      const cx =
        "touches" in e && e.touches.length > 0
          ? e.touches[0].clientX
          : (e as MouseEvent).clientX;
      const cy =
        "touches" in e && e.touches.length > 0
          ? e.touches[0].clientY
          : (e as MouseEvent).clientY;
      updateRoiDrag(cx, cy);
    };

    const onUp = () => {
      endRoiDrag();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isRoiDragging, updateRoiDrag, endRoiDrag]);

  const onFloorPointerDown = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      if (tool !== "floorArea" || !onFloorAreaClick) return;
      e.preventDefault();
      e.stopPropagation();
      const clientX =
        "touches" in e && e.touches.length > 0
          ? e.touches[0].clientX
          : (e as ReactMouseEvent).clientX;
      const clientY =
        "touches" in e && e.touches.length > 0
          ? e.touches[0].clientY
          : (e as ReactMouseEvent).clientY;
      const pageIndex = findPageIndex(clientX, clientY);
      if (pageIndex < 0) return;
      const local = clientToPageLocal(clientX, clientY, pageIndex);
      onFloorAreaClick(pageIndex + 1, local.x, local.y);
    },
    [tool, onFloorAreaClick, findPageIndex, clientToPageLocal]
  );

  const cursorClass =
    tool === "hand"
      ? isDragging
        ? "cursor-grabbing"
        : "cursor-grab"
      : tool === "autoCount" ||
          tool === "doorFinder" ||
          tool === "facade" ||
          tool === "wallFinder" ||
          tool === "roomFinder" ||
          tool === "floorArea"
        ? "cursor-crosshair"
        : "cursor-default";

  const numPages = pdfDoc?.numPages ?? 0;

  const layerForPage = useCallback(
    (pageNumber: number): PageAnnotationLayer => {
      const idx = pageNumber - 1;
      const metrics = pageMetricsRef.current.get(pageNumber);

      let committedAuto: CssRect | null = null;
      if (
        autoCountRoi?.pageNumber === pageNumber &&
        metrics
      ) {
        committedAuto = backendRoiToScreenCss(autoCountRoi.roi, metrics);
      } else if (
        autoCountBackend &&
        autoCountBackend.pageNumber === pageNumber &&
        metrics &&
        autoCountBackend.roi.width > 0 &&
        autoCountBackend.roi.height > 0
      ) {
        committedAuto = backendRoiToScreenCss(autoCountBackend.roi, metrics);
      }

      let committedDoor: CssRect | null = null;
      if (doorFinderRoi?.pageNumber === pageNumber && metrics) {
        committedDoor = backendRoiToScreenCss(doorFinderRoi.roi, metrics);
      } else if (
        doorFinderBackend &&
        doorFinderBackend.pageNumber === pageNumber &&
        metrics &&
        doorFinderBackend.roi.width > 0 &&
        doorFinderBackend.roi.height > 0
      ) {
        committedDoor = backendRoiToScreenCss(doorFinderBackend.roi, metrics);
      }

      let committedFacade: CssRect | null = null;
      if (facadeRoi?.pageNumber === pageNumber && metrics) {
        committedFacade = backendRoiToScreenCss(facadeRoi.roi, metrics);
      } else if (
        facadeBackend &&
        backendPageMatches(facadeBackend.pageNumber, pageNumber) &&
        metrics &&
        facadeBackend.roi.width > 0 &&
        facadeBackend.roi.height > 0
      ) {
        committedFacade = backendRoiToScreenCss(facadeBackend.roi, metrics);
      }

      let committedWall: CssRect | null = null;
      if (wallFinderRoi?.pageNumber === pageNumber && metrics) {
        committedWall = backendRoiToScreenCss(wallFinderRoi.roi, metrics);
      } else if (
        wallFinderBackend &&
        backendPageMatches(wallFinderBackend.pageNumber, pageNumber) &&
        metrics &&
        wallFinderBackend.roi.width > 0 &&
        wallFinderBackend.roi.height > 0
      ) {
        committedWall = backendRoiToScreenCss(wallFinderBackend.roi, metrics);
      }

      let committedRoom: CssRect | null = null;
      if (roomFinderRoi?.pageNumber === pageNumber && metrics) {
        committedRoom = backendRoiToScreenCss(roomFinderRoi.roi, metrics);
      } else if (
        roomFinderBackend &&
        backendPageMatches(roomFinderBackend.pageNumber, pageNumber) &&
        metrics &&
        roomFinderBackend.roi.width > 0 &&
        roomFinderBackend.roi.height > 0
      ) {
        committedRoom = backendRoiToScreenCss(roomFinderBackend.roi, metrics);
      }

      const draft =
        draftRoi?.pageIndex === idx ? draftRoi.rect : null;

      let matchesAuto: AutoCountMatch[] = [];
      if (
        autoCountBackend &&
        autoCountBackend.pageNumber === pageNumber &&
        metrics
      ) {
        matchesAuto = backendMatchesToScreen(
          autoCountBackend.matches,
          metrics
        );
      }

      let matchesDoor: AutoCountMatch[] = [];
      if (
        doorFinderBackend &&
        doorFinderBackend.pageNumber === pageNumber &&
        metrics
      ) {
        matchesDoor = backendMatchesToScreen(
          doorFinderBackend.matches,
          metrics
        );
      }

      let facadeWindows: { box: AutoCountMatch; id: number }[] = [];
      if (
        facadeBackend &&
        backendPageMatches(facadeBackend.pageNumber, pageNumber) &&
        metrics
      ) {
        facadeWindows = facadeDimensionsToScreenBoxes(
          facadeBackend.response.dimensions,
          metrics
        );
      }

      let wallSegments: WallSegmentScreen[] = [];
      if (
        wallFinderBackend &&
        backendPageMatches(wallFinderBackend.pageNumber, pageNumber) &&
        metrics
      ) {
        wallSegments = wallFinderResponseToScreenDrawItems(
          wallFinderBackend.response,
          metrics,
          wallFinderBackend.roi
        );
      }

      let roomPolygons: RoomPolygonScreen[] = [];
      if (
        roomFinderBackend &&
        backendPageMatches(roomFinderBackend.pageNumber, pageNumber) &&
        metrics
      ) {
        roomPolygons = roomFinderResponseToScreenPolygons(
          roomFinderBackend.response,
          metrics,
          roomFinderPixelToMeter
        );
      }

      if (metrics && persistedSavedOverlays.length > 0) {
        for (const entry of persistedSavedOverlays) {
          const snap = entry.canvasSnapshot;
          if (isMatchCanvasSnapshot(snap) && snap.pageNumber === pageNumber) {
            matchesAuto.push(
              ...backendMatchesToScreen(snap.matches, metrics)
            );
          }
          if (
            entry.analysisKind === "walls" &&
            isWallCanvasSnapshot(snap) &&
            backendPageMatches(snap.pageNumber, pageNumber)
          ) {
            wallSegments.push(
              ...wallFinderResponseToScreenDrawItems(
                snap.response,
                metrics,
                snap.roi
              )
            );
          }
          if (
            entry.analysisKind === "rooms" &&
            isRoomCanvasSnapshot(snap) &&
            backendPageMatches(snap.pageNumber, pageNumber)
          ) {
            roomPolygons.push(
              ...roomFinderResponseToScreenPolygons(
                snap.response,
                metrics,
                roomFinderPixelToMeter
              )
            );
          }
          if (
            entry.analysisKind === "facade" &&
            isWallCanvasSnapshot(snap) &&
            backendPageMatches(snap.pageNumber, pageNumber) &&
            metrics
          ) {
            facadeWindows.push(
              ...facadeDimensionsToScreenBoxes(
                (snap as FacadeSavedSnapshotV1).response.dimensions,
                metrics
              )
            );
          }
        }
      }

      let floorSeeds = floorAreaSeeds
        .filter((s) => s.pageNumber === pageNumber)
        .map((s) =>
          metrics
            ? backendPointToScreenCss(s.seedBackend, metrics)
            : { x: 0, y: 0 }
        );
      let floorRegions = floorAreaRegions
        .filter((r) => r.pageNumber === pageNumber)
        .map(({ pageNumber: _p, ...rest }) => {
          if (!metrics || !rest.seedBackend) {
            return { ...rest };
          }
          if (rest.polygonRaw && rest.polygonRaw.length >= 3) {
            const previewRing = resolveFloorPolygonToPreviewBackend(
              rest.polygonRaw,
              rest.seedBackend
            );
            return {
              ...rest,
              cssPoly: floorPolygonBackendToScreenCss(previewRing, metrics),
              seedCss: backendPointToScreenCss(rest.seedBackend, metrics),
            };
          }
          if (rest.polygonPreviewBackend && rest.polygonPreviewBackend.length >= 3) {
            return {
              ...rest,
              cssPoly: floorPolygonBackendToScreenCss(
                rest.polygonPreviewBackend,
                metrics
              ),
              seedCss: backendPointToScreenCss(rest.seedBackend, metrics),
            };
          }
          return { ...rest };
        });

      if (metrics && persistedSavedOverlays.length > 0) {
        for (const entry of persistedSavedOverlays) {
          const snap = entry.canvasSnapshot;
          if (
            entry.analysisKind === "floor" &&
            isFloorCanvasSnapshot(snap)
          ) {
            for (const ex of snap.extractions) {
              if (ex.pageNumber !== pageNumber) continue;
              floorRegions.push(floorExtractionToOverlayRegion(ex, metrics));
              floorSeeds.push(
                backendPointToScreenCss(ex.seedBackend, metrics)
              );
            }
          }
        }
      }

      let autoCountRemoveMarkerCount = 0;
      const autoCountShowRemoveCorners = Boolean(
        onAutoCountRemoveMatch &&
          autoCountBackend &&
          autoCountBackend.pageNumber === pageNumber &&
          metrics
      );
      if (autoCountShowRemoveCorners && autoCountBackend) {
        autoCountRemoveMarkerCount = autoCountBackend.matches.length;
      }

      return {
        committedRoiAuto: committedAuto,
        committedRoiDoor: committedDoor,
        committedRoiFacade: committedFacade,
        committedRoiWall: committedWall,
        committedRoiRoom: committedRoom,
        draftRoi: draft,
        matchesAuto,
        matchesDoor,
        facadeWindows,
        wallSegments,
        roomPolygons,
        floorSeeds,
        floorRegions,
        emphasize: emphasizeAutoCountHighlight,
        autoCountShowRemoveCorners,
        autoCountRemoveMarkerCount,
      };
    },
    [
      onAutoCountRemoveMatch,
      autoCountRoi,
      doorFinderRoi,
      facadeRoi,
      facadeBackend,
      wallFinderRoi,
      roomFinderRoi,
      autoCountBackend,
      doorFinderBackend,
      wallFinderBackend,
      roomFinderBackend,
      roomFinderPixelToMeter,
      draftRoi,
      metricsTick,
      emphasizeAutoCountHighlight,
      persistedSavedOverlays,
      floorAreaSeeds,
      floorAreaRegions,
    ]
  );

  const layersByPage = useMemo(() => {
    if (numPages === 0) return [];
    return Array.from({ length: numPages }, (_, i) => layerForPage(i + 1));
  }, [numPages, layerForPage]);

  return (
    <div
      ref={zoomContainerRef}
      className={cn(
        "relative h-full w-full min-h-0 touch-none overflow-hidden overscroll-contain bg-zinc-100/90",
        cursorClass,
        className
      )}
      style={{ overscrollBehavior: "contain" }}
      title="Scroll wheel: zoom in/out. Hand tool: drag to pan."
      onMouseDown={onMouseDown}
      onTouchStart={(e) => {
        if (tool === "pointer") onRootPointerDownForRemove(e);
      }}
    >
      {!pdfDoc ? (
        <div
          className="flex h-full min-h-[min(52dvh,400px)] w-full items-center justify-center bg-muted/20"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : maxWidth > 0 ? (
        <div
          ref={zoomContentRef}
          className="absolute left-0 top-0 inline-block origin-top-left will-change-transform"
          style={
            {
              transform: `translate(${transform.pointX}px, ${transform.pointY}px)`,
            } as CSSProperties
          }
        >
          <div className="relative inline-block">
            <div className="canvas-stack flex flex-col items-center gap-0 py-2 leading-none shadow-xl">
              {Array.from({ length: numPages }, (_, i) => (
                <PdfPageRow
                  key={i + 1}
                  pdfDoc={pdfDoc}
                  pageNumber={i + 1}
                  maxWidth={maxWidth}
                  zoomScale={transform.scale}
                  pageWrapperRef={(el) => setPageRef(i, el)}
                  autoCountLayer={layersByPage[i]!}
                  onPageMetrics={handlePageMetrics}
                />
              ))}
            </div>
            {tool === "autoCount" ||
            tool === "doorFinder" ||
            tool === "facade" ||
            tool === "wallFinder" ||
            tool === "roomFinder" ? (
              <div
                className="absolute inset-0 z-20 bg-transparent"
                style={{ pointerEvents: "auto" }}
                onMouseDown={onRoiPointerDown}
                onTouchStart={onRoiPointerDown}
                aria-hidden
              />
            ) : null}
            {tool === "floorArea" && onFloorAreaClick ? (
              <div
                className="absolute inset-0 z-20 bg-transparent"
                style={{ pointerEvents: "auto" }}
                onMouseDown={onFloorPointerDown}
                onTouchStart={onFloorPointerDown}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-[120px] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
});
