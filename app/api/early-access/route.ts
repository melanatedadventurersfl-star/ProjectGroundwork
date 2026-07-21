import { createHash } from "crypto";
import { NextResponse } from "next/server";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return nationalNumber.length === 10 ? `+1${nationalNumber}` : "";
}

async function subscribeToMailchimp(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !serverPrefix || !audienceId) {
    console.warn("Mailchimp is not configured; application saved without subscription.");
    return false;
  }

  const subscriberHash = createHash("md5").update(input.email.toLowerCase()).digest("hex");
  const memberUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members/${subscriberHash}`;
  const authorization = `Basic ${Buffer.from(`pathfinder:${apiKey}`).toString("base64")}`;

  const memberResponse = await fetch(memberUrl, {
    method: "PUT",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({
      email_address: input.email,
      status_if_new: "subscribed",
      status: "subscribed",
      merge_fields: { FNAME: input.firstName, LNAME: input.lastName, PHONE: input.phone },
    }),
  });

  if (!memberResponse.ok) {
    console.error("Mailchimp subscription failed:", await memberResponse.text());
    return false;
  }

  const tagResponse = await fetch(`${memberUrl}/tags`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ tags: [{ name: "Pathfinder Applicant", status: "active" }] }),
  });

  if (!tagResponse.ok) console.error("Mailchimp tag assignment failed:", await tagResponse.text());
  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizeUsPhone(String(body.phone || ""));
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim().toUpperCase();
    const socials = String(body.socials || "").trim();
    const fit = String(body.fit || "").trim();
    const photoCaption = String(body.photoCaption || "").trim();
    const marketingOptIn = Boolean(body.marketingOptIn);
    const acknowledgements = Array.isArray(body.acknowledgements) ? body.acknowledgements : [];
    const photo = body.photo && typeof body.photo === "object" ? body.photo : null;

    if (!firstName || !lastName || !city || !state) {
      return NextResponse.json({ error: "Please enter your first name, last name, city, and state." }, { status: 400 });
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      return NextResponse.json({ error: "Enter a valid two-letter state abbreviation." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid 10-digit US phone number." }, { status: 400 });
    }
    if (socials.length > 500) {
      return NextResponse.json({ error: "Please shorten the social profiles entry." }, { status: 400 });
    }
    if (fit.length < 50) {
      return NextResponse.json({ error: "Your Pathfinder response must be at least 50 characters." }, { status: 400 });
    }
    if (photoCaption.length > 300) {
      return NextResponse.json({ error: "Please shorten the photo caption to 300 characters or fewer." }, { status: 400 });
    }
    if (acknowledgements.length !== 4 || !acknowledgements.every(Boolean)) {
      return NextResponse.json({ error: "Please accept each part of the Pathfinder Commitment." }, { status: 400 });
    }

    if (photo) {
      const photoType = String(photo.type || "");
      const photoSize = Number(photo.size || 0);
      const photoData = String(photo.data || "");
      if (!ALLOWED_PHOTO_TYPES.includes(photoType)) {
        return NextResponse.json({ error: "Photo must be a JPG, PNG, or WebP image." }, { status: 400 });
      }
      if (!photoSize || photoSize > MAX_PHOTO_BYTES || !photoData) {
        return NextResponse.json({ error: "Photo must be 4 MB or smaller." }, { status: 400 });
      }
    }

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const webhookSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

    if (!webhookUrl) {
      console.error("GOOGLE_SHEETS_WEBHOOK_URL is not configured.");
      return NextResponse.json(
        { error: "The invitation database is not available yet. Please try again shortly." },
        { status: 503 }
      );
    }

    const sheetResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        secret: webhookSecret || "",
        submittedAt: new Date().toISOString(),
        firstName,
        lastName,
        email,
        phone,
        city,
        state,
        socials,
        fit,
        photo,
        photoCaption,
        status: "Requested",
        commitmentAccepted: true,
        marketingOptIn,
      }),
    });

    const responseText = await sheetResponse.text();
    let sheetData: { ok?: boolean; duplicate?: boolean; error?: string } = {};
    try {
      sheetData = responseText ? JSON.parse(responseText) : {};
    } catch {
      console.error("Google Sheets webhook returned invalid JSON:", responseText);
    }

    if (sheetResponse.status === 409 || sheetData.duplicate) {
      return NextResponse.json(
        { error: "A Pathfinder application has already been submitted with this email address." },
        { status: 409 }
      );
    }

    if (!sheetResponse.ok || !sheetData.ok) {
      console.error("Google Sheets submission failed:", responseText);
      return NextResponse.json({ error: sheetData.error || "Your request could not be saved. Please try again." }, { status: 502 });
    }

    const subscribed = marketingOptIn
      ? await subscribeToMailchimp({ firstName, lastName, email, phone })
      : false;

    return NextResponse.json({ ok: true, subscribed });
  } catch (error) {
    console.error("Pathfinder invitation submission failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while submitting your request." },
      { status: 500 }
    );
  }
}
