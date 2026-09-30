/**
 * GET /api/cron/wochenplan — der Nacht-Job für Zeiträume der Wochenpläne
 * (Leon 27.09.2026: „aktiv ab" und „pläne auch für einen gewissen zeitraum").
 *
 * Jede Nacht gleicht dieser Job alle Gyms mit dem neuen Tag ab:
 * `planStandRechnen` (lib/kursplan.ts) leitet ab, welcher Plan heute gilt,
 * und nur Abweichungen werden geschrieben — in einer Transaktion je Gym
 * (lib/server/wochenplan.ts, `standAbgleichen`).
 *
 * WANN: vercel.json, `15 23 * * *` in UTC. Vercel startet einen Tages-Job
 * irgendwann in dieser Stunde, also 23:00–23:59 UTC — in deutscher Zeit
 * 00:00–00:59 im Winter und 01:00–01:59 im Sommer. Beides ist schon der neue
 * Tag. Verpasst der Job eine Nacht, holt es der tägliche Abgleich beim
 * Öffnen der App nach (/api/gym/wochenplan-stand) oder die nächste Aktion
 * der Verwaltung — der Stand ist eine Rechnung, kein Ereignis.
 *
 * WER: nur Vercel. Vercel schickt `Authorization: Bearer $CRON_SECRET`, wenn
 * die Umgebungsvariable gesetzt ist. Ohne CRON_SECRET läuft der Job gar
 * nicht — ein offener Endpunkt, der Pläne umschaltet, wäre schlimmer als ein
 * Wechsel, der erst bei der nächsten Aktion geschieht.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { standAbgleichen } from "@/lib/server/wochenplan";
import { tagSchluessel } from "@/lib/guthaben";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) {
    return NextResponse.json({ error: "CRON_SECRET fehlt." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${geheim}`) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const heute = tagSchluessel();
  try {
    const db = adminDb();
    const gyms = await db.collection("gyms").listDocuments();
    const gewechselt: { gymId: string; planId: string }[] = [];
    const fehler: string[] = [];
    for (const gym of gyms) {
      try {
        const { neuAktiv } = await standAbgleichen(db, gym.id, heute, "automatik");
        if (neuAktiv) gewechselt.push({ gymId: gym.id, planId: neuAktiv });
      } catch (err) {
        // Ein Gym mit Problem hält die anderen nicht auf.
        console.error("[cron/wochenplan]", gym.id, err);
        fehler.push(gym.id);
      }
    }
    return NextResponse.json({ ok: fehler.length === 0, heute, gyms: gyms.length, gewechselt, fehler });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[cron/wochenplan]", err);
    return NextResponse.json({ error: "Der Job ist gescheitert." }, { status: 500 });
  }
}
