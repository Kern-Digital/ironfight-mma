/**
 * MESSUNG „Trainer-Auswahl im Freigabe-Sheet" (30.09.2026).
 *
 *   node --use-system-ca scripts/mess-trainer-auswahl.mjs              # API + Regeln + Browser (hell)
 *   THEME=dark node --use-system-ca scripts/mess-trainer-auswahl.mjs
 *   NUR_API=1 node --use-system-ca scripts/mess-trainer-auswahl.mjs    # ohne Browser
 *
 * Braucht den Dev-Server (BASE, Standard http://localhost:3000). Legt zwei
 * eigene Prüf-Gyms mit Prüfkonten (…@tidal-athletics.invalid) an und räumt
 * danach ALLES weg — Leons Gym wird nicht angefasst. Keine KI-Kosten.
 *
 * Was sie beweist (Sicherheitsmodell im Kopf von
 * app/api/gym/trainer-auswahl/route.ts):
 *   • ohne / mit kaputtem Token 401, GET 405
 *   • Athlet in Gym A sieht GENAU die echten Trainer von Gym A — nicht sich,
 *     nicht Gym B, nicht reine Verwaltung, nicht den Admin, nicht das
 *     Demo-Dokument ohne Login, nicht das gesperrte Konto, nicht den Trainer
 *     nur im Spiegel (Claim ohne Trainer-Recht)
 *   • je Trainer nur uid/name/avatar, KEINE E-Mail (auch nicht als Name)
 *   • Body mit fremder gymId wird ignoriert
 *   • Konto ohne Gym-Claim (Selbstanmeldung) und Konto mit Claim ≠ Dokument
 *     bekommen KEINE Namen
 *   • Cache-Control: no-store
 *   • Browser: Sheet zeigt die Namen, Altlasten-Hinweis, Entfernen + Namens-
 *     Freigabe speichern → Firestore; danach liest der freigegebene Trainer
 *     das Kampfprofil (REST, echte Regeln), der andere nicht
 *   • Ladefehler (Route 500 simuliert) → eigener Satz, nicht „keinen Trainer"
 *   • firestore.rules unverändert gegenüber HEAD
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "light";
const OUT = "../abnahme-trainer-auswahl";
const GYM_A = "mess-ta-gym-a";
const GYM_B = "mess-ta-gym-b";

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
const pw = `mess-ta-${Math.random().toString(36).slice(2)}A1!`;
const OHNE = { trainer: false, verwaltung: false, admin: false };

/**
 * Die Konten. `claim` = was im Token steht, `doc` = was am users-Dokument
 * steht (Spiegel + gymId). Wo beides auseinandergeht, ist das die Probe.
 */
const KONTEN = {
  athlet:    { name: "Mess Athlet",        claimGym: GYM_A, claim: OHNE, docGym: GYM_A, doc: OHNE },
  anna:      { name: "Mess Trainerin Anna", claimGym: GYM_A, claim: { ...OHNE, trainer: true }, docGym: GYM_A, doc: { ...OHNE, trainer: true }, avatar: "zora" },
  namenlos:  { name: null,                 claimGym: GYM_A, claim: { ...OHNE, trainer: true }, docGym: GYM_A, doc: { ...OHNE, trainer: true } },
  buero:     { name: "Mess Büro",          claimGym: GYM_A, claim: { ...OHNE, verwaltung: true }, docGym: GYM_A, doc: { ...OHNE, verwaltung: true } },
  spiegel:   { name: "Mess Nur Spiegel",   claimGym: GYM_A, claim: OHNE, docGym: GYM_A, doc: { ...OHNE, trainer: true } },
  admin:     { name: "Mess Admin",         claimGym: GYM_A, claim: { trainer: true, verwaltung: false, admin: true }, docGym: GYM_A, doc: { ...OHNE, trainer: true } },
  gesperrt:  { name: "Mess Gesperrt",      claimGym: GYM_A, claim: { ...OHNE, trainer: true }, docGym: GYM_A, doc: { ...OHNE, trainer: true }, disabled: true },
  trainerB:  { name: "Mess Trainer B",     claimGym: GYM_B, claim: { ...OHNE, trainer: true }, docGym: GYM_B, doc: { ...OHNE, trainer: true } },
  fremd:     { name: "Mess Ohne Gym",      claimGym: null,  claim: OHNE, docGym: null, doc: OHNE },
  drift:     { name: "Mess Drift",         claimGym: GYM_A, claim: OHNE, docGym: GYM_B, doc: OHNE },
};
const email = (k) => `mess-ta-${k.toLowerCase()}@tidal-athletics.invalid`;
const uids = {};
const DEMO_UID = "mess-ta-demo-trainer";
const ALT_UID = "mess-ta-alter-trainer";

const ok = [];
let abgebrochen = null;
const pruefe = (name, bed, info = "") => { ok.push(!!bed); console.log(bed ? "  OK  " : "  FEHL", name, info ? `(${info})` : ""); };

async function token(k) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email(k), password: pw, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error(`Login ${k}: ${JSON.stringify(j.error ?? j)}`);
  return j.idToken;
}
async function frage(k, { body, methode = "POST", tokenWert } = {}) {
  const t = tokenWert ?? (k ? await token(k) : null);
  const r = await fetch(`${BASE}/api/gym/trainer-auswahl`, {
    method: methode,
    headers: { ...(t ? { authorization: `Bearer ${t}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* 405 ohne JSON */ }
  return { status: r.status, cache: r.headers.get("cache-control") ?? "", json };
}
const leseKampfprofil = async (alsK) =>
  (await fetch(`${FS}/users/${uids.athlet}/fightProfile/mma`, { headers: { authorization: `Bearer ${await token(alsK)}` } })).status;

try {
  // ─── Aufbau ─────────────────────────────────────────────────────────────
  await db.collection("gyms").doc(GYM_A).set({ name: "Mess Gym A", status: "active", createdAt: Timestamp.now(), branding: null });
  await db.collection("gyms").doc(GYM_B).set({ name: "Mess Gym B", status: "active", createdAt: Timestamp.now(), branding: null });
  for (const [k, v] of Object.entries(KONTEN)) {
    let u;
    try { u = await auth.getUserByEmail(email(k)); await auth.updateUser(u.uid, { password: pw, disabled: false }); }
    catch { u = await auth.createUser({ email: email(k), password: pw, ...(v.name ? { displayName: v.name } : {}), emailVerified: true }); }
    uids[k] = u.uid;
    await auth.setCustomUserClaims(u.uid, claimsWithRights(v.claimGym ? { gymId: v.claimGym } : {}, v.claim));
    await db.collection("users").doc(u.uid).set({
      email: email(k), ...(v.name ? { displayName: v.name } : {}), ...(v.docGym ? { gymId: v.docGym } : {}),
      onboarded: true, trainerOnboarded: true, createdAt: Timestamp.now(), ...rightsMirror(v.doc),
      ...(v.avatar ? { avatar: v.avatar } : {}),
    });
  }
  // Der Athlet trägt zwei ALTLASTEN: einen Trainer, den es nicht mehr gibt,
  // und „alle Trainer" eines Gyms, in dem er nicht mehr ist.
  await db.collection("users").doc(uids.athlet).set({
    profileShares: {
      athlet: { uids: [], gyms: [] },
      deepfight: { uids: [ALT_UID], gyms: ["mess-ta-altes-gym"] },
      wettkampf: { uids: [], gyms: [] },
    },
  }, { merge: true });
  await db.collection("users").doc(uids.athlet).collection("fightProfile").doc("mma").set({ kampfart: "mma", createdAt: Timestamp.now() });
  // Demo-Dokument: sieht aus wie ein Trainer, hat aber kein Login.
  await db.collection("users").doc(DEMO_UID).set({ displayName: "Mess Demo Trainer", gymId: GYM_A, isDemo: true, ...rightsMirror({ ...OHNE, trainer: true }) });
  await auth.updateUser(uids.gesperrt, { disabled: true });

  // ─── API ────────────────────────────────────────────────────────────────
  console.log("API");
  pruefe("ohne Token → 401", (await frage(null)).status === 401);
  pruefe("kaputtes Token → 401", (await frage(null, { tokenWert: "kaputt" })).status === 401);
  pruefe("GET → 405", (await frage("athlet", { methode: "GET" })).status === 405);

  const a = await frage("athlet");
  pruefe("Athlet → 200", a.status === 200, String(a.status));
  pruefe("no-store", /no-store/.test(a.cache), a.cache);
  pruefe("genau ein Gym, Gym A", a.json?.gyms?.length === 1 && a.json.gyms[0].gymId === GYM_A && a.json.gyms[0].name === "Mess Gym A");
  const liste = a.json?.gyms?.[0]?.trainer ?? [];
  const namen = liste.map((t) => t.name);
  console.log("       Liste:", JSON.stringify(liste));
  pruefe("genau Anna + der Namenlose", liste.length === 2 && liste.some((t) => t.uid === uids.anna) && liste.some((t) => t.uid === uids.namenlos), namen.join(", "));
  pruefe("Namenloser heißt „Trainer“", liste.find((t) => t.uid === uids.namenlos)?.name === "Trainer");
  pruefe("Profilbild kommt mit", liste.find((t) => t.uid === uids.anna)?.avatar === "zora");
  pruefe("nur uid/name/avatar", liste.every((t) => Object.keys(t).sort().join() === "avatar,name,uid"));
  pruefe("keine E-Mail in der Antwort", !JSON.stringify(a.json).includes("@"));
  for (const k of ["buero", "spiegel", "admin", "gesperrt", "trainerB"]) {
    pruefe(`${k} steht nicht drin`, !liste.some((t) => t.uid === uids[k]));
  }
  pruefe("Demo-Dokument ohne Login steht nicht drin", !liste.some((t) => t.uid === DEMO_UID));

  const mitBody = await frage("athlet", { body: { gymId: GYM_B } });
  pruefe("Body mit fremder gymId ignoriert", mitBody.json?.gyms?.[0]?.gymId === GYM_A && !JSON.stringify(mitBody.json).includes(uids.trainerB));

  const anna = await frage("anna");
  pruefe("Trainerin sieht sich nicht selbst", !(anna.json?.gyms?.[0]?.trainer ?? []).some((t) => t.uid === uids.anna) && (anna.json?.gyms?.[0]?.trainer ?? []).some((t) => t.uid === uids.namenlos));

  const b = await frage("trainerB");
  pruefe("Gym B sieht nur Gym B (leer)", b.json?.gyms?.[0]?.gymId === GYM_B && (b.json?.gyms?.[0]?.trainer ?? []).length === 0);

  const fremd = await frage("fremd");
  pruefe("ohne Gym-Claim → keine Namen", fremd.status === 200 && Array.isArray(fremd.json?.gyms) && fremd.json.gyms.length === 0, JSON.stringify(fremd.json));
  const drift = await frage("drift");
  pruefe("Claim ≠ Dokument → keine Namen", drift.status === 200 && drift.json?.gyms?.length === 0, JSON.stringify(drift.json));

  // ─── Regeln vorher ──────────────────────────────────────────────────────
  console.log("Regeln (vor der Freigabe)");
  pruefe("Anna liest Kampfprofil NICHT", (await leseKampfprofil("anna")) === 403);

  // ─── Browser ────────────────────────────────────────────────────────────
  if (!process.env.NUR_API) {
    console.log(`Browser (${THEME})`);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(OUT, { recursive: true });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const konsole = [];
      page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
      for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000); if (await page.locator('input[type="email"]').count()) break; }
      await page.fill('input[type="email"]', email("athlet"));
      await page.fill('input[type="password"]', pw);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(dashboard|kampfprofil|profile)/, { timeout: 60000 });
      await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

      const oeffne = async () => {
        await page.goto(`${BASE}/kampfprofil`, { waitUntil: "domcontentloaded" });
        const knopf = page.getByRole("button", { name: "Profil teilen" });
        await knopf.waitFor({ timeout: 90000 });
        await page.waitForFunction(() => {
          const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Profil teilen");
          return b && !b.disabled;
        }, null, { timeout: 60000 });
        if (process.env.DEBUG) console.log("       Knopf:", await knopf.evaluate((b) => ({ dis: b.disabled, txt: b.innerText })));
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1500);
        await knopf.click();
        if (process.env.DEBUG) for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); console.log("       t", i, await page.locator('[role="dialog"]').count(), await knopf.evaluate((b) => b.disabled).catch(() => "weg"), page.url()); }
        const dlg = page.locator('[role="dialog"]', { hasText: "Sichtbarkeit bearbeiten" });
        await dlg.waitFor({ timeout: 30000 });
        await page.waitForTimeout(900);
        return dlg;
      };

      let dlg = await oeffne();
      const text = (await dlg.innerText()).replace(/\s+/g, " ");
      pruefe("Sheet zeigt Anna", text.includes("Mess Trainerin Anna"));
      pruefe("Sheet zeigt den Namenlosen als „Trainer“", /\bTrainer\b/.test(text));
      pruefe("kein „keinen Trainer“", !text.includes("keinen Trainer"));
      pruefe("Altlasten-Hinweis (2)", text.includes("2 frühere Freigaben"), text.match(/\d+ frühere Freigabe\w*/)?.[0]);
      pruefe("keine Namen fremder Gyms", !text.includes("Mess Trainer B") && !text.includes("Mess Büro"));
      await page.screenshot({ path: `${OUT}/sheet-${THEME}.png` });

      await dlg.getByRole("button", { name: "Entfernen" }).click();
      const zeile = dlg.locator(".t-card", { hasText: "Mess Trainerin Anna" });
      await zeile.getByRole("button").first().click();
      await page.waitForTimeout(500);
      await zeile.getByRole("switch").click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/sheet-auswahl-${THEME}.png` });
      await dlg.getByRole("button", { name: /Speichern/ }).click();
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const gespeichert = (await db.collection("users").doc(uids.athlet).get()).get("profileShares.deepfight");
      pruefe("gespeichert: nur Anna, Altlasten weg", JSON.stringify(gespeichert) === JSON.stringify({ uids: [uids.anna], gyms: [] }), JSON.stringify(gespeichert));

      console.log("Regeln (nach der Freigabe)");
      pruefe("Anna liest Kampfprofil", (await leseKampfprofil("anna")) === 200);
      pruefe("der Namenlose liest es NICHT", (await leseKampfprofil("namenlos")) === 403);

      // Ladefehler simulieren: Die Route antwortet 500.
      await page.route("**/api/gym/trainer-auswahl", (r) => r.fulfill({ status: 500, body: "{}" }));
      dlg = await oeffne();
      const fehlerText = (await dlg.innerText()).replace(/\s+/g, " ");
      pruefe("Ladefehler: eigener Satz", fehlerText.includes("laden gerade nicht"));
      pruefe("Ladefehler: nicht „keinen Trainer“", !fehlerText.includes("keinen Trainer"));
      pruefe("Ladefehler: kein Altlasten-Hinweis", !fehlerText.includes("frühere Freigabe"));
      await page.screenshot({ path: `${OUT}/sheet-fehler-${THEME}.png` });
      await page.unroute("**/api/gym/trainer-auswahl");

      // Stab-Weg (listAllMembers) unverändert: Anna sieht ihre Kollegen.
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const p2 = await ctx2.newPage();
      p2.on("console", (m) => m.type() === "error" && konsole.push(`[anna] ${m.text()}`));
      for (let i = 0; i < 3; i++) { await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await p2.waitForTimeout(2000); if (await p2.locator('input[type="email"]').count()) break; }
      await p2.fill('input[type="email"]', email("anna"));
      await p2.fill('input[type="password"]', pw);
      await p2.click('button[type="submit"]');
      await p2.waitForURL(/\/(dashboard|trainer|kampfprofil)/, { timeout: 60000 });
      await p2.goto(`${BASE}/kampfprofil`, { waitUntil: "domcontentloaded" });
      const k2 = p2.getByRole("button", { name: "Profil teilen" });
      await k2.waitFor({ timeout: 90000 });
      await p2.waitForFunction(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Profil teilen");
        return b && !b.disabled;
      }, null, { timeout: 60000 });
      await p2.waitForLoadState("networkidle").catch(() => {});
      await p2.waitForTimeout(1500);
      await k2.click();
      const d2 = p2.locator('[role="dialog"]', { hasText: "Sichtbarkeit bearbeiten" });
      await d2.waitFor({ timeout: 30000 });
      await p2.waitForTimeout(900);
      const t2 = (await d2.innerText()).replace(/\s+/g, " ");
      // Stab-Weg = Bestand: nur Konten mit Trainer-Recht (isStaffEntry), reine
      // Verwaltung nicht — sie kann DeepFight ohnehin nicht lesen.
      pruefe("Stab: Sheet zeigt Kollegen, keine reine Verwaltung", t2.includes("mess-ta-namenlos") && !t2.includes("Mess Büro"));
      pruefe("Stab: kein Fehlersatz", !t2.includes("laden gerade nicht") && !t2.includes("keinen Trainer"));
      pruefe("Stab: „Mit dir geteilt“ nennt den Athleten", /mit dir geteilt/i.test(t2) && t2.includes("Mess Athlet"));
      await p2.screenshot({ path: `${OUT}/sheet-stab-${THEME}.png` });
      await ctx2.close();

      const sonst = konsole.filter((k) => !/status of 500/.test(k));
      pruefe("Konsole ohne Fehler (außer dem simulierten 500)", sonst.length === 0, sonst.slice(0, 3).join(" | "));
    } finally {
      await browser.close();
    }
  }

  const regelnDiff = execSync("git diff --stat HEAD -- firestore.rules", { encoding: "utf8" }).trim();
  pruefe("firestore.rules unverändert", regelnDiff === "", regelnDiff);
} catch (err) {
  abgebrochen = err;
} finally {
  // ─── Aufräumen ──────────────────────────────────────────────────────────
  for (const uid of Object.values(uids)) {
    const fp = await db.collection("users").doc(uid).collection("fightProfile").get();
    for (const d of fp.docs) await d.ref.delete();
    await db.collection("users").doc(uid).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
  }
  await db.collection("users").doc(DEMO_UID).delete().catch(() => {});
  for (const g of [GYM_A, GYM_B]) {
    const audit = await db.collection("gyms").doc(g).collection("auditLog").get();
    for (const d of audit.docs) await d.ref.delete();
    await db.collection("gyms").doc(g).delete().catch(() => {});
  }
  if (abgebrochen) console.log("\nABGEBROCHEN:", abgebrochen?.message ?? abgebrochen);
  const gruen = !abgebrochen && ok.every(Boolean);
  console.log(`\n${ok.filter(Boolean).length}/${ok.length}${gruen ? " ALLE PRÜFUNGEN BESTANDEN" : " — FEHLER"} · aufgeräumt`);
  if (!gruen) process.exitCode = 1;
}
