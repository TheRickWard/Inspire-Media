"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, friendlyDbError, type FormState } from "@/lib/form";

const orgSchema = z.object({
  name: z.string().trim().min(1, "Please enter the organisation's name.").max(200),
  contact_email: z.union([z.literal(""), z.email("That contact email doesn't look right.")]),
  owner_email: z.union([z.literal(""), z.email("That owner email doesn't look right.")]),
});

export async function createOrganisation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    contact_email: String(formData.get("contact_email") ?? "").trim(),
    owner_email: String(formData.get("owner_email") ?? "").trim(),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data: org, error } = await supabase
    .from("organisations")
    .insert({ name: parsed.data.name, contact_email: parsed.data.contact_email || null })
    .select("id")
    .single();
  if (error) return fail(friendlyDbError(error.message));

  if (parsed.data.owner_email) {
    const { error: memberError } = await supabase.rpc("add_organisation_member", {
      org: org.id,
      member_email: parsed.data.owner_email,
      member_role: "owner",
    });
    if (memberError) {
      refresh();
      return fail(`Organisation created, but the owner wasn't added: ${friendlyDbError(memberError.message)}`);
    }
  }

  refresh();
  return done(`Created ${parsed.data.name}.`);
}
