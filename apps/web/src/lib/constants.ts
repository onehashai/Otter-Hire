/** Display name — set `NEXT_PUBLIC_PRODUCT_NAME` to match backend `PRODUCT_NAME`. */
export const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "OneHash ATS";

export const PRODUCT_LOGO_LETTER = PRODUCT_NAME.charAt(0).toUpperCase() || "A";
