/**
 * DIE STUFEN-STAFFEL — Messung ohne KI (24.09.2026).
 *
 *   node --use-system-ca --experimental-transform-types --import ./scripts/lib/ts-loader-register.mjs scripts/mess-stufen.mjs
 *   BASE=http://localhost:3001 BROWSER=1 THEME=dark OUT="…" node --use-system-ca … scripts/mess-stufen.mjs
 *
 * Leon hat am 22.09.2026 beschlossen, dass die drei Stufen MEHR trennt als die
 * Menge: Branding-Kit ab Gym, Videolänge 10 / 15 / 15 min, Nachkauf 35 / 30 /
 * 25 €. Gebaut wurde das am 24.09. — diese Messung beweist, dass es greift,
 * und zwar SERVERSEITIG. Eine Leistung, die nur der Browser versteckt, ist
 * keine Leistung.
 *
 * KEIN EINZIGER MODELLAUFRUF: Jede Video-Prüfung läuft auf einer Länge, die
 * ABGELEHNT wird — die Route antwortet, bevor Gemini ein Byte sieht. Ein
 * erlaubter Aufruf würde echtes Geld kosten und beweist nichts, was die
 * Ablehnung nicht schon zeigt.
 *
 * EIGENES PRÜF-GYM (`mess-stufen-gym`), nicht das echte: Die Messung schreibt
 * Abo-Stufen und ein Branding um — am echten Gym wäre das ein Eingriff in
 * Leons Daten. Konten und Gym werden am Ende gelöscht, auch wenn sie
 * unterwegs abbricht.
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";
import {
  ABO_STUFEN,
  leistungenFuer,
  nachkaufNetto,
  nachkaufSchluessel,
  videoSekunden,
} from "../lib/abo.ts";
import { stufeDesGyms, videoSekundenFuerGym } from "../lib/server/gym-status.ts";

const BASE = process.env.BASE ?? "http://localhost:3001";
const THEME = process.env.THEME ?? "dark";
const BROWSER = process.env.BROWSER === "1";
const OUT = process.env.OUT ?? ".";
const GYM_ID = "mess-stufen-gym";
const VERWALTUNG = "mess-stufen-v@tidal-athletics.invalid";
const PASSWORD = `mess-stufen-${Math.random().toString(36).slice(2)}A1!`;

let fehler = 0;
let ok = 0;
const sagt = (bestanden, text) => {
  if (bestanden) ok += 1;
  else fehler += 1;
  console.log(`  ${bestanden ? "OK  " : "FEHL"} ${text}`);
};

function env() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

async function idToken(email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env().NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );
  const { idToken: t } = await res.json();
  return t;
}

/** Die Stufe des Prüf-Gyms umschreiben — wie es sonst der Webhook tut. */
async function stufeSetzen(db, plan) {
  await db
    .collection("gyms")
    .doc(GYM_ID)
    .set(
      {
        subscription: {
          status: "active",
          plan,
          intervall: plan === "free" ? null : "monat",
          stripeStatus: plan === "free" ? null : "active",
          stripeCustomerId: plan === "free" ? null : "cus_mess",
          stripeSubscriptionId: plan === "free" ? null : "sub_mess",
          currentPeriodEnd: null,
        },
      },
      { merge: true },
    );
}

/**
 * Unterordner überleben das Löschen ihres Dokuments. Bleibt auch nur EIN
 * Guthaben-Posten aus einem früheren Lauf liegen, geht die Analyse durch —
 * und Gemini bekäme einen Aufruf, den diese Messung nie machen soll.
 */
async function guthabenLeeren(db) {
  const posten = await db.collection("gyms").doc(GYM_ID).collection("guthaben").get();
  await Promise.all(posten.docs.map((d) => d.ref.delete()));
  const nutzung = await db.collection("gyms").doc(GYM_ID).collection("guthabenNutzung").get();
  await Promise.all(nutzung.docs.map((d) => d.ref.delete()));
  return posten.size + nutzung.size;
}

async function konto(auth, db, email, name, rechte) {
  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (await auth.createUser({ email, password: PASSWORD, displayName: name, emailVerified: true })).uid;
  }
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db
    .collection("users")
    .doc(uid)
    .set(
      { email, displayName: name, gymId: GYM_ID, onboarded: true, trainerOnboarded: true, ...rightsMirror(rechte), createdAt: Timestamp.now() },
      { merge: true },
    );
  return uid;
}

/** Der Vorlauf — NUR mit einer Länge aufrufen, die ABGELEHNT wird. */
async function vorlauf(token, sekunden) {
  const res = await fetch(`${BASE}/api/video-analysis/preview`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      source: { kind: "upload", fileUri: "files/mess-gibt-es-nicht", mimeType: "video/mp4", durationSeconds: sekunden },
    }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

/**
 * Die Analyse. WARUM DIESE ROUTE FÜR DEN ERLAUBTEN FALL: Kommt ein Video durch
 * die Längenprüfung, zieht die Route als Nächstes eine Analyse vom Guthaben —
 * und das Prüf-Gym hat keines. Sie antwortet also 402, lange bevor Gemini ein
 * Byte sieht. Beim Vorlauf gibt es diese zweite Schranke nicht; dort wird
 * deshalb nur gemessen, was ABGELEHNT wird.
 */
async function analyse(token, sekunden) {
  const res = await fetch(`${BASE}/api/video-analysis/analyze`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      mode: "athlete",
      tier: "flash",
      fighter: { name: "Mess Athlet", corner: "unknown", clothing: "", features: "", startPosition: "" },
      source: { kind: "upload", fileUri: "files/mess-gibt-es-nicht", mimeType: "video/mp4", durationSeconds: sekunden },
    }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

async function branding(token, body) {
  const res = await fetch(`${BASE}/api/gym/branding`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} · BROWSER ${BROWSER ? `an (${BASE}, ${THEME})` : "aus"}`);
  const auth = getAuth();
  const db = getFirestore();
  let uid = null;

  try {
    // ── 1. Die reinen Zahlen ───────────────────────────────────────────
    console.log("\n1 · Die Staffel in lib/abo.ts");
    sagt(
      ABO_STUFEN.map((s) => s.leistungen.videoMinuten).join("/") === "10/15/15",
      `Videolänge je Stufe: ${ABO_STUFEN.map((s) => s.leistungen.videoMinuten).join(" / ")} min (Leon 22.09.)`,
    );
    sagt(
      [nachkaufNetto("team"), nachkaufNetto("gym"), nachkaufNetto("saison")].join("/") === "3500/3000/2500",
      `Nachkauf je Stufe: ${[3500, 3000, 2500].map((c) => c / 100).join(" / ")} €`,
    );
    const schluessel = ["team", "gym", "saison"].map(nachkaufSchluessel);
    sagt(new Set(schluessel).size === 3, `Drei verschiedene Stripe-Schlüssel: ${schluessel.join(", ")}`);
    sagt(
      [leistungenFuer("free"), leistungenFuer("team")].every((l) => l.branding === false) &&
        [leistungenFuer("gym"), leistungenFuer("saison")].every((l) => l.branding === true),
      "Branding-Kit: gratis nein · Team nein · Gym ja · Saison ja",
    );
    sagt(videoSekunden("free") === 600, `Der Gratis-Tarif erbt Team: ${videoSekunden("free") / 60} Minuten`);

    // ── 2. Prüf-Gym und Konto ──────────────────────────────────────────
    await db.collection("gyms").doc(GYM_ID).set(
      {
        name: "Mess Stufen Gym",
        status: "active",
        branding: null,
        createdAt: Timestamp.now(),
        // DIE MARKE FÜR DAS GESCHENK — ohne sie legt `nimmEineAnalyse` die
        // drei Gratis-Analysen selbst an, die Analyse liefe durch und Gemini
        // bekäme einen Aufruf. Gesetzt heißt: kein Guthaben, die Route
        // antwortet 402, und die Messung kostet nichts.
        guthabenStart: Timestamp.now(),
      },
      { merge: true },
    );
    const geraeumt = await guthabenLeeren(db);
    sagt(true, `Prüf-Gym ohne Guthaben (${geraeumt} Reste geräumt) — so antwortet die Analyse 402, statt Gemini zu rufen`);
    uid = await konto(auth, db, VERWALTUNG, "Mess Verwaltung Stufen", { trainer: true, verwaltung: true, admin: false });
    const token = await idToken(VERWALTUNG);
    sagt(!!token, "Echtes ID-Token der Prüf-Verwaltung (Identity Toolkit)");

    // ── 3. Der Server liest die Stufe ──────────────────────────────────
    console.log("\n2 · Die Stufe am Gym, serverseitig gelesen");
    for (const [plan, sekunden] of [["free", 600], ["team", 600], ["gym", 900], ["saison", 900]]) {
      await stufeSetzen(db, plan);
      const gelesen = await stufeDesGyms(() => db, GYM_ID);
      const erlaubt = await videoSekundenFuerGym(() => db, GYM_ID);
      sagt(gelesen === plan && erlaubt === sekunden, `${plan}: gelesen „${gelesen}", erlaubt ${erlaubt / 60} Minuten`);
    }
    sagt(
      (await videoSekundenFuerGym(() => db, "gibt-es-nicht")) === 900,
      "Unbekanntes Gym: die Route bleibt offen und nimmt die Obergrenze (Lesefehler sperrt niemanden aus)",
    );

    // ── 4. Die Routen halten die Grenze ────────────────────────────────
    console.log("\n3 · Die Routen halten die Stufe — ohne einen einzigen Modellaufruf");
    await stufeSetzen(db, "team");
    const teamVorlauf = await vorlauf(token, 12 * 60);
    sagt(
      teamVorlauf.status === 400 && teamVorlauf.error === "Nimm einen Ausschnitt bis 10 Minuten.",
      `Vorlauf · Team + 12-Minuten-Video → ${teamVorlauf.status} „${teamVorlauf.error}"`,
    );
    const teamAnalyse = await analyse(token, 12 * 60);
    sagt(
      teamAnalyse.status === 400 && teamAnalyse.error === "Nimm einen Ausschnitt bis 10 Minuten.",
      `Analyse · Team + 12-Minuten-Video → ${teamAnalyse.status} „${teamAnalyse.error}"`,
    );

    await stufeSetzen(db, "gym");
    const gymDurch = await analyse(token, 12 * 60);
    sagt(
      gymDurch.status === 402 && gymDurch.guthabenLeer === true,
      `Analyse · Gym + 12-Minuten-Video → die Länge geht durch, die nächste Schranke greift (${gymDurch.status}, Guthaben leer)`,
    );
    const gymZuLang = await analyse(token, 20 * 60);
    sagt(
      gymZuLang.status === 400 && gymZuLang.error === "Nimm einen Ausschnitt bis 15 Minuten.",
      `Analyse · Gym + 20-Minuten-Video → ${gymZuLang.status} „${gymZuLang.error}"`,
    );
    const vorlaufZuLang = await vorlauf(token, 20 * 60);
    sagt(
      vorlaufZuLang.status === 400 && vorlaufZuLang.error === "Nimm einen Ausschnitt bis 15 Minuten.",
      `Vorlauf · Gym + 20-Minuten-Video → ${vorlaufZuLang.status} „${vorlaufZuLang.error}"`,
    );

    // ── 5. Das Branding-Kit ────────────────────────────────────────────
    console.log("\n4 · /api/gym/branding prüft die Stufe, nicht den Browser");
    const ohneToken = await fetch(`${BASE}/api/gym/branding`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    sagt(ohneToken.status === 403 || ohneToken.status === 401, `POST ohne Token → ${ohneToken.status}`);

    await stufeSetzen(db, "team");
    const teamVerboten = await branding(token, { akzentH: 25, akzentC: 0.2 });
    sagt(
      teamVerboten.status === 402 && teamVerboten.stufeFehlt === true,
      `Team will eine Farbe setzen → ${teamVerboten.status} „${teamVerboten.error}"`,
    );
    sagt(
      (await db.collection("gyms").doc(GYM_ID).get()).get("branding") == null,
      "…und am Gym steht danach nichts",
    );

    await stufeSetzen(db, "gym");
    const gymDarf = await branding(token, { akzentH: 25.4, akzentC: 0.21, logoUrl: null });
    const gespeichert = (await db.collection("gyms").doc(GYM_ID).get()).get("branding");
    sagt(
      gymDarf.status === 200 && gespeichert?.akzentH === 25.4 && gespeichert?.akzentC === 0.21,
      `Gym setzt die Farbe → ${gymDarf.status}, am Gym steht Farbton ${gespeichert?.akzentH}, Buntheit ${gespeichert?.akzentC}`,
    );

    const krummeFarbe = await branding(token, { akzentH: 999, akzentC: 0.2 });
    sagt(krummeFarbe.status === 400, `Farbton 999 → ${krummeFarbe.status} „${krummeFarbe.error}"`);
    const zuBunt = await branding(token, { akzentH: 25, akzentC: 0.9 });
    sagt(zuBunt.status === 400, `Buntheit 0,9 → ${zuBunt.status} „${zuBunt.error}"`);
    const keinBild = await branding(token, { akzentH: 25, akzentC: 0.2, logoUrl: "data:text/html;base64,PHNjcmlwdD4=" });
    sagt(keinBild.status === 400, `HTML als „Logo" → ${keinBild.status} „${keinBild.error}"`);
    const zuGross = await branding(token, { akzentH: 25, akzentC: 0.2, logoUrl: `data:image/png;base64,${"A".repeat(100 * 1024)}` });
    sagt(zuGross.status === 400, `Logo über 96 KB → ${zuGross.status} „${zuGross.error}"`);

    const echtesLogo = await branding(token, {
      akzentH: 25.4,
      akzentC: 0.21,
      // 1×1 Pixel, transparent — reicht, um den Weg zu beweisen.
      logoUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    });
    sagt(echtesLogo.status === 200, `Echtes PNG als Logo → ${echtesLogo.status}`);

    // ── 6. Die Schirme ─────────────────────────────────────────────────
    if (BROWSER) {
      console.log("\n5 · Die Schirme");
      const { chromium } = await import("playwright");
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await ctx.newPage();
      const konsole = [];
      page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));

      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      if (THEME === "light") {
        await page.evaluate(() => localStorage.setItem("ta-theme", "light"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
      }
      await page.fill('input[type="email"]', VERWALTUNG);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|trainer|verwaltung|kampfprofil)/, { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Stufe Gym: der Schreiber steht.
      await stufeSetzen(db, "gym");
      await page.goto(`${BASE}/verwaltung/branding`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      sagt(await page.locator("[data-marke-speichern]").count() > 0, "Stufe Gym: die Marke-Seite zeigt den Schreiber");
      await page.screenshot({ path: `${OUT}/mess-stufen-marke-gym-${THEME}.png`, fullPage: false });

      const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      sagt(quer === 0, `Marke-Seite auf 1440 px: Quer-Überlauf ${quer} px`);

      // Stufe Team: die Seite wirbt, statt zu sperren — UND die Farbe fällt
      // zurück auf den Tidal-Ton, obwohl am Gym noch eine gespeichert ist.
      await stufeSetzen(db, "team");
      await page.goto(`${BASE}/verwaltung/branding`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      sagt(
        (await page.locator("[data-marke-speichern]").count()) === 0 &&
          (await page.getByText("Logo und Farbe gehören zu Gym und Saison").count()) > 0,
        "Stufe Team: kein Schreiber, dafür der Satz, was das Kit bringt",
      );
      const tonTeam = await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent-h"));
      sagt(
        tonTeam === "",
        `Stufe Team: die Gym-Farbe ist weg, der Tidal-Ton gilt (--accent-h am <html>: „${tonTeam}")`,
      );
      // Und zurück auf Gym: die gespeicherte Farbe steht wieder.
      await stufeSetzen(db, "gym");
      await page.goto(`${BASE}/verwaltung/branding`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const tonGym = await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent-h"));
      sagt(tonGym === "25.4", `Zurück auf Gym: die gespeicherte Farbe steht wieder (--accent-h ${tonGym})`);
      await stufeSetzen(db, "team");
      await page.goto(`${BASE}/verwaltung/branding`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/mess-stufen-marke-team-${THEME}.png`, fullPage: false });

      // Die Karten der Abo-Seite mit den neuen Punkten. Sie stehen NUR vor dem
      // ersten Abo — wer schon eine Stufe hat, sieht Nachkauf und Verwaltung.
      await stufeSetzen(db, "free");
      await page.goto(`${BASE}/trainer/deepfight/abo`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      sagt((await page.getByText("Videos bis 15 Minuten").count()) > 0, "Die Karten zeigen die Videolänge je Stufe");
      sagt((await page.getByText("Dein Logo und deine Farbe in der App").count()) > 0, "Die Karten zeigen das Branding-Kit");
      // Die Karten blenden beim Scrollen ein — ein fullPage-Bild fängt sie
      // ungesehen und damit leer (Falle 60). Also hinscrollen, warten, und
      // NUR den sichtbaren Ausschnitt nehmen.
      await page.getByText("Videos bis 10 Minuten").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/mess-stufen-karten-${THEME}.png`, fullPage: false });
      const sichtbar = await page.getByText("Videos bis 10 Minuten").first().isVisible();
      sagt(sichtbar, "Die Karten stehen sichtbar im Bild, nicht nur im DOM");

      // Handy.
      await page.setViewportSize({ width: 390, height: 844 });
      await stufeSetzen(db, "gym");
      await page.goto(`${BASE}/verwaltung/branding`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const querHandy = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      sagt(querHandy === 0, `Marke-Seite auf 390 px: Quer-Überlauf ${querHandy} px`);
      await page.screenshot({ path: `${OUT}/mess-stufen-marke-handy-${THEME}.png`, fullPage: true });

      sagt(konsole.length === 0, `Konsolenfehler: ${konsole.length}${konsole.length ? ` (${konsole[0]})` : ""}`);
      await browser.close();
    }
  } finally {
    // ── Aufräumen ────────────────────────────────────────────────────────
    if (uid) {
      await db.collection("users").doc(uid).delete().catch(() => {});
      await getAuth().deleteUser(uid).catch(() => {});
    }
    await guthabenLeeren(getFirestore()).catch(() => {});
    await getFirestore().collection("gyms").doc(GYM_ID).delete().catch(() => {});
    console.log(`\n${ok}/${ok + fehler} ${fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : "PRÜFUNG(EN) FEHLGESCHLAGEN ✗"}`);
    process.exitCode = fehler === 0 ? 0 : 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
