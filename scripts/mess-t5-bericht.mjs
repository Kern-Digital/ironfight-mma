/**
 * TEILSCHRITT 5 / REDESIGN-ETAPPE 3c — VideoAnalysisResult im Token-Look.
 *
 *   node scripts/mess-t5-bericht.mjs
 *   BASE=http://localhost:3000 THEME=light node scripts/mess-t5-bericht.mjs
 *
 * EIGENE PRÜFKONTO-KENNUNG (mess-t5@…, Falle 50): Das Konto von
 * ui-check-trainer.mjs ist zwischen allen Fenstern geteilt; ein paralleler
 * Lauf löschte es mitten in der Messung. Ebenso ein EIGENES Gegnerprofil —
 * „Paul the Fighter" (BZdtaypdo5BlPtnqJ6lt) ist echte Leon-Datenlage und wird
 * hier NICHT angefasst, schon gar nicht seine DNA (die bräuchte es für den
 * Konflikt-Zustand).
 *
 * Gemessen werden die drei Zustände des neuen Fußes — offen, nur-Konflikte,
 * fertig — plus die harten Regeln des Bereichs. Beide Aufrufer: die Werkbank
 * (Glas, data-area="deepfight") UND /kampfprofil (deckende Karte, KEIN
 * data-area) — was hier gilt, muss dort ebenso tragen.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { inflateSync } from "node:zlib";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const GYM_ID = "tidal-athletics";
const EMAIL = "mess-t5@tidal-athletics.invalid";
const PASSWORD = `mess-t5-${Math.random().toString(36).slice(2)}A1!`;
const GEGNER = "mess-t5-gegner";

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

// ─── Daten ──────────────────────────────────────────────────────────────────

const FRAGE_A = "real-habits_repeats";
const FRAGE_B = "real-habits_after-hit";
const FRAGE_C = "entry-patterns_start";

const befund = (questionId, categoryId, answer, confidence) => ({
  questionId,
  categoryId,
  answer,
  confidence,
  evidence: ["01:12", "02:40"],
});

/**
 * Drei Analysen, drei Zustände des Fußes:
 *   offen      — nichts übernommen, kein Konflikt  → kein Fuß, Knopf oben
 *   konflikte  — Stats drin, ein Befund widerspricht → amber Fuß
 *   fertig     — alles drin, kein Konflikt           → grüner Fuß + Weg
 */
function analyseDoc(uid, id, zustand) {
  const alleIds = [FRAGE_A, FRAGE_B, FRAGE_C];
  const appliedFindingIds =
    zustand === "offen" ? [] : zustand === "konflikte" ? [FRAGE_A, FRAGE_B] : alleIds;
  return {
    mode: "opponent",
    targetId: GEGNER,
    targetName: "Mess T5 Gegner",
    sourceLabel: `Messvideo ${id}`,
    sourceKind: "upload",
    youtubeUrl: null,
    fighter: { name: "Mess T5 Gegner", description: "blaue Hose" },
    tier: "flash",
    recency: "unknown",
    models: { gemini: "mess", claude: "mess" },
    usage: null,
    observation: {
      identification: {
        // „fertig" bekommt eine sichere Identifikation, „offen" eine unsichere
        // — so stehen beide Gesichter des Identifikations-Kopfes im Bild.
        description: "Kämpfer in der blauen Hose, roter Ecke, durchgehend sichtbar.",
        idConfidence: zustand === "offen" ? 0.52 : 0.91,
        evidence: ["00:04", "01:30"],
      },
      meta: {
        ruleset: "MMA Amateur",
        rounds: 3,
        roundLengthMinutes: 3,
        weightClass: "-77 kg",
        result: "Sieg nach Punkten",
        opponentLevel: "regional",
        coverage: "kompletter Kampf",
        videoQuality: "gut",
        estimatedAge: null,
        representativeness: null,
      },
      actions: [
        {
          id: "other",
          otherLabel: "Spinning Back Kick",
          attempted: 6,
          landed: 2,
          zone: "center",
          setup: "nach Jab-Feint",
          damage: 2,
          timestamps: ["01:12", "02:40", "04:05"],
        },
      ],
      dnaSplit: { striking: 55, wrestling: 25, ground: 20 },
      combos: [
        {
          sequence: ["other"],
          count: 4,
          landedFully: 2,
          openingAfter: "linke Seite offen",
        },
      ],
      defense: {
        takedownsDefended: 3,
        takedownsAgainst: 5,
        strikesAvoided: null,
        strikesAgainst: null,
        hitLocations: { head: 12, body: 7, legs: 4 },
        knockdownsReceived: 1,
        rockedMoments: [{ timestamp: "04:52", note: "kurz wackelig" }],
      },
      controlTime: {
        clinchSeconds: 62,
        topSeconds: 40,
        bottomSeconds: 12,
        cagePressureSeconds: 88,
        pressedSeconds: null,
      },
      movement: {
        stance: "orthodox",
        stanceSwitches: "selten",
        forwardPct: 62,
        backwardPct: 18,
        lateralPct: 20,
        centerControlPct: 58,
      },
      rounds: [
        { round: 1, outputPerMin: 14, hitRate: 0.42, strategy: "Distanz halten", fatigueSigns: null },
        { round: 3, outputPerMin: 9, hitRate: 0.3, strategy: "Clinch suchen", fatigueSigns: "Hände tief" },
      ],
      notes: "Corner ruft viel, Kämpfer reagiert spät.",
    },
    evaluation: {
      summary:
        "Druckvoller Striker mit sauberem Jab, der unter Müdigkeit die Hände senkt und in den Clinch flüchtet.",
      style: { primaryStyle: "Pressure-Striker", approach: "vorwärts", baseDiscipline: "Kickboxen" },
      findings: [
        befund(FRAGE_A, "real-habits", "Setzt nach jedem Treffer sofort nach.", 0.86),
        befund(FRAGE_B, "real-habits", "Geht einen Schritt zurück und resettet.", 0.55),
        befund(FRAGE_C, "entry-patterns", "Eröffnet fast immer mit dem Low Kick.", 0.34),
      ],
      scores: {
        aggression: 78,
        cageControl: 61,
        cardio: 44,
        damage: 70,
        durability: 55,
        fightIq: 62,
        predictability: 73,
      },
      topWeapons: [{ title: "Low Kick", reason: "führt fast jede Serie an", confidence: 0.82 }],
      topPatterns: [{ title: "Jab-Cross-Low", reason: "viermal identisch", confidence: 0.71 }],
      topWeaknesses: [{ title: "Hände tief ab R3", reason: "Müdigkeit", confidence: 0.64 }],
      topDangers: [{ title: "Clinch an der Cage", reason: "dort seine Knie", confidence: 0.58 }],
      dangerProfile: {
        mostDangerousWhen: "direkt nach eigenem Treffer",
        finishes: "Knie im Clinch",
        vulnerableWhen: "in der dritten Runde",
      },
      actionStats: [
        { id: "low-kick", attempted: 18, landed: 11, zone: "center", setup: "nach Jab" },
      ],
      dnaSplit: { striking: 55, wrestling: 25, ground: 20 },
      merge: {
        confirms: [FRAGE_A],
        contradicts: [
          { questionId: FRAGE_C, existing: "Eröffnet mit dem Jab.", observed: "Eröffnet fast immer mit dem Low Kick." },
        ],
        weight: 0.7,
      },
    },
    appliedFindingIds,
    appliedStats: zustand !== "offen",
    createdBy: uid,
    createdByName: "Mess T5",
    // Je Zustand ein eigener Zeitpunkt — sonst ist die Reihenfolge der Liste
    // beliebig und der Lauf klappt jedes Mal eine andere Zeile auf.
    createdAt: Timestamp.fromMillis(
      Date.now() - ["offen", "konflikte", "fertig"].indexOf(zustand) * 3600000,
    ),
    mess: true,
  };
}

// ─── Messwerkzeuge ──────────────────────────────────────────────────────────

/**
 * KONTRAST ÜBER BEWEGTEM GRUND (Falle 45). Der Vordergrund kommt aus der
 * aufgelösten CSS-Farbe, der Hintergrund aus einem echten Bildpixel AN DER
 * STELLE DES TEXTES. Zum Freilegen wird der Text TRANSPARENT geschaltet —
 * nicht `visibility:hidden` (das nähme die Fläche mit) — und zwar im ganzen
 * TEILBAUM, weil Icons mit `currentColor` genau dort malen.
 */
const MESS_CSS = "[data-mess], [data-mess] * { color: transparent !important; }";

function leuchtkraft([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function verhaeltnis(a, b) {
  const [h, d] = [leuchtkraft(a), leuchtkraft(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
}

/**
 * PNG aus Playwright entpacken — samt ZEILENFILTERN. Ohne Fremdbibliothek.
 *
 * Der erste Anlauf las das Byte direkt hinter dem Filter-Byte und rechnete
 * mit `page.screenshot({clip})`. Beides war falsch: `clip` liegt in einem
 * anderen Koordinatenraum als `boundingBox()`, und PNG-Zeilen sind fast nie
 * ungefiltert. Im DUNKLEN fiel das nicht auf — ein falsches Pixel ist dort
 * auch dunkel, und 18,75:1 sah gesund aus. Erst das helle Theme zeigte mit
 * 1,19:1, dass gar nicht die gemeinte Stelle gemessen wurde.
 * Merke: Eine Zahl, die im einen Theme plausibel ist, belegt die METHODE nicht.
 */
function pngEntpacken(puffer) {
  let i = 8;
  let breite = 0;
  let hoehe = 0;
  let farbtyp = 6;
  const teile = [];
  while (i < puffer.length) {
    const laenge = puffer.readUInt32BE(i);
    const typ = puffer.toString("ascii", i + 4, i + 8);
    if (typ === "IHDR") {
      breite = puffer.readUInt32BE(i + 8);
      hoehe = puffer.readUInt32BE(i + 12);
      farbtyp = puffer[i + 17];
    }
    if (typ === "IDAT") teile.push(puffer.subarray(i + 8, i + 8 + laenge));
    i += laenge + 12;
  }
  const roh = inflateSync(Buffer.concat(teile));
  /* PLAYWRIGHT LIEFERT RGB (Farbtyp 2), NICHT RGBA. Mit fest angenommenen
     vier Bytes je Pixel steht die Zeilenlänge falsch, der Unfilter läuft
     schief und heraus kommt Schwarz — im dunklen Theme sah das mit 18,75:1
     sogar richtig aus. Deshalb: Farbtyp lesen, nicht raten. */
  const bpp = farbtyp === 2 ? 3 : farbtyp === 6 ? 4 : 1;
  const stride = breite * bpp;
  const bild = Buffer.alloc(stride * hoehe);
  let q = 0;
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[q++];
    const zeile = roh.subarray(q, q + stride);
    q += stride;
    const aus = bild.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? aus[x - bpp] : 0;
      const b = y > 0 ? bild[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? bild[(y - 1) * stride + x - bpp] : 0;
      let v = zeile[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      aus[x] = v & 0xff;
    }
  }
  return { breite, hoehe, bild, bpp };
}

/**
 * Der Grund AN DER STELLE DES TEXTES. Gemessen wird das Element selbst
 * (`locator.screenshot()` kümmert sich um Scrollen und Koordinaten), während
 * sein ganzer Teilbaum farblos steht — was bleibt, ist genau die Fläche,
 * auf der die Glyphen sitzen.
 */
async function grundHinter(locator) {
  const puffer = await locator.screenshot();
  const { breite, hoehe, bild, bpp } = pngEntpacken(puffer);
  const x = Math.floor(breite / 2);
  const y = Math.floor(hoehe / 2);
  const o = y * breite * bpp + x * bpp;
  return [bild[o], bild[o + 1], bild[o + 2]];
}

/**
 * DIE VORDERGRUNDFARBE ÜBER EINEN CANVAS AUFLÖSEN (Falle 16).
 * `getComputedStyle(...).color` gibt in Chrome `oklch(0.8 0.1 197)` ZURÜCK,
 * nicht `rgb(...)` — ein rgb-Parser bekommt dort null und die ganze Messung
 * fällt still aus (erster Lauf: „0 von 4 Stellen gemessen"). Der Canvas
 * rechnet jeden gültigen CSS-Farbausdruck in echte Bytes um.
 */
async function vordergrundVon(locator) {
  return locator.evaluate((e) => {
    const farbe = getComputedStyle(e).color;
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    ctx.fillStyle = farbe;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
}

/**
 * Schlechtester Kontrast eines Elements über VIER Zeitpunkte — die Schicht
 * bewegt sich, derselbe Punkt schwankt um ±0,3 bis ±1,5.
 */
async function kontrastVon(page, locator, name) {
  if (!(await locator.count())) return null;
  /* ERST IN DEN BLICK SCROLLEN. `page.screenshot({clip})` schneidet aus dem
     SICHTFENSTER, nicht aus der ganzen Seite: Ein Element weiter unten liefert
     „Clipped area is either empty or outside the resulting image" — und das
     sah im Lauf davor aus wie „Stelle gibt es nicht". */
  await locator.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const kasten = await locator.first().boundingBox();
  if (!kasten || kasten.width < 2 || kasten.height < 2) return null;
  const vg = await vordergrundVon(locator.first());
  if (!vg) return null;
  // Über VIER Zeitpunkte, der schlechteste zählt — die Schicht wandert, und
  // derselbe Punkt schwankt um ±0,3 bis ±1,5.
  let schlechtester = Infinity;
  for (let n = 0; n < 4; n++) {
    await locator.first().evaluate((e) => e.setAttribute("data-mess", "1"));
    const stil = await page.addStyleTag({ content: MESS_CSS });
    await page.waitForTimeout(150);
    const hg = await grundHinter(locator.first());
    await stil.evaluate((e) => e.remove());
    await locator.first().evaluate((e) => e.removeAttribute("data-mess"));
    if (process.env.MESS_DEBUG && n === 0) {
      console.log(`         [debug] ${name} vg=${vg.join(",")} hg=${hg.join(",")}`);
    }
    schlechtester = Math.min(schlechtester, verhaeltnis(vg, hg));
    await page.waitForTimeout(450);
  }
  return { name, wert: schlechtester };
}

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

const ALT_TOKEN = [
  "--ink-2", "--ink-3", "--ink-4", "--ink-5",
  "--fg-1", "--fg-2", "--fg-3", "--fg-4", "--fg-5",
  "--ta-pink", "--ta-mint", "--ta-violet", "--ta-cyan",
  "font-mono-ta", "font-display-ta",
];

async function pruefeBericht(page, wurzelSel, wo) {
  return page.evaluate(
    ({ sel, tokens }) => {
      const wurzel = document.querySelector(sel);
      if (!wurzel) return { fehlt: true };
      const html = wurzel.innerHTML;
      const karten = [...wurzel.querySelectorAll(".t-card")];
      return {
        treffer: tokens.filter((t) => html.includes(t)),
        // Glas auf Glas: eine .t-card, die selbst in einer .t-card sitzt.
        glasInGlas: karten.filter((k) => k.parentElement?.closest(".t-card")).length,
        eigeneKarten: karten.length,
        ueberlauf: Math.max(0, wurzel.scrollWidth - wurzel.clientWidth),
        text: wurzel.innerText,
      };
    },
    { sel: wurzelSel, tokens: ALT_TOKEN },
  );
}

// ─── Lauf ───────────────────────────────────────────────────────────────────

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
    uid = (
      await auth.createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: "Mess T5",
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
        displayName: "Mess T5",
        email: EMAIL,
        gymId: GYM_ID,
        trainerOnboarded: true,
        createdAt: new Date(), // Falle 26: ohne das fehlt das Konto in listAllMembers
        ...rightsMirror(rechte),
      },
      { merge: true },
    );

  // EIGENES Gegnerprofil — mit einer DNA-Antwort, die dem Befund WIDERSPRICHT.
  // Genau daraus entsteht der Konflikt-Zustand; Leons echtes Profil bleibt
  // unangetastet.
  const gegnerRef = db.collection("opponents").doc(GEGNER);
  await gegnerRef.set({
    name: "Mess T5 Gegner",
    gymId: GYM_ID,
    style: "striker",
    stance: "orthodox",
    strengths: ["Distanz"],
    weaknesses: ["Cardio"],
    favoriteAttacks: ["Low Kick"],
    notes: null,
    dna: { [FRAGE_C]: "Eröffnet mit dem Jab." },
    dnaSplit: null,
    dnaSplitWeight: 0,
    actionStats: [],
    createdBy: uid,
    createdAt: Timestamp.now(),
    mess: true,
  });

  const refs = [];
  for (const zustand of ["offen", "konflikte", "fertig"]) {
    const ref = gegnerRef.collection("videoAnalyses").doc(`mess-t5-${zustand}`);
    await ref.set(analyseDoc(uid, zustand, zustand));
    refs.push(ref);
  }
  // Derselbe Bericht für /kampfprofil — freigegeben, Modus athlete.
  const eigenRef = db
    .collection("users")
    .doc(uid)
    .collection("videoAnalyses")
    .doc("mess-t5-eigen");
  await eigenRef.set({
    ...analyseDoc(uid, "eigen", "fertig"),
    mode: "athlete",
    targetId: uid,
    targetName: "Mess T5",
    sharedWithAthlete: true,
  });

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await ctx.newPage();
    const konsole = [];
    page.on("console", (m) => {
      if (m.type() === "error") konsole.push(m.text());
    });
    await anmelden(page);
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    // ── 1. Die Werkbank: Bericht auf Glas ─────────────────────────────────
    console.log("\nWerkbank (data-area=deepfight, Glas)");
    await page.goto(`${BASE}/trainer/deepfight?modus=gegner&ziel=${GEGNER}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await page.waitForTimeout(3500);

    /* IMMER NUR EINE ANALYSE AUFKLAPPEN. Die Ablage führt EIN `expandedId`,
       nicht eine Menge — ein Klick auf die zweite Zeile schließt die erste.
       Der erste Lauf hat alle drei nacheinander angetippt und danach nur die
       LETZTE gemessen; die beiden anderen Zustände galten als „fehlt", obwohl
       sie stehen. Jede Zeile wird dabei neu gesucht: Sobald ein Bericht
       aufklappt, bringt er eigene `aria-expanded`-Köpfe mit. */
    async function oeffne(zustand) {
      const z = page
        .locator('[data-area="deepfight"] main [aria-expanded]')
        .filter({ hasText: `Messvideo ${zustand}` });
      if (!(await z.count())) return null;
      await z.first().click();
      await page.waitForTimeout(1400);
      return page.evaluate(() =>
        document.querySelector('[data-area="deepfight"] main').innerText.toLowerCase(),
      );
    }

    const sicht = {};
    for (const zustand of ["offen", "konflikte", "fertig"]) {
      sicht[zustand] = await oeffne(zustand);
      sagt(!!sicht[zustand], `Analyse „${zustand}" aufgeklappt`);
    }

    // Zuletzt steht „fertig" offen — auf diesem Stand messen wir weiter.
    const wb = await pruefeBericht(page, '[data-area="deepfight"] main', "Werkbank");
    sagt(!wb.fehlt, "Werkbank gerendert");
    sagt(
      (wb.treffer ?? []).length === 0,
      `keine Alt-Token im Bereich (${(wb.treffer ?? []).join(", ") || "keine"})`,
    );
    sagt(wb.glasInGlas === 0, `Glas-in-Glas 0 (gezählt ${wb.glasInGlas})`);
    sagt(wb.ueberlauf === 0, `kein Überlauf (${wb.ueberlauf} px)`);

    // main muss transparent bleiben (Falle 17)
    const mainBg = await page.evaluate(
      () => getComputedStyle(document.querySelector('[data-area="deepfight"] main')).backgroundColor,
    );
    sagt(
      /rgba\(0, 0, 0, 0\)|transparent/.test(mainBg),
      `main transparent (${mainBg})`,
    );

    // ── 2. Die drei Gesichter des Fußes ───────────────────────────────────
    console.log("\nDas sichtbare Ende — je Zustand ein Gesicht");

    // OFFEN: noch nichts übernommen → kein Fuß, der Knopf oben trägt es.
    sagt(
      !sicht.offen.includes("übernahme durch") &&
        !sicht.offen.includes("noch 1 entscheidung"),
      "OFFEN: kein Fuß, solange nichts übernommen ist",
    );
    sagt(
      /alle übernehmen \([1-9]/.test(sicht.offen),
      "OFFEN: der Knopf oben zählt die offenen Befunde",
    );

    // NUR-KONFLIKTE: sagt, was drin ist, und was noch drankommt.
    sagt(
      /noch 1 entscheidung|noch \d+ entscheidungen/.test(sicht.konflikte),
      "KONFLIKTE: der Fuß nennt die offenen Entscheidungen",
    );
    sagt(
      sicht.konflikte.includes("stehen jetzt im deepfight-profil von mess t5 gegner") ||
        sicht.konflikte.includes("steht jetzt im deepfight-profil von mess t5 gegner"),
      "KONFLIKTE: …und sagt trotzdem, was schon im Profil steht",
    );
    sagt(
      sicht.konflikte.includes("bisher im profil"),
      "KONFLIKTE: Vergleich Bisher im Profil steht da",
    );
    sagt(
      sicht.konflikte.includes("ersetzen"),
      "KONFLIKTE: der Weg Ersetzen steht einzeln da",
    );
    sagt(
      !sicht.konflikte.includes("aus video"),
      "KONFLIKTE: behauptet KEINE Herkunft (die wird nicht gespeichert)",
    );

    // FERTIG: das sichtbare Ende samt Weg.
    sagt(sicht.fertig.includes("übernahme durch"), "FERTIG: der Fuß steht da");
    sagt(
      sicht.fertig.includes("stehen jetzt im deepfight-profil von mess t5 gegner"),
      "FERTIG: …sagt WAS und WO",
    );
    sagt(sicht.fertig.includes("profil ansehen"), "FERTIG: …und bietet den Weg an");
    const weg = page.locator(
      `[data-area="deepfight"] main a[href="/trainer/deepfight/gegner/${GEGNER}"]`,
    );
    sagt(await weg.count() > 0, "FERTIG: der Weg zeigt auf /trainer/deepfight/gegner/<id>");

    await page.screenshot({ path: `tmp-t5-werkbank-${THEME}.png`, fullPage: true });

    // ── 3. Kontrast an den neuen Stellen ──────────────────────────────────
    console.log("\nKontrast über der bewegten Schicht (schlechtester von vier)");
    /* `:visible` ist hier Pflicht, nicht Kosmetik: Die zugeklappten Berichte
       stehen weiter im Baum, und `.first()` griff im ersten Lauf auf ein
       Element ohne Kasten — `boundingBox()` gab null, und die Messung meldete
       stumm „keine Stelle gefunden". */
    /* JEDE FARBIGE SCHRIFT, die Teilschritt 5 gesetzt hat — nicht nur eine
       Stichprobe. Die Akzent- und Signalfamilien sind im HELLEN Theme über
       der Schicht der wunde Punkt: Die Bereichsregel korrigiert dort nur
       `--text-2`, `--text-muted` und `--text-label`, NICHT `--accent-text`
       und nicht `--warning`/`--positive`. */
    const stellen = [
      ['[data-area="deepfight"] main p:has-text("stehen jetzt im"):visible', "Fuß-Satz"],
      ['[data-area="deepfight"] main :text("Übernahme durch"):visible', "Fuß-Label positiv"],
      ['[data-area="deepfight"] main :text("Entscheidung"):visible', "Fuß-Label amber"],
      ['[data-area="deepfight"] main :text("Bisher im Profil"):visible', "Konflikt-Label"],
      ['[data-area="deepfight"] main :text("Kämpfer-Identifikation"):visible', "Identifikation"],
      ['[data-area="deepfight"] main :text("Video-Gewichtung"):visible', "Gewichtung"],
      ['[data-area="deepfight"] main :text("KI-Einschätzung"):visible', "Abschnitts-Label"],
      ['[data-area="deepfight"] main button:has-text("Ersetzen"):visible', "Knopf Ersetzen"],
      ['[data-area="deepfight"] main :text("Übernommen"):visible', "Marke Übernommen"],
      ['[data-area="deepfight"] main :text("Am gefährlichsten"):visible', "Am gefährlichsten"],
      ['[data-area="deepfight"] main :text("Verwundbar"):visible', "Verwundbar"],
      ['[data-area="deepfight"] main button.t-danger:visible', "Knopf Löschen"],
      ['[data-area="deepfight"] main [title="Konfidenz dieses Befunds"]:visible', "Konfidenz-Marke"],
      ['[data-area="deepfight"] main :text("Widerspruch"):visible', "Abgleich Widerspruch"],
    ];
    /* ZWEIMAL DURCH: Konflikt-Zeile und amberner Fuß gibt es nur, solange
       „konflikte" offen steht; der grüne Fuß nur bei „fertig". Ein Durchgang
       hätte die Hälfte der Stellen als „nicht gefunden" durchgewunken. */
    let schwaechster = Infinity;
    let gemessen = 0;
    const durchgefallen = [];
    for (const zustand of ["konflikte", "fertig"]) {
      await oeffne(zustand);
      console.log(`     — Bericht „${zustand}"`);
      for (const [sel, name] of stellen) {
        let r = null;
        try {
          r = await kontrastVon(page, page.locator(sel).first(), name);
        } catch (e) {
          console.log(`       ${name}: NICHT GEMESSEN (${e.message.split("\n")[0]})`);
        }
        if (r) {
          gemessen += 1;
          schwaechster = Math.min(schwaechster, r.wert);
          const ok = r.wert >= 4.5;
          if (!ok) durchgefallen.push(`${zustand}/${name} ${r.wert.toFixed(2)}`);
          console.log(`       ${ok ? " " : "!"} ${name}: ${r.wert.toFixed(2)}:1`);
        }
      }
    }
    // Eine stille Null ist kein grüner Haken — wer nichts misst, hat nichts belegt.
    sagt(gemessen >= 10, `genug Stellen gemessen (${gemessen})`);
    sagt(
      durchgefallen.length === 0,
      `alle Stellen ≥ 4,5:1 (schwächster ${schwaechster === Infinity ? "—" : schwaechster.toFixed(2)}${durchgefallen.length ? "; durchgefallen: " + durchgefallen.join(" · ") : ""})`,
    );

    // ── 4. Der zweite Aufrufer: /kampfprofil (KEIN data-area) ─────────────
    console.log("\n/kampfprofil (deckende Karte, kein Glas)");
    await page.goto(`${BASE}/kampfprofil`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    /* Die Zeile heißt „Messvideo eigen" und ist ein schlichter Knopf (kein
       aria-expanded wie in der Ablage). Erst warten, DANN klicken — ohne das
       Warten war der Lauf mal grün und mal leer, je nachdem ob Firestore
       schon geantwortet hatte. */
    const zeile = page.locator("main button").filter({ hasText: "Messvideo eigen" });
    await zeile.first().waitFor({ state: "visible", timeout: 30000 });
    await zeile.first().click();
    await page.waitForTimeout(1600);
    const kp = await pruefeBericht(page, "main", "kampfprofil");
    sagt(!kp.fehlt, "/kampfprofil gerendert");
    sagt(
      (kp.treffer ?? []).length === 0,
      `keine Alt-Token auf /kampfprofil (${(kp.treffer ?? []).join(", ") || "keine"})`,
    );
    sagt(kp.ueberlauf === 0, `kein Überlauf auf /kampfprofil (${kp.ueberlauf} px)`);
    const kpText = (kp.text ?? "").toLowerCase();
    sagt(kpText.includes("ki-einschätzung"), "der Bericht läuft dort mit");
    // Der Athlet übernimmt nichts — kein Fuß, kein Weg ins Trainer-Werkzeug.
    sagt(
      !kpText.includes("übernahme durch") && !kpText.includes("profil ansehen"),
      "kein Übernahme-Fuß beim Athleten",
    );
    /* Der Athlet darf aus dem BERICHT nicht ins Trainer-Werkzeug geschickt
       werden. Gemeint sind die zwei Adressen, die der neue Fuß baut — nicht
       die Hülle: Das Prüfkonto IST Trainer, seine Navigation trägt natürlich
       Trainer-Adressen (erster Lauf: genau daran gescheitert). */
    const trainerLinks = await page.evaluate(() =>
      [...document.querySelectorAll('main a[href^="/trainer/deepfight/"]')].map(
        (a) => a.getAttribute("href"),
      ),
    );
    const ausDemFuss = trainerLinks.filter((h) =>
      /\/trainer\/deepfight\/(gegner|athleten)\//.test(h ?? ""),
    );
    sagt(
      ausDemFuss.length === 0,
      `kein Übernahme-Weg im Bericht (${ausDemFuss.join(", ") || "keiner"}); Hülle: ${trainerLinks.join(", ") || "keine"}`,
    );

    /* KONTRAST AUCH HIER. `/kampfprofil` trägt KEIN `data-area="deepfight"`:
       kein Glas, keine bewegte Schicht, und damit auch nicht die
       Bereichskorrektur der Signalfarben — hier gelten die :root-Werte auf
       einer DECKENDEN Karte. Das ist der Normalfall der App, aber die Farben
       sind meine Wahl, also werden sie gemessen und nicht angenommen. */
    console.log("     Kontrast auf /kampfprofil (deckende Karte)");
    const kpStellen = [
      ['main :text("Kämpfer-Identifikation"):visible', "Identifikation"],
      ['main :text("Video-Gewichtung"):visible', "Gewichtung"],
      ['main :text("KI-Einschätzung"):visible', "Abschnitts-Label"],
      ['main :text("Am gefährlichsten"):visible', "Am gefährlichsten"],
      ['main :text("Verwundbar"):visible', "Verwundbar"],
      ['main [title="Konfidenz dieses Befunds"]:visible', "Konfidenz-Marke"],
    ];
    const kpDurchgefallen = [];
    let kpGemessen = 0;
    for (const [sel, name] of kpStellen) {
      let r = null;
      try {
        r = await kontrastVon(page, page.locator(sel).first(), name);
      } catch {
        /* nicht sichtbar — zählt unten als nicht gemessen */
      }
      if (r) {
        kpGemessen += 1;
        if (r.wert < 4.5) kpDurchgefallen.push(`${name} ${r.wert.toFixed(2)}`);
        console.log(`       ${r.wert >= 4.5 ? " " : "!"} ${name}: ${r.wert.toFixed(2)}:1`);
      }
    }
    sagt(kpGemessen >= 4, `/kampfprofil: genug Stellen gemessen (${kpGemessen})`);

    /* GEGENPROBE AUF TOKEN-EBENE, damit ein Fehlschlag hier nicht dieser
       Datei angelastet wird: Wie steht das nackte Token auf der nackten
       Kartenfläche? Das rechnet der Browser aus den Definitionen aus und hat
       mit dem Bericht nichts zu tun. Fällt es schon hier durch, ist es eine
       Eigenschaft des Token-Systems im hellen Theme — app-weit, überall wo
       eine Signalfarbe als Schrift auf einer Karte steht. */
    const tokenProbe = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext("2d");
      const rgb = (ausdruck) => {
        ctx.fillStyle = "#000";
        ctx.fillStyle = ausdruck;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const s = getComputedStyle(document.documentElement);
      const hole = (n) => rgb(s.getPropertyValue(n).trim());
      return {
        grund: hole("--surface-card"),
        warning: hole("--warning"),
        positive: hole("--positive"),
        negative: hole("--negative"),
      };
    });
    const tokenWerte = ["warning", "positive", "negative"].map((n) => {
      const v = verhaeltnis(tokenProbe[n], tokenProbe.grund);
      return `--${n} ${v.toFixed(2)}`;
    });
    console.log(`       [Token auf --surface-card] ${tokenWerte.join(" · ")}`);

    /* BLEIBT ABSICHTLICH ROT. Der Fehlschlag gehört NICHT zu Teilschritt 5:
       Die Gegenprobe eine Zeile höher zeigt, dass schon das nackte Token auf
       der nackten Karte durchfällt (`--warning` 3,91). Der Bericht benutzt
       die Signalfarben so, wie das Token-System sie vorsieht — und wie es
       AthleteProfileForm, InviteStatusChip, FightCampPlanView und
       OpponentProfileView seit jeher tun. Zu heilen ist das am `:root` des
       hellen Themes, app-weit und mit Leons Blick auf die Optik, nicht in
       dieser einen Datei. Wer das grün machen will, ohne die Tokens
       anzufassen, macht die Messung falsch, nicht die App richtig. */
    sagt(
      kpDurchgefallen.length === 0,
      `/kampfprofil: alle Stellen ≥ 4,5:1${kpDurchgefallen.length ? " — durchgefallen: " + kpDurchgefallen.join(" · ") + "  [APP-WEITER TOKEN-BEFUND, nicht Teilschritt 5 — siehe Zeile darüber]" : ""}`,
    );
    await page.screenshot({ path: `tmp-t5-kampfprofil-${THEME}.png`, fullPage: true });

    // ── 5. Bewegung abbestellt ────────────────────────────────────────────
    console.log("\nreduced-motion");
    const ctx2 = await browser.newContext({
      viewport: { width: 390, height: 900 },
      reducedMotion: "reduce",
    });
    const p2 = await ctx2.newPage();
    await anmelden(p2);
    await p2.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);
    await p2.goto(`${BASE}/trainer/deepfight?modus=gegner&ziel=${GEGNER}`, {
      waitUntil: "domcontentloaded",
    });
    await p2.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    await p2.waitForTimeout(3500);
    const m = await pruefeBericht(p2, '[data-area="deepfight"] main', "mobil");
    sagt(m.ueberlauf === 0, `mobil 390 px kein Überlauf (${m.ueberlauf} px)`);
    sagt(m.glasInGlas === 0, `mobil Glas-in-Glas 0 (${m.glasInGlas})`);
    await p2.screenshot({ path: `tmp-t5-mobil-${THEME}.png`, fullPage: true });
    await ctx2.close();

    sagt(konsole.length === 0, `keine Konsolenfehler (${konsole.length})`);
    if (konsole.length) console.log(konsole.slice(0, 6).join("\n"));
  } finally {
    await browser.close();
    for (const ref of refs) await ref.delete().catch(() => {});
    await eigenRef.delete().catch(() => {});
    await gegnerRef.delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
    await db.collection("users").doc(uid).delete().catch(() => {});
  }
  console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES GRÜN");
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
