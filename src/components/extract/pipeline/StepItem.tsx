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
        "flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors",
        status === "processing" && "border-primary/50 bg-primary/5",
        active &&
          "ring-2 ring-primary/40 ring-offset-2 ring-offset-background shadow-sm",
        status === "error" && "border-destructive/50 bg-destructive/5"
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
