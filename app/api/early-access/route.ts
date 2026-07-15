import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const email = String(body.email || "").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Enter your first and last name." }, { status: 400 });
  }

  if (!emailOk) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!body.experienceLevel || !body.attendsAlone || !body.heardAboutUs || !body.consent) {
    return NextResponse.json({ error: "Please complete the required fields." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    prospectiveMember: {
      firstName,
      lastName,
      email,
      phone: String(body.phone || "").trim(),
      experienceLevel: String(body.experienceLevel),
      attendsAlone: String(body.attendsAlone),
      heardAboutUs: String(body.heardAboutUs),
      supportNeeds: String(body.supportNeeds || "").trim(),
      interests: Array.isArray(body.interests) ? body.interests : [],
      consent: Boolean(body.consent),
    },
  });
}
