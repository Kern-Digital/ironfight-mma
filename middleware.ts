import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decodeJwt,
  decodeProtectedHeader,
  importX509,
  jwtVerify,
} from "jose";
import { rightsFromClaims, type RoleSet } from "@/lib/roles";
import { isVerwaltungPath } from "@/lib/verwaltung-routes";

/**
 * Serverseitiger Auth-Gate (Edge) — MIT Signaturprüfung (seit 2026-08-20).
 *
 * Hintergrund: Firebase speichert die Session nur in IndexedDB — fuer den Server
 * unsichtbar. Der AuthProvider spiegelt das ID-Token daher in ein `__session`-
 * Cookie (siehe lib/auth-context.tsx), das diese Middleware liest.
 *
 * Prüfung: Das JWT wird gegen Googles öffentliche Zertifikate verifiziert
 * (RS256, Issuer/Audience = Firebase-Projekt). Zusätzlich wird das Rollen-Set
 * aus den Custom Claims (`trainer`, `verwaltung`, `admin`; Checkpoint 3,
 * lib/roles.ts) fürs Routen-Gating gelesen:
 *   /admin/*      → nur der Plattform-Rang, sonst 404 (Existenz verbergen)
 *   /verwaltung/* → nur mit Verwaltungsrecht, sonst Redirect /dashboard
 *   /trainer/*    → nur mit Trainer-Werkzeugen, sonst Redirect /dashboard
 *
 * Fail-Open-Ausnahme (bewusst): Sind Googles Zertifikate NICHT erreichbar
 * (Netzfehler), fällt der Gate auf den unverifizierten exp-Check zurück,
 * statt alle Nutzer auszusperren — die Middleware ist ein Navigations-Gate,
 * die Datensicherheit erzwingen die Firestore-Regeln. Ein UNGÜLTIGES Token
 * (Signatur/Issuer/Audience falsch) wird dagegen immer abgewiesen.
 */

// Der `matcher` unten begrenzt die Middleware auf die geschuetzten Bereiche —
// jede Anfrage hier IST also schutzbeduerftig.
const ADMIN_PREFIXES = ["/admin"];
const TRAINER_PREFIXES = ["/trainer"];
/**
 * Der Verwaltungsbereich hat seit Checkpoint 3 eine eigene Adresse
 * (`/verwaltung`, siehe lib/verwaltung-routes.ts) und deshalb ein eigenes,
 * schlichtes Gate. Vorher lagen die Seiten unter `/trainer` und brauchten
 * eine Ausnahme in BEIDE Richtungen — nach unten, damit eine reine
 * Verwaltung nicht vom Trainer-Gate auf /dashboard flog, und nach oben,
 * damit ein Trainer ohne Verwaltungsrecht nicht auf einer Seite landete, die
 * ihm die Firestore-Regeln ohnehin verwehren. Getrennte Adressen erledigen
 * beides ohne Sonderfall.
 */
const SESSION_COOKIE = "__session";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ─── Google-Zertifikate (Modul-Cache pro Edge-Isolate) ─────────────────────

class CertFetchError extends Error {}

let certCache: { certs: Record<string, string>; expiresAt: number } | null =
  null;

async function fetchGoogleCerts(force = false): Promise<Record<string, string>> {
  if (!force && certCache && Date.now() < certCache.expiresAt) {
    return certCache.certs;
  }
  let res: Response;
  try {
    res = await fetch(CERTS_URL);
  } catch {
    throw new CertFetchError("Google-Zertifikate nicht erreichbar");
  }
  if (!res.ok) throw new CertFetchError(`Zertifikat-Abruf: HTTP ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "");
  const ttlMs = maxAge ? parseInt(maxAge[1], 10) * 1000 : 60 * 60 * 1000;
  certCache = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

// ─── Token-Verifikation ─────────────────────────────────────────────────────

/**
 * Für den Gate zählt nur, was jemand DARF — der Plattform-Rang ist dabei
 * schon eingerechnet (`rightsFromClaims`). Der Rückfall auf das alte `role`
 * steckt ebenfalls dort: Tokens leben bis zu einer Stunde, und in dieser
 * Stunde laufen beide Claim-Formen durch diese Prüfung.
 */
type SessionClaims = RoleSet;

type VerifyResult =
  | { status: "valid"; claims: SessionClaims }
  | { status: "invalid" }
  | { status: "unavailable" }; // Zertifikate nicht erreichbar (Fail-Open)

async function verifySession(token: string): Promise<VerifyResult> {
  if (!PROJECT_ID) return { status: "unavailable" };
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
      return { status: "invalid" };
    }
    let certs = await fetchGoogleCerts();
    if (!certs[header.kid]) {
      // Schlüsselrotation: einmal frisch laden
      certs = await fetchGoogleCerts(true);
      if (!certs[header.kid]) return { status: "invalid" };
    }
    const key = await importX509(certs[header.kid], "RS256");
    const { payload } = await jwtVerify(token, key, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return { status: "invalid" };
    }
    return {
      status: "valid",
      claims: rightsFromClaims(payload as Record<string, unknown>),
    };
  } catch (err) {
    if (err instanceof CertFetchError) return { status: "unavailable" };
    return { status: "invalid" };
  }
}

/** Unverifizierter Fallback (nur bei nicht erreichbaren Zertifikaten). */
function unverifiedSession(token: string): SessionClaims | null {
  try {
    const payload = decodeJwt(token);
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return rightsFromClaims(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

// ─── Gate ───────────────────────────────────────────────────────────────────

function deny(req: NextRequest, pathname: string): NextResponse {
  // Admin-Bereich fuer Unbefugte verstecken → echtes 404
  if (matchesPrefix(pathname, ADMIN_PREFIXES)) {
    return new NextResponse("404 — Seite nicht gefunden", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

function toDashboard(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  // Optionaler Not-Aus (z. B. waehrend eines Cutovers): MIDDLEWARE_AUTH=off
  if (process.env.MIDDLEWARE_AUTH === "off") return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Der Umzug der alten /trainer-Adressen passiert VOR dieser Middleware in
  // next.config.mjs (redirects()) — genau deshalb, damit das Trainer-Gate
  // unten eine reine Verwaltung nicht abfaengt, bevor sie ihr neues Ziel
  // erreicht.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return deny(req, pathname);

  const result = await verifySession(token);
  let claims: SessionClaims | null;
  if (result.status === "valid") {
    claims = result.claims;
  } else if (result.status === "unavailable") {
    claims = unverifiedSession(token); // dokumentierter Fail-Open-Pfad
  } else {
    claims = null; // ungueltige Signatur/Issuer/Audience → wie ausgeloggt
  }
  if (!claims) return deny(req, pathname);

  // Rechte-Gating (Rollen-Set aus dem verifizierten Token). Der
  // Plattform-Rang ist in `claims` bereits eingerechnet — ein Admin faellt
  // deshalb durch keine dieser Pruefungen.
  if (matchesPrefix(pathname, ADMIN_PREFIXES) && !claims.admin) {
    return deny(req, pathname); // 404 — Existenz verbergen
  }
  if (isVerwaltungPath(pathname) && !claims.verwaltung) {
    return toDashboard(req);
  }
  if (matchesPrefix(pathname, TRAINER_PREFIXES) && !claims.trainer) {
    return toDashboard(req);
  }

  return NextResponse.next();
}

/**
 * NICHT AUFNEHMEN: `/beitreten/*` (Einladungen einlösen, Checkpoint 1C).
 * Die Seite ist für AUSGELOGGTE gedacht — ein Eingeladener öffnet den Link,
 * bevor er ein Konto hat. Stünde sie im matcher, würfe die Middleware ihn auf
 * /login, bevor er die Einladung überhaupt sieht. Geschützt ist der Vorgang
 * trotzdem: /api/invites/preview und /redeem verlangen beide ein gültiges
 * ID-Token, die Seite selbst zeigt ohne Anmeldung nur den Code.
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/deepfight/:path*",
    "/kampfprofil/:path*",
    "/library/:path*",
    "/profile/:path*",
    "/trainer/:path*",
    "/verwaltung/:path*",
  ],
};
