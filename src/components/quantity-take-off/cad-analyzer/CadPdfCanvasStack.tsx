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

type PdfPageRowProps = {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  maxWidth: number;
};

/**
 * Single page: PDF raster on bottom canvas, transparent overlay on top (matches `abc.html` canvas-stack).
 */
function PdfPageRow({ pdfDoc, pageNumber, maxWidth }: PdfPageRowProps) {
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
        const fitScale = Math.min(maxWidth / base.width, 4);
        const viewport = page.getViewport({ scale: fitScale });
        const outputScale = window.devicePixelRatio || 1;

        const canvas = pdfRef.current;
        const overlay = overlayRef.current;
        if (!canvas || !overlay) return;

        const w = Math.floor(viewport.width * outputScale);
        const h = Math.floor(viewport.height * outputScale);
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
  }, [pdfDoc, pageNumber, maxWidth]);

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

/**
 * Pan & zoom matches `Quantitites_Project/static/script.js` + `style.css` (.zoom-container / .zoom-content):
 * wheel zooms toward cursor; hand tool pans by dragging.
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
  /** Matches script.js: startX = clientX - pointX, then pointX = clientX - startX */
  const panStartRef = useRef({ startX: 0, startY: 0 });

  const resetZoomToFit = useCallback(() => {
    const zc = zoomContainerRef.current;
    const zcontent = zoomContentRef.current;
    if (!zc || !zcontent) return;
    const containerW = zc.clientWidth;
    const containerH = zc.clientHeight;
    const contentW = zcontent.offsetWidth;
    const contentH = zcontent.offsetHeight;
    if (containerW === 0 || containerH === 0 || contentW === 0 || contentH === 0) {
      return;
    }
    const scale = Math.min(
      (containerW - 40) / contentW,
      (containerH - 40) / contentH,
      1
    );
    setTransform({
      scale,
      pointX: (containerW - contentW * scale) / 2,
      pointY: (containerH - contentH * scale) / 2,
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

  /** First layout after PDF paints — `resetZoom(imgW, imgH)` in script.js; debounce so async page renders finish. */
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
      const rect = zc.getBoundingClientRect();
      const prev = transformRef.current;
      const xs = (e.clientX - rect.left - prev.pointX) / prev.scale;
      const ys = (e.clientY - rect.top - prev.pointY) / prev.scale;
      const newScale = Math.min(
        Math.max(prev.scale * (e.deltaY > 0 ? 0.9 : 1.1), 0.1),
        10
      );
      setTransform({
        scale: newScale,
        pointX: e.clientX - rect.left - xs * newScale,
        pointY: e.clientY - rect.top - ys * newScale,
      });
    };

    zc.addEventListener("wheel", onWheel, { passive: false });
    return () => zc.removeEventListener("wheel", onWheel);
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
        "relative h-full w-full min-h-0 touch-none overflow-hidden bg-zinc-100/90",
        cursorClass,
        className
      )}
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
              transform: `translate(${transform.pointX}px, ${transform.pointY}px) scale(${transform.scale})`,
              /* Match script.js `updateTransform`; omit transition so wheel zoom stays responsive */
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
