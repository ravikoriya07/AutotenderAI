"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type EditorToolbarTooltipProps = {
  label: string;
  /** Optional keyboard hint, e.g. "Ctrl+Z" */
  shortcut?: string;
  children: ReactNode;
};

/**
 * Tooltip for draft editor toolbar buttons. Uses fixed positioning + portal
 * so labels are not clipped by overflow-hidden ancestors.
 */
export function EditorToolbarTooltip({
  label,
  shortcut,
  children,
}: EditorToolbarTooltipProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  const tooltip =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateX(-50%)",
            }}
            className="pointer-events-none z-[9999] flex flex-col items-center"
          >
            <span
              className="mb-px h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-foreground"
              aria-hidden
            />
            <span className="whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium leading-none text-background shadow-lg ring-1 ring-black/10">
              {label}
              {shortcut ? (
                <span className="ml-2 inline-flex items-center rounded border border-background/25 bg-background/15 px-1.5 py-0.5 font-mono text-[10px] font-normal text-background/90">
                  {shortcut}
                </span>
              ) : null}
            </span>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={anchorRef}
        className="relative flex shrink-0"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
        }}
      >
        {children}
      </div>
      {tooltip}
    </>
  );
}
