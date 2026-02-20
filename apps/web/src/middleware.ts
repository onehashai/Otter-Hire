import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = new Set(["/login", "/signup"]);
const LIFECYCLE_ROUTES = new Set(["/verify", "/onboarding"]);
const PUBLIC_ROUTES = new Set(["/health", "/favicon.ico"]);
const APP_LANDING_ROUTE = "/";

function isInvitePath(pathname: string): boolean {
  return pathname.startsWith("/invite/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = Boolean(request.cookies.get("access_token")?.value);

  if (AUTH_ROUTES.has(pathname)) {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL(APP_LANDING_ROUTE, request.url));
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
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
