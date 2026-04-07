"use client";

import Link from "next/link";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto shrink-0 border-t border-border/80 bg-muted/40">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] lg:px-8">
        <p className="text-center text-xs text-muted-foreground sm:text-left sm:text-sm">
          © {year} AutotenderAI. All rights reserved.
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:justify-end sm:text-sm"
          aria-label="Footer"
        >
          <Link
            href="/settings"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Settings
          </Link>
          <Link
            href="/library"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Library
          </Link>
          <Link
            href="/research"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Research
          </Link>
        </nav>
      </div>
    </footer>
  );
}
