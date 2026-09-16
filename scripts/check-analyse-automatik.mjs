/**
 * Prüft die Regeln der AUTOMATIK (Etappe 1, 16.09.2026) EHRLICH: per
 * Firestore-REST mit echten ID-Tokens gegen die LIVE-Regeln. Das Admin-SDK
 * legt nur Konten und Testdaten an — es umgeht Regeln und beweist nichts.
 *
 * Was seit der Automatik gelten muss:
 *   • Analysen legt der Client NICHT mehr an, löscht sie nicht, markiert sie
 *     nicht selbst — nur `sharedWithAthlete` darf er ändern (Athleten-Modus).
 *   • Kampfprofil (users/{uid}/fightProfile/main): Trainer lesen, schreiben nie.
 *   • Gegnerprofil: Stammdaten ja, abgeleitete Felder (dnaSplit,
 *     dnaSplitWeight, actionStats, evidence) nein.
 *   • collectionGroup videoAnalyses: nur mit BEIDEN Filtern (gymId +
 *     targetIsStaff==false), liefert keine Kollegen-Analysen; Athleten gar nicht.
 *   • aiUsage: Client liest (nur Admin) und schreibt nie.
 *
 * Konten: logik-a (Trainer), logik-b (Trainer, Kollege), logik-c (Athlet).
 * Danach alles löschen und Bestand zählen (Soll 7 Auth-Konten / 37 users).
 *
 * Aufruf (Projektstamm): node scripts/check-analyse-automatik.mjs
 * Der Index-Test (Zeile „cg mit beiden Filtern") braucht den Composite-Index
 * aus firestore.indexes.json — ohne ihn antwortet Firestore 400, und ein 400
 * beweist über die Regeln nichts.
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
const ids = {};
let gegnerId = null;
let fehler = 0;

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const analyseBody = (o) => ({
  mode: o.mode, targetId: o.targetId, targetName: "Prüf", gymId: GYM, targetIsStaff: o.targetIsStaff,
  sourceLabel: "test.mp4", sourceKind: "upload", youtubeUrl: null, fileFingerprint: null,
  fighter: { name: "Prüf", corner: "unknown", clothing: "", features: "", startPosition: "" },
  tier: "flash", recency: "recent", videoType: "full", fightMonth: null,
  weight: { value: 1, recency: 1, type: 1, identification: 0.9, identified: true },
  models: { gemini: "t", claude: "t" }, usage: null,
  observation: { identification: { description: "", idConfidence: 0.9, evidence: [] }, meta: {}, actions: [], dnaSplit: null, combos: [], defense: {}, controlTime: null, movement: null, rounds: [], notes: null },
  evaluation: { summary: "", findings: [], merge: { confirms: [], contradicts: [], weight: 0 }, actionStats: [], dnaSplit: null },
  wrongFighter: false, sharedWithAthlete: false, createdBy: "test", createdByName: "Test", createdAt: new Date(),
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
  const gegner = await db.collection("opponents").add({
    gymId: GYM, name: "Logik Gegner", style: "striker", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null,
    strengths: [], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, dnaSplit: { boxing: 50, kicking: 50, wrestling: 0, ground: 0, clinch: 0 },
    dnaSplitWeight: 1, actionStats: [], evidence: null, sharedWith: [], createdBy: "test", createdByName: "Test", createdAt: new Date(), updatedAt: new Date(),
  });
  gegnerId = gegner.id;
  ids.C = (await db.collection("users").doc(uids.C).collection("videoAnalyses").add(analyseBody({ mode: "athlete", targetId: uids.C, targetIsStaff: false }))).id;
  ids.B = (await db.collection("users").doc(uids.B).collection("videoAnalyses").add(analyseBody({ mode: "athlete", targetId: uids.B, targetIsStaff: true }))).id;
  ids.G = (await gegner.collection("videoAnalyses").add(analyseBody({ mode: "opponent", targetId: gegnerId, targetIsStaff: false }))).id;
  await db.collection("users").doc(uids.C).collection("fightProfile").doc("main").set({ dna: {}, dnaSplit: null, dnaSplitWeight: 0, actionStats: [], evidence: null, updatedBy: null, updatedAt: new Date() });

  async function token(k) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: konten[k].email, password: pw, returnSecureToken: true }),
    });
    const j = await r.json();
    if (!j.idToken) throw new Error(`Login ${k}: ${JSON.stringify(j.error ?? j)}`);
    return j.idToken;
  }
  const tokens = { A: await token("A"), B: await token("B"), C: await token("C") };
  const hdr = (k, json = false) => ({ authorization: `Bearer ${tokens[k]}`, ...(json ? { "content-type": "application/json" } : {}) });
  const lese = async (k, pfad) => (await fetch(`${BASE}/${pfad}`, { headers: hdr(k) })).status;
  const patche = async (k, pfad, felder) => {
    const maske = Object.keys(felder).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    return (await fetch(`${BASE}/${pfad}?${maske}`, { method: "PATCH", headers: hdr(k, true), body: JSON.stringify({ fields: felder }) })).status;
  };
  const lege = async (k, sammlung, felder) =>
    (await fetch(`${BASE}/${sammlung}`, { method: "POST", headers: hdr(k, true), body: JSON.stringify({ fields: felder }) })).status;
  const loesche = async (k, pfad) => (await fetch(`${BASE}/${pfad}`, { method: "DELETE", headers: hdr(k) })).status;
  /** collectionGroup-Query wie listGymVideoAnalyses — Filter wählbar. */
  async function cgQuery(k, { gym = true, staff = "false" } = {}) {
    const filters = [];
    if (gym) filters.push({ fieldFilter: { field: { fieldPath: "gymId" }, op: "EQUAL", value: { stringValue: GYM } } });
    if (staff !== null) filters.push({ fieldFilter: { field: { fieldPath: "targetIsStaff" }, op: "EQUAL", value: { booleanValue: staff === "true" } } });
    const structuredQuery = {
      from: [{ collectionId: "videoAnalyses", allDescendants: true }],
      orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
    };
    if (filters.length === 1) structuredQuery.where = filters[0];
    if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: "AND", filters } };
    const r = await fetch(`${BASE}:runQuery`, { method: "POST", headers: hdr(k, true), body: JSON.stringify({ structuredQuery }) });
    if (r.status !== 200) return { status: r.status, ids: [], hinweis: (await r.text()).slice(0, 200) };
    const rows = await r.json();
    return { status: 200, ids: (Array.isArray(rows) ? rows : []).filter((x) => x.document).map((x) => x.document.name.split("/").pop()) };
  }
  const erwarte = (bez, ist, soll) => {
    if (ist !== soll) fehler += 1;
    console.log(`${ist === soll ? "✓" : "✗"} ${bez.padEnd(58)} → ${ist}  (erwartet ${soll})`);
  };
  const s = { boolean: (v) => ({ booleanValue: v }), string: (v) => ({ stringValue: v }), int: (v) => ({ integerValue: String(v) }) };
  const cPfad = `users/${uids.C}/videoAnalyses/${ids.C}`;
  const gPfad = `opponents/${gegnerId}/videoAnalyses/${ids.G}`;

  console.log("\nANALYSEN — Trainer A gegen Athlet C und Gegner:");
  erwarte("A liest C-Analyse", await lese("A", cPfad), 200);
  erwarte("A legt Analyse über C an (Client-Create)", await lege("A", `users/${uids.C}/videoAnalyses`, { mode: s.string("athlete"), gymId: s.string(GYM), targetIsStaff: s.boolean(false) }), 403);
  erwarte("A setzt sharedWithAthlete (einziges Client-Feld)", await patche("A", cPfad, { sharedWithAthlete: s.boolean(true) }), 200);
  erwarte("A setzt wrongFighter selbst", await patche("A", cPfad, { wrongFighter: s.boolean(true) }), 403);
  erwarte("A setzt sharedWithAthlete UND targetName", await patche("A", cPfad, { sharedWithAthlete: s.boolean(false), targetName: s.string("X") }), 403);
  erwarte("A ändert gymId der Analyse", await patche("A", cPfad, { gymId: s.string("fremd") }), 403);
  erwarte("A löscht C-Analyse", await loesche("A", cPfad), 403);
  erwarte("A liest Gegner-Analyse", await lese("A", gPfad), 200);
  erwarte("A legt Gegner-Analyse an (Client-Create)", await lege("A", `opponents/${gegnerId}/videoAnalyses`, { mode: s.string("opponent") }), 403);
  erwarte("A markiert Gegner-Analyse selbst", await patche("A", gPfad, { wrongFighter: s.boolean(true) }), 403);
  erwarte("A löscht Gegner-Analyse", await loesche("A", gPfad), 403);

  console.log("\nKAMPFPROFIL — Trainer liest, schreibt nie:");
  erwarte("A liest fightProfile von C", await lese("A", `users/${uids.C}/fightProfile/main`), 200);
  erwarte("A schreibt fightProfile von C", await patche("A", `users/${uids.C}/fightProfile/main`, { dnaSplitWeight: s.int(9) }), 403);
  erwarte("C liest eigenes fightProfile", await lese("C", `users/${uids.C}/fightProfile/main`), 200);
  erwarte("C schreibt eigenes fightProfile", await patche("C", `users/${uids.C}/fightProfile/main`, { dnaSplitWeight: s.int(9) }), 403);

  console.log("\nGEGNERPROFIL — Stammdaten ja, Abgeleitetes nein:");
  erwarte("A ändert notes", await patche("A", `opponents/${gegnerId}`, { notes: s.string("Neue Notiz") }), 200);
  erwarte("A ändert dnaSplitWeight", await patche("A", `opponents/${gegnerId}`, { dnaSplitWeight: s.int(7) }), 403);
  erwarte("A ändert evidence", await patche("A", `opponents/${gegnerId}`, { evidence: { mapValue: { fields: { evidenceTotal: s.int(9) } } } }), 403);
  // Falle 4: ein leeres Array auf ein leeres Array ist KEINE Änderung → 200.
  // Die Zeile setzt deshalb einen echten Eintrag.
  erwarte("A ändert actionStats", await patche("A", `opponents/${gegnerId}`, { actionStats: { arrayValue: { values: [{ mapValue: { fields: { id: s.string("cross"), attempted: s.int(3), landed: s.int(1) } } }] } } }), 403);
  erwarte("A legt Gegner MIT dnaSplit an", await lege("A", "opponents", { gymId: s.string(GYM), name: s.string("Neu"), dnaSplit: { mapValue: { fields: { boxing: s.int(1) } } } }), 403);
  const neuerGegner = await fetch(`${BASE}/opponents`, { method: "POST", headers: hdr("A", true), body: JSON.stringify({ fields: { gymId: s.string(GYM), name: s.string("Neu ohne Split"), dna: { mapValue: { fields: {} } }, sharedWith: { arrayValue: { values: [] } } } }) });
  erwarte("A legt Gegner OHNE Abgeleitetes an", neuerGegner.status, 200);
  if (neuerGegner.status === 200) {
    const j = await neuerGegner.json();
    await db.doc(j.name.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents\//, "")).delete();
  }

  console.log("\nCOLLECTIONGROUP — eine Abfrage fürs Gym:");
  const beide = await cgQuery("A");
  erwarte("cg mit beiden Filtern (gymId + targetIsStaff==false)", beide.status, 200);
  if (beide.status !== 200) console.log(`    Hinweis: ${beide.hinweis}`);
  erwarte("… enthält C-Analyse (Athlet)", beide.ids.includes(ids.C), true);
  erwarte("… enthält Gegner-Analyse", beide.ids.includes(ids.G), true);
  erwarte("… enthält NICHT B-Analyse (Kollege)", beide.ids.includes(ids.B), false);
  erwarte("cg nur mit gymId", (await cgQuery("A", { staff: null })).status, 403);
  erwarte("cg mit targetIsStaff==true", (await cgQuery("A", { staff: "true" })).status, 403);
  erwarte("cg ohne gymId", (await cgQuery("A", { gym: false })).status, 403);
  erwarte("Athlet C: cg-Abfrage", (await cgQuery("C")).status, 403);
  erwarte("A liest B-Analyse direkt (Kollege, ohne Freigabe)", await lese("A", `users/${uids.B}/videoAnalyses/${ids.B}`), 403);
  await db.collection("users").doc(uids.B).set({ profileShares: { athlet: [], deepfight: [uids.A], wettkampf: [] } }, { merge: true });
  erwarte("… mit deepfight-Freigabe", await lese("A", `users/${uids.B}/videoAnalyses/${ids.B}`), 200);
  erwarte("… cg liefert B trotz Freigabe NICHT (direkter Pfad)", (await cgQuery("A")).ids.includes(ids.B), false);

  console.log("\nKOSTEN — Client liest nicht (kein Admin), schreibt nie:");
  erwarte("A liest aiUsage/summary", await lese("A", "aiUsage/summary"), 403);
  erwarte("A schreibt aiUsage/summary", await patche("A", "aiUsage/summary", { spentEur: s.int(0) }), 403);
  erwarte("A schreibt aiUsage/gym-tidal-athletics", await patche("A", `aiUsage/gym-${GYM}`, { spentEur: s.int(0) }), 403);
} finally {
  for (const uid of Object.values(uids)) {
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
  }
  if (gegnerId) await db.recursiveDelete(db.collection("opponents").doc(gegnerId));
  const after = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
  console.log(`\nAufgeräumt: ${after.auth} / ${after.docs} ${after.auth === before.auth && after.docs === before.docs ? "✓ wie vorher" : "✗ ABWEICHUNG"}`);
  console.log(fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : `${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
}
