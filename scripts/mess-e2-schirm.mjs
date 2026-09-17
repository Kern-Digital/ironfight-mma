/**
 * ETAPPE 2 — der eine Screenshot (tempo-vor-vollmessung): Ablage, der
 * Zuordnungs-Schirm mit zwei Karten, das Sheet, die drei Angaben.
 *
 *   node scripts/mess-e2-schirm.mjs
 *   BASE=http://localhost:3000 THEME=light node scripts/mess-e2-schirm.mjs
 *
 * Kein Gemini-Aufruf: Der Zuordnungs-Schirm wird über einen gemerkten
 * Zwischenstand im localStorage geöffnet (`?upload=mess-e2`), genau so, wie
 * ihn die Landung unter „Analysen in Arbeit" wiederfindet. Eigenes
 * Prüfkonto (mess-e2@…), danach gelöscht.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-e2@tidal-athletics.invalid";
const PASSWORD = `mess-e2-${Math.random().toString(36).slice(2)}A1!`;
const UPLOAD_ID = "mess-e2";

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

const STAND = {
  sourceKind: "upload",
  youtubeUrl: "",
  ytStart: "",
  ytEnd: "",
  pendingUpload: { name: "files/mess-e2", fileUri: "https://example.invalid/files/mess-e2", mimeType: "video/mp4", fileName: "Sparring Dienstag.mp4", fileSize: 12_000_000, durationSeconds: 300 },
  preview: {
    fighters: [
      { corner: "red", clothing: "schwarze Shorts, rote Handschuhe", features: "Tattoo linker Unterarm", description: "Der Größere mit den roten Handschuhen.", bestSecond: 12 },
      { corner: "blue", clothing: "blaue Shorts, blaue Handschuhe", features: "kurze Haare", description: "Der Kleinere in Blau.", bestSecond: 40 },
    ],
    videoType: "sparring",
    sport: "mma",
    fightMonth: null,
    model: "mess",
  },
  zuordnungen: [
    { person: null, ignoriert: false, corner: "red", clothing: "schwarze Shorts, rote Handschuhe", features: "Tattoo linker Unterarm", description: "Der Größere mit den roten Handschuhen.", bestSecond: 12 },
    { person: null, ignoriert: false, corner: "blue", clothing: "blaue Shorts, blaue Handschuhe", features: "kurze Haare", description: "Der Kleinere in Blau.", bestSecond: 40 },
  ],
  recency: "",
  videoType: "sparring",
  sport: "mma",
  beobachtungen: {},
  pendingSavedAt: Date.now(),
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
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess E2", emailVerified: true })).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email: EMAIL, displayName: "Mess E2", gymId: GYM_ID, ...rightsMirror(rechte), createdAt: Timestamp.now(), profileShares: { athlet: [], deepfight: [], wettkampf: [] } },
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

    // 1. Die Ablage — ohne Ziel, ohne Stand.
    await page.goto(`${BASE}/trainer/deepfight/analyse`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await page.waitForTimeout(2500);
    const ablage = (await page.locator('[data-area="deepfight"] main').innerText()).toLowerCase();
    sagt(ablage.includes("zieh dein video hierher"), "Ablage steht ohne Ziel da");
    sagt(ablage.includes("weiter"), "Knopf ‚Weiter‘");
    sagt(!ablage.includes("wen analysierst du"), "Keine Zielwahl mehr vor dem Upload");
    await page.screenshot({ path: `tmp-e2-ablage-${THEME}.png`, fullPage: true });

    // 2. Der Zuordnungs-Schirm über einen gemerkten Stand.
    await page.evaluate(([key, stand]) => localStorage.setItem(key, stand), [`ta-video-analysis-form:upload:${UPLOAD_ID}`, JSON.stringify(STAND)]);
    await page.goto(`${BASE}/trainer/deepfight/analyse?upload=${UPLOAD_ID}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await page.waitForTimeout(3000);
    const main = page.locator('[data-area="deepfight"] main');
    let text = (await main.innerText()).toLowerCase();
    sagt(text.includes("kämpfer zuordnen"), "Überschrift ‚Kämpfer zuordnen‘");
    sagt(text.includes("kämpfer 1") && text.includes("kämpfer 2"), "Zwei Karten");
    sagt((await main.locator('button[data-aktion="ignorieren"]').count()) >= 2, "Je Karte ein X (Ignorieren)");
    sagt(text.includes("wann ist das video entstanden"), "Feld ‚Wann ist das Video entstanden?‘");
    sagt(text.includes("training / sparring") && text.includes("mma"), "Zeile Art · Kampfart vorbelegt");
    sagt(text.includes("video hochgeladen"), "Zwischenstand sichtbar");

    // Knopf noch nicht voll farbig: Klick sagt, was fehlt.
    await main.locator("button", { hasText: "Analysieren" }).first().click();
    await page.waitForTimeout(500);
    text = (await main.innerText()).toLowerCase();
    sagt(text.includes("wähl mindestens eine person zur auswertung aus"), "Hinweis ohne Zuordnung");

    // Ignorieren und zurück per Tipp auf die Karte.
    await main.locator('button[data-aktion="ignorieren"]').nth(1).click();
    await page.waitForTimeout(400);
    text = (await main.innerText()).toLowerCase();
    sagt(/aussen vor|außen vor/.test(text), "Karte 2 grau");
    await main.locator('[data-ignoriert] > button').first().click();
    await page.waitForTimeout(400);
    text = (await main.innerText()).toLowerCase();
    sagt(!/aussen vor|außen vor/.test(text), "Tipp auf die graue Karte holt sie zurück");

    // Karte 1 → Athlet → Sheet.
    await main.locator('button[aria-label="Kämpfer 1: zuordnen"]').click();
    await page.waitForTimeout(400);
    sagt(
      (await main.locator('button[aria-label="Kämpfer 1 als Athlet zuordnen"]').count()) === 1 &&
        (await main.locator('button[aria-label="Kämpfer 1 als Gegner zuordnen"]').count()) === 1,
      "Felder ‚Athlet / Gegner‘ auf der Karte",
    );
    await main.locator('button[aria-label="Kämpfer 1 als Athlet zuordnen"]').click();
    await page.waitForSelector('[role="dialog"][aria-label="Athlet wählen"]', { timeout: 10000 });
    await page.waitForTimeout(1500);
    const sheet = page.locator('[role="dialog"][aria-label="Athlet wählen"]');
    const zeilen = sheet.locator('button[data-press="quiet"]');
    sagt((await zeilen.count()) >= 1, `Sheet listet ${await zeilen.count()} Personen`);
    await page.screenshot({ path: `tmp-e2-sheet-${THEME}.png`, fullPage: false });
    const ersterName = (await zeilen.first().innerText()).split("\n")[0].trim();
    await zeilen.first().click();
    await page.waitForTimeout(600);
    text = (await main.innerText());
    sagt(text.includes(ersterName.replace(" (ich)", "")), `Karte 1 trägt jetzt ‚${ersterName}‘`);

    // Karte 2 → Athlet → dieselbe Person ist grau.
    await main.locator('button[aria-label="Kämpfer 2: zuordnen"]').click();
    await page.waitForTimeout(400);
    await main.locator('button[aria-label="Kämpfer 2 als Athlet zuordnen"]').click();
    await page.waitForSelector('[role="dialog"][aria-label="Athlet wählen"]', { timeout: 10000 });
    await page.waitForTimeout(800);
    const gesperrt = await page.locator('[role="dialog"][aria-label="Athlet wählen"] button[disabled]').count();
    sagt(gesperrt >= 1, "Auf Karte 1 gewählte Person ist auf Karte 2 grau");
    // Die Hülle schließt über den Schleier (SheetShell kennt kein Escape).
    // Der Schleier liegt hinter dem Panel — oben links ist er frei. Klick in
    // BILDSCHIRM-Koordinaten: Der Schleier ist durch die Tiefen-Animation
    // etwas größer als das Fenster (gemessen 17.09.: x −14, y −10), ein Klick
    // „12/12 im Element" landete außerhalb und traf <html>.
    await page.mouse.click(12, 12);
    await page.waitForTimeout(700);

    // Zeitraum wählen → Knopf voll farbig.
    const vorher = await main.locator("button", { hasText: "Analysieren" }).first().getAttribute("data-bereit");
    await main.locator('button[aria-haspopup="listbox"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]', { hasText: "Weiß ich nicht" }).click();
    await page.waitForTimeout(500);
    const nachher = await main.locator("button", { hasText: "Analysieren" }).first().getAttribute("data-bereit");
    sagt(vorher === null && nachher === "true", "Knopf erst nach Zuordnung UND Zeitraum voll farbig");
    await page.screenshot({ path: `tmp-e2-zuordnen-${THEME}.png`, fullPage: true });

    // 3. Landung: „In Arbeit" kennt den Stand, „Start" führt zur Ablage.
    await page.goto(`${BASE}/trainer/deepfight`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await page.waitForTimeout(2500);
    const landung = (await page.locator('[data-area="deepfight"] main').innerText()).toLowerCase();
    sagt(landung.includes("analysen in arbeit") && landung.includes("sparring dienstag.mp4"), "Landung listet den Stand unter ‚In Arbeit‘");
    await page.locator('button[aria-label="Analyse starten"]').click();
    await page.waitForURL(/\/trainer\/deepfight\/analyse$/, { timeout: 10000 });
    sagt(true, "‚Start‘ führt direkt zur Ablage");

    sagt(konsole.length === 0, `Konsole ohne Fehler (${konsole.length})`);
    if (konsole.length) console.log(konsole.slice(0, 5).join("\n"));
  } finally {
    await browser.close();
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
    console.log(fehler === 0 ? "\nALLE PRÜFUNGEN BESTANDEN ✓" : `\n${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
