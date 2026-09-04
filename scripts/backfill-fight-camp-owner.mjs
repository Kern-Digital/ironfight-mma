/**
 * Backfill „ownerIsStaff" an den Wettkämpfen (Schritt 2b, 04.09.2026) —
 * idempotent, beliebig oft wiederholbar.
 *
 * WAS PASSIERT: Jedes `users/{uid}/fightCamps/{campId}` bekommt das Feld
 *   ownerIsStaff: <trägt users/{uid} mindestens ein Recht?>
 * Der Wert entsteht aus denselben drei Booleans, die `istStabKonto()` in
 * `firestore.rules` liest — trainer, verwaltung, admin.
 *
 * WARUM: Die collectionGroup-Regel für den gym-weiten Wettkampfbereich kann
 * keinen `get()` auf das Eltern-Dokument machen; sie muss allein aus dem Camp
 * beweisbar sein. Ohne dieses Feld prüfte sie nur `sameGym` — und weil
 * Firestore-Regeln ODER-verknüpft sind, überstimmte sie die strenge Regel
 * daneben: Jeder Trainer las jedes Camp, auch ohne Freigabe (gemessen am
 * 03.09. per REST). Ausführliche Begründung: lib/fight-camp.ts.
 *
 * ATHLETEN-CAMPS BEKOMMEN AUSDRÜCKLICH `false`, nicht „kein Feld". Die neue
 * Query filtert `where("ownerIsStaff","==",false)`, und ein fehlendes Feld
 * matcht diesen Filter nicht — ein Camp ohne das Feld verschwände aus der
 * Liste, ohne dass irgendwo ein Fehler stünde.
 *
 * CUTOVER-REIHENFOLGE (WICHTIG — Produktion hängt an derselben Firestore):
 *   1. DIESES Script (erst --dry-run, dann scharf). Alte Regeln und alter
 *      Client ignorieren das zusätzliche Feld — nichts ändert sich sichtbar.
 *   2. `npx firebase-tools deploy --only firestore:indexes` und warten, bis
 *      der Index gymId + ownerIsStaff + competitionDate DESC „Enabled" meldet.
 *   3. Client deployen (git push → Vercel): schreibt das Feld beim Anlegen
 *      und Speichern, liest gym-weit nur noch Athleten-Camps plus die
 *      freigegebenen einzeln. Läuft auch noch unter den ALTEN Regeln.
 *   4. `npx firebase-tools deploy --only firestore:rules` — erst jetzt wird
 *      die collectionGroup-Regel streng.
 *   5. Dieses Script NOCH EINMAL laufen lassen: Zwischen 1 und 3 kann ein
 *      Camp aus dem alten Client ohne das Feld entstanden sein.
 *   6. `node scripts/check-privacy-gate.mjs` — 20 Fälle, alle grün.
 *
 * Aufruf:  node scripts/backfill-fight-camp-owner.mjs [--dry-run]
 *
 * Credentials kommen aus .env.local (scripts/lib/admin-app.mjs).
 */

import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";

const DRY = process.argv.includes("--dry-run");

const { source, projectId } = initAdmin();
console.log(`Admin-SDK: ${projectId} (Credentials aus ${source})`);
console.log(DRY ? "PROBELAUF — es wird nichts geschrieben.\n" : "SCHARF — es wird geschrieben.\n");

const db = getFirestore();

// Rechte-Spiegel je Konto. Bewusst dieselben drei Felder wie istStabKonto()
// in firestore.rules — KEIN Rückfall auf das alte `role`. Weicht ein Dokument
// ab, meldet die Gegenprobe unten es namentlich.
const users = await db.collection("users").get();
const istStab = new Map();
const nurLegacy = [];
for (const u of users.docs) {
  const d = u.data();
  const stab = d.trainer === true || d.verwaltung === true || d.admin === true;
  istStab.set(u.id, { stab, name: d.displayName ?? d.email ?? u.id });
  if (!stab && (d.role === "trainer" || d.role === "admin")) nurLegacy.push(u.id);
}
if (nurLegacy.length > 0) {
  console.log(
    `ACHTUNG: ${nurLegacy.length} Konto/Konten tragen nur den alten role-Wert ` +
      `und keinen der drei Booleans — die Regeln halten sie für Athleten:\n  ${nurLegacy.join("\n  ")}\n`,
  );
}

const camps = await db.collectionGroup("fightCamps").get();

let gesetzt = 0;
let korrigiert = 0;
let unveraendert = 0;
let ohneBesitzer = 0;
const zeilen = [];
let batch = db.batch();
let offen = 0;

for (const c of camps.docs) {
  const uid = c.ref.parent.parent?.id ?? null;
  const info = uid ? istStab.get(uid) : undefined;
  if (!info) {
    // Ein Camp ohne users-Dokument. Es als Athleten-Camp gym-weit sichtbar zu
    // machen wäre die falsche Richtung — im Zweifel privat (Konzept §3).
    ohneBesitzer += 1;
    zeilen.push(`  ${c.id.padEnd(24)} Besitzer ${uid ?? "?"} hat KEIN users-Dokument → ownerIsStaff: true`);
    if (!DRY) batch.update(c.ref, { ownerIsStaff: true });
    offen += 1;
    continue;
  }

  const soll = info.stab;
  const ist = c.data().ownerIsStaff;
  if (ist === soll) {
    unveraendert += 1;
    continue;
  }
  if (ist === undefined) gesetzt += 1;
  else korrigiert += 1;
  zeilen.push(
    `  ${c.id.padEnd(24)} ${info.name.padEnd(24)} ${ist === undefined ? "neu" : `${ist} →`} ${soll}`,
  );
  if (!DRY) {
    batch.update(c.ref, { ownerIsStaff: soll });
    offen += 1;
    // Firestore nimmt 500 Schreibvorgänge pro Batch.
    if (offen >= 400) {
      await batch.commit();
      batch = db.batch();
      offen = 0;
    }
  }
}

if (!DRY && offen > 0) await batch.commit();

if (zeilen.length > 0) console.log(zeilen.join("\n") + "\n");
console.log(`fightCamps gesamt:        ${camps.size}`);
console.log(`Feld neu gesetzt:         ${gesetzt}`);
console.log(`Wert korrigiert:          ${korrigiert}`);
console.log(`schon richtig:            ${unveraendert}`);
console.log(`Besitzer ohne Dokument:   ${ohneBesitzer}`);

// Gegenprobe: nach dem scharfen Lauf trägt jedes Camp das Feld, und zwar
// passend zum Spiegel seines Besitzers.
if (!DRY) {
  const rest = (await db.collectionGroup("fightCamps").get()).docs.filter((c) => {
    const uid = c.ref.parent.parent?.id ?? null;
    const soll = uid ? (istStab.get(uid)?.stab ?? true) : true;
    return c.data().ownerIsStaff !== soll;
  });
  console.log(
    rest.length === 0
      ? "\nGegenprobe: jedes Camp trägt ownerIsStaff passend zum Besitzer ✓"
      : `\nGegenprobe: ${rest.length} Camp(s) weichen NOCH ab ✗ — ${rest.map((d) => d.id).join(", ")}`,
  );
}
