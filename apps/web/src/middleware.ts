import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = new Set(["/login", "/signup"]);
const LIFECYCLE_ROUTES = new Set(["/verify", "/onboarding"]);
const PUBLIC_ROUTES = new Set(["/health", "/favicon.ico"]);

function getExpectedHost(): string | null {
  const subdomain = process.env.NEXT_PUBLIC_APP_SUBDOMAIN;
  const rootHost = process.env.NEXT_PUBLIC_APP_ROOT_HOST;
  
  if (!subdomain || !rootHost) return null;
  return `${subdomain}.${rootHost}`;
}

function isInvitePath(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const currentHost = request.headers.get("host") || "";
  
  // Redirect to subdomain if configured
  const expectedHost = getExpectedHost();
  if (expectedHost && currentHost !== expectedHost) {
    const protocol = currentHost.includes("localhost") || currentHost.includes("127.0.0.1") ? "http" : "https";
    const redirectUrl = `${protocol}://${expectedHost}${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(redirectUrl);
  }
  
  const hasAccessToken = Boolean(request.cookies.get("access_token")?.value);

  if (AUTH_ROUTES.has(pathname)) {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
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
  matcher: ["/((?!_next/static|_next/image|api|.*\\..*).*)"],
};
