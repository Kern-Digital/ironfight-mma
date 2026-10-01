/**
 * MESSUNG „Probetraining vereinbaren" (01.10.2026, Etappe 4 der Gym-Suche).
 *
 *   node --use-system-ca --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gym-anfrage.mjs
 *   THEME=dark node --use-system-ca --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gym-anfrage.mjs
 *   NUR_API=1 node --use-system-ca --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gym-anfrage.mjs
 *
 * Braucht den Dev-Server (BASE). Legt sieben Prüf-Gyms an (sechs in der
 * Suche, eines ausgeschaltet) und fünf Konten und räumt alles weg. Keine
 * KI-Kosten, keine Mail.
 *
 * Was sie beweist (CLAUDE.md „GYM-SUCHE — ETAPPE 4"):
 *   ANFRAGEN (POST /api/gyms/anfrage)
 *   • 401 ohne Token; 400 Name/Nachricht; 404 fremdes/ausgeschaltetes Gym
 *   • die E-Mail kommt aus dem KONTO, nicht aus dem Body
 *   • eine offene Anfrage je Konto und Gym (409), eigenes Gym 409
 *   • fünf offene Anfragen sind der Deckel (429)
 *   • die Suche gibt nur die EIGENEN Anfragen mit (Gym + Datum)
 *   REGELN (unverändert — die Sammlung ist im Browser zu)
 *   • weder der Absender noch die Verwaltung lesen oder schreiben per REST
 *   VERWALTUNG (POST /api/gym/anfragen, …/erledigt)
 *   • nur die Verwaltung (Trainer, Athlet, Konto ohne Gym 403)
 *   • nur die Anfragen des EIGENEN Gyms; fremde lassen sich nicht erledigen
 *   • „Erledigt" löscht; danach kann dieselbe Person wieder anfragen
 *   LÖSCHFRIST
 *   • 90 Tage; eine abgelaufene Anfrage zählt nirgends mehr, der Nacht-Job
 *     löscht sie (abgelaufeneAnfragenLoeschen direkt aufgerufen)
 *   BROWSER
 *   • Athlet: Knopf → Sheet (Name vorbelegt, E-Mail des Kontos, Hinweis) →
 *     „Angefragt am …" statt Knopf, auch nach dem Neuladen
 *   • Mitglied: am eigenen Gym kein Knopf
 *   • Verwaltung: Abschnitt „Anfragen" mit Zahl, Sheet, „Erledigt"
 */
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";
import { abgelaufeneAnfragenLoeschen } from "../lib/server/anfragen.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "light";
const OUT = "../abnahme-gym-suche";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ironfight-mma";
if (!API_KEY) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY fehlt in .env.local");
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

initAdmin();
const auth = getAuth();
const db = getFirestore();
const pw = `mess-ga-${Math.random().toString(36).slice(2)}A1!`;
const OHNE = { trainer: false, verwaltung: false, admin: false };
const G = (n) => `mess-ga-${n}`;
const GYM_AUS = G("aus");
const ORTE = [
  ["Stuttgart", "70173", 48.7784, 9.18], ["München", "80331", 48.1374, 11.5755], ["Köln", "50667", 50.9384, 6.9584],
  ["Hamburg", "20095", 53.5503, 10.0006], ["Berlin", "10117", 52.517, 13.3889], ["Leipzig", "04109", 51.3406, 12.3747],
];
const GYMS = Object.fromEntries(ORTE.map(([ort, plz, lat, lng], i) => [G(i + 1), {
  name: `Mess Gym ${ort}`,
  kontakt: { strasse: "Teststraße 1", plz, ort, telefon: "", email: "", website: "", lat, lng, inSuche: true, sichtbar: true },
}]));
GYMS[GYM_AUS] = { name: "Mess Gym Aus", kontakt: { strasse: "Teststraße 2", plz: "70173", ort: "Stuttgart", telefon: "", email: "", website: "", lat: 48.77, lng: 9.17, inSuche: false, sichtbar: false } };

const KONTEN = {
  sucher:   { name: "Mess Sucher",    gym: null, claim: OHNE },
  mitglied: { name: "Mess Mitglied",  gym: G(1), claim: OHNE },
  trainer:  { name: "Mess Trainer",   gym: G(1), claim: { ...OHNE, trainer: true } },
  buero1:   { name: "Mess Büro Eins", gym: G(1), claim: { ...OHNE, verwaltung: true } },
  buero2:   { name: "Mess Büro Zwei", gym: G(2), claim: { ...OHNE, verwaltung: true } },
};
const email = (k) => `mess-ga-${k}@tidal-athletics.invalid`;
const uids = {};
const ok = [];
let abgebrochen = null;
const pruefe = (name, bed, info = "") => { ok.push(!!bed); console.log(bed ? "  OK  " : "  FEHL", name, info ? `(${info})` : ""); };

const tokens = {};
async function token(k) {
  if (tokens[k]) return tokens[k];
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email(k), password: pw, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error(`Login ${k}: ${JSON.stringify(j.error ?? j)}`);
  return (tokens[k] = j.idToken);
}
async function route(k, pfad, body) {
  const headers = { ...(k ? { authorization: `Bearer ${await token(k)}` } : {}), ...(body ? { "content-type": "application/json" } : {}) };
  const r = await fetch(`${BASE}${pfad}`, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* leer */ }
  return { status: r.status, json };
}
const anfrage = (k, gymId, mehr = {}) => route(k, "/api/gyms/anfrage", { gymId, name: KONTEN[k].name, nachricht: "Ich will ein Probetraining im MMA.", ...mehr });
const dok = async (gymId, k) => { const s = await db.collection("gyms").doc(gymId).collection("anfragen").doc(uids[k]).get(); return s.exists ? s.data() : null; };
const rest = async (k, pfad, init = {}) => (await fetch(`${FS}/${pfad}`, { ...init, headers: { authorization: `Bearer ${await token(k)}`, "content-type": "application/json" } })).status;
const meine = async (k) => ((await route(k, "/api/gyms/suche")).json?.angefragt ?? []).filter((a) => a.gymId.startsWith("mess-ga-"));
async function anfragenWeg() {
  for (const g of Object.keys(GYMS)) {
    const s = await db.collection("gyms").doc(g).collection("anfragen").get();
    for (const d of s.docs) await d.ref.delete();
  }
}

try {
  // ─── Aufbau ─────────────────────────────────────────────────────────────
  for (const [id, g] of Object.entries(GYMS)) {
    await db.collection("gyms").doc(id).set({ name: g.name, status: "active", createdAt: Timestamp.now(), branding: null, kontakt: g.kontakt });
  }
  for (const [k, v] of Object.entries(KONTEN)) {
    let u;
    try { u = await auth.getUserByEmail(email(k)); await auth.updateUser(u.uid, { password: pw }); }
    catch { u = await auth.createUser({ email: email(k), password: pw, displayName: v.name, emailVerified: true }); }
    uids[k] = u.uid;
    await auth.setCustomUserClaims(u.uid, claimsWithRights(v.gym ? { gymId: v.gym } : {}, v.claim));
    await db.collection("users").doc(u.uid).set({
      email: email(k), displayName: v.name, ...(v.gym ? { gymId: v.gym } : {}),
      onboarded: true, trainerOnboarded: true, createdAt: Timestamp.now(), ...rightsMirror(v.claim),
    });
  }
  await anfragenWeg();

  // ─── Anfragen ───────────────────────────────────────────────────────────
  console.log("ANFRAGEN /api/gyms/anfrage");
  pruefe("ohne Token → 401", (await route(null, "/api/gyms/anfrage", { gymId: G(1), name: "X Y" })).status === 401);
  pruefe("Name zu kurz → 400", (await anfrage("sucher", G(1), { name: "A" })).status === 400);
  pruefe("Nachricht über 600 Zeichen → 400", (await anfrage("sucher", G(1), { nachricht: "x".repeat(601) })).status === 400);
  pruefe("krumme gymId → 404", (await anfrage("sucher", "../users")).status === 404);
  pruefe("Gym, das es nicht gibt → 404", (await anfrage("sucher", "mess-ga-gibts-nicht")).status === 404);
  pruefe("ausgeschaltetes Gym → 404", (await anfrage("sucher", GYM_AUS)).status === 404);
  pruefe("… und nichts wurde angelegt", (await dok(GYM_AUS, "sucher")) === null && (await dok(G(1), "sucher")) === null);

  const erste = await anfrage("sucher", G(1), { email: "fremde@adresse.de", uid: "jemand-anders" });
  const d1 = await dok(G(1), "sucher");
  pruefe("Anfrage → 200, Dokument unter der eigenen uid", erste.status === 200 && erste.json?.anfrage?.gymId === G(1) && d1?.uid === uids.sucher, `${erste.status} ${JSON.stringify(erste.json)}`);
  pruefe("E-Mail aus dem KONTO, nicht aus dem Body", d1?.email === email("sucher"), d1?.email);
  pruefe("Name und Nachricht stehen drin", d1?.name === "Mess Sucher" && d1?.nachricht === "Ich will ein Probetraining im MMA.");
  const tage = d1 ? (d1.loeschenAm.toMillis() - d1.erstelltAm.toMillis()) / 86400000 : 0;
  pruefe("Löschfrist 90 Tage nach Eingang", Math.abs(tage - 90) < 0.01, `${tage.toFixed(2)} Tage`);
  pruefe("genau sechs Felder im Dokument", !!d1 && JSON.stringify(Object.keys(d1).sort()) === JSON.stringify(["email", "erstelltAm", "loeschenAm", "nachricht", "name", "uid"]), d1 ? Object.keys(d1).sort().join(",") : "");
  const zweite = await anfrage("sucher", G(1));
  pruefe("zweite Anfrage beim selben Gym → 409", zweite.status === 409, `${zweite.status} ${zweite.json?.error}`);
  const eigen = await anfrage("mitglied", G(1));
  pruefe("eigenes Gym → 409", eigen.status === 409 && (await dok(G(1), "mitglied")) === null, `${eigen.status} ${eigen.json?.error}`);
  pruefe("Mitglied fragt bei einem ANDEREN Gym an → 200", (await anfrage("mitglied", G(2))).status === 200);

  for (const n of [2, 3, 4, 5]) await anfrage("sucher", G(n));
  const sechste = await anfrage("sucher", G(6));
  pruefe("fünf offene Anfragen sind der Deckel → 429", sechste.status === 429 && (await dok(G(6), "sucher")) === null, `${sechste.status} ${sechste.json?.error}`);

  const ms = await meine("sucher");
  pruefe("Suche gibt die eigenen fünf Anfragen mit", ms.length === 5 && ms.every((a) => JSON.stringify(Object.keys(a).sort()) === '["am","gymId"]'), JSON.stringify(ms.map((a) => a.gymId)));
  const mm = await meine("mitglied");
  pruefe("das Mitglied sieht nur SEINE eine", mm.length === 1 && mm[0].gymId === G(2));
  const roh = JSON.stringify((await route("mitglied", "/api/gyms/suche")).json);
  pruefe("keine fremde uid, keine E-Mail, keine Nachricht in der Suche", !roh.includes(uids.sucher) && !roh.includes("mess-ga-sucher") && !roh.includes("Probetraining im MMA"));

  // ─── Regeln ─────────────────────────────────────────────────────────────
  console.log("REGELN (unverändert — Sammlung im Browser zu)");
  pruefe("Absender liest seine Anfrage NICHT per REST", (await rest("sucher", `gyms/${G(1)}/anfragen/${uids.sucher}`)) === 403);
  pruefe("Verwaltung liest die Anfragen NICHT per REST", (await rest("buero1", `gyms/${G(1)}/anfragen/${uids.sucher}`)) === 403);
  pruefe("Verwaltung listet die Sammlung NICHT per REST", (await rest("buero1", `gyms/${G(1)}/anfragen`)) === 403);
  pruefe("niemand schreibt per REST", (await rest("sucher", `gyms/${G(6)}/anfragen/${uids.sucher}`, { method: "PATCH", body: JSON.stringify({ fields: { name: { stringValue: "x" } } }) })) === 403 && (await dok(G(6), "sucher")) === null);

  // ─── Verwaltung ─────────────────────────────────────────────────────────
  console.log("VERWALTUNG /api/gym/anfragen");
  pruefe("ohne Token → 401", (await route(null, "/api/gym/anfragen")).status === 401);
  for (const k of ["trainer", "mitglied", "sucher"]) pruefe(`${k} → 403`, (await route(k, "/api/gym/anfragen")).status === 403);
  const l1 = await route("buero1", "/api/gym/anfragen");
  pruefe("Büro 1 sieht genau die eine Anfrage an Gym 1", l1.status === 200 && l1.json?.anfragen?.length === 1 && l1.json.anfragen[0].uid === uids.sucher && l1.json.anfragen[0].email === email("sucher"), JSON.stringify(l1.json?.anfragen?.map((a) => a.name)));
  pruefe("genau sechs Schlüssel je Anfrage", JSON.stringify(Object.keys(l1.json?.anfragen?.[0] ?? {}).sort()) === JSON.stringify(["email", "erstelltAm", "loeschenAm", "nachricht", "name", "uid"]));
  const l2 = await route("buero2", "/api/gym/anfragen");
  pruefe("Büro 2 sieht seine zwei (Sucher + Mitglied)", l2.json?.anfragen?.length === 2 && l2.json.anfragen.map((a) => a.uid).sort().join() === [uids.sucher, uids.mitglied].sort().join());

  pruefe("erledigt: Trainer → 403", (await route("trainer", "/api/gym/anfragen/erledigt", { uid: uids.sucher })).status === 403);
  const fremdErledigt = await route("buero1", "/api/gym/anfragen/erledigt", { uid: uids.mitglied });
  pruefe("Büro 1 erledigt KEINE Anfrage von Gym 2 (404, bleibt liegen)", fremdErledigt.status === 404 && (await dok(G(2), "mitglied")) !== null, `${fremdErledigt.status}`);
  pruefe("krumme uid → 404", (await route("buero1", "/api/gym/anfragen/erledigt", { uid: "a/b" })).status === 404);
  const erledigt = await route("buero1", "/api/gym/anfragen/erledigt", { uid: uids.sucher });
  pruefe("Büro 1 erledigt → Dokument gelöscht", erledigt.status === 200 && (await dok(G(1), "sucher")) === null);
  pruefe("danach kann dieselbe Person wieder anfragen", (await anfrage("sucher", G(1))).status === 200);

  // ─── Löschfrist ─────────────────────────────────────────────────────────
  console.log("LÖSCHFRIST");
  const alt = Timestamp.fromMillis(Date.now() - 1000);
  await db.collection("gyms").doc(G(2)).collection("anfragen").doc(uids.sucher).update({ loeschenAm: alt });
  pruefe("abgelaufen: steht nicht mehr in der eigenen Liste", !(await meine("sucher")).some((a) => a.gymId === G(2)));
  pruefe("abgelaufen: zählt nicht mehr gegen den Deckel (Gym 6 geht)", (await anfrage("sucher", G(6))).status === 200);
  const l2b = await route("buero2", "/api/gym/anfragen");
  pruefe("abgelaufen: die Verwaltung sieht sie nicht, der Abruf löscht sie", l2b.json?.anfragen?.length === 1 && (await dok(G(2), "sucher")) === null);
  await db.collection("gyms").doc(G(3)).collection("anfragen").doc(uids.sucher).update({ loeschenAm: alt });
  const geloescht = await abgelaufeneAnfragenLoeschen(db, G(3));
  pruefe("Nacht-Job löscht Abgelaufenes, Frisches bleibt", geloescht === 1 && (await dok(G(3), "sucher")) === null && (await abgelaufeneAnfragenLoeschen(db, G(4))) === 0 && (await dok(G(4), "sucher")) !== null);

  // ─── Browser ────────────────────────────────────────────────────────────
  if (!process.env.NUR_API) {
    console.log(`BROWSER (${THEME})`);
    await anfragenWeg();
    const { mkdirSync } = await import("node:fs");
    mkdirSync(OUT, { recursive: true });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
    try {
      const anmelden = async (k, viewport = { width: 1360, height: 950 }) => {
        const ctx = await browser.newContext({ viewport });
        await ctx.addInitScript((t) => localStorage.setItem("ta-theme", t), THEME);
        const page = await ctx.newPage();
        const konsole = [];
        page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
        for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000); if (await page.locator('input[type="email"]').count()) break; }
        await page.fill('input[type="email"]', email(k));
        await page.fill('input[type="password"]', pw);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/(dashboard|kampfprofil|profile|gym-finden|verwaltung|trainer)/, { timeout: 60000 });
        return { ctx, page, konsole };
      };
      const oeffneSuche = async (page) => {
        await page.goto(`${BASE}/gym-finden`, { waitUntil: "domcontentloaded" });
        await page.locator("[data-gym-liste] [data-gym]").first().waitFor({ timeout: 90000 });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1500);
      };
      const heute = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

      // ── Athlet ohne Gym ────────────────────────────────────────────────
      const a = await anmelden("sucher");
      await oeffneSuche(a.page);
      const karte = a.page.locator(`[data-gym="${G(1)}"]`);
      pruefe("Knopf „Probetraining vereinbaren“ an der Gym-Karte", /probetraining vereinbaren/i.test(await karte.locator("[data-gym-anfragen]").innerText()));
      await karte.locator("[data-gym-anfragen]").click();
      const dlg = a.page.locator('[role="dialog"]').filter({ has: a.page.locator("[data-anfrage-formular]") });
      await dlg.waitFor({ timeout: 30000 });
      await a.page.waitForTimeout(700);
      const td = (await dlg.innerText()).replace(/\s+/g, " ");
      pruefe("Sheet: Titel und Gym-Name", /probetraining vereinbaren/i.test(td) && /mess gym stuttgart/i.test(td));
      pruefe("Name vorbelegt, E-Mail des Kontos", (await dlg.locator('[data-anfrage-feld="name"]').inputValue()) === "Mess Sucher" && (await dlg.locator('[data-anfrage-feld="email"]').innerText()).trim() === email("sucher"));
      pruefe("Hinweis: wer es sieht, Antwort per E-Mail, 90 Tage", (await dlg.locator("[data-anfrage-hinweis]").innerText()).replace(/\s+/g, " ") === "Das Gym sieht deinen Namen, deine E-Mail-Adresse und deine Nachricht. Es meldet sich per E-Mail bei dir. Nach 90 Tagen löschen wir die Anfrage.");
      await dlg.locator('[data-anfrage-feld="name"]').fill("");
      await dlg.locator("[data-anfrage-senden]").click();
      await a.page.waitForTimeout(400);
      pruefe("ohne Namen: Satz, nichts gesendet", /Trag deinen Namen ein/.test(await dlg.innerText()) && (await dok(G(1), "sucher")) === null);
      await dlg.locator('[data-anfrage-feld="name"]').fill("Mess Sucher");
      await dlg.locator('[data-anfrage-feld="nachricht"]').fill("Ich boxe seit zwei Jahren und will MMA probieren.\nAbends ab 18 Uhr habe ich Zeit.");
      await a.page.waitForTimeout(400);
      await a.page.screenshot({ path: `${OUT}/anfrage-sheet-${THEME}.png` });
      await dlg.locator("[data-anfrage-senden]").click();
      await karte.locator("[data-gym-angefragt]").waitFor({ timeout: 30000 });
      await a.page.waitForTimeout(800);
      const stand = (await karte.locator("[data-gym-angefragt]").innerText()).replace(/\s+/g, " ");
      pruefe("Karte: „Angefragt am … Das Gym meldet sich per E-Mail bei dir.“", stand === `Angefragt am ${heute}. Das Gym meldet sich per E-Mail bei dir.`, stand);
      pruefe("Knopf ist weg, Sheet ist zu", (await karte.locator("[data-gym-anfragen]").count()) === 0 && (await a.page.locator("[data-anfrage-formular]").count()) === 0);
      const db1 = await dok(G(1), "sucher");
      pruefe("im Dokument: Name, Konto-E-Mail, Nachricht mit Zeilenumbruch", db1?.name === "Mess Sucher" && db1?.email === email("sucher") && db1?.nachricht.includes("\nAbends ab 18 Uhr"));
      await oeffneSuche(a.page);
      pruefe("nach dem Neuladen: weiter „Angefragt“, andere Gyms mit Knopf", (await a.page.locator(`[data-gym="${G(1)}"] [data-gym-angefragt]`).count()) === 1 && (await a.page.locator(`[data-gym="${G(2)}"] [data-gym-anfragen]`).count()) === 1);
      await a.page.screenshot({ path: `${OUT}/anfrage-karte-${THEME}.png` });
      const lautA = a.konsole.filter((k) => !/403|permission|Failed to load resource|WebGL|GPU/i.test(k));
      pruefe("Konsole ohne Fehler (Athlet)", lautA.length === 0, lautA.slice(0, 3).join(" | "));
      await a.ctx.close();

      // ── Handy ──────────────────────────────────────────────────────────
      const h = await anmelden("sucher", { width: 390, height: 844 });
      await oeffneSuche(h.page);
      await h.page.locator(`[data-gym="${G(2)}"] [data-gym-anfragen]`).click();
      await h.page.locator("[data-anfrage-formular]").waitFor({ timeout: 30000 });
      await h.page.waitForTimeout(900);
      const breite = await h.page.evaluate(() => document.documentElement.scrollWidth);
      const knopf = await h.page.locator("[data-anfrage-senden]").boundingBox();
      pruefe("Handy: Sheet passt, „Anfrage senden“ im Bild", breite <= 391 && !!knopf && knopf.y + knopf.height <= 844, `${breite}px, Knopf bis ${knopf ? Math.round(knopf.y + knopf.height) : "?"}`);
      await h.page.screenshot({ path: `${OUT}/anfrage-sheet-handy-${THEME}.png` });
      await h.ctx.close();

      // ── Mitglied ───────────────────────────────────────────────────────
      const m = await anmelden("mitglied");
      await oeffneSuche(m.page);
      pruefe("Mitglied: am eigenen Gym kein Knopf, am fremden schon", (await m.page.locator(`[data-gym="${G(1)}"] [data-gym-anfragen]`).count()) === 0 && (await m.page.locator(`[data-gym="${G(2)}"] [data-gym-anfragen]`).count()) === 1);
      await m.ctx.close();

      // ── Verwaltung ─────────────────────────────────────────────────────
      const v = await anmelden("buero1");
      await v.page.goto(`${BASE}/verwaltung/mitglieder`, { waitUntil: "domcontentloaded" });
      await v.page.locator("#anfragen").waitFor({ timeout: 90000 });
      await v.page.waitForLoadState("networkidle").catch(() => {});
      await v.page.waitForTimeout(1500);
      const abschnitt = v.page.locator("#anfragen");
      pruefe("Mitglieder-Seite: Abschnitt „Anfragen“ mit der Zahl 1", /anfragen/i.test(await abschnitt.locator("h2").innerText()) && (await abschnitt.locator("[data-anfragen-zahl]").innerText()).trim() === "1");
      const zeile = abschnitt.locator(`[data-anfrage="${uids.sucher}"]`);
      const tz = (await zeile.innerText()).replace(/\s+/g, " ");
      pruefe("Zeile: Name, „Probetraining“, Datum, Anfang der Nachricht", tz.includes("Mess Sucher") && /probetraining/i.test(tz) && tz.includes(heute) && tz.includes("Ich boxe seit zwei Jahren"), tz);
      pruefe("Abschnitt steht ÜBER den Mitgliedern", (await abschnitt.boundingBox()).y < (await v.page.locator("button.mitglied-zeile").filter({ hasText: "Mess Büro Eins" }).first().boundingBox()).y);
      await v.page.screenshot({ path: `${OUT}/anfragen-verwaltung-${THEME}.png` });
      await zeile.click();
      const vd = v.page.locator('[role="dialog"]').filter({ has: v.page.locator("[data-anfrage-erledigt]") });
      await vd.waitFor({ timeout: 30000 });
      await v.page.waitForTimeout(700);
      const tv = (await vd.innerText()).replace(/\s+/g, " ");
      pruefe("Sheet: Name, E-Mail, ganze Nachricht", tv.includes("Mess Sucher") && tv.includes(email("sucher")) && tv.includes("Abends ab 18 Uhr habe ich Zeit."));
      const mail = await vd.locator("[data-anfrage-mail]").getAttribute("href");
      pruefe("„E-Mail schreiben“ öffnet das eigene Postfach (mailto)", mail === `mailto:${email("sucher")}?subject=${encodeURIComponent("Dein Probetraining bei Mess Gym Stuttgart")}`, mail);
      await v.page.screenshot({ path: `${OUT}/anfrage-detail-${THEME}.png` });
      await vd.locator("[data-anfrage-erledigt]").click();
      await v.page.waitForTimeout(300);
      pruefe("„Erledigt“ fragt nach: „Ja, löschen“ — noch nichts gelöscht", /ja, löschen/i.test(await vd.locator("[data-anfrage-erledigt]").innerText()) && (await dok(G(1), "sucher")) !== null);
      await vd.locator("[data-anfrage-erledigt]").click();
      await v.page.locator("#anfragen").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
      pruefe("erledigt: Abschnitt weg, Dokument gelöscht", (await v.page.locator("#anfragen").count()) === 0 && (await dok(G(1), "sucher")) === null);
      const lautV = v.konsole.filter((k) => !/403|permission|Failed to load resource|WebGL|GPU/i.test(k));
      pruefe("Konsole ohne Fehler (Verwaltung)", lautV.length === 0, lautV.slice(0, 3).join(" | "));
      await v.ctx.close();
    } finally {
      await browser.close();
    }
  }
} catch (err) {
  abgebrochen = err;
} finally {
  await anfragenWeg().catch(() => {});
  for (const uid of Object.values(uids)) {
    await db.collection("users").doc(uid).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
  }
  for (const g of Object.keys(GYMS)) await db.collection("gyms").doc(g).delete().catch(() => {});
  if (abgebrochen) console.log("\nABGEBROCHEN:", abgebrochen?.stack ?? abgebrochen);
  const gruen = !abgebrochen && ok.every(Boolean);
  console.log(`\n${ok.filter(Boolean).length}/${ok.length}${gruen ? " ALLE PRÜFUNGEN BESTANDEN" : " — FEHLER"} · aufgeräumt`);
  if (!gruen) process.exitCode = 1;
}
