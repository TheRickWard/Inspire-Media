/**
 * The Supabase settings, tidied up. People often paste the "REST URL"
 * (https://abc.supabase.co/rest/v1/) instead of the plain Project URL,
 * so only the https://abc.supabase.co part is kept.
 */
export function supabaseSettings(): { url: string; key: string } | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  try {
    return { url: new URL(rawUrl).origin, key };
  } catch {
    return null;
  }
}
