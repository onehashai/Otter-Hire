import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  try {
    // Use internal Docker network URL if available (avoids slow host-gateway on Mac)
    const apiBase = (
      process.env.NEXT_INTERNAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      ""
    ).replace(/\/$/, "");
    const fetchUrl = apiBase.endsWith("/v1")
      ? `${apiBase}/internal/me`
      : `${apiBase}/v1/internal/me`;
    const res = await fetch(fetchUrl, {
      headers: {
        cookie: request.headers.get("cookie") || "",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    return NextResponse.json({ authenticated: res.ok }, { status: 200 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
