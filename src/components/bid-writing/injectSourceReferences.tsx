"use client";

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  parseSourceReferenceSeqs,
  resolveSourceLabels,
  SOURCE_REFERENCE_PATTERN,
} from "@/lib/bid-writing/sourceReferences";
import { SourceReferenceBadge } from "@/components/bid-writing/SourceReferenceBadge";

function splitTextWithSourceRefs(
  text: string,
  sourceLabelBySeq: ReadonlyMap<number, string>,
  keyPrefix: string
): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = new RegExp(SOURCE_REFERENCE_PATTERN.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const seqs = parseSourceReferenceSeqs(match[1]);
    parts.push(
      <SourceReferenceBadge
        key={`${keyPrefix}-${match.index}-${partIndex++}`}
        displayText={match[0]}
        labels={resolveSourceLabels(seqs, sourceLabelBySeq)}
      />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

type ElementWithChildren = ReactElement<{ children?: ReactNode; className?: string }>;

function shouldSkipSourceInjection(element: ElementWithChildren): boolean {
  const type = element.type;
  if (type === "code" || type === "pre") return true;
  const className = element.props.className;
  if (typeof className === "string" && /\blanguage-[\w-]+\b/.test(className)) {
    return true;
  }
  return false;
}

export function injectSourceReferences(
  children: ReactNode,
  sourceLabelBySeq?: ReadonlyMap<number, string>,
  keyPrefix = "src"
): ReactNode {
  if (!sourceLabelBySeq || sourceLabelBySeq.size === 0) return children;
  if (children == null || typeof children === "boolean") return children;

  if (typeof children === "string") {
    const parts = splitTextWithSourceRefs(children, sourceLabelBySeq, keyPrefix);
    if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
    return <>{parts}</>;
  }

  if (typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return Children.map(children, (child, index) => (
      <Fragment key={`${keyPrefix}-arr-${index}`}>
        {injectSourceReferences(child, sourceLabelBySeq, `${keyPrefix}-${index}`)}
      </Fragment>
    ));
  }

  if (isValidElement(children)) {
    const element = children as ElementWithChildren;
    if (shouldSkipSourceInjection(element)) return children;
    return cloneElement(element, {
      children: injectSourceReferences(element.props.children, sourceLabelBySeq, keyPrefix),
    });
  }

  return children;
}
