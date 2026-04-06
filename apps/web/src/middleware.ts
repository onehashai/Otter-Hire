import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isCareersUuidSegment,
  parseLegacyCareersOrgSlug,
} from "@/lib/public-careers-org";

const AUTH_ROUTES = new Set(["/login", "/signup"]);
const LIFECYCLE_ROUTES = new Set(["/verify", "/onboarding"]);
const PUBLIC_ROUTES = new Set(["/health", "/favicon.ico"]);

function getExpectedAppHost(): string | null {
  const subdomain = process.env.NEXT_PUBLIC_APP_SUBDOMAIN;
  const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST;

  if (!subdomain || !rootHost) return null;
  return `${subdomain}.${rootHost}`;
}

function getJobsSubdomain(): string {
  return process.env.NEXT_PUBLIC_JOBS_SUBDOMAIN || "jobs";
}

function isInvitePath(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

function isJobsHost(host: string): boolean {
  const jobsSubdomain = getJobsSubdomain();
  return host.startsWith(`${jobsSubdomain}.`);
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

function getAppSubdomainUrl(pathname: string, rootHost: string): string {
  const appSubdomain = process.env.NEXT_PUBLIC_APP_SUBDOMAIN || "app";
  const protocol =
    rootHost.includes("localhost") || rootHost.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${appSubdomain}.${rootHost}${pathname}`;
}

export function middleware(request: NextRequest) {
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

  // Redirect to app subdomain if configured
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
      // Dashboard route is intentionally disabled for MVP; use root landing.
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|public|.*\\..*).*)"],
};
