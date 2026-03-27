/**
 * Derives 1–maxLength uppercase letters for avatar fallbacks (person or org names).
 *
 * - **Multiple words:** first letter of each word, concatenated, then truncated to `maxLength`.
 * - **Single word:** first `maxLength` letters of that word.
 * - **Empty input:** returns `emptyFallback` (default `"?"`).
 */
export function getInitialsFromName(
  name: string | null | undefined,
  maxLength = 2,
  emptyFallback = "?",
): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return emptyFallback;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return emptyFallback;
  if (parts.length === 1) {
    const w = parts[0];
    if (!w.length) return emptyFallback;
    return w.length <= maxLength ? w.toUpperCase() : w.slice(0, maxLength).toUpperCase();
  }
  const fromWords = parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  if (!fromWords) return emptyFallback;
  return fromWords.length <= maxLength ? fromWords : fromWords.slice(0, maxLength);
}
