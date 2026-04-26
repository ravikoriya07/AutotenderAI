import type { AutoCountMatch, AutoCountRoi } from "@/services/autoCountService";
import type { AnalyzeFacadeResponse, FacadeDimension } from "@/services/facadeAnalyzerService";
import { readPngDimensionsFromDataUrl } from "@/lib/pngDataUrlDimensions";
import type { WallFinderApiResponse } from "@/services/wallFinderService";
import type { RoomFinderApiResponse } from "@/services/roomFinderService";
import {
  pickRoomRowsFromResponse,
  readRoomAreaM2FromRow,
  ROOM_FINDER_DEFAULT_PIXEL_TO_METER,
} from "@/services/roomFinderService";

/** Raw `/auto_count` match row (backend may use w/h or width/height). */
export type AutoCountApiMatch = {
  id?: string | number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  score?: number;
  confidence?: number;
};

/** Matches Python backend `PREVIEW_ZOOM` / pdf.js page space for API rectangles. */
export const BACKEND_PDF_VIEWPORT_SCALE = 2;

export type AutoCountPageMetrics = {
  backendBaseWidth: number;
  backendBaseHeight: number;
  cssWidth: number;
  cssHeight: number;
};

type CssRect = { x: number; y: number; width: number; height: number };

function scaleFactorsXY(m: AutoCountPageMetrics): { fx: number; fy: number } {
  const fx =
    m.backendBaseWidth > 0 ? m.cssWidth / m.backendBaseWidth : 1;
  const fy =
    m.backendBaseHeight > 0 ? m.cssHeight / m.backendBaseHeight : 1;
  return { fx, fy };
}

/**
 * Converts ROI from UI (CSS px relative to page box) to backend units
 * (pdf.js viewport at {@link BACKEND_PDF_VIEWPORT_SCALE}).
 */
export function screenRectToBackend(
  rectCss: CssRect,
  metrics: AutoCountPageMetrics
): AutoCountRoi {
  const { fx, fy } = scaleFactorsXY(metrics);
  return {
    x: Math.round(rectCss.x / fx),
    y: Math.round(rectCss.y / fy),
    width: Math.round(rectCss.width / fx),
    height: Math.round(rectCss.height / fy),
  };
}

/** Single point in CSS page space → backend preview scale (same as ROI corners). */
export function screenPointToBackend(
  xCss: number,
  yCss: number,
  metrics: AutoCountPageMetrics
): { x: number; y: number } {
  const { fx, fy } = scaleFactorsXY(metrics);
  return {
    x: Math.round(xCss / fx),
    y: Math.round(yCss / fy),
  };
}

/**
 * Backend preview point → CSS px on the page box (inverse of {@link screenPointToBackend}).
 * Keeps overlays aligned when zoom/resize changes {@link AutoCountPageMetrics}.
 */
export function backendPointToScreenCss(
  p: { x: number; y: number },
  metrics: AutoCountPageMetrics
): { x: number; y: number } {
  const { fx, fy } = scaleFactorsXY(metrics);
  return {
    x: Number(p.x) * fx,
    y: Number(p.y) * fy,
  };
}

/**
 * ROI in API preview space + page index. Persist this instead of CSS rects so overlays
 * stay pinned when the PDF is re-rendered at a different scale.
 */
export type QtoCommittedRoi = {
  pageNumber: number;
  roi: AutoCountRoi;
};

/** Quantitites_Project uses ANALYSIS_ZOOM=4 vs PREVIEW_ZOOM=2 for floor extraction raster. */
const FLOOR_ANALYSIS_TO_PREVIEW = 0.5;

/**
 * Maps polygon vertices from analysis raster space to preview/backend space (scale-2).
 */
export function floorPolygonAnalysisToPreviewBackend(
  pts: { x: number; y: number }[]
): { x: number; y: number }[] {
  return pts.map((p) => ({
    x: p.x * FLOOR_ANALYSIS_TO_PREVIEW,
    y: p.y * FLOOR_ANALYSIS_TO_PREVIEW,
  }));
}

/** Ray-cast point-in-polygon (page coords, y-down). */
function pointInPolygonBackend(
  x: number,
  y: number,
  poly: ReadonlyArray<{ x: number; y: number }>
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * `/extract_floor` may return `new_polygon` in analysis raster space or in the same
 * preview/backend space as `seed`. The old max-X heuristic misclassified small rooms.
 * We pick the interpretation where the seed lies inside the polygon (same space as the
 * request seed), falling back to the candidate whose centroid is closest to the seed.
 */
export function resolveFloorPolygonToPreviewBackend(
  pts: { x: number; y: number }[],
  seedBackend: { x: number; y: number }
): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const scaled = floorPolygonAnalysisToPreviewBackend(pts);
  const candidates: { x: number; y: number }[][] = [pts];
  let differs = false;
  for (let i = 0; i < pts.length; i++) {
    if (
      Math.abs(pts[i]!.x - scaled[i]!.x) > 1e-4 ||
      Math.abs(pts[i]!.y - scaled[i]!.y) > 1e-4
    ) {
      differs = true;
      break;
    }
  }
  if (differs) {
    candidates.push(scaled);
  }

  const sx = seedBackend.x;
  const sy = seedBackend.y;

  for (const c of candidates) {
    if (pointInPolygonBackend(sx, sy, c)) {
      return c;
    }
  }

  let best = candidates[0]!;
  let bestD = Infinity;
  for (const c of candidates) {
    let cx = 0;
    let cy = 0;
    for (const p of c) {
      cx += p.x;
      cy += p.y;
    }
    cx /= c.length;
    cy /= c.length;
    const d = (cx - sx) ** 2 + (cy - sy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Preview/backend points → CSS px for canvas overlay. */
export function floorPolygonBackendToScreenCss(
  pts: { x: number; y: number }[],
  metrics: AutoCountPageMetrics
): { x: number; y: number }[] {
  const { fx, fy } = scaleFactorsXY(metrics);
  return pts.map((p) => ({ x: p.x * fx, y: p.y * fy }));
}

/** Converts backend ROI (scale-2 space) to CSS px for overlay using current layout metrics. */
export function backendRoiToScreenCss(
  roi: AutoCountRoi,
  metrics: AutoCountPageMetrics
): CssRect {
  const { fx, fy } = scaleFactorsXY(metrics);
  return {
    x: roi.x * fx,
    y: roi.y * fy,
    width: roi.width * fx,
    height: roi.height * fy,
  };
}

function pickWH(m: AutoCountApiMatch): { w: number; h: number } {
  const wRaw = m.w ?? m.width;
  const hRaw = m.h ?? m.height;
  return {
    w: Number(wRaw ?? 0),
    h: Number(hRaw ?? 0),
  };
}

/**
 * Converts API match boxes from backend space to CSS px for overlay drawing.
 */
export function backendMatchesToScreen(
  matches: AutoCountApiMatch[] | undefined | null,
  metrics: AutoCountPageMetrics
): AutoCountMatch[] {
  const { fx, fy } = scaleFactorsXY(metrics);
  const rows = Array.isArray(matches) ? matches : [];
  return rows.map((m) => {
    const { w, h } = pickWH(m);
    const scoreRaw = m.score ?? m.confidence ?? 0;
    const out: AutoCountMatch = {
      x: Number(m.x) * fx,
      y: Number(m.y) * fy,
      w: w * fx,
      h: h * fy,
      score: Number(scoreRaw),
    };
    const idRaw = m.id;
    if (typeof idRaw === "string") {
      if (idRaw !== "") out.id = idRaw;
    } else if (typeof idRaw === "number" && Number.isFinite(idRaw)) {
      out.id = idRaw;
    }
    return out;
  });
}

/** Optional mapping from facade API pixel space → backend preview ROI / page (see Quantitites `logic_analyze_facade`). */
export type FacadeDimensionsMappingOptions = {
  roi: AutoCountRoi | null;
  /** `AnalyzeFacadeResponse.image` — PNG size anchors pixel→page mapping. */
  annotatedImageDataUrl?: string | null;
  /** Optional explicit raster size (same space as `dimensions` boxes). */
  analysisImageWidth?: number;
  analysisImageHeight?: number;
  backendPageWidth: number;
  backendPageHeight: number;
  /** Sizing fallback when URL / width fields above are not set. */
  response?: Pick<
    AnalyzeFacadeResponse,
    "image" | "analysis_image_width" | "analysis_image_height"
  > | null;
};

/** `Quantitites_Project` `logic_analyze_facade`: YOLO boxes are in the same pixel grid as the pixmap; returned `image` is the full page raster (zoom=1) while the UI ROI uses preview=2 space — same as {@link BACKEND_PDF_VIEWPORT_SCALE}. */
function isLikelyFullPageRaster(
  refW: number,
  refH: number,
  pageW: number,
  pageH: number
): boolean {
  if (refH <= 0 || refW <= 0 || pageH <= 0) return false;
  const aPage = pageW / pageH;
  const aPng = refW / refH;
  /** Tolerate small DPI / rounding differences between fitz pixmap and pdf.js viewport. */
  return Math.abs(aPng - aPage) / Math.max(1e-6, aPage) < 0.12;
}

function pointInRoiBackend(
  cx: number,
  cy: number,
  roi: AutoCountRoi,
  slack: number
): boolean {
  return (
    cx >= roi.x - slack &&
    cx <= roi.x + roi.width + slack &&
    cy >= roi.y - slack &&
    cy <= roi.y + roi.height + slack
  );
}

/**
 * Same convention as `Quantitites_Project` `logic_analyze_doors`: `x,y,w,h` are already in
 * **pdf.js / backend preview** space (global page, scale 2). No ROI or PNG transform — matches
 * {@link backendMatchesToScreen} input for door finder.
 */
function facadePreviewGlobalToBackend(
  d: FacadeDimension
): { x: number; y: number; w: number; h: number } | null {
  const x = Number(d.x);
  const y = Number(d.y);
  const w = Number(d.w ?? d.width);
  const h = Number(d.h ?? d.height);
  if (![x, y, w, h].every((v) => Number.isFinite(v)) || w <= 0 || h <= 0) {
    return null;
  }
  return { x, y, w, h };
}

/** ROI-relative preview boxes: top-left of each window is offset from the ROI top-left in preview space. */
function facadePreviewRoiOffsetToBackend(
  d: FacadeDimension,
  roi: AutoCountRoi
): { x: number; y: number; w: number; h: number } | null {
  const pr = facadePreviewGlobalToBackend(d);
  if (!pr) return null;
  return {
    x: roi.x + pr.x,
    y: roi.y + pr.y,
    w: pr.w,
    h: pr.h,
  };
}

/** Bboxes in full-page PNG pixels: offset from crop origin, same convention as `full_img[y:y+h, x:x+w]`. */
function facadeFullPageOffsetToBackend(
  d: FacadeDimension,
  roi: AutoCountRoi,
  pngW: number,
  pngH: number,
  pageW: number,
  pageH: number
): { x: number; y: number; w: number; h: number } | null {
  const dx = Number(d.x);
  const dy = Number(d.y);
  const dw = Number(d.w ?? d.width);
  const dh = Number(d.h ?? d.height);
  if (![dx, dy, dw, dh].every((v) => Number.isFinite(v)) || dw <= 0 || dh <= 0) {
    return null;
  }
  if (pngW <= 0 || pngH <= 0) return null;
  return {
    x: roi.x + (dx / pngW) * pageW,
    y: roi.y + (dy / pngH) * pageH,
    w: (dw / pngW) * pageW,
    h: (dh / pngH) * pageH,
  };
}

/** Bboxes in a crop-only PNG: same as normalizing to ROI in preview space. */
function facadeCropPngToBackend(
  d: FacadeDimension,
  roi: AutoCountRoi,
  rw: number,
  rh: number
): { x: number; y: number; w: number; h: number } | null {
  const dx = Number(d.x);
  const dy = Number(d.y);
  const dw = Number(d.w ?? d.width);
  const dh = Number(d.h ?? d.height);
  if (![dx, dy, dw, dh].every((v) => Number.isFinite(v)) || dw <= 0 || dh <= 0) {
    return null;
  }
  if (rw <= 0 || rh <= 0) return null;
  return {
    x: roi.x + (dx / rw) * roi.width,
    y: roi.y + (dy / rh) * roi.height,
    w: (dw / rw) * roi.width,
    h: (dh / rh) * roi.height,
  };
}

function facadePageAbsoluteToBackend(
  d: FacadeDimension,
  refW: number,
  refH: number,
  pageW: number,
  pageH: number
): { x: number; y: number; w: number; h: number } | null {
  const dx = Number(d.x);
  const dy = Number(d.y);
  const dw = Number(d.w ?? d.width);
  const dh = Number(d.h ?? d.height);
  if (![dx, dy, dw, dh].every((v) => Number.isFinite(v)) || dw <= 0 || dh <= 0) {
    return null;
  }
  if (refW <= 0 || refH <= 0) return null;
  return {
    x: (dx / refW) * pageW,
    y: (dy / refH) * pageH,
    w: (dw / refW) * pageW,
    h: (dh / refH) * pageH,
  };
}

type FacadeSpaceStrategy =
  | "previewGlobal"
  | "previewRoi"
  | "fullPageOffset"
  | "cropPng"
  | "pageAbsolute";

/**
 * Picks the mapping with the best on-page + in-ROI fit, same as door finder: treat `dimensions` as
 * **preview** first; fall back to pixmap (`fullPageOffset` / `cropPng` / `pageAbsolute`) when that fits better.
 */
function mapScoreForFacadeStrategy(
  dimensions: FacadeDimension[],
  mapOne: (d: FacadeDimension) => { x: number; y: number; w: number; h: number } | null,
  pageW: number,
  pageH: number,
  roi: AutoCountRoi
): number {
  const margin = Math.max(12, Math.max(pageW, pageH) * 0.01);
  const slack = Math.max(8, Math.max(roi.width, roi.height) * 0.02);
  let s = 0;
  for (const d of dimensions) {
    const b = mapOne(d);
    if (!b) continue;
    const inPage =
      b.x >= -margin &&
      b.y >= -margin &&
      b.x + b.w <= pageW + margin &&
      b.y + b.h <= pageH + margin;
    if (!inPage) continue;
    s += 1;
    if (
      pointInRoiBackend(b.x + b.w / 2, b.y + b.h / 2, roi, slack)
    ) {
      s += 0.25;
    }
  }
  return s;
}

function pickBestFacadeSpace(
  dimensions: FacadeDimension[],
  roi: AutoCountRoi,
  pageW: number,
  pageH: number,
  png: { w: number; h: number } | null
): FacadeSpaceStrategy {
  const cands: { key: FacadeSpaceStrategy; score: number }[] = [
    {
      key: "previewGlobal",
      score: mapScoreForFacadeStrategy(
        dimensions,
        (d) => facadePreviewGlobalToBackend(d),
        pageW,
        pageH,
        roi
      ),
    },
    {
      key: "previewRoi",
      score: mapScoreForFacadeStrategy(
        dimensions,
        (d) => facadePreviewRoiOffsetToBackend(d, roi),
        pageW,
        pageH,
        roi
      ),
    },
  ];
  if (png) {
    cands.push(
      {
        key: "fullPageOffset",
        score: mapScoreForFacadeStrategy(
          dimensions,
          (d) =>
            facadeFullPageOffsetToBackend(
              d,
              roi,
              png.w,
              png.h,
              pageW,
              pageH
            ),
          pageW,
          pageH,
          roi
        ),
      },
      {
        key: "cropPng",
        score: mapScoreForFacadeStrategy(
          dimensions,
          (d) => facadeCropPngToBackend(d, roi, png.w, png.h),
          pageW,
          pageH,
          roi
        ),
      },
      {
        key: "pageAbsolute",
        score: mapScoreForFacadeStrategy(
          dimensions,
          (d) => facadePageAbsoluteToBackend(d, png.w, png.h, pageW, pageH),
          pageW,
          pageH,
          roi
        ),
      }
    );
  }
  const pri: Record<FacadeSpaceStrategy, number> = {
    previewGlobal: 5,
    previewRoi: 4,
    fullPageOffset: 3,
    cropPng: 2,
    pageAbsolute: 1,
  };
  cands.sort(
    (a, b) =>
      b.score - a.score || pri[b.key] - pri[a.key]
  );
  const best = cands[0]!;
  if (best && best.score > 0) {
    return best.key;
  }
  if (png && isLikelyFullPageRaster(png.w, png.h, pageW, pageH)) {
    return "fullPageOffset";
  }
  if (png) {
    return "cropPng";
  }
  return "previewGlobal";
}

function facadeDimensionsExtent(
  dimensions: FacadeDimension[]
): { maxR: number; maxB: number } | null {
  let maxR = 0;
  let maxB = 0;
  for (const d of dimensions) {
    const x = Number(d.x);
    const y = Number(d.y);
    const w = Number(d.w ?? d.width);
    const h = Number(d.h ?? d.height);
    if (![x, y, w, h].every((v) => Number.isFinite(v))) continue;
    maxR = Math.max(maxR, x + w);
    maxB = Math.max(maxB, y + h);
  }
  if (maxR <= 0 || maxB <= 0) return null;
  return { maxR, maxB };
}

/**
 * Full-page ROI edge case:
 * - If API already sends preview/global coordinates, ROI-based scoring can overfit and pick
 *   an unnecessary transform.
 * - Compare extents against page-space vs raster-space and lock a stable mode.
 */
function pickFacadeSpaceForFullPageRoi(
  dimensions: FacadeDimension[],
  pageW: number,
  pageH: number,
  png: { w: number; h: number } | null
): FacadeSpaceStrategy | null {
  const ex = facadeDimensionsExtent(dimensions);
  if (!ex) return null;
  const ePrev =
    Math.abs(ex.maxR - pageW) / Math.max(1, pageW) +
    Math.abs(ex.maxB - pageH) / Math.max(1, pageH);
  if (!png) return "previewGlobal";
  const ePng =
    Math.abs(ex.maxR - png.w) / Math.max(1, png.w) +
    Math.abs(ex.maxB - png.h) / Math.max(1, png.h);
  if (ePrev <= ePng) return "previewGlobal";
  // For full-page ROI, this is equivalent to "fullPageOffset" and avoids ROI-origin dependence.
  return "pageAbsolute";
}

/**
 * `/analyze_facade` `dimensions[]` → CSS boxes + numeric ids for overlay.
 *
 * **Backend contract**: many services return the same **global preview** coordinates as
 * `Quantitites_Project` `logic_analyze_doors` / `matches` (then we use {@link facadePreviewGlobalToBackend}).
 * Legacy **raster** services return YOLO boxes in pixmap space; use `fullPageOffset` with
 * `bx = roi.x + (dx / fullRasterW) * pageW` when the strategy picker scores that higher. Optional
 * `analysis_image_width` / `height` when the inference grid differs from `image`.
 *
 * Without `mapping.roi`, `x,y,w,h` are treated as already in backend preview space (legacy).
 */
export function facadeDimensionsToScreenBoxes(
  dimensions: FacadeDimension[] | undefined | null,
  metrics: AutoCountPageMetrics,
  mapping?: FacadeDimensionsMappingOptions | null
): { box: AutoCountMatch; id: number }[] {
  if (!Array.isArray(dimensions)) return [];
  const out: { box: AutoCountMatch; id: number }[] = [];
  const roi = mapping?.roi ?? null;
  const pageW = mapping?.backendPageWidth ?? metrics.backendBaseWidth;
  const pageH = mapping?.backendPageHeight ?? metrics.backendBaseHeight;

  const dataUrl =
    mapping?.annotatedImageDataUrl ?? mapping?.response?.image ?? undefined;
  const png = readPngDimensionsFromDataUrl(
    typeof dataUrl === "string" ? dataUrl : undefined
  );
  const aW = mapping?.analysisImageWidth ?? mapping?.response?.analysis_image_width;
  const aH = mapping?.analysisImageHeight ?? mapping?.response?.analysis_image_height;

  type FacadeStrategy =
    | FacadeSpaceStrategy
    | "analysisRaster"
    | "rawLegacy";
  let strategy: FacadeStrategy = "rawLegacy";
  if (roi && dimensions.length > 0) {
    if (typeof aW === "number" && typeof aH === "number" && aW > 0 && aH > 0 && !png) {
      strategy = "analysisRaster";
    } else {
      const roiCoverageW = roi.width / Math.max(1, pageW);
      const roiCoverageH = roi.height / Math.max(1, pageH);
      const isFullPageRoi = roiCoverageW >= 0.92 && roiCoverageH >= 0.92;
      if (isFullPageRoi) {
        strategy =
          pickFacadeSpaceForFullPageRoi(dimensions, pageW, pageH, png) ??
          pickBestFacadeSpace(dimensions, roi, pageW, pageH, png);
      } else {
        strategy = pickBestFacadeSpace(dimensions, roi, pageW, pageH, png);
      }
    }
  } else if (roi) {
    strategy = "rawLegacy";
  }

  if (process.env.NODE_ENV === "development" && typeof console !== "undefined") {
    console.debug("[qto:facade:map]", {
      strategy,
      pageW,
      pageH,
      pngSize: png ? { w: png.w, h: png.h } : null,
      analysisWH:
        typeof aW === "number" && typeof aH === "number" ? { w: aW, h: aH } : null,
      dim0: dimensions[0]
        ? {
            x: dimensions[0].x,
            y: dimensions[0].y,
            w: dimensions[0].w,
            h: dimensions[0].h,
          }
        : null,
    });
  }

  for (const d of dimensions) {
    const x = d.x;
    const y = d.y;
    const wRaw = d.w ?? d.width;
    const hRaw = d.h ?? d.height;
    if (x == null || y == null || wRaw == null || hRaw == null) continue;

    let bx = Number(x);
    let by = Number(y);
    let bw = Number(wRaw);
    let bh = Number(hRaw);

    if (roi) {
      let mapped: { x: number; y: number; w: number; h: number } | null = null;
      if (
        strategy === "analysisRaster" &&
        typeof aW === "number" &&
        typeof aH === "number" &&
        aW > 0 &&
        aH > 0
      ) {
        mapped = facadeCropPngToBackend(d, roi, aW, aH);
      } else if (strategy === "previewGlobal") {
        mapped = facadePreviewGlobalToBackend(d);
      } else if (strategy === "previewRoi") {
        mapped = facadePreviewRoiOffsetToBackend(d, roi);
      } else if (strategy === "fullPageOffset" && png) {
        mapped = facadeFullPageOffsetToBackend(
          d,
          roi,
          png.w,
          png.h,
          pageW,
          pageH
        );
      } else if (strategy === "pageAbsolute" && png) {
        mapped = facadePageAbsoluteToBackend(d, png.w, png.h, pageW, pageH);
      } else if (strategy === "cropPng" && png) {
        mapped = facadeCropPngToBackend(d, roi, png.w, png.h);
      }
      if (mapped) {
        bx = mapped.x;
        by = mapped.y;
        bw = mapped.w;
        bh = mapped.h;
      }
    }

    const row: AutoCountApiMatch = {
      x: bx,
      y: by,
      w: bw,
      h: bh,
      score: 1,
    };
    if (typeof d.item_id === "string" && d.item_id.trim() !== "") {
      (row as { id?: string | number }).id = d.item_id.trim();
    } else if (typeof d.id === "string" && d.id.trim() !== "") {
      (row as { id?: string | number }).id = d.id.trim();
    } else if (typeof d.id === "number" && Number.isFinite(d.id)) {
      (row as { id?: string | number }).id = d.id;
    }
    const screen = backendMatchesToScreen([row], metrics)[0];
    if (
      !screen ||
      !Number.isFinite(screen.w) ||
      !Number.isFinite(screen.h) ||
      screen.w <= 0 ||
      screen.h <= 0
    ) {
      continue;
    }
    const displayId =
      typeof d.id === "number" && Number.isFinite(d.id)
        ? d.id
        : out.length + 1;
    out.push({
      box: screen,
      id: displayId,
    });
  }
  return out;
}

/** Wall `/analyze_walls` segment in CSS px + metadata for labels (see Quantitites_Project `drawOverlay` wall mode). */
export type WallSegmentScreen = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthM: number;
  angleDeg: number;
  /** For `POST /analyze_walls/remove` (when the API provides ids). */
  segmentId?: string | number;
};

type WallSegApi = {
  start: [number, number];
  end: [number, number];
  length_m?: number;
  angle?: number;
  segmentId?: string | number;
};

function normalizeWallPoint(p: unknown): [number, number] | null {
  if (p == null) return null;
  if (Array.isArray(p) && p.length >= 2) {
    const a = Number(p[0]);
    const b = Number(p[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
    return null;
  }
  if (typeof p === "object") {
    const o = p as Record<string, unknown>;
    const ax = o.x ?? o.X;
    const ay = o.y ?? o.Y;
    if (ax !== undefined && ay !== undefined) {
      const a = Number(ax);
      const b = Number(ay);
      if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
    }
  }
  return null;
}

function normalizeWallSegmentItem(raw: unknown): WallSegApi | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const start = normalizeWallPoint(
    o.start ?? o.Start ?? o.from ?? o.From ?? o.a
  );
  const end = normalizeWallPoint(o.end ?? o.End ?? o.to ?? o.To ?? o.b);
  if (!start || !end) return null;
  const lenRaw = o.length_m ?? o.lengthM ?? o.length;
  const len = Number(lenRaw);
  const angleRaw = o.angle ?? o.Angle;
  const idRaw = o.id ?? o.item_id ?? o.ItemId ?? o._id;
  const segmentId =
    idRaw != null && String(idRaw).trim() !== ""
      ? (typeof idRaw === "string" || typeof idRaw === "number"
          ? idRaw
          : String(idRaw))
      : undefined;
  return {
    start,
    end,
    length_m: Number.isFinite(len) ? len : undefined,
    angle: angleRaw !== undefined ? Number(angleRaw) : undefined,
    segmentId,
  };
}

/**
 * Collects segment rows from whichever field the service populated (names vary by backend version).
 */
export function pickWallSegmentsFromResponse(
  response: WallFinderApiResponse
): unknown[] {
  const r = response as unknown as Record<string, unknown>;
  const data = r.data;
  const dataSeg =
    data != null && typeof data === "object"
      ? (data as Record<string, unknown>).segments ??
        (data as Record<string, unknown>).dimensions
      : undefined;
  const nests: unknown[] = [
    response.segments,
    response.dimensions,
    response.wall_segments,
    response.walls,
    r.wall_segments,
    r.walls,
    r.Segments,
    r.Dimensions,
    dataSeg,
  ];
  for (const c of nests) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function looksLikeRoiLocalSpace(segments: WallSegApi[], roi: AutoCountRoi): boolean {
  if (roi.width <= 0 || roi.height <= 0 || segments.length === 0) return false;
  const slack = 3;
  for (const s of segments) {
    for (const pt of [s.start, s.end]) {
      const [x, y] = pt;
      if (
        x < -slack ||
        y < -slack ||
        x > roi.width + slack ||
        y > roi.height + slack
      ) {
        return false;
      }
    }
  }
  return true;
}

function promoteRoiLocalToGlobal(segments: WallSegApi[], roi: AutoCountRoi): WallSegApi[] {
  const { x: ox, y: oy } = roi;
  return segments.map((s) => ({
    ...s,
    start: [s.start[0] + ox, s.start[1] + oy] as [number, number],
    end: [s.end[0] + ox, s.end[1] + oy] as [number, number],
  }));
}

/**
 * Maps API segment endpoints from backend space to CSS px (page box).
 * Coordinates are treated like the legacy viewer: same scale as ROI / auto_count boxes.
 * Accepts raw segment rows ({x,y} points, PascalCase keys, etc.) and optional ROI so local crop-space lines are shifted into page backend space.
 */
export function wallApiSegmentsToScreenDrawItems(
  segments: unknown,
  metrics: AutoCountPageMetrics,
  roi?: AutoCountRoi | null
): WallSegmentScreen[] {
  const raw = Array.isArray(segments) ? segments : [];
  const normalized: WallSegApi[] = [];
  for (const item of raw) {
    const seg = normalizeWallSegmentItem(item);
    if (seg) normalized.push(seg);
  }
  if (normalized.length === 0) return [];

  let model = normalized;
  if (roi && looksLikeRoiLocalSpace(model, roi)) {
    model = promoteRoiLocalToGlobal(model, roi);
  }

  const { fx, fy } = scaleFactorsXY(metrics);
  return model.map((seg) => {
    const len =
      seg.length_m != null && Number.isFinite(seg.length_m) ? seg.length_m : 0;
    return {
      x1: seg.start[0] * fx,
      y1: seg.start[1] * fy,
      x2: seg.end[0] * fx,
      y2: seg.end[1] * fy,
      lengthM: len,
      angleDeg: Number(seg.angle ?? 0),
      segmentId: seg.segmentId,
    };
  });
}

/**
 * Full `/analyze_walls` response → overlay segments (handles alternate JSON shapes).
 */
export function wallFinderResponseToScreenDrawItems(
  response: WallFinderApiResponse,
  metrics: AutoCountPageMetrics,
  roi: AutoCountRoi
): WallSegmentScreen[] {
  const raw = pickWallSegmentsFromResponse(response);
  return wallApiSegmentsToScreenDrawItems(raw, metrics, roi);
}

/** One room polygon in CSS px for canvas overlay (`analyze_rooms`). */
export type RoomPolygonScreen = {
  cssPoly: { x: number; y: number }[];
  centerX: number;
  centerY: number;
  areaM2: number;
  /** For `POST /analyze_rooms/remove` when the API provides ids. */
  roomId?: string | number;
};

function normalizeRoomPoint(p: unknown): { x: number; y: number } | null {
  if (p == null || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const x = Number(o.x ?? o.X);
  const y = Number(o.y ?? o.Y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** Shoelace area in backend pixel units (same space as ROI / polygon vertices). */
function polygonAreaAbsBackendPx2(
  pts: { x: number; y: number }[]
): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const a = pts[i]!;
    const b = pts[j]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * `/analyze_rooms` room rows → filled polygons in CSS px (same backend scale as ROI).
 *
 * Polygons from the shared backend are already page-global in pdf.js viewport space
 * at {@link BACKEND_PDF_VIEWPORT_SCALE} (see Quantitites_Project `logic_analyze_rooms`,
 * which adds crop offsets before responding). They must not be shifted by ROI again.
 */
export function roomFinderResponseToScreenPolygons(
  response: RoomFinderApiResponse,
  metrics: AutoCountPageMetrics,
  pixelToMeter: number = ROOM_FINDER_DEFAULT_PIXEL_TO_METER
): RoomPolygonScreen[] {
  const rows = pickRoomRowsFromResponse(response);
  const { fx, fy } = scaleFactorsXY(metrics);
  const mpx =
    Number.isFinite(pixelToMeter) && pixelToMeter > 0
      ? pixelToMeter
      : ROOM_FINDER_DEFAULT_PIXEL_TO_METER;
  const out: RoomPolygonScreen[] = [];

  for (const row of rows) {
    const polyRaw = row.polygon;
    if (!Array.isArray(polyRaw) || polyRaw.length < 3) continue;
    const rowRec = row as unknown as Record<string, unknown>;
    const idRaw = rowRec.id ?? rowRec.item_id ?? rowRec.ItemId ?? rowRec._id;
    const roomId =
      idRaw != null && String(idRaw).trim() !== ""
        ? typeof idRaw === "string" || typeof idRaw === "number"
          ? idRaw
          : String(idRaw)
        : undefined;
    const pts: { x: number; y: number }[] = [];
    for (const pt of polyRaw) {
      const p = normalizeRoomPoint(pt);
      if (p) pts.push(p);
    }
    if (pts.length < 3) continue;

    const cxPoly = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
    const cyPoly = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;
    let centerBx = cxPoly;
    let centerBy = cyPoly;
    if (
      row.center &&
      Number.isFinite(row.center.x) &&
      Number.isFinite(row.center.y)
    ) {
      centerBx = row.center.x;
      centerBy = row.center.y;
    }

    const fromApi = readRoomAreaM2FromRow(row);
    const px2 = polygonAreaAbsBackendPx2(pts);
    let areaM =
      fromApi != null && Number.isFinite(fromApi) && fromApi > 0
        ? fromApi
        : px2 * mpx * mpx;
    if (!Number.isFinite(areaM) || areaM < 0) {
      areaM = 0;
    }
    out.push({
      cssPoly: pts.map((p) => ({ x: p.x * fx, y: p.y * fy })),
      centerX: centerBx * fx,
      centerY: centerBy * fy,
      areaM2: areaM,
      roomId,
    });
  }
  return out;
}
