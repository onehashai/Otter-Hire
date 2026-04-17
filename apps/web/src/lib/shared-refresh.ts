import { refresh401MeansSessionExpired } from "@/lib/auth-refresh-codes";

const _API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);
const _REFRESH_URL = `${_API_BASE}/v1/internal/auth/refresh`;

export type SharedRefreshResult =
  | { ok: true; rawUser: Record<string, unknown> }
  | { ok: false; sessionInvalidated: boolean };

// Single module-level guard shared by client.ts and auth.ts.
// Ensures only one POST /auth/refresh is ever in-flight at a time, preventing
// the race condition where two concurrent callers both hit the backend's
// single-use opaque refresh token and the second gets AUTH_INVALID_REFRESH_TOKEN.
let _sharedRefreshPromise: Promise<SharedRefreshResult> | null = null;

export async function sharedRefresh(): Promise<SharedRefreshResult> {
  if (_sharedRefreshPromise) return _sharedRefreshPromise;

  _sharedRefreshPromise = (async (): Promise<SharedRefreshResult> => {
    try {
      const res = await fetch(_REFRESH_URL, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
      });

      if (res.ok) {
        let rawUser: Record<string, unknown> = {};
        try {
          rawUser = (await res.json()) as Record<string, unknown>;
        } catch {
          // 2xx with unparseable body — treat as ok with empty shape
        }
        return { ok: true, rawUser };
      }

      if (res.status === 401) {
        let code: string | undefined;
        try {
          const body = (await res.json()) as { code?: string };
          code = typeof body.code === "string" ? body.code : undefined;
        } catch {
          // ignore parse failure
        }
        return { ok: false, sessionInvalidated: refresh401MeansSessionExpired(code) };
      }

      // 5xx / 429 / other non-401 failure: transient, not a real session invalidation
      return { ok: false, sessionInvalidated: false };
    } catch {
      // Network error: transient
      return { ok: false, sessionInvalidated: false };
    } finally {
      _sharedRefreshPromise = null;
    }
  })();

  return _sharedRefreshPromise;
}
