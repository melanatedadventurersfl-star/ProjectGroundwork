import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireOperator() {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login?next=/operator");

  const { data: person } = await sessionClient
    .from("people")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!person) redirect("/access-pending");

  const { data: role } = await sessionClient
    .from("member_roles")
    .select("role")
    .eq("person_id", person.id)
    .in("role", ["operator", "administrator"])
    .maybeSingle();

  if (!role) redirect("/access-pending");

  return {
    supabase: createSupabaseAdminClient(),
    user,
    personId: person.id,
    role: role.role as "operator" | "administrator",
  };
}
