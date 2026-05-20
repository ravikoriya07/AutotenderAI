import axios from "axios";

export function isUnauthorizedApiError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

/** Parses FastAPI-style `{ detail: string | [...] }` from axios error responses. */
export function getApiErrorDetailMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: unknown } | undefined;
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  }
  return fallback;
}
