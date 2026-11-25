"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabase } from "@/lib/supabase/server";
import { fail, type FormState } from "@/lib/form";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Please enter your email and password.");

  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail("That email and password don't match an account.");
  redirect("/dashboard");
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
    options: { data: { full_name: parsed.data.full_name } },
  });
  if (error) return fail(error.message);
  if (!data.session) {
    return { ok: "Account created. Check your email for a link to confirm it, then sign in." };
  }
  redirect("/dashboard");
}
