/**
 * Backend POST /v1/internal/auth/refresh returns 401 with these `code` values
 * (see apps/backend auth router). Used to decide whether to show "session expired"
 * vs a plain /login for visitors with no refresh cookie.
 */
export function refresh401MeansSessionExpired(errorCode: string | undefined): boolean {
  if (errorCode === "AUTH_NO_REFRESH_TOKEN") return false;
  return (
    errorCode === "AUTH_INVALID_REFRESH_TOKEN" ||
    errorCode === "AUTH_REFRESH_TOKEN_EXPIRED" ||
    errorCode === "AUTH_MEMBERSHIP_NOT_FOUND"
  );
}
