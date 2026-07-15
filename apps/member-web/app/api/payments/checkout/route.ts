import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const { registrationId } = await request.json();
    if (!registrationId) return NextResponse.json({ error: "Registration is required." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data: registration, error } = await supabase
      .from("registrations")
      .select("id, lunch_selected, donation_cents, people(email, first_name, last_name), experiences(title, lunch_cents)")
      .eq("id", registrationId)
      .single();
    if (error || !registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

    const experience = Array.isArray(registration.experiences) ? registration.experiences[0] : registration.experiences;
    const person = Array.isArray(registration.people) ? registration.people[0] : registration.people;
    const lunchCents = registration.lunch_selected ? Number(experience?.lunch_cents ?? 0) : 0;
    const donationCents = Number(registration.donation_cents ?? 0);
    const lineItems = [];

    if (lunchCents > 0) {
      lineItems.push({ price_data: { currency: "usd", product_data: { name: `${experience?.title ?? "MA experience"} lunch` }, unit_amount: lunchCents }, quantity: 1 });
    }
    if (donationCents > 0) {
      lineItems.push({ price_data: { currency: "usd", product_data: { name: "Support Melanated Adventurers" }, unit_amount: donationCents }, quantity: 1 });
    }
    if (lineItems.length === 0) return NextResponse.json({ checkoutRequired: false });

    const baseUrl = process.env.APP_BASE_URL ?? new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: person?.email ?? undefined,
      line_items: lineItems,
      success_url: `${baseUrl}/castaway?payment=success`,
      cancel_url: `${baseUrl}/castaway?payment=canceled`,
      metadata: { registration_id: registration.id },
    });

    await supabase.from("payments").insert({
      registration_id: registration.id,
      provider_session_id: session.id,
      lunch_cents: lunchCents,
      donation_cents: donationCents,
      total_cents: lunchCents + donationCents,
      status: "pending",
    });

    return NextResponse.json({ checkoutRequired: true, url: session.url });
  } catch (error) {
    console.error("checkout creation failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 503 });
  }
}
