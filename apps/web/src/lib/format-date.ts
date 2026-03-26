/**
 * Local calendar date without year: "20 March".
 */
export function formatDayMonth(iso: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = d.toLocaleString(locale, { month: "long" });
  return `${day} ${month}`;
}

/** e.g. "22 Mar" this year, or "12 Mar 2025" when not the current year. */
function formatShortDayMonth(d: Date, now: Date, locale = "en-GB"): string {
  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Compact labels for conversation lists and threads:
 * `4sec`, `10min`, `2hr` when recent; otherwise `22 Mar`, `12 Mar` (short month; year if needed).
 */
export function formatTimestamp(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) {
    return formatShortDayMonth(date, now);
  }

  if (diffMs < 60_000) {
    const s = Math.max(1, Math.floor(diffMs / 1000));
    return `${s}sec`;
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)}min`;
  }
  if (diffMs < 86_400_000) {
    return `${Math.floor(diffMs / 3_600_000)}hr`;
  }

  return formatShortDayMonth(date, now);
}

/**
 * Full local date and time, e.g. `13 Mar 2026, 3pm` (on the hour) or `13 Mar 2026, 3:05pm`.
 */
export function formatTimestampToDateTime(isoString: string | null, locale = "en-GB"): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  const month = date.toLocaleString(locale, { month: "short" });
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "pm" : "am";
  const timePart =
    minutes === 0
      ? `${hour12}${ampm}`
      : `${hour12}:${minutes.toString().padStart(2, "0")}${ampm}`;
  return `${day} ${month} ${year}, ${timePart}`;
}