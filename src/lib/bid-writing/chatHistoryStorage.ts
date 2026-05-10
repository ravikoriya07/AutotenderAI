import type { ChatSession } from "./types";

const CHAT_HISTORY_KEY = "autotender_chat_history_v1";

export function loadChatHistory(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(history: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
}
