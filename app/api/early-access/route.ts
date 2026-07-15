import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim();
  const location = String(body.location || "").trim();
  const socials = String(body.socials || "").trim();
  const fit = String(body.fit || "").trim();
  const acknowledgements = Array.isArray(body.acknowledgements) ? body.acknowledgements : [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!firstName || !location) {
    return NextResponse.json({ error: "Please enter your name and location." }, { status: 400 });
  }

  if (!emailOk) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (socials.length > 500) {
    return NextResponse.json({ error: "Please shorten the social profiles entry." }, { status: 400 });
  }

  if (fit.length < 50) {
    return NextResponse.json({ error: "Please tell us a little more about why you would make a strong Pathfinder." }, { status: 400 });
  }

  if (acknowledgements.length !== 4 || !acknowledgements.every(Boolean)) {
    return NextResponse.json({ error: "Please accept each part of the Pathfinder Commitment." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    request: { firstName, email, location, socials, fit, acknowledgements },
  });
}
