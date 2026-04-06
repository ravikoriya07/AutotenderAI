import { Check, Loader2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepRuntime } from "@/lib/processingPipelineConfig";

type StepItemProps = {
  step: StepRuntime;
  /** Strong highlight for the in-progress step */
  isActive?: boolean;
};

export function StepItem({ step, isActive }: StepItemProps) {
  const { status, name, id, message } = step;
  const active = Boolean(isActive && status === "processing");

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/80 bg-card px-3 py-3 text-sm shadow-sm transition-[border-color,box-shadow,background-color]",
        status === "processing" && "border-primary/45 bg-primary/[0.06]",
        active &&
          "ring-2 ring-primary/35 ring-offset-2 ring-offset-background shadow-md",
        status === "error" && "border-destructive/45 bg-destructive/[0.06]"
      )}
    >
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {status === "pending" && (
          <Circle className="h-4 w-4 text-muted-foreground/40" aria-hidden />
        )}
        {status === "processing" && (
          <Loader2
            className="h-4 w-4 animate-spin text-primary"
            aria-label="Processing"
          />
        )}
        {status === "completed" && (
          <Check className="h-4 w-4 text-green-600" aria-hidden />
        )}
        {status === "error" && (
          <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">
          <span className="text-muted-foreground">Step {id}.</span> {name}
        </p>
        {message ? (
          <p
            className={cn(
              "mt-1 text-xs",
              status === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
