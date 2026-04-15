import type { AutoCountMatch, AutoCountRoi } from "@/services/autoCountService";
import type { WallFinderApiResponse } from "@/services/wallFinderService";
import type { RoomFinderApiResponse } from "@/services/roomFinderService";
import { pickRoomRowsFromResponse } from "@/services/roomFinderService";

/** Raw `/auto_count` match row (backend may use w/h or width/height). */
export type AutoCountApiMatch = {
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
  matches: AutoCountApiMatch[],
  metrics: AutoCountPageMetrics
): AutoCountMatch[] {
  const { fx, fy } = scaleFactorsXY(metrics);
  return matches.map((m) => {
    const { w, h } = pickWH(m);
    const scoreRaw = m.score ?? m.confidence ?? 0;
    return {
      x: Number(m.x) * fx,
      y: Number(m.y) * fy,
      w: w * fx,
      h: h * fy,
      score: Number(scoreRaw),
    };
  });
}

/** Wall `/analyze_walls` segment in CSS px + metadata for labels (see Quantitites_Project `drawOverlay` wall mode). */
export type WallSegmentScreen = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lengthM: number;
  angleDeg: number;
};

type WallSegApi = {
  start: [number, number];
  end: [number, number];
  length_m?: number;
  angle?: number;
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
  return {
    start,
    end,
    length_m: Number.isFinite(len) ? len : undefined,
    angle: angleRaw !== undefined ? Number(angleRaw) : undefined,
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
};

function normalizeRoomPoint(p: unknown): { x: number; y: number } | null {
  if (p == null || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const x = Number(o.x ?? o.X);
  const y = Number(o.y ?? o.Y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function polygonLooksRoiLocal(
  pts: { x: number; y: number }[],
  roi: AutoCountRoi
): boolean {
  if (roi.width <= 0 || roi.height <= 0 || pts.length === 0) return false;
  const slack = 3;
  for (const p of pts) {
    if (
      p.x < -slack ||
      p.y < -slack ||
      p.x > roi.width + slack ||
      p.y > roi.height + slack
    ) {
      return false;
    }
  }
  return true;
}

function promotePolygonLocalToGlobal(
  pts: { x: number; y: number }[],
  roi: AutoCountRoi
): { x: number; y: number }[] {
  const { x: ox, y: oy } = roi;
  return pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

/**
 * `/analyze_rooms` room rows → filled polygons in CSS px (same backend scale as ROI).
 */
export function roomFinderResponseToScreenPolygons(
  response: RoomFinderApiResponse,
  metrics: AutoCountPageMetrics,
  roi: AutoCountRoi
): RoomPolygonScreen[] {
  const rows = pickRoomRowsFromResponse(response);
  const { fx, fy } = scaleFactorsXY(metrics);
  const out: RoomPolygonScreen[] = [];

  for (const row of rows) {
    const polyRaw = row.polygon;
    if (!Array.isArray(polyRaw) || polyRaw.length < 3) continue;
    let pts: { x: number; y: number }[] = [];
    for (const pt of polyRaw) {
      const p = normalizeRoomPoint(pt);
      if (p) pts.push(p);
    }
    if (pts.length < 3) continue;
    if (polygonLooksRoiLocal(pts, roi)) {
      pts = promotePolygonLocalToGlobal(pts, roi);
    }
    const sx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const sy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const areaM =
      row.area_m2 != null && Number.isFinite(row.area_m2) ? row.area_m2 : 0;
    out.push({
      cssPoly: pts.map((p) => ({ x: p.x * fx, y: p.y * fy })),
      centerX: sx * fx,
      centerY: sy * fy,
      areaM2: areaM,
    });
  }
  return out;
}
