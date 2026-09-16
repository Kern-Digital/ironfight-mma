/**
 * TEMPORÄRES MESSWERKZEUG — Teilschritt 4 des DeepFight-Neuaufbaus
 * (VideoAnalysisSection im Token-Look, 08.09.2026). Nach der Abnahme LÖSCHEN.
 *
 * EIGENE PRÜFKONTO-ADRESSE, mit Absicht: `scripts/ui-check-trainer.mjs` hat
 * eine feste E-Mail. Lief am 08.09. ein zweites Claude-Fenster auf demselben
 * Arbeitsbaum, löschten sich die beiden Läufe gegenseitig das Konto mitten in
 * der Messung („auth/user-not-found" beim Aufräumen). Wer parallel misst,
 * braucht eine eigene Kennung.
 *
 * Aufruf (NUR über PowerShell, siehe Falle 20):
 *   node scripts/mess-t4-ablage.mjs
 *
 * Gemessen wird:
 *   1. Überlauf, Dark+Light × 1440+390
 *   2. Glas-in-Glas: `.t-card` mit `.t-card`-Vorfahren im Bereich (Soll 0)
 *   3. KONTRAST ÜBER BEWEGTEM GRUND (Falle 45): Vordergrund aus der
 *      aufgelösten CSS-Farbe (Canvas, Falle 16), Hintergrund aus einem echten
 *      Screenshot-Pixel AN DER STELLE DES TEXTES — mit dem Text kurz auf
 *      `visibility: hidden`, sonst misst man einen Buchstaben (1,00:1). Über
 *      vier Zeitpunkte, der SCHLECHTESTE zählt.
 *   4. Die zwei neuen Ecken-Tokens: echte Fläche + Schrift darauf
 *   5. Ablage: Ziehen, Einfügen (Datei UND YouTube-Link), Dateidialog
 *   6. Fortsetzen-Zeile aus vorbelegtem localStorage
 *   7. Bewegung per Bildvergleich, plus reduced-motion (Falle 41)
 *   8. Die Wege von den Detailseiten in die Werkbank
 */

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-t4@tidal-athletics.invalid";
const PASSWORD = `mess-t4-${Math.random().toString(36).slice(2)}A1!`;
const GEGNER = "BZdtaypdo5BlPtnqJ6lt"; // „Paul the Fighter", das eine echte Profil
const WERKBANK = `/trainer/deepfight?modus=gegner&ziel=${GEGNER}`;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "mobil", width: 390, height: 900 },
];

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

// ─── PNG: ein einzelnes Pixel aus einem Playwright-Clip lesen ───────────────
// Ein 1×1-PNG trägt genau eine Scanline: ein Filterbyte, dann die Kanäle.
// Playwright liefert RGBA oder RGB, je nach Farbtyp im IHDR.
function pixelAusPng(buf) {
  let pos = 8; // Signatur
  let breite = 0;
  let kanaele = 4;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const typ = buf.toString("ascii", pos + 4, pos + 8);
    const daten = buf.subarray(pos + 8, pos + 8 + len);
    if (typ === "IHDR") {
      breite = daten.readUInt32BE(0);
      const farbtyp = daten[9];
      kanaele = farbtyp === 6 ? 4 : farbtyp === 2 ? 3 : 1;
    } else if (typ === "IDAT") idat.push(daten);
    else if (typ === "IEND") break;
    pos += 12 + len;
  }
  const roh = inflateSync(Buffer.concat(idat));
  // Erste Scanline, erstes Pixel — Filterbyte übersprungen. Bei Filter 0
  // (Playwright-Clips dieser Größe) sind das die Rohwerte.
  const off = 1;
  void breite;
  return [roh[off], roh[off + 1], roh[off + 2], kanaele === 4 ? roh[off + 3] : 255];
}

const kanal = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const leuchtkraft = ([r, g, b]) =>
  0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
function kontrast(a, b) {
  const l1 = leuchtkraft(a);
  const l2 = leuchtkraft(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** oklch() & Co. auflösen — getComputedStyle gibt sie roh zurück (Falle 16). */
async function loeseFarbe(page, css) {
  return page.evaluate((c) => {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, css);
}

/**
 * Kontrast der schwächsten Textstellen der Sektion, über vier Zeitpunkte.
 * Der Hintergrund kommt aus einem echten Bildpixel an der Stelle des Textes —
 * mit dem Text unsichtbar geschaltet (Falle 45).
 */
async function messeTexte(page, etikett) {
  const stellen = await page.evaluate(() => {
    const wurzel = document.querySelector('[data-area="deepfight"] main');
    if (!wurzel) return [];
    const raus = [];
    let n = 0;
    for (const el of Array.from(wurzel.querySelectorAll("*"))) {
      const eigenerText = Array.from(el.childNodes).some(
        (k) => k.nodeType === 3 && k.textContent.trim().length > 2,
      );
      if (!eigenerText) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 6) continue;
      if (r.top < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth)
        continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") continue;
      el.setAttribute("data-mess", String(n));
      raus.push({
        id: n,
        farbe: s.color,
        text: el.textContent.trim().slice(0, 32),
        // Links oben IM Text, nicht die Mitte des Kastens: dort steht wirklich
        // Schrift, und genau dort will man den Grund kennen.
        x: Math.round(r.left + Math.min(14, r.width / 2)),
        y: Math.round(r.top + r.height / 2),
      });
      n += 1;
      if (n >= 24) break;
    }
    return raus;
  });
  if (!stellen.length) return { schlechteste: null, anzahl: 0 };

  const vorne = [];
  for (const s of stellen) vorne.push(await loeseFarbe(page, s.farbe));

  const schlechtester = stellen.map(() => Infinity);
  for (let runde = 0; runde < 4; runde++) {
    await page.waitForTimeout(420);
    // ZWEI KORREKTUREN AM 08.09., beide teuer bezahlt:
    //
    // (1) NICHT `visibility: hidden`. Trägt das Element selbst eine Fläche —
    //     ein gefüllter Knopf etwa —, verschwindet die Fläche mit, und
    //     gemessen wird der Seitengrund dahinter. Auf dem Modus-Knopf
    //     „Gegner" kam so 1,01:1 heraus, weil --on-accent im Dunkeln fast so
    //     schwarz ist wie der Grund.
    //
    // (2) `color` MUSS DEN GANZEN TEILBAUM treffen, nicht nur das Element
    //     (Befund des Teilschritt-3-Fensters): Ein Kind, das seine Farbe
    //     selbst setzt, bleibt sonst stehen — und Icons malen mit
    //     `currentColor`, liegen also genau dort, wo das Messpixel sitzt.
    //     Dort misst man Schrift gegen Schrift. Drüben las das 1,73:1, wo in
    //     Wahrheit 17,4:1 standen. Als Regel über Element UND Nachfahren,
    //     mit !important gegen Inline-Farben.
    await page.evaluate(() => {
      const s = document.createElement("style");
      s.id = "mess-blind";
      s.textContent =
        "[data-mess], [data-mess] * { color: transparent !important; }";
      document.head.appendChild(s);
    });
    for (let i = 0; i < stellen.length; i++) {
      const clip = { x: stellen[i].x, y: stellen[i].y, width: 1, height: 1 };
      const buf = await page.screenshot({ clip });
      const hinten = pixelAusPng(buf);
      const k = kontrast(vorne[i], hinten);
      if (k < schlechtester[i]) schlechtester[i] = k;
    }
    await page.evaluate(() => {
      document.getElementById("mess-blind")?.remove();
    });
  }

  const liste = stellen
    .map((s, i) => ({ ...s, k: schlechtester[i] }))
    .sort((a, b) => a.k - b.k);
  const durchgefallen = liste.filter((e) => e.k < 4.5);
  console.log(
    `  ${etikett}: ${liste.length} Textstellen, schwächste ${liste[0].k.toFixed(2)}:1 („${liste[0].text}")`,
  );
  for (const e of durchgefallen)
    console.log(`      UNTER AA: ${e.k.toFixed(2)}:1 „${e.text}" ${e.farbe}`);
  sagt(durchgefallen.length === 0, `${etikett}: alle Textstellen ≥ 4,5:1`);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-mess]"))
      el.removeAttribute("data-mess");
  });
  return { schlechteste: liste[0], anzahl: liste.length };
}

async function anmelden(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

/** Auf die Werkbank MIT geladener Ablage warten — Canvas UND Sektion. */
async function zurWerkbank(page, pfad = WERKBANK) {
  await page.goto(`${BASE}${pfad}`, { waitUntil: "domcontentloaded" });
  // Ohne WebGL gibt es kein Canvas — dann auf den CSS-Rückfall warten.
  await page
    .waitForSelector(
      process.env.MESS_OHNE_WEBGL === "1"
        ? '[data-area="deepfight"] .df-rueckfall'
        : '[data-area="deepfight"] canvas',
      { timeout: 20000 },
    )
    .catch(() => {});
  await page
    .waitForSelector('[data-area="deepfight"] main input[type="file"]', {
      timeout: 20000,
    })
    .catch(() => {});
  await page.waitForTimeout(2500);
}

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId}`);
  const auth = getAuth();
  const db = getFirestore();

  const vorher = {
    auth: (await auth.listUsers(1000)).users.length,
    docs: (await db.collection("users").get()).size,
  };
  console.log(`Vorher: ${vorher.auth} Auth-Konten, ${vorher.docs} users-Dokumente`);

  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (
      await auth.createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: "Mess T4",
        emailVerified: true,
      })
    ).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        displayName: "Mess T4",
        email: EMAIL,
        gymId: GYM_ID,
        trainerOnboarded: true,
        // Falle 26: ohne createdAt sortiert listAllMembers das Konto heraus.
        createdAt: new Date(),
        ...rightsMirror(rechte),
      },
      { merge: true },
    );
  console.log(`Prüfkonto: ${uid}`);

  // OHNE WEBGL MESSEN (MESS_OHNE_WEBGL=1): Leons Chrome hatte am 08.09. keinen
  // WebGL-Kontext mehr, und der CSS-Rückfall (.df-rueckfall) malt den Grund
  // anders als der Shader — dieselben Tokens, andere Verteilung. Die
  // Kontrastwerte der Sektion gelten deshalb nicht automatisch auch dort.
  const ohneWebgl = process.env.MESS_OHNE_WEBGL === "1";
  const browser = await chromium.launch(
    ohneWebgl ? { args: ["--disable-3d-apis"] } : {},
  );
  if (ohneWebgl) console.log("MODUS: OHNE WebGL (CSS-Rückfall)\n");
  try {
    // ── 1–3: Überlauf, Glas-in-Glas, Kontrast über vier Kombinationen ──────
    for (const theme of ["dark", "light"]) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
          isMobile: vp.name === "mobil",
          hasTouch: vp.name === "mobil",
        });
        const page = await ctx.newPage();
        const konsole = [];
        page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
        await anmelden(page);
        await page.evaluate((t) => localStorage.setItem("ta-theme", t), theme);
        await zurWerkbank(page);

        console.log(`\n── ${theme} / ${vp.name} ─────────────────────────────`);
        await page.screenshot({
          path: `tmp-t4-${theme}-${vp.name}.png`,
          fullPage: true,
        });

        const befund = await page.evaluate(() => {
          const de = document.documentElement;
          const vw = de.clientWidth;
          const geklemmt = (el) => {
            for (let n = el; n; n = n.parentElement) {
              if (n.hasAttribute?.("data-ambient")) return true;
              const s = getComputedStyle(n);
              if (["auto", "scroll", "hidden"].includes(s.overflowX)) return true;
              if (s.overflow === "hidden") return true;
            }
            return false;
          };
          const ueber = [];
          for (const el of Array.from(document.querySelectorAll("main *"))) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > vw + 0.5 && !geklemmt(el))
              ueber.push(
                `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)}`,
              );
          }
          // Glas-in-Glas: eine .t-card mit .t-card-Vorfahren im Bereich.
          const karten = Array.from(
            document.querySelectorAll('[data-area="deepfight"] main .t-card'),
          );
          const verschachtelt = karten.filter((k) =>
            k.parentElement?.closest(".t-card"),
          );
          const mainBg = getComputedStyle(document.querySelector("main")).backgroundColor;
          return {
            scroll: `${de.scrollWidth}/${vw}`,
            ueber: ueber.slice(0, 5),
            karten: karten.length,
            verschachtelt: verschachtelt.map(
              (k) => String(k.className).slice(0, 40) || "(ohne Klasse)",
            ),
            mainBg,
            theme: de.getAttribute("data-theme"),
          };
        });
        sagt(
          befund.ueber.length === 0,
          `kein Überlauf (${befund.scroll})` +
            (befund.ueber.length ? ` — ${befund.ueber.join(" | ")}` : ""),
        );
        sagt(
          befund.verschachtelt.length === 0,
          `Glas-in-Glas 0 (${befund.karten} Karten im Bereich)` +
            (befund.verschachtelt.length
              ? ` — ${befund.verschachtelt.join(" | ")}`
              : ""),
        );
        sagt(
          /rgba\(0, 0, 0, 0\)|transparent/.test(befund.mainBg),
          `main transparent (Falle 17): ${befund.mainBg}`,
        );
        sagt(befund.theme === theme, `Theme angekommen: ${befund.theme}`);

        await messeTexte(page, `Kontrast ${theme}/${vp.name}`);
        sagt(konsole.length === 0, `Konsole 0 Fehler` + (konsole.length ? `: ${konsole[0]}` : ""));
        await ctx.close();
      }
    }

    // ── 4–8: Verhalten, einmal auf Desktop/dark ───────────────────────────
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const konsole = [];
    page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
    await anmelden(page);
    await page.evaluate(() => localStorage.setItem("ta-theme", "dark"));
    await zurWerkbank(page);

    console.log("\n── Die zwei neuen Ecken-Tokens ──────────────────────");
    for (const [wort, token] of [
      ["Rote Ecke", "--corner-red"],
      ["Blaue Ecke", "--corner-blue"],
    ]) {
      const knopf = page
        .locator('[data-area="deepfight"] main button', { hasText: wort })
        .first();
      await knopf.click();
      await page.waitForTimeout(300);
      const kasten = await knopf.boundingBox();
      // Fläche links im Knopf, wo keine Schrift steht.
      const buf = await page.screenshot({
        clip: { x: Math.round(kasten.x + 4), y: Math.round(kasten.y + 4), width: 1, height: 1 },
      });
      const flaeche = pixelAusPng(buf);
      const schrift = await loeseFarbe(
        page,
        await knopf.evaluate((el) => getComputedStyle(el).color),
      );
      const k = kontrast(schrift, flaeche);
      console.log(
        `  ${wort} (${token}): Fläche rgb(${flaeche.slice(0, 3).join(",")}), Schrift auf Fläche ${k.toFixed(2)}:1`,
      );
      sagt(k >= 4.5, `${wort}: Schrift auf der Sportfarbe ≥ 4,5:1`);
      const bunt =
        Math.max(...flaeche.slice(0, 3)) - Math.min(...flaeche.slice(0, 3)) > 40;
      sagt(bunt, `${wort}: die Fläche trägt wirklich Farbe, kein Grau`);
    }

    console.log("\n── Die Ablage: ziehen und einfügen ──────────────────");
    // Ziehen: eine echte Datei per DataTransfer auf die Fläche fallen lassen.
    const gezogen = await page.evaluate(() => {
      const ablage = document.querySelector(
        '[data-area="deepfight"] main input[type="file"]',
      )?.parentElement;
      if (!ablage) return "keine Ablage gefunden";
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(2048)], "sparring-runde-3.mp4", { type: "video/mp4" }));
      ablage.dispatchEvent(
        new DragEvent("dragenter", { bubbles: true, dataTransfer: dt }),
      );
      ablage.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
      return "abgelegt";
    });
    await page.waitForTimeout(600);
    const nachZiehen = await page
      .locator('[data-area="deepfight"] main')
      .innerText();
    sagt(
      nachZiehen.includes("sparring-runde-3.mp4"),
      `gezogene Datei kommt an (${gezogen})`,
    );

    // Falsche Datei: die Ablage sagt, was sie braucht.
    await page.evaluate(() => {
      const ablage = document.querySelector(
        '[data-area="deepfight"] main input[type="file"]',
      )?.parentElement;
      const dt = new DataTransfer();
      dt.items.add(new File(["x"], "trainingsplan.pdf", { type: "application/pdf" }));
      ablage.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
    });
    await page.waitForTimeout(500);
    sagt(
      (await page.locator('[data-area="deepfight"] main').innerText())
        .toLowerCase()
        .includes("kein video"),
      "abgelegtes PDF wird abgewiesen, mit einem Satz",
    );

    // Einfügen: ein YouTube-Link schaltet die Quelle selbst um.
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData("text", "https://www.youtube.com/watch?v=abc12345678");
      document.body.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, clipboardData: dt }),
      );
    });
    await page.waitForTimeout(600);
    const linkFeld = page.locator('[data-area="deepfight"] main input[type="url"]');
    sagt(
      (await linkFeld.count()) > 0 &&
        (await linkFeld.first().inputValue()).includes("youtube.com"),
      "eingefügter YouTube-Link schaltet auf die Link-Quelle um und steht im Feld",
    );

    console.log("\n── Angefangene Analyse ──────────────────────────────");
    await page.evaluate((gegner) => {
      localStorage.setItem(
        `ta-video-analysis-form:opponent:${gegner}`,
        JSON.stringify({
          corner: "red",
          clothing: "schwarze Shorts",
          features: "",
          startPosition: "",
          tier: "flash",
          recency: "unknown",
          sourceKind: "upload",
          youtubeUrl: "",
          ytStart: "",
          ytEnd: "",
          pendingUpload: {
            name: "files/abc",
            fileUri: "https://x/abc",
            mimeType: "video/mp4",
            fileName: "kampf-koeln.mp4",
            fileSize: 12345,
            durationSeconds: 300,
          },
          pendingObservation: null,
          pendingSavedAt: Date.now() - 7 * 3600 * 1000,
        }),
      );
    }, GEGNER);
    await zurWerkbank(page);

    // KOMMT DER GANZE ZUSTAND ZURÜCK? Bis zum 08.09.2026 nicht: Ecke, Stufe
    // und Zeitpunkt fielen auf ihre Vorgaben zurück, Kleidung und Merkmale
    // nicht. Der Schreib-Effekt lief los, bevor die gelesenen Werte im State
    // standen — und `if (s.corner)` sieht in „unknown" einen gültigen Wert.
    const zurueck = await page.evaluate(() => {
      const m = document.querySelector('[data-area="deepfight"] main');
      const kn = Array.from(m.querySelectorAll("button"));
      const pressed = (w) =>
        kn.find((x) => x.textContent.trim().toLowerCase().startsWith(w))
          ?.getAttribute("aria-pressed") === "true";
      return {
        rot: pressed("rote ecke"),
        kleidung: Array.from(m.querySelectorAll("input")).some(
          (i) => i.value === "schwarze Shorts",
        ),
      };
    });
    sagt(zurueck.rot, "die gemerkte Ecke kommt zurueck: rot statt unbekannt");
    sagt(zurueck.kleidung, "die gemerkte Kämpferbeschreibung kommt zurück");
    // KLEINSCHREIBEN VOR DEM VERGLEICHEN: `innerText` liefert den GERENDERTEN
    // Text, und Labels wie Knöpfe tragen `text-transform: uppercase`. Ein
    // Vergleich auf „Angefangene Analyse" scheiterte am 08.09. an genau dem —
    // im DOM steht der Satz richtig, auf dem Schirm steht er in Versalien.
    const text = (
      await page.locator('[data-area="deepfight"] main').innerText()
    ).toLowerCase();
    sagt(text.includes("angefangene analyse"), "die Fortsetzen-Zeile steht da");
    sagt(text.includes("kampf-koeln.mp4"), "sie nennt das wartende Video");
    sagt(/noch 4[01] stunden gültig/.test(text), "sie nennt die Restzeit");
    sagt(text.includes("analyse fortsetzen"), "sie bietet das Fortsetzen an");
    await page
      .locator('[data-area="deepfight"] main button', {
        hasText: "Verwerfen und neu anfangen",
      })
      .first()
      .click();
    // 2500 statt 700 ms: Die Fortsetzen-Zeile geht über einen `Collapse`, und
    // dessen Feder braucht länger, als sie aussieht. Mit 700 ms schlug der
    // Test sporadisch fehl — sechs gezielte Läufe (mit und ohne WebGL) haben
    // danach gezeigt, dass Anzeige UND Speicher jedes Mal geräumt werden. Ein
    // flackernder Test ist schlimmer als keiner: Er kostet die Zeit, mit der
    // man einen echten Befund gesucht hätte.
    await page.waitForTimeout(2500);
    const nachVerwerfen = await page.evaluate((g) => {
      const roh = localStorage.getItem(`ta-video-analysis-form:opponent:${g}`);
      const s = JSON.parse(roh ?? "{}");
      return {
        anzeige: !document
          .querySelector('[data-area="deepfight"] main')
          .innerText.toLowerCase()
          .includes("kampf-koeln.mp4"),
        speicher: !s.pendingUpload,
      };
    }, GEGNER);
    sagt(nachVerwerfen.anzeige, "Verwerfen räumt die Anzeige");
    sagt(nachVerwerfen.speicher, "Verwerfen räumt auch den Speicher");

    console.log("\n── Bewegung (Bildvergleich, Falle 41) ───────────────");
    await zurWerkbank(page);
    const hash = async () =>
      createHash("md5").update(await page.screenshot()).digest("hex");
    const a1 = await hash();
    await page.waitForTimeout(1400);
    const a2 = await hash();
    sagt(a1 !== a2, "die Schicht bewegt sich");
    await ctx.close();

    const ruhig = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      reducedMotion: "reduce",
    });
    const pr = await ruhig.newPage();
    await anmelden(pr);
    await zurWerkbank(pr);
    const r1 = createHash("md5").update(await pr.screenshot()).digest("hex");
    await pr.waitForTimeout(1400);
    const r2 = createHash("md5").update(await pr.screenshot()).digest("hex");
    sagt(r1 === r2, "bei prefers-reduced-motion steht sie still");
    await ruhig.close();

    console.log("\n── Die Wege von den Detailseiten ────────────────────");
    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const p3 = await ctx3.newPage();
    await anmelden(p3);

    await p3.goto(`${BASE}/trainer/deepfight/gegner/${GEGNER}`, {
      waitUntil: "domcontentloaded",
    });
    await p3.waitForTimeout(3500);
    const gTexte = await p3.locator('[data-area="deepfight"] main').innerText();
    sagt(!/\bVideos\b/.test(gTexte), "Gegnerseite: der Videos-Tab ist weg");
    await p3
      .locator('[data-area="deepfight"] main a', { hasText: "Video analysieren" })
      .first()
      .click();
    await p3.waitForURL(/deepfight\?modus=gegner/, { timeout: 15000 });
    sagt(
      p3.url().includes(`ziel=${GEGNER}`),
      `Gegnerseite → Werkbank mit Ziel (${p3.url().split("?")[1] ?? ""})`,
    );

    await p3.goto(`${BASE}/trainer/deepfight/athleten/${uid}`, {
      waitUntil: "domcontentloaded",
    });
    await p3.waitForTimeout(3500);
    const aTexte = await p3.locator('[data-area="deepfight"] main').innerText();
    sagt(
      !aTexte.includes("KI-Video-Analyse"),
      "Athletenseite: keine zweite Ablage mehr",
    );
    await p3
      .locator('[data-area="deepfight"] main a', { hasText: "analysieren" })
      .first()
      .click();
    await p3.waitForURL(/deepfight\?modus=leute/, { timeout: 15000 });
    sagt(
      p3.url().includes(`ziel=${uid}`),
      `Athletenseite → Werkbank mit Ziel (${p3.url().split("?")[1] ?? ""})`,
    );
    await ctx3.close();

    console.log("\n── Helix-Regression ─────────────────────────────────");
    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p4 = await ctx4.newPage();
    const hFehler = [];
    p4.on("console", (m) => m.type() === "error" && hFehler.push(m.text()));
    await p4.goto(`${BASE}/dev/helix`, { waitUntil: "domcontentloaded" });
    await p4.waitForTimeout(4000);
    // NICHT NUR CANVAS ZÄHLEN (Fehlschluss vom 08.09.): Ohne WebGL rendert
    // FightDnaHelix den SVG-Glyph statt der Szene — „0 Canvas" heißt dann
    // nicht „nichts da", sondern „der Rückfall greift". Wer Resilienz misst,
    // zählt, was STATTDESSEN gemalt wird. Ich hatte daraus „stumm kaputt"
    // geschlossen und um ein Haar einen überflüssigen Umbau vorgeschlagen.
    const helix = await p4.evaluate(() => {
      const gross = Array.from(document.querySelectorAll("svg")).filter((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 80 && r.height > 80;
      });
      return {
        canvas: document.querySelectorAll("canvas").length,
        svg: gross.length,
        formen: gross.reduce(
          (n, s) => n + s.querySelectorAll("path, circle, line, ellipse, rect").length,
          0,
        ),
      };
    });
    sagt(
      helix.canvas + helix.svg > 0 && helix.formen > 50,
      `/dev/helix malt: ${helix.canvas} Canvas + ${helix.svg} SVG (${helix.formen} Formen)`,
    );
    sagt(hFehler.length === 0, `/dev/helix: ${hFehler.length} Konsolenfehler`);
    await ctx4.close();

    sagt(konsole.length === 0, `Konsole im Verhaltenslauf: ${konsole.length} Fehler`);
  } finally {
    await browser.close();
    await db.collection("users").doc(uid).delete();
    await auth.deleteUser(uid).catch(() => {});
    const nachher = {
      auth: (await auth.listUsers(1000)).users.length,
      docs: (await db.collection("users").get()).size,
    };
    console.log(
      `\nAufgeräumt. Nachher: ${nachher.auth} Auth-Konten, ${nachher.docs} users-Dokumente` +
        (nachher.auth === vorher.auth && nachher.docs === vorher.docs
          ? " ✓ wie vorher"
          : " ✗ ABWEICHUNG"),
    );
    console.log(fehler === 0 ? "\nALLES BESTANDEN" : `\n${fehler} FEHLSCHLÄGE`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void readFileSync;
void resolve;
