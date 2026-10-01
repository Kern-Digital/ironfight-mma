/**
 * MESSUNG „Kontakt & Standort" (01.10.2026, Etappe 2 der Gym-Suche).
 *
 *   node --use-system-ca scripts/mess-gym-kontakt.mjs              # Routen + Regeln + Browser (hell)
 *   THEME=dark node --use-system-ca scripts/mess-gym-kontakt.mjs
 *   NUR_API=1 node --use-system-ca scripts/mess-gym-kontakt.mjs    # ohne Browser
 *
 * Braucht den Dev-Server (BASE). Legt zwei Prüf-Gyms an (A mit Verwaltung,
 * Trainer, Athlet; B mit Verwaltung und einem Abo-Feld als Köder), dazu ein
 * Konto ohne Gym, und räumt alles weg. Keine KI-Kosten.
 *
 * Was sie beweist (CLAUDE.md „GYM-SUCHE — ETAPPE 2"):
 *   SCHREIBEN (POST /api/gym/kontakt)
 *   • ohne Token 401; Athlet, Trainer ohne Verwaltung, Konto ohne Gym 403
 *   • krumme PLZ, E-Mail, Website (javascript:), halber Pin → 400 mit Feld
 *   • volle Adresse + Pin → gespeichert, `sichtbar` true, Website mit https://
 *   • ein `gymId` im Body trifft NICHT das fremde Gym
 *   LESEN (POST /api/gyms/suche)
 *   • ohne Token 401; ein Konto ohne Gym bekommt die Liste
 *   • je Gym GENAU zehn Schlüssel — kein Abo, kein Stripe, kein Branding
 *   • Schalter aus, Adresse unvollständig, Pin fehlt → nicht in der Liste
 *   • ein von Hand gesetztes `sichtbar` ohne Adresse → nicht in der Liste
 *   REGELN (unverändert)
 *   • das Konto ohne Gym liest das Gym-Dokument weiter NICHT (403)
 *   BROWSER (Verwaltung von A)
 *   • Menüpunkt „Kontakt & Standort", Hinweis „öffentlich"
 *   • PLZ trägt den Ort ein und setzt den Pin; Speichern meldet den Stand
 *   • Schalter aus → der Satz folgt; nach dem Neuladen steht alles wieder da
 */
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "light";
const OUT = "../abnahme-gym-suche";
const GYM_A = "mess-gk-a";
const GYM_B = "mess-gk-b";

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
const pw = `mess-gk-${Math.random().toString(36).slice(2)}A1!`;
const OHNE = { trainer: false, verwaltung: false, admin: false };

const KONTEN = {
  bueroA:   { name: "Mess Büro A",    gym: GYM_A, claim: { ...OHNE, verwaltung: true } },
  trainerA: { name: "Mess Trainer A", gym: GYM_A, claim: { ...OHNE, trainer: true } },
  athletA:  { name: "Mess Athlet A",  gym: GYM_A, claim: OHNE },
  bueroB:   { name: "Mess Büro B",    gym: GYM_B, claim: { ...OHNE, verwaltung: true } },
  fremd:    { name: "Mess Fremd",     gym: null,  claim: OHNE },
};
const email = (k) => `mess-gk-${k.toLowerCase()}@tidal-athletics.invalid`;
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
  return { status: r.status, json, cache: r.headers.get("cache-control") };
}
const lese = async (k, pfad) => (await fetch(`${FS}/${pfad}`, { headers: { authorization: `Bearer ${await token(k)}` } })).status;
const kontaktVon = async (gym) => (await db.collection("gyms").doc(gym).get()).get("kontakt") ?? null;

const VOLL = {
  strasse: "Königstraße 1", plz: "70173", ort: "Stuttgart",
  telefon: "0711 123456", email: "Info@Mess-Gym.de", website: "mess-gym.de",
  lat: 48.7784, lng: 9.1800, inSuche: true,
};
const SCHLUESSEL = ["email", "id", "lat", "lng", "name", "ort", "plz", "strasse", "telefon", "website"];

try {
  // ─── Aufbau ─────────────────────────────────────────────────────────────
  await db.collection("gyms").doc(GYM_A).set({ name: "Mess Gym Alpha", status: "active", createdAt: Timestamp.now(), branding: null });
  await db.collection("gyms").doc(GYM_B).set({
    name: "Mess Gym Beta", status: "active", createdAt: Timestamp.now(),
    branding: { logoUrl: "data:image/png;base64,GEHEIMLOGO", akzentH: 20, akzentC: 0.2 },
    subscription: { status: "active", plan: "gym", stripeCustomerId: "cus_GEHEIM" },
  });
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

  // ─── Schreiben ──────────────────────────────────────────────────────────
  console.log("SCHREIBEN /api/gym/kontakt");
  pruefe("ohne Token → 401", (await route(null, "/api/gym/kontakt", VOLL)).status === 401);
  for (const k of ["athletA", "trainerA", "fremd"]) {
    const r = await route(k, "/api/gym/kontakt", VOLL);
    pruefe(`${k} → 403`, r.status === 403, `${r.status}`);
  }
  pruefe("… und am Gym steht nichts", (await kontaktVon(GYM_A)) === null);
  const krumm = [
    ["PLZ mit Buchstaben", { ...VOLL, plz: "7O173" }, "plz"],
    ["E-Mail ohne @", { ...VOLL, email: "info.mess-gym.de" }, "email"],
    ["Website javascript:", { ...VOLL, website: "javascript:alert(1)" }, "website"],
    ["Telefon mit Text", { ...VOLL, telefon: "ruf an!" }, "telefon"],
    ["halber Pin", { ...VOLL, lng: null }, "lat"],
    ["Pin außerhalb", { ...VOLL, lat: 123 }, "lat"],
  ];
  for (const [name, body, feld] of krumm) {
    const r = await route("bueroA", "/api/gym/kontakt", body);
    pruefe(`${name} → 400 (${feld})`, r.status === 400 && r.json?.feld === feld, `${r.status} ${JSON.stringify(r.json)}`);
  }
  const gut = await route("bueroA", "/api/gym/kontakt", { ...VOLL, gymId: GYM_B, sichtbar: false });
  const kA = await kontaktVon(GYM_A);
  pruefe("volle Adresse + Pin → 200, sichtbar", gut.status === 200 && gut.json?.sichtbar === true && kA?.sichtbar === true, `${gut.status} ${JSON.stringify(gut.json)}`);
  pruefe("Website bekommt https://, E-Mail klein", kA?.website === "https://mess-gym.de" && kA?.email === "info@mess-gym.de", `${kA?.website} ${kA?.email}`);
  pruefe("gymId im Body trifft Gym B nicht", (await kontaktVon(GYM_B)) === null);
  const gymA = (await db.collection("gyms").doc(GYM_A).get()).data();
  pruefe("Name, Status, Branding von A unberührt", gymA.name === "Mess Gym Alpha" && gymA.status === "active" && gymA.kontaktGeaendertVon === uids.bueroA);

  // ─── Lesen ──────────────────────────────────────────────────────────────
  console.log("LESEN /api/gyms/suche");
  pruefe("ohne Token → 401", (await route(null, "/api/gyms/suche")).status === 401);
  const meine = (r) => (r.json?.gyms ?? []).filter((g) => g.id === GYM_A || g.id === GYM_B);
  let s = await route("fremd", "/api/gyms/suche");
  let a = meine(s).find((g) => g.id === GYM_A);
  pruefe("Konto ohne Gym bekommt die Liste, A steht drin", s.status === 200 && !!a, `${s.status}`);
  pruefe("genau zehn Schlüssel je Gym", !!a && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(SCHLUESSEL), a ? Object.keys(a).sort().join(",") : "");
  pruefe("Inhalt stimmt", a?.name === "Mess Gym Alpha" && a?.strasse === VOLL.strasse && a?.plz === "70173" && a?.lat === 48.7784 && a?.lng === 9.18);
  pruefe("B ohne Adresse steht NICHT drin", !meine(s).some((g) => g.id === GYM_B));
  pruefe("no-store", /no-store/.test(s.cache ?? ""));

  await route("bueroB", "/api/gym/kontakt", { ...VOLL, strasse: "Marienplatz 1", plz: "80331", ort: "München", lat: 48.1374, lng: 11.5755, email: "", website: "", telefon: "" });
  s = await route("athletA", "/api/gyms/suche");
  const roh = JSON.stringify(s.json);
  pruefe("B mit Adresse steht drin (auch für ein Mitglied von A)", meine(s).some((g) => g.id === GYM_B));
  pruefe("kein Abo, kein Stripe, kein Branding in der Antwort", !/cus_GEHEIM|GEHEIMLOGO|subscription|branding|stripe|kontaktGeaendert|sichtbar|inSuche/i.test(roh));
  pruefe("nach Name sortiert", (() => { const n = (s.json?.gyms ?? []).map((g) => g.name); return n.every((x, i) => i === 0 || n[i - 1].localeCompare(x, "de", { sensitivity: "base" }) <= 0); })());

  const nichtDrin = async (name, body) => {
    const w = await route("bueroA", "/api/gym/kontakt", body);
    const l = await route("fremd", "/api/gyms/suche");
    pruefe(`${name} → nicht in der Suche`, w.status === 200 && w.json?.sichtbar === false && !meine(l).some((g) => g.id === GYM_A), `${w.status} ${w.json?.sichtbar}`);
  };
  await nichtDrin("Schalter aus", { ...VOLL, inSuche: false });
  await nichtDrin("ohne Straße", { ...VOLL, strasse: "" });
  await nichtDrin("ohne Pin", { ...VOLL, lat: null, lng: null });
  await db.collection("gyms").doc(GYM_A).update({ "kontakt.sichtbar": true });
  pruefe("von Hand gesetztes `sichtbar` ohne Pin → nicht in der Suche", !meine(await route("fremd", "/api/gyms/suche")).some((g) => g.id === GYM_A));

  // ─── Regeln ─────────────────────────────────────────────────────────────
  console.log("REGELN (unverändert)");
  pruefe("Konto ohne Gym liest das Gym-Dokument NICHT", (await lese("fremd", `gyms/${GYM_B}`)) === 403);
  pruefe("Mitglied von A liest Gym B NICHT", (await lese("athletA", `gyms/${GYM_B}`)) === 403);
  pruefe("Mitglied von A liest sein Gym", (await lese("athletA", `gyms/${GYM_A}`)) === 200);

  // ─── Browser ────────────────────────────────────────────────────────────
  if (!process.env.NUR_API) {
    console.log(`BROWSER (${THEME})`);
    // Sauberer Start: A ohne Kontakt.
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("gyms").doc(GYM_A).update({ kontakt: FieldValue.delete() });
    const { mkdirSync } = await import("node:fs");
    mkdirSync(OUT, { recursive: true });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
    try {
      const ctx = await browser.newContext({ viewport: { width: 1360, height: 1500 } });
      await ctx.addInitScript((t) => localStorage.setItem("ta-theme", t), THEME);
      const page = await ctx.newPage();
      const konsole = [];
      page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
      for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000); if (await page.locator('input[type="email"]').count()) break; }
      await page.fill('input[type="email"]', email("bueroA"));
      await page.fill('input[type="password"]', pw);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|verwaltung|trainer)/, { timeout: 60000 });
      const geladen = async () => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500); };
      const text = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

      await page.goto(`${BASE}/verwaltung/kontakt`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-kontakt-speichern]").waitFor({ timeout: 90000 });
      await geladen();
      let t = await text();
      pruefe("Menüpunkt „Kontakt & Standort“", (await page.locator('a[href="/verwaltung/kontakt"]').count()) > 0);
      pruefe("Hinweis: öffentlich in der Gym-Suche", /Diese Angaben stehen öffentlich in der Gym-Suche/.test(await page.locator("[data-kontakt-oeffentlich]").innerText()));
      pruefe("Schalter steht AN, Satz verlangt die Adresse", (await page.locator("[data-kontakt-schalter]").getAttribute("aria-checked")) === "true" && /Trag Straße, PLZ und Ort ein/.test(t));
      await page.locator(".karte canvas").first().waitFor({ timeout: 60000 }).catch(() => {});
      pruefe("Karte gezeichnet, noch kein Pin", (await page.locator(".karte canvas").count()) === 1 && (await page.locator(".karte-pin").count()) === 0);

      await page.fill('[data-kontakt-feld="strasse"]', "Königstraße 1");
      await page.fill('[data-kontakt-feld="plz"]', "70173");
      await page.waitForTimeout(1500);
      pruefe("PLZ trägt den Ort ein", (await page.inputValue('[data-kontakt-feld="ort"]')) === "Stuttgart", await page.inputValue('[data-kontakt-feld="ort"]'));
      pruefe("PLZ setzt den Pin", (await page.locator(".karte-pin").count()) === 1);
      t = await text();
      pruefe("Satz folgt: „Mit diesen Angaben steht dein Gym in der Gym-Suche.“", t.includes("Mit diesen Angaben steht dein Gym in der Gym-Suche."));
      await page.fill('[data-kontakt-feld="telefon"]', "0711 123456");
      await page.fill('[data-kontakt-feld="email"]', "info@mess-gym.de");
      await page.fill('[data-kontakt-feld="website"]', "mess-gym.de");

      // Auf die Karte tippen versetzt den Pin.
      await page.waitForTimeout(1500);
      const kasten = await page.locator(".karte").boundingBox();
      pruefe("Karte hat Höhe und Zoom-Knöpfe", kasten.height > 200 && (await page.locator(".karte .maplibregl-ctrl-zoom-in").count()) === 1 && (await page.locator(".karte canvas").boundingBox()).height > 200, `${kasten.height}px`);
      await page.locator(".karte canvas").click({ position: { x: kasten.width * 0.3, y: kasten.height * 0.35 } });
      await page.waitForTimeout(600);
      pruefe("nach dem Tipp: Knopf „Pin auf die PLZ setzen“", /pin auf die plz setzen/i.test(await text()));

      await page.locator("[data-kontakt-speichern]").click();
      await page.locator("[data-kontakt-gesichert]").waitFor({ timeout: 30000 });
      pruefe("„Gespeichert. Dein Gym steht in der Gym-Suche.“", (await page.locator("[data-kontakt-gesichert]").innerText()).includes("Dein Gym steht in der Gym-Suche."));
      const gespeichert = await kontaktVon(GYM_A);
      pruefe("im Dokument: Adresse, sichtbar, Pin neben der PLZ-Mitte", gespeichert?.sichtbar === true && gespeichert?.strasse === "Königstraße 1" && gespeichert?.ort === "Stuttgart" && typeof gespeichert?.lat === "number" && Math.abs(gespeichert.lat - 48.77) < 0.2, JSON.stringify(gespeichert));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/kontakt-${THEME}.png` });

      await page.locator("[data-kontakt-schalter]").click();
      pruefe("Schalter aus → „Dein Gym bleibt aus der Gym-Suche.“", (await page.locator("[data-kontakt-stand]").innerText()).includes("Dein Gym bleibt aus der Gym-Suche."));
      await page.locator("[data-kontakt-schalter]").click();

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-kontakt-speichern]").waitFor({ timeout: 90000 });
      await geladen();
      pruefe("nach dem Neuladen steht alles wieder da", (await page.inputValue('[data-kontakt-feld="strasse"]')) === "Königstraße 1" && (await page.inputValue('[data-kontakt-feld="website"]')) === "https://mess-gym.de" && (await page.locator(".karte-pin").count()) === 1);

      await page.fill('[data-kontakt-feld="email"]', "kaputt");
      await page.locator("[data-kontakt-speichern]").click();
      await page.locator('[role="alert"]').filter({ hasText: "E-Mail" }).waitFor({ timeout: 30000 }).catch(() => {});
      pruefe("krumme E-Mail: Satz + markiertes Feld", /Trag eine E-Mail-Adresse ein/.test(await text()) && (await page.getAttribute('[data-kontakt-feld="email"]', "aria-invalid")) === "true");

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-kontakt-speichern]").waitFor({ timeout: 90000 });
      await geladen();
      const breite = await page.evaluate(() => document.documentElement.scrollWidth);
      pruefe("Handy: nichts läuft über den Rand", breite <= 391, `${breite}px`);
      await page.screenshot({ path: `${OUT}/kontakt-handy-${THEME}.png`, fullPage: true });

      const laut = konsole.filter((k) => !/403|permission|Failed to load resource|WebGL|GPU/i.test(k));
      pruefe("Konsole ohne Fehler", laut.length === 0, laut.slice(0, 3).join(" | "));
      await ctx.close();
    } finally {
      await browser.close();
    }
  }
} catch (err) {
  abgebrochen = err;
} finally {
  for (const uid of Object.values(uids)) {
    await db.collection("users").doc(uid).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
  }
  for (const g of [GYM_A, GYM_B]) {
    const audit = await db.collection("gyms").doc(g).collection("auditLog").get();
    for (const d of audit.docs) await d.ref.delete();
    await db.collection("gyms").doc(g).delete().catch(() => {});
  }
  if (abgebrochen) console.log("\nABGEBROCHEN:", abgebrochen?.stack ?? abgebrochen);
  const gruen = !abgebrochen && ok.every(Boolean);
  console.log(`\n${ok.filter(Boolean).length}/${ok.length}${gruen ? " ALLE PRÜFUNGEN BESTANDEN" : " — FEHLER"} · aufgeräumt`);
  if (!gruen) process.exitCode = 1;
}
