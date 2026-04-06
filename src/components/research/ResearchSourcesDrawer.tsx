"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  Download,
  ExternalLink,
  File as FileIconLucide,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  countResearchSourceReferences,
  countUniqueResearchSourceFiles,
  groupResearchSourceFiles,
  normalizeResearchSources,
  type ResearchSourceFile,
} from "@/lib/researchSources";
import {
  downloadProjectStoragePath,
  isLikelyProjectStoragePath,
  jobOutputAbsolutePathToProjectRelative,
} from "@/lib/projectPathDownload";
import {
  FileManagerItemIcon,
  getFileManagerIconKind,
} from "@/components/library/FileManagerItemIcon";
import { cn } from "@/lib/utils";

const SOURCE_BADGE_ICONS = [
  FileText,
  LayoutTemplate,
  FileIconLucide,
  LayoutGrid,
] as const;
const SOURCE_BADGE_RING = [
  "bg-violet-500",
  "bg-sky-400",
  "bg-emerald-500",
  "bg-orange-400",
] as const;

function sourceStackClass(i: number): string {
  return SOURCE_BADGE_RING[i % SOURCE_BADGE_RING.length];
}

function formatDisplayPath(file: ResearchSourceFile): string {
  if (file.isExternalUrl) {
    try {
      const u = new URL(file.path);
      return `${u.hostname}${u.pathname}`.slice(0, 160);
    } catch {
      return file.path.slice(0, 160);
    }
  }
  return jobOutputAbsolutePathToProjectRelative(file.path);
}

export function ResearchSourcesTrigger({
  contexts,
  onOpen,
}: {
  contexts: unknown;
  onOpen: () => void;
}) {
  const uniqueFiles = countUniqueResearchSourceFiles(contexts);
  if (uniqueFiles < 1) return null;
  const parsed = normalizeResearchSources(contexts);
  const labelWord =
    parsed.length > 0
      ? uniqueFiles === 1
        ? "file"
        : "files"
      : uniqueFiles === 1
        ? "source"
        : "sources";
  const stack = Math.min(uniqueFiles, 4);

  return (
    <div className="mt-2 w-full max-w-[min(100%,85%)] sm:max-w-[70%]">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex max-w-full items-center gap-2.5 rounded-full bg-slate-800 px-3 py-2 text-left shadow-sm ring-1 ring-black/10 transition-colors hover:bg-slate-800/90"
        aria-haspopup="dialog"
      >
        <div className="flex shrink-0 items-center" aria-hidden>
          {Array.from({ length: stack }, (_, i) => {
            const Icon = SOURCE_BADGE_ICONS[i % SOURCE_BADGE_ICONS.length];
            return (
              <span
                key={i}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-800 text-white shadow-sm",
                  sourceStackClass(i),
                  i > 0 && "-ml-2.5"
                )}
              >
                <Icon className="h-3.5 w-3.5 opacity-95" strokeWidth={2.25} />
              </span>
            );
          })}
        </div>
        <span className="min-w-0 truncate text-sm font-semibold text-white">
          {uniqueFiles} {labelWord}
        </span>
        <ChevronRight
          className="ml-0.5 h-4 w-4 shrink-0 text-white/80"
          aria-hidden
        />
      </button>
    </div>
  );
}

type ResearchSourcesDrawerProps = {
  open: boolean;
  onClose: () => void;
  contexts: unknown;
  projectJobId: string;
};

export function ResearchSourcesDrawer({
  open,
  onClose,
  contexts,
  projectJobId,
}: ResearchSourcesDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [panelIn, setPanelIn] = useState(false);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPanelIn(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setPanelIn(false);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (open || panelIn || !rendered) return;
    const t = window.setTimeout(() => setRendered(false), 400);
    return () => clearTimeout(t);
  }, [open, panelIn, rendered]);

  useEffect(() => {
    if (!rendered) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const files = useMemo(
    () => normalizeResearchSources(contexts),
    [contexts]
  );
  const grouped = useMemo(() => groupResearchSourceFiles(files), [files]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter((row) => {
      const path = formatDisplayPath(row.file).toLowerCase();
      return (
        row.file.label.toLowerCase().includes(q) ||
        path.includes(q) ||
        row.file.path.toLowerCase().includes(q)
      );
    });
  }, [grouped, search]);

  const job = projectJobId.trim();

  const handleSourceActivate = useCallback(
    async (file: ResearchSourceFile) => {
      if (file.isExternalUrl) {
        window.open(file.path, "_blank", "noopener,noreferrer");
        return;
      }
      if (!job) {
        toast.error("Select a project in the header to download files.");
        return;
      }
      if (!isLikelyProjectStoragePath(file.path)) {
        toast.error("This source cannot be downloaded as a project file.");
        return;
      }
      setDownloadingId(file.id);
      try {
        const ok = await downloadProjectStoragePath(job, file.path);
        if (!ok)
          toast.error("Download failed. Try the Library for this project.");
      } catch {
        toast.error("Download failed. Try the Library for this project.");
      } finally {
        setDownloadingId(null);
      }
    },
    [job]
  );

  const handleAsideTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLElement>) => {
      if (e.propertyName !== "transform") return;
      if (!open) setRendered(false);
    },
    [open]
  );

  if (!mounted || !rendered) return null;

  const uniqueFileCount = countUniqueResearchSourceFiles(contexts);
  const referenceCount = countResearchSourceReferences(contexts);
  const showCitationNote =
    files.length > 0 && referenceCount > uniqueFileCount;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-[85] bg-black/45 transition-opacity duration-300 ease-out",
          panelIn ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => (panelIn ? onClose() : undefined)}
        aria-hidden={!panelIn}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[90] flex h-dvh max-h-dvh w-full flex-col border-l border-border/60 bg-background shadow-2xl transition-transform duration-300 ease-out sm:max-w-[400px] sm:rounded-l-2xl",
          panelIn ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-sources-drawer-title"
        onTransitionEnd={handleAsideTransitionEnd}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-4 py-3.5">
          <div className="min-w-0">
            <h2
              id="research-sources-drawer-title"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Sources
              {uniqueFileCount > 0 ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({uniqueFileCount}{" "}
                  {files.length > 0
                    ? uniqueFileCount === 1
                      ? "file"
                      : "files"
                    : uniqueFileCount === 1
                      ? "source"
                      : "sources"}
                  )
                </span>
              ) : null}
            </h2>
            {showCitationNote ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {referenceCount} citations from these documents
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close sources"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {files.length > 0 ? (
          <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name or path…"
                className="h-10 w-full rounded-xl border border-input bg-muted/30 pl-9 pr-3 text-sm outline-none ring-offset-background transition-[box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/25"
              />
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth overscroll-y-contain px-2 py-2">
          {files.length === 0 ? (
            <p className="px-3 py-6 text-sm leading-relaxed text-muted-foreground">
              Detailed files aren&apos;t listed for this response. Open the
              Library for this project if you need the originals.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              No sources match your filter.
            </p>
          ) : (
            <ul className="space-y-1 pb-[env(safe-area-inset-bottom)]">
              {filtered.map((row) => {
                const busy = downloadingId === row.file.id;
                const iconKind = getFileManagerIconKind(row.file.label, false);
                const pathLine = formatDisplayPath(row.file);
                const dupBadge =
                  row.count > 1 ? (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      ×{row.count}
                    </span>
                  ) : null;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => void handleSourceActivate(row.file)}
                      disabled={busy}
                      aria-label={
                        row.file.isExternalUrl
                          ? `Open ${row.file.label}`
                          : `Download ${row.file.label}`
                      }
                      className={cn(
                        "flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                        "hover:bg-muted/70 active:bg-muted",
                        busy && "opacity-60"
                      )}
                    >
                      <span
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 shadow-sm"
                        aria-hidden
                      >
                        <FileManagerItemIcon kind={iconKind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-1">
                          <span className="line-clamp-2 text-sm font-medium text-foreground">
                            {row.file.label}
                          </span>
                          {dupBadge}
                        </span>
                        <span
                          className="mt-0.5 line-clamp-2 break-all text-xs text-muted-foreground"
                          title={pathLine}
                        >
                          {pathLine}
                        </span>
                      </span>
                      <span className="mt-1 shrink-0 self-start">
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : row.file.isExternalUrl ? (
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Download className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
