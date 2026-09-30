/**
 * POST /api/gym/wochenplan-stand — gleicht die Wochenpläne des EIGENEN Gyms
 * mit dem heutigen Tag ab. Antwort: { ok: true, geaendert }.
 *
 * DAS SICHERHEITSNETZ HINTER DEM NACHT-JOB (Leon 27.09.2026: „ich möchte das
 * hierbei aber nichts passieren kann das einen fehler im ablauf hervor
 * ruft"). Endet ein Zeitraum und der Job (/api/cron/wochenplan) lief nicht —
 * Vercel hing, CRON_SECRET fehlte —, stünde die alte Woche weiter im
 * Kursplan. Deshalb ruft JEDES Mitglied diesen Abgleich einmal am Tag beim
 * Öffnen der App (lib/kursplan-context.tsx). Der erste nach Mitternacht
 * schaltet um, alle übrigen lesen nur.
 *
 * Darf jedes Mitglied: Der Abgleich rechnet nur `planStandRechnen` aus
 * gespeicherten Plänen und dem Tag (lib/kursplan.ts) — niemand kann damit
 * etwas wählen, das die Verwaltung nicht so geplant hat. Zweimal rechnen
 * ändert nichts.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { bearerToken, userGymId, verifyUser } from "@/lib/server/verify-user";
import { standAbgleichen } from "@/lib/server/wochenplan";
import { tagSchluessel } from "@/lib/guthaben";
import { KEIN_GYM } from "@/lib/gym";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const gymId = userGymId(user);
  if (gymId === KEIN_GYM) return NextResponse.json({ ok: true, geaendert: false });
  try {
    const { geaendert } = await standAbgleichen(adminDb(), gymId, tagSchluessel(), "abgleich");
    return NextResponse.json({ ok: true, geaendert });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[gym/wochenplan-stand]", err);
    return NextResponse.json({ error: "Abgleich gescheitert." }, { status: 500 });
  }
}
