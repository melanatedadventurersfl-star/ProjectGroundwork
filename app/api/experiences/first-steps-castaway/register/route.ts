import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    if (!email || !firstName || !lastName) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data: experience, error: experienceError } = await supabase.from("experiences").select("id, capacity").eq("slug", "first-steps-castaway").single();
    if (experienceError) throw experienceError;

    let { data: person } = await supabase.from("people").select("id").eq("email", email).maybeSingle();
    if (!person) {
      const { data: created, error } = await supabase.from("people").insert({
        first_name: firstName,
        last_name: lastName,
        email,
        experience_level: "new",
        communication_consent: false,
        access_status: "waitlisted",
      }).select("id").single();
      if (error) throw error;
      person = created;
    }

    const { data: existing } = await supabase.from("registrations").select("id").eq("experience_id", experience.id).eq("person_id", person.id).maybeSingle();
    if (existing) return NextResponse.json({ duplicate: true });

    const donationCents = Math.max(0, Math.min(Number(body.donationCents) || 0, 100000));
    const lunchSelected = Boolean(body.lunchSelected);
    const { data: registration, error } = await supabase.from("registrations").insert({
      experience_id: experience.id,
      person_id: person.id,
      is_newcomer: Boolean(body.isNewcomer),
      lunch_selected: lunchSelected,
      lunch_payment_status: lunchSelected ? "pending" : "not_selected",
      donation_cents: donationCents,
      welcome_contact_opt_in: Boolean(body.welcomeContactOptIn),
      status: "registered",
    }).select("id").single();
    if (error) throw error;

    return NextResponse.json({ duplicate: false, registrationId: registration.id, paymentRequired: lunchSelected || donationCents > 0 }, { status: 201 });
  } catch (error) {
    console.error("Castaway registration failed", error);
    return NextResponse.json({ error: "Registration is temporarily unavailable." }, { status: 503 });
  }
}
