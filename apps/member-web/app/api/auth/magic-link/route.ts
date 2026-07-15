import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, next } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!normalizedEmail) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: person } = await supabase.from("people").select("id, access_status").eq("email", normalizedEmail).maybeSingle();
    if (!person || !["invited", "activated"].includes(person.access_status)) {
      return NextResponse.json({ error: "This email has not been invited yet." }, { status: 403 });
    }

    const origin = new URL(request.url).origin;
    const safeNext = typeof next === "string" && next.startsWith("/") ? next : "/member";
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("magic link failed", error);
    return NextResponse.json({ error: "Unable to send sign-in link." }, { status: 503 });
  }
}
