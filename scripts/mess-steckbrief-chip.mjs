/**
 * KAMPFART-STECKBRIEFE — der eine Screenshot (tempo-vor-vollmessung): der
 * Umschalter „Kickboxen / Muay Thai" auf dem Zuordnungs-Schirm.
 *
 *   node scripts/mess-steckbrief-chip.mjs
 *   BASE=http://localhost:3000 THEME=light node scripts/mess-steckbrief-chip.mjs
 *
 * Kein KI-Aufruf: Der Schirm öffnet über einen gemerkten Zwischenstand
 * (`?upload=mess-steckbrief`) mit einem Vorlauf, der Kickboxen UND Muay Thai
 * vorschlägt. Eigenes Prüfkonto (mess-steckbrief@…), danach gelöscht.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-steckbrief@tidal-athletics.invalid";
const PASSWORD = `mess-sb-${Math.random().toString(36).slice(2)}A1!`;
const UPLOAD_ID = "mess-steckbrief";

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

const KAEMPFER = [
  { corner: "red", clothing: "schwarze Shorts, rote Handschuhe", features: "Tattoo linker Unterarm", description: "Der Größere in Rot.", bestSecond: 12 },
  { corner: "blue", clothing: "blaue Shorts, Ellbogenschützer", features: "kurze Haare", description: "Der Kleinere in Blau.", bestSecond: 40 },
];
const STAND = {
  sourceKind: "upload",
  youtubeUrl: "",
  ytStart: "",
  ytEnd: "",
  pendingUpload: { name: "files/mess-steckbrief", fileUri: "https://example.invalid/files/mess-steckbrief", mimeType: "video/mp4", fileName: "Thai-Sparring.mp4", fileSize: 12_000_000, durationSeconds: 300 },
  preview: { fighters: KAEMPFER, videoType: "sparring", sport: "kickboxen", variante: "muay-thai", fightMonth: null, model: "mess" },
  zuordnungen: KAEMPFER.map((k) => ({ person: null, ignoriert: false, ...k })),
  recency: "",
  videoType: "sparring",
  sport: "kickboxen",
  variante: "muay-thai",
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
  await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 60000 });
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
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess Steckbrief", emailVerified: true })).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email: EMAIL, displayName: "Mess Steckbrief", gymId: GYM_ID, ...rightsMirror(rechte), createdAt: Timestamp.now(), profileShares: { athlet: [], deepfight: [], wettkampf: [] } },
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

    await page.evaluate(([key, stand]) => localStorage.setItem(key, stand), [`ta-video-analysis-form:upload:${UPLOAD_ID}`, JSON.stringify(STAND)]);
    await page.goto(`${BASE}/trainer/deepfight/analyse?upload=${UPLOAD_ID}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 60000 });
    await page.waitForTimeout(3000);
    const main = page.locator('[data-area="deepfight"] main');
    const gruppe = main.locator('[role="group"][aria-label="Regelwerk"]');
    sagt((await gruppe.count()) === 1, "Umschalter ‚Regelwerk‘ erscheint bei Kickboxen");
    const thai = gruppe.locator("button", { hasText: "Muay Thai" });
    sagt((await thai.getAttribute("aria-pressed")) === "true", "Vorlauf-Vorschlag Muay Thai ist vorbelegt");
    let text = (await main.innerText()).toLowerCase();
    sagt(text.includes("ellbogen, knie-serien im clinch und umwerfen zählen mit"), "Hilfstext folgt der Wahl (Muay Thai)");

    await gruppe.locator("button", { hasText: "Kickboxen" }).click();
    await page.waitForTimeout(400);
    text = (await main.innerText()).toLowerCase();
    sagt(text.includes("ellbogen und umwerfen gelten als foul"), "Hilfstext folgt der Wahl (Kickboxen)");
    await gruppe.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const kasten = await gruppe.boundingBox();
    await page.screenshot({
      path: `tmp-steckbrief-chip-${THEME}.png`,
      clip: kasten ? { x: 0, y: Math.max(0, kasten.y - 260), width: 1440, height: 420 } : undefined,
      fullPage: !kasten,
    });

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
