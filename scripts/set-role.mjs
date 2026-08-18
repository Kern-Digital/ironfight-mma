/**
 * Admin-SDK Rollenscript
 *
 * Benoetigte Umgebung:
 *   GOOGLE_APPLICATION_CREDENTIALS=/pfad/zum/service-account.json
 *
 * Cutover-Reihenfolge:
 *   1. `node scripts/set-role.mjs --backfill` ausfuehren, BEVOR die neuen
 *      firestore.rules deployed werden.
 *   2. Neue firestore.rules deployen, damit Rollen aus Auth Custom Claims
 *      gelesen werden.
 *   3. Nutzer muessen ihr ID-Token aktualisieren oder sich neu anmelden, damit
 *      der neue Claim im Client ankommt.
 *
 * Keine Credentials oder Projekt-IDs in diesem Script hinterlegen.
 */

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const VALID_ROLES = new Set(["user", "trainer", "admin"]);

initializeApp({
  credential: applicationDefault(),
});

function assertRole(role) {
  if (!VALID_ROLES.has(role)) {
    throw new Error(
      `Ungueltige Rolle "${role}". Erlaubt sind: user, trainer, admin.`,
    );
  }
  return role;
}

async function setRole(uid, role) {
  const validatedRole = assertRole(role);

  await getAuth().setCustomUserClaims(uid, { role: validatedRole });
  await getFirestore()
    .doc(`users/${uid}`)
    .set({ role: validatedRole }, { merge: true });

  console.log(`${uid}: role=${validatedRole}`);
}

async function backfillRoles() {
  const snap = await getFirestore().collection("users").get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const role = assertRole(data.role ?? "user");
    await setRole(doc.id, role);
  }

  console.log(`Backfill abgeschlossen: ${snap.size} Nutzer verarbeitet.`);
}

async function main() {
  const [, , uidOrFlag, role] = process.argv;

  if (uidOrFlag === "--backfill") {
    if (role !== undefined) {
      throw new Error("Usage: node scripts/set-role.mjs --backfill");
    }
    await backfillRoles();
    return;
  }

  if (!uidOrFlag || !role) {
    throw new Error(
      "Usage: node scripts/set-role.mjs <uid> <role> | node scripts/set-role.mjs --backfill",
    );
  }

  await setRole(uidOrFlag, role);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
