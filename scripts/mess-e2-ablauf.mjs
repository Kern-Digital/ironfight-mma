/**
 * ETAPPE 2 — DER GANZE WEG im Browser, mit echtem Video und echter KI:
 * Ablage → Vorlauf → Karten → zwei Zuordnungen → Analyse je Person →
 * Ergebnis → Firestore-Nachweis (Analyse mit Kampfart, Profil je Kampfart).
 *
 *   VIDEO="C:/Users/reich/Desktop/Trainingsvideo Leon , Alec.mp4" node scripts/mess-e2-ablauf.mjs
 *
 * ZWEI eigene Prüfkonten (Trainer mess-e2@…, Athlet mess-e2b@…), damit
 * keine Demo-Person eine echte Analyse bekommt. Kostet zwei Claude-
 * Bewertungen. Danach wird alles gelöscht.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { chromium } from "playwright";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const VIDEO = process.env.VIDEO ?? "C:/Users/reich/Desktop/Trainingsvideo Leon , Alec.mp4";
const GYM_ID = "tidal-athletics";
const PW = `mess-e2-${Math.random().toString(36).slice(2)}A1!`;
// EIGENE Konten (mess-e2a/mess-e2b), getrennt von mess-e2-schirm (mess-e2@):
// Laufen beide gleichzeitig, löscht sonst der eine dem anderen das Konto
// unter der Sitzung weg (gemessen 16.09.: USER_NOT_FOUND mitten im Lauf).
const KONTEN = {
  A: { email: "mess-e2a@tidal-athletics.invalid", name: "Mess E2a", rights: { trainer: true, verwaltung: false, admin: false } },
  B: { email: "mess-e2b@tidal-athletics.invalid", name: "Mess E2b Athlet", rights: { trainer: false, verwaltung: false, admin: false } },
};

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}  [${new Date().toLocaleTimeString("de-DE")}]`);
};

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} · BASE ${BASE} · VIDEO ${VIDEO}`);
  const auth = getAuth();
  const db = getFirestore();
  const uids = {};
  for (const [k, v] of Object.entries(KONTEN)) {
    let uid;
    try {
      uid = (await auth.getUserByEmail(v.email)).uid;
      await auth.updateUser(uid, { password: PW });
    } catch {
      uid = (await auth.createUser({ email: v.email, password: PW, displayName: v.name, emailVerified: true })).uid;
    }
    await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, v.rights));
    // Athlet B gibt „alle Trainer des Gyms" frei — seit dem DeepFight-Tor für
    // alle (16.09.) ist er sonst weder sichtbar noch analysierbar.
    const shares = k === "B"
      ? { athlet: { uids: [], gyms: [] }, deepfight: { uids: [], gyms: [GYM_ID] }, wettkampf: { uids: [], gyms: [] } }
      : { athlet: { uids: [], gyms: [] }, deepfight: { uids: [], gyms: [] }, wettkampf: { uids: [], gyms: [] } };
    await db.collection("users").doc(uid).set(
      { email: v.email, displayName: v.name, gymId: GYM_ID, ...rightsMirror(v.rights), createdAt: Timestamp.now(), profileShares: shares },
      { merge: true },
    );
    uids[k] = uid;
  }

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: THEME });
    const page = await ctx.newPage();
    const konsole = [];
    page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });

    for (let a = 0; a < 3; a++) {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      if (await page.locator('input[type="email"]').count()) break;
    }
    await page.fill('input[type="email"]', KONTEN.A.email);
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|trainer)/, { timeout: 30000 });
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    // 1. Ablage: Datei setzen, Weiter.
    await page.goto(`${BASE}/trainer/deepfight/analyse`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-area="deepfight"] main', { timeout: 30000 });
    const main = page.locator('[data-area="deepfight"] main');
    await page.setInputFiles('input[type="file"]', VIDEO);
    await page.waitForTimeout(500);
    sagt((await main.innerText()).includes("Trainingsvideo"), "Datei liegt in der Ablage");
    await main.locator("button", { hasText: "Weiter" }).click();

    // 2. Upload + Vorlauf → Karten.
    await page.waitForFunction(
      () => document.querySelector('[data-area="deepfight"] main')?.innerText.includes("Kämpfer zuordnen"),
      null,
      { timeout: 6 * 60_000 },
    );
    await page.waitForTimeout(3000); // Standbilder
    let text = await main.innerText();
    sagt(text.includes("Kämpfer 1") && text.includes("Kämpfer 2"), "Vorlauf: zwei Karten");
    sagt(/upload=/.test(page.url()), `Adresse trägt den Lauf (${page.url().split("?")[1]})`);
    const bilder = await main.locator("img").count();
    sagt(bilder === 2, `Standbilder aus der Datei: ${bilder}`);
    // innerText liefert die CSS-Versalien — deshalb kleingeschrieben vergleichen.
    // Die Kampfart schwankt bei Sparring mit Schienbeinschützern zwischen MMA
    // und Kickboxen (gemessen 16.09.); die Merk-Regel greift erst ab der
    // ersten Wahl des Trainers. Hier zählt nur: eine Kampfart steht da.
    const zeile = text.toLowerCase();
    sagt(zeile.includes("training / sparring") && /\b(mma|boxen|kickboxen|ringen|sambo|bjj)\b/.test(zeile), "Art · Kampfart vorbelegt (Training / Sparring · …)");
    await page.screenshot({ path: `tmp-e2-karten-${THEME}.png`, fullPage: true });

    // 3. Zuordnen: Karte 1 = ich, Karte 2 = Athlet B.
    async function zuordnen(karte, name) {
      await main.locator(`button[aria-label="Kämpfer ${karte}: zuordnen"]`).click();
      await page.waitForTimeout(300);
      await main.locator(`button[aria-label="Kämpfer ${karte} als Athlet zuordnen"]`).click();
      await page.waitForSelector('[role="dialog"][aria-label="Athlet wählen"]', { timeout: 10000 });
      await page.waitForTimeout(800);
      const sheet = page.locator('[role="dialog"][aria-label="Athlet wählen"]');
      await sheet.locator('button[data-press="quiet"]', { hasText: name }).first().click();
      await page.waitForTimeout(600);
    }
    await zuordnen(1, "Mess E2a (ich)");
    await zuordnen(2, "Mess E2b Athlet");
    text = await main.innerText();
    sagt(text.includes("Mess E2a") && text.includes("Mess E2b Athlet"), "Beide Karten tragen ihre Person");
    await main.locator('button[aria-haspopup="listbox"]').first().click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]', { hasText: "Kürzlich" }).click();
    await page.waitForTimeout(400);
    sagt((await main.locator("button", { hasText: "Analysieren" }).first().getAttribute("data-bereit")) === "true", "Analysieren voll farbig");
    await page.screenshot({ path: `tmp-e2-zugeordnet-${THEME}.png`, fullPage: true });

    // 4. Analyse: zwei Personen, je Beobachtung + Bewertung + Speichern.
    const t0 = Date.now();
    await main.locator("button", { hasText: "Analysieren" }).first().click();
    // Fertig ODER Fehler — ein Fehler muss sichtbar werden, nicht in ein
    // 25-Minuten-Timeout laufen.
    await page.waitForFunction(
      () => {
        // innerText liefert die CSS-Versalien des Labels — kleingeschrieben vergleichen.
        const t = (document.querySelector('[data-area="deepfight"] main')?.innerText ?? "").toLowerCase();
        return t.includes("im profil") || !!document.querySelector('[data-area="deepfight"] main .t-danger');
      },
      null,
      { timeout: 25 * 60_000 },
    );
    const dauer = Math.round((Date.now() - t0) / 1000);
    const fehlerText = await page.locator('[data-area="deepfight"] main .t-danger').first().innerText().catch(() => "");
    if (fehlerText) {
      await page.screenshot({ path: `tmp-e2-fehler-${THEME}.png`, fullPage: true });
      sagt(false, `Analyse brach ab nach ${dauer} s: ${fehlerText}`);
      throw new Error("Analyse abgebrochen");
    }
    text = await main.innerText();
    sagt(true, `Analyse beider Personen fertig in ${Math.floor(dauer / 60)} min ${dauer % 60} s`);
    sagt(text.includes("2 Auswertungen sind gespeichert"), "Ergebnis: zwei Auswertungen");
    sagt(text.includes("Mess E2b Athlet") && text.includes("zählt zu"), "Je Person eine Zeile mit Gewicht");
    await page.screenshot({ path: `tmp-e2-fertig-${THEME}.png`, fullPage: true });
    const stand = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("ta-video-analysis-form:")));
    sagt(stand.length === 0, "Zwischenstand aufgeräumt");

    // 5. Ergebnis-Link führt in die Liste des Ziels.
    await main.locator("a", { hasText: "Mess E2b Athlet" }).first().click();
    await page.waitForURL(/modus=leute&ziel=/, { timeout: 15000 });
    await page.waitForTimeout(3500);
    text = (await page.locator('[data-area="deepfight"] main').innerText()).toLowerCase();
    sagt(text.includes("im profil") && /\b(mma|boxen|kickboxen|ringen|sambo|bjj)\b/.test(text), "Liste des Athleten zeigt die Analyse mit Kampfart");
    sagt(konsole.length === 0, `Konsole ohne Fehler (${konsole.length})`);
    if (konsole.length) console.log(konsole.slice(0, 5).join("\n"));

    // 6. Firestore-Nachweis.
    for (const [k, uid] of Object.entries(uids)) {
      const an = await db.collection("users").doc(uid).collection("videoAnalyses").get();
      const a = an.docs[0]?.data();
      sagt(an.size === 1, `${k}: eine Analyse gespeichert`);
      const SPORTS = ["mma", "boxen", "kickboxen", "ringen", "sambo", "bjj"];
      sagt(SPORTS.includes(a?.sport) && a?.videoType === "sparring" && a?.recency === "recent", `${k}: sport=${a?.sport} · Art=${a?.videoType} · Zeitraum=${a?.recency}`);
      sagt(a?.gymId === GYM_ID && typeof a?.targetIsStaff === "boolean", `${k}: gymId/targetIsStaff gesetzt (staff=${a?.targetIsStaff})`);
      const main = await db.collection("users").doc(uid).collection("fightProfile").doc("main").get();
      const jeSport = await db.collection("users").doc(uid).collection("fightProfile").doc(String(a?.sport)).get();
      sagt(main.exists, `${k}: fightProfile/main`);
      sagt(jeSport.exists, `${k}: fightProfile/${a?.sport} (Profil je Kampfart)`);
      const antworten = Object.keys(main.data()?.dna ?? {}).length;
      const antwortenSport = Object.keys(jeSport.data()?.dna ?? {}).length;
      sagt(antworten > 0 && antworten === antwortenSport, `${k}: ${antworten} Antworten in main, ${antwortenSport} in ${a?.sport} (eine Analyse → gleich)`);
      console.log(`      ${k}: Gewicht ${a?.weight?.value}, Kämpfer-Sicherheit ${a?.observation?.identification?.idConfidence}, Befunde ${a?.evaluation?.findings?.length}, Split ${JSON.stringify(a?.evaluation?.dnaSplit)}`);
    }
  } finally {
    await browser.close();
    for (const uid of Object.values(uids)) {
      await db.recursiveDelete(db.collection("users").doc(uid));
      await auth.deleteUser(uid);
    }
    console.log(fehler === 0 ? "\nALLE PRÜFUNGEN BESTANDEN ✓" : `\n${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
