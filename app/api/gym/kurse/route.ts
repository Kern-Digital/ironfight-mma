/**
 * POST /api/gym/kurse — Wochenpläne, Kurse und Räume des eigenen Gyms pflegen.
 *
 * Body:
 *   { aktion: "kurs-speichern", planId, alterTitel: string | null, kurs: KursEingabe }
 *   { aktion: "kurs-loeschen", planId, titel: string }
 *   { aktion: "raum-anlegen", name } · { aktion: "raum-umbenennen", raumId, name }
 *   { aktion: "raum-loeschen", raumId }
 *   { aktion: "plan-anlegen", name, vorlagePlanId: string | null, zeitraumVon, zeitraumBis }
 *   { aktion: "plan-aendern", planId, name, zeitraumVon, zeitraumBis }   (Tage „2026-07-14" oder null)
 *   { aktion: "plan-loeschen", planId } · { aktion: "plan-aktivieren", planId }
 * Antwort: { ok: true, planId, titel? , raumId? }
 *
 * ─── MEHRERE WOCHENPLÄNE (Leon 27.09.2026) ──────────────────────────────────
 *
 * „mehrere wochenpläne für ferien etc. … aber immer nur einen aktiviere …
 * es muss aber immer ein plan aktiv sein". Jede Aktion liest ALLE Pläne des
 * Gyms in ihrer Transaktion (lib/server/wochenplan.ts). Daraus folgt:
 *   · Welcher Plan aktiv ist, RECHNET `planStandRechnen` (lib/kursplan.ts)
 *     aus Grundplan, Zeiträumen und dem Tag — am Anfang jeder Aktion (holt
 *     nach, was der Nacht-Job verpasst hat) und am Ende (ein Zeitraum ab
 *     heute gilt sofort). Nie null und nie zwei aktive.
 *   · `plan-aktivieren` macht den Plan zum Grundplan; ein laufender Zeitraum
 *     endet damit. Kein Deaktivieren.
 *   · `plan-loeschen` lehnt den aktiven Plan und den Grundplan ab.
 *   · Zeiträume prüft `zeitraumPruefen`: keine Überschneidung, nichts
 *     Vergangenes, höchstens ein Jahr, keiner am Grundplan (Leon 27.09.:
 *     „nichts passieren kann das einen fehler im ablauf hervor ruft").
 *   · `plan-anlegen` mit `vorlagePlanId` dupliziert: Kurse, Trainer und Räume
 *     samt Termin-IDs (Leon 27.09.: „IDs behalten").
 * Kurs-Aktionen brauchen `planId`. Nur ein Gym OHNE Plan darf sie weglassen —
 * dann entsteht sein erster Plan, aktiv.
 *
 * ─── EIN KURS, MEHRERE TERMINE (Leon 27.09.2026) ────────────────────────────
 *
 * Ein Kurs ist die Gruppe aller Termine mit demselben Namen (lib/kursplan.ts).
 * `kurs-speichern` ersetzt ALLE Termine des Kurses `alterTitel` im Plan durch
 * die geschickten. Termine, die ihre `id` mitbringen, behalten sie: Kurs-Abos,
 * Rückmeldungen und Plan-Freigaben hängen an ihr. Neue Termine bekommen eine
 * zufällige ID. Ein Name, den schon ein ANDERER Kurs trägt, wird abgelehnt.
 *
 * ─── WARUM EINE SERVER-ROUTE ────────────────────────────────────────────────
 *
 * Leon 26.09.2026: Kurse legt die Verwaltung an, und „ein Kurs braucht immer
 * einen Trainer" (16.09.). Ob eine uid Trainer DIESES Gyms ist, steht in einem
 * fremden users-Dokument — das kann keine Client-Regel prüfen. Deshalb
 * schreibt nur der Server, und `schedulePlans` steht auf `write: if false`.
 * Geprüft wird das `verwaltung`-Häkchen (Leon: „ein trainer der auch in der
 * verwaltung ist darf natürlich über die verwaltungsebene kurse bearbeiten").
 *
 * ─── RÄUME (Leon 27.09.2026) ────────────────────────────────────────────────
 *
 * Räume gehören dem Gym: Die Raum-Aktionen ändern ALLE Pläne zugleich. Ein
 * gelöschter Raum nimmt keine Kurse mit — sie stehen danach ohne Raum da.
 * Doppelbelegung prüft der Server NICHT: Leon „Nur warnen".
 *
 * ─── WAS GELÖSCHTE TERMINE ZURÜCKLASSEN ─────────────────────────────────────
 *
 * Kurs-Abos (`users/{uid}/subscriptions/{terminId}`), Rückmeldungen und
 * Plan-Freigaben tragen die Termin-ID. Sie bleiben liegen; jede Ansicht löst
 * IDs über den aktiven Plan auf und lässt unbekannte still fallen
 * (lib/schedule.ts, `courseTitlesOf`). Kommt der Plan mit dem Termin zurück,
 * gelten sie wieder.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { plaeneLesenTx, plaeneSchreibenTx, wechselAnwenden, type PlanImTx } from "@/lib/server/wochenplan";
import { tagSchluessel } from "@/lib/guthaben";
import {
  KURSE_MAX,
  KURSPLAN_STANDARD_NAME,
  kursMitTerminenPruefen,
  PLAENE_MAX,
  plannamePruefen,
  RAEUME_MAX,
  raumnamePruefen,
  zeitraumLaeuft,
  zeitraumPruefen,
  type Raum,
} from "@/lib/kursplan";
import { readRoleSet } from "@/lib/roles";
import type { TrainingBlock } from "@/lib/types";

export const runtime = "nodejs";

const AKTIONEN = [
  "kurs-speichern",
  "kurs-loeschen",
  "raum-anlegen",
  "raum-umbenennen",
  "raum-loeschen",
  "plan-anlegen",
  "plan-aendern",
  "plan-loeschen",
  "plan-aktivieren",
] as const;
type Aktion = (typeof AKTIONEN)[number];

class Abgelehnt extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const text = (x: unknown) => (typeof x === "string" ? x : "");

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req, "Den Wochenplan pflegt die Verwaltung deines Gyms.");
  if (zugang instanceof Response) return zugang;
  const { user, gymId } = zugang;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const aktion = body.aktion as Aktion;
  if (!AKTIONEN.includes(aktion)) {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }
  const planId = text(body.planId);
  const alterTitel = text(body.alterTitel) || null;
  const titel = text(body.titel);
  const raumId = text(body.raumId);
  const vorlagePlanId = text(body.vorlagePlanId);
  if (aktion === "kurs-loeschen" && !titel) {
    return NextResponse.json({ error: "Welcher Kurs? Der Name fehlt." }, { status: 400 });
  }
  if ((aktion === "raum-umbenennen" || aktion === "raum-loeschen") && !raumId) {
    return NextResponse.json({ error: "Welcher Raum? Die Kennung fehlt." }, { status: 400 });
  }
  if ((aktion === "plan-aendern" || aktion === "plan-loeschen" || aktion === "plan-aktivieren") && !planId) {
    return NextResponse.json({ error: "Welcher Plan? Die Kennung fehlt." }, { status: 400 });
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

    const heute = tagSchluessel();
    const ergebnis = await db.runTransaction(async (tx) => {
      const { sammlung, plaene } = await plaeneLesenTx(tx, db, gymId);
      wechselAnwenden(plaene, heute);

      /** Der erste Plan eines Gyms — aktiv, sonst sähe niemand die Kurse. */
      function ersterPlan(): PlanImTx {
        const ref = sammlung.doc();
        const p: PlanImTx = {
          id: ref.id,
          ref,
          neu: true,
          geaendert: true,
          name: KURSPLAN_STANDARD_NAME,
          aktiv: true,
          grundplan: true,
          zeitraumVon: null,
          zeitraumBis: null,
          nachfolgerId: null,
          kurse: [],
          raeume: [],
          angelegtMs: Date.now(),
        };
        plaene.push(p);
        return p;
      }

      /** Der Plan, auf den die Aktion zielt. */
      function zielPlan(): PlanImTx {
        if (planId) {
          const p = plaene.find((x) => x.id === planId);
          if (!p) throw new Abgelehnt("Diesen Plan gibt es nicht mehr.", 404);
          return p;
        }
        if (plaene.length === 0) return ersterPlan();
        throw new Abgelehnt("Welcher Plan? Die Kennung fehlt.", 400);
      }

      /**
       * Die Räume des Gyms. Sie stehen an jedem Plan gleich; wäre einer
       * abgewichen, zählt der aktive zuerst und die übrigen ergänzen ihn.
       */
      function gymRaeume(): Raum[] {
        const out: Raum[] = [];
        const reihe = [...plaene.filter((p) => p.aktiv), ...plaene.filter((p) => !p.aktiv)];
        for (const p of reihe) for (const r of p.raeume) if (!out.some((x) => x.id === r.id)) out.push(r);
        return out;
      }

      function alleRaeumeAendern(aendern: (p: PlanImTx) => void) {
        if (plaene.length === 0) ersterPlan();
        for (const p of plaene) {
          aendern(p);
          p.geaendert = true;
        }
      }

      let id = "";
      let ziel: PlanImTx | null = null;

      if (aktion === "raum-anlegen") {
        const raeume = gymRaeume();
        if (raeume.length >= RAEUME_MAX) throw new Abgelehnt(`Ein Gym fasst ${RAEUME_MAX} Räume.`, 400);
        const n = raumnamePruefen(body.name, raeume);
        if ("fehler" in n) throw new Abgelehnt(n.fehler, 400);
        id = sammlung.doc().id;
        const raum = { id, name: n.name };
        alleRaeumeAendern((p) => {
          p.raeume = [...p.raeume, raum];
        });
      } else if (aktion === "raum-umbenennen") {
        const raeume = gymRaeume();
        if (!raeume.some((r) => r.id === raumId)) throw new Abgelehnt("Diesen Raum gibt es nicht mehr.", 404);
        const n = raumnamePruefen(body.name, raeume.filter((r) => r.id !== raumId));
        if ("fehler" in n) throw new Abgelehnt(n.fehler, 400);
        id = raumId;
        alleRaeumeAendern((p) => {
          p.raeume = p.raeume.map((r) => (r.id === raumId ? { id: raumId, name: n.name } : r));
        });
      } else if (aktion === "raum-loeschen") {
        if (!gymRaeume().some((r) => r.id === raumId)) throw new Abgelehnt("Diesen Raum gibt es nicht mehr.", 404);
        id = raumId;
        alleRaeumeAendern((p) => {
          p.raeume = p.raeume.filter((r) => r.id !== raumId);
          // Die Kurse bleiben — sie stehen danach ohne Raum da.
          p.kurse = p.kurse.map((k) => {
            if (k.raumId !== raumId) return k;
            const { raumId: _weg, ...rest } = k;
            void _weg;
            return rest;
          });
        });
      } else if (aktion === "plan-anlegen") {
        if (plaene.length >= PLAENE_MAX) throw new Abgelehnt(`Ein Gym fasst ${PLAENE_MAX} Wochenpläne.`, 400);
        const n = plannamePruefen(body.name, plaene);
        if ("fehler" in n) throw new Abgelehnt(n.fehler, 400);
        // Der erste Plan eines Gyms ist Grundplan und aktiv — ohne ihn sähe
        // niemand etwas — und trägt deshalb keinen Zeitraum.
        const erster = plaene.length === 0;
        const zr = erster
          ? { von: null, bis: null, nachfolgerId: null }
          : zeitraumPruefen(
              { von: body.zeitraumVon, bis: body.zeitraumBis, nachfolgerId: body.nachfolgerId },
              heute,
              null,
              plaene,
            );
        if ("fehler" in zr) throw new Abgelehnt(zr.fehler, 400);
        const vorlage = vorlagePlanId ? plaene.find((p) => p.id === vorlagePlanId) : null;
        if (vorlagePlanId && !vorlage) throw new Abgelehnt("Diesen Plan gibt es nicht mehr. Wähl eine andere Vorlage.", 404);
        const raeume = gymRaeume();
        const ref = sammlung.doc();
        ziel = {
          id: ref.id,
          ref,
          neu: true,
          geaendert: true,
          name: n.name,
          aktiv: erster,
          grundplan: erster,
          zeitraumVon: zr.von,
          zeitraumBis: zr.bis,
          nachfolgerId: zr.nachfolgerId,
          // Duplikat: dieselben Termine MIT ihren IDs (Leon 27.09.).
          kurse: vorlage ? vorlage.kurse.map((k) => ({ ...k, trainerUids: [...(k.trainerUids ?? [])] })) : [],
          raeume,
          angelegtMs: Date.now(),
        };
        plaene.push(ziel);
      } else if (aktion === "plan-aendern") {
        ziel = zielPlan();
        const andere = plaene.filter((p) => p.id !== ziel!.id);
        const n = plannamePruefen(body.name, andere);
        if ("fehler" in n) throw new Abgelehnt(n.fehler, 400);
        // Ein unveränderter Zeitraum bleibt stehen — so scheitert das
        // Umbenennen nie an einem Zeitraum, der schon läuft.
        const vonRoh = text(body.zeitraumVon) || null;
        const bisRoh = text(body.zeitraumBis) || null;
        const nachRoh = text(body.nachfolgerId) || null;
        const zr =
          vonRoh === ziel.zeitraumVon && bisRoh === ziel.zeitraumBis && nachRoh === ziel.nachfolgerId
            ? { von: ziel.zeitraumVon, bis: ziel.zeitraumBis, nachfolgerId: ziel.nachfolgerId }
            : zeitraumPruefen({ von: vonRoh, bis: bisRoh, nachfolgerId: nachRoh }, heute, ziel, andere);
        if ("fehler" in zr) throw new Abgelehnt(zr.fehler, 400);
        ziel.name = n.name;
        ziel.zeitraumVon = zr.von;
        ziel.zeitraumBis = zr.bis;
        ziel.nachfolgerId = zr.nachfolgerId;
        ziel.geaendert = true;
      } else if (aktion === "plan-loeschen") {
        ziel = zielPlan();
        if (ziel.aktiv) {
          throw new Abgelehnt("Diesen Plan sehen gerade alle. Aktivier zuerst einen anderen, dann kannst du ihn löschen.", 400);
        }
        // Der Grundplan ist der Plan, auf den die Woche nach jedem Zeitraum
        // zurückfällt — ohne ihn wüsste sie nicht, wohin.
        if (ziel.grundplan) {
          throw new Abgelehnt(
            `„${ziel.name}" ist dein Grundplan, nach jedem Zeitraum gilt wieder er. Aktivier zuerst einen anderen Plan, dann kannst du ihn löschen.`,
            400,
          );
        }
        // Ein Plan, der einem Zeitraum NACHFOLGT, wird dort noch gebraucht.
        const zielId = ziel.id;
        const vorgaenger = plaene.find((p) => p.nachfolgerId === zielId && p.zeitraumBis !== null);
        if (vorgaenger) {
          throw new Abgelehnt(
            `Nach „${vorgaenger.name}“ gilt „${ziel.name}“. Wähl dort erst einen anderen Nachfolger, dann kannst du ihn löschen.`,
            400,
          );
        }
        tx.delete(ziel.ref);
        plaene.splice(plaene.indexOf(ziel), 1);
      } else if (aktion === "plan-aktivieren") {
        ziel = zielPlan();
        // Kein Pausieren, kein Deaktivieren (Leon 27.09.): Der aktivierte Plan
        // wird Grundplan und gilt ab sofort. Sein eigener Zeitraum ist damit
        // erledigt, und ein Zeitraum, der gerade läuft, endet — sonst bliebe
        // nach dem Tipp auf „Aktivieren" der alte Plan sichtbar. Zeiträume in
        // der Zukunft bleiben stehen.
        const ziel2 = ziel;
        if (!ziel2.aktiv || !ziel2.grundplan) {
          for (const p of plaene) {
            if (p === ziel2) continue;
            if (p.grundplan) {
              p.grundplan = false;
              p.geaendert = true;
            }
            if (zeitraumLaeuft(p, heute)) {
              p.zeitraumVon = null;
              p.zeitraumBis = null;
              p.geaendert = true;
            }
          }
          ziel2.grundplan = true;
          ziel2.zeitraumVon = null;
          ziel2.zeitraumBis = null;
          ziel2.geaendert = true;
        }
      } else if (aktion === "kurs-loeschen") {
        ziel = zielPlan();
        if (!ziel.kurse.some((k) => k.title === titel)) throw new Abgelehnt("Diesen Kurs gibt es nicht mehr.", 404);
        id = titel;
        ziel.kurse = ziel.kurse.filter((k) => k.title !== titel);
        ziel.geaendert = true;
      } else {
        // ── kurs-speichern ───────────────────────────────────────────────
        ziel = zielPlan();
        const kurs = neu!;
        const kurse = ziel.kurse;
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
        const raeume = gymRaeume();
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
          id: altId && alteIds.has(altId) ? altId : sammlung.doc().id,
        }));
        ziel.kurse = [...rest, ...neueTermine];
        ziel.geaendert = true;
        id = kurs.title;
      }

      // Den Stand für heute neu rechnen: Ein Zeitraum, der heute beginnt,
      // gilt sofort; nach „Aktivieren" steht genau dieser Plan aktiv da.
      wechselAnwenden(plaene, heute);
      plaeneSchreibenTx(tx, plaene, user.uid);
      return { id, planId: ziel?.id ?? null };
    });

    return NextResponse.json(
      aktion.startsWith("raum-")
        ? { ok: true, raumId: ergebnis.id }
        : aktion.startsWith("kurs-")
          ? { ok: true, planId: ergebnis.planId, titel: ergebnis.id }
          : { ok: true, planId: ergebnis.planId },
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
