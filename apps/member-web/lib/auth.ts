import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireOperator() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/operator");

  const { data: role } = await supabase
    .from("person_roles")
    .select("role")
    .eq("person_id", user.id)
    .in("role", ["operator", "administrator"])
    .maybeSingle();

  if (!role) redirect("/access-pending");
  return { supabase, user, role: role.role as "operator" | "administrator" };
}
