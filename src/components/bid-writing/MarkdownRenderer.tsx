"use client";

import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { injectSourceReferences } from "@/components/bid-writing/injectSourceReferences";
import { cn } from "@/lib/utils";

function isLikelyBlockCode(className: string | undefined, children: ReactNode): boolean {
  if (/\blanguage-[\w-]+\b/.test(className ?? "")) return true;
  const text = typeof children === "string" ? children : "";
  return text.includes("\n") && text.trim().length > 0;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 scroll-mt-20 border-b border-border pb-1.5 text-lg font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 scroll-mt-20 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 scroll-mt-20 text-sm font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-2 mb-1 text-sm font-medium text-foreground first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-[3px] border-primary/50 bg-muted/40 py-1 pl-3 text-sm italic leading-relaxed text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border" />,
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 list-disc space-y-1 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 list-decimal space-y-1 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 [&>p]:mb-1 [&>p:last-child]:mb-0">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words font-medium text-primary underline underline-offset-2 hover:text-primary/90"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 w-full max-w-full overflow-x-auto rounded-lg border border-border bg-card/30">
      <table className="w-full min-w-[min(100%,20rem)] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border bg-muted/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-muted/40">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="break-words px-3 py-2 align-top text-sm text-foreground [overflow-wrap:anywhere]">{children}</td>
  ),
  pre: ({ children }) => (
    <pre className="my-3 max-h-[min(70vh,28rem)] overflow-auto rounded-lg border border-border bg-muted/70 p-3 text-xs leading-relaxed [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const blockLike = isLikelyBlockCode(className, children);
    if (!blockLike) {
      return (
        <code
          className={cn(
            "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-normal text-foreground [overflow-wrap:anywhere]",
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("block min-w-0 whitespace-pre font-mono text-xs leading-relaxed text-foreground", className)} {...props}>
        {children}
      </code>
    );
  },
  img: ({ src, alt }) =>
    src ? (
      <span className="my-3 block max-w-full overflow-hidden rounded-lg border border-border bg-muted/30">
        {/* Markdown images: URLs are not optimized through next/image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          className="h-auto max-h-[min(50vh,24rem)] w-full max-w-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </span>
    ) : null,
};

function createMarkdownComponents(
  sourceLabelBySeq?: ReadonlyMap<number, string>
): Components {
  if (!sourceLabelBySeq?.size) return markdownComponents;

  const inj = (children: ReactNode) => injectSourceReferences(children, sourceLabelBySeq);

  return {
    ...markdownComponents,
    h1: ({ children }) => (
      <h1 className="mt-4 mb-2 scroll-mt-20 border-b border-border pb-1.5 text-lg font-bold tracking-tight text-foreground first:mt-0">
        {inj(children)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 mb-2 scroll-mt-20 text-base font-semibold tracking-tight text-foreground first:mt-0">
        {inj(children)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 mb-1.5 scroll-mt-20 text-sm font-semibold text-foreground first:mt-0">{inj(children)}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0">{inj(children)}</h4>
    ),
    h5: ({ children }) => (
      <h5 className="mt-2 mb-1 text-sm font-medium text-foreground first:mt-0">{inj(children)}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
        {inj(children)}
      </h6>
    ),
    p: ({ children }) => (
      <p className="mb-3 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] last:mb-0">{inj(children)}</p>
    ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{inj(children)}</strong>,
    em: ({ children }) => <em className="italic text-foreground">{inj(children)}</em>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-[3px] border-primary/50 bg-muted/40 py-1 pl-3 text-sm italic leading-relaxed text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0">
        {inj(children)}
      </blockquote>
    ),
    li: ({ children }) => <li className="pl-1 [&>p]:mb-1 [&>p:last-child]:mb-0">{inj(children)}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words font-medium text-primary underline underline-offset-2 hover:text-primary/90"
      >
        {inj(children)}
      </a>
    ),
    th: ({ children }) => (
      <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {inj(children)}
      </th>
    ),
    td: ({ children }) => (
      <td className="break-words px-3 py-2 align-top text-sm text-foreground [overflow-wrap:anywhere]">{inj(children)}</td>
    ),
  };
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Map of library `seq` → project name for inline `[n]` citation hovers. */
  sourceLabelBySeq?: ReadonlyMap<number, string>;
}

export function MarkdownRenderer({
  content,
  className,
  sourceLabelBySeq,
}: MarkdownRendererProps) {
  const components = useMemo(
    () => createMarkdownComponents(sourceLabelBySeq),
    [sourceLabelBySeq]
  );

  return (
    <div className={cn("markdown-tool-output min-w-0 max-w-full text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
