import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim();
  const location = String(body.location || "").trim();
  const fit = String(body.fit || "").trim();
  const acknowledgements = Array.isArray(body.acknowledgements) ? body.acknowledgements : [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!firstName || !location) {
    return NextResponse.json({ error: "Please enter your name and location." }, { status: 400 });
  }

  if (!emailOk) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (fit.length < 50) {
    return NextResponse.json({ error: "Please tell us a little more about why you are a strong fit." }, { status: 400 });
  }

  if (acknowledgements.length !== 4 || !acknowledgements.every(Boolean)) {
    return NextResponse.json({ error: "Please acknowledge each testing expectation." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    application: { firstName, email, location, fit, acknowledgements },
  });
}
