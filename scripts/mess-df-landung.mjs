/**
 * TEMPORÄRES MESSWERKZEUG — Leons Neugestaltung der DeepFight-Landung
 * (08.09.2026). Nach der Abnahme LÖSCHEN (Falle 14).
 *
 * EIGENE PRÜFKONTO-ADRESSE, mit Absicht (Falle 50): `ui-check-trainer.mjs`
 * und `mess-t4-ablage.mjs` haben je eine feste E-Mail. Läuft ein zweites
 * Claude-Fenster auf demselben Arbeitsbaum, löschen sich zwei Läufe
 * gegenseitig das Konto mitten in der Messung („auth/user-not-found").
 *
 * Aufruf (NUR über PowerShell, Falle 20):
 *   node scripts/mess-df-landung.mjs
 *   $env:MESS_OHNE_WEBGL="1"; node scripts/mess-df-landung.mjs
 *
 * Gemessen wird:
 *   1. Überlauf und Glas-in-Glas, Dark+Light × 1440+390
 *   2. KONTRAST ÜBER BEWEGTEM GRUND (Falle 45) — der Kernpunkt: Überschrift
 *      und „Analyse starten" stehen OHNE Rahmen auf der Schicht.
 *   3. DER STRANG MALT — Canvas ODER SVG (Falle 51), auch ohne WebGL.
 *   4. DIE SUCHE FRAGT NICHT JE TASTENDRUCK AB — Firestore-Anfragen gezählt.
 *   5. Der Fluss: Analyse starten → zwei Ziele → Auswahlseite → Konfiguration.
 *   6. Alte Adresse `?modus=&ziel=` landet auf der Konfigurationsseite.
 *   7. „Mach weiter, wo du aufgehört hast." aus vorbelegtem localStorage.
 *   8. Bewegung per Bildvergleich (Falle 41) und reduced-motion.
 */

import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-landung@tidal-athletics.invalid";
const PASSWORD = `mess-landung-${Math.random().toString(36).slice(2)}A1!`;
const GEGNER = "BZdtaypdo5BlPtnqJ6lt"; // Paul the Fighter, das eine echte Profil
const LANDUNG = "/trainer/deepfight";

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
function pixelAusPng(buf) {
  let pos = 8;
  let kanaele = 4;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const typ = buf.toString("ascii", pos + 4, pos + 8);
    const daten = buf.subarray(pos + 8, pos + 8 + len);
    if (typ === "IHDR") {
      const farbtyp = daten[9];
      kanaele = farbtyp === 6 ? 4 : farbtyp === 2 ? 3 : 1;
    } else if (typ === "IDAT") idat.push(daten);
    else if (typ === "IEND") break;
    pos += 12 + len;
  }
  const roh = inflateSync(Buffer.concat(idat));
  return [roh[1], roh[2], roh[3], kanaele === 4 ? roh[4] : 255];
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

/** oklch() auflösen — getComputedStyle gibt es roh zurück (Falle 16). */
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
 * Kontrast aller Textstellen im Bereich, über VIER Zeitpunkte, schlechtester
 * Wert (Falle 45, vollständige Fassung).
 *
 * Der Text wird zum Messen unsichtbar gemacht — aber NICHT per
 * `visibility: hidden` (das nähme die eigene Fläche eines gefüllten Knopfes
 * mit) und NICHT nur am Element (Kinder mit eigener Farbe und Icons mit
 * `currentColor` blieben stehen). Beide Hälften sind nötig.
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
      // Unsichtbare Elemente (hidden sm:inline) haben keinen Kasten und
      // lieferten Infinity — überspringen.
      if (r.width < 8 || r.height < 6) continue;
      if (r.top < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth)
        continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0") continue;
      // SCHRIFT AUS EINEM VERLAUF (`background-clip: text`) hat die Farbe
      // `transparent` — hier wuerde sie als Schwarz gerechnet. Solche Stellen
      // misst `mess-df-rahmenlos.mjs` ueber ihre Verlaufsstufen.
      if (s.color === "rgba(0, 0, 0, 0)" || s.color === "transparent") continue;

      // DER MESSPUNKT KOMMT AUS DEM TEXTKNOTEN, NICHT AUS DEM ELEMENTKASTEN
      // (08.09.2026, teuer gemessen). Vorher lag er bei `left + 14 px` — bei
      // „Analyse starten" landete das exakt auf dem Funkeln davor. Das
      // Symbol ist in DERSELBEN Farbe gemalt wie die Schrift (Maske auf
      // --text-1) und wird vom `color: transparent`-Riegel nicht erfasst,
      // weil es kein Text ist. Ergebnis: 3,1:1 gemeldet, wo quer über den
      // Knopf 9,6 bis 17,9 stehen. Dieselbe Familie wie die Icon-Falle mit
      // `currentColor` — nur andersherum.
      // Eine Range über den Textknoten liefert den Kasten der GLYPHEN.
      const knoten = Array.from(el.childNodes).find(
        (k) => k.nodeType === 3 && k.textContent.trim().length > 2,
      );
      const bereich = document.createRange();
      bereich.selectNodeContents(knoten);
      const tr = bereich.getBoundingClientRect();
      const kasten = tr.width >= 6 && tr.height >= 6 ? tr : r;

      el.setAttribute("data-mess", String(n));
      raus.push({
        id: n,
        farbe: s.color,
        text: el.textContent.trim().slice(0, 34),
        x: Math.round(kasten.left + Math.min(14, kasten.width / 2)),
        y: Math.round(kasten.top + kasten.height / 2),
      });
      n += 1;
      if (n >= 26) break;
    }
    return raus;
  });
  if (!stellen.length) {
    sagt(false, `${etikett}: keine Textstelle gefunden`);
    return null;
  }

  const vorne = [];
  for (const s of stellen) vorne.push(await loeseFarbe(page, s.farbe));

  const schlechtester = stellen.map(() => Infinity);
  for (let runde = 0; runde < 4; runde++) {
    await page.waitForTimeout(420);
    await page.evaluate(() => {
      const s = document.createElement("style");
      s.id = "mess-blind";
      // DIE PSEUDO-ELEMENTE MUESSEN MIT (gemessen 10.09.2026): „Start" traegt
      // seinen Regenbogen als `::after` mit `content: attr(data-text)` --
      // dieselbe Schrift noch einmal. Der `color`-Riegel erreicht ein
      // Pseudo-Element NICHT, es blieb also stehen und wurde als HINTERGRUND
      // gemessen: gemeldet 3,00:1, wo die Schrift selbst zweistellig liegt.
      // Dritte Auflage derselben Lehre: Was Vordergrund ist, muss weg -- egal
      // ob es ein Kind, ein Icon oder ein Pseudo-Element ist.
      s.textContent =
        "[data-mess], [data-mess] * { color: transparent !important;" +
        " background-image: none !important; }" +
        "[data-mess]::after, [data-mess]::before { content: none !important; }";
      document.head.appendChild(s);
    });
    for (let i = 0; i < stellen.length; i++) {
      const clip = { x: stellen[i].x, y: stellen[i].y, width: 1, height: 1 };
      const buf = await page.screenshot({ clip });
      const k = kontrast(vorne[i], pixelAusPng(buf));
      if (k < schlechtester[i]) schlechtester[i] = k;
    }
    await page.evaluate(() => document.getElementById("mess-blind")?.remove());
  }

  const liste = stellen
    .map((s, i) => ({ ...s, k: schlechtester[i] }))
    .filter((e) => Number.isFinite(e.k))
    .sort((a, b) => a.k - b.k);
  const durchgefallen = liste.filter((e) => e.k < 4.5);
  console.log(
    `  ${etikett}: ${liste.length} Stellen, schwaechste ${liste[0].k.toFixed(2)}:1 -- ${liste[0].text}`,
  );
  for (const e of durchgefallen)
    console.log(`      UNTER AA: ${e.k.toFixed(2)}:1 -- ${e.text} ${e.farbe}`);
  sagt(durchgefallen.length === 0, `${etikett}: alle Textstellen ≥ 4,5:1`);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-mess]"))
      el.removeAttribute("data-mess");
  });
  return liste;
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

const ohneWebgl = process.env.MESS_OHNE_WEBGL === "1";

/** Auf die Landung MIT fertigem Grund und geladenen Listen warten. */
async function zurLandung(page, pfad = LANDUNG) {
  await page.goto(`${BASE}${pfad}`, { waitUntil: "domcontentloaded" });
  await page
    .waitForSelector(
      ohneWebgl
        ? '[data-area="deepfight"] .df-rueckfall'
        : '[data-area="deepfight"] canvas',
      { timeout: 20000 },
    )
    .catch(() => {});
  // Der Fächer braucht ~1 s; „Meine Analysen" hängt daran.
  await page.waitForTimeout(4000);
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
        displayName: "Mess Landung",
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
        displayName: "Mess Landung",
        email: EMAIL,
        gymId: GYM_ID,
        trainerOnboarded: true,
        createdAt: new Date(), // Falle 26: sonst fehlt das Konto in listAllMembers
        ...rightsMirror(rechte),
      },
      { merge: true },
    );
  console.log(`Prüfkonto: ${uid}`);

  const browser = await chromium.launch(
    ohneWebgl ? { args: ["--disable-3d-apis"] } : {},
  );
  if (ohneWebgl) console.log("MODUS: OHNE WebGL (CSS-Rückfall)\n");

  try {
    // ── 1+2: Überlauf, Glas-in-Glas, Kontrast in vier Kombinationen ────────
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
        // Der Zwischenstand wird HIER vorbelegt, damit das Feld „Mach weiter,
        // wo du aufgehört hast." in der Kontrastmessung MIT dransteht. Ohne
        // ihn erscheint es gar nicht — und eine Stelle, die die Sonde nie
        // sieht, ist eine Stelle, die niemand gemessen hat.
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
        await zurLandung(page);

        console.log(`\n── ${theme} / ${vp.name} ───────────────────────────`);
        await page.screenshot({
          path: `tmp-df-landung-${theme}-${vp.name}.png`,
          fullPage: true,
        });

        const befund = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
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
              ueber.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 26)}`);
          }
          // Glas in Glas: eine .t-card mit .t-card-Vorfahren im Bereich
          const glasInGlas = Array.from(
            document.querySelectorAll('[data-area="deepfight"] .t-card'),
          ).filter((el) => el.parentElement?.closest(".t-card")).length;
          // Falle 17: das <main> des Bereichs muss durchsichtig sein, sonst
          // schneidet es die bewegte Schicht quer über die Spalte ab.
          const m = document.querySelector('[data-area="deepfight"] main');
          return {
            ueber: ueber.slice(0, 6),
            anzahlUeber: ueber.length,
            glasInGlas,
            mainBg: m ? getComputedStyle(m).backgroundColor : "?",
          };
        });
        sagt(befund.anzahlUeber === 0, `Überlauf: ${befund.anzahlUeber} ${JSON.stringify(befund.ueber)}`);
        sagt(befund.glasInGlas === 0, `Glas in Glas: ${befund.glasInGlas}`);
        sagt(
          /rgba\(0, 0, 0, 0\)|transparent/.test(befund.mainBg),
          `main durchsichtig (Falle 17): ${befund.mainBg}`,
        );

        // DIE ÜBERSCHRIFT MUSS AUF DEM SCHREIBTISCH EINZEILIG SEIN (Leon
        // 10.09.). Zeilen zaehlt man nicht am Screenshot, sondern an den
        // Client-Rects der Range: Jede Zeile ist ein eigenes Rechteck.
        const kopf = await page.evaluate(() => {
          const h = Array.from(
            document.querySelectorAll('[data-area="deepfight"] main h2'),
          ).find((e) => e.textContent.toLowerCase().includes("fight-dna"));
          if (!h) return null;
          const b = document.createRange();
          b.selectNodeContents(h);
          const r = h.getBoundingClientRect();
          return {
            zeilen: b.getClientRects().length,
            groesse: Math.round(parseFloat(getComputedStyle(h).fontSize)),
            breite: Math.round(r.width),
            spalte: Math.round(
              document.querySelector(".df-kopfspalte")?.getBoundingClientRect()
                .width ?? 0,
            ),
          };
        });
        if (kopf) {
          console.log(
            `  Überschrift: ${kopf.groesse} px, ${kopf.zeilen} Zeile(n), ${kopf.breite} von ${kopf.spalte} px Spalte`,
          );
          if (vp.name === "desktop") {
            sagt(kopf.zeilen === 1, `Überschrift einzeilig: ${kopf.zeilen}`);
          }
        } else {
          sagt(false, "Überschrift nicht gefunden");
        }

        await messeTexte(page, `Kontrast ${theme}/${vp.name}`);
        sagt(konsole.length === 0, `Konsole: ${konsole.length} Fehler`);
        if (konsole.length) console.log("      " + konsole.slice(0, 3).join("\n      "));
        await ctx.close();
      }
    }

    // ── Die Überschrift über DREI Breiten ──────────────────────────────────
    // 1440 allein genuegt nicht: Die Zeile haelt dort nur, weil der Deckel
    // greift. Die enge Stelle ist 1280 — dort ist die Spalte nach Abzug der
    // Sidebar noch 912 px breit, und die Schriftgroesse haengt am Faktor,
    // nicht am Deckel.
    console.log("\n── Die Überschrift ─────────────────────────────────────");
    {
      for (const breite of [1920, 1440, 1280]) {
        const ctx = await browser.newContext({
          viewport: { width: breite, height: 1000 },
          deviceScaleFactor: 1,
        });
        const page = await ctx.newPage();
        await anmelden(page);
        await zurLandung(page);
        const k = await page.evaluate(() => {
          const h = Array.from(
            document.querySelectorAll('[data-area="deepfight"] main h2'),
          ).find((e) => e.textContent.toLowerCase().includes("fight-dna"));
          if (!h) return null;
          const b = document.createRange();
          b.selectNodeContents(h);
          return {
            zeilen: b.getClientRects().length,
            groesse: Math.round(parseFloat(getComputedStyle(h).fontSize)),
            breite: Math.round(h.getBoundingClientRect().width),
            spalte: Math.round(
              document.querySelector(".df-kopfspalte")?.getBoundingClientRect()
                .width ?? 0,
            ),
          };
        });
        sagt(
          k !== null && k.zeilen === 1,
          `${breite} px: ${k ? `${k.groesse} px Schrift, ${k.zeilen} Zeile(n), ${k.breite} von ${k.spalte} px` : "nicht gefunden"}`,
        );
        await ctx.close();
      }
    }

    // ── „Start" auf TOUCH: ohne Zeiger immer sichtbar ──────────────────────
    // MOTION-BRIEF §3.3 — Hover traegt nie. Mit `hasTouch` + `isMobile`
    // meldet Chromium `(hover: none)`, genau die Lage auf dem Handy.
    console.log("\n── Start auf Touch ─────────────────────────────────────");
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 900 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await ctx.newPage();
      await anmelden(page);
      await zurLandung(page);
      const t = await page.evaluate(() => {
        const l = document.querySelector('[data-area="deepfight"] main .df-strang-label');
        return {
          keinHover: matchMedia("(hover: none)").matches,
          deckkraft: l ? Number(getComputedStyle(l).opacity) : -1,
        };
      });
      sagt(t.keinHover, `Kontext meldet (hover: none): ${t.keinHover}`);
      sagt(t.deckkraft === 1, `Start steht auf Touch ohne Zeiger da: Deckkraft ${t.deckkraft}`);
      await page.locator('[data-area="deepfight"] main .df-strang-ziel').tap();
      await page.waitForTimeout(700);
      const ziele = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('[data-area="deepfight"] main .df-strang-mitte button'),
        ).length,
      );
      sagt(ziele === 2, `ein Tipp auf den Strang oeffnet die zwei Ziele: ${ziele}`);
      await ctx.close();
    }

    // ── 3: Der Strang malt — Canvas ODER SVG (Falle 51) ────────────────────
    console.log("\n── Der DNA-Strang ──────────────────────────────────────");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
      const page = await ctx.newPage();
      await anmelden(page);
      await zurLandung(page);
      const strang = await page.evaluate(() => {
        const host = document.querySelector(".df-strang");
        if (!host) return null;
        const r = host.getBoundingClientRect();
        const grosseSvg = Array.from(host.querySelectorAll("svg")).filter((s) => {
          const b = s.getBoundingClientRect();
          return b.width > 80 && b.height > 80;
        });
        const sec = host.querySelector("section");
        return {
          breite: Math.round(r.width),
          hoehe: Math.round(r.height),
          canvas: host.querySelectorAll("canvas").length,
          svg: grosseSvg.length,
          formen: grosseSvg.reduce(
            (n, s) => n + s.querySelectorAll("path, circle, line, ellipse, rect").length,
            0,
          ),
          // Der deckende --bg-0-Kasten der Helix muss im Bereich weg sein,
          // sonst löscht er die bewegte Schicht auf 620 px aus.
          grund: sec ? getComputedStyle(sec).backgroundColor : "?",
          radius: sec ? getComputedStyle(sec).borderRadius : "?",
          // Die Maske sitzt am SECTION, nicht an den Hintergrund-Schichten:
          // Der WebGL-Canvas malt seinen eigenen rechteckigen Grund und lag
          // sonst ausserhalb -- sichtbar als harte Kante, von keiner
          // Kontrastmessung gemeldet (08.09.2026, im Screenshot gefunden).
          maske: sec
            ? getComputedStyle(sec).maskImage ||
              getComputedStyle(sec).webkitMaskImage
            : "?",
        };
      });
      if (!strang) {
        sagt(false, "Der Strang steht gar nicht da (.df-strang fehlt)");
      } else {
        console.log(`  Kasten ${strang.breite}×${strang.hoehe} px`);
        sagt(
          strang.canvas + strang.svg > 0 && strang.formen > 50,
          `malt: ${strang.canvas} Canvas + ${strang.svg} SVG (${strang.formen} Formen)`,
        );
        sagt(
          /rgba\(0, 0, 0, 0\)|transparent/.test(strang.grund),
          `Grund durchsichtig (Schicht bleibt sichtbar): ${strang.grund}`,
        );
        sagt(strang.radius === "0px", `kein Rahmen-Radius: ${strang.radius}`);
        sagt(
          strang.maske.includes("gradient"),
          `Hintergrund läuft aus (Maske gesetzt): ${strang.maske.slice(0, 46)}…`,
        );
      }
      await ctx.close();
    }

    // ── 4: DIE SUCHE FRAGT NICHT JE TASTENDRUCK AB ────────────────────────
    // Der eigentliche Punkt von Leons Entscheidung. Gezählt werden echte
    // Firestore-Anfragen, nicht Absichten.
    console.log("\n── Die Suche (Punkt A) ─────────────────────────────────");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
      const page = await ctx.newPage();
      let firestore = 0;
      page.on("request", (r) => {
        if (r.url().includes("firestore.googleapis.com")) firestore += 1;
      });
      await anmelden(page);
      await zurLandung(page);
      const nachLaden = firestore;
      console.log(`  Firestore-Anfragen bis Landung fertig: ${nachLaden}`);

      // Tippen: Buchstabe für Buchstabe, mit Pausen, damit ein Effekt je
      // Tastendruck auch wirklich Zeit zum Feuern hätte.
      const pille = page.locator('[data-area="deepfight"] main .goo-pill').first();
      await pille.click();
      await page.waitForTimeout(600);
      const vorTippen = firestore;
      for (const c of "Paul") {
        await page.keyboard.type(c);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1500);
      const beimTippen = firestore - vorTippen;
      sagt(
        beimTippen === 0,
        `Tippen von 4 Buchstaben löst ${beimTippen} Firestore-Anfragen aus (Soll 0)`,
      );

      const treffer = await page.evaluate(() => {
        const w = document.querySelector('[data-area="deepfight"] main');
        const labels = Array.from(w.querySelectorAll(".t-label")).map((e) =>
          e.textContent.trim().toLowerCase(),
        );
        return {
          labels,
          links: Array.from(w.querySelectorAll('a[href*="/trainer/deepfight/"]'))
            .map((a) => a.getAttribute("href"))
            .filter((h) => !h.endsWith("/trainer/deepfight")),
        };
      });
      // innerText liefert den GERENDERTEN Text (uppercase) — kleinschreiben
      // vor dem Vergleichen (Falle 47).
      sagt(
        treffer.labels.some((l) => l.startsWith("gegner")),
        `Trefferliste zeigt Gruppe Gegner: ${JSON.stringify(treffer.labels)}`,
      );
      sagt(
        treffer.links.some((h) => h.includes(`/gegner/${GEGNER}`)),
        `Treffer führt zum echten Gegnerprofil`,
      );
      await ctx.close();
    }

    // ── 5+6: Der Fluss und die alte Adresse ───────────────────────────────
    console.log("\n── Der Fluss ───────────────────────────────────────────");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
      const page = await ctx.newPage();
      await anmelden(page);
      await zurLandung(page);

      // ── Leons Einstieg vom 11.09.: „Start" IN der Mitte des Strangs ─────
      // a) In Ruhe (Maus) ist der Schriftzug unsichtbar, unter dem Zeiger da.
      // b) Es gibt keinen Start-Knopf mehr unter dem Strang.
      // c) Ein Klick auf den Strang oeffnet die zwei Ziele — am selben Ort.
      // d) Ein Klick daneben nimmt sie zurueck; kein Abbrechen-Knopf.
      // e) Unter dem Zeiger waechst der Strang, das BILD wird kraeftiger —
      //    der Rahmen selbst traegt keinen Filter (er faerbte sonst den
      //    Schriftzug und die Knoepfe mit um).
      const labelDeckkraft = () =>
        page.evaluate(() => {
          const l = document.querySelector('[data-area="deepfight"] main .df-strang-label');
          return l ? Number(getComputedStyle(l).opacity) : -1;
        });
      await page.mouse.move(4, 4);
      await page.waitForTimeout(500);
      const inRuhe = await labelDeckkraft();
      sagt(inRuhe === 0, `Start ist in Ruhe unsichtbar: Deckkraft ${inRuhe}`);
      const alterKnopf = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-area="deepfight"] main button'))
          .some((b) => b.textContent.trim().toLowerCase() === "start"),
      );
      sagt(!alterKnopf, "kein Start-Knopf mehr unter dem Strang");

      const ruhe = await page.evaluate(() => ({
        t: getComputedStyle(document.querySelector(".df-strang")).transform,
        f: getComputedStyle(document.querySelector(".df-strang-bild")).filter,
        rahmenFilter: getComputedStyle(document.querySelector(".df-strang")).filter,
      }));
      await page.locator('[data-area="deepfight"] main .df-strang-ziel').hover();
      await page.waitForTimeout(600);
      const unterZeiger = await labelDeckkraft();
      sagt(unterZeiger === 1, `unter dem Zeiger erscheint Start: Deckkraft ${unterZeiger}`);
      const hover = await page.evaluate(() => {
        const l = document.querySelector('[data-area="deepfight"] main .df-strang-label');
        const s = document.querySelector(".df-strang").getBoundingClientRect();
        const r = l.getBoundingClientRect();
        return {
          t: getComputedStyle(document.querySelector(".df-strang")).transform,
          f: getComputedStyle(document.querySelector(".df-strang-bild")).filter,
          rahmenFilter: getComputedStyle(document.querySelector(".df-strang")).filter,
          kursiv: getComputedStyle(l).fontStyle,
          schnitt: getComputedStyle(l).fontWeight,
          // Leon 11.09.: ohne helle oder dunkle Hinterlegung
          grundVorher: getComputedStyle(l.closest(".df-strang-mitte"), "::before").content,
          grundFlaeche: getComputedStyle(l.closest(".df-strang-mitte")).backgroundColor,
          // Ist der 300er-Schnitt WIRKLICH geladen? Sonst malt der Browser
          // still 400 und die computed 300 luegt.
          duennGeladen: Array.from(document.fonts).some(
            (f) => /archivo/i.test(f.family) && String(f.weight).split(" ")[0] === "300" && f.status === "loaded",
          ),
          groesse: Math.round(parseFloat(getComputedStyle(l).fontSize)),
          mitteX: Math.round(r.left + r.width / 2 - (s.left + s.width / 2)),
          mitteY: Math.round(r.top + r.height / 2 - (s.top + s.height / 2)),
        };
      });
      sagt(hover.kursiv === "italic", `Start ist kursiv: ${hover.kursiv}`);
      sagt(hover.schnitt === "300", `Start ist duenn: font-weight ${hover.schnitt}`);
      sagt(hover.duennGeladen, `der 300er-Schnitt von Archivo ist geladen: ${hover.duennGeladen}`);
      sagt(
        (hover.grundVorher === "none" || hover.grundVorher === "normal") &&
          /rgba\(0, 0, 0, 0\)|transparent/.test(hover.grundFlaeche),
        `keine Hinterlegung hinter Start: ::before ${hover.grundVorher}, Flaeche ${hover.grundFlaeche}`,
      );
      sagt(hover.groesse >= 40, `Start ist gross: ${hover.groesse} px`);
      sagt(
        Math.abs(hover.mitteX) <= 3 && Math.abs(hover.mitteY) <= 3,
        `Start sitzt mittig im Strang (Abweichung x ${hover.mitteX}, y ${hover.mitteY})`,
      );
      sagt(
        hover.t !== ruhe.t && /matrix/.test(hover.t),
        `der Strang waechst unter dem Zeiger: ${ruhe.t} -> ${hover.t}`,
      );
      sagt(
        hover.f !== ruhe.f && /saturate/.test(hover.f),
        `das Bild wird kraeftiger: ${ruhe.f} -> ${hover.f}`,
      );
      sagt(
        hover.rahmenFilter === "none",
        `der Rahmen selbst traegt keinen Filter: ${hover.rahmenFilter}`,
      );

      await page.locator('[data-area="deepfight"] main .df-strang-ziel').click();
      await page.waitForTimeout(700);
      const ziele = await page.evaluate(() => {
        const mitte = document.querySelector('[data-area="deepfight"] main .df-strang-mitte');
        return Array.from(mitte?.querySelectorAll("button") ?? [])
          .map((b) => b.textContent.trim().toLowerCase());
      });
      sagt(
        ziele.some((t) => t.includes("athleten")) && ziele.some((t) => t === "gegner"),
        `ein Klick auf den Strang oeffnet die zwei Ziele in seiner Mitte: ${JSON.stringify(ziele)}`,
      );

      // Daneben klicken -- die Ueberschrift ist so weit weg wie es geht.
      await page.locator('[data-area="deepfight"] main h2').first().click();
      await page.waitForTimeout(700);
      const nachDaneben = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-area="deepfight"] main .df-strang-mitte button')).length,
      );
      sagt(nachDaneben === 0, `ein Klick daneben nimmt die Auswahl zurueck (uebrig: ${nachDaneben})`);
      const kAbbrechen = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-area="deepfight"] main button'))
          .some((b) => b.textContent.trim().toLowerCase() === "abbrechen"),
      );
      sagt(!kAbbrechen, "kein Abbrechen-Knopf");

      await page.locator('[data-area="deepfight"] main .df-strang-ziel').click();
      await page.waitForTimeout(700);
      // Der Modus färbt, BEVOR navigiert wird
      await page
        .locator('[data-area="deepfight"] main button', { hasText: /^gegner$/i })
        .first()
        .click();
      await page.waitForURL(/\/trainer\/deepfight\/gegner/, { timeout: 15000 });
      await page.waitForTimeout(2500);
      const modus = await page.evaluate(
        () => document.querySelector("[data-area='deepfight']")?.getAttribute("data-modus"),
      );
      sagt(modus === "gegner", `Bereich steht im grauen Modus: data-modus="${modus}"`);
      sagt(
        page.url().includes("fuer=analyse"),
        `Auswahlseite weiß, wofür: ${page.url().split("/trainer")[1]}`,
      );

      // Die ganze Karte führt jetzt in die Konfiguration.
      // AUF DIE KARTE WARTEN, NICHT AUF DIE UHR: Die Bibliothek lädt ihre
      // Gegner erst nach dem Seitenwechsel. Ein fester Zeitraum misst dann
      // die Ladezeit und meldet einen leeren href als Fehlschlag (Falle 52 —
      // genau so gesehen am 09.09.).
      await page
        .waitForSelector('[data-area="deepfight"] main .t-row-target', {
          timeout: 25000,
        })
        .catch(() => {});
      const kartenZiel = await page.evaluate(
        () =>
          document
            .querySelector('[data-area="deepfight"] main .t-row-target')
            ?.getAttribute("href") ?? "",
      );
      sagt(
        kartenZiel.includes("/trainer/deepfight/analyse?"),
        `Karte führt in die Konfiguration: ${kartenZiel}`,
      );

      // Alte Adresse wird weitergereicht
      await page.goto(`${BASE}/trainer/deepfight?modus=gegner&ziel=${GEGNER}`, {
        waitUntil: "domcontentloaded",
      });
      // Im Dev-Modus kompiliert die Zielroute beim ersten Aufruf — ein fester
      // Zeitraum misst dann den Compiler, nicht die Weiterleitung.
      const kam = await page
        .waitForURL((u) => u.pathname === "/trainer/deepfight/analyse", {
          timeout: 30000,
        })
        .then(() => true)
        .catch(() => false);
      sagt(
        kam && page.url().includes("/trainer/deepfight/analyse"),
        `alte Adresse landet auf der Konfiguration: ${page.url().split("/trainer")[1]}`,
      );
      // Und dort steht wirklich die Ablage
      const ablage = await page
        .waitForSelector('[data-area="deepfight"] main input[type="file"]', {
          timeout: 20000,
        })
        .then(() => true)
        .catch(() => false);
      sagt(ablage, "die Ablage (VideoAnalysisSection) steht auf der Konfiguration");
      await ctx.close();
    }

    // ── 7: „Mach weiter, wo du aufgehört hast." ───────────────────────────
    console.log("\n── Angefangene Analyse ─────────────────────────────────");
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
      const page = await ctx.newPage();
      await anmelden(page);
      // Zwischenstand vorbelegen — genau die Form, die VideoAnalysisSection
      // schreibt (Schlüssel mit AnalysisMode, nicht mit dem Modus-Wort).
      await page.evaluate((id) => {
        localStorage.setItem(
          `ta-video-analysis-form:opponent:${id}`,
          JSON.stringify({
            corner: "red",
            clothing: "Schwarze Shorts",
            pendingUpload: { name: "files/abc123", fileName: "kampf-rd3.mp4" },
            pendingObservation: { fingerprint: "xyz" },
            pendingSavedAt: Date.now() - 3 * 3600 * 1000,
          }),
        );
      }, GEGNER);
      await zurLandung(page);
      const feld = await page.evaluate(() => {
        const w = document.querySelector('[data-area="deepfight"] main');
        const treffer = Array.from(w.querySelectorAll("h2")).find((h) =>
          h.textContent.toLowerCase().includes("mach weiter"),
        );
        if (!treffer) return null;
        const kasten = treffer.closest("section");
        return {
          text: kasten.textContent.replace(/\s+/g, " ").trim().slice(0, 420),
          weiter:
            kasten.querySelector('a[href*="/trainer/deepfight/analyse"]')?.getAttribute("href") ??
            null,
        };
      });
      sagt(feld !== null, "das Feld erscheint bei gespeichertem Zwischenstand");
      if (feld) {
        console.log(`  ${feld.text}`);
        sagt(
          feld.weiter?.includes(`ziel=${GEGNER}`),
          `Weitermachen fuehrt zum richtigen Ziel: ${feld.weiter}`,
        );
        sagt(
          /paul|kampf-rd3/i.test(feld.text),
          "das Feld nennt, worum es geht (Name oder Datei)",
        );
        sagt(/gültig/i.test(feld.text), "das Feld nennt die Restzeit");
      }

      // Gegenprobe: ohne Zwischenstand steht das Feld NICHT da.
      await page.evaluate((id) =>
        localStorage.removeItem(`ta-video-analysis-form:opponent:${id}`), GEGNER);
      await zurLandung(page);
      const wegDanach = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('[data-area="deepfight"] main h2'),
        ).some((h) => h.textContent.toLowerCase().includes("mach weiter")),
      );
      sagt(!wegDanach, "ohne Zwischenstand steht das Feld nicht da");
      await ctx.close();
    }

    // ── 8: Bewegung per Bildvergleich (Falle 41), plus reduced-motion ─────
    console.log("\n── Bewegung ────────────────────────────────────────────");
    {
      const hash = (b) => createHash("sha1").update(b).digest("hex");
      const schuss = async (page) => {
        const clip = { x: 40, y: 260, width: 420, height: 300 };
        return hash(await page.screenshot({ clip }));
      };
      for (const reduced of [false, true]) {
        const ctx = await browser.newContext({
          viewport: { width: 1440, height: 1200 },
          reducedMotion: reduced ? "reduce" : "no-preference",
        });
        const page = await ctx.newPage();
        await anmelden(page);
        await zurLandung(page);
        const a = await schuss(page);
        await page.waitForTimeout(1600);
        const b = await schuss(page);
        const bewegt = a !== b;
        sagt(
          reduced ? !bewegt : bewegt,
          reduced
            ? `bei prefers-reduced-motion steht die Schicht still: ${bewegt ? "BEWEGT SICH" : "steht"}`
            : `die Schicht bewegt sich: ${bewegt ? "ja" : "NEIN"}`,
        );
        await ctx.close();
      }
    }
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
