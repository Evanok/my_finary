import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function sessionToken(): string {
  return createHmac("sha256", process.env.SESSION_SECRET!).update("session").digest("hex");
}

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();

  const expectedPassword = Buffer.from(process.env.APP_PASSWORD_B64!, "base64").toString("utf8");
  if (login !== process.env.APP_LOGIN || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No maxAge = session cookie (expires when browser closes)
  });
  return res;
}
