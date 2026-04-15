/**
 * Unique id for client-only records. Uses `crypto.randomUUID` when available
 * (HTTPS / modern browsers); falls back otherwise (e.g. HTTP dev servers).
 */
export function createClientId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") {
      return c.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
