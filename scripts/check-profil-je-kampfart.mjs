/**
 * ETAPPE 2 — Profil je Kampfart NACHWEISEN, ohne KI: zwei Analysen (mma,
 * sambo) per Admin-SDK, dann die echte serverseitige Neuberechnung
 * (lib/server/profile-recompute.ts) laufen lassen und in Firestore prüfen:
 *
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/check-profil-je-kampfart.mjs
 *
 *   • fightProfile/main trägt Antworten aus BEIDEN Analysen
 *   • fightProfile/mma NUR die MMA-Antwort, fightProfile/sambo NUR die Sambo-Antwort
 *   • Sambo-Analyse als „falscher Kämpfer" markiert → fightProfile/sambo ist WEG
 *   • Analyse ohne sport (Bestand) zählt nur ins Gesamtprofil
 *
 * Eigenes Konto (mess-e2k@…), danach gelöscht. Bleibt im Repo.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { rightsMirror } from "./lib/role-claims.mjs";
import { recomputeProfile } from "../lib/server/profile-recompute.ts";

const EMAIL = "mess-e2k@tidal-athletics.invalid";
let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

function analyse(id, sport, frage, side, text, extra = {}) {
  return {
    mode: "athlete", targetId: "x", targetName: "Mess", gymId: "tidal-athletics", targetIsStaff: false,
    sourceLabel: `${id}.mp4`, sourceKind: "upload", youtubeUrl: null, fileFingerprint: null,
    fighter: { name: "Mess", corner: "unknown", clothing: "", features: "", startPosition: "" },
    tier: "flash", recency: "recent", videoType: "full", sport, fightMonth: null,
    weight: { value: 1, recency: 1, type: 1, identification: 0.9, identified: true },
    models: { gemini: "t", claude: "t" }, usage: null,
    observation: {
      identification: { description: "", idConfidence: 0.9, evidence: [] }, meta: { coverage: null, ruleset: null },
      actions: [], dnaSplit: null, combos: [], defense: {}, controlTime: null, movement: null, rounds: [], notes: null,
    },
    evaluation: {
      summary: "", style: { primaryStyle: null, approach: null, baseDiscipline: null },
      findings: [{ questionId: frage, categoryId: frage.split("_")[0], answer: text, confidence: 0.8, evidence: ["01:00"], sideKey: side }],
      scores: {}, topWeapons: [], topPatterns: [], topWeaknesses: [], topDangers: [],
      dangerProfile: { mostDangerousWhen: null, finishes: null, vulnerableWhen: null },
      actionStats: [], dnaSplit: null, merge: { confirms: [], contradicts: [], weight: 0 },
    },
    wrongFighter: false, sharedWithAthlete: false, createdBy: "t", createdByName: null,
    createdAt: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    ...extra,
  };
}

const { projectId } = initAdmin();
console.log(`Admin-SDK: ${projectId}`);
const auth = getAuth();
const db = getFirestore();
let uid;
try { uid = (await auth.getUserByEmail(EMAIL)).uid; } catch { uid = (await auth.createUser({ email: EMAIL, displayName: "Mess E2k" })).uid; }
const rechte = { trainer: false, verwaltung: false, admin: false };
await db.collection("users").doc(uid).set({ email: EMAIL, displayName: "Mess E2k", gymId: "tidal-athletics", ...rightsMirror(rechte), createdAt: Timestamp.now() }, { merge: true });
const col = db.collection("users").doc(uid).collection("videoAnalyses");
const prof = (id) => db.collection("users").doc(uid).collection("fightProfile").doc(id);
const Q = "gameplan_seek-distance";
try {
  await col.doc("mma").set({ ...analyse("mma", "mma", Q, "aussen", "Sucht die Außendistanz."), targetId: uid });
  await col.doc("sambo").set({ ...analyse("sambo", "sambo", "entry-patterns_clinch", "griff", "Kommt über den Jackengriff in den Clinch."), targetId: uid });
  await col.doc("alt", ).set({ ...analyse("alt", null, "real-habits_when-tired", "rueckwaerts", "Geht rückwärts."), targetId: uid });

  await recomputeProfile(db, "athlete", uid, "test");
  const main = (await prof("main").get()).data();
  const mma = await prof("mma").get();
  const sambo = await prof("sambo").get();
  sagt(!!main && Q in main.dna && "entry-patterns_clinch" in main.dna && "real-habits_when-tired" in main.dna, "main: Antworten aus MMA, Sambo UND Bestand");
  sagt(mma.exists && Q in mma.data().dna && !("entry-patterns_clinch" in mma.data().dna), "fightProfile/mma: nur die MMA-Antwort");
  sagt(sambo.exists && "entry-patterns_clinch" in sambo.data().dna && !(Q in sambo.data().dna), "fightProfile/sambo: nur die Sambo-Antwort");
  sagt(!(await prof("boxen").get()).exists, "keine Kampfart ohne Analyse");
  sagt(mma.data().evidence?.countedAnalyses === 1 && main.evidence?.countedAnalyses === 3, `gezählt: main ${main.evidence?.countedAnalyses}, mma ${mma.data().evidence?.countedAnalyses}`);

  await col.doc("sambo").update({ wrongFighter: true });
  await recomputeProfile(db, "athlete", uid, "test");
  sagt(!(await prof("sambo").get()).exists, "Sambo markiert → fightProfile/sambo gelöscht");
  sagt(!("entry-patterns_clinch" in ((await prof("main").get()).data()?.dna ?? {})), "… und die Sambo-Antwort ist aus main raus");
  sagt((await prof("mma").get()).exists, "fightProfile/mma bleibt");
} finally {
  await db.recursiveDelete(db.collection("users").doc(uid));
  await auth.deleteUser(uid);
  const users = (await auth.listUsers(1000)).users;
  const rest = users.filter((u) => /tidal-athletics\.invalid$/.test(u.email ?? "")).map((u) => u.email);
  console.log(`Aufgeräumt: ${users.length} Auth-Konten, ${(await db.collection("users").get()).size} users-Dokumente${rest.length ? ` — Prüfkonten übrig: ${rest.join(", ")}` : ""}`);
  console.log(fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : `${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
}
