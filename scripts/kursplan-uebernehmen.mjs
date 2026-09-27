/**
 * EINMALIG: Die alte Code-Woche wird der Kursplan von Tidal Athletics
 * (Leon 26.09.2026, „Kurs bekommt Trainer", Weg 2).
 *
 *   node --use-system-ca --experimental-transform-types \
 *     --import ./scripts/lib/ts-loader-register.mjs scripts/kursplan-uebernehmen.mjs
 *        → Probe: zeigt, was geschrieben würde
 *   … scripts/kursplan-uebernehmen.mjs --schreiben
 *        → schreibt gyms/tidal-athletics/schedulePlans/{neu}
 *
 * DIESELBEN IDs („mon-01" …): Kurs-Abos (users/{uid}/subscriptions/{id}),
 * Rückmeldungen und Plan-Freigaben (courseIds) hängen an ihnen und bleiben
 * damit gültig. Trainer stehen noch keine drin — die weist die Verwaltung
 * unter /verwaltung/kurse zu; bis dahin zeigt die Seite, welche Kurse offen
 * sind.
 *
 * Läuft nur, solange das Gym noch KEINEN aktiven Plan hat. Ein zweiter
 * Aufruf ändert nichts.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { KURSPLAN_VORLAGE_TIDAL } from "../lib/kursplan-vorlage.ts";
import { KURSPLAN_STANDARD_NAME, kurseSortieren } from "../lib/kursplan.ts";

const GYM_ID = "tidal-athletics";
const schreiben = process.argv.includes("--schreiben");

const { projectId } = initAdmin();
const db = getFirestore();
console.log(`Projekt ${projectId} · Gym ${GYM_ID} · ${schreiben ? "SCHREIBT" : "Probe"}\n`);

const gym = await db.collection("gyms").doc(GYM_ID).get();
if (!gym.exists) {
  console.error("Das Gym gibt es nicht.");
  process.exit(1);
}

const plaene = db.collection("gyms").doc(GYM_ID).collection("schedulePlans");
const aktiv = await plaene.where("aktiv", "==", true).limit(1).get();
if (!aktiv.empty) {
  console.log(`Schon da: Plan ${aktiv.docs[0].id} mit ${(aktiv.docs[0].get("kurse") ?? []).length} Kursen. Nichts zu tun.`);
  process.exit(0);
}

const kurse = kurseSortieren(
  KURSPLAN_VORLAGE_TIDAL.map((k) => ({ ...k, trainerUids: [] })),
);
for (const k of kurse) {
  console.log(`  ${k.id}  ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][k.weekday]} ${k.startTime}–${k.endTime}  ${k.title}`);
}
console.log(`\n${kurse.length} Kurse.`);

if (!schreiben) {
  console.log("Probe — nichts geschrieben. Mit --schreiben ausführen.");
  process.exit(0);
}

const ref = plaene.doc();
await ref.set({
  name: KURSPLAN_STANDARD_NAME,
  aktiv: true,
  kurse,
  angelegtAm: FieldValue.serverTimestamp(),
  geaendertAm: FieldValue.serverTimestamp(),
  geaendertVon: "uebernahme-26-09",
});
const zurueck = await ref.get();
console.log(`Geschrieben: gyms/${GYM_ID}/schedulePlans/${ref.id} · ${(zurueck.get("kurse") ?? []).length} Kurse zurückgelesen.`);
