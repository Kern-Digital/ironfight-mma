/**
 * Migration „Privates Athletenprofil" (Leon 03.09.2026) — idempotent.
 *
 * WAS PASSIERT: Zwei Felder ziehen vom users-Dokument in Unter-Sammlungen:
 *   users/{uid}.athlete       → users/{uid}/athleteProfile/main
 *   users/{uid}.fightProfile  → users/{uid}/fightProfile/main
 * Danach werden die alten Felder am Dokument GELÖSCHT.
 *
 * WARUM: Trainer sollen das Athletenprofil und die DeepFight-Auswertung eines
 * KOLLEGEN nur mit dessen Freigabe sehen. Firestore-Regeln können keine
 * einzelnen Felder verbergen, nur ganze Dokumente — und das users-Dokument
 * muss für die Namensliste lesbar bleiben. Also ziehen die persönlichen Daten
 * eine Ebene tiefer, wo `canAccessMemberData` in firestore.rules greift.
 *
 * CUTOVER-REIHENFOLGE (WICHTIG — Produktion hängt an derselben Firestore):
 *   1. `npx firebase-tools deploy --only firestore:rules`
 *      (additiv: neue Unter-Sammlungen erlaubt, altes Feld-Schreibrecht bleibt)
 *   2. Client deployen (git push → Vercel) — liest Unter-Sammlung, fällt auf
 *      das alte Feld zurück, schreibt nur noch in die Unter-Sammlung
 *   3. DIESES Script (erst --dry-run, dann scharf)
 *   4. Später: altes Feld-Schreibrecht aus den Regeln nehmen (Backlog)
 *
 * Aufruf:  node scripts/migrate-private-profile.mjs [--dry-run]
 *
 * Credentials kommen aus .env.local (scripts/lib/admin-app.mjs).
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";

const DRY = process.argv.includes("--dry-run");

const { source, projectId } = initAdmin();
console.log(`Admin-SDK: ${projectId} (Credentials aus ${source})`);
console.log(DRY ? "PROBELAUF — es wird nichts geschrieben.\n" : "SCHARF — es wird geschrieben.\n");

const db = getFirestore();
const users = await db.collection("users").get();

let athleteMoved = 0;
let fightMoved = 0;
let untouched = 0;
let alreadyMigrated = 0;
const details = [];

for (const snap of users.docs) {
  const data = snap.data();
  const hatAthlete = data.athlete !== undefined;
  const hatFight = data.fightProfile !== undefined;

  if (!hatAthlete && !hatFight) {
    untouched += 1;
    continue;
  }

  const ref = snap.ref;
  const batch = db.batch();
  const was = [];

  if (hatAthlete) {
    const ziel = ref.collection("athleteProfile").doc("main");
    const zielSnap = await ziel.get();
    if (zielSnap.exists) {
      // Neue Ablage hat schon Daten (z. B. seit dem Code-Deploy geschrieben) —
      // die sind jünger als das alte Feld. Nur das alte Feld löschen.
      was.push("athlete: Feld entfernt (Unter-Sammlung war schon da)");
      alreadyMigrated += 1;
    } else {
      batch.set(ziel, data.athlete);
      was.push("athlete → athleteProfile/main");
      athleteMoved += 1;
    }
    batch.update(ref, { athlete: FieldValue.delete() });
  }

  if (hatFight) {
    const ziel = ref.collection("fightProfile").doc("main");
    const zielSnap = await ziel.get();
    if (zielSnap.exists) {
      was.push("fightProfile: Feld entfernt (Unter-Sammlung war schon da)");
      alreadyMigrated += 1;
    } else {
      batch.set(ziel, data.fightProfile);
      was.push("fightProfile → fightProfile/main");
      fightMoved += 1;
    }
    batch.update(ref, { fightProfile: FieldValue.delete() });
  }

  details.push(`  ${snap.id.padEnd(30)} ${data.displayName ?? data.email ?? "?"}\n      ${was.join("\n      ")}`);
  if (!DRY) await batch.commit();
}

console.log(details.join("\n"));
console.log("");
console.log(`users-Dokumente gesamt:        ${users.size}`);
console.log(`ohne die beiden Felder:        ${untouched}`);
console.log(`athlete umgezogen:             ${athleteMoved}`);
console.log(`fightProfile umgezogen:        ${fightMoved}`);
console.log(`nur Feld entfernt (schon neu): ${alreadyMigrated}`);

// Gegenprobe: nach dem scharfen Lauf darf kein Dokument die Felder mehr tragen.
if (!DRY) {
  const rest = (await db.collection("users").get()).docs.filter(
    (d) => d.data().athlete !== undefined || d.data().fightProfile !== undefined,
  );
  console.log(
    rest.length === 0
      ? "\nGegenprobe: kein users-Dokument trägt die Felder mehr ✓"
      : `\nGegenprobe: ${rest.length} Dokument(e) tragen die Felder NOCH ✗ — ${rest.map((d) => d.id).join(", ")}`,
  );
}
