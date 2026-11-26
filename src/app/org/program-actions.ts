"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, friendlyDbError, type FormState } from "@/lib/form";
import { programRowSchema } from "@/lib/program-csv";

// Every action re-checks who is signed in. The database security rules then
// make sure they can only change events belonging to their own organisation.

const text = (max: number) => z.string().trim().max(max);

// ---------------------------------------------------------------- import

export async function importProgram(eventId: string, rows: unknown): Promise<FormState> {
  await requireUser();
  const parsed = z.array(programRowSchema).min(1, "There are no rows to import.").max(5000).safeParse(rows);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("import_program", { ev: eventId, rows: parsed.data });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done(`Imported ${data} items.`);
}

// ---------------------------------------------------------------- entries

const lateEntrySchema = z.object({
  section_id: z.uuid("Please choose a section."),
  item_number: text(20).min(1, "Please enter an item number."),
  performer_name: text(200).min(1, "Please enter the performer's name."),
  studio_name: text(200),
  routine_title: text(200),
});

export async function addLateEntry(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = lateEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data: section } = await supabase.from("sections").select("id").eq("id", parsed.data.section_id).eq("event_id", eventId).maybeSingle();
  if (!section) return fail("Please choose a section from this event.");
  const { error } = await supabase.rpc("add_late_entry", {
    sec: parsed.data.section_id,
    p_item_number: parsed.data.item_number,
    p_performer_name: parsed.data.performer_name,
    p_studio_name: parsed.data.studio_name,
    p_routine_title: parsed.data.routine_title,
  });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done(`Late entry ${parsed.data.item_number} added to the end of its section.`);
}

export async function moveEntry(entryId: string, direction: "up" | "down"): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("move_entry", { entry: entryId, direction });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return null;
}

export async function setEntryStatus(entryId: string, status: "entered" | "scratched"): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("entries").update({ status }).eq("id", entryId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to change this entry.");
  refresh();
  return null;
}

const entrySchema = z.object({
  section_id: z.uuid("Please choose a section."),
  item_number: text(20).min(1, "Please enter an item number."),
  performer_name: text(200).min(1, "Please enter the performer's name."),
  studio_name: text(200),
  routine_title: text(200),
});

export async function updateEntry(orgId: string, eventId: string, entryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data, error } = await supabase.from("entries").update(parsed.data).eq("id", entryId).eq("event_id", eventId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to change this entry.");
  revalidatePath(`/org/${orgId}/events/${eventId}/program`);
  redirect(`/org/${orgId}/events/${eventId}/program`);
}

export async function deleteEntry(orgId: string, eventId: string, entryId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("entries").delete().eq("id", entryId).eq("event_id", eventId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to delete this entry.");
  revalidatePath(`/org/${orgId}/events/${eventId}/program`);
  redirect(`/org/${orgId}/events/${eventId}/program`);
}

// ---------------------------------------------------------------- sections and sessions

const optionalWhole = (what: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ error: `${what} must be a whole number.` }).int(`${what} must be a whole number.`).min(0).max(120).nullable());

const sectionSchema = z.object({
  min_age: optionalWhole("Minimum age"),
  max_age: optionalWhole("Maximum age"),
  min_dancers: optionalWhole("Minimum dancers"),
  max_dancers: optionalWhole("Maximum dancers"),
  code: text(20).min(1, "Please enter a section number."),
  name: text(200).min(1, "Please enter the section name."),
  session_id: z.string().transform((v) => (v === "" ? null : v)).pipe(z.uuid().nullable()),
  genre: text(100),
  age_group: text(100),
  entry_fee: z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v.replace(/^\$/, "")))
    .transform((v) => Number(v))
    .pipe(z.number({ error: "Entry fee must be a number, like 25 or 25.50." }).min(0, "Entry fee can't be negative.").max(10000, "That entry fee looks too high.")),
});

function readSection(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  const parsed = sectionSchema.safeParse({
    code: get("code"),
    name: get("name"),
    session_id: get("session_id"),
    genre: get("genre"),
    age_group: get("age_group"),
    entry_fee: get("entry_fee"),
    min_age: get("min_age"),
    max_age: get("max_age"),
    min_dancers: get("min_dancers"),
    max_dancers: get("max_dancers"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const { entry_fee, min_dancers, ...rest } = parsed.data;
  if (rest.min_age != null && rest.max_age != null && rest.min_age > rest.max_age) return { error: "Minimum age can't be more than the maximum age." } as const;
  const minD = Math.max(1, min_dancers ?? 1);
  if (rest.max_dancers != null && (rest.max_dancers < 1 || rest.max_dancers < minD)) return { error: "Maximum dancers must be at least the minimum." } as const;
  return { values: { ...rest, min_dancers: minD, entry_fee_cents: Math.round(entry_fee * 100) } } as const;
}

export async function createSection(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const r = readSection(formData);
  if ("error" in r) return fail(r.error!);

  const supabase = await createSupabase();
  const { data: last } = await supabase.from("sections").select("position").eq("event_id", eventId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("sections").insert({ ...r.values, event_id: eventId, position: (last?.position ?? 0) + 1 });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done(`Section ${r.values.code} added.`);
}

export async function updateSection(sectionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const r = readSection(formData);
  if ("error" in r) return fail(r.error!);

  const supabase = await createSupabase();
  const { data, error } = await supabase.from("sections").update(r.values).eq("id", sectionId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to change this section.");
  refresh();
  return done("Saved.");
}

export async function deleteSection(sectionId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("section_id", sectionId);
  if (count) return fail(`This section still has ${count} items. Move or delete them first.`);
  const { data, error } = await supabase.from("sections").delete().eq("id", sectionId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to delete this section.");
  refresh();
  return done("Section deleted.");
}

const sessionSchema = z.object({
  name: text(100).min(1, "Please enter a session name."),
  session_date: z.string().transform((v) => (v === "" ? null : v)).pipe(z.iso.date().nullable()),
  starts_at: z.string().transform((v) => (v === "" ? null : v)).pipe(z.iso.time({ error: "Please use a valid time." }).nullable()),
});

export async function createSession(eventId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = sessionSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    session_date: String(formData.get("session_date") ?? ""),
    starts_at: String(formData.get("starts_at") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data: last } = await supabase.from("event_sessions").select("position").eq("event_id", eventId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("event_sessions").insert({ ...parsed.data, event_id: eventId, position: (last?.position ?? 0) + 1 });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done(`Session "${parsed.data.name}" added.`);
}

export async function deleteSession(sessionId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("event_sessions").delete().eq("id", sessionId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("You don't have permission to delete this session.");
  refresh();
  return done("Session deleted. Its sections are kept, without a session.");
}
