import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

// Gates the whole app behind the single password stored in AppPassword.
// /login and the public team view (/share/[token], AD-4) stay open.
export async function proxy(request: NextRequest) {
  if (await isValidToken(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|share/|_next/static|_next/image|favicon.ico).*)"],
};
