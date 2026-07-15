import { NextResponse } from "next/server";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appaPyt9IRCoD0i80";
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_PATHFINDERS_TABLE_ID || "tbllReIVhcWRLmwSs";

function escapeFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const firstName = String(body.firstName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
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

    const airtableToken = process.env.AIRTABLE_TOKEN;
    if (!airtableToken) {
      console.error("AIRTABLE_TOKEN is not configured.");
      return NextResponse.json(
        { error: "The invitation database is not available yet. Please try again shortly." },
        { status: 503 }
      );
    }

    const tableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    const duplicateFormula = `LOWER({Email})='${escapeFormulaValue(email)}'`;
    const duplicateResponse = await fetch(
      `${tableUrl}?maxRecords=1&filterByFormula=${encodeURIComponent(duplicateFormula)}`,
      {
        headers: { Authorization: `Bearer ${airtableToken}` },
        cache: "no-store",
      }
    );

    if (!duplicateResponse.ok) {
      const details = await duplicateResponse.text();
      console.error("Airtable duplicate check failed:", details);
      return NextResponse.json(
        { error: "We could not verify your request. Please try again." },
        { status: 502 }
      );
    }

    const duplicateData = await duplicateResponse.json();
    if (Array.isArray(duplicateData.records) && duplicateData.records.length > 0) {
      return NextResponse.json(
        { error: "A Pathfinder invitation request has already been submitted with this email address." },
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
              Email: email,
              Location: location,
              Socials: socials || undefined,
              Response: fit,
              Status: "Requested",
              "Commitment Accepted": true,
              "Submitted At": new Date().toISOString(),
            },
          },
        ],
        typecast: true,
      }),
    });

    if (!createResponse.ok) {
      const details = await createResponse.text();
      console.error("Airtable record creation failed:", details);
      return NextResponse.json(
        { error: "Your request could not be saved. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Pathfinder invitation submission failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while submitting your request." },
      { status: 500 }
    );
  }
}
