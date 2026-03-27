/** Display name — set `NEXT_PUBLIC_PLATFORM_NAME` to match backend `PLATFORM_NAME`. */
export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || "OneHash ATS";

export const PRODUCT_LOGO_LETTER = PLATFORM_NAME.charAt(0).toUpperCase() || "A";
