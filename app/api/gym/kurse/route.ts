/**
 * POST /api/gym/kurse — Kurse und Räume des eigenen Gyms pflegen.
 *
 * Body:
 *   { aktion: "kurs-speichern", alterTitel: string | null, kurs: KursEingabe }
 *   { aktion: "kurs-loeschen", titel: string }
 *   { aktion: "raum-anlegen", name } · { aktion: "raum-umbenennen", raumId, name }
 *   { aktion: "raum-loeschen", raumId }
 * Antwort: { ok: true, titel } bzw. { ok: true, raumId }
 *
 * ─── EIN KURS, MEHRERE TERMINE (Leon 27.09.2026) ────────────────────────────
 *
 * „bedenke auch das ein kurs an mehreren Tagen passieren kann … für mehrere
 * tage und dann noch für unterschiedliche zeiten". Ein Kurs ist die Gruppe
 * aller Termine mit demselben Namen (lib/kursplan.ts). `kurs-speichern`
 * ersetzt ALLE Termine des Kurses `alterTitel` durch die geschickten — in
 * einer Transaktion, also nie halb. Termine, die ihre `id` mitbringen,
 * behalten sie: Kurs-Abos, Rückmeldungen und Plan-Freigaben hängen an ihr.
 * Neue Termine bekommen eine zufällige ID. Ein Name, den schon ein ANDERER
 * Kurs trägt, wird abgelehnt — sonst verschmölzen zwei Kurse unbemerkt.
 *
 * ─── WARUM EINE SERVER-ROUTE ────────────────────────────────────────────────
 *
 * Leon 26.09.2026: Kurse legt die Verwaltung an („Nur Verwaltung"), und „ein
 * Kurs braucht immer einen Trainer" (16.09.). Ob eine uid Trainer DIESES Gyms
 * ist, steht in einem fremden users-Dokument — das kann keine Client-Regel
 * prüfen. Deshalb schreibt nur der Server, und `schedulePlans` steht auf
 * `write: if false`. Geprüft wird das `verwaltung`-Häkchen, nie „nur
 * Verwaltung" (Leon: „ein trainer der auch in der verwaltung ist darf
 * natürlich über die verwaltungsebene kurse bearbeiten").
 *
 * ─── RÄUME (Leon 27.09.2026) ────────────────────────────────────────────────
 *
 * Am selben Plan-Dokument. Ein gelöschter Raum nimmt keine Kurse mit — sie
 * stehen danach ohne Raum da. Doppelbelegung prüft der Server NICHT: Leon
 * „Nur warnen", die Warnung rechnet das Sheet.
 *
 * ─── WAS GELÖSCHTE TERMINE ZURÜCKLASSEN ─────────────────────────────────────
 *
 * Kurs-Abos (`users/{uid}/subscriptions/{terminId}`), Rückmeldungen und
 * Plan-Freigaben tragen die Termin-ID. Sie bleiben liegen; jede Ansicht löst
 * IDs über den Plan auf und lässt unbekannte still fallen (lib/schedule.ts,
 * `courseTitlesOf`). Aufräumen hieße, fremde users-Dokumente anzufassen.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import {
  KURSE_MAX,
  KURSPLAN_STANDARD_NAME,
  kursMitTerminenPruefen,
  kurseLesen,
  kurseSortieren,
  RAEUME_MAX,
  raeumeLesen,
  raumnamePruefen,
} from "@/lib/kursplan";
import { readRoleSet } from "@/lib/roles";
import type { TrainingBlock } from "@/lib/types";

export const runtime = "nodejs";

const AKTIONEN = ["kurs-speichern", "kurs-loeschen", "raum-anlegen", "raum-umbenennen", "raum-loeschen"] as const;
type Aktion = (typeof AKTIONEN)[number];

class Abgelehnt extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req, "Kurse legt die Verwaltung deines Gyms an.");
  if (zugang instanceof Response) return zugang;
  const { user, gymId } = zugang;

  let body: {
    aktion?: unknown;
    alterTitel?: unknown;
    titel?: unknown;
    kurs?: unknown;
    raumId?: unknown;
    name?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const aktion = body.aktion as Aktion;
  if (!AKTIONEN.includes(aktion)) {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }
  const alterTitel = typeof body.alterTitel === "string" && body.alterTitel ? body.alterTitel : null;
  const titel = typeof body.titel === "string" ? body.titel : "";
  if (aktion === "kurs-loeschen" && !titel) {
    return NextResponse.json({ error: "Welcher Kurs? Der Name fehlt." }, { status: 400 });
  }
  const raumId = typeof body.raumId === "string" ? body.raumId : "";
  if ((aktion === "raum-umbenennen" || aktion === "raum-loeschen") && !raumId) {
    return NextResponse.json({ error: "Welcher Raum? Die Kennung fehlt." }, { status: 400 });
  }

  let neu: { title: string; termine: (Omit<TrainingBlock, "id"> & { id?: string })[] } | null = null;
  if (aktion === "kurs-speichern") {
    const geprueft = kursMitTerminenPruefen(body.kurs);
    if ("fehler" in geprueft) return NextResponse.json({ error: geprueft.fehler }, { status: 400 });
    neu = geprueft;
  }

  try {
    const db = adminDb();

    // TRAINER PRÜFEN — vor der Transaktion, denn die users-Dokumente ändern
    // sich nicht mit dem Plan. Jede uid muss in DIESEM Gym Mitglied sein und
    // das Trainer-Häkchen tragen. Ein Plattform-Admin gehört seit dem
    // 21.09. zu keinem Gym und fällt damit von selbst heraus.
    if (neu) {
      const uids = neu.termine[0].trainerUids ?? [];
      const docs = await db.getAll(...uids.map((u) => db.collection("users").doc(u)));
      for (const d of docs) {
        const daten = d.data();
        if (!d.exists || !daten || daten.gymId !== gymId || !readRoleSet(daten).trainer) {
          return NextResponse.json(
            { error: "Wähl als Trainer nur Mitglieder deines Gyms mit Trainer-Recht." },
            { status: 400 },
          );
        }
      }
    }

    const plaene = db.collection("gyms").doc(gymId).collection("schedulePlans");
    const ergebnis = await db.runTransaction(async (tx) => {
      const aktiv = await tx.get(plaene.where("aktiv", "==", true).limit(1));
      const planRef = aktiv.docs[0]?.ref ?? plaene.doc();
      let kurse = aktiv.docs[0] ? kurseLesen(aktiv.docs[0].get("kurse")) : [];
      let raeume = aktiv.docs[0] ? raeumeLesen(aktiv.docs[0].get("raeume")) : [];
      let id = "";

      if (aktion === "raum-anlegen") {
        if (raeume.length >= RAEUME_MAX) throw new Abgelehnt(`Ein Gym fasst ${RAEUME_MAX} Räume.`, 400);
        const n = raumnamePruefen(body.name, raeume);
        if ("fehler" in n) throw new Abgelehnt(n.fehler, 400);
        id = plaene.doc().id;
        raeume = [...raeume, { id, name: n.name }];
      } else if (aktion === "raum-umbenennen") {
        if (!raeume.some((r) => r.id === raumId)) throw new Abgelehnt("Diesen Raum gibt es nicht mehr.", 404);
        const n = raumnamePruefen(body.name, raeume.filter((r) => r.id !== raumId));
        if ("fehler" in n) throw new Abgelehnt(n.fehler, 400);
        id = raumId;
        raeume = raeume.map((r) => (r.id === raumId ? { id: raumId, name: n.name } : r));
      } else if (aktion === "raum-loeschen") {
        if (!raeume.some((r) => r.id === raumId)) throw new Abgelehnt("Diesen Raum gibt es nicht mehr.", 404);
        id = raumId;
        raeume = raeume.filter((r) => r.id !== raumId);
        // Die Kurse bleiben — sie stehen danach ohne Raum da.
        kurse = kurse.map((k) => {
          if (k.raumId !== raumId) return k;
          const { raumId: _weg, ...rest } = k;
          void _weg;
          return rest;
        });
      } else if (aktion === "kurs-loeschen") {
        if (!kurse.some((k) => k.title === titel)) throw new Abgelehnt("Diesen Kurs gibt es nicht mehr.", 404);
        id = titel;
        kurse = kurse.filter((k) => k.title !== titel);
      } else {
        // ── kurs-speichern ───────────────────────────────────────────────
        const kurs = neu!;
        const alte = alterTitel ? kurse.filter((k) => k.title === alterTitel) : [];
        if (alterTitel && alte.length === 0) throw new Abgelehnt("Diesen Kurs gibt es nicht mehr.", 404);
        const belegt = kurse.find(
          (k) => k.title.toLowerCase() === kurs.title.toLowerCase() && k.title !== alterTitel,
        );
        if (belegt) {
          throw new Abgelehnt(
            `Einen Kurs „${belegt.title}" gibt es schon. Öffne ihn und tipp dort den Tag dazu.`,
            400,
          );
        }
        for (const t of kurs.termine) {
          if (t.raumId && !raeume.some((r) => r.id === t.raumId)) {
            throw new Abgelehnt("Diesen Raum gibt es nicht mehr. Wähl einen anderen.", 400);
          }
        }
        const rest = alterTitel ? kurse.filter((k) => k.title !== alterTitel) : kurse;
        if (rest.length + kurs.termine.length > KURSE_MAX) {
          throw new Abgelehnt(`Ein Plan fasst ${KURSE_MAX} Termine.`, 400);
        }
        // Bestehende Termine behalten ihre ID, neue bekommen eine zufällige.
        // Zufällig statt „mon-05": Kurs-Abos und trainingSessions tragen die
        // ID ohne gymId — zwei Gyms mit „mon-01" teilten sich sonst Inhalte.
        const alteIds = new Set(alte.map((k) => k.id));
        const neueTermine: TrainingBlock[] = kurs.termine.map(({ id: altId, ...t }) => ({
          ...t,
          id: altId && alteIds.has(altId) ? altId : plaene.doc().id,
        }));
        kurse = [...rest, ...neueTermine];
        id = kurs.title;
      }

      tx.set(
        planRef,
        {
          // Firestore nimmt kein `undefined` — kurseLesen und die Prüfung
          // liefern nur gesetzte Felder.
          kurse: kurseSortieren(kurse),
          raeume,
          geaendertAm: FieldValue.serverTimestamp(),
          geaendertVon: user.uid,
          ...(aktiv.docs[0]
            ? {}
            : { name: KURSPLAN_STANDARD_NAME, aktiv: true, angelegtAm: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );
      return id;
    });

    return NextResponse.json(
      aktion.startsWith("raum-") ? { ok: true, raumId: ergebnis } : { ok: true, titel: ergebnis },
    );
  } catch (err) {
    if (err instanceof Abgelehnt) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[gym/kurse]", err);
    return NextResponse.json(
      { error: "Das ließ sich gerade nicht speichern. Versuch es gleich noch einmal." },
      { status: 500 },
    );
  }
}
