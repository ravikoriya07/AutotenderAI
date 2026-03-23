const TOKEN_KEY = "autotender_auth_token";
const NAME_KEY = "autotender_user_name";
const EMAIL_KEY = "autotender_user_email";

export function setAuthSession(
  token: string,
  name: string,
  email: string = ""
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(EMAIL_KEY, email);
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

export function getAuthUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(EMAIL_KEY);
  return v && v.length > 0 ? v : null;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
