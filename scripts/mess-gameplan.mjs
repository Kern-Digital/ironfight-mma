/**
 * KAMPFART AM WETTKAMPF + GAMEPLAN — Messung OHNE KI (Fenster tidal-athletics-2d,
 * 17.09.2026).
 *
 *   node --experimental-transform-types --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gameplan.mjs   # nur Firestore
 *   BROWSER=1 THEME=dark node --experimental-transform-types --import … scripts/mess-gameplan.mjs  # + Schirme
 *
 * Firestore (Admin-SDK, eigene Prüfkonten mess-2da@/mess-2dt@…invalid, danach gelöscht):
 *   • Gegner mit zwei Käfig-Analysen → echte Neuberechnung schreibt
 *     evidence.flaeche = kaefig und kampfarten = [mma] (Frage aus dem Prompt).
 *   • Athlet mit zwei MMA-Analysen auf der Matte → fightProfile/mma.
 *   • betroffeneWettkaempfe: Athlet (Kampfart) und Gegner (collectionGroup-Index
 *     gymId + competitionDate, Gegner im Speicher gefiltert).
 *   • schreibeGameplan ohne Claude-Kosten: Wettkampf ohne Kampfart → offen ·
 *     kampfart; Gegner ohne Daten → offen · gegner.
 *   • ein fertiger Gameplan (von Hand geschrieben) für die Schirme.
 * Browser (Trainer): Wettkampfseite mit Kampfart-Chip, Gameplan-Block, Drills in
 * Phase 2/3, Athletensicht (keine Vorschläge, Profilstärke), Gegner mit Käfig;
 * Bestand mit „Kampfart wählen"; Gegnerprofil; Anlegen mit vorbelegter Kampfart.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";
import { recomputeProfile } from "../lib/server/profile-recompute.ts";
import { betroffeneWettkaempfe, schreibeGameplan } from "../lib/server/gameplan.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const BROWSER = process.env.BROWSER === "1";
const GYM_ID = "tidal-athletics";
const ATHLET = "mess-2da@tidal-athletics.invalid";
const TRAINER = "mess-2dt@tidal-athletics.invalid";
const PASSWORD = `mess-2d-${Math.random().toString(36).slice(2)}A1!`;
const OUT = process.env.OUT ?? ".";

let fehler = 0;
let ok = 0;
const sagt = (bestanden, text) => {
  if (bestanden) ok += 1;
  else fehler += 1;
  console.log(`  ${bestanden ? "OK  " : "FEHL"} ${text}`);
};

const befund = (questionId, sideKey, answer) => ({
  questionId, categoryId: questionId.split("_")[0], answer, confidence: 0.8, evidence: ["01:00"], sideKey,
});

function analyse(mode, targetId, name, { sport, flaeche, findings, actionStats, dnaSplit, tageAlt }) {
  return {
    mode, targetId, targetName: name, gymId: GYM_ID, targetIsStaff: false,
    sourceLabel: `${sport}-${tageAlt}.mp4`, sourceKind: "upload", youtubeUrl: null, fileFingerprint: null,
    fighter: { name, corner: "unknown", clothing: "", features: "", startPosition: "" },
    tier: "flash", recency: "recent", videoType: "full", sport, variante: null, flaeche, verworfen: [], fightMonth: null,
    weight: { value: 1, recency: 1, type: 1, identification: 0.9, identified: true },
    models: { gemini: "mess", claude: "mess" }, usage: null,
    observation: {
      identification: { description: "", idConfidence: 0.9, evidence: [] }, meta: { coverage: null, ruleset: null },
      actions: [], dnaSplit: null, combos: [], defense: {}, controlTime: null, movement: null, rounds: [], notes: null,
    },
    evaluation: {
      summary: "", style: { primaryStyle: null, approach: null, baseDiscipline: null },
      findings, scores: {}, topWeapons: [], topPatterns: [], topWeaknesses: [], topDangers: [],
      dangerProfile: { mostDangerousWhen: null, finishes: null, vulnerableWhen: null },
      actionStats, dnaSplit, merge: { confirms: [], contradicts: [], weight: 0 },
    },
    wrongFighter: false, sharedWithAthlete: false, createdBy: "mess", createdByName: null,
    createdAt: Timestamp.fromDate(new Date(Date.now() - tageAlt * 86_400_000)),
  };
}

function camp(uid, trainerUid, { name, sport, opponentId, opponentName, tage }) {
  const start = new Date();
  const datum = new Date(Date.now() + tage * 86_400_000);
  const woche = 7 * 86_400_000;
  const phase = (p, i, focus) => ({
    phase: p, startsAt: Timestamp.fromDate(new Date(start.getTime() + i * 2 * woche)),
    endsAt: Timestamp.fromDate(new Date(start.getTime() + (i + 1) * 2 * woche)), weeks: 2, focus,
    techniqueIds: [], exerciseIds: [], trainingAreas: [], categories: ["boxing"], sessionsPerWeek: 4, sparringRatio: 0.2,
  });
  const doc = {
    studentUid: uid, gymId: GYM_ID, ownerIsStaff: false, createdBy: trainerUid, createdAt: Timestamp.now(),
    competitionDate: Timestamp.fromDate(datum), competitionName: name, weeksTotal: 8, startedAt: Timestamp.fromDate(start),
    opponent: { name: opponentName, style: "striker", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null, strengths: [], weaknesses: [], favoriteAttacks: [], opponentId },
    phases: [
      phase("foundation", 0, "Aufbau."), phase("specific-prep", 1, "Gegnerspezifisch."),
      phase("sparring-simulation", 2, "Sparring."), phase("taper", 3, "Taper."),
    ],
    status: "active", notizen: [], opponentId,
  };
  if (sport) doc.sport = sport;
  return doc;
}

async function konto(auth, db, email, name, rechte, extra = {}) {
  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (await auth.createUser({ email, password: PASSWORD, displayName: name, emailVerified: true })).uid;
  }
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email, displayName: name, gymId: GYM_ID, onboarded: true, ...rightsMirror(rechte), createdAt: Timestamp.now(), ...extra },
    { merge: true },
  );
  return uid;
}

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} · BROWSER ${BROWSER ? `an (${BASE}, ${THEME})` : "aus"}`);
  const auth = getAuth();
  const db = getFirestore();
  let athletUid = null;
  let trainerUid = null;
  const gegnerIds = [];

  try {
    const nichts = { trainer: false, verwaltung: false, admin: false };
    athletUid = await konto(auth, db, ATHLET, "Mess Athlet 2d", nichts, {
      profileShares: { athlet: { uids: [], gyms: [GYM_ID] }, deepfight: { uids: [], gyms: [GYM_ID] }, wettkampf: { uids: [], gyms: [GYM_ID] } },
    });
    trainerUid = await konto(auth, db, TRAINER, "Mess Trainer 2d", { trainer: true, verwaltung: false, admin: false }, { trainerOnboarded: true });

    // ── Gegner mit zwei Käfig-Analysen ────────────────────────────────────
    const gegner = db.collection("opponents").doc();
    gegnerIds.push(gegner.id);
    await gegner.set({
      gymId: GYM_ID, name: "Mess Gegner Käfig", style: "wrestler", stance: "southpaw", heightCm: 182, weightKg: 77, reachCm: 188,
      strengths: ["Double Leg am Rand"], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [],
      createdBy: trainerUid, createdByName: "Mess Trainer 2d", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    for (const [i, tage] of [[1, 3], [2, 1]]) {
      await gegner.collection("videoAnalyses").doc(`kaefig-${i}`).set(analyse("opponent", gegner.id, "Mess Gegner Käfig", {
        sport: "mma", flaeche: "kaefig", tageAlt: tage,
        findings: [
          befund("preferred-weapons_takedown", "double-leg", "Er schießt den Double Leg, sobald er am Rand steht."),
          befund("weaknesses_technical", "kopf-offen", "Nach dem Shot bleibt sein Kopf offen."),
        ],
        actionStats: [{ id: "double-leg", attempted: 6, landed: 4, zone: "cage" }, { id: "jab", attempted: 12, landed: 4, zone: "center" }],
        dnaSplit: { boxing: 35, kicking: 5, wrestling: 45, ground: 10, clinch: 5 },
      }));
    }
    const { profil: gp } = await recomputeProfile(db, "opponent", gegner.id, "mess");
    const gDoc = (await gegner.get()).data();
    sagt(gDoc.evidence?.flaeche === "kaefig", `Gegner-Neuberechnung schreibt evidence.flaeche = ${gDoc.evidence?.flaeche}`);
    sagt(JSON.stringify(gDoc.evidence?.kampfarten) === '["mma"]', `… und evidence.kampfarten = ${JSON.stringify(gDoc.evidence?.kampfarten)}`);
    sagt((gp.evidence.countedAnalyses ?? 0) === 2, `… aus 2 zählenden Analysen (${gp.evidence.countedAnalyses})`);

    // Leerer Gegner (keine Videos, kein Scouting) für den Bestand
    const leer = db.collection("opponents").doc();
    gegnerIds.push(leer.id);
    await leer.set({
      gymId: GYM_ID, name: "Mess Gegner Leer", style: "all-rounder", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null,
      strengths: [], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [],
      createdBy: trainerUid, createdByName: "Mess Trainer 2d", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });

    // ── Athlet mit zwei MMA-Analysen auf der Matte ─────────────────────────
    const col = db.collection("users").doc(athletUid).collection("videoAnalyses");
    for (const [i, tage] of [[1, 4], [2, 2]]) {
      await col.doc(`mma-${i}`).set(analyse("athlete", athletUid, "Mess Athlet 2d", {
        sport: "mma", flaeche: "matte", tageAlt: tage,
        findings: [
          befund("preferred-weapons_most-common", "cross", "Dein Cross ist deine häufigste Waffe."),
          befund("gameplan_seek-distance", "aussen", "Du suchst die Außendistanz."),
        ],
        actionStats: [{ id: "cross", attempted: 14, landed: 6, zone: "center" }, { id: "jab", attempted: 20, landed: 8, zone: "center" }],
        dnaSplit: { boxing: 70, kicking: 15, wrestling: 5, ground: 5, clinch: 5 },
      }));
    }
    const { profil: ap } = await recomputeProfile(db, "athlete", athletUid, "mess");
    const mma = (await db.collection("users").doc(athletUid).collection("fightProfile").doc("mma").get()).data();
    sagt(!!mma && mma.evidence?.flaeche === "matte", `Athlet: fightProfile/mma mit Fläche ${mma?.evidence?.flaeche}`);
    sagt(JSON.stringify(ap.evidence.kampfarten) === '["mma"]', `Athlet: Kampfarten ${JSON.stringify(ap.evidence.kampfarten)}`);

    // ── Wettkämpfe ─────────────────────────────────────────────────────────
    const camps = db.collection("users").doc(athletUid).collection("fightCamps");
    const neu = camps.doc();
    await neu.set(camp(athletUid, trainerUid, { name: "Mess Night 2d", sport: "mma", opponentId: gegner.id, opponentName: "Mess Gegner Käfig", tage: 40 }));
    const bestand = camps.doc();
    await bestand.set(camp(athletUid, trainerUid, { name: "Mess Bestand 2d", sport: null, opponentId: leer.id, opponentName: "Mess Gegner Leer", tage: 60 }));
    const vorbei = camps.doc();
    await vorbei.set(camp(athletUid, trainerUid, { name: "Mess Vorbei 2d", sport: "mma", opponentId: gegner.id, opponentName: "Mess Gegner Käfig", tage: -20 }));

    const athletBetroffen = await betroffeneWettkaempfe(db, { mode: "athlete", targetId: athletUid, sport: "mma", gymId: GYM_ID });
    sagt(athletBetroffen.map((b) => b.camp.id).join() === neu.id, `Athlet-Video MMA betrifft nur den anstehenden MMA-Wettkampf (${athletBetroffen.length})`);
    const samboBetroffen = await betroffeneWettkaempfe(db, { mode: "athlete", targetId: athletUid, sport: "sambo", gymId: GYM_ID });
    sagt(samboBetroffen.length === 0, "Sambo-Video betrifft den MMA-Wettkampf nicht");
    const gegnerBetroffen = await betroffeneWettkaempfe(db, { mode: "opponent", targetId: gegner.id, sport: "mma", gymId: GYM_ID });
    sagt(gegnerBetroffen.map((b) => b.camp.id).join() === neu.id, `Gegner-Video: collectionGroup über den vorhandenen Index findet den anstehenden Wettkampf (${gegnerBetroffen.length}, vergangener ausgelassen)`);

    // ── schreibeGameplan ohne Claude ───────────────────────────────────────
    const ergBestand = await schreibeGameplan(db, athletUid, bestand.id);
    const gBestand = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestand.id}`).get()).data();
    sagt(ergBestand === "offen" && gBestand?.offen === "kampfart", `Bestand ohne Kampfart → ${ergBestand} · ${gBestand?.offen}`);
    await bestand.update({ sport: "mma" });
    const ergLeer = await schreibeGameplan(db, athletUid, bestand.id);
    const gLeer = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestand.id}`).get()).data();
    sagt(ergLeer === "offen" && gLeer?.offen === "gegner", `Gegner ohne Daten → ${ergLeer} · ${gLeer?.offen} (kein Claude-Aufruf)`);
    await bestand.update({ sport: null });
    await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestand.id}`).delete();

    // Fertiger Gameplan von Hand (kein KI-Aufruf) — für die Schirme. Mit
    // GAMEPLAN_JSON=<nachweis.json> steht stattdessen ein gespeicherter echter
    // Claude-Inhalt da (Feld `inhalt`), ohne neuen Aufruf.
    const echterInhalt = process.env.GAMEPLAN_JSON
      ? JSON.parse((await import("node:fs")).readFileSync(process.env.GAMEPLAN_JSON, "utf8")).inhalt
      : null;
    await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${neu.id}`).set({
      campId: neu.id, sport: "mma", status: "fertig",
      inhalt: echterInhalt ?? {
        lage: "Erste Tendenz: Beide Profile stehen auf zwei Videos. Boden und Clinch kamen bei dir noch nicht vor.",
        waffen: [
          { titel: "Jab in den Shot-Moment", text: "Mess Gegner Käfig senkt vor dem Double Leg den Kopf. Dein Jab trifft genau dort.", beleg: "Du: Jab 20 Versuche, 8 gelungen · Gegner: 2 von 2 Videos" },
          { titel: "Cross aus der Außendistanz", text: "Du suchst die Außendistanz, dein Gegner will an den Rand. Setz den Cross, bevor er ankommt.", beleg: "Du: 2 von 2 Videos" },
        ],
        gefahren: [
          { titel: "Double Leg am Rand", text: "Dein Gegner schießt, sobald du mit dem Rücken zum Rand stehst.", beleg: "Double Leg 6 Versuche, 4 gelungen · Scouting-Notiz" },
        ],
        soKaempfstDu: [
          { titel: "Mitte halten, seitlich raus", text: "Bleib in der Mitte und löse nach jeder Serie seitlich, nie gerade zurück.", beleg: "Gegner: Double Leg meist am Rand" },
        ],
        drills: [
          { phase: "specific-prep", titel: "Sprawl nach Jab", text: "3 × 3 min: Partner schießt nach deinem Jab, du sprawlst und stehst in der Mitte auf.", wofuer: "Double Leg am Rand" },
          { phase: "sparring-simulation", titel: "Rand-Sparring", text: "Partner drückt dich an den Rand, du löst seitlich und kontrest mit dem Cross.", wofuer: "Mitte halten, seitlich raus" },
        ],
      },
      stand: { athletAnalysen: 2, gegnerAnalysen: 2, athletStaerke: ap.evidence.staerke ?? 0, gegnerStaerke: gp.evidence.staerke ?? 0, gegnerScouting: true },
      geschriebenAt: new Date().toISOString(), gestartetAt: null, offen: null, fehler: null, model: "mess", usage: null, laufId: null, eingabeSchluessel: "mess",
    });
    sagt(true, "fertiger Gameplan von Hand geschrieben (Schirm-Daten)");

    if (BROWSER) await schirme({ athletUid, neuId: neu.id, bestandId: bestand.id, gegnerId: gegner.id, db });
  } catch (err) {
    fehler += 1;
    console.log(`  FEHL Ausnahme: ${err?.name ?? ""} ${err?.message ?? err}`);
  } finally {
    for (const id of gegnerIds) await db.recursiveDelete(db.collection("opponents").doc(id));
    for (const uid of [athletUid, trainerUid].filter(Boolean)) {
      await db.recursiveDelete(db.collection("users").doc(uid));
      await auth.deleteUser(uid).catch(() => {});
    }
    const users = (await auth.listUsers(1000)).users;
    console.log(`Aufgeräumt: ${users.length} Auth-Konten, ${(await db.collection("users").get()).size} users-Dokumente`);
    console.log(`\n${ok}/${ok + fehler} ${fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : "PRÜFUNG(EN) FEHLGESCHLAGEN ✗"}`);
    process.exitCode = fehler === 0 ? 0 : 1;
  }
}

async function anmelden(page, email) {
  for (let a = 0; a < 3; a++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    if (await page.locator('input[type="email"]').count()) break;
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|trainer|kampfprofil)/, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function schirme({ athletUid, neuId, bestandId, gegnerId }) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const konsole = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
    await anmelden(page, TRAINER);
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    // Wettkampfseite (neu, mit Kampfart)
    await page.goto(`${BASE}/trainer/competitions/${athletUid}/${neuId}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-kampfart="mma"]').waitFor({ timeout: 60000 });
    const gameplan = page.locator('section#gameplan');
    await gameplan.waitFor({ timeout: 30000 });
    await page.waitForTimeout(4000); // Intro + Einblenden
    const gText = (await gameplan.innerText()).toLowerCase();
    sagt(gText.includes("deine waffen") && gText.includes("die gefahren") && gText.includes("so kämpfst du"), "Gameplan: drei Blöcke");
    sagt((gText.match(/\bbeleg\b/g) ?? []).length >= 4 && gText.includes("mma · "), "Gameplan: Beleg je Punkt, Kampfart im Kopf");
    const d2 = await page.locator('[data-gameplan-drills="specific-prep"] li').count();
    const d3 = await page.locator('[data-gameplan-drills="sparring-simulation"] li').count();
    sagt(d2 >= 1 && d3 >= 1, `Drills in Phase 2 (${d2}) und Phase 3 (${d3}) des Plans`);
    await gameplan.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/mess-2d-gameplan-${THEME}.png`, fullPage: false });
    await gameplan.screenshot({ path: `${OUT}/mess-2d-gameplan-block-${THEME}.png` });
    await page.locator("#plan-phase-specific-prep").screenshot({ path: `${OUT}/mess-2d-phase2-${THEME}.png` });

    // Gegner-Seite (Start): Käfig aus seinen Videos
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const main = page.locator("main").last();
    const gegnerText = (await main.innerText()).toLowerCase();
    sagt(gegnerText.includes("am käfig") || gegnerText.includes("käfig"), "Gegner-Seite: Käfig-Wörter aus seinen Videos");
    await page.screenshot({ path: `${OUT}/mess-2d-gegner-${THEME}.png`, fullPage: false });

    // Athleten-Seite: Athletensicht
    await page.getByRole("button", { name: /Mess Athlet 2d/ }).first().click();
    await page.waitForTimeout(2000);
    const athletText = (await main.innerText()).toLowerCase();
    sagt(/profilstärke \d+ %/.test(athletText) && !athletText.includes("dna 0 %"), "Athleten-Meta: Profilstärke statt DNA-%");
    sagt(!athletText.includes("vorschläge · frei anpassbar") && !athletText.includes("übernimm"), "Athletensicht: keine Vorschläge, kein „übernimm“");
    sagt(athletText.includes("mattenmitte") || athletText.includes("matte"), "Athleten-Karte: Matten-Wörter aus seinem MMA-Profil");
    await page.screenshot({ path: `${OUT}/mess-2d-athlet-${THEME}.png`, fullPage: false });

    // Bestand ohne Kampfart
    await page.goto(`${BASE}/trainer/competitions/${athletUid}/${bestandId}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-feld="kampfart-waehlen"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(3500);
    sagt((await page.locator("section#gameplan").innerText()).toLowerCase().includes("wähl oben die kampfart"), "Bestand: „Kampfart wählen“ + Hinweis im Gameplan");
    await page.screenshot({ path: `${OUT}/mess-2d-bestand-${THEME}.png`, fullPage: false });

    // Gegnerprofil
    await page.goto(`${BASE}/trainer/deepfight/gegner/${gegnerId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const profText = (await page.locator("main").last().innerText()).toLowerCase();
    sagt(profText.includes("käfig"), "Gegnerprofil: Käfig-Wörter (eine Kampfart, Fläche Käfig)");
    await page.screenshot({ path: `${OUT}/mess-2d-gegnerprofil-${THEME}.png`, fullPage: false });

    // Anlegen mit Vorbelegung
    await page.goto(`${BASE}/trainer/competitions/new?student=${athletUid}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-feld="kampfart"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(4000);
    const feld = (await page.locator('[data-feld="kampfart"]').innerText()).toLowerCase();
    sagt(feld.includes("mma"), `Anlegen: Kampfart vorbelegt (${feld.replace(/\s+/g, " ").trim()})`);
    await page.screenshot({ path: `${OUT}/mess-2d-anlegen-${THEME}.png`, fullPage: false });

    const echt = konsole.filter((k) => !/favicon|Download the React DevTools/i.test(k));
    sagt(echt.length === 0, `Konsole ohne Fehler (${echt.length})`);
    if (echt.length) console.log(echt.slice(0, 6).join("\n"));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
