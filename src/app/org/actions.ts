"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, friendlyDbError, type FormState } from "@/lib/form";

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date("Please use a valid date.").nullable());

const eventSchema = z.object({
  name: z.string().trim().min(1, "Please enter the event name.").max(200),
  venue_name: z.string().trim().max(200),
  venue_address: z.string().trim().max(300),
  starts_on: z.iso.date("Please choose a start date."),
  ends_on: z.iso.date("Please choose an end date."),
  entries_open_on: optionalDate,
  entries_close_on: optionalDate,
  music_due_on: optionalDate,
  age_as_at: optionalDate,
  contact_email: z.union([z.literal(""), z.email("That contact email doesn't look right.")]),
  contact_phone: z.string().trim().max(50),
  description: z.string().trim().max(5000),
});

function readEvent(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return eventSchema.safeParse({
    name: get("name"),
    venue_name: get("venue_name"),
    venue_address: get("venue_address"),
    starts_on: get("starts_on"),
    ends_on: get("ends_on") || get("starts_on"),
    entries_open_on: get("entries_open_on"),
    entries_close_on: get("entries_close_on"),
    music_due_on: get("music_due_on"),
    age_as_at: get("age_as_at"),
    contact_email: get("contact_email").trim(),
    contact_phone: get("contact_phone"),
    description: get("description"),
  });
}

export async function createEvent(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = readEvent(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...parsed.data, organisation_id: orgId })
    .select("id")
    .single();
  if (error) return fail(friendlyDbError(error.message));
  revalidatePath(`/org/${orgId}`);
  redirect(`/org/${orgId}/events/${data.id}`);
}

export async function updateEvent(orgId: string, eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = readEvent(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("events")
    .update(parsed.data)
    .eq("id", eventId)
    .eq("organisation_id", orgId)
    .select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to change this event.");
  refresh();
  return done("Event details saved.");
}

export async function setEventStatus(orgId: string, eventId: string, status: "draft" | "published"): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .eq("organisation_id", orgId)
    .select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to change this event.");
  refresh();
  return done(status === "published" ? "Published. The public event page is now live." : "Moved back to draft. The public page is hidden.");
}

export async function addMember(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const email = String(formData.get("email") ?? "").trim();
  const role = formData.get("role") === "owner" ? "owner" : "staff";
  if (!z.email().safeParse(email).success) return fail("Please enter a valid email address.");

  const supabase = await createSupabase();
  const { error } = await supabase.rpc("add_organisation_member", { org: orgId, member_email: email, member_role: role });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done(`Added ${email}.`);
}

export async function removeMember(orgId: string, userId: string): Promise<FormState> {
  const me = await requireUser();
  if (me.id === userId) return fail("You can't remove yourself.");
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("organisation_members")
    .delete()
    .eq("organisation_id", orgId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("Only the owner can remove people.");
  refresh();
  return done("Removed.");
}
