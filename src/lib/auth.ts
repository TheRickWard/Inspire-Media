import "server-only";
import { redirect } from "next/navigation";
import { createSupabase } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
};

/** The signed-in person, or null if nobody is signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  // Signed in, but no profile row (e.g. the account was made before the
  // database was fully set up). Still treat them as signed in, so they
  // aren't bounced back to the sign-in page.
  if (!profile) {
    return {
      id: userId,
      email: typeof data.claims.email === "string" ? data.claims.email : "",
      fullName: "",
      isPlatformAdmin: false,
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    isPlatformAdmin: profile.is_platform_admin,
  };
}

/** The signed-in person; sends visitors to the sign-in page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/dashboard");
  return user;
}
