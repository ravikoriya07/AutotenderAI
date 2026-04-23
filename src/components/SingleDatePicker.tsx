"use client";

import { useState, useRef, useEffect } from "react";
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

  const date = toDate(value || "");
  const range = {
    startDate: date,
    endDate: date,
    key: "selection",
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[min(420px,85vh)] max-w-[min(320px,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-border bg-card p-3 shadow-lg">
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
        </div>
      )}
    </div>
  );
}
