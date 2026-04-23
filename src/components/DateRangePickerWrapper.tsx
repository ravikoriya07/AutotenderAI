"use client";

import { useState, useRef, useEffect } from "react";
import { DateRangePicker } from "react-date-range";
import {
  defaultStaticRanges,
  defaultInputRanges,
} from "react-date-range";
import { enGB } from "date-fns/locale/en-GB";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

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
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface DateRangePickerWrapperProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  className?: string;
}

export function DateRangePickerWrapper({
  startDate,
  endDate,
  onRangeChange,
  className,
}: DateRangePickerWrapperProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const start = toDate(startDate || endDate);
  const end = toDate(endDate || startDate);
  const range = {
    startDate: start,
    endDate: end,
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

  const handleChange = (ranges: { selection?: { startDate: Date; endDate: Date } }) => {
    const sel = ranges.selection;
    if (!sel?.startDate || !sel?.endDate) return;
    onRangeChange(toYYYYMMDD(sel.startDate), toYYYYMMDD(sel.endDate));
  };

  const displayStart = toDisplayDate(startDate);
  const displayEnd = toDisplayDate(endDate);
  const placeholder = "dd / mm / yyyy";

  return (
    <div ref={ref} className={cn("relative flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
      <label className="shrink-0 text-sm text-muted-foreground">Date</label>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            readOnly
            type="text"
            value={displayStart}
            placeholder={placeholder}
            onClick={() => setOpen(true)}
            className="h-9 w-full min-w-24 rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring sm:w-35 sm:flex-none"
          />
          <Calendar className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <span className="shrink-0 text-muted-foreground">–</span>
        <div className="relative min-w-0 flex-1">
          <input
            readOnly
            type="text"
            value={displayEnd}
            placeholder={placeholder}
            onClick={() => setOpen(true)}
            className="h-9 w-full min-w-24 rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring sm:w-35 sm:flex-none"
          />
          <Calendar className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[min(420px,85vh)] max-w-[min(520px,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="text-xs">
            <DateRangePicker
              ranges={[range]}
              onChange={handleChange}
              months={1}
              direction="horizontal"
              showSelectionPreview
              moveRangeOnFirstSelection={false}
              staticRanges={defaultStaticRanges}
              inputRanges={defaultInputRanges}
              rangeColors={["hsl(var(--primary))"]}
              locale={enGB}
            />
          </div>
        </div>
      )}
    </div>
  );
}
