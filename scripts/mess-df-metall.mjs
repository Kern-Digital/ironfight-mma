/**
 * Messung: der Metall-Einstieg und die zwei Felder rechts auf
 * /trainer/deepfight (Leons Entwurf 12.09.2026, zweite Runde).
 *
 *   node scripts/mess-df-metall.mjs                   (Dev-Server auf :3000)
 *   BASE=http://localhost:3001 node scripts/mess-df-metall.mjs
 *
 * Legt ein Prüfkonto und NEUN markierte Analysen an (`mess: true`, feste
 * IDs, fünf am Gegner Paul, vier am eigenen Konto) und räumt beides am Ende
 * wieder weg. Prüft in dunkel/hell × Schreibtisch/mobil:
 *   1. Überschrift in Silber, auf dem Schreibtisch EINZEILIG, Barlow Condensed.
 *   2. DER LICHTREFLEX LÄUFT SICHTBAR: erst nach `data-shone` (Seite gemalt),
 *      Spitze ≥ 0,9 Deckkraft — und auf dem Schreibtisch beim zweiten
 *      Überfahren NOCH EINMAL (Überschrift und „Start").
 *   3. Kein waagerechter Überlauf.
 *   4. „Start" erscheint unter dem Zeiger (Schreibtisch) / steht immer (mobil).
 *   5. Klick → zwei Platten, Fokus auf „Athleten"; Escape schließt, Fokus
 *      zurück; Klick daneben schließt; „Gegner" navigiert + färbt.
 *   6. Die zwei Felder: Glas (`.t-card`) mit --r-lg, Zeilen --r-md, KEINE
 *      Pfeile, Zähler, Zustands-Chips oder Filter; Symbol immer die Person,
 *      Athleten in Gym-Farbe, Gegner grau; Archiv = 7 Zeilen + „Alle
 *      anzeigen"; Zwischenstand in „In Arbeit".
 *   7. Tipp auf eine Archiv-Zeile → Sheet mit ALLEN (9), diese vorgewählt,
 *      Filter im Sheet (Athleten → 4); „Alle anzeigen" → Sheet ohne Vorwahl.
 *   8. Keine Konsolenfehler.
 * Schreibt Screenshots tmp-df-metall-<theme>-<vp>*.png.
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-landung@tidal-athletics.invalid";
const PASSWORD = `mess-landung-${Math.random().toString(36).slice(2)}A1!`;
const GEGNER = "BZdtaypdo5BlPtnqJ6lt";
const LANDUNG = "/trainer/deepfight";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobil", width: 390, height: 900 },
];

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

async function anmelden(page) {
  // Der Dev-Server liefert die Seite nach einer Neukompilierung einmal als
  // 404 aus (gesehen 12.09.) — deshalb bis zu drei Anläufe.
  for (let anlauf = 0; anlauf < 3; anlauf++) {
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

/** Deckkraft-Spitze des Lichtlaufs (`::after`) über `dauer` ms. */
async function reflexSpitze(page, selektor, dauer = 2200) {
  let spitze = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < dauer) {
    const o = await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return m ? parseFloat(getComputedStyle(m, "::after").opacity) : 0;
    }, selektor);
    spitze = Math.max(spitze, o);
    await page.waitForTimeout(50);
  }
  return spitze;
}

function analyseDoc(uid, i, mode, targetId, targetName) {
  return {
    mode,
    targetId,
    targetName,
    sourceLabel: `Messvideo ${i}`,
    sourceKind: "upload",
    youtubeUrl: null,
    fighter: { name: targetName, description: "" },
    tier: "flash",
    recency: "unknown",
    models: { gemini: "mess", claude: "mess" },
    usage: null,
    observation: { fingerprint: `mess-${i}`, summary: "", segments: [] },
    evaluation: { summary: "", findings: [], stats: null },
    appliedFindingIds: i % 2 ? ["x"] : [],
    appliedStats: false,
    createdBy: uid,
    createdByName: "Mess Landung",
    createdAt: Timestamp.fromMillis(Date.now() - i * 86400000),
    mess: true,
  };
}

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId}`);
  const auth = getAuth();
  const db = getFirestore();

  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (
      await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess Landung", emailVerified: true })
    ).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { displayName: "Mess Landung", email: EMAIL, gymId: GYM_ID, trainerOnboarded: true, createdAt: new Date(), ...rightsMirror(rechte) },
    { merge: true },
  );
  console.log(`Prüfkonto: ${uid}`);

  const refs = [];
  for (let i = 1; i <= 9; i++) {
    const gegner = i <= 5;
    const ref = gegner
      ? db.collection("opponents").doc(GEGNER).collection("videoAnalyses").doc(`mess-${i}`)
      : db.collection("users").doc(uid).collection("videoAnalyses").doc(`mess-${i}`);
    await ref.set(analyseDoc(uid, i, gegner ? "opponent" : "athlete", gegner ? GEGNER : uid, gegner ? "Paul the Fighter" : "Mess Landung"));
    refs.push(ref);
  }
  console.log("9 Mess-Analysen angelegt (5 Gegner, 4 eigene)");

  const browser = await chromium.launch();
  try {
    for (const theme of ["dark", "light"]) {
      for (const vp of VIEWPORTS) {
        const mobil = vp.name === "mobil";
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
          isMobile: mobil,
          hasTouch: mobil,
        });
        const page = await ctx.newPage();
        const konsole = [];
        page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
        page.on("pageerror", (e) => konsole.push(e.message));
        page.on("response", (r) => r.status() === 404 && konsole.push(`404 ${r.url()}`));
        await anmelden(page);
        await page.evaluate((t) => localStorage.setItem("ta-theme", t), theme);
        await page.evaluate((id) => {
          localStorage.setItem(
            `ta-video-analysis-form:opponent:${id}`,
            JSON.stringify({
              pendingUpload: { name: "files/abc123", fileName: "kampf-rd3.mp4" },
              pendingObservation: { fingerprint: "xyz" },
              pendingSavedAt: Date.now() - 3 * 3600 * 1000,
            }),
          );
        }, GEGNER);

        // ── Laden + Lichtreflex der Überschrift ─────────────────────────
        await page.goto(`${BASE}${LANDUNG}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".df-entry-heading[data-shone]", { timeout: 20000 });
        console.log(`\n── ${theme} / ${vp.name} ───────────────────────────`);
        const reflexLaden = await reflexSpitze(page, ".df-entry-heading .df-metal");
        sagt(reflexLaden >= 0.9, `Lichtreflex der Überschrift läuft nach dem Malen (Spitze ${reflexLaden.toFixed(2)})`);
        if (mobil) {
          const startLaden = await page.evaluate(() => !!document.querySelector(".df-entry[data-shone]"));
          sagt(startLaden, `„Start" hat auf Touch seinen Reflex beim Laden bekommen (data-shone)`);
        }
        await page.waitForSelector(".df-feld--archiv .df-feld__zeile", { timeout: 20000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `tmp-df-metall-${theme}-${vp.name}.png`, fullPage: true });

        const befund = await page.evaluate(() => {
          const h2 = document.querySelector(".df-entry-heading h2");
          const metal = h2?.querySelector(".df-metal");
          const cs = metal ? getComputedStyle(metal) : null;
          const r = h2?.getBoundingClientRect();
          const lh = cs ? parseFloat(getComputedStyle(h2).lineHeight) : 0;
          const px = (el, p) => getComputedStyle(el)[p];
          const felder = Array.from(document.querySelectorAll(".df-feld")).map((f) => ({
            titel: f.querySelector("h2")?.textContent?.trim(),
            glas: f.classList.contains("t-card"),
            radius: px(f, "borderRadius"),
            zeilen: Array.from(f.querySelectorAll(".df-feld__zeile")).map((z) => ({
              text: z.textContent?.trim().slice(0, 30),
              radius: px(z, "borderRadius"),
              rolle: z.querySelector(".df-feld__rolle")?.getAttribute("data-modus") ?? null,
              rolleFarbe: z.querySelector(".df-feld__rolle") ? px(z.querySelector(".df-feld__rolle"), "color") : null,
              svg: z.querySelectorAll("svg").length,
            })),
          }));
          const dna = document.querySelector(".df-entry__dna section");
          return {
            theme: document.documentElement.getAttribute("data-theme"),
            h2Text: h2?.textContent?.trim(),
            h2Font: cs?.fontFamily.split(",")[0],
            h2Zeilen: r && lh ? Math.round(r.height / lh) : null,
            h2Clip: cs?.webkitBackgroundClip || cs?.backgroundClip,
            dnaHoehe: dna ? Math.round(dna.getBoundingClientRect().height) : null,
            dnaGrund: dna ? px(dna, "backgroundColor") : null,
            ueberlauf: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            startOpacity: px(document.querySelector(".df-entry__invitation"), "opacity"),
            felder,
            kleinkram: document.querySelectorAll(".df-feld__pfeil, .df-feld__zahl, .df-feld__zustand, .df-feld__filter, .df-feld .df-filter").length,
            r16: getComputedStyle(document.documentElement).getPropertyValue("--r-lg").trim(),
            r12: getComputedStyle(document.documentElement).getPropertyValue("--r-md").trim(),
          };
        });
        sagt(befund.theme === theme, `Theme ist ${theme} (${befund.theme})`);
        sagt(befund.h2Text === "Entschlüssle die Fight-DNA" && /Barlow/i.test(befund.h2Font ?? "") && befund.h2Clip === "text", `Überschrift in Silber und Barlow Condensed (${befund.h2Font})`);
        if (!mobil) sagt(befund.h2Zeilen === 1, `Überschrift einzeilig (${befund.h2Zeilen} Zeile/n)`);
        sagt(!befund.ueberlauf, "kein waagerechter Überlauf");
        sagt(befund.dnaGrund === "rgba(0, 0, 0, 0)", `Strang ohne Grund, Höhe ${befund.dnaHoehe}px`);
        sagt(mobil ? befund.startOpacity === "1" : befund.startOpacity === "0", `„Start" ${mobil ? "steht immer" : "ruht ohne Zeiger"} (opacity ${befund.startOpacity})`);
        sagt(befund.felder.length === 2, `zwei Felder rechts (${befund.felder.map((f) => f.titel).join(" / ")})`);
        sagt(befund.kleinkram === 0, `keine Pfeile, Zähler, Chips oder Filter auf der Seite (${befund.kleinkram})`);
        for (const f of befund.felder) {
          const archiv = /Archiv/.test(f.titel ?? "");
          sagt(archiv ? !f.glas : f.glas && f.radius === befund.r16, archiv ? `„${f.titel}": ohne Rahmen` : `„${f.titel}": Glas-Karte mit --r-lg (${f.radius})`);
          sagt(f.zeilen.every((z) => z.radius === befund.r12), `„${f.titel}": ${f.zeilen.length} Zeile/n mit --r-md`);
        }
        const arbeit = befund.felder[0]?.zeilen ?? [];
        sagt(arbeit.length === 1 && /Paul/.test(arbeit[0].text) && arbeit[0].svg === 1, `Zwischenstand steht in „In Arbeit", nur das Personen-Symbol (${arbeit.map((z) => z.text).join(" | ")})`);
        const archiv = befund.felder[1]?.zeilen ?? [];
        sagt(archiv.length === 8 && archiv[7].text === "Alle anzeigen", `Archiv: 7 Analysen + „Alle anzeigen" als achte Zeile (${archiv.length})`);
        const gegnerFarbe = archiv.find((z) => z.rolle === "gegner")?.rolleFarbe;
        const leuteFarbe = archiv.find((z) => z.rolle === "leute")?.rolleFarbe;
        sagt(gegnerFarbe && leuteFarbe && gegnerFarbe !== leuteFarbe, `Person immer, Farbe je Rolle: Athleten ${leuteFarbe}, Gegner ${gegnerFarbe}`);
        sagt(archiv.slice(0, 7).every((z) => z.svg === 1), "Archiv-Zeilen tragen genau ein Symbol (kein Pfeil)");

        // ── Sheet: Vorwahl + Filter ──────────────────────────────────────
        const dritte = page.locator(".df-feld--archiv .df-feld__zeile").nth(2);
        const dritteName = (await dritte.locator("strong").textContent())?.trim();
        await dritte.click();
        await page.waitForSelector('[role="dialog"][aria-label="Alle Analysen"] .df-filter', { timeout: 8000 });
        await page.waitForTimeout(500);
        const sheet = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"][aria-label="Alle Analysen"]');
          const zeilen = Array.from(d?.querySelectorAll("a[data-press]") ?? []);
          return {
            anzahl: zeilen.length,
            gewaehlt: zeilen.find((z) => z.getAttribute("aria-current") === "true")?.textContent?.trim().slice(0, 16),
            filter: Array.from(d?.querySelectorAll(".df-filter button") ?? []).map((b) => b.textContent?.trim()),
            summe: d?.querySelector(".df-filter__summe")?.textContent?.trim(),
          };
        });
        sagt(sheet.anzahl === 9, `Sheet zeigt ALLE Analysen (${sheet.anzahl})`);
        sagt(sheet.gewaehlt && dritteName && sheet.gewaehlt.startsWith(dritteName.slice(0, 8)), `die angetippte Analyse ist vorgewählt (${sheet.gewaehlt})`);
        sagt(sheet.filter.join("/") === "Alle/Athleten/Gegner", `Filter sitzen im Sheet (${sheet.filter.join(" / ")}, ${sheet.summe})`);
        await page.screenshot({ path: `tmp-df-metall-${theme}-${vp.name}-sheet.png` });
        await page.locator('[role="dialog"][aria-label="Alle Analysen"] .df-filter button', { hasText: "Athleten" }).click();
        await page.waitForTimeout(300);
        const nurAthleten = await page.evaluate(() => document.querySelectorAll('[role="dialog"][aria-label="Alle Analysen"] a[data-press]').length);
        sagt(nurAthleten === 4, `Filter „Athleten" → 4 Analysen (${nurAthleten})`);
        await page.evaluate(() => document.querySelector('[role="dialog"][aria-label="Alle Analysen"] button[aria-label="Schließen"]').click());
        await page.waitForSelector('[role="dialog"][aria-label="Alle Analysen"]', { state: "detached", timeout: 8000 });
        await page.waitForTimeout(300);
        await page.locator(".df-feld__zeile--alle").click();
        await page.waitForSelector('[role="dialog"][aria-label="Alle Analysen"] .df-filter', { timeout: 8000 });
        await page.waitForTimeout(400);
        const alle = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"][aria-label="Alle Analysen"]');
          return { anzahl: d?.querySelectorAll("a[data-press]").length, vorwahl: !!d?.querySelector('[aria-current="true"]') };
        });
        sagt(alle.anzahl === 9 && !alle.vorwahl, `„Alle anzeigen" → Sheet mit allen, ohne Vorwahl, Filter wieder auf Alle (${alle.anzahl})`);
        await page.evaluate(() => document.querySelector('[role="dialog"][aria-label="Alle Analysen"] button[aria-label="Schließen"]').click());
        await page.waitForSelector('[role="dialog"][aria-label="Alle Analysen"]', { state: "detached", timeout: 8000 });
        await page.waitForTimeout(300);

        // ── Reflex beim Überfahren, Start, Platten ───────────────────────
        const ziel = page.locator(".df-entry__target");
        if (!mobil) {
          await page.mouse.move(5, 5);
          await page.locator(".df-entry-heading").hover();
          const reflexHover = await reflexSpitze(page, ".df-entry-heading .df-metal");
          sagt(reflexHover >= 0.9, `Überschrift: Reflex läuft beim Überfahren NOCH EINMAL (Spitze ${reflexHover.toFixed(2)})`);
          await page.mouse.move(5, 5);
          await ziel.hover();
          const startReflex = await reflexSpitze(page, ".df-entry__start .df-metal");
          const o = await page.evaluate(() => getComputedStyle(document.querySelector(".df-entry__invitation")).opacity);
          sagt(o === "1", `„Start" erscheint unter dem Zeiger (opacity ${o})`);
          sagt(startReflex >= 0.9, `„Start": Reflex läuft beim Überfahren (Spitze ${startReflex.toFixed(2)})`);
          await page.mouse.move(5, 5);
          await page.waitForTimeout(300);
          await ziel.hover();
          const startReflex2 = await reflexSpitze(page, ".df-entry__start .df-metal");
          sagt(startReflex2 >= 0.9, `„Start": Reflex läuft beim ZWEITEN Überfahren wieder (Spitze ${startReflex2.toFixed(2)})`);
          await page.screenshot({ path: `tmp-df-metall-${theme}-${vp.name}-start.png`, clip: await page.locator(".df-entry").boundingBox() });
        }
        if (mobil) await ziel.tap();
        else await ziel.click();
        await page.waitForTimeout(400);
        const platten = await page.evaluate(() => {
          const c = document.getElementById("df-entry-choices");
          const b = Array.from(c?.querySelectorAll("button") ?? []);
          return { sichtbar: c && !c.hidden, texte: b.map((x) => x.textContent?.trim()), fokus: document.activeElement?.textContent?.trim(), einladung: !!document.querySelector(".df-entry__invitation") };
        });
        sagt(platten.sichtbar && platten.texte.join("/") === "Athleten/Gegner" && platten.fokus === "Athleten" && !platten.einladung, `Platten stehen, Fokus auf „Athleten", „Start" ist weg`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);
        const nachEscape = await page.evaluate(() => ({ zu: document.getElementById("df-entry-choices")?.hidden, fokus: document.activeElement?.getAttribute("aria-label") }));
        sagt(nachEscape.zu === true && nachEscape.fokus === "Analyse starten", "Escape schließt, Fokus zurück auf dem Strang");
        if (mobil) await ziel.tap();
        else await ziel.click();
        await page.waitForTimeout(300);
        await page.locator(".df-feld--arbeit h2").click();
        await page.waitForTimeout(250);
        sagt(await page.evaluate(() => document.getElementById("df-entry-choices")?.hidden === true), `Klick daneben (auf „Analysen in Arbeit") schließt die Platten`);
        if (mobil) await ziel.tap();
        else await ziel.click();
        await page.waitForTimeout(300);
        await page.locator("#df-entry-choices button", { hasText: "Gegner" }).click();
        await page.waitForURL(/\/trainer\/deepfight\/gegner\?fuer=analyse/, { timeout: 15000 }).catch(() => {});
        const modus = await page.evaluate(() => document.querySelector('[data-area="deepfight"]')?.getAttribute("data-modus"));
        sagt(/\/gegner\?fuer=analyse/.test(page.url()) && modus === "gegner", `„Gegner" führt zur Gegnerauswahl und färbt (data-modus=${modus})`);

        sagt(konsole.length === 0, `Konsole ohne Fehler${konsole.length ? ": " + konsole.slice(0, 3).join(" | ") : ""}`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    for (const ref of refs) await ref.delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
    await db.collection("users").doc(uid).delete().catch(() => {});
    console.log("\nPrüfkonto und Mess-Analysen entfernt.");
  }
  console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES GRÜN");
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
