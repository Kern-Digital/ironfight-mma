/**
 * Rollen-Set-Migration (Multi-Gym Phase 2, Checkpoint 3) — idempotent,
 * beliebig oft ausführbar.
 *
 * Aus `role: "user"|"trainer"|"admin"` plus `verwaltung` werden drei
 * unabhängige Häkchen: `trainer`, `verwaltung`, `admin` (siehe lib/roles.ts
 * und die Zwillingsfassung scripts/lib/role-claims.mjs).
 *
 * Was passiert:
 *   1. Jeder Auth-Nutzer: Claims neu schreiben — Set + `gymId` unverändert
 *      + `role` als Übergangs-Spiegel
 *   2. Jedes `users/{uid}`: Spiegelfelder `trainer`/`verwaltung`/`admin`/`role`
 *
 * WARUM `role` WEITER GESCHRIEBEN WIRD: als Rücknahme-Versicherung. Wer die
 * Firestore-Regeln auf den Stand vor Checkpoint 3 zurückrollt, findet dort
 * `userRole()` vor — ohne den Spiegel wäre danach jeder Trainer plötzlich
 * Athlet. Der Spiegel fällt in einem eigenen Commit, wenn die Produktion
 * länger als eine Stunde auf dem neuen Stand läuft.
 *
 * CUTOVER-REIHENFOLGE (wie beim Phase-1-Cutover, migrate-multi-gym.mjs):
 *   1. Dieses Script ausführen  (`--dry-run` zeigt vorher, was passieren würde)
 *   2. Client ausrollen — er liest das Set, mit Rückfall aufs alte `role`
 *   3. `npx firebase-tools deploy --only firestore:rules`
 *   4. Nutzer laden ihr Token beim nächsten Refresh (~1 h) automatisch neu
 * Neue Indizes braucht dieser Schritt NICHT — es kommt keine Query dazu.
 *
 * Zwischen Schritt 1 und 3 besteht ein kurzes Fenster, in dem die ALTEN Regeln
 * `trainer`/`admin` am users-Dokument noch nicht verbieten. Zugriff gewinnt
 * damit niemand (die Regeln lesen ausschließlich Claims), aber ein selbst
 * gesetztes `admin: true` würde den Aussperr-Schutz mitzählen, der über den
 * Spiegel zählt. Deshalb: Schritte 1–3 in EINEM Zug, nicht über Nacht liegen
 * lassen.
 *
 * Credentials: `FIREBASE_SERVICE_ACCOUNT_KEY` aus `.env.local`
 * (Rückfall: `GOOGLE_APPLICATION_CREDENTIALS`).
 *
 * Aufruf:
 *   node scripts/migrate-role-set.mjs --dry-run
 *   node scripts/migrate-role-set.mjs
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import {
  claimsWithRights,
  readRoleSet,
  rightsMirror,
  rightsText,
} from "./lib/role-claims.mjs";

const DRY = process.argv.includes("--dry-run");

const { source, projectId } = initAdmin();
console.log(
  `Credentials: ${source} · Projekt ${projectId}${DRY ? " · TROCKENLAUF" : ""}\n`,
);

/** Steht das Set schon so am Konto, wie es soll? Dann nichts anfassen. */
function claimsUpToDate(existing, rights) {
  return (
    existing.trainer === (rights.trainer || undefined) &&
    existing.verwaltung === (rights.verwaltung || undefined) &&
    existing.admin === (rights.admin || undefined)
  );
}

async function migrateClaims() {
  const auth = getAuth();
  let updated = 0;
  let skipped = 0;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const existing = user.customClaims ?? {};
      // Quelle ist der CLAIM, nicht das Dokument: Das Dokument ist nur der
      // Spiegel, und ein von Hand verstellter Wert dort darf echte Rechte
      // nicht überschreiben.
      const rights = readRoleSet(existing);
      if (claimsUpToDate(existing, rights)) {
        skipped += 1;
        continue;
      }
      const next = claimsWithRights(existing, rights);
      if (existing.gymId !== undefined) next.gymId = existing.gymId;
      if (!DRY) await auth.setCustomUserClaims(user.uid, next);
      updated += 1;
      console.log(
        `  claim ${user.uid}: role=${existing.role ?? "—"} → ${rightsText(rights)}`,
      );
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`Claims: ${updated} gesetzt, ${skipped} schon aktuell.\n`);
}

async function migrateUserDocs() {
  const auth = getAuth();
  const db = getFirestore();
  const snap = await db.collection("users").get();
  let updated = 0;
  let missing = 0;

  for (const doc of snap.docs) {
    // Auch hier ist der CLAIM die Quelle — der Spiegel wird aus ihm
    // hergestellt, nie umgekehrt.
    let claims;
    try {
      claims = (await auth.getUser(doc.id)).customClaims ?? {};
    } catch {
      // Dokument ohne Auth-Konto (Testrest, geloeschtes Konto). Nicht
      // anfassen: Wir wuessten nicht, welche Rechte richtig waeren.
      missing += 1;
      console.log(`  doc ${doc.id}: KEIN Auth-Konto — uebersprungen`);
      continue;
    }
    const rights = readRoleSet(claims);
    const mirror = rightsMirror(rights);
    const current = doc.data();
    const same =
      current.trainer === mirror.trainer &&
      current.verwaltung === mirror.verwaltung &&
      current.admin === mirror.admin &&
      current.role === mirror.role;
    if (same) continue;

    if (!DRY) await doc.ref.set(mirror, { merge: true });
    updated += 1;
    console.log(`  doc ${doc.id}: → ${rightsText(rights)}`);
  }
  console.log(
    `Dokumente: ${updated} gespiegelt, ${snap.size - updated - missing} schon aktuell` +
      (missing ? `, ${missing} ohne Auth-Konto` : "") +
      ".",
  );
}

async function main() {
  await migrateClaims();
  await migrateUserDocs();
  if (DRY) {
    console.log(
      "\nTROCKENLAUF — es wurde nichts geschrieben. Ohne --dry-run erneut ausfuehren.",
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
