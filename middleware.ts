import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safePortalTarget(value: string | null, origin: string) {
  if (!value || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin) return null;
    if (target.pathname !== "/portal" && !target.pathname.startsWith("/portal/")) return null;
    return target;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/portal");

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname.startsWith("/portal")) {
      const requestedPath = `${pathname}${request.nextUrl.search}`;
      loginUrl.searchParams.set("next", requestedPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    const destination = safePortalTarget(request.nextUrl.searchParams.get("next"), request.nextUrl.origin)
      || request.nextUrl.clone();
    if (destination.pathname === "/login") {
      destination.pathname = "/dashboard";
      destination.search = "";
    }
    return NextResponse.redirect(destination);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/login"],
};
