"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SlideoverPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
};

/** Right-side enterprise slideover — used for detail views and forms. */
export function SlideoverPanel({
  open,
  title,
  onClose,
  children,
  widthClassName = "max-w-[280px] sm:max-w-[320px]",
}: SlideoverPanelProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity",
          open ? "opacity-100" : "pointer-events-none invisible opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out",
          widthClassName,
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!open}
        role="dialog"
        aria-modal={open}
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <h2 className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
      </aside>
    </>
  );
}
