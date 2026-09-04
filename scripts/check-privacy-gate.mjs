/**
 * Prüft das Gate `canAccessMemberData` EHRLICH: per Firestore-REST
 * mit echten ID-Tokens. Das Admin-SDK umgeht Regeln und beweist nichts.
 *
 * Aufbau: zwei Trainer (A, B) und ein Athlet (C) im Gym, alle mit
 * athleteProfile/main und fightProfile/main.
 *
 * SEIT DEM 03.09.2026 IST DIE FREIGABE NACH BEREICHEN GETRENNT (Leons
 * Revision, `users/{uid}.profileShares`, Schlüssel in lib/profile-sharing.ts).
 * Der Test prüft deshalb nicht mehr nur „gesperrt/frei", sondern auch, dass
 * ein Bereich den anderen NICHT mitöffnet — genau die Falle, die entstünde,
 * wenn der generische users-Wildcard `fightProfile` weiter mitdeckte.
 *
 * Erwartung:
 *   A liest C (Athlet)                          → 200
 *   A liest A (sich selbst)                     → 200
 *   A liest B (Kollege, privat)                 → 403
 *   B gibt A NUR „athlet" frei                  → Profil 200, Kampfprofil 403
 *   B gibt A zusätzlich „deepfight" frei        → Kampfprofil 200
 *   B nimmt alles zurück                        → wieder 403
 *   C (Athlet) liest B                          → 403
 *   Der Inhaber schreibt seine Freigabe selbst  → 200
 *   Der Inhaber schreibt sich ein Recht         → 403
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
let fehler = 0;
try {
  for (const [k, v] of Object.entries(konten)) {
    const u = await auth.createUser({ email: v.email, password: pw, displayName: v.name });
    uids[k] = u.uid;
    await auth.setCustomUserClaims(u.uid, claimsWithRights({ gymId: GYM }, v.rights));
    await db.collection("users").doc(u.uid).set({
      email: v.email, displayName: v.name, gymId: GYM, ...rightsMirror(v.rights), createdAt: new Date(),
    });
    await db.collection("users").doc(u.uid).collection("athleteProfile").doc("main").set({ level: "beginner" });
    await db.collection("users").doc(u.uid).collection("fightProfile").doc("main").set({ dna: {} });
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
  /** Der Inhaber schreibt SELBST an seinem users-Dokument — per REST, mit
      updateMask, damit nur genau dieses Feld angefasst wird. */
  async function schreibeSelbst(alsK, felder) {
    const t = await token(alsK);
    const maske = Object.keys(felder).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids[alsK]}?${maske}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ fields: felder }),
    });
    return r.status;
  }
  /** `profileShares` als Firestore-REST-Wert: Map von Bereich → Array<uid>. */
  const sharesWert = (map) => ({
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(map).map(([bereich, liste]) => [
          bereich,
          { arrayValue: { values: liste.map((u) => ({ stringValue: u })) } },
        ]),
      ),
    },
  });
  /** Freigabe per Admin-SDK setzen (schneller Aufbau eines Zustands). */
  const setzeShares = (k, map) =>
    db.collection("users").doc(uids[k]).set({ profileShares: map }, { merge: true });

  const erwarte = (bez, ist, soll) => {
    if (ist !== soll) fehler += 1;
    console.log(`${ist === soll ? "✓" : "✗"} ${bez.padEnd(50)} → ${ist}  (erwartet ${soll})`);
  };

  console.log("\nGATE canAccessMemberData — per REST:");
  erwarte("A (Trainer) liest C (Athlet)", await lese("A", "C"), 200);
  erwarte("A liest sich selbst", await lese("A", "A"), 200);
  erwarte("A liest B (Kollege, privat)", await lese("A", "B"), 403);
  erwarte("A liest B/fightProfile (privat)", await lese("A", "B", "fightProfile/main"), 403);
  erwarte("C (Athlet) liest B", await lese("C", "B"), 403);
  erwarte("A liest B users-Dokument (Identität)", await lese("A", "B", ""), 200);

  // ─── Bereiche sind getrennt (Leons Revision 03.09.) ──────────────────────
  console.log("\nBEREICHE — eine Freigabe öffnet NUR ihren Bereich:");
  await setzeShares("B", { athlet: [uids.A] });
  erwarte("nur athlet frei → Athletenprofil", await lese("A", "B"), 200);
  erwarte("nur athlet frei → Kampfprofil", await lese("A", "B", "fightProfile/main"), 403);

  await setzeShares("B", { athlet: [uids.A], deepfight: [uids.A] });
  erwarte("auch deepfight frei → Kampfprofil", await lese("A", "B", "fightProfile/main"), 200);

  await setzeShares("B", { athlet: [], deepfight: [uids.A] });
  erwarte("athlet zurückgenommen → Athletenprofil", await lese("A", "B"), 403);
  erwarte("deepfight bleibt → Kampfprofil", await lese("A", "B", "fightProfile/main"), 200);

  erwarte("C liest B trotz Freigabe an A", await lese("C", "B"), 403);

  // ─── Wer die Liste pflegen darf (Schritt 2, der Freigabe-Knopf) ──────────
  //
  // ACHTUNG, TEUER GELERNT (03.09.2026): `affectedKeys()` in den Regeln
  // enthaelt NUR Felder, die sich tatsaechlich AENDERN. Ein Schreibvorgang mit
  // dem bereits gespeicherten Wert ist ein No-Op — `affectedKeys()` ist dann
  // leer, `hasAny([...])` liefert false und `hasOnly([...])` sogar true. Ein
  // erster Anlauf dieses Tests schrieb genau solche No-Ops und meldete
  // freudig 200, wo er 403 erwartete. Jede Zeile hier muss deshalb einen Wert
  // setzen, den das Zieldokument NICHT schon traegt.
  console.log("\nSCHREIBRECHT am eigenen users-Dokument:");
  erwarte(
    "B setzt seine eigene Freigabe",
    await schreibeSelbst("B", { profileShares: sharesWert({ athlet: [uids.A] }) }),
    200,
  );
  erwarte(
    // C ist Athlet und traegt trainer:false — das hier ist eine ECHTE Aenderung.
    "C setzt sich selbst das Trainer-Recht",
    await schreibeSelbst("C", { trainer: { booleanValue: true } }),
    403,
  );
  erwarte(
    "A setzt die Freigabe von B (fremdes Dokument)",
    await (async () => {
      const t = await token("A");
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids.B}?updateMask.fieldPaths=profileShares`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ fields: { profileShares: sharesWert({ athlet: [uids.C] }) } }),
      });
      return r.status;
    })(),
    403,
  );
} finally {
  for (const uid of Object.values(uids)) {
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
  }
  const after = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
  console.log(`\nAufgeräumt: ${after.auth} / ${after.docs} ${after.auth === before.auth && after.docs === before.docs ? "✓ wie vorher" : "✗ ABWEICHUNG"}`);
  console.log(fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : `${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
}
