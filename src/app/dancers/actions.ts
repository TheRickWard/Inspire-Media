"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, friendlyDbError, type FormState } from "@/lib/form";
import { todayInSydney } from "@/lib/format";

const dancerSchema = z.object({
  full_name: z.string().trim().min(1, "Please enter the dancer's name.").max(200),
  date_of_birth: z.iso
    .date("Please enter a valid date of birth.")
    .refine((d) => d < todayInSydney(), "Date of birth must be in the past.")
    .refine((d) => d > "1920-01-01", "Please check the date of birth."),
  studio_name: z.string().trim().max(200),
});

function read(formData: FormData) {
  return dancerSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    date_of_birth: String(formData.get("date_of_birth") ?? ""),
    studio_name: String(formData.get("studio_name") ?? ""),
  });
}

export async function addDancer(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = read(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createSupabase();
  const { error } = await supabase.from("dancers").insert({ ...parsed.data, owner_id: user.id });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done(`Added ${parsed.data.full_name}.`);
}

export async function updateDancer(dancerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = read(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("dancers").update(parsed.data).eq("id", dancerId).select("id");
  if (error) return fail(friendlyDbError(error.message));
  if (!data?.length) return fail("That dancer isn't yours.");
  refresh();
  return done("Saved.");
}

export async function deleteDancer(dancerId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("delete_dancer", { dancer: dancerId });
  if (error) return fail(friendlyDbError(error.message));
  refresh();
  return done("Removed.");
}
