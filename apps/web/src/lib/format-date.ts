/** English ordinal day: 1st, 2nd, 3rd, 12th, 21st, … */
function ordinalDay(n: number): string {
  const abs = Math.abs(n);
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Formats an ISO datetime (UTC from API) for display in the user's local calendar date,
 * e.g. "12th March 2026".
 */
export function formatOrdinalLongDate(iso: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = d.toLocaleString(locale, { month: "long" });
  const year = d.getFullYear();
  return `${ordinalDay(day)} ${month} ${year}`;
}
