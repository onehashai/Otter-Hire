import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { refresh401MeansSessionExpired } from "@/lib/auth-refresh-codes";
import { shouldOmitLoginRedirect } from "@/lib/login-redirect";
import { isCareersUuidSegment, parseLegacyCareersOrgSlug } from "@/lib/public-careers-org";

const AUTH_ROUTES = new Set(["/login", "/signup"]);
const LIFECYCLE_ROUTES = new Set(["/verify", "/onboarding", "/forgot", "/reset"]);
const PUBLIC_ROUTES = new Set(["/health", "/favicon.ico"]);
const MARKETING_ROUTES = new Set(["/privacy-policy", "/terms"]);

function getApiBaseUrl(): string {
  // Prefer internal Docker network URL (server-side only) to avoid
  // Docker Desktop Mac's broken 127.0.0.1 port forwarding.
  return (
    process.env.NEXT_INTERNAL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

function parseJobStagePath(pathname: string): { jobId: string; stageId: string } | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 4) return null;
  if (parts[0] !== "jobs" || parts[2] !== "stage") return null;
  if (!parts[1] || !parts[3]) return null;
  return { jobId: parts[1], stageId: parts[3] };
}

function getDefaultStageIdFromWorkspace(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const stages = (payload as { stages?: unknown }).stages;
  if (!Array.isArray(stages) || stages.length === 0) return null;
  const validStages = stages
    .filter(
      (stage): stage is { id: string; position?: number | null } =>
        Boolean(stage) &&
        typeof stage === "object" &&
        typeof (stage as { id?: unknown }).id === "string",
    )
    .sort((left, right) => {
      const leftPos =
        typeof left.position === "number" && Number.isFinite(left.position) ? left.position : 0;
      const rightPos =
        typeof right.position === "number" && Number.isFinite(right.position) ? right.position : 0;
      return leftPos - rightPos;
    });
  return validStages[0]?.id ?? null;
}

async function normalizeInvalidStageUrl(request: NextRequest): Promise<NextResponse | null> {
  const parsed = parseJobStagePath(request.nextUrl.pathname);
  if (!parsed) return null;

  try {
    const res = await fetch(`${getApiBaseUrl()}/v1/internal/jobs/${parsed.jobId}/workspace`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const payload = (await res.json()) as { stages?: Array<{ id: string }> };
    const stages = Array.isArray(payload.stages) ? payload.stages : [];
    const stageExists = stages.some((stage) => stage?.id === parsed.stageId);
    if (stageExists) return null;

    const defaultStageId = getDefaultStageIdFromWorkspace(payload);
    const redirectUrl = new URL(
      defaultStageId ? `/jobs/${parsed.jobId}/stage/${defaultStageId}` : `/jobs/${parsed.jobId}`,
      request.url,
    );
    return NextResponse.redirect(redirectUrl);
  } catch {
    return null;
  }
}

function getExpectedAppHost(): string | null {
  const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST;
  return rootHost || null;
}

function getJobsSubdomain(): string {
  return process.env.NEXT_PUBLIC_JOBS_SUBDOMAIN || "jobs";
}

function getRootHostAliases(): string[] {
  const configuredRootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST || "";
  const configuredRootHostname = configuredRootHost.split(":")[0].toLowerCase();
  const aliases = new Set(["localhost", "127.0.0.1"]);

  if (configuredRootHostname) {
    aliases.add(configuredRootHostname);
    aliases.add(`www.${configuredRootHostname}`);
  }

  return Array.from(aliases);
}

function getHostSubdomain(host: string): string | null {
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname) return null;
  const parts = hostname.split(".");
  return parts.length > 2 ? parts[0] : null;
}

function isInvitePath(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

function isJobsHost(host: string): boolean {
  const jobsSubdomain = getJobsSubdomain().toLowerCase();
  const appSubdomain = (process.env.NEXT_PUBLIC_APP_SUBDOMAIN || "app").toLowerCase();
  const hostSubdomain = getHostSubdomain(host);
  if (!hostSubdomain) return false;
  // Safety guard: app subdomain should never be treated as jobs host.
  if (hostSubdomain === appSubdomain) return false;
  return hostSubdomain === jobsSubdomain;
}

function isPublicCareersRoute(pathname: string): boolean {
  // Only allow /<orgId> and /<orgId>/<jobId> (or legacy /<name-uuid>/… until redirect)
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 1 || parts.length === 2;
}

/** 301 from legacy `/{name}-{orgUuid}` to `/{orgUuid}` (and same for job detail). */
function legacyCareersRedirect(request: NextRequest, pathname: string): NextResponse | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1 && parts.length !== 2) return null;

  const first = parts[0];
  if (isCareersUuidSegment(first)) return null;

  const legacy = parseLegacyCareersOrgSlug(first);
  if (!legacy) return null;

  if (parts.length === 1) {
    return NextResponse.redirect(new URL(`/${legacy.orgId}`, request.url), 301);
  }

  const jobSeg = parts[1];
  if (!isCareersUuidSegment(jobSeg)) return null;

  return NextResponse.redirect(new URL(`/${legacy.orgId}/${jobSeg}`, request.url), 301);
}

function getAppSubdomainUrl(pathname: string, rootHost: string, search = ""): string {
  const protocol =
    rootHost.includes("localhost") || rootHost.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${rootHost}${pathname}${search}`;
}

function isRootHost(host: string): boolean {
  return false; // Treat the bare domain as the main application host instead of marketing domain
}

/**
 * Returns true when the incoming host is the root/marketing domain, i.e. it
 * matches NEXT_PUBLIC_APP_ROOT_HOST or the bare localhost dev host
 * (hostname comparison, port-agnostic).
 */
function isRootHost(host: string): boolean {
  const currentHostname = host.split(":")[0].toLowerCase();
  return getRootHostAliases().includes(currentHostname);
}

function appendSetCookieHeaders(target: NextResponse, sourceHeaders: Headers): void {
  const maybeHeaders = sourceHeaders as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof maybeHeaders.getSetCookie === "function") {
    const cookies = maybeHeaders.getSetCookie();
    for (const cookie of cookies) {
      if (cookie) {
        target.headers.append("set-cookie", cookie);
      }
    }
    return;
  }

  const raw = sourceHeaders.get("set-cookie");
  if (raw) {
    target.headers.append("set-cookie", raw);
  }
}

function buildLoginRedirect(request: NextRequest, sessionExpired: boolean): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  if (!shouldOmitLoginRedirect(pathname, search)) {
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  }
  if (sessionExpired) {
    loginUrl.searchParams.set("session_expired", "true");
  }
  return NextResponse.redirect(loginUrl);
}

async function refreshUnauthorizedMeansSessionExpired(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const data = (await res.json()) as { code?: string };
    const code = typeof data.code === "string" ? data.code : undefined;
    return refresh401MeansSessionExpired(code);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const currentHost = request.headers.get("host") || "";

  // Public careers site (jobs subdomain) - only allow careers routes
  if (isJobsHost(currentHost)) {
    // Redirect auth routes to app subdomain
    if (AUTH_ROUTES.has(pathname) || LIFECYCLE_ROUTES.has(pathname)) {
      const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST || "localhost:3000";
      return NextResponse.redirect(getAppSubdomainUrl(pathname, rootHost));
    }

    if (isPublicCareersRoute(pathname)) {
      const redirected = legacyCareersRedirect(request, pathname);
      if (redirected) return redirected;
      return NextResponse.next();
    }
    // Block all other routes on jobs subdomain - return 404
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  // Root / marketing domain — serve the marketing site and delegate app routes to
  // the app subdomain.  This must come before the expectedHost redirect so that
  // requests to the root domain are never blindly bounced to app.*.
  if (isRootHost(currentHost)) {
    const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST || "localhost:3000";
    const search = request.nextUrl.search;

    const currentHostname = currentHost.split(":")[0].toLowerCase();
    const configuredRootHostname = rootHost.split(":")[0].toLowerCase();
    const isBareLocal = currentHostname === "localhost" || currentHostname === "127.0.0.1";

    // Redirect bare localhost/127.0.0.1 to the configured root host when they differ.
    if (
      isBareLocal &&
      configuredRootHostname !== "localhost" &&
      configuredRootHostname !== "127.0.0.1"
    ) {
      return NextResponse.redirect(`http://${rootHost}${pathname}${search}`);
    }

    // Redirect bare apex domain to www (production only — skip all localhost variants).
    const isLocalDev =
      configuredRootHostname === "localhost" ||
      configuredRootHostname === "127.0.0.1" ||
      configuredRootHostname.includes("localhost");
    // Disabled www redirect to prevent SSL certificate validation errors on bare domain
    // if (!isBareLocal && !isLocalDev && currentHostname === configuredRootHostname) {
    //   return NextResponse.redirect(`https://www.${rootHost}${pathname}${search}`, 301);
    // }

    // Public infra routes pass straight through on any domain.
    if (PUBLIC_ROUTES.has(pathname)) {
      return NextResponse.next();
    }

    // Auth / lifecycle / invite paths belong on the app subdomain.
    if (AUTH_ROUTES.has(pathname) || LIFECYCLE_ROUTES.has(pathname) || isInvitePath(pathname)) {
      return NextResponse.redirect(getAppSubdomainUrl(pathname, rootHost, search));
    }

    // Marketing homepage: always accessible regardless of auth state.
    if (pathname === "/") {
      return NextResponse.next();
    }

    // Marketing legal pages and internal API routes — always serve on root domain.
    if (MARKETING_ROUTES.has(pathname) || pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    // Every other path on the root domain is an app route — redirect to the app subdomain.
    return NextResponse.redirect(getAppSubdomainUrl(pathname, rootHost, search));
  }

  // Enforce the app subdomain for all remaining hosts (unknown hosts included).
  const expectedHost = getExpectedAppHost();
  if (expectedHost && currentHost !== expectedHost) {
    const protocol =
      currentHost.includes("localhost") || currentHost.includes("127.0.0.1") ? "http" : "https";
    const redirectUrl = `${protocol}://${expectedHost}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(redirectUrl);
  }

  const hasAccessToken = Boolean(request.cookies.get("access_token")?.value);

  if (AUTH_ROUTES.has(pathname)) {
    if (hasAccessToken) {
      const isExpiredSessionRecovery =
        pathname === "/login" && request.nextUrl.searchParams.get("session_expired") === "true";
      if (isExpiredSessionRecovery) {
        return NextResponse.next();
      }
      // Authenticated users coming from auth routes go to jobs.
      return NextResponse.redirect(new URL("/jobs", request.url));
    }
    return NextResponse.next();
  }

  // On the app subdomain "/" is just a redirect gate — never show the marketing page here.
  if (pathname === "/") {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL("/jobs", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (LIFECYCLE_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (isInvitePath(pathname)) {
    return NextResponse.next();
  }

  if (!hasAccessToken) {
    try {
      const refreshRes = await fetch(`${getApiBaseUrl()}/v1/internal/auth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      });

      if (refreshRes.ok) {
        const response = NextResponse.next();
        appendSetCookieHeaders(response, refreshRes.headers);
        // Signal to the client that middleware already refreshed the session.
        // The client reads this flag and skips its own POST /auth/refresh attempt,
        // preventing the double-refresh race that causes spurious "session expired".
        response.cookies.set("_sr", "1", {
          httpOnly: false,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 10, // 10 seconds — just long enough for client hydration
          path: "/",
        });
        return response;
      }

      if (refreshRes.status === 401) {
        const showExpired = await refreshUnauthorizedMeansSessionExpired(refreshRes);
        return buildLoginRedirect(request, showExpired);
      }
    } catch {
      // Network failure: plain login (not "session expired").
    }

    return buildLoginRedirect(request, false);
  }

  const stageNormalizationRedirect = await normalizeInvalidStageUrl(request);
  if (stageNormalizationRedirect) {
    return stageNormalizationRedirect;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|public|.*\\..*).*)"],
};
