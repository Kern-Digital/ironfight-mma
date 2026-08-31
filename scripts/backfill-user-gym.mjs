/**
 * gymId-Feld auf users-Dokumenten nachtragen (Lücke bis Multi-Gym Phase 2).
 *
 * WARUM: Beim Signup dürfen die Firestore-Regeln `gymId` NICHT setzen
 * (Gym-Wechsel/Beitritt ist serverseitig, kommt mit dem Einladungssystem in
 * Phase 2). Trainer-Listen fragen aber `where("gymId","==",…)` ab
 * (lib/admin.ts) — ein frisch registrierter Nutzer ist dadurch für Trainer
 * UNSICHTBAR (Schülerliste, Freigabe-Dialog der Trainer-Pläne, DeepFight).
 * Bis Phase 2 die Zuordnung per Einladung erledigt, trägt dieses Skript das
 * Feld nach.
 *
 * Verhältnis zu scripts/migrate-multi-gym.mjs: Dieses Skript macht NUR
 * dessen Schritt 3 (users-Feld), dafür OHNE Service-Account-Key — es nutzt
 * denselben REST-Weg wie scripts/seed-workout-plans.mjs. Den Custom Claim
 * setzt es bewusst NICHT (dafür braucht es das Admin-SDK); das ist für die
 * Sichtbarkeit auch nicht nötig: fehlender Claim = Default-Gym, sowohl in
 * den Rules (userGymId()) als auch im Client (resolveGymId).
 *
 * Aufruf:
 *   node scripts/backfill-user-gym.mjs --dry-run     # nur anzeigen
 *   node scripts/backfill-user-gym.mjs               # Feld setzen
 *   node scripts/backfill-user-gym.mjs --uid=<uid>   # nur ein Konto
 *   node scripts/backfill-user-gym.mjs --gym=<id>    # anderes Gym
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS wird NICHT gebraucht — es
 * läuft über die eingeloggten firebase-tools-Credentials
 * (~/.config/configstore/firebase-tools.json). Der Weg geht über IAM und
 * damit an den Security Rules vorbei.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_GYM_ID = "tidal-athletics";

// Öffentliche OAuth-Konstanten aus firebase-tools (wie seed-workout-plans.mjs)
const CLIENT_ID =
  process.env.FIREBASE_CLIENT_ID ??
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET =
  process.env.FIREBASE_CLIENT_SECRET ?? "j9iVZfS8kkCEFUPaAeJV0sAi";

// ─── Argumente ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const gymId = args.find((a) => a.startsWith("--gym="))?.slice(6) ?? DEFAULT_GYM_ID;
const onlyUid = args.find((a) => a.startsWith("--uid="))?.slice(6) ?? null;

// ─── Projekt & Token ───────────────────────────────────────────────────────

function projectId() {
  try {
    const rc = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
    return rc.projects?.default ?? "ironfight-mma";
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
  let store;
  try {
    store = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(
      `Keine firebase-tools-Credentials gefunden (${file}). ` +
        "Erst `npx firebase-tools login` ausführen.",
    );
  }
  const tokens = store.tokens ?? {};
  if (tokens.access_token && (tokens.expires_at ?? 0) > Date.now() + 60_000) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) {
    throw new Error("firebase-tools-Configstore enthält keinen refresh_token.");
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
  if (!res.ok) {
    throw new Error(`Token-Refresh fehlgeschlagen (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Token-Refresh lieferte kein access_token.");
  return data.access_token;
}

// ─── Firestore REST ────────────────────────────────────────────────────────

const BASE = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;

async function listUsers(token) {
  const docs = [];
  let pageToken = undefined;
  do {
    const url = new URL(`${BASE}/users`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`users lesen: ${res.status} ${await res.text()}`);
    const data = await res.json();
    docs.push(...(data.documents ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

/** Setzt NUR das Feld gymId (updateMask) — der Rest des Dokuments bleibt. */
async function setGymId(token, uid, value) {
  const url = new URL(`${BASE}/users/${uid}`);
  url.searchParams.append("updateMask.fieldPaths", "gymId");
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { gymId: { stringValue: value } } }),
  });
  if (!res.ok) throw new Error(`${uid}: ${res.status} ${await res.text()}`);
}

// ─── Ablauf ────────────────────────────────────────────────────────────────

const token = await accessToken();
const users = await listUsers(token);

const missing = users.filter((d) => {
  const uid = d.name.split("/").pop();
  if (onlyUid && uid !== onlyUid) return false;
  return !d.fields?.gymId?.stringValue;
});

console.log(
  `${users.length} Nutzer gelesen — ${missing.length} ohne gymId-Feld` +
    (onlyUid ? ` (gefiltert auf ${onlyUid})` : ""),
);

if (missing.length === 0) {
  console.log("Nichts zu tun.");
  process.exit(0);
}

for (const d of missing) {
  const uid = d.name.split("/").pop();
  const mail = d.fields?.email?.stringValue ?? "—";
  const name = d.fields?.displayName?.stringValue ?? "—";
  if (dryRun) {
    console.log(`  [dry-run] ${uid}  ${mail}  (${name}) → gymId=${gymId}`);
    continue;
  }
  await setGymId(token, uid, gymId);
  console.log(`  gesetzt: ${uid}  ${mail}  (${name}) → gymId=${gymId}`);
}

console.log(
  dryRun
    ? "\nProbelauf — nichts geschrieben. Ohne --dry-run erneut ausführen."
    : `\nFertig: ${missing.length} Dokument(e) aktualisiert.`,
);
