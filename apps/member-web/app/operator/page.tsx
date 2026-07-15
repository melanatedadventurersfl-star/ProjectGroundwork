import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const statuses = ["waitlisted", "under_review", "approved", "invited", "activated", "paused", "declined"] as const;
type AccessStatus = typeof statuses[number];

async function updateStatus(formData: FormData) {
  "use server";
  const { supabase, personId: actorId } = await requireOperator();
  const personId = String(formData.get("personId") ?? "");
  const status = String(formData.get("status") ?? "") as AccessStatus;
  const cohort = String(formData.get("cohort") ?? "").trim() || null;
  if (!personId || !statuses.includes(status)) return;

  const { data: existing } = await supabase.from("people").select("access_status").eq("id", personId).single();
  if (!existing) return;

  const updates: Record<string, string | null> = { access_status: status, cohort };
  if (status === "approved") updates.approved_at = new Date().toISOString();
  if (status === "invited") updates.invited_at = new Date().toISOString();
  const { error } = await supabase.from("people").update(updates).eq("id", personId);
  if (error) throw error;

  await supabase.from("access_status_history").insert({
    person_id: personId,
    from_status: existing.access_status,
    to_status: status,
    actor_id: actorId,
    cohort,
    reason: cohort ? `Assigned to ${cohort}` : null,
  });
  revalidatePath("/operator");
}

async function sendInvitation(formData: FormData) {
  "use server";
  const { supabase, personId: actorId } = await requireOperator();
  const personId = String(formData.get("personId") ?? "");
  if (!personId) return;

  const { data: person } = await supabase.from("people").select("email, access_status, cohort").eq("id", personId).single();
  if (!person || !["approved", "invited"].includes(person.access_status)) return;

  const admin = createSupabaseAdminClient();
  const redirectTo = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/auth/callback`;
  const { error } = await admin.auth.admin.inviteUserByEmail(person.email, { redirectTo });
  if (error) throw error;

  await supabase.from("people").update({ access_status: "invited", invited_at: new Date().toISOString() }).eq("id", personId);
  await supabase.from("access_status_history").insert({
    person_id: personId,
    from_status: person.access_status,
    to_status: "invited",
    actor_id: actorId,
    cohort: person.cohort,
    reason: "Invitation email sent",
  });
  revalidatePath("/operator");
}

export default async function OperatorPage() {
  const { supabase } = await requireOperator();
  const { data } = await supabase.from("people").select("id, first_name, last_name, email, experience_level, interests, attending_solo, created_at, access_status, cohort").order("created_at", { ascending: false });
  const people = data ?? [];
  const counts = statuses.reduce<Record<string, number>>((result, status) => { result[status] = people.filter((person) => person.access_status === status).length; return result; }, {});

  return <main>
    <section className="section"><p className="eyebrow">Operator workspace</p><h1>Early-access queue</h1><p className="lede">Review prospective members, place them into cohorts, and preserve an auditable invitation history.</p><div className="grid"><article className="card"><div className="stat">{people.length}</div><p>Total prospective members</p></article><article className="card"><div className="stat">{counts.waitlisted ?? 0}</div><p>Awaiting review</p></article><article className="card"><div className="stat">{(counts.invited ?? 0) + (counts.activated ?? 0)}</div><p>Invited or activated</p></article></div></section>
    <section className="section"><div className="tableWrap panel"><table><thead><tr><th>Prospective member</th><th>Signals</th><th>Joined</th><th>Access control</th></tr></thead><tbody>
      {people.map((person) => <tr key={person.id}><td><strong>{person.first_name} {person.last_name}</strong><br/><span className="muted">{person.email}</span></td><td>{person.experience_level}<br/>{person.attending_solo ? "Often attends solo" : ""}<br/><span className="muted">{person.interests?.join(", ")}</span></td><td>{new Date(person.created_at).toLocaleDateString()}</td><td><form action={updateStatus}><input type="hidden" name="personId" value={person.id}/><label>Cohort<input name="cohort" defaultValue={person.cohort ?? ""} placeholder="Cohort 1"/></label><label>Status<select name="status" defaultValue={person.access_status}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><button type="submit">Save</button></form>{["approved", "invited"].includes(person.access_status) && <form action={sendInvitation}><input type="hidden" name="personId" value={person.id}/><button className="button secondary" type="submit">{person.access_status === "invited" ? "Resend invitation" : "Send invitation"}</button></form>}</td></tr>)}
      {people.length === 0 && <tr><td colSpan={4}>No prospective members are waiting yet.</td></tr>}
    </tbody></table></div></section>
  </main>;
}
