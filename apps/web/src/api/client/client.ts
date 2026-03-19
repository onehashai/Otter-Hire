/** Base URL of the API (no trailing slash). Prod: https://api.smartats.in, Local: http://localhost:8000 */
const API_BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : process.env.BACKEND_URL) ?? "http://localhost:8000";

/** Full internal API base — all frontend calls use /v1/internal/* (JWT/session auth) */
export const API_BASE_URL = `${API_BASE.replace(/\/$/, "")}/v1/internal`;

/** Full WebSocket base URL for client-side WebSocket connections. */
export function getWebSocketBaseUrl(): string {
  const base = API_BASE.replace(/^http/i, "ws");
  return `${base}/v1/internal/inbound/events/ws`;
}

export function normalizeApiUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;

  // File URLs: prepend API base when path is relative
  if (
    path.startsWith("/v1/internal/files/") ||
    path.startsWith("/api/files/") ||
    path.startsWith("/files/")
  ) {
    return `${API_BASE.replace(/\/$/, "")}${path}`;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Base API URL (without /v1/internal) — for health checks, WebSocket, etc. */
export function getApiBase(): string {
  return API_BASE.replace(/\/$/, "");
}

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

export type ApiGetOptions = {
  credentials?: RequestCredentials;
  cache?: RequestCache;
};

export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  const { credentials = "include", cache = "no-store" } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache,
    credentials,
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
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

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await toApiError(res, `API request failed: ${res.status} ${res.statusText}`);
    throw err;
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export async function apiFetch<T>(
  path: string,
  options: { method: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await toApiError(res, `Request failed: ${res.status} ${res.statusText}`);
    throw err;
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const err = await toApiError(res, `API request failed: ${res.status} ${res.statusText}`);
    throw err;
  }
}
