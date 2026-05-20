import type { ClientZipUploadProgress } from "@/lib/bid-writing/types";

export function isClientZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

export function clientZipBarPercent(prog: ClientZipUploadProgress | null): number {
  if (!prog) return 8;
  const phase = String(prog.phase ?? "").toLowerCase();
  if (phase === "done") return 100;
  if (phase === "error") return 0;
  const done = prog.done ?? prog.chunks_uploaded;
  const total = prog.total;
  if (typeof done === "number" && typeof total === "number" && total > 0) {
    return Math.min(98, Math.max(12, Math.round((done / total) * 100)));
  }
  if (phase === "ingesting") return 72;
  if (phase === "extracting") return 42;
  if (phase === "queued") return 18;
  return 12;
}

export function clientZipProgressCaption(prog: ClientZipUploadProgress): string {
  const phase = String(prog.phase ?? "").toLowerCase();
  const parts: string[] = [];
  if (phase === "queued") parts.push("Waiting in queue…");
  else if (phase === "extracting") parts.push("Extracting files…");
  else if (phase === "ingesting") parts.push("Processing and uploading chunks…");
  else if (phase === "done") parts.push("Complete");
  else if (phase === "error") parts.push("Error");
  else parts.push(`Status: ${prog.phase}`);

  const done = prog.done ?? prog.chunks_uploaded;
  const total = prog.total;
  if (typeof done === "number" && typeof total === "number" && total > 0) {
    parts.push(`${done} / ${total}`);
  } else if (typeof prog.chunks_uploaded === "number" && typeof total === "number" && total > 0) {
    parts.push(`${prog.chunks_uploaded} / ${total} chunks`);
  } else if (typeof prog.chunks_uploaded === "number") {
    parts.push(`${prog.chunks_uploaded} chunks uploaded`);
  }
  return parts.filter(Boolean).join(" · ");
}

export function isTerminalUploadPhase(phase: unknown): boolean {
  const p = String(phase ?? "").toLowerCase();
  return p === "done" || p === "error";
}
