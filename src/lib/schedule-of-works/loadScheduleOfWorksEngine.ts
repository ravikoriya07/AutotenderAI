import type {
  SowFoundFile,
  SowSplitRequest,
  SowSplitResponse,
  SowTradeSplitOptions,
} from "@/services/sowService";

const ENGINE_SRC = "/schedule-of-works/engine.js";
const LOADED_FLAG = "__sowEngineLoaded";

export type SowProjectContext = {
  jobId: string;
  projectName?: string;
};

export type { SowFoundFile, SowSplitRequest, SowTradeSplitOptions };

let loadPromise: Promise<void> | null = null;

export function loadScheduleOfWorksEngine(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if ((window as unknown as Record<string, boolean>)[LOADED_FLAG]) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-sow-engine="true"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("SOW engine failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = ENGINE_SRC;
    script.async = true;
    script.dataset.sowEngine = "true";
    script.onload = () => {
      (window as unknown as Record<string, boolean>)[LOADED_FLAG] = true;
      resolve();
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Schedule of Works engine"));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

export function setSowProjectContext(ctx: SowProjectContext): void {
  if (typeof window === "undefined") return;
  const bridge = (
    window as Window & {
      setSowProjectContext?: (context: SowProjectContext) => void;
    }
  ).setSowProjectContext;
  bridge?.(ctx);
}

export function setSowFoundFiles(files: SowFoundFile[]): void {
  if (typeof window === "undefined") return;
  const bridge = (
    window as Window & {
      setSowFoundFiles?: (files: SowFoundFile[]) => void;
    }
  ).setSowFoundFiles;
  bridge?.(files);
}

export function setSowFoundFilesLoading(loading: boolean): void {
  if (typeof window === "undefined") return;
  const bridge = (
    window as Window & {
      setSowFoundFilesLoading?: (loading: boolean) => void;
    }
  ).setSowFoundFilesLoading;
  bridge?.(loading);
}

export function getSowTradeSplitOptions(): SowTradeSplitOptions | null {
  if (typeof window === "undefined") return null;
  const bridge = (
    window as Window & {
      getSowTradeSplitOptions?: () => SowTradeSplitOptions;
    }
  ).getSowTradeSplitOptions;
  return bridge?.() ?? null;
}

export function setSowTradeSplitOptions(options: SowTradeSplitOptions): void {
  if (typeof window === "undefined") return;
  const bridge = (
    window as Window & {
      setSowTradeSplitOptions?: (options: SowTradeSplitOptions) => void;
    }
  ).setSowTradeSplitOptions;
  bridge?.(options);
}

export type SowSplitSubmitHandler = (
  jobId: string,
  request: SowSplitRequest,
  signal?: AbortSignal
) => Promise<SowSplitResponse>;

export function registerSowSplitSubmit(
  handler: SowSplitSubmitHandler
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const win = window as Window & {
    submitSowSplit?: SowSplitSubmitHandler;
  };
  win.submitSowSplit = handler;
  return () => {
    delete win.submitSowSplit;
  };
}

export type SowSplitLoadHandler = (
  jobId: string,
  signal?: AbortSignal
) => Promise<SowSplitResponse | null>;

export function registerSowSplitLoad(
  handler: SowSplitLoadHandler
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const win = window as Window & {
    fetchSavedSowSplit?: SowSplitLoadHandler;
  };
  win.fetchSavedSowSplit = handler;
  return () => {
    delete win.fetchSavedSowSplit;
  };
}

export function runLoadSavedSowSplit(
  jobId: string,
  signal?: AbortSignal
): void {
  if (typeof window === "undefined") return;
  const bridge = (
    window as Window & {
      runLoadSavedSowSplit?: (jobId: string, signal?: AbortSignal) => void;
    }
  ).runLoadSavedSowSplit;
  bridge?.(jobId, signal);
}

export function cancelLoadSavedSowSplit(): void {
  if (typeof window === "undefined") return;
  const bridge = (
    window as Window & {
      cancelLoadSavedSowSplit?: () => void;
    }
  ).cancelLoadSavedSowSplit;
  bridge?.();
}
