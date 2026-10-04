// Route protection by session + role (Next.js 16 renamed `middleware.ts` to `proxy.ts`).
//
// This is an optimistic check that only MIRRORS the backend: it reads the role claim from the
// access-token cookie without verifying the signature, so it must never be the thing that
// protects data. The backend verifies the token and checks the role on every API call.

import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/api";
import { canAccess, homeFor } from "@/lib/routes";
import { ACCESS_COOKIE, MUST_CHANGE_COOKIE, REFRESH_COOKIE } from "@/lib/session";

const ROLES: Role[] = ["employee", "manager", "finance", "hr", "ceo", "admin"];
const FORCE_PASSWORD_PATH = "/me/settings";

function roleFromToken(token: string | undefined): Role | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const role = json?.app_metadata?.role;
    return ROLES.includes(role) ? role : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasSession = !!access || !!request.cookies.get(REFRESH_COOKIE)?.value;

  if (pathname === "/login") {
    const role = roleFromToken(access);
    return role ? NextResponse.redirect(new URL(homeFor(role), request.url)) : NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Access token expired but refresh token present: let the page load; the client refreshes.
  const role = roleFromToken(access);
  if (!role) return NextResponse.next();

  if (request.cookies.get(MUST_CHANGE_COOKIE)?.value === "1" && pathname !== FORCE_PASSWORD_PATH) {
    const url = new URL(FORCE_PASSWORD_PATH, request.url);
    url.searchParams.set("force", "1");
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || !canAccess(pathname, role)) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
