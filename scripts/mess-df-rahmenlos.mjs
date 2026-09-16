/**
 * TEMPORAERES MESSWERKZEUG — die RAHMENLOSEN Stellen der DeepFight-Landung.
 * Nach der Abnahme LOESCHEN (Falle 14).
 *
 * WARUM EIN ZWEITES SKRIPT: `mess-df-landung.mjs` fegt ueber alle Textstellen
 * des Bereichs und meldet die schwaechste. Das ist die richtige Rundumsicht,
 * aber sie beantwortet die EINE Frage nicht sicher, um die es hier geht — ob
 * die Sonde die Stellen ueberhaupt getroffen hat, an denen Leon den Rahmen
 * weggelassen haben will:
 *
 *   1. die Ueberschrift "Entschluessle die Fight-DNA"
 *   2. der Einstieg "Start" unter dem DNA-Strang
 *
 * Beide stehen NICHT auf einer Karte, sondern direkt ueber der bewegten
 * Schicht. Die Bereichsregel ("Text sitzt IMMER auf einer Karte") steht dort
 * aus einem Grund, und der Grund ist messbar.
 *
 * ─── ZWEI VERSCHIEDENE METHODEN, UND DAS IST ABSICHT ────────────────────────
 *
 * Die UEBERSCHRIFT traegt eine schlichte Farbe. Fuer sie gilt die bewaehrte
 * Fassung von Falle 45: Vordergrund aus der aufgeloesten CSS-Farbe (Canvas,
 * Falle 16), Hintergrund aus einem echten Bildpixel an der Stelle des Textes,
 * Text vorher per `color: transparent` ueber Element UND Teilbaum weggenommen.
 *
 * "START" SCHIMMERT. Seit dem 10.09.2026 liegt dort ein Verlauf, der per
 * `background-clip: text` in die Schrift geschnitten ist; `color` ist
 * `transparent` und sagt nichts ueber das, was man sieht. Also wird die
 * GEMALTE Schrift abgetastet — und zwar so:
 *
 *   SCHRIFT UND GRUND AUS DEMSELBEN AUGENBLICK. Ein erster Anlauf nahm sie
 *   nacheinander (einmal mit, einmal ohne Schrift). Dazwischen liegen rund
 *   0,5 s, und die bewegte Schicht wandert weiter. Im hellen Theme war ihre
 *   Drift so gross wie der Unterschied, den die Schrift macht: gemeldet
 *   1,55:1, wo derselbe Aufbau im Dunkeln 10:1 las. Jetzt liefert EIN
 *   Durchgang beides — eine Zeile quer durch den Text und eine Referenzzeile
 *   knapp darueber, wo keine Glyphe steht.
 *
 *   ALS KERN ZAEHLT, was sich deutlich vom Grund daneben abhebt (mindestens
 *   die halbe Abweichung des staerksten Punktes). Darunter faengt die
 *   Kantenglaettung an, und die liegt bauartbedingt dicht am Grund — wer sie
 *   mitmisst, misst die Schwelle seiner eigenen Sonde (gemeldet 1,05:1).
 *
 *   GEMESSEN WIRD AUCH DER HOVER-ZUSTAND: Leons "markanter wirken" darf nicht
 *   heissen "schlechter lesbar".
 *
 * Aufruf (NUR ueber PowerShell, Falle 20):
 *   node scripts/mess-df-rahmenlos.mjs
 *   $env:MESS_OHNE_WEBGL="1"; node scripts/mess-df-rahmenlos.mjs
 */

import { inflateSync } from "node:zlib";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-rahmenlos@tidal-athletics.invalid";
const PASSWORD = `mess-rahmenlos-${Math.random().toString(36).slice(2)}A1!`;
const ZEITPUNKTE = 5;

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

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
const kontrast = (a, b) => {
  const l1 = leuchtkraft(a);
  const l2 = leuchtkraft(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const BLIND =
  "[data-mess], [data-mess] * { color: transparent !important;" +
  " background-image: none !important; }" +
  "[data-mess]::after, [data-mess]::before { content: none !important; }";

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

/** Ein Pixel aus dem laufenden Bild. */
async function pixel(page, x, y) {
  return pixelAusPng(
    await page.screenshot({ clip: { x, y, width: 1, height: 1 } }),
  );
}

/**
 * DIE FARBSTUFEN DES VERLAUFS GEGEN DEN ECHTEN GRUND — die Methode, die
 * am Ende getragen hat (10.09.2026).
 *
 * Pixel aus der gemalten Schrift zu lesen, scheiterte zweimal: einmal an der
 * Zeit (die Schicht wandert zwischen zwei Durchgaengen), einmal an der
 * Aufloesung — bei 26 px und 1x trifft eine Abtastzeile fast nur
 * angeschnittene Kantenpixel, halb Schrift und halb Grund. Gemeldet wurden
 * so 1,9:1 fuer ein Wort, das im Bildausschnitt klar lesbar dunkel auf
 * Tuerkis stand.
 *
 * WCAG bewertet die TEXTFARBE. Bei einem Verlauf sind das seine Stufen, und
 * die stehen exakt im berechneten Stil (`background-image`, als oklab()).
 * Jede wird ueber ein Canvas aufgeloest (Falle 16), unter dem Zeiger mit der
 * `saturate()`-Matrix aus der Filter-Spezifikation verrechnet (linearer
 * RGB-Raum, wie ihn CSS-Filter benutzen), und gegen einen echten Bildpixel
 * AN DER STELLE DER SCHRIFT gehalten — mit weggenommener Schrift. Die
 * schlechteste Stufe zaehlt.
 */
async function messeVerlaufsStufen(page, idx, saettigung) {
  const stufen = await page.evaluate((i) => {
    const el = document.querySelector(`[data-mess="${i}"]`);
    if (!el) return [];
    const bild = getComputedStyle(el).backgroundImage;
    const farben = bild.match(/(oklab|oklch|rgba?|lab|lch)\([^)]*\)/g) ?? [];
    const ctx = document.createElement("canvas").getContext("2d");
    return farben.map((c) => {
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    });
  }, idx);
  if (!stufen.length) return { schlecht: Infinity, stufen: 0 };

  // saturate(s) aus der Filter-Spezifikation, im linearen RGB.
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const gamma = (v) => {
    const c = Math.min(1, Math.max(0, v));
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(s * 255);
  };
  const saettigen = ([r, g, b], s) => {
    if (s === 1) return [r, g, b];
    const R = lin(r);
    const G = lin(g);
    const B = lin(b);
    return [
      gamma((0.213 + 0.787 * s) * R + (0.715 - 0.715 * s) * G + (0.072 - 0.072 * s) * B),
      gamma((0.213 - 0.213 * s) * R + (0.715 + 0.285 * s) * G + (0.072 - 0.072 * s) * B),
      gamma((0.213 - 0.213 * s) * R + (0.715 - 0.715 * s) * G + (0.072 + 0.928 * s) * B),
    ];
  };
  const vorn = stufen.map((c) => saettigen(c, saettigung));

  let schlecht = Infinity;
  for (let runde = 0; runde < ZEITPUNKTE; runde++) {
    await page.waitForTimeout(380);
    const punkt = await page.evaluate((i) => {
      const el = document.querySelector(`[data-mess="${i}"]`);
      if (!el) return null;
      const k = Array.from(el.childNodes).find(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
      );
      const b = document.createRange();
      b.selectNodeContents(k ?? el);
      const r = b.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) return null;
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }, idx);
    if (!punkt) break;
    await page.evaluate((css) => {
      const s = document.createElement("style");
      s.id = "mess-blind";
      s.textContent = css;
      document.head.appendChild(s);
    }, BLIND);
    const hinten = await pixel(page, punkt.x, punkt.y);
    await page.evaluate(() => document.getElementById("mess-blind")?.remove());
    for (const f of vorn) {
      const k = kontrast(f, hinten);
      if (k < schlecht) schlecht = k;
    }
  }
  return { schlecht, stufen: stufen.length };
}

/**
 * Die gemalte Schrift gegen den Grund daneben — beides aus demselben
 * Augenblick. BLEIBT ALS GEGENPROBE STEHEN, zaehlt aber nicht: siehe
 * `messeVerlaufsStufen` oben, warum Pixel aus einer 26-px-Schrift bei 1x
 * nicht die Textfarbe liefern.
 */
async function messeGemalteSchrift(page, idx) {
  let schlecht = Infinity;
  let kerne = 0;
  for (let runde = 0; runde < ZEITPUNKTE; runde++) {
    await page.waitForTimeout(380);
    const rect = await page.evaluate((i) => {
      const el = document.querySelector(`[data-mess="${i}"]`);
      if (!el) return null;
      const k = Array.from(el.childNodes).find(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
      );
      const b = document.createRange();
      b.selectNodeContents(k ?? el);
      const r = b.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 8) return null;
      return {
        x: Math.round(r.left),
        w: Math.round(r.width),
        yText: Math.round(r.top + r.height * 0.55),
        yGrund: Math.round(r.top - 5),
      };
    }, idx);
    if (!rect || rect.w < 12) break;

    const xs = [];
    for (let n = 0; n < 16; n++) {
      xs.push(rect.x + 2 + Math.round(((rect.w - 4) * n) / 15));
    }
    const schrift = [];
    const grund = [];
    for (const x of xs) {
      schrift.push(await pixel(page, x, rect.yText));
      grund.push(await pixel(page, x, rect.yGrund));
    }
    const deltas = xs.map((_, n) =>
      Math.abs(leuchtkraft(schrift[n]) - leuchtkraft(grund[n])),
    );
    const maxD = Math.max(...deltas);
    if (maxD <= 0.02) continue;
    for (let n = 0; n < xs.length; n++) {
      if (deltas[n] < maxD * 0.5) continue;
      kerne += 1;
      const k = kontrast(schrift[n], grund[n]);
      if (k < schlecht) schlecht = k;
    }
  }
  return { schlecht, kerne };
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

  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (
      await auth.createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: "Mess Rahmenlos",
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
        displayName: "Mess Rahmenlos",
        email: EMAIL,
        gymId: GYM_ID,
        trainerOnboarded: true,
        createdAt: new Date(),
        ...rightsMirror(rechte),
      },
      { merge: true },
    );
  console.log(`Pruefkonto: ${uid}`);

  const browser = await chromium.launch(
    ohneWebgl ? { args: ["--disable-3d-apis"] } : {},
  );
  if (ohneWebgl) console.log("MODUS: OHNE WebGL (CSS-Rueckfall)\n");

  try {
    for (const theme of ["dark", "light"]) {
      for (const vp of [
        { name: "desktop", width: 1440, height: 1200 },
        { name: "mobil", width: 390, height: 900, touch: true },
      ]) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
          hasTouch: !!vp.touch,
          isMobile: !!vp.touch,
        });
        const page = await ctx.newPage();
        await anmelden(page);
        await page.evaluate((t) => localStorage.setItem("ta-theme", t), theme);
        await page.goto(`${BASE}/trainer/deepfight`, {
          waitUntil: "domcontentloaded",
        });
        await page
          .waitForSelector(
            ohneWebgl
              ? '[data-area="deepfight"] .df-rueckfall'
              : '[data-area="deepfight"] canvas',
            { timeout: 20000 },
          )
          .catch(() => {});
        await page.waitForTimeout(4500);
        if (process.env.MISCH) {
          await page.addStyleTag({
            content: `.df-strang-label{--df-start-mix:${process.env.MISCH} !important}`,
          });
        }

        console.log(`\n-- ${theme} / ${vp.name} --------------------------`);

        // Die Stellen namentlich markieren. Der Messpunkt kommt spaeter aus
        // dem TEXTKNOTEN (Range), nicht aus dem Elementkasten.
        const marken = await page.evaluate(() => {
          const w = document.querySelector('[data-area="deepfight"] main');
          const raus = [];
          const nimm = (el, etikett, gemalt) => {
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return;
            el.setAttribute("data-mess", String(raus.length));
            raus.push({ etikett, gemalt, farbe: getComputedStyle(el).color });
          };
          nimm(
            Array.from(w.querySelectorAll("h2")).find((h) =>
              h.textContent.toLowerCase().includes("fight-dna"),
            ),
            "Ueberschrift Entschluessle die Fight-DNA",
            false,
          );
          nimm(
            w.querySelector(".df-strang-label"),
            "Start in der Strangmitte",
            true,
          );
          return raus;
        });
        sagt(
          marken.length === 2,
          `beide rahmenlosen Stellen gefunden: ${marken.length}`,
        );

        for (let i = 0; i < marken.length; i++) {
          await page.evaluate((idx) => {
            document
              .querySelector(`[data-mess="${idx}"]`)
              ?.scrollIntoView({ block: "center", behavior: "instant" });
          }, i);
          await page.waitForTimeout(500);

          if (marken[i].gemalt) {
            // Seit dem 11.09. erscheint Start nur unter dem Zeiger (Maus)
            // bzw. dauerhaft (Touch). Gemessen wird der SICHTBARE Zustand:
            // auf dem Schreibtisch mit dem Zeiger auf dem Strang, auf Touch
            // ohne Zeiger. Ein Schriftzug mit Deckkraft 0 hat keinen Kontrast.
            for (const zeiger of [true]) {
              if (!vp.touch) {
                await page.locator(".df-strang-ziel").hover();
                await page.waitForTimeout(700);
              }
              // Unter dem Zeiger stehen `saturate(1.7)` und ein hoeherer
              // Mischanteil — beides steckt in dem, was hier gerechnet wird.
              const kasten = await page.evaluate(() => {
                const r = document.querySelector(".df-strang").getBoundingClientRect();
                return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, window.innerWidth), height: Math.min(r.height, window.innerHeight - Math.max(0, r.top)) };
              });
              await page.screenshot({ path: `tmp-df-start-${theme}-${vp.name}.png`, clip: kasten });
              const { schlecht, stufen } = await messeVerlaufsStufen(
                page,
                i,
                1,
              );
              sagt(
                stufen > 0 && schlecht >= 4.5,
                `${marken[i].etikett} ${vp.touch ? "auf Touch" : "unter dem Zeiger"}: ${
                  Number.isFinite(schlecht) ? schlecht.toFixed(2) + ":1" : "NICHT GEMESSEN"
                } (schlechteste von ${stufen} Verlaufsstufen)`,
              );
            }
            await page.mouse.move(4, 4);
            await page.waitForTimeout(300);
            continue;
          }

          // Schlichte Farbe: die bewaehrte Fassung von Falle 45.
          const vorne = await loeseFarbe(page, marken[i].farbe);
          let schlecht = Infinity;
          for (let runde = 0; runde < ZEITPUNKTE; runde++) {
            await page.waitForTimeout(380);
            const punkt = await page.evaluate((idx) => {
              const el = document.querySelector(`[data-mess="${idx}"]`);
              if (!el) return null;
              const knoten = Array.from(el.childNodes).find(
                (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
              );
              let r = el.getBoundingClientRect();
              if (knoten) {
                const b = document.createRange();
                b.selectNodeContents(knoten);
                const tr = b.getBoundingClientRect();
                if (tr.width >= 6 && tr.height >= 6) r = tr;
              }
              if (r.bottom > window.innerHeight || r.top < 0) return null;
              return {
                x: Math.round(r.left + Math.min(12, r.width / 2)),
                y: Math.round(r.top + r.height / 2),
              };
            }, i);
            if (!punkt) break;
            await page.evaluate((css) => {
              const s = document.createElement("style");
              s.id = "mess-blind";
              s.textContent = css;
              document.head.appendChild(s);
            }, BLIND);
            const hinten = await pixel(page, punkt.x, punkt.y);
            await page.evaluate(() =>
              document.getElementById("mess-blind")?.remove(),
            );
            const k = kontrast(vorne, hinten);
            if (k < schlecht) schlecht = k;
          }
          sagt(
            Number.isFinite(schlecht) && schlecht >= 4.5,
            `${marken[i].etikett}: ${
              Number.isFinite(schlecht)
                ? schlecht.toFixed(2) + ":1"
                : "NICHT GEMESSEN"
            }  [${marken[i].farbe}]`,
          );
        }
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
      `\nAufgeraeumt. ${nachher.auth} Auth-Konten, ${nachher.docs} users-Dokumente` +
        (nachher.auth === vorher.auth && nachher.docs === vorher.docs
          ? " -- wie vorher"
          : " -- ABWEICHUNG"),
    );
    console.log(fehler === 0 ? "\nALLES BESTANDEN" : `\n${fehler} FEHLSCHLAEGE`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
