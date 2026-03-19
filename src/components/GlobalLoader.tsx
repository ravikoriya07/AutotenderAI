"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipLoader } from "react-spinners";
import { globalLoaderStore } from "@/lib/globalLoaderStore";

const SHOW_DELAY_MS = 120;
const MIN_VISIBLE_MS = 250;

export function GlobalLoader() {
  const [requestCount, setRequestCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleSinceRef = useRef<number>(0);

  useEffect(() => globalLoaderStore.subscribe(setRequestCount), []);

  useEffect(() => {
    if (requestCount > 0) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (!visible && !showTimerRef.current) {
        showTimerRef.current = setTimeout(() => {
          visibleSinceRef.current = Date.now();
          setVisible(true);
          showTimerRef.current = null;
        }, SHOW_DELAY_MS);
      }
      return;
    }

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visible) return;

    const elapsed = Date.now() - visibleSinceRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, wait);
  }, [requestCount, visible]);

  useEffect(
    () => () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  const opacityClass = useMemo(
    () => (visible ? "opacity-100" : "opacity-0"),
    [visible]
  );

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[100] transition-opacity duration-200 ${opacityClass}`}
      aria-hidden={!visible}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/20">
        <div className="h-full w-full animate-pulse bg-primary/70" />
      </div>
      <div className="absolute right-4 top-4 rounded-full border border-border bg-card/95 p-2 shadow-sm backdrop-blur-sm">
        <ClipLoader size={18} color="hsl(var(--primary))" />
      </div>
    </div>
  );
}

