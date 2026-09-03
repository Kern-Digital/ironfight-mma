/**
 * Oberflächen-Prüfung der Coach-Redesign-Referenzseite (/trainer).
 *
 * TEMPORÄRES PRÜFWERKZEUG dieser Etappe — legt ein Prüfkonto an, fotografiert
 * die Seite in Dark UND Light (DESIGN-BRIEF §1.3) und LÖSCHT das Konto wieder.
 * Die Löschung wird geprüft: Produktion hat 7 Auth-Konten und 7 users-Dokumente.
 *
 * Aufruf:  node scripts/ui-check-trainer.mjs [pfad ...]
 *          (ohne Argument: /trainer)
 *
 * ACHTUNG, PFADE NICHT ÜBER DIE BASH-SHELL: Git Bash macht aus „/trainer"
 * ein „C:/Program Files/Git/trainer". PowerShell nehmen.
 *
 * Schalter (alle als Umgebungsvariable):
 *   UI_CHECK_RIGHTS=trainer|verwaltung|beides|admin   Rechte des Prüfkontos
 *                                                     (Vorgabe: beides)
 *   UI_CHECK_ACCENT=1   dreht --accent-h, belegt den §5-Akzent-Test im Bild
 *   UI_CHECK_DRAWER=1   öffnet auf dem Handy die Menü-Schublade und
 *                       fotografiert sie
 *   UI_CHECK_BASE=…     andere Adresse als http://localhost:3000
 *
 * Die Bilder tragen das Rechte-Set im Namen (tmp-ui-<set>-<pfad>-…), sonst
 * überschreibt der Lauf für Zustand 2 die Bilder von Zustand 1.
 *
 * Muss IM Projektordner liegen — sonst findet Node das Playwright-Paket nicht
 * (es ist per `npm i --no-save` installiert, steht also nicht in package.json).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.UI_CHECK_BASE ?? "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const EMAIL = "ui-check-trainer@tidal-athletics.invalid";
const PASSWORD = `ui-check-${Math.random().toString(36).slice(2)}A1!`;
const PATHS = process.argv.slice(2).length ? process.argv.slice(2) : ["/trainer"];

/**
 * WELCHES RECHTE-SET das Prüfkonto bekommt — die drei Zustände der
 * Sidebar-Etappe. Bis zum 01.09.2026 stand das Set als Konstante im Code und
 * musste vor jedem Lauf von Hand umgeschrieben werden; damit war nicht mehr
 * nachvollziehbar, welches Bild zu welchem Zustand gehört.
 *
 *   UI_CHECK_RIGHTS=trainer      nur Trainer-Werkzeuge
 *   UI_CHECK_RIGHTS=verwaltung   ZUSTAND 2 — reine Verwaltung, KEIN Trainer
 *   UI_CHECK_RIGHTS=beides       ZUSTAND 1 (Vorgabe) — Trainer + Verwaltung
 *   UI_CHECK_RIGHTS=admin        ZUSTAND 3 — Plattform-Rang
 *
 * Der Plattform-Rang steht bewusst ALLEIN und nicht neben den anderen beiden:
 * `effectiveRights` rechnet ihn ohnehin ein (lib/roles.ts), und ein Konto mit
 * allen drei gesetzten Häkchen wäre kein Zustand, den die Rollen-API je
 * erzeugen kann.
 */
const RIGHT_SETS = {
  trainer: { trainer: true, verwaltung: false, admin: false },
  verwaltung: { trainer: false, verwaltung: true, admin: false },
  beides: { trainer: true, verwaltung: true, admin: false },
  admin: { trainer: false, verwaltung: false, admin: true },
};
const RIGHTS_KEY = process.env.UI_CHECK_RIGHTS ?? "beides";
const RIGHTS = RIGHT_SETS[RIGHTS_KEY];
if (!RIGHTS) {
  console.error(
    `Unbekanntes UI_CHECK_RIGHTS="${RIGHTS_KEY}" — erlaubt: ${Object.keys(RIGHT_SETS).join(", ")}`,
  );
  process.exit(1);
}
// Mobile-First (DESIGN-BRIEF §1.8): jede Seite wird in BEIDEN Breiten geprüft.
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "mobil", width: 390, height: 900 },
];

function envLocal(key) {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0 && t.slice(0, eq).trim() === key) return t.slice(eq + 1).trim();
  }
  return null;
}

async function counts(auth, db) {
  const users = await auth.listUsers(1000);
  const docs = await db.collection("users").get();
  return { auth: users.users.length, docs: docs.size };
}

async function main() {
  const { source, projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} (Credentials aus ${source})`);
  console.log(`Rechte-Set: ${RIGHTS_KEY} → ${JSON.stringify(RIGHTS)}`);
  const auth = getAuth();
  const db = getFirestore();

  const before = await counts(auth, db);
  console.log(`Vorher: ${before.auth} Auth-Konten, ${before.docs} users-Dokumente`);

  // Altlast aus einem abgebrochenen Lauf einsammeln
  let uid = null;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
    console.log(`Prüfkonto existierte schon: ${uid} (Passwort neu gesetzt)`);
  } catch {
    const created = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: "UI-Check Trainer",
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`Prüfkonto angelegt: ${uid}`);
  }

  const rights = RIGHTS;
  await auth.setCustomUserClaims(
    uid,
    claimsWithRights({ gymId: GYM_ID }, rights),
  );
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        displayName: "UI-Check Trainer",
        email: EMAIL,
        gymId: GYM_ID,
        // Ohne diese Marke legt sich das Trainer-Onboarding über die Seite
        trainerOnboarded: true,
        ...rightsMirror(rights),
      },
      { merge: true },
    );

  const browser = await chromium.launch();
  try {
    for (const theme of ["dark", "light"]) {
     for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: vp.name === "mobil",
        hasTouch: vp.name === "mobil",
      });
      const page = await ctx.newPage();
      page.on("console", (m) => {
        if (m.type() === "error") console.log(`  [console] ${m.text()}`);
      });

      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      // Erst NACH der Hydration tippen — sonst frisst React die Eingabe.
      // Niemals waitUntil:"networkidle": Firestore hält die Verbindung offen.
      await page.waitForTimeout(2000);
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 30000 });
      await page.waitForTimeout(1500);

      // Theme setzen: lib/theme-context speichert die Wahl im localStorage
      await page.evaluate((t) => {
        localStorage.setItem("ta-theme", t);
      }, theme);

      for (const path of PATHS) {
        // Abnahme-Test 5: EINE Variable aendern -> die ganze Seite folgt.
        // Laeuft nur im dunklen Desktop-Durchgang, ein Bild reicht als Beleg.
        if (process.env.UI_CHECK_ACCENT && theme === "dark" && vp.name === "desktop") {
          await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(3000);
          await page.evaluate(() => {
            document.documentElement.style.setProperty("--accent-h", "28");
            document.documentElement.style.setProperty("--accent-c", "0.16");
          });
          await page.waitForTimeout(400);
          const slugA = `${RIGHTS_KEY}-${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root"}`;
          await page.screenshot({ path: `tmp-ui-${slugA}-akzenttest.png`, fullPage: true });
          console.log(`akzenttest ${path} -> tmp-ui-${slugA}-akzenttest.png`);
        }
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        const slug = `${RIGHTS_KEY}-${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root"}`;

        // Menü-Schublade der Stab-Hülle (nur Handy): Der Knopf sitzt in der
        // Bottom-Bar. Kein fullPage-Bild — die Schublade ist am Viewport
        // festgemacht, ein fullPage-Schuss würde sie an den Seitenanfang
        // rechnen und dazwischen leere Seite zeigen.
        if (process.env.UI_CHECK_DRAWER && vp.name === "mobil") {
          const opener = page.getByRole("button", { name: "Menü öffnen" });
          if (await opener.count()) {
            await opener.first().click();
            await page.waitForTimeout(600);
            const dfile = `tmp-ui-${slug}-${theme}-schublade.png`;
            await page.screenshot({ path: dfile });
            console.log(`schublade ${path} → ${dfile}`);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(400);
          } else {
            console.log(`schublade ${path} → KEIN Menü-Knopf gefunden`);
          }
        }
        const file = `tmp-ui-${slug}-${theme}-${vp.name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        const applied = await page.evaluate(() => {
          const de = document.documentElement;
          // Überlauf-Suche: welche Elemente ragen über den Viewport hinaus?
          const vw = de.clientWidth;
          const over = [];
          // Falsche Alarme aussortieren: Ambient-Ebenen ragen absichtlich
          // hinaus (inset -22%) und werden geclippt, waagerechte Scroller
          // (Bereichs-Leiste) ebenso.
          const clipped = (el) => {
            for (let n = el; n; n = n.parentElement) {
              if (n.hasAttribute?.("data-ambient")) return true;
              const s = getComputedStyle(n);
              if (s.overflowX === "auto" || s.overflowX === "scroll") return true;
              if (s.overflow === "hidden" || s.overflowX === "hidden") return true;
            }
            return false;
          };
          for (const el of Array.from(document.querySelectorAll("main *"))) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > vw + 0.5 && !clipped(el)) {
              over.push(
                `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 26)} r=${Math.round(r.right)} w=${Math.round(r.width)}`,
              );
            }
          }
          const h = document.querySelector("h1");
          return {
            theme: de.getAttribute("data-theme"),
            page: getComputedStyle(document.body).backgroundColor,
            h1: h ? getComputedStyle(h).font : null,
            h1w: h ? Math.round(h.getBoundingClientRect().width) : null,
            scroll: `${de.scrollWidth}/${vw}`,
            over: over.slice(0, 6),
          };
        });
        console.log(`${theme}/${vp.name} ${path} → ${file}`);
        console.log(`   data-theme=${applied.theme} bg=${applied.page}`);
        console.log(`   h1 font=${applied.h1} breite=${applied.h1w}px`);
        console.log(`   scrollWidth/clientWidth=${applied.scroll}` + (applied.over.length ? ` ÜBERLAUF: ${applied.over.join(" | ")}` : " kein Überlauf"));
      }
      await ctx.close();
     }
    }
  } finally {
    await browser.close();
    await db.collection("users").doc(uid).delete();
    await auth.deleteUser(uid);
    const after = await counts(auth, db);
    console.log(
      `Aufgeräumt. Nachher: ${after.auth} Auth-Konten, ${after.docs} users-Dokumente` +
        (after.auth === before.auth && after.docs === before.docs
          ? " ✓ wie vorher"
          : " ✗ ABWEICHUNG"),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
