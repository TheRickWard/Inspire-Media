import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseSettings } from "@/lib/supabase/config";

/**
 * Database client using the server key. It bypasses the security rules, so it
 * is only used after the website has checked who the person is and has
 * confirmed a payment with Square or PayPal. Never sent to the browser.
 */
export function createAdminSupabase() {
  const settings = supabaseSettings();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!settings || !secret) throw new Error("The server key (SUPABASE_SECRET_KEY) isn't set up yet.");
  return createClient<Database>(settings.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
