"use client";

import { useMemo } from "react";
import { Copy, FileText } from "lucide-react";
import { MarkdownRenderer } from "@/components/bid-writing/MarkdownRenderer";
import {
  toolHeaderLabel,
  toolRunningMessage,
} from "@/lib/bid-writing/bidToolUtils";
import { normalizeToolOutputMarkdown } from "@/lib/bid-writing/markdownToolOutput";
import { cn } from "@/lib/utils";

function ToolOutputDots() {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
    </span>
  );
}

export function ToolOutputLoader({ toolId }: { toolId: string | null }) {
  return (
    <div
      className="flex min-h-[8rem] flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={toolRunningMessage(toolId)}
    >
      <ToolOutputDots />
      <p className="text-sm italic text-muted-foreground">{toolRunningMessage(toolId)}</p>
    </div>
  );
}

type ToolOutputHeaderProps = {
  activeTool: string | null;
  toolOutput: string | null;
  toolStreaming?: boolean;
  onCopy?: () => void;
  className?: string;
};

export function ToolOutputHeader({
  activeTool,
  toolOutput,
  toolStreaming = false,
  onCopy,
  className,
}: ToolOutputHeaderProps) {
  const canCopy = Boolean(toolOutput?.trim());
  const headerTool =
    activeTool && (toolStreaming || canCopy) ? toolHeaderLabel(activeTool) : null;

  return (
    <div
      className={cn(
        "flex shrink-0 select-none items-start justify-between gap-3 border-b border-border bg-card/50 px-3 py-2",
        className
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Tool Output
      </span>
      <div className="flex min-w-0 flex-col items-end gap-1">
        {canCopy && onCopy && (
          <button
            type="button"
            onClick={() => void onCopy()}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-3 w-3 shrink-0" aria-hidden />
            Copy
          </button>
        )}
        {headerTool && (
          <span className="max-w-[10rem] truncate text-right text-[10px] font-medium uppercase italic tracking-wide text-muted-foreground">
            {headerTool}
          </span>
        )}
      </div>
    </div>
  );
}

type ToolOutputBodyProps = {
  activeTool: string | null;
  toolStreaming: boolean;
  toolOutput: string | null;
  contentClassName?: string;
  /** Align output headings with selection/draft context (legacy drafts.js behavior). */
  targetHeadingLevel?: number;
  sourceLabelBySeq?: ReadonlyMap<number, string>;
};

export function ToolOutputBody({
  activeTool,
  toolStreaming,
  toolOutput,
  contentClassName,
  targetHeadingLevel = 0,
  sourceLabelBySeq,
}: ToolOutputBodyProps) {
  const hasOutput = Boolean(toolOutput?.trim());

  const markdownContent = useMemo(() => {
    if (!hasOutput) return "";
    return normalizeToolOutputMarkdown(toolOutput!, targetHeadingLevel);
  }, [hasOutput, toolOutput, targetHeadingLevel]);

  if (toolStreaming && !hasOutput) {
    return <ToolOutputLoader toolId={activeTool} />;
  }

  if (hasOutput) {
    return (
      <div
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6",
          contentClassName
        )}
      >
        <MarkdownRenderer
          content={markdownContent}
          className="text-sm leading-relaxed text-foreground"
          sourceLabelBySeq={sourceLabelBySeq}
        />
        {toolStreaming && (
          <span
            className="mt-1 inline-block h-4 w-0.5 animate-pulse bg-primary"
            aria-hidden
          />
        )}
      </div>
    );
  }

  if (!toolStreaming) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
          <FileText className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <p className="max-w-[14rem] text-sm text-muted-foreground">
          Run a tool on the left to see the output here.
        </p>
      </div>
    );
  }

  return null;
}
