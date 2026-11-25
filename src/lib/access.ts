import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";

/**
 * Load an organisation the signed-in person can manage.
 * The database security rules decide: if they can't see it, the page shows "not found".
 */
export async function loadOrganisation(orgId: string) {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: org } = await supabase.from("organisations").select("id, name, contact_email").eq("id", orgId).maybeSingle();
  if (!org) notFound();

  const { data: me } = await supabase
    .from("organisation_members")
    .select("role")
    .eq("organisation_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  const isOwner = me?.role === "owner" || user.isPlatformAdmin;
  if (!me && !user.isPlatformAdmin) notFound();

  return { user, supabase, org, isOwner };
}

/** Load an event the signed-in person can manage. */
export async function loadManagedEvent(orgId: string, eventId: string) {
  const ctx = await loadOrganisation(orgId);
  const { data: event } = await ctx.supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!event) notFound();
  return { ...ctx, event };
}
