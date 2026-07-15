import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  try {
    const payload = await request.text();
    const event = getStripe().webhooks.constructEvent(payload, signature, secret);
    const supabase = createSupabaseAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const registrationId = session.metadata?.registration_id;
      if (registrationId) {
        await supabase.from("payments").update({
          provider_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          status: "paid",
          updated_at: new Date().toISOString(),
        }).eq("provider_session_id", session.id);

        await supabase.from("registrations").update({
          lunch_payment_status: "paid",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        }).eq("id", registrationId);
      }
    }

    if (event.type === "checkout.session.expired") {
      await supabase.from("payments").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("provider_session_id", event.data.object.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
}
