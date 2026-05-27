import { cn } from "@/lib/utils";

type ProgressIndicatorProps = {
  percent: number;
  className?: string;
};

export function ProgressIndicator({ percent, className }: ProgressIndicatorProps) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="presentation"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
