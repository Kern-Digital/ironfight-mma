/**
 * WANDERUNG: Plattform-Admins gehören zu keinem Gym (Leon 21.09.2026).
 *
 *   node --use-system-ca scripts/migrate-admin-ohne-gym.mjs            # nur zeigen
 *   SCHREIBEN=1 node --use-system-ca scripts/migrate-admin-ohne-gym.mjs  # ausführen
 *   VERWALTUNG=jemand@example.com SCHREIBEN=1 node … scripts/migrate-admin-ohne-gym.mjs
 *
 * Leon am 21.09.2026 (wörtlich): „beachte das ein admin konto nur admin sachen
 * machen soll. also ein admin konto soll kein gym angehören, ich richte wenn
 * nötig einen zweiten zugang ein aber alle admins sollen rein admin sein. der
 * aktuelle admin acc soll entsprechend umgebaut werden."
 *
 * Was sie tut:
 *  1. Jedes Konto mit Plattform-Rang verliert den `gymId`-Claim und die
 *     Gym-Felder am users-Dokument. Ab da gilt für dieses Konto `KEIN_GYM`
 *     (lib/gym.ts) statt des Default-Gyms — sonst wäre es stillschweigend
 *     wieder Mitglied von Tidal Athletics (Falle 44).
 *  2. Ein Admin verliert auch `trainer` und `verwaltung`, falls sie je
 *     gesetzt waren. Seit dem 21.09. bringt der Rang sie ohnehin nicht mehr
 *     mit (`effectiveRights` in lib/roles.ts).
 *  3. DAS GYM BRAUCHT EINE VERWALTUNG. Bis zum 21.09. konnte der Admin
 *     einladen und Rechte vergeben, weil der Rang das mitbrachte — in Tidal
 *     Athletics hatte deshalb NIEMAND den Verwaltungs-Claim. Diese Wanderung
 *     setzt ihn deshalb auf ein benanntes Konto (Leons Wahl: noelreichle@,
 *     das zweite Konto „Leon"). Ohne diesen Schritt könnte danach niemand
 *     mehr einladen — auch kein Admin.
 *  4. Beide Konten bekommen ihre Tokens zurückgezogen, damit die Änderung
 *     SOFORT gilt und nicht erst nach bis zu einer Stunde. Beide müssen sich
 *     danach neu anmelden.
 *
 * Läuft mehrfach ohne Schaden: Was schon stimmt, wird nicht angefasst.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const SCHREIBEN = process.env.SCHREIBEN === "1";
const VERWALTUNG_MAIL = process.env.VERWALTUNG ?? "noelreichle@gmail.com";

async function main() {
  const { projectId } = initAdmin();
  console.log(`Projekt ${projectId} · Modus: ${SCHREIBEN ? "SCHREIBEN" : "nur zeigen"}\n`);
  const auth = getAuth();
  const db = getFirestore();

  const alle = [];
  let seite = await auth.listUsers(1000);
  alle.push(...seite.users);
  while (seite.pageToken) {
    seite = await auth.listUsers(1000, seite.pageToken);
    alle.push(...seite.users);
  }

  // ── 1. Admins aus ihrem Gym lösen ──────────────────────────────────────
  const admins = alle.filter(
    (u) => u.customClaims?.admin === true || u.customClaims?.role === "admin",
  );
  console.log(`${admins.length} Konto(en) mit Plattform-Rang:`);
  for (const u of admins) {
    const alt = u.customClaims ?? {};
    const neu = { ...alt };
    delete neu.gymId;
    delete neu.trainer;
    delete neu.verwaltung;
    neu.admin = true;
    // `role: "admin"` bleibt: firestore.rules liest ihn als Migrationspfad
    // (legacyRole), und er sagt dasselbe wie das Häkchen.

    const gleich = JSON.stringify(alt) === JSON.stringify(neu);
    console.log(`  ${u.email ?? u.uid}`);
    console.log(`    vorher  ${JSON.stringify(alt)}`);
    console.log(`    nachher ${JSON.stringify(neu)}${gleich ? "  (unverändert)" : ""}`);

    if (!SCHREIBEN) continue;
    if (!gleich) {
      await auth.setCustomUserClaims(u.uid, neu);
      await auth.revokeRefreshTokens(u.uid);
    }
    await db.collection("users").doc(u.uid).set(
      {
        gymId: FieldValue.delete(),
        gymJoinedAt: FieldValue.delete(),
        trainer: false,
        verwaltung: false,
        admin: true,
      },
      { merge: true },
    );
    console.log("    → Claims gesetzt, Tokens zurückgezogen, users-Dokument bereinigt");
  }

  // ── 2. Das Gym bekommt eine Verwaltung ─────────────────────────────────
  console.log(`\nVerwaltung für das Gym: ${VERWALTUNG_MAIL}`);
  let ziel = null;
  try {
    ziel = await auth.getUserByEmail(VERWALTUNG_MAIL);
  } catch {
    console.log("  FEHLT — dieses Konto gibt es nicht. Nichts gesetzt.");
  }
  if (ziel) {
    const alt = ziel.customClaims ?? {};
    if (alt.admin === true || alt.role === "admin") {
      console.log("  ÜBERSPRUNGEN — das ist ein Admin-Konto; ein Admin führt kein Gym.");
    } else {
      const rechte = {
        trainer: alt.trainer === true || alt.role === "trainer",
        verwaltung: true,
        admin: false,
      };
      const neu = claimsWithRights({ gymId: alt.gymId ?? "tidal-athletics" }, rechte);
      console.log(`  vorher  ${JSON.stringify(alt)}`);
      console.log(`  nachher ${JSON.stringify(neu)}`);
      if (SCHREIBEN) {
        await auth.setCustomUserClaims(ziel.uid, neu);
        await auth.revokeRefreshTokens(ziel.uid);
        await db
          .collection("users")
          .doc(ziel.uid)
          .set({ ...rightsMirror(rechte) }, { merge: true });
        console.log("  → Verwaltung gesetzt, Tokens zurückgezogen, Spiegel nachgezogen");
      }
    }
  }

  // ── 3. Gegenprobe: hat jedes Gym noch eine Verwaltung? ─────────────────
  console.log("\nGegenprobe — Verwaltung je Gym:");
  // FRISCH LESEN, nicht die Liste von oben: Die traegt noch den Stand VOR
  // den Schreibvorgaengen und meldete beim ersten Lauf faelschlich „KEINE
  // VERWALTUNG“ fuer das Gym, das gerade eine bekommen hatte.
  const nachher = [];
  let s2 = await auth.listUsers(1000);
  nachher.push(...s2.users);
  while (s2.pageToken) {
    s2 = await auth.listUsers(1000, s2.pageToken);
    nachher.push(...s2.users);
  }
  const proGym = new Map();
  for (const u of nachher) {
    const c = u.customClaims ?? {};
    if (c.admin === true || c.role === "admin") continue;
    const gym = c.gymId ?? "tidal-athletics";
    if (!proGym.has(gym)) proGym.set(gym, []);
    if (c.verwaltung === true) proGym.get(gym).push(u.email ?? u.uid);
  }
  const gyms = await db.collection("gyms").get();
  for (const g of gyms.docs) {
    const liste = proGym.get(g.id) ?? [];
    console.log(`  ${g.id.padEnd(22)} ${liste.length ? liste.join(", ") : "KEINE VERWALTUNG"}`);
  }

  if (!SCHREIBEN) console.log("\nNichts geändert. Mit SCHREIBEN=1 ausführen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
