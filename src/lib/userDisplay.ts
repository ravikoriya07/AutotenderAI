/**
 * Two-letter avatar label from full name or email local part.
 */
export function getUserInitials(
  fullName: string | null,
  email: string | null
): string {
  const trimmed = (fullName ?? "").trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[parts.length - 1][0];
      if (a && b) return (a + b).toUpperCase();
    }
    if (parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return parts[0].slice(0, 1).toUpperCase();
  }
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local.length === 1) return local.toUpperCase();
  return "?";
}

/**
 * Compact display name: e.g. "Jane Doe" → "Jane D."; falls back to email local part.
 */
export function getShortDisplayName(
  fullName: string | null,
  email: string | null
): string {
  const trimmed = (fullName ?? "").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
    return lastInitial ? `${first} ${lastInitial}.` : first;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  const local = (email ?? "").split("@")[0]?.trim();
  if (local) return local;
  return "User";
}
