import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  return NextResponse.json({ ok: true, name, email });
}
