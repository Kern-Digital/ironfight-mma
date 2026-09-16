/**
 * Prüft die Athleten-Freigabe der KI-Analysen EHRLICH: per Firestore-REST mit
 * echten ID-Tokens (das Admin-SDK umgeht Regeln und beweist nichts).
 *
 * Regelblock: users/{uid}/videoAnalyses/{id} —
 *   Owner liest NUR sharedWithAthlete == true, schreibt NIE;
 *   Trainer/Admin lesen und schreiben (bei Kollegen nur mit Freigabe „deepfight").
 *
 * Konten: logik-a (Trainer), logik-b (Trainer, Kollege), logik-c (Athlet).
 * Erwartung:
 *   C liest eigene UNfreigegebene Analyse          → 403
 *   C liest eigene freigegebene Analyse            → 200
 *   C-Query mit Filter sharedWithAthlete==true     → 200, nur die freigegebene
 *   C-Query OHNE Filter                            → 403
 *   C setzt sharedWithAthlete selbst auf true      → 403
 *   C legt eine Analyse über sich an               → 403
 *   C löscht die freigegebene Analyse              → 403
 *   A (Trainer) liest C-Analyse unfreigegeben      → 200
 *   B (Trainer) liest C-Analyse (Athlet, gym-weit) → 200
 *   A liest B-Analyse (Kollege, ohne Freigabe)     → 403
 *   B gibt A „deepfight" frei → A liest B-Analyse   → 200
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

const pw = `logik-${Math.random().toString(36).slice(2)}A1!`;
const konten = {
  A: { email: "logik-a@tidal-athletics.invalid", rights: { trainer: true, verwaltung: false, admin: false }, name: "Logik Trainer A" },
  B: { email: "logik-b@tidal-athletics.invalid", rights: { trainer: true, verwaltung: false, admin: false }, name: "Logik Trainer B" },
  C: { email: "logik-c@tidal-athletics.invalid", rights: { trainer: false, verwaltung: false, admin: false }, name: "Logik Athlet C" },
};
const uids = {};
const analysen = {}; // C.frei, C.privat, B.privat
let fehler = 0;

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const analyseBody = (shared) => ({
  mode: "athlete", targetName: "Prüf", sourceLabel: "test.mp4", sourceKind: "upload", youtubeUrl: null,
  fighter: { name: "Prüf", corner: "unknown", clothing: "", features: "", startPosition: "" },
  tier: "flash", recency: "unknown", models: { gemini: "t", claude: "t" }, usage: null,
  observation: {}, evaluation: { findings: [] }, appliedFindingIds: [], appliedStats: false,
  sharedWithAthlete: shared, createdBy: "test", createdByName: "Test", createdAt: new Date(),
});

try {
  for (const [k, v] of Object.entries(konten)) {
    const u = await auth.createUser({ email: v.email, password: pw, displayName: v.name });
    uids[k] = u.uid;
    await auth.setCustomUserClaims(u.uid, claimsWithRights({ gymId: GYM }, v.rights));
    await db.collection("users").doc(u.uid).set({
      email: v.email, displayName: v.name, gymId: GYM, ...rightsMirror(v.rights), createdAt: new Date(),
      profileShares: { athlet: [], deepfight: [], wettkampf: [] },
    });
  }
  const col = (k) => db.collection("users").doc(uids[k]).collection("videoAnalyses");
  analysen.Cfrei = (await col("C").add({ ...analyseBody(true), targetId: uids.C })).id;
  analysen.Cprivat = (await col("C").add({ ...analyseBody(false), targetId: uids.C })).id;
  analysen.Bprivat = (await col("B").add({ ...analyseBody(false), targetId: uids.B })).id;

  async function token(k) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: konten[k].email, password: pw, returnSecureToken: true }),
    });
    const j = await r.json();
    if (!j.idToken) throw new Error(`Login ${k}: ${JSON.stringify(j.error ?? j)}`);
    return j.idToken;
  }
  const hdr = async (k, json = false) => ({
    authorization: `Bearer ${await token(k)}`,
    ...(json ? { "content-type": "application/json" } : {}),
  });
  const lese = async (alsK, zielK, id) =>
    (await fetch(`${BASE}/users/${uids[zielK]}/videoAnalyses/${id}`, { headers: await hdr(alsK) })).status;
  const patche = async (alsK, zielK, id, felder) => {
    const maske = Object.keys(felder).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const r = await fetch(`${BASE}/users/${uids[zielK]}/videoAnalyses/${id}?${maske}`, {
      method: "PATCH", headers: await hdr(alsK, true), body: JSON.stringify({ fields: felder }),
    });
    return r.status;
  };
  const lege = async (alsK, zielK) => {
    const r = await fetch(`${BASE}/users/${uids[zielK]}/videoAnalyses`, {
      method: "POST", headers: await hdr(alsK, true),
      body: JSON.stringify({ fields: { sharedWithAthlete: { booleanValue: true }, mode: { stringValue: "athlete" } } }),
    });
    return r.status;
  };
  const loesche = async (alsK, zielK, id) =>
    (await fetch(`${BASE}/users/${uids[zielK]}/videoAnalyses/${id}`, { method: "DELETE", headers: await hdr(alsK) })).status;
  /** Genau die Query aus listVideoAnalyses (mit/ohne sharedOnly). */
  async function query(alsK, zielK, mitFilter) {
    const structuredQuery = {
      from: [{ collectionId: "videoAnalyses" }],
      orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
    };
    if (mitFilter) {
      structuredQuery.where = {
        fieldFilter: { field: { fieldPath: "sharedWithAthlete" }, op: "EQUAL", value: { booleanValue: true } },
      };
    }
    const r = await fetch(`${BASE}/users/${uids[zielK]}:runQuery`, {
      method: "POST", headers: await hdr(alsK, true), body: JSON.stringify({ structuredQuery }),
    });
    if (r.status !== 200) return { status: r.status, ids: [], hinweis: (await r.text()).slice(0, 160) };
    const rows = await r.json();
    return { status: 200, ids: (Array.isArray(rows) ? rows : []).filter((x) => x.document).map((x) => x.document.name.split("/").pop()) };
  }
  const erwarte = (bez, ist, soll) => {
    if (ist !== soll) fehler += 1;
    console.log(`${ist === soll ? "✓" : "✗"} ${bez.padEnd(52)} → ${ist}  (erwartet ${soll})`);
  };

  console.log("\nATHLET C — eigene Analysen:");
  erwarte("C liest eigene UNfreigegebene Analyse", await lese("C", "C", analysen.Cprivat), 403);
  erwarte("C liest eigene freigegebene Analyse", await lese("C", "C", analysen.Cfrei), 200);
  const mit = await query("C", "C", true);
  erwarte("C-Query mit Filter sharedWithAthlete==true", mit.status, 200);
  if (mit.status !== 200) console.log(`    Hinweis: ${mit.hinweis}`);
  erwarte("… liefert nur die freigegebene", mit.ids.join(",") === analysen.Cfrei, true);
  const ohne = await query("C", "C", false);
  erwarte("C-Query OHNE Filter wird abgewiesen", ohne.status, 403);
  erwarte("C setzt sharedWithAthlete selbst auf true", await patche("C", "C", analysen.Cprivat, { sharedWithAthlete: { booleanValue: true } }), 403);
  erwarte("C legt eine Analyse über sich an", await lege("C", "C"), 403);
  erwarte("C löscht die freigegebene Analyse", await loesche("C", "C", analysen.Cfrei), 403);

  console.log("\nTRAINER — Athlet (DeepFight-Tor gilt fuer ALLE seit 16.09.):");
  erwarte("A (Trainer) liest C-Analyse OHNE Freigabe", await lese("A", "C", analysen.Cprivat), 403);
  erwarte("B (Trainer) liest C-Analyse OHNE Freigabe", await lese("B", "C", analysen.Cprivat), 403);
  // C gibt NUR A frei (neue Form { uids, gyms }).
  await db.collection("users").doc(uids.C).set({ profileShares: { athlet: { uids: [], gyms: [] }, deepfight: { uids: [uids.A], gyms: [] }, wettkampf: { uids: [], gyms: [] } } }, { merge: true });
  erwarte("C gibt A frei → A liest", await lese("A", "C", analysen.Cprivat), 200);
  erwarte("… B weiterhin nicht", await lese("B", "C", analysen.Cprivat), 403);
  // C gibt ALLE Trainer des Gyms frei (lebende Regel) → auch B.
  await db.collection("users").doc(uids.C).set({ profileShares: { deepfight: { uids: [], gyms: [GYM] } } }, { merge: true });
  erwarte("C gibt das Gym frei → B liest", await lese("B", "C", analysen.Cprivat), 200);
  erwarte("… A liest ebenfalls", await lese("A", "C", analysen.Cprivat), 200);
  // Alte Form (Namensliste) bleibt lesbar.
  await db.collection("users").doc(uids.C).set({ profileShares: { deepfight: [uids.B] } }, { merge: true });
  erwarte("alte Listenform: B liest", await lese("B", "C", analysen.Cprivat), 200);
  erwarte("… A nicht", await lese("A", "C", analysen.Cprivat), 403);
  await db.collection("users").doc(uids.C).set({ profileShares: { deepfight: { uids: [], gyms: [GYM] } } }, { merge: true });

  console.log("\nTRAINER — Kollege:");
  erwarte("A liest B-Analyse (Kollege, privat)", await lese("A", "B", analysen.Bprivat), 403);
  erwarte("C liest B-Analyse", await lese("C", "B", analysen.Bprivat), 403);
  await db.collection("users").doc(uids.B).set({ profileShares: { athlet: { uids: [], gyms: [] }, deepfight: { uids: [uids.A], gyms: [] }, wettkampf: { uids: [], gyms: [] } } }, { merge: true });
  erwarte("deepfight frei → A liest B-Analyse", await lese("A", "B", analysen.Bprivat), 200);
  erwarte("A setzt Freigabe an C-Analyse (Trainer-Schreiben)", await patche("A", "C", analysen.Cprivat, { sharedWithAthlete: { booleanValue: true } }), 200);
  erwarte("… danach liest C sie", await lese("C", "C", analysen.Cprivat), 200);
} finally {
  for (const uid of Object.values(uids)) {
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
  }
  const after = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
  console.log(`\nAufgeräumt: ${after.auth} / ${after.docs} ${after.auth === before.auth && after.docs === before.docs ? "✓ wie vorher" : "✗ ABWEICHUNG"}`);
  console.log(fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : `${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
}
