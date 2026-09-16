/**
 * Zuordnungs-Schirm nach Leons Korrektur 16.09. abends — EIN echter Lauf:
 * Testvideo hochladen, echter Vorlauf (Gemini Flash), dann der Schirm.
 *
 *   node scripts/mess-zuordnung-rahmen.mjs
 *   BASE=http://localhost:3000 VIDEO="C:\…\x.mp4" node scripts/mess-zuordnung-rahmen.mjs
 *
 * Prüft: kein Außenrahmen mehr (die Seite trägt den Fluss ohne .t-card),
 * Rahmen der KI je Kämpfer, Ausschnitt auf der Karte, X mit „Ignorieren"
 * unter dem Zeiger, Rahmen-Popup mit Ziehen + Übernehmen, und dass die
 * Standbilder nach dem Verlassen der Seite wieder da sind. Screenshots
 * tmp-zr-*.png. Eigenes Prüfkonto (mess-zr@…), danach gelöscht.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const VIDEO = process.env.VIDEO ?? "C:\\Users\\reich\\Desktop\\Trainingsvideo Leon , Alec.mp4";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-zr@tidal-athletics.invalid";
const PASSWORD = `mess-zr-${Math.random().toString(36).slice(2)}A1!`;

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

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

async function stand(page) {
  return page.evaluate(() => {
    const out = { stand: null, bilder: null };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith("ta-video-analysis-form:upload:")) out.stand = JSON.parse(localStorage.getItem(k));
      if (k.startsWith("ta-deepfight-standbilder:")) out.bilder = JSON.parse(localStorage.getItem(k));
    }
    return out;
  });
}

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();
  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess ZR", emailVerified: true })).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email: EMAIL, displayName: "Mess ZR", gymId: GYM_ID, ...rightsMirror(rechte), createdAt: Timestamp.now() },
    { merge: true },
  );

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const page = await ctx.newPage();
    const konsole = [];
    page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
    await anmelden(page);
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    await page.goto(`${BASE}/trainer/deepfight/analyse`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await page.waitForTimeout(2000);
    const main = page.locator('[data-area="deepfight"] main');
    sagt((await main.locator(".t-card .t-card").count()) === 0, "Kein Glas in Glas");
    await main.locator('input[type="file"]').first().setInputFiles(VIDEO);
    await main.locator("button", { hasText: "Weiter" }).click();
    const t0 = Date.now();
    await main.getByText("Kämpfer zuordnen").waitFor({ timeout: 240000 });
    console.log(`  Upload + Vorlauf: ${Math.round((Date.now() - t0) / 1000)} s`);
    await page.waitForTimeout(4000);

    let s = await stand(page);
    const kaempfer = s.stand?.zuordnungen ?? [];
    console.log("  Vorlauf:", JSON.stringify(kaempfer.map((z) => ({ sek: z.bestSecond, box: z.box, d: z.description })), null, 1));
    sagt(kaempfer.length >= 1, `Kämpfer gefunden (${kaempfer.length})`);
    sagt(kaempfer.every((z) => z.box && z.box.w > 0 && z.box.h > 0), "Jeder Kämpfer hat einen Rahmen der KI");
    sagt(s.bilder && Object.keys(s.bilder).length === kaempfer.length, "Standbilder gespeichert");
    sagt((await main.locator('[data-ignoriert], .t-card img').count()) >= kaempfer.length, "Karten zeigen Bilder");
    sagt(!(await main.innerText()).toLowerCase().includes("liegt bei google"), "Kein ‚liegt bei Google‘ mehr");
    await page.screenshot({ path: `tmp-zr-schirm-${THEME}.png`, fullPage: true });

    // X: unter dem Zeiger erscheint „Ignorieren".
    const x = main.locator('button[data-aktion="ignorieren"]').first();
    const breiteVor = (await x.boundingBox()).width;
    await x.hover();
    await page.waitForTimeout(400);
    const breiteNach = (await x.boundingBox()).width;
    sagt(breiteNach > breiteVor + 30, `X wächst unter dem Zeiger zu „Ignorieren" (${Math.round(breiteVor)} → ${Math.round(breiteNach)} px)`);
    await page.screenshot({ path: `tmp-zr-hover-${THEME}.png`, clip: await main.locator(".t-card").first().boundingBox() });
    await page.mouse.move(5, 5);

    // Rahmen-Popup: neu ziehen, übernehmen.
    await main.locator('button[aria-label^="Rahmen um"]').first().click();
    await page.waitForTimeout(700);
    const flaeche = page.locator('img[alt="Standbild aus dem Video"]');
    const b = await flaeche.boundingBox();
    await page.screenshot({ path: `tmp-zr-popup-${THEME}.png` });
    await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5, { steps: 8 });
    await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.9, { steps: 8 });
    await page.mouse.up();
    await page.locator("button", { hasText: "Übernehmen" }).click();
    await page.waitForTimeout(700);
    s = await stand(page);
    const neu = s.stand.zuordnungen[0].box;
    sagt(Math.abs(neu.x - 0.1) < 0.02 && Math.abs(neu.w - 0.25) < 0.03, `Gezogener Rahmen gespeichert (${JSON.stringify(neu)})`);

    // Weg und zurück: Bilder bleiben.
    const adresse = page.url();
    await page.goto(`${BASE}/trainer/deepfight`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.goto(adresse, { waitUntil: "domcontentloaded" });
    await main.getByText("Kämpfer zuordnen").waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    sagt((await main.locator(".t-card img").count()) >= kaempfer.length, "Nach dem Zurückkommen: Standbilder wieder da");
    sagt(!(await main.innerText()).includes("Wähl dein Video noch einmal aus"), "Kein ‚Video noch einmal wählen‘ nötig");
    await page.screenshot({ path: `tmp-zr-zurueck-${THEME}.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    const ueber = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    sagt(ueber <= 1, `390 px: kein Überlauf (${ueber})`);
    await page.screenshot({ path: `tmp-zr-390-${THEME}.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await main.locator("button", { hasText: "Verwerfen" }).last().click();
    await page.waitForTimeout(800);
    s = await stand(page);
    sagt(!s.stand && !s.bilder, "Verwerfen räumt Stand und Standbilder weg");
    const echte = konsole.filter((k) => !/CORS|generativelanguage|Failed to load resource/i.test(k));
    sagt(echte.length === 0, `Keine Konsolenfehler (${echte.length})${echte.length ? ": " + echte.slice(0, 3).join(" | ") : ""}`);
  } finally {
    await browser.close();
    await db.collection("users").doc(uid).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
  }
  console.log(fehler ? `\n${fehler} FEHL` : "\nalles grün");
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
