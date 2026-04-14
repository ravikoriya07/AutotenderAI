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
  backendRoiToScreenCss,
  type AutoCountPageMetrics,
} from "@/lib/autoCountCoordinates";
import type { AutoCountBackendState } from "@/lib/qtoAutoCountStorage";
import type { AutoCountMatch } from "@/services/autoCountService";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

/** Avoid GPU/memory blowups on extreme zoom. */
const MAX_CANVAS_EDGE_PX = 8192;
const MAX_BASE_FIT = 4;

export type AutoCountRoiCss = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CssRect = { x: number; y: number; width: number; height: number };

type PageAnnotationLayer = {
  committedRoi: CssRect | null;
  draftRoi: CssRect | null;
  matches: AutoCountMatch[];
  /** Stronger strokes when a saved object is selected in the metadata panel */
  emphasize?: boolean;
};

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

  if (layer.committedRoi) {
    const r = layer.committedRoi;
    octx.strokeStyle = emph ? "#d97706" : "#2563eb";
    octx.lineWidth = emph
      ? Math.max(2.5, 3 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.setLineDash([]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.lineWidth = Math.max(1.5, 2 / (window.devicePixelRatio || 1));
  }
  if (layer.draftRoi) {
    const r = layer.draftRoi;
    octx.strokeStyle = "#60a5fa";
    octx.setLineDash([6, 4]);
    octx.strokeRect(r.x * sx, r.y * sy, r.width * sx, r.height * sy);
    octx.setLineDash([]);
  }
  for (const m of layer.matches) {
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
    octx.fillStyle = emph ? "rgba(217, 119, 6, 0.28)" : "rgba(124, 58, 237, 0.22)";
    octx.fillRect(mx, my, mw, mh);
    octx.strokeStyle = emph ? "#b45309" : "#6d28d9";
    octx.lineWidth = emph
      ? Math.max(2, 2.5 / (window.devicePixelRatio || 1))
      : Math.max(1.5, 2 / (window.devicePixelRatio || 1));
    octx.strokeRect(mx, my, mw, mh);
  }
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
  }, [autoCountLayer]);

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
  /** Controlled ROI in CSS px relative to the page box; null = none */
  autoCountRoi?: AutoCountRoiCss | null;
  onAutoCountRoiChange?: (roi: AutoCountRoiCss | null) => void;
  /** Last analyze in backend space; overlay reprojects to CSS when layout/zoom changes */
  autoCountBackend?: AutoCountBackendState | null;
  /** Thicker amber emphasis when a saved object is selected (metadata panel) */
  emphasizeAutoCountHighlight?: boolean;
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
    autoCountBackend = null,
    emphasizeAutoCountHighlight = false,
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

  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (tool !== "hand" || e.button !== 0) return;
      e.preventDefault();
      const prev = transformRef.current;
      panStartRef.current = {
        startX: e.clientX - prev.pointX,
        startY: e.clientY - prev.pointY,
      };
      setIsDragging(true);
    },
    [tool]
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
    if (!d || !onAutoCountRoiChange) return;
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
    onAutoCountRoiChange({
      pageNumber: d.pageIndex + 1,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  }, [onAutoCountRoiChange]);

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

  const onAutoCountPointerDown = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      if (tool !== "autoCount") return;
      e.preventDefault();
      e.stopPropagation();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const pageIndex = findPageIndex(clientX, clientY);
      if (pageIndex < 0) return;
      const local = clientToPageLocal(clientX, clientY, pageIndex);
      roiDragRef.current = {
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
    [tool, findPageIndex, clientToPageLocal]
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

  const cursorClass =
    tool === "hand"
      ? isDragging
        ? "cursor-grabbing"
        : "cursor-grab"
      : tool === "autoCount"
        ? "cursor-crosshair"
        : "cursor-default";

  const numPages = pdfDoc?.numPages ?? 0;

  const layerForPage = useCallback(
    (pageNumber: number): PageAnnotationLayer => {
      const idx = pageNumber - 1;
      const metrics = pageMetricsRef.current.get(pageNumber);

      let committed: CssRect | null = null;
      if (autoCountRoi?.pageNumber === pageNumber) {
        committed = {
          x: autoCountRoi.x,
          y: autoCountRoi.y,
          width: autoCountRoi.width,
          height: autoCountRoi.height,
        };
      } else if (
        autoCountBackend &&
        autoCountBackend.pageNumber === pageNumber &&
        metrics &&
        autoCountBackend.roi.width > 0 &&
        autoCountBackend.roi.height > 0
      ) {
        committed = backendRoiToScreenCss(autoCountBackend.roi, metrics);
      }

      const draft =
        draftRoi?.pageIndex === idx ? draftRoi.rect : null;

      let matches: AutoCountMatch[] = [];
      if (
        autoCountBackend &&
        autoCountBackend.pageNumber === pageNumber &&
        metrics
      ) {
        matches = backendMatchesToScreen(
          autoCountBackend.matches,
          metrics
        );
      }

      return {
        committedRoi: committed,
        draftRoi: draft,
        matches,
        emphasize: emphasizeAutoCountHighlight,
      };
    },
    [autoCountRoi, autoCountBackend, draftRoi, metricsTick, emphasizeAutoCountHighlight]
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
            {tool === "autoCount" ? (
              <div
                className="absolute inset-0 z-20 bg-transparent"
                style={{ pointerEvents: "auto" }}
                onMouseDown={onAutoCountPointerDown}
                onTouchStart={onAutoCountPointerDown}
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
