const ENGINE_SRC = "/schedule-of-works/engine.js";
const LOADED_FLAG = "__sowEngineLoaded";

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
