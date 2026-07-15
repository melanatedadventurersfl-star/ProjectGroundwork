import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedExperienceLevels = new Set(["new", "beginner", "comfortable", "experienced"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();

    if (!email || !firstName || !lastName || body.communicationConsent !== true) {
      return NextResponse.json({ error: "Name, email, and communication consent are required." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase.from("people").select("id, access_status").eq("email", email).maybeSingle();
    if (existing) return NextResponse.json({ duplicate: true, accessStatus: existing.access_status });

    const experienceLevel = allowedExperienceLevels.has(body.experienceLevel) ? body.experienceLevel : "new";
    const { data, error } = await supabase.from("people").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: String(body.phone ?? "").trim() || null,
      experience_level: experienceLevel,
      interests: Array.isArray(body.interests) ? body.interests.slice(0, 12) : [],
      attending_solo: Boolean(body.attendingSolo),
      referral_source: String(body.referralSource ?? "").trim() || null,
      support_notes: String(body.notes ?? "").trim() || null,
      communication_consent: true,
      access_status: "waitlisted",
    }).select("id, access_status").single();

    if (error) throw error;
    return NextResponse.json({ duplicate: false, id: data.id, accessStatus: data.access_status }, { status: 201 });
  } catch (error) {
    console.error("waitlist submission failed", error);
    return NextResponse.json({ error: "The early-access list is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
