/**
 * AUTOMATIK ETAPPE 1 — der eine Screenshot (tempo-vor-vollmessung).
 *
 *   node scripts/mess-e1-automatik.mjs
 *   BASE=http://localhost:3000 THEME=light node scripts/mess-e1-automatik.mjs
 *
 * Eigenes Prüfkonto (mess-e1@…) und eigenes Gegnerprofil, wie mess-t5.
 * Legt drei Analysen im NEUEN Datenmodell per Admin-SDK an (zählt / Tor zu /
 * markiert), lässt den Server einmal rechnen (über die Rechnung direkt, kein
 * Route-Aufruf nötig — die Route braucht ein Browser-Token), öffnet die
 * Werkbank und knipst die Zeile ‚zählt zu X Prozent‘ samt Bericht ohne
 * Übernehmen-Knöpfe. Danach räumt es alles weg.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-e1@tidal-athletics.invalid";
const PASSWORD = `mess-e1-${Math.random().toString(36).slice(2)}A1!`;
const GEGNER = "mess-e1-gegner";

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

function analyse(id, { idConfidence = 0.92, wrongFighter = false, videoType = "full", recency = "recent", tageHer = 1 }) {
  const w = idConfidence >= 0.75 ? (recency === "recent" ? 1 : 0.6) * (videoType === "full" ? 1 : 0.7) : 0;
  return {
    mode: "opponent",
    targetId: GEGNER,
    targetName: "Mess E1 Gegner",
    gymId: GYM_ID,
    targetIsStaff: false,
    sourceLabel: `Messvideo ${id}.mp4`,
    sourceKind: "upload",
    youtubeUrl: null,
    fileFingerprint: `file:Messvideo ${id}.mp4|1000|300`,
    fighter: { name: "Mess E1 Gegner", corner: "red", clothing: "blaue Hose", features: "", startPosition: "" },
    tier: "flash",
    recency,
    videoType,
    fightMonth: null,
    weight: { value: w, recency: recency === "recent" ? 1 : 0.6, type: videoType === "full" ? 1 : 0.7, identification: idConfidence, identified: idConfidence >= 0.75 },
    models: { gemini: "mess", claude: "mess" },
    usage: null,
    observation: {
      identification: { description: "Kämpfer in der blauen Hose.", idConfidence, evidence: ["00:10"] },
      meta: { ruleset: "MMA", rounds: 3, roundLengthMinutes: 5, weightClass: null, result: null, opponentLevel: null, coverage: "Vollkampf", videoQuality: null, estimatedAge: null, representativeness: null },
      actions: [{ id: "cross", otherLabel: null, attempted: 12, landed: 5, zone: "center", setup: "Jab", damage: 1, timestamps: ["01:02"] }],
      dnaSplit: { boxing: 60, kicking: 20, wrestling: 10, ground: 5, clinch: 5 },
      combos: [], defense: { takedownsDefended: null, takedownsAgainst: null, strikesAvoided: null, strikesAgainst: null, hitLocations: null, knockdownsReceived: null, rockedMoments: [] },
      controlTime: null, movement: null, rounds: [], notes: null,
    },
    evaluation: {
      summary: "Druckvoller Boxer mit klarem Cross.",
      style: { primaryStyle: "Striker", approach: "Druck", baseDiscipline: "Boxen" },
      findings: [
        { questionId: "preferred-weapons_most-common", categoryId: "preferred-weapons", answer: "Der Cross ist seine häufigste Waffe.", confidence: 0.8, evidence: ["01:02", "02:15"], sideKey: "cross" },
        { questionId: "entry-patterns_start", categoryId: "entry-patterns", answer: "Er eröffnet mit dem Jab und geht sofort in den Cross.", confidence: 0.7, evidence: ["00:40"], sideKey: "jab-cross" },
      ],
      scores: { aggression: 70, cageControl: null, cardio: null, damage: 60, durability: null, fightIq: null, predictability: null },
      topWeapons: [{ title: "Cross", reason: "12 Versuche, 5 Treffer", confidence: 0.8 }],
      topPatterns: [], topWeaknesses: [], topDangers: [],
      dangerProfile: { mostDangerousWhen: null, finishes: null, vulnerableWhen: null },
      actionStats: [{ id: "cross", attempted: 12, landed: 5, zone: "center", setup: "Jab" }],
      dnaSplit: { boxing: 60, kicking: 20, wrestling: 10, ground: 5, clinch: 5 },
      merge: { confirms: [], contradicts: [], weight: 0.5 },
    },
    wrongFighter,
    sharedWithAthlete: false,
    createdBy: "mess",
    createdByName: "Mess",
    createdAt: Timestamp.fromDate(new Date(Date.now() - tageHer * 86_400_000)),
  };
}

async function anmelden(page) {
  for (let a = 0; a < 3; a++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    if (await page.locator('input[type="email"]').count()) break;
  }
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 30000 });
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
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess E1", emailVerified: true })).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email: EMAIL, displayName: "Mess E1", gymId: GYM_ID, ...rightsMirror(rechte), createdAt: Timestamp.now(), profileShares: { athlet: [], deepfight: [], wettkampf: [] } },
    { merge: true },
  );
  const gegnerRef = db.collection("opponents").doc(GEGNER);
  await gegnerRef.set({
    gymId: GYM_ID, name: "Mess E1 Gegner", style: "striker", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null,
    strengths: [], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [], createdBy: uid, createdByName: "Mess E1",
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  const col = gegnerRef.collection("videoAnalyses");
  await col.doc("mess-e1-a").set(analyse("A", { tageHer: 1 }));
  await col.doc("mess-e1-b").set(analyse("B", { idConfidence: 0.55, tageHer: 2 }));
  await col.doc("mess-e1-c").set(analyse("C", { wrongFighter: true, videoType: "excerpt", tageHer: 3 }));

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const page = await ctx.newPage();
    const konsole = [];
    page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
    await anmelden(page);
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    await page.goto(`${BASE}/trainer/deepfight?modus=gegner&ziel=${GEGNER}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await page.waitForTimeout(3500);

    const text = (await page.locator('[data-area="deepfight"] main').innerText()).toLowerCase();
    sagt(text.includes("im profil"), "Zeile A: Abzeichen ‚Im Profil‘");
    sagt(text.includes("zählt nicht"), "Zeilen B/C: Abzeichen ‚Zählt nicht‘");
    sagt(text.includes("kompletter kampf"), "Liste nennt die Art des Videos");

    // Die zählende Analyse aufklappen und den Bericht ansehen.
    await page.locator('[data-area="deepfight"] main button', { hasText: "Messvideo A.mp4" }).first().click();
    await page.waitForTimeout(1200);
    const offen = (await page.locator('[data-area="deepfight"] main').innerText()).toLowerCase();
    sagt(offen.includes("zählt im profil zu 100 prozent"), "Zeile: ‚zählt im Profil zu 100 Prozent: Kompletter Kampf, Kürzlich‘");
    sagt(offen.includes("falscher kämpfer"), "Knopf ‚Falscher Kämpfer‘ steht da");
    sagt(!offen.includes("alle übernehmen"), "KEIN ‚Alle übernehmen‘ mehr");
    sagt(!offen.includes("ersetzen"), "KEIN ‚Ersetzen‘ mehr");
    sagt(!offen.includes("übernahme durch"), "KEIN Fuß ‚Übernahme durch‘ mehr");
    sagt(!offen.includes("löschen"), "Trainer sieht kein Löschen");
    await page.screenshot({ path: `tmp-e1-werkbank-${THEME}.png`, fullPage: true });

    // Die markierte Analyse: Text ‚als falschen Kämpfer markiert‘.
    await page.locator('[data-area="deepfight"] main button', { hasText: "Messvideo C.mp4" }).first().click();
    await page.waitForTimeout(1200);
    const c = (await page.locator('[data-area="deepfight"] main').innerText()).toLowerCase();
    sagt(c.includes("als falschen kämpfer markiert"), "Markierte Analyse erklärt sich");
    sagt(c.includes("zählt doch"), "…und bietet die Umkehr an");

    sagt(konsole.length === 0, `Konsole ohne Fehler (${konsole.length})`);
    if (konsole.length) console.log(konsole.slice(0, 5).join("\n"));
  } finally {
    await browser.close();
    await db.recursiveDelete(gegnerRef);
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
    console.log(fehler === 0 ? "\nALLE PRÜFUNGEN BESTANDEN ✓" : `\n${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
