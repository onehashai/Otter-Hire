import { parsePhoneNumber } from "@onehash/ui/input";

/**
 * Display phone with spacing after the country calling code (e.g. "+91 9174840781").
 * Uses international formatting when the number parses; otherwise inserts a single space after +CC.
 */
export function formatPhoneForDisplay(raw: string): string {
  if (!raw || raw.trim() === "" || raw === "—") return raw;
  const compact = raw.trim().replace(/\s/g, "");

  const tryIntl = (): string | null => {
    try {
      const p = parsePhoneNumber(compact);
      if (p) return p.formatInternational();
    } catch {
      /* ignore */
    }
    try {
      const p = parsePhoneNumber(compact, "US");
      if (p) return p.formatInternational();
    } catch {
      /* ignore */
    }
    return null;
  };

  const formatted = tryIntl();
  if (formatted) return formatted;

  const m = /^\+(\d{1,3})(\d{4,})$/.exec(compact);
  if (m) return `+${m[1]} ${m[2]}`;
  return raw;
}

/**
 * Maps stored candidate phone strings to E.164 for PhoneInput, or undefined when unknown.
 */
export function parseStoredPhone(raw: string): string | undefined {
  if (!raw || raw === "—") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  try {
    return parsePhoneNumber(s).number;
  } catch {
    // ignore
  }
  try {
    return parsePhoneNumber(s, "US").number;
  } catch {
    return undefined;
  }
}
