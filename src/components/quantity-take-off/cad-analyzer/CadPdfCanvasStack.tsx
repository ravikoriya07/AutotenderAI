"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCadAnalyzerTool } from "@/contexts/CadAnalyzerToolContext";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

/** Avoid GPU/memory blowups on extreme zoom. */
const MAX_CANVAS_EDGE_PX = 8192;
const MAX_BASE_FIT = 4;

type PdfPageRowProps = {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  maxWidth: number;
  /** User zoom multiplier (1 = fit width). Baked into pdf.js render scale — not CSS scale — for sharp text. */
  zoomScale: number;
};

/**
 * Single page: PDF raster on bottom canvas, transparent overlay on top (matches `abc.html` canvas-stack).
 * Renders at `fitToWidth * zoomScale` so zooming in re-rasters at higher resolution instead of upscaling one bitmap.
 */
function PdfPageRow({ pdfDoc, pageNumber, maxWidth, zoomScale }: PdfPageRowProps) {
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (maxWidth <= 0) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let page: PDFPageProxy | null = null;

    void (async () => {
      try {
        page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !page) return;

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

        const octx = overlay.getContext("2d");
        if (octx) {
          octx.setTransform(1, 0, 0, 1, 0, 0);
          octx.clearRect(0, 0, w, h);
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
  }, [pdfDoc, pageNumber, maxWidth, zoomScale]);

  return (
    <div className="relative mx-auto block w-max max-w-full">
      <canvas ref={pdfRef} className="block bg-white shadow-sm" />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute left-0 top-0 block"
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

type CadPdfCanvasStackProps = {
  pdfBlob: Blob;
  className?: string;
};

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;

/**
 * Pan & zoom: zoom is baked into pdf.js render resolution (sharp). Wrapper uses translate only.
 * Wheel uses capture + non-passive so scroll-zoom works over nested content.
 */
export function CadPdfCanvasStack({ pdfBlob, className }: CadPdfCanvasStackProps) {
  const { tool } = useCadAnalyzerTool();
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

  /** First layout after PDF paints */
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

  const cursorClass =
    tool === "hand"
      ? isDragging
        ? "cursor-grabbing"
        : "cursor-grab"
      : "cursor-crosshair";

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
          <div className="canvas-stack flex flex-col items-center gap-0 py-2 leading-none shadow-xl">
            {Array.from({ length: pdfDoc.numPages }, (_, i) => (
              <PdfPageRow
                key={i + 1}
                pdfDoc={pdfDoc}
                pageNumber={i + 1}
                maxWidth={maxWidth}
                zoomScale={transform.scale}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-[120px] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
