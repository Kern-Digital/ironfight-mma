/**
 * ETAPPE 3, RUNDE 4 — der eine Screenshot (tempo-vor-vollmessung): die
 * Fight-DNA auf /kampfprofil mit dem Umschalter „Fight-DNA · MMA · Sambo",
 * Helix-Kennzahl = Profilstärke, Karte je Kampfart mit Fläche.
 *
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/mess-e3-umschalter.mjs
 *   BASE=http://localhost:3000 THEME=light node --import … scripts/mess-e3-umschalter.mjs
 *
 * Ohne KI: zwei Analysen (MMA im Käfig, Sambo auf der Matte) per Admin-SDK,
 * dann die ECHTE Neuberechnung (lib/server/profile-recompute.ts). Eigenes
 * Prüfkonten (mess-e3u@… Athlet ohne Rechte, mess-e3t@… Trainer für die
 * Trainersicht), danach gelöscht.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";
import { recomputeProfile } from "../lib/server/profile-recompute.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-e3u@tidal-athletics.invalid";
const TRAINER_EMAIL = "mess-e3t@tidal-athletics.invalid";
let trainerUid = null;
const PASSWORD = `mess-e3u-${Math.random().toString(36).slice(2)}A1!`;

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

function befund(questionId, sideKey, answer) {
  return { questionId, categoryId: questionId.split("_")[0], answer, confidence: 0.8, evidence: ["01:00"], sideKey };
}

function analyse(uid, { sport, flaeche, findings, actionStats, dnaSplit, tageAlt }) {
  return {
    mode: "athlete", targetId: uid, targetName: "Mess E3", gymId: GYM_ID, targetIsStaff: false,
    sourceLabel: `${sport}.mp4`, sourceKind: "upload", youtubeUrl: null, fileFingerprint: null,
    fighter: { name: "Mess E3", corner: "unknown", clothing: "", features: "", startPosition: "" },
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

async function anmelden(page, email = EMAIL) {
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

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} · BASE ${BASE} · THEME ${THEME}`);
  const auth = getAuth();
  const db = getFirestore();

  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess E3", emailVerified: true })).uid;
  }
  const rechte = { trainer: false, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email: EMAIL, displayName: "Mess E3", gymId: GYM_ID, onboarded: true, ...rightsMirror(rechte), createdAt: Timestamp.now() },
    { merge: true },
  );

  const browser = await chromium.launch();
  try {
    const col = db.collection("users").doc(uid).collection("videoAnalyses");
    await col.doc("mma").set(analyse(uid, {
      sport: "mma", flaeche: "kaefig", tageAlt: 2,
      findings: [
        befund("preferred-weapons_most-common", "cross", "Dein Cross ist deine häufigste Waffe."),
        befund("gameplan_seek-distance", "aussen", "Du suchst die Außendistanz."),
        befund("real-habits_when-tired", "rueckwaerts", "Wirst du müde, gehst du rückwärts."),
      ],
      actionStats: [{ id: "cross", attempted: 14, landed: 6, zone: "cage" }, { id: "jab", attempted: 20, landed: 8, zone: "center" }],
      dnaSplit: { boxing: 60, kicking: 15, wrestling: 15, ground: 5, clinch: 5 },
    }));
    await col.doc("sambo").set(analyse(uid, {
      sport: "sambo", flaeche: "matte", tageAlt: 1,
      findings: [
        befund("gameplan_seek-distance", "griff", "Du suchst die Griffdistanz."),
        befund("real-habits_when-tired", "rueckwaerts", "Wirst du müde, gehst du zurück."),
      ],
      actionStats: [{ id: "double-leg", attempted: 6, landed: 3, zone: "open" }],
      dnaSplit: { boxing: 0, kicking: 0, wrestling: 70, ground: 20, clinch: 10 },
    }));
    const { profil } = await recomputeProfile(db, "athlete", uid, "mess");
    sagt(JSON.stringify(profil.evidence.kampfarten) === JSON.stringify(["mma", "sambo"]), `Kampfarten am Profil: ${JSON.stringify(profil.evidence.kampfarten)}`);

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const page = await ctx.newPage();
    const konsole = [];
    page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
    await anmelden(page);
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    await page.goto(`${BASE}/kampfprofil`, { waitUntil: "domcontentloaded" });
    const leiste = page.locator('[role="group"][aria-label="Kampfart wählen"]');
    await leiste.waitFor({ timeout: 45000 });
    await page.waitForTimeout(2500);
    const knoepfe = (await leiste.locator("button").allInnerTexts()).map((t) => t.trim().toLowerCase());
    sagt(JSON.stringify(knoepfe) === JSON.stringify(["fight-dna", "mma", "sambo"]), `Umschalter: ${knoepfe.join(" · ")}`);
    sagt((await leiste.locator('button[aria-pressed="true"]').innerText()).toLowerCase().includes("fight-dna"), "Fight-DNA ist vorgewählt");
    const kopf = (await page.locator("main").last().innerText()).toLowerCase();
    sagt(kopf.includes(`profilstärke ${profil.evidence.staerke} %`), `Kopf-Chip „Profilstärke ${profil.evidence.staerke} %"`);
    sagt(kopf.includes(`${profil.evidence.staerke}\nprozent profilstärke`) || kopf.includes(`prozent profilstärke`), "Helix-Kennzahl heißt Profilstärke");
    await page.screenshot({ path: `tmp-e3-umschalter-fightdna-${THEME}.png`, fullPage: false });

    await leiste.locator("button", { hasText: "Sambo" }).click();
    await page.waitForTimeout(2500);
    sagt((await leiste.locator('button[aria-pressed="true"]').innerText()).toLowerCase().includes("sambo"), "Sambo gewählt");
    const sambo = (await page.locator("main").last().innerText()).toLowerCase();
    sagt(sambo.includes("mess e3"), "Seite steht nach dem Wechsel");
    await page.screenshot({ path: `tmp-e3-umschalter-sambo-${THEME}.png`, fullPage: false });

    // ── Trainersicht: dieselbe Fight-DNA auf /trainer/deepfight/athleten/[uid] ──
    // Der Athlet gibt DeepFight für alle Trainer seines Gyms frei (Tor für alle).
    await db.collection("users").doc(uid).set(
      { profileShares: { athlet: { uids: [], gyms: [] }, deepfight: { uids: [], gyms: [GYM_ID] }, wettkampf: { uids: [], gyms: [] } } },
      { merge: true },
    );
    const trainerRechte = { trainer: true, verwaltung: false, admin: false };
    try {
      trainerUid = (await auth.getUserByEmail(TRAINER_EMAIL)).uid;
      await auth.updateUser(trainerUid, { password: PASSWORD });
    } catch {
      trainerUid = (await auth.createUser({ email: TRAINER_EMAIL, password: PASSWORD, displayName: "Mess E3 Trainer", emailVerified: true })).uid;
    }
    await auth.setCustomUserClaims(trainerUid, claimsWithRights({ gymId: GYM_ID }, trainerRechte));
    await db.collection("users").doc(trainerUid).set(
      { email: TRAINER_EMAIL, displayName: "Mess E3 Trainer", gymId: GYM_ID, onboarded: true, trainerOnboarded: true, ...rightsMirror(trainerRechte), createdAt: Timestamp.now() },
      { merge: true },
    );
    const tctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const tpage = await tctx.newPage();
    tpage.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
    await anmelden(tpage, TRAINER_EMAIL);
    await tpage.goto(`${BASE}/trainer/deepfight/athleten/${uid}`, { waitUntil: "domcontentloaded" });
    const tleiste = tpage.locator('[role="group"][aria-label="Kampfart wählen"]');
    await tleiste.waitFor({ timeout: 45000 });
    await tpage.waitForTimeout(2500);
    const ttext = (await tpage.locator("main").last().innerText()).toLowerCase();
    sagt(ttext.includes("fight-dna") && ttext.includes("aus allen ausgewerteten videos gerechnet"), "Trainersicht: Überschrift Fight-DNA, neuer Untertitel");
    sagt(!ttext.includes("übernommen"), "Trainersicht: kein „übernommen“ mehr");
    await tleiste.locator("button", { hasText: "MMA" }).click();
    await tpage.waitForTimeout(2500);
    sagt((await tleiste.locator('button[aria-pressed="true"]').innerText()).toLowerCase().includes("mma"), "Trainersicht: MMA gewählt");
    await tpage.screenshot({ path: `tmp-e3-umschalter-trainer-mma-${THEME}.png`, fullPage: false });

    const echt = konsole.filter((k) => !/favicon|Download the React DevTools/i.test(k));
    sagt(echt.length === 0, `Konsole ohne Fehler (${echt.length})`);
    if (echt.length) console.log(echt.slice(0, 5).join("\n"));
  } catch (err) {
    fehler += 1;
    console.log(`  FEHL Ausnahme: ${err?.name ?? ""} ${err?.message ?? err}`);
  } finally {
    await browser.close();
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
    if (trainerUid) {
      await db.recursiveDelete(db.collection("users").doc(trainerUid));
      await auth.deleteUser(trainerUid);
    }
    const users = (await auth.listUsers(1000)).users;
    console.log(`Aufgeräumt: ${users.length} Auth-Konten, ${(await db.collection("users").get()).size} users-Dokumente`);
    console.log(fehler === 0 ? "\nALLE PRÜFUNGEN BESTANDEN ✓" : `\n${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
    process.exitCode = fehler === 0 ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
