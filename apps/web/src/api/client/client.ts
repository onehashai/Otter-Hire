const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INTERNAL_API_BASE_URL = process.env.API_INTERNAL_URL ?? PUBLIC_API_BASE_URL;

export const API_BASE_URL =
  typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

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

export async function parseErrorResponse(res: Response, defaultMessage: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string };
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // ignore
  }
  return defaultMessage;
}

export type ApiGetOptions = {
  credentials?: RequestCredentials;
  cache?: RequestCache;
};

export async function apiGet<T>(
  path: string,
  options: ApiGetOptions = {}
): Promise<T> {
  const { credentials = "omit", cache = "no-store" } = options;

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
  options: ApiPostOptions = {}
): Promise<T> {
  const { credentials = "include" } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(handle429Error(res));
    }
    const message = await parseErrorResponse(
      res,
      `API request failed: ${res.status} ${res.statusText}`
    );
    throw new Error(message);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export type HealthResponse = {
  status: string;
};

export function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/health");
}
