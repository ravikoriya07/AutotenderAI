"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-50 my-auto w-full max-h-[min(90dvh,720px)] max-w-lg overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:p-6",
          className
        )}
      >
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          {title && (
            <h2 className="min-w-0 flex-1 pr-2 text-lg font-semibold">{title}</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
