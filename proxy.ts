import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function sessionToken(): string {
  return createHmac("sha256", process.env.SESSION_SECRET!).update("session").digest("hex");
}

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session")?.value;
  if (session !== sessionToken()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
