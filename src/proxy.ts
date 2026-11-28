import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseSettings } from "@/lib/supabase/config";

// Keeps the login session fresh on every page request.
export async function proxy(request: NextRequest) {
  // Without the two Supabase settings nothing can work, so say so plainly
  // instead of showing "Internal Server Error".
  const settings = supabaseSettings();
  if (!settings) {
    return new NextResponse(
      "Setup needed: the website can't read NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Check them in Vercel under Settings > Environment Variables, then redeploy.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  const { url, key } = settings;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|player/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)"],
};
