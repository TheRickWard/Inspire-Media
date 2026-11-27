import { NextResponse, type NextRequest } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

// Links in Supabase emails (password reset, account confirmation) come back here.
// Swap the one-off code for a signed-in session, then go to the next page.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  // Only allow paths on this site.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  // Go back to the address the person is actually using (request.url can be the server's internal address).
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const base = `${proto}://${host}`;

  if (code) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, base));
  }
  const failed = next === "/reset-password" ? "/forgot-password?link=expired" : "/login?link=expired";
  return NextResponse.redirect(new URL(failed, base));
}
