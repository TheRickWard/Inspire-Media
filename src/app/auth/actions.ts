"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, type FormState } from "@/lib/form";

/** Only follow "next" to a page on this site. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Please enter your email and password.");

  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail("That email and password don't match an account.");
  redirect(safeNext(formData.get("next")));
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.email("Please enter a valid email address."),
  password: z.string().min(8, "Passwords need at least 8 characters."),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    full_name: formData.get("full_name"),
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard` },
  });
  if (error) return fail(error.message);
  if (!data.session) {
    return { ok: "Account created. Check your email for a link to confirm it, then sign in." };
  }
  redirect(safeNext(formData.get("next")));
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Email a link to choose a new password. Always gives the same answer, so it doesn't reveal who has an account. */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.email().safeParse(email).success) return fail("Please enter a valid email address.");

  const supabase = await createSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error && /rate limit|too many/i.test(error.message)) {
    return fail("Too many reset emails have been sent. Please wait a few minutes and try again.");
  }
  return done("If that email has an account, we've sent a link to reset the password. Check your inbox (and junk folder), and open the link in this same browser.");
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Passwords need at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match." });

/** Save a new password for the signed-in person (after following the reset link). */
export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return fail("This reset link has expired. Please ask for a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(/different from the old/i.test(error.message) ? "Please choose a password different from your old one." : error.message);
  }
  redirect("/dashboard");
}
