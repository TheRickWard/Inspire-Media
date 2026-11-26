import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseSettings } from "@/lib/supabase/config";

const { url, key } = supabaseSettings() ?? { url: "", key: "" };

/** Database client acting as the signed-in person (security rules apply). */
export async function createSupabase() {
  // Signed-in data is always read fresh for each request, never prerendered.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a page rather than an action: the proxy refreshes cookies instead.
        }
      },
    },
  });
}

/** Database client for public pages, acting as an anonymous visitor. */
export async function createPublicSupabase() {
  await connection();
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
