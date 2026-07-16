import { createHash } from "crypto";
import { NextResponse } from "next/server";

const NOTION_DATA_SOURCE_ID =
  process.env.NOTION_PATHFINDER_DATA_SOURCE_ID || "94d17e55-23a5-4289-a8ca-ffa050b2d9b1";
const NOTION_VERSION = "2026-03-11";

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return nationalNumber.length === 10 ? `+1${nationalNumber}` : "";
}

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
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
    const location = String(body.location || "").trim();
    const socials = String(body.socials || "").trim();
    const fit = String(body.fit || "").trim();
    const marketingOptIn = Boolean(body.marketingOptIn);
    const acknowledgements = Array.isArray(body.acknowledgements) ? body.acknowledgements : [];

    if (!firstName || !lastName || !location) {
      return NextResponse.json({ error: "Please enter your first name, last name, and location." }, { status: 400 });
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
    if (acknowledgements.length !== 4 || !acknowledgements.every(Boolean)) {
      return NextResponse.json({ error: "Please accept each part of the Pathfinder Commitment." }, { status: 400 });
    }

    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) {
      console.error("NOTION_TOKEN is not configured.");
      return NextResponse.json(
        { error: "The invitation database is not available yet. Please try again shortly." },
        { status: 503 }
      );
    }

    const queryResponse = await fetch(
      `https://api.notion.com/v1/data_sources/${NOTION_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        headers: notionHeaders(notionToken),
        cache: "no-store",
        body: JSON.stringify({
          page_size: 3,
          filter: {
            or: [
              { property: "Email", email: { equals: email } },
              {
                and: [
                  { property: "First Name", rich_text: { equals: firstName } },
                  { property: "Last Name", rich_text: { equals: lastName } },
                ],
              },
            ],
          },
        }),
      }
    );

    if (!queryResponse.ok) {
      console.error("Notion duplicate check failed:", await queryResponse.text());
      return NextResponse.json({ error: "We could not verify your request. Please try again." }, { status: 502 });
    }

    const duplicateData = await queryResponse.json();
    if (Array.isArray(duplicateData.results) && duplicateData.results.length > 0) {
      return NextResponse.json(
        { error: "A Pathfinder application has already been submitted with this name or email address." },
        { status: 409 }
      );
    }

    const submittedAt = new Date().toISOString();
    const createResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(notionToken),
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: NOTION_DATA_SOURCE_ID },
        properties: {
          Applicant: { title: [{ text: { content: `${firstName} ${lastName}` } }] },
          "First Name": { rich_text: [{ text: { content: firstName } }] },
          "Last Name": { rich_text: [{ text: { content: lastName } }] },
          Email: { email },
          Phone: { phone_number: phone },
          Location: { rich_text: [{ text: { content: location } }] },
          "Social Profiles": socials ? { rich_text: [{ text: { content: socials } }] } : { rich_text: [] },
          "Pathfinder Response": { rich_text: [{ text: { content: fit } }] },
          Status: { select: { name: "Requested" } },
          "Commitment Accepted": { checkbox: true },
          "Marketing Opt-In": { checkbox: marketingOptIn },
          "Submitted At": { date: { start: submittedAt } },
        },
      }),
    });

    if (!createResponse.ok) {
      console.error("Notion application creation failed:", await createResponse.text());
      return NextResponse.json({ error: "Your request could not be saved. Please try again." }, { status: 502 });
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
