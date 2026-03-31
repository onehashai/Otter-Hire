const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_CHARS_RE = /^[+\d()\-\s.]+$/;
const PHONE_ALLOWED_SINGLE_CHAR_RE = /^[+\d()\-\s.]$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(normalizeEmail(value));
}

export function normalizePhone(value: string): string {
  return value.trim();
}

export function isAllowedPhoneChar(char: string): boolean {
  return PHONE_ALLOWED_SINGLE_CHAR_RE.test(char);
}

export function sanitizePhoneInput(raw: string): string {
  return Array.from(raw).filter((ch) => isAllowedPhoneChar(ch)).join("");
}

export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(sanitizePhoneInput(value));
  if (!normalized) return false;
  if (!PHONE_ALLOWED_CHARS_RE.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
