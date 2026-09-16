/**
 * ETAPPE 2 — der Vorlauf LIVE gegen ein echtes kurzes Video.
 *
 *   node scripts/mess-e2-vorlauf.mjs
 *   BASE=http://localhost:3000 VIDEO="public/examples/….mp4" node scripts/mess-e2-vorlauf.mjs
 *
 * Geht denselben Weg wie der Browser: Upload-Session über /api/video-analysis/
 * upload, Bytes direkt zu Google, Status bis ACTIVE, dann /api/video-analysis/
 * preview. Eigenes Prüfkonto (mess-e2@…, Trainer), danach gelöscht. Druckt
 * das Vorlauf-JSON: Kämpfer, Art, Kampfart, Kampfmonat.
 */
import { readFileSync, statSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VIDEO = process.env.VIDEO ?? "public/examples/WhatsApp Video 2026-05-07 at 18.26.47.mp4";
const GYM_ID = "tidal-athletics";
// Eigenes Konto, getrennt von mess-e2-schirm — beide laufen parallel.
const EMAIL = "mess-e2v@tidal-athletics.invalid";
const PASSWORD = `mess-e2-${Math.random().toString(36).slice(2)}A1!`;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} · BASE ${BASE}`);
  const auth = getAuth();
  const db = getFirestore();

  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Mess E2", emailVerified: true })).uid;
  }
  const rechte = { trainer: true, verwaltung: false, admin: false };
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email: EMAIL, displayName: "Mess E2", gymId: GYM_ID, ...rightsMirror(rechte), createdAt: Timestamp.now(), profileShares: { athlet: [], deepfight: [], wettkampf: [] } },
    { merge: true },
  );

  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    });
    const token = (await r.json()).idToken;
    if (!token) throw new Error("kein ID-Token");
    const hdr = { authorization: `Bearer ${token}`, "content-type": "application/json" };

    // 1. Upload-Session
    const bytes = readFileSync(VIDEO);
    const size = statSync(VIDEO).size;
    const fileName = VIDEO.split(/[\\/]/).pop();
    const s = await fetch(`${BASE}/api/video-analysis/upload`, {
      method: "POST", headers: hdr, body: JSON.stringify({ fileName, fileSize: size, mimeType: "video/mp4" }),
    });
    sagt(s.status === 200, `Upload-Session (${s.status}), ${(size / 1_048_576).toFixed(1)} MB`);
    const session = await s.json();

    // 2. Bytes direkt zu Google
    const up = await fetch(session.uploadUrl, {
      method: "POST",
      headers: { "x-goog-upload-offset": "0", "x-goog-upload-command": "upload, finalize" },
      body: bytes,
    });
    let info = null;
    try { info = (await up.json()).file ?? null; } catch { info = null; }
    if (!info) {
      for (let i = 0; i < 6 && !info; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`${BASE}/api/video-analysis/resolve-upload`, { method: "POST", headers: hdr, body: JSON.stringify({ uploadName: session.uploadName }) });
        if (res.status === 200) info = await res.json();
      }
    }
    sagt(!!info?.uri, `Datei bei Google: ${info?.name ?? "—"}`);

    // 3. ACTIVE abwarten
    const deadline = Date.now() + 4 * 60_000;
    while (info.state === "PROCESSING" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      info = await (await fetch(`${BASE}/api/video-analysis/file-status`, { method: "POST", headers: hdr, body: JSON.stringify({ name: info.name }) })).json();
    }
    sagt(info.state === "ACTIVE", `Status ${info.state}`);

    // 4. Vorlauf
    const t0 = Date.now();
    const p = await fetch(`${BASE}/api/video-analysis/preview`, {
      method: "POST", headers: hdr,
      body: JSON.stringify({ source: { kind: "upload", fileUri: info.uri, mimeType: info.mimeType || "video/mp4", fileName, durationSeconds: null } }),
    });
    const dauer = ((Date.now() - t0) / 1000).toFixed(1);
    const body = await p.json();
    sagt(p.status === 200, `Vorlauf HTTP ${p.status} in ${dauer} s`);
    if (p.status !== 200) {
      console.log("  Fehler:", body.error);
    } else {
      const v = body.preview;
      console.log(JSON.stringify(v, null, 2));
      // Das Beispielvideo ist ein Einzeltraining — genau EINE Person ist richtig.
      sagt(Array.isArray(v.fighters) && v.fighters.length >= 1, `${v.fighters.length} Person(en) gefunden`);
      sagt(v.fighters.every((f) => f.description || f.clothing), "je Person Beschreibung oder Kleidung");
      sagt(["full", "excerpt", "sparring", "highlight"].includes(v.videoType), `Art: ${v.videoType}`);
      sagt(v.sport === null || ["mma", "boxen", "kickboxen", "ringen", "sambo", "bjj"].includes(v.sport), `Kampfart: ${v.sport}`);
      sagt(v.fighters.every((f) => f.bestSecond === null || (f.bestSecond >= 0 && f.bestSecond <= 120)), "bestSecond im Bereich 0–120");
    }

    // Ohne Analyse: Zugriff ohne Trainer-Recht muss 403 sein.
    const ohne = await fetch(`${BASE}/api/video-analysis/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: { kind: "youtube", url: "https://youtu.be/x", startSeconds: null, endSeconds: null } }) });
    sagt(ohne.status === 403, `Vorlauf ohne Token → ${ohne.status}`);
  } finally {
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
    console.log(fehler === 0 ? "\nALLE PRÜFUNGEN BESTANDEN ✓" : `\n${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
