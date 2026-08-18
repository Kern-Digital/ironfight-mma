import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Serverseitiger Auth-Gate (Edge).
 *
 * Hintergrund: Firebase speichert die Session nur in IndexedDB — fuer den Server
 * unsichtbar. Der AuthProvider spiegelt das ID-Token daher in ein `__session`-
 * Cookie (siehe lib/auth-context.tsx), das diese Middleware lesen kann.
 *
 * Sicherheitsmodell: Dies ist das Navigations-/Sichtbarkeits-Gate. Die eigentliche
 * Datensicherheit erzwingen die Firestore-Regeln (rollenbasiert via Custom Claims).
 * Sobald ein Service-Account vorliegt, wird das Cookie auf ein serverseitig
 * signiertes, httpOnly Firebase-Session-Cookie umgestellt (Signaturpruefung hier).
 *
 * Verhalten fuer NICHT eingeloggte Nutzer:
 *   - /admin/*      → 404 (Existenz des Admin-Bereichs verbergen)
 *   - uebrige Seiten → Redirect auf /login
 */

const ADMIN_PREFIXES = ["/admin"];
const PROTECTED_PREFIXES = ["/dashboard", "/library", "/profile", "/trainer"];
const SESSION_COOKIE = "__session";

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Leichtgewichtiger Edge-Check: Cookie vorhanden und JWT nicht abgelaufen.
 * KEINE Signaturpruefung (folgt mit Service-Account) — Datensicherheit liegt
 * bei den Firestore-Regeln.
 */
function hasLiveSession(req: NextRequest): boolean {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof json.exp === "number" && json.exp * 1000 < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  // Optionaler Not-Aus (z. B. waehrend des Cutovers): MIDDLEWARE_AUTH=off
  if (process.env.MIDDLEWARE_AUTH === "off") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (hasLiveSession(req)) return NextResponse.next();

  // Admin-Bereich fuer Unauthentifizierte verstecken → echtes 404
  if (matchesPrefix(pathname, ADMIN_PREFIXES)) {
    return new NextResponse("404 — Seite nicht gefunden", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Uebrige geschuetzte Seiten → Login (mit Rueckkehr-Ziel)
  if (matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/library/:path*",
    "/profile/:path*",
    "/trainer/:path*",
  ],
};
