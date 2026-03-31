/**
 * Avatar fallback initials derived from display names.
 *
 * Uses `Array.from(word)[0]` for the first character so leading surrogate pairs
 * are handled slightly better than `word[0]`.
 */

function firstChar(word: string): string {
  const ch = Array.from(word)[0];
  return ch ?? "";
}

function normalizeParts(name: string | null | undefined): string[] {
  return (name ?? "").trim().split(/\s+/).filter(Boolean);
}

/**
 * Organization names: one word → one letter; two or more words → first letter of
 * the first two words only (additional words ignored).
 */
export function getOrganizationNameInitials(
  name: string | null | undefined,
  emptyFallback = "?",
): string {
  const parts = normalizeParts(name);
  if (parts.length === 0) return emptyFallback;
  if (parts.length === 1) {
    const c = firstChar(parts[0]);
    return c ? c.toUpperCase() : emptyFallback;
  }
  const a = firstChar(parts[0]);
  const b = firstChar(parts[1]);
  const out = (a + b).toUpperCase();
  return out || emptyFallback;
}

/**
 * Person names: one word → one letter; two or more words → first letter of the
 * first word + first letter of the last word (middle names omitted).
 */
export function getPersonNameInitials(
  name: string | null | undefined,
  emptyFallback = "?",
): string {
  const parts = normalizeParts(name);
  if (parts.length === 0) return emptyFallback;
  if (parts.length === 1) {
    const c = firstChar(parts[0]);
    return c ? c.toUpperCase() : emptyFallback;
  }
  const first = firstChar(parts[0]);
  const last = firstChar(parts[parts.length - 1]);
  const out = (first + last).toUpperCase();
  return out || emptyFallback;
}

/** Alias for {@link getPersonNameInitials} (existing call sites). */
export function getInitialsFromName(
  name: string | null | undefined,
  emptyFallback = "?",
): string {
  return getPersonNameInitials(name, emptyFallback);
}
