/**
 * MESSUNG „Konten ohne Gym" (30.09.2026, Etappe 1 der Gym-Suche).
 *
 *   node --use-system-ca scripts/mess-ohne-gym.mjs              # Regeln + Routen + Browser (hell)
 *   THEME=dark node --use-system-ca scripts/mess-ohne-gym.mjs
 *   NUR_API=1 node --use-system-ca scripts/mess-ohne-gym.mjs    # ohne Browser
 *
 * Braucht den Dev-Server (BASE). Legt ein eigenes Prüf-Gym mit aktivem
 * Wochenplan an, dazu vier Prüfkonten (…@tidal-athletics.invalid), und räumt
 * alles weg. Leons Gym wird nur GELESEN (als Beweis, dass ein Fremder es
 * nicht mehr lesen kann). Keine KI-Kosten.
 *
 * Was sie beweist (CLAUDE.md „KONTEN OHNE GYM"):
 *   REGELN (live in Produktion — vor dem Rules-Deploy zeigen die Zeilen
 *   „Fremder liest …" den alten Zustand, 200 statt 403):
 *   • Selbstanmeldung ohne Claim und entferntes Mitglied (Claim null) lesen
 *     KEIN Gym-Dokument und KEINEN Wochenplan — auch nicht von tidal-athletics
 *   • beide lesen ihr eigenes users-Dokument und ihr eigenes Kampfprofil
 *   • ein echtes Mitglied liest Gym und aktiven Wochenplan wie bisher
 *   ROUTEN:
 *   • /api/members/role: die Verwaltung eines Gyms kann ein Konto ohne Gym
 *     NICHT bearbeiten (403) — vorher fiel das Ziel aufs Default-Gym
 *   • /api/gym/trainer-auswahl ohne Gym → { gyms: [] }
 *   BROWSER (Konto ohne Gym):
 *   • /dashboard, /schedule, /timer, /techniques zeigen den Hinweis „Du
 *     gehörst gerade keinem Gym an." mit „Gym finden"
 *   • die Leiste hat Gym finden / Kampfprofil / Profil, kein Training, keinen
 *     Kursplan, keine Suche
 *   • /profile ohne „Meine Kurse", /kampfprofil ohne „Alle Trainer deines
 *     Gyms", /gym-finden erreichbar
 *   • ein Mitglied sieht das Dashboard wie bisher (Kursplan in der Leiste)
 */
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "light";
const OUT = "../abnahme-ohne-gym";
const GYM = "mess-og-gym";
const LEONS_GYM = "tidal-athletics";

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
const pw = `mess-og-${Math.random().toString(36).slice(2)}A1!`;
const OHNE = { trainer: false, verwaltung: false, admin: false };

/** `claimGym`: undefined = kein Claim (Selbstanmeldung), null = entfernt. */
const KONTEN = {
  fremd:    { name: "Mess Fremd",      claimGym: undefined, claim: OHNE, docGym: null },
  raus:     { name: "Mess Entfernt",   claimGym: null,      claim: OHNE, docGym: null },
  mitglied: { name: "Mess Mitglied",   claimGym: GYM,       claim: OHNE, docGym: GYM },
  buero:    { name: "Mess Verwaltung", claimGym: GYM,       claim: { ...OHNE, verwaltung: true }, docGym: GYM },
};
const email = (k) => `mess-og-${k}@tidal-athletics.invalid`;
const uids = {};
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
const hdr = async (k, json = false) => ({ authorization: `Bearer ${await token(k)}`, ...(json ? { "content-type": "application/json" } : {}) });
const lese = async (k, pfad) => (await fetch(`${FS}/${pfad}`, { headers: await hdr(k) })).status;
/** Genau die Abfrage aus useKursplan: schedulePlans where aktiv == true. */
async function plaene(k, gymId) {
  const r = await fetch(`${FS}/gyms/${gymId}:runQuery`, {
    method: "POST", headers: await hdr(k, true),
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "schedulePlans" }],
      where: { fieldFilter: { field: { fieldPath: "aktiv" }, op: "EQUAL", value: { booleanValue: true } } },
    } }),
  });
  if (r.status !== 200) return { status: r.status, n: 0 };
  const rows = await r.json();
  return { status: 200, n: (Array.isArray(rows) ? rows : []).filter((x) => x.document).length };
}
async function route(k, pfad, body) {
  const r = await fetch(`${BASE}${pfad}`, { method: "POST", headers: await hdr(k, !!body), body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* leer */ }
  return { status: r.status, json };
}

try {
  // ─── Aufbau ─────────────────────────────────────────────────────────────
  await db.collection("gyms").doc(GYM).set({ name: "Mess Ohne-Gym Gym", status: "active", createdAt: Timestamp.now(), branding: null });
  await db.collection("gyms").doc(GYM).collection("schedulePlans").doc("grund").set({
    name: "Grundplan", aktiv: true, grundplan: true, kurse: [], raeume: [], createdAt: Timestamp.now(),
  });
  for (const [k, v] of Object.entries(KONTEN)) {
    let u;
    try { u = await auth.getUserByEmail(email(k)); await auth.updateUser(u.uid, { password: pw }); }
    catch { u = await auth.createUser({ email: email(k), password: pw, displayName: v.name, emailVerified: true }); }
    uids[k] = u.uid;
    const claims = claimsWithRights(v.claimGym ? { gymId: v.claimGym } : {}, v.claim);
    if (v.claimGym === null) claims.gymId = null; // wie /api/members/remove
    await auth.setCustomUserClaims(u.uid, claims);
    await db.collection("users").doc(u.uid).set({
      email: email(k), displayName: v.name, ...(v.docGym ? { gymId: v.docGym } : {}),
      onboarded: true, trainerOnboarded: true, createdAt: Timestamp.now(), ...rightsMirror(v.claim),
    });
    await db.collection("users").doc(u.uid).collection("fightProfile").doc("mma").set({ kampfart: "mma", createdAt: Timestamp.now() });
  }

  // ─── Regeln ─────────────────────────────────────────────────────────────
  console.log("REGELN (Produktion)");
  for (const k of ["fremd", "raus"]) {
    pruefe(`${k}: eigenes users-Dokument`, (await lese(k, `users/${uids[k]}`)) === 200);
    pruefe(`${k}: eigenes Kampfprofil`, (await lese(k, `users/${uids[k]}/fightProfile/mma`)) === 200);
    pruefe(`${k}: liest Leons Gym NICHT`, (await lese(k, `gyms/${LEONS_GYM}`)) === 403);
    pruefe(`${k}: liest Prüf-Gym NICHT`, (await lese(k, `gyms/${GYM}`)) === 403);
    const p = await plaene(k, LEONS_GYM);
    pruefe(`${k}: Wochenplan von Leons Gym NICHT`, p.status === 403, `${p.status}, ${p.n} Pläne`);
  }
  pruefe("Mitglied liest sein Gym", (await lese("mitglied", `gyms/${GYM}`)) === 200);
  const pm = await plaene("mitglied", GYM);
  pruefe("Mitglied liest den aktiven Wochenplan", pm.status === 200 && pm.n === 1, `${pm.status}, ${pm.n}`);
  pruefe("Mitglied liest fremdes Gym NICHT", (await lese("mitglied", `gyms/${LEONS_GYM}`)) === 403);

  // ─── Routen ─────────────────────────────────────────────────────────────
  console.log("ROUTEN");
  const rolle = await route("buero", "/api/members/role", { uid: uids.fremd, trainer: true, verwaltung: false });
  pruefe("Verwaltung kann Konto ohne Gym NICHT bearbeiten", rolle.status === 403, `${rolle.status} ${JSON.stringify(rolle.json)}`);
  const nachher = (await auth.getUser(uids.fremd)).customClaims ?? {};
  pruefe("… und der Claim blieb unberührt", !nachher.trainer && !nachher.gymId, JSON.stringify(nachher));
  const ta = await route("fremd", "/api/gym/trainer-auswahl");
  pruefe("trainer-auswahl ohne Gym → keine Gyms", ta.status === 200 && ta.json?.gyms?.length === 0);
  const ws = await route("raus", "/api/gym/wochenplan-stand");
  pruefe("wochenplan-stand ohne Gym → nichts geändert", ws.status === 200 && ws.json?.geaendert === false);

  // ─── Browser ────────────────────────────────────────────────────────────
  if (!process.env.NUR_API) {
    console.log(`BROWSER (${THEME})`);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(OUT, { recursive: true });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const anmelden = async (k) => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        const konsole = [];
        page.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
        for (let i = 0; i < 3; i++) { await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000); if (await page.locator('input[type="email"]').count()) break; }
        await page.fill('input[type="email"]', email(k));
        await page.fill('input[type="password"]', pw);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/(dashboard|kampfprofil|profile|verwaltung)/, { timeout: 60000 });
        await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);
        return { ctx, page, konsole };
      };
      const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
      const geladen = async (page) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1200); };

      // Konto ohne Gym
      const { ctx, page, konsole } = await anmelden("fremd");
      for (const pfad of ["/dashboard", "/schedule", "/timer", "/techniques"]) {
        await page.goto(`${BASE}${pfad}`, { waitUntil: "domcontentloaded" });
        await geladen(page);
        const t = await text(page);
        pruefe(`${pfad}: Hinweis statt Inhalt`, t.includes("Du gehörst gerade keinem Gym an.") && /gym finden/i.test(t) && !/Meine Kurse|Nächste Kurse|Schnell-Start/.test(t), t.slice(0, 80));
      }
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      await geladen(page);
      await page.screenshot({ path: `${OUT}/hinweis-${THEME}.png` });
      const nav = (await page.locator('nav[aria-label="Hauptnavigation"]').innerText()).replace(/\s+/g, " ");
      pruefe("Leiste: Gym finden / Kampfprofil / Profil", /Gym finden/i.test(nav) && /Kampfprofil/i.test(nav) && /Profil/i.test(nav), nav);
      pruefe("Leiste: kein Training, kein Kursplan, keine Suche", !/Training|Kursplan|Suche/i.test(nav), nav);
      pruefe("keine Navbar oben", (await page.locator("header nav, nav.navbar").count()) === 0);

      await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
      await geladen(page);
      const tp = await text(page);
      pruefe("/profile erreichbar, ohne „Meine Kurse“", tp.includes("Profil") && !tp.includes("Meine Kurse") && !tp.includes("keinem Gym an"));
      await page.screenshot({ path: `${OUT}/profil-${THEME}.png` });

      await page.goto(`${BASE}/kampfprofil`, { waitUntil: "domcontentloaded" });
      await geladen(page);
      const tk = await text(page);
      pruefe("/kampfprofil erreichbar", tk.includes("Kampfprofil") && !tk.includes("keinem Gym an"));
      const knopf = page.getByRole("button", { name: "Profil teilen" });
      await knopf.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Profil teilen"); return b && !b.disabled; }, null, { timeout: 60000 });
      await page.waitForTimeout(1500);
      await knopf.click();
      const dlg = page.locator('[role="dialog"]', { hasText: "Sichtbarkeit bearbeiten" });
      await dlg.waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      const td = (await dlg.innerText()).replace(/\s+/g, " ");
      pruefe("Sheet ohne „Alle Trainer deines Gyms“, mit Weg ins Gym", !td.includes("Alle Trainer deines Gyms") && td.includes("Einladungslink"));
      await page.screenshot({ path: `${OUT}/sheet-${THEME}.png` });
      await page.keyboard.press("Escape");

      await page.goto(`${BASE}/gym-finden`, { waitUntil: "domcontentloaded" });
      await geladen(page);
      const tg = await text(page);
      pruefe("/gym-finden erreichbar", tg.includes("Dein Gym auf Tidal Athletics") && /code eingeben/i.test(tg));
      await page.screenshot({ path: `${OUT}/gym-finden-${THEME}.png` });
      pruefe("Konsole ohne Fehler (ohne Gym)", konsole.filter((k) => !/403|permission/i.test(k)).length === 0, konsole.slice(0, 3).join(" | "));
      await ctx.close();

      // Mitglied: alles wie bisher
      const m = await anmelden("mitglied");
      await m.page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      await geladen(m.page);
      const tm = await text(m.page);
      const navm = (await m.page.locator('nav[aria-label="Hauptnavigation"]').innerText()).replace(/\s+/g, " ");
      pruefe("Mitglied: Dashboard ohne Hinweis, Leiste mit Kursplan", !tm.includes("keinem Gym an") && /Kursplan/i.test(navm) && /Training/i.test(navm), navm);
      await m.ctx.close();
    } finally {
      await browser.close();
    }
  }
} catch (err) {
  abgebrochen = err;
} finally {
  for (const uid of Object.values(uids)) {
    const fp = await db.collection("users").doc(uid).collection("fightProfile").get();
    for (const d of fp.docs) await d.ref.delete();
    await db.collection("users").doc(uid).delete().catch(() => {});
    await auth.deleteUser(uid).catch(() => {});
  }
  const sp = await db.collection("gyms").doc(GYM).collection("schedulePlans").get();
  for (const d of sp.docs) await d.ref.delete();
  const audit = await db.collection("gyms").doc(GYM).collection("auditLog").get();
  for (const d of audit.docs) await d.ref.delete();
  await db.collection("gyms").doc(GYM).delete().catch(() => {});
  if (abgebrochen) console.log("\nABGEBROCHEN:", abgebrochen?.message ?? abgebrochen);
  const gruen = !abgebrochen && ok.every(Boolean);
  console.log(`\n${ok.filter(Boolean).length}/${ok.length}${gruen ? " ALLE PRÜFUNGEN BESTANDEN" : " — FEHLER"} · aufgeräumt`);
  if (!gruen) process.exitCode = 1;
}
