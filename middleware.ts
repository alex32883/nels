import { NextResponse, type NextRequest } from "next/server";
import { readSessionCookie, sessionTokenValid } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/offline"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/login")) return true;
  if (pathname.startsWith("/api/status")) return true;
  if (pathname.startsWith("/serwist/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname === "/manifest.webmanifest") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = readSessionCookie(request.headers.get("cookie"));
  if (await sessionTokenValid(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
