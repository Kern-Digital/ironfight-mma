/**
 * POST /api/gym/branding — Logo und Farbe eines Gyms setzen (Branding-Kit).
 *
 * Body: { logoUrl?: string | null, akzentH?: number | null, akzentC?: number | null }
 * Antwort: { ok: true, branding: GymBranding }
 *
 * ─── WARUM DAS EINE SERVER-ROUTE IST ────────────────────────────────────────
 *
 * Das Branding-Kit gehört zu den Stufen Gym und Saison (Leon 22.09.2026:
 * Branding „Gym + Saison"). Eine Leistung, für die jemand zahlt, darf nicht
 * davon abhängen, dass der Browser einen Knopf versteckt. Die Stufe wird hier
 * gelesen und hier geprüft; die Oberfläche blendet den Schreiber zusätzlich
 * aus, aber das ist Höflichkeit, nicht die Schranke.
 *
 * Damit ist das nach der Videolänge die zweite Stelle, die `subscription.plan`
 * wirklich PRÜFT statt ihn anzuzeigen.
 *
 * ─── WAS HIER NICHT DURCHKOMMT ──────────────────────────────────────────────
 *
 * · Ein Logo über 96 KB. Der Browser rechnet auf 320 px herunter, da bleiben
 *   5–20 KB übrig; wer mehr schickt, umgeht die Umrechnung. Ein Firestore-
 *   Dokument fasst 1 MiB, und das Gym-Dokument liest die App oft.
 * · Etwas anderes als ein Bild. Erlaubt sind `data:image/png|jpeg|webp|svg+xml`
 *   und `https:` — kein `http:`, kein `javascript:`, kein `data:text/html`.
 * · Ein Farbton außerhalb 0–360 oder eine Buntheit über 0,3. Darüber reißen
 *   die abgeleiteten Kontraste (DESIGN-BRIEF §1).
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { stufeDesGyms } from "@/lib/server/gym-status";
import { leistungenFuer } from "@/lib/abo";
import { AKZENT_C_MAX, decodeBranding } from "@/lib/gym";

export const runtime = "nodejs";

/** 96 KB reichen für ein auf 320 px gerechnetes Logo mit Reserve. */
const LOGO_MAX_ZEICHEN = 96 * 1024;

const BILD_ANFANG = [
  "data:image/png;",
  "data:image/jpeg;",
  "data:image/webp;",
  "data:image/svg+xml;",
  "https://",
];

function logoPruefen(roh: unknown): { url: string | null } | { fehler: string } {
  if (roh === null || roh === undefined || roh === "") return { url: null };
  if (typeof roh !== "string") return { fehler: "Das Logo kam nicht als Bild an." };
  if (roh.length > LOGO_MAX_ZEICHEN) {
    return { fehler: "Dein Logo ist zu groß. Nimm eine kleinere Datei." };
  }
  if (!BILD_ANFANG.some((a) => roh.startsWith(a))) {
    return { fehler: "Lad ein Bild hoch — PNG, JPG, WebP oder SVG." };
  }
  return { url: roh };
}

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req, "Logo und Farbe setzt die Verwaltung deines Gyms.");
  if (zugang instanceof Response) return zugang;
  const { gymId } = zugang;

  let body: { logoUrl?: unknown; akzentH?: unknown; akzentC?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  try {
    // DIE SCHRANKE: Stufe Gym oder Saison. Team und der Gratis-Tarif tragen
    // den Tidal-Look — dafür steht auf der Seite, was das Kit bringt.
    const stufe = await stufeDesGyms(adminDb, gymId);
    if (!stufe || !leistungenFuer(stufe).branding) {
      return NextResponse.json(
        {
          error: "Logo und Farbe gehören zu Gym und Saison. Wechsel die Stufe, dann trägt die App deine Marke.",
          stufeFehlt: true,
        },
        { status: 402 },
      );
    }

    const logo = logoPruefen(body.logoUrl);
    if ("fehler" in logo) return NextResponse.json({ error: logo.fehler }, { status: 400 });

    // Farbe: beide Zahlen zusammen oder gar keine. Ein Farbton ohne Buntheit
    // ergäbe Grau, eine Buntheit ohne Farbton ein Zufallsrot.
    const hRoh = body.akzentH;
    const cRoh = body.akzentC;
    const farbeRaus = hRoh === null || hRoh === undefined;
    let akzentH: number | null = null;
    let akzentC: number | null = null;
    if (!farbeRaus) {
      if (typeof hRoh !== "number" || !Number.isFinite(hRoh) || hRoh < 0 || hRoh > 360) {
        return NextResponse.json({ error: "Wähl einen Farbton." }, { status: 400 });
      }
      if (typeof cRoh !== "number" || !Number.isFinite(cRoh) || cRoh < 0 || cRoh > AKZENT_C_MAX) {
        return NextResponse.json({ error: "Wähl eine Sättigung." }, { status: 400 });
      }
      akzentH = Math.round(hRoh * 10) / 10;
      akzentC = Math.round(cRoh * 1000) / 1000;
    }

    const branding = { logoUrl: logo.url, akzentH, akzentC };
    await adminDb()
      .collection("gyms")
      .doc(gymId)
      .set(
        {
          branding,
          brandingGeaendertAm: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return NextResponse.json({ ok: true, branding: decodeBranding(branding) });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[gym/branding]", err);
    return NextResponse.json(
      { error: "Das ließ sich gerade nicht speichern. Versuch es gleich noch einmal." },
      { status: 500 },
    );
  }
}
