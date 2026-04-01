/**
 * Format timestamp with smart relative dates (Today, Yesterday) and full datetime for older dates.
 *
 * Examples:
 * - Today: "Today, 3pm" or "Today, 3:05pm"
 * - Yesterday: "Yesterday, 3pm" or "Yesterday, 3:05pm"
 * - Older: "13 Mar 2026, 3pm" or "13 Mar 2026, 3:05pm"
 *
 * @param isoString - ISO 8601 date string
 * @param locale - Locale for month formatting (default: "en-GB")
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatTimestamp(
  isoString: string | null,
  locale = "en-GB",
  options?: {
    /** Show "Today" and "Yesterday" labels (default: true) */
    showRelative?: boolean;
    /** Show time component (default: true) */
    showTime?: boolean;
  },
): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const showRelative = options?.showRelative ?? true;
  const showTime = options?.showTime ?? true;

  // Calculate day difference for relative dates
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000);

  // Format time component
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "pm" : "am";
  const timePart = showTime
    ? minutes === 0
      ? `${hour12}${ampm}`
      : `${hour12}:${minutes.toString().padStart(2, "0")}${ampm}`
    : "";

  // Return relative dates if enabled
  if (showRelative) {
    if (dayDiff === 0) {
      return showTime ? `Today, ${timePart}` : "Today";
    }
    if (dayDiff === 1) {
      return showTime ? `Yesterday, ${timePart}` : "Yesterday";
    }
  }

  // Format full date for older dates
  const day = date.getDate();
  const month = date.toLocaleString(locale, { month: "short" });
  const year = date.getFullYear();

  if (showTime) {
    return `${day} ${month} ${year}, ${timePart}`;
  }
  return `${day} ${month} ${year}`;
}
