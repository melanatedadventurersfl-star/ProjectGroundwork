import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (process.env.SIGNUP_WEBHOOK_URL) {
    await fetch(process.env.SIGNUP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, source: "early-access-landing-page" }),
    });
  }

  return NextResponse.json({ ok: true });
}
