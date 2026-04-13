/**
 * When sending users to /login, skip `redirect=` if they were already going to `/`
 * with no query string — the default post-login destination is home.
 */
export function shouldOmitLoginRedirect(pathname: string, search: string): boolean {
  return pathname === "/" && search === "";
}

/** Build `/login` with optional `redirect` and `session_expired` (only when refresh truly died). */
export function buildLoginHref(pathname: string, search: string, sessionExpired: boolean): string {
  const params = new URLSearchParams();
  if (!shouldOmitLoginRedirect(pathname, search)) {
    params.set("redirect", `${pathname}${search}`);
  }
  if (sessionExpired) {
    params.set("session_expired", "true");
  }
  const q = params.toString();
  return q ? `/login?${q}` : "/login";
}
