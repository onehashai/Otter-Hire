import { parsePhoneNumber } from "@onehash/ui/input";

/**
 * Display phone with spacing after the country calling code (e.g. "+91 9174840781").
 * Only formats an explicit country calling code. A local number has no reliable
 * country context, so it must not be assumed to be a US number.
 */
export function formatPhoneForDisplay(raw: string): string {
  if (!raw || raw.trim() === "" || raw === "—") return raw;
  const compact = raw.trim().replace(/\s/g, "");

  if (!compact.startsWith("+")) return raw;

  try {
    const parsed = parsePhoneNumber(compact);
    if (parsed) return parsed.formatInternational();
  } catch {
    /* Preserve the original value when it cannot be parsed. */
  }

  const m = /^\+(\d{1,3})(\d{4,})$/.exec(compact);
  if (m) return `+${m[1]} ${m[2]}`;
  return raw;
}

/**
 * Maps explicit international phone strings to E.164 for PhoneInput.
 * Local numbers are intentionally returned as undefined because their country is unknown.
 */
export function parseStoredPhone(raw: string): string | undefined {
  if (!raw || raw === "—") return undefined;
  const s = raw.trim();
  if (!s || !s.startsWith("+")) return undefined;
  try {
    return parsePhoneNumber(s).number;
  } catch {
    return undefined;
  }
}
