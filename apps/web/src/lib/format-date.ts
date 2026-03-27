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
    minutes === 0 ? `${hour12}${ampm}` : `${hour12}:${minutes.toString().padStart(2, "0")}${ampm}`;
  return `${day} ${month} ${year}, ${timePart}`;
}

/**
 * Thread header labels: "Yesterday", "Today" with time, short date, or full datetime for older messages.
 */
export function formatThreadMessageTime(isoString: string | null, locale = "en-GB"): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? "pm" : "am";
    const timePart =
      minutes === 0
        ? `${hour12}${ampm}`
        : `${hour12}:${minutes.toString().padStart(2, "0")}${ampm}`;
    return `Today, ${timePart}`;
  }
  if (dayDiff === 1) return "Yesterday";

  return formatTimestampToDateTime(isoString, locale);
}
