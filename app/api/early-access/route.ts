import { createHash } from "crypto";
import { NextResponse } from "next/server";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appaPyt9IRCoD0i80";
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_PATHFINDERS_TABLE_ID || "tbllReIVhcWRLmwSs";

function escapeFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

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
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: input.email,
      status_if_new: "subscribed",
      status: "subscribed",
      merge_fields: {
        FNAME: input.firstName,
        LNAME: input.lastName,
        PHONE: input.phone,
      },
    }),
  });

  if (!memberResponse.ok) {
    const details = await memberResponse.text();
    console.error("Mailchimp subscription failed:", details);
    return false;
  }

  const tagResponse = await fetch(`${memberUrl}/tags`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags: [{ name: "Pathfinder Applicant", status: "active" }] }),
  });

  if (!tagResponse.ok) {
    console.error("Mailchimp tag assignment failed:", await tagResponse.text());
  }

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
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!firstName || !lastName || !location) {
      return NextResponse.json({ error: "Please enter your first name, last name, and location." }, { status: 400 });
    }

    if (!emailOk) {
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

    const airtableToken = process.env.AIRTABLE_TOKEN;
    if (!airtableToken) {
      console.error("AIRTABLE_TOKEN is not configured.");
      return NextResponse.json(
        { error: "The invitation database is not available yet. Please try again shortly." },
        { status: 503 }
      );
    }

    const tableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    const escapedEmail = escapeFormulaValue(email);
    const escapedFirstName = escapeFormulaValue(firstName.toLowerCase());
    const escapedLastName = escapeFormulaValue(lastName.toLowerCase());
    const duplicateFormula = `OR(LOWER({Email})='${escapedEmail}',AND(LOWER({Name})='${escapedFirstName}',LOWER({Last Name})='${escapedLastName}'))`;
    const duplicateResponse = await fetch(
      `${tableUrl}?maxRecords=3&filterByFormula=${encodeURIComponent(duplicateFormula)}`,
      {
        headers: { Authorization: `Bearer ${airtableToken}` },
        cache: "no-store",
      }
    );

    if (!duplicateResponse.ok) {
      console.error("Airtable duplicate check failed:", await duplicateResponse.text());
      return NextResponse.json({ error: "We could not verify your request. Please try again." }, { status: 502 });
    }

    const duplicateData = await duplicateResponse.json();
    if (Array.isArray(duplicateData.records) && duplicateData.records.length > 0) {
      return NextResponse.json(
        { error: "A Pathfinder application has already been submitted with this name or email address." },
        { status: 409 }
      );
    }

    const createResponse = await fetch(tableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${airtableToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: firstName,
              "Last Name": lastName,
              Email: email,
              Phone: phone,
              Location: location,
              Socials: socials || undefined,
              Response: fit,
              Status: "Requested",
              "Commitment Accepted": true,
              "Marketing Opt-In": marketingOptIn,
              "Submitted At": new Date().toISOString(),
            },
          },
        ],
        typecast: true,
      }),
    });

    if (!createResponse.ok) {
      console.error("Airtable record creation failed:", await createResponse.text());
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
