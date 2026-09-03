/**
* Prüft das Gate `canAccessMemberData` EHRLICH: per Firestore-REST
 * mit echten ID-Tokens. Das Admin-SDK umgeht Regeln und beweist nichts.
 *
 * Aufbau: zwei Trainer (A, B) und ein Athlet (C) im Gym, alle mit
 * athleteProfile/main. Erwartung:
 *   A liest C (Athlet)                 → 200
 *   A liest A (sich selbst)            → 200
 *   A liest B (Kollege, privat)        → 403
 *   B gibt A frei (profileSharedWith)  → A liest B → 200
 *   C (Athlet) liest B                 → 403
 * Danach alles löschen und Bestand zählen.
 */
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const GYM = "tidal-athletics";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ironfight-mma";
if (!API_KEY) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY fehlt in .env.local");

initAdmin();
const auth = getAuth();
const db = getFirestore();
const before = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
console.log(`Vorher: ${before.auth} Auth-Konten, ${before.docs} users-Dokumente`);

const pw = `gate-${Math.random().toString(36).slice(2)}A1!`;
const konten = {
  A: { email: "gate-a@tidal-athletics.invalid", rights: { trainer: true, verwaltung: false, admin: false }, name: "Trainer A" },
  B: { email: "gate-b@tidal-athletics.invalid", rights: { trainer: true, verwaltung: false, admin: false }, name: "Trainer B" },
  C: { email: "gate-c@tidal-athletics.invalid", rights: { trainer: false, verwaltung: false, admin: false }, name: "Athlet C" },
};
const uids = {};
try {
  for (const [k, v] of Object.entries(konten)) {
    const u = await auth.createUser({ email: v.email, password: pw, displayName: v.name });
    uids[k] = u.uid;
    await auth.setCustomUserClaims(u.uid, claimsWithRights({ gymId: GYM }, v.rights));
    await db.collection("users").doc(u.uid).set({
      email: v.email, displayName: v.name, gymId: GYM, ...rightsMirror(v.rights), createdAt: new Date(),
    });
    await db.collection("users").doc(u.uid).collection("athleteProfile").doc("main").set({ level: "beginner" });
  }

  async function token(k) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: konten[k].email, password: pw, returnSecureToken: true }),
    });
    const j = await r.json();
    if (!j.idToken) throw new Error(`Login ${k}: ${JSON.stringify(j.error ?? j)}`);
    return j.idToken;
  }
  async function lese(alsK, zielK, pfad = "athleteProfile/main") {
    const t = await token(alsK);
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids[zielK]}/${pfad}`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${t}` } });
    return r.status;
  }
  const erwarte = (bez, ist, soll) =>
    console.log(`${ist === soll ? "✓" : "✗"} ${bez.padEnd(46)} → ${ist}  (erwartet ${soll})`);

  console.log("\nGATE canAccessMemberData — per REST:");
  erwarte("A (Trainer) liest C (Athlet)", await lese("A", "C"), 200);
  erwarte("A liest sich selbst", await lese("A", "A"), 200);
  erwarte("A liest B (Kollege, privat)", await lese("A", "B"), 403);
  erwarte("A liest B/fightProfile (privat)", await lese("A", "B", "fightProfile/main"), 403);
  erwarte("C (Athlet) liest B", await lese("C", "B"), 403);
  erwarte("A liest B users-Dokument (Identität)", await lese("A", "B", ""), 200);

  // B gibt A frei
  await db.collection("users").doc(uids.B).update({ profileSharedWith: [uids.A] });
  erwarte("A liest B NACH Freigabe", await lese("A", "B"), 200);
  erwarte("C liest B NACH Freigabe an A (nicht C)", await lese("C", "B"), 403);
} finally {
  for (const uid of Object.values(uids)) {
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
  }
  const after = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
  console.log(`\nAufgeräumt: ${after.auth} / ${after.docs} ${after.auth === before.auth && after.docs === before.docs ? "✓ wie vorher" : "✗ ABWEICHUNG"}`);
}
