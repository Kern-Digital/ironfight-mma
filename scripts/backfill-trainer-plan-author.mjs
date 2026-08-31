/**
 * `createdByName` auf Trainer-Plänen nachtragen (Altbestand-Heilung).
 *
 * WARUM: Athleten dürfen fremde users-Dokumente per Firestore-Regel NICHT
 * lesen — die uid in `createdBy` könnten sie also nie zu einem Namen
 * auflösen. Deshalb steht der Anzeigename denormalisiert am Plan
 * (`createdByName`, seit AUSBAU Stufe 1 / 31.08.). Pläne, die davor
 * angelegt wurden, haben das Feld nicht; im Client heilt es sich erst,
 * wenn der Ersteller den Plan das nächste Mal speichert. Dieses Skript
 * trägt es sofort nach.
 *
 * Aufruf:
 *   node scripts/backfill-trainer-plan-author.mjs --dry-run
 *   node scripts/backfill-trainer-plan-author.mjs
 *   node scripts/backfill-trainer-plan-author.mjs --gym=<id>
 *
 * Credentials wie scripts/backfill-user-gym.mjs (firebase-tools, REST).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_GYM_ID = "tidal-athletics";
const CLIENT_ID =
  process.env.FIREBASE_CLIENT_ID ??
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET =
  process.env.FIREBASE_CLIENT_SECRET ?? "j9iVZfS8kkCEFUPaAeJV0sAi";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const gymId = args.find((a) => a.startsWith("--gym="))?.slice(6) ?? DEFAULT_GYM_ID;

function projectId() {
  try {
    return JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects?.default;
  } catch {
    return "ironfight-mma";
  }
}

async function accessToken() {
  const file = path.join(
    os.homedir(),
    ".config",
    "configstore",
    "firebase-tools.json",
  );
  const store = JSON.parse(fs.readFileSync(file, "utf8"));
  const tokens = store.tokens ?? {};
  if (tokens.access_token && (tokens.expires_at ?? 0) > Date.now() + 60_000) {
    return tokens.access_token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token-Refresh: ${JSON.stringify(data)}`);
  return data.access_token;
}

const BASE = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
const token = await accessToken();

async function getJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

const data = await getJson(`${BASE}/gyms/${gymId}/trainerPlans?pageSize=300`);
const docs = data?.documents ?? [];
const missing = docs.filter((d) => !d.fields?.createdByName?.stringValue);

console.log(`${docs.length} Trainer-Pläne — ${missing.length} ohne createdByName`);
if (missing.length === 0) process.exit(0);

// Namen der Ersteller einmalig auflösen (mehrere Pläne pro Trainer)
const nameCache = new Map();
async function authorName(uid) {
  if (nameCache.has(uid)) return nameCache.get(uid);
  const u = await getJson(`${BASE}/users/${uid}`);
  const f = u?.fields ?? {};
  const name =
    f.displayName?.stringValue ??
    f.authProviderName?.stringValue ??
    f.email?.stringValue ??
    "";
  nameCache.set(uid, name);
  return name;
}

for (const d of missing) {
  const id = d.name.split("/").pop();
  const planName = d.fields?.name?.stringValue ?? "(ohne Namen)";
  const uid = d.fields?.createdBy?.stringValue;
  if (!uid) {
    console.log(`  übersprungen: ${id} „${planName}" — kein createdBy`);
    continue;
  }
  const name = await authorName(uid);
  if (!name) {
    console.log(`  übersprungen: ${id} „${planName}" — Ersteller ohne Namen`);
    continue;
  }
  if (dryRun) {
    console.log(`  [dry-run] ${id} „${planName}" → createdByName="${name}"`);
    continue;
  }
  const url = new URL(`${BASE}/gyms/${gymId}/trainerPlans/${id}`);
  url.searchParams.append("updateMask.fieldPaths", "createdByName");
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { createdByName: { stringValue: name } } }),
  });
  if (!res.ok) {
    console.log(`  FEHLER ${id}: ${res.status} ${await res.text()}`);
    continue;
  }
  console.log(`  gesetzt: ${id} „${planName}" → ${name}`);
}

console.log(dryRun ? "\nProbelauf — nichts geschrieben." : "\nFertig.");
