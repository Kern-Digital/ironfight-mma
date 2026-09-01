/**
 * Rechte setzen (Admin-SDK) — das Hand-Werkzeug für alles, was KEINE
 * Gym-Oberfläche darf.
 *
 * Für Trainer- und Verwaltungs-Häkchen im eigenen Gym gibt es seit dem
 * 31.08.2026 die Rollen-API (`POST /api/members/role`, Mitgliederliste).
 * Dieses Script bleibt für den PLATTFORM-Rang `admin`, den die API bewusst
 * nicht ausdrücken kann, und für Notfälle ohne Oberfläche.
 *
 * Credentials: `FIREBASE_SERVICE_ACCOUNT_KEY` aus `.env.local` (Rückfall:
 * `GOOGLE_APPLICATION_CREDENTIALS`). Nichts davon steht in dieser Datei.
 *
 * Aufrufe:
 *   node scripts/set-role.mjs <uid> <user|trainer|admin> [--verwaltung|--keine-verwaltung]
 *   node scripts/set-role.mjs --backfill
 *
 * SEIT CHECKPOINT 3 SETZT DER ROLLEN-ARGUMENT EIN SET. `user|trainer|admin`
 * ist als Eingabe geblieben, weil es eingeübt und in CLAUDE.md dokumentiert
 * ist — geschrieben werden aber die Häkchen `trainer`/`admin` (siehe
 * scripts/lib/role-claims.mjs). Das Verwaltungsrecht ist davon unabhängig und
 * bleibt UNANGETASTET, solange keiner der beiden Schalter fällt: Wer hier
 * jemanden zum Trainer macht, soll ihm nicht versehentlich das Gym-Recht
 * nehmen.
 *
 * `--backfill` schreibt jedem Konto seine heutigen Rechte in der neuen Form
 * zurück — idempotent. Für den Checkpoint-3-Cutover gibt es das gezieltere
 * `scripts/migrate-role-set.mjs` (mit `--dry-run` und users-Spiegel).
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

const VALID_ROLES = new Set(["user", "trainer", "admin"]);
const DEFAULT_GYM_ID = "tidal-athletics";

const { source, projectId } = initAdmin();
console.log(`Credentials: ${source} · Projekt ${projectId}`);

function assertRole(role) {
  if (!VALID_ROLES.has(role)) {
    throw new Error(
      `Ungueltige Rolle "${role}". Erlaubt sind: user, trainer, admin.`,
    );
  }
  return role;
}

/** Rechte-Set aus dem Rollen-Argument — `verwaltung` bleibt, wie es war. */
function rightsFromArg(role, existingRights, verwaltungOverride) {
  return {
    trainer: role === "trainer",
    admin: role === "admin",
    verwaltung:
      verwaltungOverride === undefined
        ? existingRights.verwaltung
        : verwaltungOverride,
  };
}

async function setRole(uid, role, verwaltungOverride) {
  const validatedRole = assertRole(role);
  const existing = (await getAuth().getUser(uid)).customClaims ?? {};
  const rights = rightsFromArg(
    validatedRole,
    readRoleSet(existing),
    verwaltungOverride,
  );

  // gymId wird nur ERGAENZT, wenn keines da ist — ein Wechsel findet hier
  // nicht statt (dafuer gibt es Einladung und /api/members/remove).
  const claims = {
    ...claimsWithRights(existing, rights),
    gymId: existing.gymId ?? DEFAULT_GYM_ID,
  };
  await getAuth().setCustomUserClaims(uid, claims);
  await getFirestore()
    .doc(`users/${uid}`)
    .set({ ...rightsMirror(rights), gymId: claims.gymId }, { merge: true });

  console.log(`${uid}: ${rightsText(rights)} · gymId=${claims.gymId}`);
}

/**
 * Schreibt jedem Konto seine heutigen Rechte neu — die Quelle ist der CLAIM,
 * nicht das Dokument. Das Dokument ist nur der Spiegel; läse man es als
 * Quelle, könnte ein von Hand verstellter Wert echte Rechte überschreiben.
 */
async function backfill() {
  const auth = getAuth();
  let processed = 0;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const existing = user.customClaims ?? {};
      const rights = readRoleSet(existing);
      await auth.setCustomUserClaims(user.uid, {
        ...claimsWithRights(existing, rights),
        gymId: existing.gymId ?? DEFAULT_GYM_ID,
      });
      await getFirestore()
        .doc(`users/${user.uid}`)
        .set(rightsMirror(rights), { merge: true });
      processed += 1;
      console.log(`  ${user.uid}: ${rightsText(rights)}`);
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`Backfill abgeschlossen: ${processed} Konten verarbeitet.`);
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.filter((a) => !a.startsWith("--"));

  if (flags.has("--verwaltung") && flags.has("--keine-verwaltung")) {
    throw new Error("--verwaltung und --keine-verwaltung schliessen sich aus.");
  }
  const verwaltungOverride = flags.has("--verwaltung")
    ? true
    : flags.has("--keine-verwaltung")
      ? false
      : undefined;

  if (flags.has("--backfill")) {
    if (positional.length) {
      throw new Error("Usage: node scripts/set-role.mjs --backfill");
    }
    await backfill();
    return;
  }

  const [uid, role] = positional;
  if (!uid || !role) {
    throw new Error(
      "Usage: node scripts/set-role.mjs <uid> <user|trainer|admin> [--verwaltung|--keine-verwaltung]\n" +
        "       node scripts/set-role.mjs --backfill",
    );
  }
  await setRole(uid, role, verwaltungOverride);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
