import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  try {
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
    const res = await fetch(`${apiBase}/v1/internal/me`, {
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
