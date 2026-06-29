"use client";

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { findCitationRefMatches } from "@/lib/bid-writing/sourceReferences";
import { SourceReferenceBadge } from "@/components/bid-writing/SourceReferenceBadge";

function splitTextWithCitationRefs(
  text: string,
  sourceLabelBySeq: ReadonlyMap<number, string> | undefined,
  keyPrefix: string
): ReactNode[] {
  const matches = findCitationRefMatches(text, sourceLabelBySeq);
  if (matches.length === 0) return [text];

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((hit, partIndex) => {
    if (hit.index > lastIndex) {
      parts.push(text.slice(lastIndex, hit.index));
    }
    parts.push(
      <SourceReferenceBadge
        key={`${keyPrefix}-${hit.index}-${partIndex}`}
        displayText={hit.displayText}
        labels={hit.labels}
      />
    );
    lastIndex = hit.index + hit.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
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
  if (children == null || typeof children === "boolean") return children;

  if (typeof children === "string") {
    const parts = splitTextWithCitationRefs(children, sourceLabelBySeq, keyPrefix);
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
