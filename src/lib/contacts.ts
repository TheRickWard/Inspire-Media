import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Names and emails of account holders (only call after checking the person organises the event). */
export async function contactsFor(userIds: string[]) {
  const contacts = new Map<string, { name: string; email: string }>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0 || !process.env.SUPABASE_SECRET_KEY?.trim()) return contacts;
  const { data } = await createAdminSupabase().from("profiles").select("id, full_name, email").in("id", ids);
  for (const p of data ?? []) contacts.set(p.id, { name: p.full_name, email: p.email });
  return contacts;
}
