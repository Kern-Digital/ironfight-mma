/**
 * TEMPORÄR (08.09.2026) — was in mess-t4-ablage.mjs fehlt: der Akzent-Test
 * (DESIGN-BRIEF §5), die Touch-Hover-Probe (MOTION-BRIEF §6.5) und zwei
 * Belegbilder für Leon (aktive Sportfarbe, Fortsetzen-Zeile). LÖSCHEN nach
 * der Abnahme.
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-t4@tidal-athletics.invalid";
const PASSWORD = `mess-t4-${Math.random().toString(36).slice(2)}A1!`;
const GEGNER = "BZdtaypdo5BlPtnqJ6lt";

let fehler = 0;
const sagt = (ok, t) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${t}`);
};

async function anmelden(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 30000 });
  await page.waitForTimeout(1200);
}
async function zurWerkbank(page, modus, ziel) {
  await page.goto(`${BASE}/trainer/deepfight?modus=${modus}&ziel=${ziel}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('[data-area="deepfight"] canvas', { timeout: 20000 });
  await page.waitForTimeout(2600);
}
const knopffarbe = (page, wort) =>
  page
    .locator('[data-area="deepfight"] main button', { hasText: wort })
    .first()
    .evaluate((el) => {
      const c = document.createElement("canvas").getContext("2d");
      c.fillStyle = "#000";
      c.fillStyle = getComputedStyle(el).backgroundColor;
      c.fillRect(0, 0, 1, 1);
      const d = c.getImageData(0, 0, 1, 1).data;
      return `${d[0]},${d[1]},${d[2]}`;
    });

async function main() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();
  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (
      await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess T4", emailVerified: true })
    ).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { displayName: "Mess T4", email: EMAIL, gymId: GYM_ID, trainerOnboarded: true, createdAt: new Date(), ...rightsMirror(rechte) },
    { merge: true },
  );

  const browser = await chromium.launch();
  try {
    // ── Akzent-Test: EINE Variable drehen, die Seite folgt ───────────────
    console.log("── Akzent-Test (DESIGN-BRIEF §5) ────────────────────");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await ctx.newPage();
    await anmelden(page);

    await zurWerkbank(page, "leute", uid);
    const vorher = await knopffarbe(page, "Analyse starten");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--accent-h", "28");
      document.documentElement.style.setProperty("--accent-c", "0.16");
    });
    await page.waitForTimeout(500);
    const nachher = await knopffarbe(page, "Analyse starten");
    await page.screenshot({ path: "tmp-t4-akzenttest-leute.png", fullPage: true });
    console.log(`  Modus Unsere Leute: Startknopf ${vorher} → ${nachher}`);
    sagt(vorher !== nachher, "Modus Unsere Leute: die Ablage folgt dem Gym-Akzent");

    await zurWerkbank(page, "gegner", GEGNER);
    const gVorher = await knopffarbe(page, "Analyse starten");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--accent-h", "28");
      document.documentElement.style.setProperty("--accent-c", "0.16");
    });
    await page.waitForTimeout(500);
    const gNachher = await knopffarbe(page, "Analyse starten");
    console.log(`  Modus Gegner: Startknopf ${gVorher} → ${gNachher}`);
    sagt(gVorher === gNachher, "Modus Gegner: bleibt Silber, die Modus-Regel gewinnt");

    // Die Sportfarben dürfen dem Gym NICHT folgen — sie sind feste Werte.
    const rotVorher = await page
      .locator('[data-area="deepfight"] main button', { hasText: "Rote Ecke" })
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--corner-red"));
    sagt(
      rotVorher.trim().startsWith("oklch(0.5"),
      `--corner-red ist gym-unabhängig: ${rotVorher.trim()}`,
    );

    // ── Belegbild: aktive Sportfarbe + Fortsetzen-Zeile ──────────────────
    console.log("\n── Belegbilder ──────────────────────────────────────");
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("--accent-h");
      document.documentElement.style.removeProperty("--accent-c");
    });
    await page.evaluate((g) => {
      localStorage.setItem(
        `ta-video-analysis-form:opponent:${g}`,
        JSON.stringify({
          corner: "red",
          clothing: "schwarze Shorts, weißes Logo",
          features: "Tattoo rechter Unterarm",
          startPosition: "",
          tier: "flash",
          recency: "recent",
          sourceKind: "upload",
          youtubeUrl: "",
          ytStart: "",
          ytEnd: "",
          pendingUpload: {
            name: "files/abc",
            fileUri: "https://x/abc",
            mimeType: "video/mp4",
            fileName: "kampf-koeln-runde-2.mp4",
            fileSize: 84_000_000,
            durationSeconds: 420,
          },
          pendingObservation: { observation: {}, model: "gemini-flash-latest", fingerprint: "x" },
          pendingSavedAt: Date.now() - 6 * 3600 * 1000,
        }),
      );
    }, GEGNER);
    await zurWerkbank(page, "gegner", GEGNER);
    await page.screenshot({ path: "tmp-t4-zwischenstand.png", fullPage: true });
    console.log("  tmp-t4-zwischenstand.png (Fortsetzen-Zeile + rote Ecke aktiv)");

    // ── Fortschritts-Overlay: deckt es wirklich zu, in BEIDEN Themes? ────
    // Mit Prüfdaten scheitert die Pipeline sofort (das gemerkte Video liegt
    // nicht wirklich bei Google), und das Overlay ist weg, bevor man es sieht.
    // Die Upload-Prüfung wird deshalb künstlich aufgehalten.
    await page.route("**/api/video-analysis/file-status", async (route) => {
      await new Promise((r) => setTimeout(r, 9000));
      await route.fulfill({ status: 200, body: JSON.stringify({ state: "PROCESSING" }) });
    });
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => localStorage.setItem("ta-theme", t), theme);
      await zurWerkbank(page, "gegner", GEGNER);
      await page.evaluate(() => {
        const k = Array.from(
          document.querySelectorAll('[data-area="deepfight"] main button'),
        ).find((b) => /analyse fortsetzen/i.test(b.textContent));
        k?.click();
      });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `tmp-t4-overlay-${theme}.png` });
      // Ein Pixel MITTEN im Overlay, wo darunter Formulartext läge: Deckt es
      // zu, ist der Wert praktisch der Seitengrund.
      const deckt = await page.evaluate(() => {
        const o = document.querySelector(".ai-loader-wrapper")?.parentElement;
        if (!o) return null;
        const c = document.createElement("canvas").getContext("2d");
        c.fillStyle = "#000";
        c.fillStyle = getComputedStyle(o).backgroundColor;
        c.fillRect(0, 0, 1, 1);
        const d = c.getImageData(0, 0, 1, 1).data;
        return {
          grund: `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(2)})`,
          deckung: d[3] / 255,
          prozent: !!o.textContent.match(/\d+\s*%/),
        };
      });
      console.log(`  ${theme}: Overlay-Grund ${deckt?.grund}, Prozentzahl ${deckt?.prozent ? "da" : "FEHLT"}`);
      sagt(!!deckt?.prozent, `${theme}: das Overlay zeigt den Fortschritt`);
      sagt(
        (deckt?.deckung ?? 0) >= 0.9,
        `${theme}: das Overlay deckt zu (${((deckt?.deckung ?? 0) * 100).toFixed(0)} %)`,
      );
      await page.screenshot({ path: `tmp-t4-overlay-${theme}.png` });
    }
    console.log("  tmp-t4-overlay-dark.png / tmp-t4-overlay-light.png");
    await ctx.close();

    // ── Touch: bleibt nach dem Tap ein Hover-Zustand stehen? ─────────────
    console.log("\n── Touch-Hover (MOTION-BRIEF §6.5) ──────────────────");
    const tctx = await browser.newContext({
      viewport: { width: 390, height: 900 },
      isMobile: true,
      hasTouch: true,
    });
    const tp = await tctx.newPage();
    await anmelden(tp);
    await zurWerkbank(tp, "gegner", GEGNER);
    const zeile = tp.locator('[data-area="deepfight"] main button[aria-expanded]').last();
    const vorTap = await zeile.evaluate((el) => getComputedStyle(el).backgroundColor);
    await zeile.tap();
    await tp.waitForTimeout(900);
    await zeile.tap(); // wieder zu
    await tp.waitForTimeout(900);
    const nachTap = await zeile.evaluate((el) => getComputedStyle(el).backgroundColor);
    console.log(`  Analysenzeile: vor ${vorTap} → nach zwei Taps ${nachTap}`);
    sagt(vorTap === nachTap, "nach dem Tap hängt kein Hover-Zustand");
    await tctx.close();
  } finally {
    await browser.close();
    await db.collection("users").doc(uid).delete();
    await auth.deleteUser(uid).catch(() => {});
    console.log(fehler === 0 ? "\nALLES BESTANDEN" : `\n${fehler} FEHLSCHLÄGE`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
