import { sharedRefresh } from "@/lib/shared-refresh";
import { buildLoginHref } from "@/lib/login-redirect";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

/** Full internal API base — all frontend calls use /v1/internal/* (JWT/session auth) */
export const API_BASE_URL = API_BASE.endsWith("/v1")
  ? `${API_BASE}/internal`
  : `${API_BASE}/v1/internal`;

/** Full WebSocket base URL for client-side WebSocket connections. */
export function getWebSocketBaseUrl(): string {
  const base = API_BASE.replace(/^http/i, "ws");
  return base.endsWith("/v1")
    ? `${base}/internal/inbound/events/ws`
    : `${base}/v1/internal/inbound/events/ws`;
}

/** Normalize API or file URLs */
export function normalizeApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already absolute
  if (/^https?:\/\//i.test(url)) return url;

  const path = url.startsWith("/") ? url : `/${url}`;

  // File URLs (served from backend)
  if (path.startsWith("/v1/internal/files/") || path.startsWith("/files/")) {
    let cleanPath = path;
    if (API_BASE.endsWith("/v1") && path.startsWith("/v1/")) {
      cleanPath = path.substring(3); // strip '/v1'
    }
    return `${API_BASE.replace(/\/$/, "")}${cleanPath}`;
  }

  if (path.startsWith("/v1/internal/")) {
    let cleanPath = path;
    if (API_BASE.endsWith("/v1") && path.startsWith("/v1/")) {
      cleanPath = path.substring(3); // strip '/v1'
    }
    return `${API_BASE.replace(/\/$/, "")}${cleanPath}`;
  }

  let cleanPath = path;
  if (API_BASE_URL.endsWith("/v1/internal") && path.startsWith("/v1/internal/")) {
    cleanPath = path.substring(12); // strip '/v1/internal'
  }
  return `${API_BASE_URL.replace(/\/$/, "")}${cleanPath}`;
}

/** Base API URL (without /v1/internal) */
export function getApiBase(): string {
  return API_BASE.replace(/\/$/, "");
}

/* =========================
   Global 401 Handler
========================= */

type SilentRefreshOutcome = "ok" | "anonymous" | "session_dead";

async function _silentRefreshOutcome(): Promise<SilentRefreshOutcome> {
  const result = await sharedRefresh();
  if (result.ok) return "ok";
  if ("sessionInvalidated" in result && result.sessionInvalidated) return "session_dead";
  return "anonymous";
}

let isHandling401 = false;

function shouldBypassSessionRecovery(path: string): boolean {
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/signup") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/logout") ||
    path.startsWith("/auth/verify") ||
    path.startsWith("/auth/resend-verification")
  );
}

async function handle401Response(sessionExpired: boolean): Promise<void> {
  if (isHandling401) return;
  isHandling401 = true;

  // Ask backend to clear httpOnly auth cookies and revoke refresh token.
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    // Ignore logout failures; continue redirect flow.
  }

  // Clear client-managed session markers
  localStorage.removeItem("session_updated");

  window.location.href = buildLoginHref(
    window.location.pathname,
    window.location.search,
    sessionExpired,
  );

  // Safety net: reset flag after 10s in case navigation is blocked (e.g. test env,
  // navigation interceptors). Under normal page unload the module resets naturally.
  setTimeout(() => {
    isHandling401 = false;
  }, 10_000);
}

/* =========================
   Error Handling
========================= */

export type ApiErrorResponse = {
  code?: string;
  message?: string;
  detail?: string;
  error?: string;
  details?: unknown;
  request_id?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    requestId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

export function handle429Error(res: Response): string {
  const retryAfter = res.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return formatRetryAfter(seconds);
    }
  }
  return "Too many attempts. Please try again later.";
}

function mapErrorCodeToMessage(status: number, code?: string, fallback?: string): string {
  if (code === "AUTH_INVALID_CREDENTIALS" || (status === 401 && !code)) {
    return "Email or password is incorrect.";
  }
  if (code === "RATE_LIMIT_EXCEEDED" || status === 429) {
    return "Too many attempts. Please try again later.";
  }
  if (code === "VALIDATION_ERROR" || status === 422) {
    return fallback && fallback !== "Validation failed"
      ? fallback
      : "Please check the form and try again.";
  }
  if (status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (status === 502 || status === 503) {
    if (fallback && fallback.trim()) return fallback;
  }
  if (status >= 500) {
    return "Something went wrong. Please try again.";
  }
  return fallback || "Request failed";
}

async function readApiErrorBody(res: Response): Promise<ApiErrorResponse | null> {
  try {
    return (await res.json()) as ApiErrorResponse;
  } catch {
    return null;
  }
}

async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  const body = await readApiErrorBody(res);

  const rawMessage =
    (typeof body?.message === "string" && body.message.trim()) ||
    (typeof body?.detail === "string" && body.detail.trim()) ||
    (typeof body?.error === "string" && body.error.trim()) ||
    fallback;

  const message = mapErrorCodeToMessage(res.status, body?.code, rawMessage);
  return new ApiError(message, res.status, body?.code, body?.request_id, body?.details);
}

export async function parseErrorResponse(res: Response, defaultMessage: string): Promise<string> {
  const err = await toApiError(res, defaultMessage);
  return err.message;
}

/**
 * Classifies an error for UI display.
 * Returns { forbidden: true } for 403 permission errors.
 * Returns { networkError: true } for fetch/network failures.
 * Otherwise returns the error message string.
 */
export function classifyError(err: unknown): {
  message: string;
  forbidden: boolean;
  networkError: boolean;
} {
  if (err instanceof ApiError) {
    return {
      message: err.message,
      forbidden: err.status === 403,
      networkError: false,
    };
  }
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return {
      message: "Unable to connect to the server. Please check your connection and try again.",
      forbidden: false,
      networkError: true,
    };
  }
  return {
    message: err instanceof Error ? err.message : "Something went wrong.",
    forbidden: false,
    networkError: false,
  };
}

/* =========================
   API Helpers
========================= */

export type ApiGetOptions = {
  credentials?: RequestCredentials;
  cache?: RequestCache;
};

export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  const { credentials = "include", cache = "no-store" } = options;
  const shouldRecoverSession = !shouldBypassSessionRecovery(path);

  const fetchOnce = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache,
      credentials,
    });

  let res = await fetchOnce();
  let sessionExpiredForLogin = false;

  if (shouldRecoverSession && res.status === 401) {
    const outcome = await _silentRefreshOutcome();
    if (outcome === "ok") {
      res = await fetchOnce();
    } else if (outcome === "session_dead") {
      sessionExpiredForLogin = true;
    }
  }

  if (shouldRecoverSession && res.status === 401) {
    await handle401Response(sessionExpiredForLogin);
    throw new ApiError("Session expired", 401, "AUTH_SESSION_EXPIRED");
  }

  if (!res.ok) {
    const err = await toApiError(res, `GET failed: ${res.status}`);
    throw err;
  }

  return (await res.json()) as T;
}

export type ApiPostOptions = {
  credentials?: RequestCredentials;
};

export async function apiPost<T>(
  path: string,
  body: object,
  options: ApiPostOptions = {},
): Promise<T> {
  const { credentials = "include" } = options;
  const shouldRecoverSession = !shouldBypassSessionRecovery(path);

  const fetchOnce = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials,
      body: JSON.stringify(body),
    });

  let res = await fetchOnce();
  let sessionExpiredForLogin = false;

  if (shouldRecoverSession && res.status === 401) {
    const outcome = await _silentRefreshOutcome();
    if (outcome === "ok") {
      res = await fetchOnce();
    } else if (outcome === "session_dead") {
      sessionExpiredForLogin = true;
    }
  }

  if (shouldRecoverSession && res.status === 401) {
    await handle401Response(sessionExpiredForLogin);
    throw new ApiError("Session expired", 401, "AUTH_SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw await toApiError(res, `POST failed: ${res.status}`);
  }

  if (res.status === 204) return {} as T;

  return (await res.json()) as T;
}

export async function apiFetch<T>(
  path: string,
  options: { method: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const shouldRecoverSession = !shouldBypassSessionRecovery(path);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOnce = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

  let res = await fetchOnce();
  let sessionExpiredForLogin = false;

  if (shouldRecoverSession && res.status === 401) {
    const outcome = await _silentRefreshOutcome();
    if (outcome === "ok") {
      res = await fetchOnce();
    } else if (outcome === "session_dead") {
      sessionExpiredForLogin = true;
    }
  }

  if (shouldRecoverSession && res.status === 401) {
    await handle401Response(sessionExpiredForLogin);
    throw new ApiError("Session expired", 401, "AUTH_SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw await toApiError(res, `Request failed: ${res.status}`);
  }

  if (res.status === 204) return {} as T;

  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const shouldRecoverSession = !shouldBypassSessionRecovery(path);
  const fetchOnce = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
      credentials: "include",
    });

  let res = await fetchOnce();
  let sessionExpiredForLogin = false;

  if (shouldRecoverSession && res.status === 401) {
    const outcome = await _silentRefreshOutcome();
    if (outcome === "ok") {
      res = await fetchOnce();
    } else if (outcome === "session_dead") {
      sessionExpiredForLogin = true;
    }
  }

  if (shouldRecoverSession && res.status === 401) {
    await handle401Response(sessionExpiredForLogin);
    throw new ApiError("Session expired", 401, "AUTH_SESSION_EXPIRED");
  }

  if (!res.ok) {
    throw await toApiError(res, `DELETE failed: ${res.status}`);
  }
}
