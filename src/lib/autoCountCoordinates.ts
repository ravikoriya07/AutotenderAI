import type { AutoCountMatch, AutoCountRoi } from "@/services/autoCountService";

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
