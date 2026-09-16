/**
 * TEMPORAER: Kommen die fuenf Demo-Analysen an? Nach der Abnahme LOESCHEN.
 *
 * ZWEI TEILE, UND DIE TRENNUNG IST ABSICHT:
 *
 * 1. **Datenprobe per Admin-SDK.** Liegen die fuenf Dokumente an den richtigen
 *    Pfaden, mit dem richtigen `createdBy`, und ist die Struktur vollstaendig?
 *    Das ist der Teil, der beweist, dass Meine Analysen sie zeigen WIRD --
 *    diese Liste filtert auf `createdBy == eigene uid`.
 *
 * 2. **Darstellungsprobe im Browser, mit einem EIGENEN Pruefkonto.**
 *    Ich melde mich NICHT an Leons Konto an: Dafuer muesste ich sein Passwort
 *    setzen, und ein Konto, dessen Passwort niemand mehr kennt, waere ein
 *    schlechter Tausch fuer eine gruene Zeile im Bericht. Was ein fremdes
 *    Konto sehen kann, reicht fuer den Beweis: Die SUCHE geht ueber alle
 *    sichtbaren Analysen (nicht nur die eigenen), und der Ergebnisbericht
 *    rendert unabhaengig davon, wer sie angelegt hat. Damit ist gepruefte
 *    Sache, dass der Faecher sie findet und die Struktur den Bericht traegt.
 *    Nur die Zahl am Knopf Meine Analysen sieht Leon selbst -- sie folgt aus
 *    Teil 1.
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = "http://localhost:3000";
const GYM_ID = "tidal-athletics";
const MAIL = "noelreichle@gmail.com";
const GEGNER_ID = "BZdtaypdo5BlPtnqJ6lt";
const PRUEF_MAIL = "mess-analysen@tidal-athletics.invalid";
const PRUEF_PW = `mess-analysen-${Math.random().toString(36).slice(2)}A1!`;

let fehler = 0;
const sagt = (ok, t) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${t}`);
};

const { projectId } = initAdmin();
console.log(`Admin-SDK: ${projectId}`);
const auth = getAuth();
const db = getFirestore();

// ─── Teil 1: die Daten ──────────────────────────────────────────────────────
console.log("\n== Teil 1: die Dokumente ==");
const konto = await auth.getUserByEmail(MAIL);
const erwartet = [
  { id: "demo-analyse-01", pfad: ["opponents", GEGNER_ID] },
  { id: "demo-analyse-02", pfad: ["opponents", GEGNER_ID] },
  { id: "demo-analyse-03", pfad: ["users", "demo-001"] },
  { id: "demo-analyse-04", pfad: ["users", "demo-002"] },
  { id: "demo-analyse-05", pfad: ["users", konto.uid] },
];

let gefunden = 0;
for (const e of erwartet) {
  const snap = await db
    .collection(e.pfad[0])
    .doc(e.pfad[1])
    .collection("videoAnalyses")
    .doc(e.id)
    .get();
  if (!snap.exists) {
    sagt(false, `${e.id} fehlt unter ${e.pfad.join("/")}`);
    continue;
  }
  const d = snap.data();
  const vollstaendig =
    d.createdBy === konto.uid &&
    typeof d.evaluation?.summary === "string" &&
    d.evaluation.summary.length > 60 &&
    Array.isArray(d.evaluation.findings) &&
    d.evaluation.findings.length >= 4 &&
    Array.isArray(d.evaluation.topWeapons) &&
    d.evaluation.topWeapons.length >= 1 &&
    Array.isArray(d.observation?.actions) &&
    d.observation.actions.length >= 4 &&
    d.observation.controlTime !== null &&
    d.observation.rounds.length >= 2 &&
    typeof d.evaluation.scores?.fightIq === "number" &&
    d.createdAt !== undefined;
  sagt(
    vollstaendig,
    `${e.id}: ${d.targetName} (${d.mode}) — ${d.evaluation.findings.length} Befunde, ${d.observation.actions.length} Aktionen, createdBy ${d.createdBy === konto.uid ? "stimmt" : "FALSCH"}`,
  );
  if (vollstaendig) gefunden += 1;
}
sagt(gefunden === 5, `alle fuenf vollstaendig: ${gefunden}/5`);

// Gegenprobe: keine FREMDE Analyse ist dabei kaputtgegangen.
const alleBeimGegner = await db
  .collection("opponents")
  .doc(GEGNER_ID)
  .collection("videoAnalyses")
  .get();
const echte = alleBeimGegner.docs.filter((d) => d.data().isDemo !== true);
sagt(echte.length === 1, `die echte Analyse bei Paul the Fighter steht unberuehrt da (${echte.length})`);

// ─── Teil 2: die Darstellung ────────────────────────────────────────────────
console.log("\n== Teil 2: die Darstellung (eigenes Pruefkonto) ==");
let uid;
try {
  uid = (await auth.getUserByEmail(PRUEF_MAIL)).uid;
  await auth.updateUser(uid, { password: PRUEF_PW });
} catch {
  uid = (
    await auth.createUser({
      email: PRUEF_MAIL,
      password: PRUEF_PW,
      displayName: "Mess Analysen",
      emailVerified: true,
    })
  ).uid;
}
const rechte = { trainer: true, verwaltung: false, admin: false };
await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
await db.collection("users").doc(uid).set(
  {
    displayName: "Mess Analysen",
    email: PRUEF_MAIL,
    gymId: GYM_ID,
    trainerOnboarded: true,
    createdAt: new Date(),
    ...rightsMirror(rechte),
  },
  { merge: true },
);

/**
 * EINE EIGENE ANALYSE FUER DAS PRUEFKONTO.
 *
 * „Meine Analysen" filtert auf `createdBy` — mit fremden Analysen bleibt die
 * Kartei leer, und Leons neuer Weg (Kachel antippen → Fenster mit dieser
 * Analyse vorgewaehlt → noch einmal antippen → hinein) waere ungeprueft.
 * Statt Daten zu erfinden wird eine der fuenf KOPIERT und nur `createdBy`
 * getauscht: So ist die Struktur garantiert dieselbe wie im Ernstfall.
 * Am Ende faellt sie wieder weg (finally).
 */
const EIGENE_ID = "mess-eigene-01";
const eigeneRef = db
  .collection("users")
  .doc("demo-003")
  .collection("videoAnalyses")
  .doc(EIGENE_ID);
{
  const vorlage = await db
    .collection("users")
    .doc("demo-001")
    .collection("videoAnalyses")
    .doc("demo-analyse-03")
    .get();
  await eigeneRef.set({
    ...vorlage.data(),
    isDemo: true,
    targetId: "demo-003",
    targetName: "Romy Wagner",
    sourceLabel: "romy-sparring-kw37.mp4",
    createdBy: uid,
    createdByName: "Mess Analysen",
  });
  console.log(`  Pruef-Analyse ${EIGENE_ID} angelegt (createdBy = Pruefkonto)`);
}
// EINE ZWEITE, damit „die anderen dimmen" ueberhaupt pruefbar ist — mit
// einer einzigen Zeile gibt es keine anderen (Leons Befund 10.09.: die
// gewaehlte Zeile blieb so dunkel wie der Rest).
const zweiteRef = db
  .collection("users")
  .doc("demo-004")
  .collection("videoAnalyses")
  .doc("mess-eigene-02");
{
  const vorlage = await eigeneRef.get();
  await zweiteRef.set({
    ...vorlage.data(),
    targetId: "demo-004",
    targetName: "Jakob Krause",
    sourceLabel: "jakob-sparring-kw37.mp4",
  });
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  const konsole = [];
  page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', PRUEF_MAIL);
  await page.fill('input[type="password"]', PRUEF_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/trainer/deepfight`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-area="deepfight"] canvas', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(6500);

  // ── Leons neuer Weg in die Liste (10.09.) ───────────────────────────────
  // Die Ueberschrift ist KEIN Knopf mehr; hinein geht es ueber die Kacheln.
  const kopfIstKnopf = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-area="deepfight"] main button'))
      .some((b) => b.textContent.trim().toLowerCase().startsWith("meine analysen")),
  );
  sagt(!kopfIstKnopf, "die Ueberschrift Meine Analysen ist kein Knopf");

  // ── Bereit fürs Profil (Leon 10.09.) ────────────────────────────────────
  // Die eigene Pruef-Analyse ist nicht uebernommen — also gehoert sie hierher.
  const bereit = await page.evaluate(() => {
    const h = Array.from(
      document.querySelectorAll('[data-area="deepfight"] main h2'),
    ).find((e) => e.textContent.toLowerCase().includes("bereit fürs profil"));
    if (!h) return null;
    const feld = h.closest("section");
    return {
      text: feld.textContent.replace(/\s+/g, " ").trim().slice(0, 160),
      links: Array.from(feld.querySelectorAll("a")).map((a) => a.getAttribute("href")),
      ueberMeine:
        feld.getBoundingClientRect().bottom <=
        (Array.from(document.querySelectorAll('[data-area="deepfight"] main h2'))
          .find((e) => e.textContent.toLowerCase().startsWith("meine analysen"))
          ?.getBoundingClientRect().top ?? 0) + 1,
    };
  });
  sagt(bereit !== null, "das Feld Bereit fuers Profil erscheint bei einer offenen Analyse");
  if (bereit) {
    console.log(`  ${bereit.text}`);
    sagt(
      bereit.links.some((h) => h.includes(EIGENE_ID)),
      "es fuehrt direkt in die offene Analyse",
    );
    sagt(bereit.ueberMeine, "es steht ueber Meine Analysen");
  }

  // ── Die Kartei: kein Rahmen, und das Dimmen unter dem Zeiger ─────────────
  const zeile = page.locator('[data-area="deepfight"] main .df-kartei-zeile').first();
  const rahmen = await zeile.evaluate((el) => {
    const s = getComputedStyle(el);
    return { rand: s.borderTopColor, flaeche: s.backgroundColor };
  });
  sagt(
    /rgba\(0, 0, 0, 0\)|transparent/.test(rahmen.rand) &&
      /rgba\(0, 0, 0, 0\)|transparent/.test(rahmen.flaeche),
    `Kartei-Zeilen tragen keinen Rahmen und keine Flaeche: ${rahmen.rand} / ${rahmen.flaeche}`,
  );

  // ── Das Hervorheben: die gewaehlte HELL, die anderen gedimmt ─────────────
  // Gemessen am aufgeloesten Stil jeder Zeile, NACHDEM die Uebergaenge
  // durch sind (--dur-med = 220 ms).
  await page
    .locator('[data-area="deepfight"] main .df-kartei-zeile')
    .filter({ hasText: "Romy Wagner" })
    .first()
    .hover();
  await page.waitForTimeout(600);
  const dimmen = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-area="deepfight"] main .df-kartei-zeile')).map(
      (z) => ({
        name: z.textContent.trim().slice(0, 14),
        deckkraft: Number(getComputedStyle(z).opacity),
      }),
    ),
  );
  console.log(`  Deckkraft unter dem Zeiger: ${JSON.stringify(dimmen)}`);
  const gewaehlt = dimmen.find((d) => d.name.startsWith("Romy"));
  const andere = dimmen.filter((d) => !d.name.startsWith("Romy"));
  sagt(
    gewaehlt?.deckkraft === 1,
    `die gewaehlte Zeile steht voll da: ${gewaehlt?.deckkraft}`,
  );
  sagt(
    andere.length > 0 && andere.every((d) => d.deckkraft < 0.6),
    `die anderen sind gedimmt: ${andere.map((d) => d.deckkraft).join(", ")}`,
  );
  await page.mouse.move(4, 4);
  await page.waitForTimeout(400);

  const kartei = page
    .locator('[data-area="deepfight"] main .df-kartei-zeile')
    .filter({ hasText: "Romy Wagner" })
    .first();
  sagt((await kartei.count()) > 0, "die Kachel der eigenen Analyse steht da");
  await kartei.click();
  await page.waitForTimeout(1200);

  const sheet = await page.evaluate(() => {
    const zeilen = Array.from(
      document.querySelectorAll('a[href*="/trainer/deepfight/analyse?"]'),
    );
    const markiert = zeilen.filter((a) => a.getAttribute("aria-current") === "true");
    return {
      offen: zeilen.length > 0,
      anzahl: zeilen.length,
      markiert: markiert.length,
      markiertText: markiert[0]?.textContent.replace(/\s+/g, " ").trim().slice(0, 40) ?? null,
      href: markiert[0]?.getAttribute("href") ?? null,
    };
  });
  sagt(sheet.offen, `ein Tipp auf die Kachel oeffnet das Fenster (${sheet.anzahl} Zeilen)`);

  // DAS FENSTER MUSS ALS FENSTER DASTEHEN (Leons Screenshot 10.09.: Zeilen
  // unten links, ohne Flaeche, abgeschnitten). Gemessen wird das Panel
  // selbst: deckende Flaeche, mittig, vollstaendig im Bild.
  const panel = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][aria-label="Meine Analysen"]');
    const p = dlg?.querySelector(":scope > div");
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return {
      flaeche: getComputedStyle(p).backgroundColor,
      links: Math.round(r.left),
      rechts: Math.round(window.innerWidth - r.right),
      unten: Math.round(window.innerHeight - r.bottom),
      oben: Math.round(r.top),
      breite: Math.round(r.width),
    };
  });
  if (panel) {
    console.log(`  Fenster: ${JSON.stringify(panel)}`);
    sagt(
      !/rgba\(0, 0, 0, 0\)|transparent/.test(panel.flaeche),
      `das Fenster hat eine deckende Flaeche: ${panel.flaeche}`,
    );
    sagt(
      Math.abs(panel.links - panel.rechts) <= 2,
      `es steht waagerecht mittig (links ${panel.links} / rechts ${panel.rechts})`,
    );
    // Leon 10.09.: „zentriert" heisst auch SENKRECHT — vorher klebte es an
    // der Unterkante (oben ~1040 px, unten 0).
    sagt(
      Math.abs(panel.oben - panel.unten) <= 2,
      `und senkrecht mittig (oben ${panel.oben} / unten ${panel.unten})`,
    );
    sagt(panel.oben >= 0 && panel.unten >= -1, "es steht vollstaendig im Bild");
  } else {
    sagt(false, "das Fenster-Panel wurde nicht gefunden");
  }
  await page.screenshot({ path: "tmp-df-popup.png" });
  sagt(sheet.markiert === 1, `genau eine Zeile ist vorgewaehlt (${sheet.markiert})`);
  sagt(
    (sheet.markiertText ?? "").includes("Romy"),
    `und zwar die angetippte: ${sheet.markiertText}`,
  );
  if (sheet.href) {
    await page.goto(`${BASE}${sheet.href}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    sagt(
      page.url().includes(EIGENE_ID),
      `der zweite Tipp fuehrt in genau diese Analyse: ${page.url().split("&analyse=")[1] ?? "?"}`,
    );
    await page.goto(`${BASE}/trainer/deepfight`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
  }

  // Die Suche geht ueber ALLE sichtbaren Analysen -- also auch ueber fremde.
  await page.locator('[data-area="deepfight"] main .goo-pill').first().click();
  await page.waitForTimeout(600);
  await page.keyboard.type("Mira");
  await page.waitForTimeout(2000);
  const treffer = await page.evaluate(() => {
    const w = document.querySelector('[data-area="deepfight"] main');
    return {
      gruppen: Array.from(w.querySelectorAll(".t-label")).map((e) =>
        e.textContent.trim().toLowerCase(),
      ),
      analyse: Array.from(w.querySelectorAll('a[href*="analyse="]')).map((a) =>
        a.getAttribute("href"),
      ),
      ahnen: Array.from(w.querySelectorAll('a[href*="analyse="]')).map((a) => {
        const kette = []; for (let n = a; n && n !== w; n = n.parentElement) kette.push(n.tagName.toLowerCase() + (n.className ? "." + String(n.className).split(" ").slice(0,2).join(".") : ""));
        return kette.slice(0, 6).join(" < ");
      }),
      wo: Array.from(w.querySelectorAll('a[href*="analyse="]')).map((a) => {
        const r = a.getBoundingClientRect();
        return `${a.getAttribute("href").slice(-18)} y=${Math.round(r.top)} h=${Math.round(r.height)} vis=${getComputedStyle(a).visibility}`;
      }),
    };
  });
  sagt(
    treffer.analyse.length > 0,
    `die Suche findet die Analyse zu Mira (${treffer.analyse.length} Treffer) — der Faecher liest sie also`,
  );
  console.log("  Gruppen:", JSON.stringify(treffer.gruppen));
  console.log("  Links:", JSON.stringify(treffer.analyse));
  console.log("  Wo:", JSON.stringify(treffer.wo, null, 1));
  console.log("  Ahnen:", JSON.stringify(treffer.ahnen, null, 1));

  // Der Ergebnisbericht
  const ziel = treffer.analyse.find((h) => h.includes("demo-analyse-04")) ?? treffer.analyse[0];
  console.log("  gewaehlt:", ziel);
  if (ziel) {
    await page.goto(`${BASE}${ziel}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(11000);
    const b = await page.evaluate(() => {
      const t = document.querySelector('[data-area="deepfight"] main')?.innerText ?? "";
      console.log("BERICHT-ANFANG:", t.slice(0, 600));
      return {
        laenge: t.length,
        stil: /suedpfot|kickbox/i.test(t),
        waffen: /low kick|high kick/i.test(t),
        scores: /cardio|aggression|fight/i.test(t),
      };
    });
    sagt(b.laenge > 900, `der Bericht traegt Text (${b.laenge} Zeichen)`);
    sagt(b.stil, "die Stil-Einschaetzung steht drin");
    sagt(b.waffen, "die Top-Waffen stehen drin");
    sagt(b.scores, "die Scores stehen drin");
    await page.screenshot({ path: "tmp-df-bericht.png", fullPage: true });
  }

  sagt(konsole.length === 0, `Konsole: ${konsole.length} Fehler`);
  if (konsole.length) console.log("    " + konsole.slice(0, 3).join("\n    "));
  await ctx.close();
} finally {
  await browser.close();
  await eigeneRef.delete();
  await zweiteRef.delete();
  await db.collection("users").doc(uid).delete();
  await auth.deleteUser(uid).catch(() => {});
  console.log(fehler === 0 ? "\nALLES BESTANDEN" : `\n${fehler} FEHLSCHLAEGE`);
}
