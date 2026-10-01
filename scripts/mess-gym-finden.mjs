/**
 * MESSUNG „/gym-finden" (01.10.2026, Etappe 3 der Gym-Suche).
 *
 *   node --use-system-ca --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gym-finden.mjs
 *   THEME=dark node --use-system-ca --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gym-finden.mjs
 *   NUR_LOGIK=1 node --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gym-finden.mjs   # ohne Server
 *
 * Braucht den Dev-Server (BASE). Legt vier Prüf-Gyms an (Stuttgart,
 * Esslingen, München, dazu eines mit Schalter AUS) und zwei Konten (ohne
 * Gym, Mitglied in Stuttgart) und räumt alles weg. Keine KI-Kosten.
 *
 * Was sie beweist (CLAUDE.md „GYM-SUCHE — ETAPPE 3"):
 *   LOGIK (lib/plz.ts gegen die echte Tabelle)
 *   • PLZ-Anfang, Ortsname, Umschrift (Muenchen), Neunkirchen ≠ Neuenkirchen
 *   • Entfernung Stuttgart–München stimmt auf wenige Kilometer
 *   BROWSER (Konto ohne Gym)
 *   • die Seite öffnet mit ALLEN Gyms, das ausgeschaltete fehlt, je Gym ein Pin
 *   • PLZ → Vorschlag → Umkreis 25 km: nur die Gyms darin, nächstes zuerst
 *   • Regler größer/kleiner ändert die Liste; „Alle anzeigen" nimmt die Mitte weg
 *   • Ortsname + Enter; leerer Umkreis hat einen eigenen Satz
 *   • „Meinen Standort nutzen" → „um deinen Standort"; ohne Freigabe ein Satz
 *   • Liste ↔ Karte: Antippen wählt in beide Richtungen
 *   • Telefon, E-Mail, Website als Links; Quelle der PLZ-Daten steht da
 *   • KEINE Anfrage an eine fremde Adresse außer Firebase und den Kacheln;
 *     die Suche-Route bekommt keinen Body (der Standort verlässt das Gerät nicht)
 *   • Mitglied sieht „Dein Gym"; Handy ohne Überlauf
 */
import { readFileSync } from "node:fs";
import { ladePlzTabelle as _unbenutzt, sucheOrte, ortZurPlz, entfernungKm } from "../lib/plz.ts";

const ok = [];
let abgebrochen = null;
const pruefe = (name, bed, info = "") => { ok.push(!!bed); console.log(bed ? "  OK  " : "  FEHL", name, info ? `(${info})` : ""); };
void _unbenutzt;

// ─── Logik ──────────────────────────────────────────────────────────────────
console.log("LOGIK (lib/plz.ts)");
const tab = JSON.parse(readFileSync("public/daten/plz-de.json", "utf8"));
{
  const p = sucheOrte(tab, "701");
  pruefe("„701“ → 70173 Stuttgart zuerst", p[0]?.titel === "70173 Stuttgart", p.map((x) => x.titel).join(" | "));
  const s = sucheOrte(tab, "Stuttgart");
  pruefe("„Stuttgart“ → Stuttgart, Baden-Württemberg", s[0]?.titel === "Stuttgart" && s[0]?.zusatz === "Baden-Württemberg", JSON.stringify(s[0]));
  for (const q of ["München", "Muenchen", "munchen", "MÜNCH"]) {
    const m = sucheOrte(tab, q);
    pruefe(`„${q}“ → München zuerst`, m[0]?.titel === "München" && m[0]?.zusatz === "Bayern", m.map((x) => x.titel).slice(0, 3).join(" | "));
  }
  const nk = sucheOrte(tab, "Neunkirchen", 20);
  pruefe("„Neunkirchen“ findet Neuenkirchen NICHT", nk.length > 0 && nk.every((x) => !x.titel.startsWith("Neuenkirchen")), nk.map((x) => x.titel).slice(0, 4).join(" | "));
  const ne = sucheOrte(tab, "Neuenkirchen", 20);
  pruefe("gleichnamige Orte tragen PLZ + Land", ne.length >= 5 && ne.every((x) => /^\d{5} · /.test(x.zusatz)), ne[0]?.zusatz);
  pruefe("ein Buchstabe sucht noch nicht", sucheOrte(tab, "S").length === 0);
  pruefe("Großkunden-PLZ 10875 gibt es nicht", ortZurPlz(tab, "10875") === null);
  const km = entfernungKm({ lat: 48.7784, lng: 9.18 }, { lat: 48.1374, lng: 11.5755 });
  pruefe("Stuttgart–München ≈ 190 km", Math.abs(km - 190) < 6, km.toFixed(1));
}

if (!process.env.NUR_LOGIK) {
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
  const { initAdmin } = await import("./lib/admin-app.mjs");
  const { claimsWithRights, rightsMirror } = await import("./lib/role-claims.mjs");

  const BASE = process.env.BASE ?? "http://localhost:3000";
  const THEME = process.env.THEME ?? "light";
  const OUT = "../abnahme-gym-suche";
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;

  initAdmin();
  const auth = getAuth();
  const db = getFirestore();
  const pw = `mess-gf-${Math.random().toString(36).slice(2)}A1!`;
  const OHNE = { trainer: false, verwaltung: false, admin: false };
  const kontakt = (x) => ({ telefon: "", email: "", website: "", inSuche: true, sichtbar: true, ...x });
  const GYMS = {
    "mess-gf-stuttgart": { name: "Mess Gym Stuttgart", kontakt: kontakt({ strasse: "Königstraße 1", plz: "70173", ort: "Stuttgart", lat: 48.7784, lng: 9.18, telefon: "0711 123456", email: "info@mess-stuttgart.de", website: "https://mess-stuttgart.de" }) },
    "mess-gf-esslingen": { name: "Mess Gym Esslingen", kontakt: kontakt({ strasse: "Marktplatz 2", plz: "73728", ort: "Esslingen am Neckar", lat: 48.7427, lng: 9.3071 }) },
    "mess-gf-muenchen": { name: "Mess Gym München", kontakt: kontakt({ strasse: "Marienplatz 1", plz: "80331", ort: "München", lat: 48.1374, lng: 11.5755 }) },
    "mess-gf-aus": { name: "Mess Gym Ausgeschaltet", kontakt: kontakt({ strasse: "Schlossplatz 3", plz: "70173", ort: "Stuttgart", lat: 48.7786, lng: 9.1797, inSuche: false, sichtbar: false }) },
  };
  const KONTEN = {
    fremd: { name: "Mess Sucher", gym: null },
    mitglied: { name: "Mess Mitglied", gym: "mess-gf-stuttgart" },
  };
  const email = (k) => `mess-gf-${k}@tidal-athletics.invalid`;
  const uids = {};

  try {
    for (const [id, g] of Object.entries(GYMS)) {
      await db.collection("gyms").doc(id).set({ name: g.name, status: "active", createdAt: Timestamp.now(), branding: null, kontakt: g.kontakt });
    }
    for (const [k, v] of Object.entries(KONTEN)) {
      let u;
      try { u = await auth.getUserByEmail(email(k)); await auth.updateUser(u.uid, { password: pw }); }
      catch { u = await auth.createUser({ email: email(k), password: pw, displayName: v.name, emailVerified: true }); }
      uids[k] = u.uid;
      await auth.setCustomUserClaims(u.uid, claimsWithRights(v.gym ? { gymId: v.gym } : {}, OHNE));
      await db.collection("users").doc(u.uid).set({
        email: email(k), displayName: v.name, ...(v.gym ? { gymId: v.gym } : {}),
        onboarded: true, trainerOnboarded: true, createdAt: Timestamp.now(), ...rightsMirror(OHNE),
      });
    }

    // Was die Route gerade liefert — in Produktion können echte Gyms dazukommen.
    const tok = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email("fremd"), password: pw, returnSecureToken: true }),
    })).json()).idToken;
    const alle = (await (await fetch(`${BASE}/api/gyms/suche`, { method: "POST", headers: { authorization: `Bearer ${tok}` } })).json()).gyms;
    const imUmkreis = (m, km) => alle.filter((g) => entfernungKm(m, g) <= km).sort((a, b) => entfernungKm(m, a) - entfernungKm(m, b));
    const STUTTGART = ortZurPlz(tab, "70173");
    const wort = (n) => `${n} ${n === 1 ? "Gym" : "Gyms"}`;

    console.log(`BROWSER (${THEME})`);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(OUT, { recursive: true });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"] });
    try {
      const anmelden = async (k, opts = {}) => {
        const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, ...opts });
        await ctx.addInitScript((t) => localStorage.setItem("ta-theme", t), THEME);
        const page = await ctx.newPage();
        const konsole = [];
        const anfragen = [];
        page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
        page.on("request", (r) => anfragen.push({ url: r.url(), method: r.method(), body: r.postData() }));
        for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000); if (await page.locator('input[type="email"]').count()) break; }
        await page.fill('input[type="email"]', email(k));
        await page.fill('input[type="password"]', pw);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/(dashboard|kampfprofil|profile|gym-finden)/, { timeout: 60000 });
        return { ctx, page, konsole, anfragen };
      };
      const oeffne = async (page) => {
        await page.goto(`${BASE}/gym-finden`, { waitUntil: "domcontentloaded" });
        await page.locator("[data-gym-liste] [data-gym]").first().waitFor({ timeout: 90000 });
        await page.locator(".karte canvas").waitFor({ timeout: 60000 });
        await page.waitForTimeout(1500);
      };
      const ids = (page) => page.locator("[data-gym-liste] [data-gym]").evaluateAll((els) => els.map((e) => e.dataset.gym));
      const zahl = async (page) => (await page.locator("[data-gym-zahl]").innerText()).trim();
      const suche = async (page, text) => {
        if (await page.locator("[data-gym-suchfeld] input").count() === 0) await page.locator("[data-gym-suchfeld] [role=button]").click();
        await page.locator("[data-gym-suchfeld] input").fill(text);
      };

      // ── Konto ohne Gym, Standort bei München freigegeben ───────────────
      const MUC = { latitude: 48.14, longitude: 11.58 };
      const { ctx, page, konsole, anfragen } = await anmelden("fremd", { geolocation: MUC, permissions: ["geolocation"] });
      await oeffne(page);
      let l = await ids(page);
      pruefe("öffnet mit ALLEN Gyms", (await zahl(page)) === `${wort(alle.length)} auf Tidal Athletics` && l.length === alle.length, await zahl(page));
      pruefe("Stuttgart, Esslingen, München stehen drin", ["mess-gf-stuttgart", "mess-gf-esslingen", "mess-gf-muenchen"].every((g) => l.includes(g)));
      pruefe("das ausgeschaltete Gym fehlt", !l.includes("mess-gf-aus"));
      pruefe("je Gym ein Pin", (await page.locator(".karte [data-gym-pin]").count()) === alle.length);
      pruefe("kein Umkreis-Regler ohne Mitte", (await page.locator("[data-gym-umkreis]").count()) === 0);
      pruefe("Leiste: Gym finden", /gym finden/i.test(await page.locator('nav[aria-label="Hauptnavigation"]').innerText()));

      // PLZ
      await suche(page, "701");
      await page.locator("[data-gym-vorschlaege] button").first().waitFor({ timeout: 30000 });
      pruefe("Vorschlag „70173 Stuttgart“", (await page.locator("[data-gym-vorschlaege] button").first().innerText()).includes("70173 Stuttgart"));
      await page.locator("[data-gym-vorschlaege] button").first().click();
      await page.waitForTimeout(900);
      let soll = imUmkreis(STUTTGART, 25);
      l = await ids(page);
      pruefe("Umkreis 25 km um 70173 Stuttgart", (await zahl(page)) === `${wort(soll.length)} im Umkreis von 25 km um 70173 Stuttgart`, await zahl(page));
      pruefe("nur Gyms im Umkreis, nächstes zuerst", JSON.stringify(l) === JSON.stringify(soll.map((g) => g.id)) && l[0] === "mess-gf-stuttgart" && l.includes("mess-gf-esslingen") && !l.includes("mess-gf-muenchen"), l.join(","));
      pruefe("Entfernung steht an der Karte", /\d,\d km|\d+ km/.test(await page.locator('[data-gym="mess-gf-esslingen"]').innerText()), (await page.locator('[data-gym="mess-gf-esslingen"]').innerText()).replace(/\s+/g, " "));
      pruefe("Vorschläge sind zu, Pins = Liste", (await page.locator("[data-gym-vorschlaege]").count()) === 0 && (await page.locator(".karte [data-gym-pin]").count()) === soll.length);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/gym-finden-${THEME}.png` });

      // Regler
      const regler = page.locator('[data-gym-umkreis] input[type="range"]');
      await regler.fill(await regler.getAttribute("max"));
      await page.waitForTimeout(600);
      pruefe("Regler ganz rechts (300 km): München kommt dazu", (await ids(page)).includes("mess-gf-muenchen") && /300 km/.test(await zahl(page)), await zahl(page));
      await regler.fill("0");
      await page.waitForTimeout(600);
      soll = imUmkreis(STUTTGART, 5);
      l = await ids(page);
      pruefe("Regler ganz links (5 km): Esslingen fällt raus", !l.includes("mess-gf-esslingen") && l.includes("mess-gf-stuttgart") && l.length === soll.length, l.join(","));

      // Alle anzeigen
      await page.locator("[data-gym-alle]").click();
      await page.waitForTimeout(600);
      pruefe("„Alle anzeigen“ nimmt die Mitte weg", (await ids(page)).length === alle.length && (await page.locator("[data-gym-umkreis]").count()) === 0 && (await page.locator("[data-gym-alle]").count()) === 0);

      // Ortsname + Enter
      await suche(page, "Münch");
      await page.locator("[data-gym-vorschlaege] button").first().waitFor({ timeout: 30000 });
      pruefe("Vorschlag „München · Bayern“", /München\s*Bayern/.test((await page.locator("[data-gym-vorschlaege] button").first().innerText()).replace(/\s+/g, " ")));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(900);
      l = await ids(page);
      pruefe("Enter nimmt den ersten Vorschlag", /um München$/.test(await zahl(page)) && l[0] === "mess-gf-muenchen" && !l.includes("mess-gf-stuttgart"), await zahl(page));

      // Leerer Umkreis
      await suche(page, "24937");
      await page.locator("[data-gym-vorschlaege] button").first().click();
      await regler.fill("0");
      await page.waitForTimeout(600);
      if (imUmkreis(ortZurPlz(tab, "24937"), 5).length === 0) {
        pruefe("leerer Umkreis: eigener Satz + „Alle anzeigen“", /Im Umkreis von 5 km trainiert noch kein Gym mit Tidal Athletics/.test(await page.locator("[data-gym-leer]").innerText()) && /alle anzeigen/i.test(await page.locator("[data-gym-leer]").innerText()));
      }
      await suche(page, "Xyzqq");
      await page.waitForTimeout(500);
      pruefe("unbekannter Ort: „Probier es mit der PLZ.“", /Probier es mit der PLZ/.test(await page.locator("[data-gym-vorschlaege]").innerText().catch(() => "")));

      // Standort
      await page.locator("[data-gym-standort]").click();
      await page.waitForFunction(() => /um deinen Standort/.test(document.querySelector("[data-gym-zahl]")?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
      await regler.fill("4");
      await page.waitForTimeout(600);
      l = await ids(page);
      pruefe("„Meinen Standort nutzen“ → um deinen Standort, München zuerst", /25 km um deinen Standort$/.test(await zahl(page)) && l[0] === "mess-gf-muenchen", await zahl(page));
      pruefe("Satz: Standort bleibt auf dem Gerät", (await page.locator("body").innerText()).includes("Dein Standort bleibt auf deinem Gerät."));

      // Liste ↔ Karte
      await page.locator("[data-gym-alle]").click();
      await page.waitForTimeout(1200);
      await page.locator('[data-gym="mess-gf-esslingen"] button[aria-pressed]').click();
      await page.waitForTimeout(700);
      pruefe("Liste → Karte: Pin hervorgehoben", (await page.locator('.karte [data-gym-pin="mess-gf-esslingen"]').getAttribute("data-gewaehlt")) === "true");
      await page.locator('.karte [data-gym-pin="mess-gf-muenchen"]').click();
      await page.waitForTimeout(700);
      pruefe("Karte → Liste: Gym gewählt", (await page.locator('[data-gym="mess-gf-muenchen"]').getAttribute("data-gewaehlt")) === "true" && (await page.locator('[data-gym="mess-gf-esslingen"]').getAttribute("data-gewaehlt")) === null);
      pruefe("Pin trägt den Namen (Vorleseprogramm)", (await page.locator('.karte [data-gym-pin="mess-gf-muenchen"]').getAttribute("aria-label")) === "Mess Gym München");

      // Kontakt + Quellen
      const karte = page.locator('[data-gym="mess-gf-stuttgart"]');
      const hrefs = await karte.locator("a").evaluateAll((as) => as.map((a) => `${a.getAttribute("href")}|${a.target}|${a.rel}`));
      pruefe("Telefon, E-Mail, Website als Links", hrefs.includes("tel:0711123456||") && hrefs.includes("mailto:info@mess-stuttgart.de||") && hrefs.some((h) => h.startsWith("https://mess-stuttgart.de|_blank|noopener")), hrefs.join(" "));
      pruefe("Gym ohne Kontakt zeigt keine Links", (await page.locator('[data-gym="mess-gf-esslingen"] a').count()) === 0);
      const body = await page.locator("body").innerText();
      pruefe("Quelle der PLZ-Daten steht da", /GeoNames/.test(body) && /CC BY 4\.0/.test(body));
      pruefe("Quelle der Karte steht da", /OpenStreetMap/.test(await page.locator(".karte .maplibregl-ctrl-attrib").innerText()));
      pruefe("Einladungscode und Gym anmelden bleiben", /code eingeben/i.test(body) && /Gym anmelden/.test(body));

      // Was das Gerät verlässt
      const fremd = anfragen.filter((a) => !a.url.startsWith(BASE) && !a.url.startsWith("data:") && !a.url.startsWith("blob:"));
      const hosts = [...new Set(fremd.map((a) => new URL(a.url).host))];
      const erlaubt = /(^|\.)googleapis\.com$|(^|\.)firebaseio\.com$|(^|\.)firebaseapp\.com$|(^|\.)gstatic\.com$|^tiles\.openfreemap\.org$|(^|\.)google\.com$/;
      pruefe("fremde Adressen: nur Firebase und die Kacheln", hosts.every((h) => erlaubt.test(h)), hosts.join(", "));
      const suchRufe = anfragen.filter((a) => a.url === `${BASE}/api/gyms/suche`);
      pruefe("Suche-Route ohne Body (kein Standort, kein Suchwort)", suchRufe.length >= 1 && suchRufe.every((a) => a.method === "POST" && !a.body));
      const verraten = anfragen.filter((a) => !a.url.includes("/daten/plz-de.json") && /70173|24937|M%C3%BCnch|Münch|48\.14|11\.58/.test(`${a.url} ${a.body ?? ""}`));
      pruefe("PLZ, Ort und Standort stehen in KEINER Anfrage", verraten.length === 0, verraten.slice(0, 2).map((a) => a.url).join(" "));
      const laut = konsole.filter((k) => !/403|permission|Failed to load resource|WebGL|GPU/i.test(k));
      pruefe("Konsole ohne Fehler", laut.length === 0, laut.slice(0, 3).join(" | "));

      // Handy
      await page.setViewportSize({ width: 390, height: 844 });
      await oeffne(page);
      const breite = await page.evaluate(() => document.documentElement.scrollWidth);
      pruefe("Handy: nichts läuft über den Rand", breite <= 391, `${breite}px`);
      await page.screenshot({ path: `${OUT}/gym-finden-handy-${THEME}.png`, fullPage: true });
      await ctx.close();

      // ── Standort nicht freigegeben ─────────────────────────────────────
      const zu = await anmelden("fremd", { permissions: [] });
      await oeffne(zu.page);
      await zu.page.locator("[data-gym-standort]").click();
      await zu.page.waitForFunction(() => /gibt den Standort gerade nicht frei/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
      pruefe("ohne Freigabe: Satz + Liste bleibt", /Dein Browser gibt den Standort gerade nicht frei\. Such über PLZ oder Ort\./.test(await zu.page.locator("body").innerText()) && (await ids(zu.page)).length === alle.length);
      await zu.ctx.close();

      // ── Mitglied ───────────────────────────────────────────────────────
      const m = await anmelden("mitglied");
      await oeffne(m.page);
      pruefe("Mitglied: „Dein Gym“ am eigenen Gym, nur dort", /dein gym/i.test(await m.page.locator('[data-gym="mess-gf-stuttgart"]').innerText()) && !/dein gym/i.test(await m.page.locator('[data-gym="mess-gf-muenchen"]').innerText()));
      await m.ctx.close();
    } finally {
      await browser.close();
    }
  } catch (err) {
    abgebrochen = err;
  } finally {
    for (const uid of Object.values(uids)) {
      await db.collection("users").doc(uid).delete().catch(() => {});
      await auth.deleteUser(uid).catch(() => {});
    }
    for (const id of Object.keys(GYMS)) await db.collection("gyms").doc(id).delete().catch(() => {});
  }
}

if (abgebrochen) console.log("\nABGEBROCHEN:", abgebrochen?.stack ?? abgebrochen);
const gruen = !abgebrochen && ok.every(Boolean);
console.log(`\n${ok.filter(Boolean).length}/${ok.length}${gruen ? " ALLE PRÜFUNGEN BESTANDEN" : " — FEHLER"}${process.env.NUR_LOGIK ? "" : " · aufgeräumt"}`);
if (!gruen) process.exitCode = 1;
