/**
 * Multi-Gym-Migration (Phase 1) — idempotent, beliebig oft ausführbar.
 *
 * Benoetigte Umgebung:
 *   GOOGLE_APPLICATION_CREDENTIALS=/pfad/zum/service-account.json
 *
 * Was passiert (alles auf das Default-Gym "tidal-athletics"):
 *   1. gyms/tidal-athletics anlegen (falls fehlt)
 *   2. JEDER Auth-Nutzer bekommt den Custom Claim gymId (role bleibt erhalten)
 *   3. users/{uid}: gymId-Feld backfillen (Anzeige-/Query-Spiegel des Claims)
 *   4. opponents: fehlende gymId backfillen
 *   5. fightCamps (collectionGroup): fehlende gymId backfillen
 *
 * Cutover-Reihenfolge (WICHTIG — die neuen Rules pruefen data.gymId STRIKT):
 *   1. Dieses Script ausfuehren
 *   2. `npx firebase-tools deploy --only firestore:indexes` (Indizes bauen lassen)
 *   3. Client deployen (git push → Vercel) — neue Queries filtern nach gymId
 *   4. `npx firebase-tools deploy --only firestore:rules`
 *   5. Nutzer laden ihr Token beim naechsten Refresh (~1 h) automatisch neu
 */

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const GYM_ID = "tidal-athletics";
const GYM_NAME = "Tidal Athletics";

initializeApp({ credential: applicationDefault() });

async function ensureGymDoc() {
  const ref = getFirestore().doc(`gyms/${GYM_ID}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`gyms/${GYM_ID}: existiert bereits`);
    return;
  }
  await ref.set({
    name: GYM_NAME,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`gyms/${GYM_ID}: angelegt`);
}

async function backfillClaims() {
  const auth = getAuth();
  let updated = 0;
  let skipped = 0;
  let pageToken = undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const claims = user.customClaims ?? {};
      if (claims.gymId === GYM_ID) {
        skipped += 1;
        continue;
      }
      await auth.setCustomUserClaims(user.uid, { ...claims, gymId: GYM_ID });
      updated += 1;
      console.log(`  claim: ${user.uid} → gymId=${GYM_ID}`);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`Claims: ${updated} gesetzt, ${skipped} schon aktuell.`);
}

async function backfillUserDocs() {
  const snap = await getFirestore().collection("users").get();
  let updated = 0;
  for (const doc of snap.docs) {
    if (doc.data().gymId === GYM_ID) continue;
    await doc.ref.set({ gymId: GYM_ID }, { merge: true });
    updated += 1;
  }
  console.log(`users: ${updated}/${snap.size} Dokumente aktualisiert.`);
}

async function backfillCollection(label, snap) {
  let updated = 0;
  for (const doc of snap.docs) {
    if (doc.data().gymId) continue; // vorhandene gymId niemals ueberschreiben
    await doc.ref.set({ gymId: GYM_ID }, { merge: true });
    updated += 1;
  }
  console.log(`${label}: ${updated}/${snap.size} Dokumente aktualisiert.`);
}

async function main() {
  await ensureGymDoc();
  await backfillClaims();
  await backfillUserDocs();
  await backfillCollection(
    "opponents",
    await getFirestore().collection("opponents").get(),
  );
  await backfillCollection(
    "fightCamps",
    await getFirestore().collectionGroup("fightCamps").get(),
  );
  console.log("Migration abgeschlossen.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
