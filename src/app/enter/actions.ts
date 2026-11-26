"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, type FormState } from "@/lib/form";

function friendly(message: string) {
  if (message.includes("orders_one_open_cart")) return "Please try again.";
  return message;
}

const cartSchema = z.object({
  section_id: z.uuid("Please choose a section."),
  dancer_ids: z.array(z.uuid()).min(1, "Please tick at least one dancer."),
  routine_title: z.string().trim().max(200),
});

export async function addToCart(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = cartSchema.safeParse({
    section_id: String(formData.get("section_id") ?? ""),
    dancer_ids: formData.getAll("dancer_ids").map(String),
    routine_title: String(formData.get("routine_title") ?? ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { error } = await supabase.rpc("add_to_cart", {
    sec: parsed.data.section_id,
    p_dancer_ids: parsed.data.dancer_ids,
    p_routine_title: parsed.data.routine_title,
  });
  if (error) return fail(friendly(error.message));
  refresh();
  return done("Added to your cart.");
}

export async function removeFromCart(itemId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("remove_from_cart", { item: itemId });
  if (error) return fail(friendly(error.message));
  refresh();
  return done("Removed.");
}
