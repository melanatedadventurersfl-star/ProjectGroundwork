import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MemberHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/member");

  const { data: person } = await supabase.from("people").select("first_name, access_status").eq("email", user.email).maybeSingle();
  if (!person || !["invited", "activated"].includes(person.access_status)) redirect("/access-pending");

  if (person.access_status === "invited") {
    await supabase.from("people").update({ access_status: "activated", activated_at: new Date().toISOString() }).eq("email", user.email);
  }

  return <main><section className="section"><p className="eyebrow">Active member access</p><h1>Welcome, {person.first_name}.</h1><p className="lede">Your account is active. Release 0.1 starts with clear experience briefs, registration, newcomer support, and thoughtful follow-up.</p><div className="actions"><Link className="button" href="/castaway">View the Castaway pilot</Link></div></section></main>;
}
