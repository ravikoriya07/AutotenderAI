declare module "react-date-range" {
  import type { ComponentType } from "react";

  export interface Range {
    startDate: Date;
    endDate: Date;
    key?: string;
  }

  export interface DateRangePickerProps {
    ranges: Range[];
    onChange?: (ranges: { selection: Range }) => void;
    months?: number;
    direction?: "horizontal" | "vertical";
    showSelectionPreview?: boolean;
    moveRangeOnFirstSelection?: boolean;
    staticRanges?: unknown[];
    inputRanges?: unknown[];
    rangeColors?: string[];
    className?: string;
    locale?: { code: string; options?: { weekStartsOn?: number } };
  }

  export interface CalendarProps {
    ranges: Range[];
    onChange?: (date: Date) => void;
    showDateDisplay?: boolean;
    displayMode?: "date" | "dateRange";
    locale?: { code: string; options?: { weekStartsOn?: number } };
    months?: number;
    direction?: "horizontal" | "vertical";
    showSelectionPreview?: boolean;
    color?: string;
    rangeColors?: string[];
    className?: string;
    minDate?: Date;
    maxDate?: Date;
  }

  export const DateRangePicker: ComponentType<DateRangePickerProps>;
  export const Calendar: ComponentType<CalendarProps>;
  export const defaultStaticRanges: unknown[];
  export const defaultInputRanges: unknown[];
  export const createStaticRanges: (ranges: unknown[]) => unknown[];
}
