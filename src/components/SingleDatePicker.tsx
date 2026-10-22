"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "react-date-range";
import { enGB } from "date-fns/locale/en-GB";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

const EN_GB_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

function toDate(s: string): Date {
  if (!s?.trim()) return new Date();
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDisplayDate(s: string): string {
  if (!s?.trim()) return "";
  const d = new Date(s.trim());
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", EN_GB_DATE_OPTIONS);
}

export interface SingleDatePickerProps {
  /** Value in Y-m-d format or empty string for no date */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Single-date picker using react-date-range for UI consistency with DateRangePickerWrapper.
 * Output is always Y-m-d; use empty string for "no date" (send "N/A" in API if needed).
 */
export function SingleDatePicker({
  value,
  onChange,
  disabled = false,
  id,
  placeholder = "Select date",
  className,
}: SingleDatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const date = toDate(value || "");
  const range = {
    startDate: date,
    endDate: date,
    key: "selection",
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const popup = popupRef.current;
    const anchor = ref.current;
    if (!popup || !anchor) return;

    function place() {
      if (!popup || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      let left = rect.left;
      if (left + width > window.innerWidth - margin) {
        left = window.innerWidth - width - margin;
      }
      if (left < margin) left = margin;
      const below = rect.bottom + 4;
      const above = rect.top - height - 4;
      const top =
        below + height <= window.innerHeight - margin || below <= above
          ? below
          : Math.max(margin, above);
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
      popup.style.visibility = "visible";
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const handleChange = (date: Date) => {
    onChange(toYYYYMMDD(date));
    setOpen(false);
  };

  const displayValue = toDisplayDate(value);

  const minDate = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <input
        id={id}
        readOnly
        type="text"
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !displayValue && "text-muted-foreground"
        )}
      />
      <CalendarIcon className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[80] w-max rounded-lg border border-border bg-card p-3 shadow-xl"
            style={{ visibility: "hidden" }}
          >
            <div className="text-xs">
              <Calendar
                ranges={[range]}
                onChange={handleChange}
                showDateDisplay={false}
                displayMode="date"
                months={1}
                direction="horizontal"
                showSelectionPreview
                locale={enGB}
                color="hsl(var(--primary))"
                rangeColors={["hsl(var(--primary))"]}
                minDate={minDate}
              />
            </div>
            <div className="mt-2 flex justify-end border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
              >
                Clear
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
