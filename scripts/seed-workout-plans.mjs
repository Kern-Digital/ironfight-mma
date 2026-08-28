/**
 * Workout-Plan-Seeding (Etappe „Workout-Pläne", Schritt 5 Teil 2) —
 * idempotent, beliebig oft ausführbar.
 *
 * Schreibt die Start-Pläne aus lib/workout-plan-defaults.ts nach
 * gyms/{gymId}/workoutPlans. Doc-ID = Plan-Slug, damit die Deep-Links
 * /workout/plans/[slug] stabil bleiben. Bestehende Dokumente werden NIE
 * überschrieben (Trainer-Änderungen bleiben erhalten) — außer mit --force.
 *
 * Aufruf (aus dem App-Root):
 *   node scripts/seed-workout-plans.mjs --dry-run    # nur kompilieren + validieren, KEIN Netz
 *   node scripts/seed-workout-plans.mjs --check      # zusätzlich Firestore LESEN (keine Writes)
 *   node scripts/seed-workout-plans.mjs              # seedet ins Default-Gym
 *   node scripts/seed-workout-plans.mjs --gym=<id>   # anderes Gym (Doc muss existieren)
 *   node scripts/seed-workout-plans.mjs --force      # vorhandene Slugs überschreiben
 *
 * Credentials (wie die Multi-Gym-Migration):
 *   1. GOOGLE_APPLICATION_CREDENTIALS gesetzt → firebase-admin (Admin-SDK)
 *   2. sonst REST über die eingeloggten firebase-tools-Credentials
 *      (~/.config/configstore/firebase-tools.json; Client-ID/-Secret sind die
 *      ÖFFENTLICHEN firebase-tools-Konstanten, per Env übersteuerbar).
 *   Beide Wege laufen über IAM und damit AN DEN SECURITY RULES VORBEI —
 *   der Rules-Deploy bleibt trotzdem Pflicht, damit die CLIENTS die
 *   geseedeten Pläne lesen dürfen (gyms/{gymId}/workoutPlans-Regel).
 *
 * Cutover-Reihenfolge (erst nach Leons Freigabe):
 *   1. npx firebase-tools deploy --only firestore:rules
 *   2. node scripts/seed-workout-plans.mjs --dry-run   → Ausgabe prüfen
 *   3. node scripts/seed-workout-plans.mjs             → seedet
 *   4. Fallback abschalten: listWorkoutPlansForGym (lib/workout-plans.ts)
 *      gibt nur noch die Gym-Pläne zurück; DEFAULT_WORKOUT_PLANS bleibt als
 *      Datenquelle DIESES Skripts bestehen.
 *   5. npx tsc --noEmit + Abnahme im Dev-Server, dann Commit.
 *
 * Die Plan-Daten liegen in TypeScript (lib/workout-plan-defaults.ts). Das
 * Skript kompiliert sie mit dem Projekt-tsc in ein Temp-Verzeichnis nach
 * CommonJS und lädt sie von dort — die Datei und ihr Import-Umfeld
 * (gym.ts, types.ts, exercises.ts) sind bewusst firebase-frei.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_GYM_ID = "tidal-athletics";
const UPDATED_BY = "seed-workout-plans";

// Öffentliche OAuth-Konstanten aus firebase-tools (lib/api.js) — identisch
// für jede Installation, per Env übersteuerbar wie im Original.
const FIREBASE_TOOLS_CLIENT_ID =
  process.env.FIREBASE_CLIENT_ID ??
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_TOOLS_CLIENT_SECRET =
  process.env.FIREBASE_CLIENT_SECRET ?? "j9iVZfS8kkCEFUPaAeJV0sAi";

// ─── Argumente ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const DRY_RUN = flag("dry-run");
const CHECK = flag("check");
const FORCE = flag("force");
const GYM_ID = option("gym") ?? DEFAULT_GYM_ID;

// ─── Plan-Daten: TS-Quellen kompilieren und laden ──────────────────────────

function loadPlanData() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ta-seed-"));
  try {
    const tscJs = require.resolve("typescript/lib/tsc.js");
    const result = spawnSync(
      process.execPath,
      [
        tscJs,
        "lib/workout-plan-defaults.ts",
        "lib/exercises.ts",
        "--outDir", tmp,
        "--module", "commonjs",
        "--target", "es2020",
        "--moduleResolution", "node",
        "--esModuleInterop",
        "--skipLibCheck",
      ],
      { cwd: APP_ROOT, encoding: "utf8" },
    );
    // tsc meldet für lib/types.ts einen bekannten Typ-Fehler (der
    // "@/components/ui/Icon"-Alias löst sich ohne tsconfig nicht auf — reiner
    // Typ-Import, wird beim Emit entfernt). Entscheidend ist deshalb NICHT
    // der Exit-Code, sondern ob die erwarteten Dateien emittiert wurden.
    const emitted = (name) => {
      const flat = path.join(tmp, name);
      const nested = path.join(tmp, "lib", name);
      if (fs.existsSync(flat)) return flat;
      if (fs.existsSync(nested)) return nested;
      throw new Error(
        `tsc hat ${name} nicht emittiert:\n${result.stdout}${result.stderr}`,
      );
    };
    const defaults = require(emitted("workout-plan-defaults.js"));
    const exercises = require(emitted("exercises.js"));
    return {
      plans: defaults.DEFAULT_WORKOUT_PLANS,
      exerciseIds: new Set(exercises.EXERCISES.map((e) => e.id)),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ─── Validierung ───────────────────────────────────────────────────────────

function validate(plans, exerciseIds) {
  const errors = [];
  const warnings = [];
  const slugs = new Set();
  const perCell = new Map();

  for (const plan of plans) {
    const where = `Plan "${plan.slug}"`;
    if (plan.id !== plan.slug) {
      errors.push(`${where}: id (${plan.id}) ≠ slug — Doc-ID wäre uneindeutig.`);
    }
    if (slugs.has(plan.slug)) errors.push(`${where}: Slug doppelt.`);
    slugs.add(plan.slug);
    if (!plan.name?.trim()) errors.push(`${where}: name fehlt.`);
    if (!Array.isArray(plan.blocks) || plan.blocks.length === 0) {
      errors.push(`${where}: keine Blöcke.`);
      continue;
    }
    plan.blocks.forEach((block, i) => {
      const bw = `${where}, Block ${i + 1} („${block.title}")`;
      if (!block.exerciseIds?.length) warnings.push(`${bw}: keine Übungen.`);
      for (const id of block.exerciseIds ?? []) {
        if (!exerciseIds.has(id)) errors.push(`${bw}: unbekannte Übung "${id}".`);
      }
      if (!Number.isFinite(block.restSeconds) || block.restSeconds < 0) {
        errors.push(`${bw}: restSeconds ungültig (${block.restSeconds}).`);
      }
      if (
        block.restAfterSeconds !== undefined &&
        (!Number.isFinite(block.restAfterSeconds) || block.restAfterSeconds < 0)
      ) {
        errors.push(`${bw}: restAfterSeconds ungültig (${block.restAfterSeconds}).`);
      }
    });
    for (const id of Object.keys(plan.restOverrides ?? {})) {
      if (!exerciseIds.has(id)) {
        errors.push(`${where}: restOverrides verweist auf unbekannte Übung "${id}".`);
      }
    }
    const cell = `${plan.discipline} × ${plan.difficulty}`;
    perCell.set(cell, (perCell.get(cell) ?? 0) + 1);
  }

  // Schritt 5 Teil 1: exakt ZWEI Pläne pro Disziplin × Level.
  for (const [cell, count] of perCell) {
    if (count !== 2) warnings.push(`Zelle ${cell}: ${count} Pläne (erwartet 2).`);
  }
  return { errors, warnings };
}

// ─── Firestore-Payload (spiegelt planPayload in lib/workout-plans.ts) ──────

function payloadFor(gymId, plan, now) {
  return {
    gymId,
    discipline: plan.discipline,
    difficulty: plan.difficulty,
    name: plan.name,
    short: plan.short,
    description: plan.description,
    blocks: plan.blocks.map((b) => ({
      title: b.title,
      phase: b.phase,
      exerciseIds: b.exerciseIds,
      restSeconds: b.restSeconds,
      ...(b.restAfterSeconds !== undefined
        ? { restAfterSeconds: b.restAfterSeconds }
        : {}),
    })),
    ...(plan.restOverrides ? { restOverrides: plan.restOverrides } : {}),
    ...(plan.sortOrder !== undefined ? { sortOrder: plan.sortOrder } : {}),
    createdAt: now,
    updatedAt: now,
    updatedBy: UPDATED_BY,
  };
}

// ─── Backend A: Admin-SDK (GOOGLE_APPLICATION_CREDENTIALS) ─────────────────

async function adminBackend() {
  const { applicationDefault, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  return {
    label: "Admin-SDK",
    async gymExists(gymId) {
      return (await db.doc(`gyms/${gymId}`).get()).exists;
    },
    async existingPlanIds(gymId) {
      const snap = await db.collection(`gyms/${gymId}/workoutPlans`).get();
      return new Set(snap.docs.map((d) => d.id));
    },
    async writePlan(gymId, slug, payload) {
      await db.doc(`gyms/${gymId}/workoutPlans/${slug}`).set(payload);
    },
  };
}

// ─── Backend B: REST über firebase-tools-Credentials ───────────────────────

function firebaseProject() {
  try {
    const rc = JSON.parse(
      fs.readFileSync(path.join(APP_ROOT, ".firebaserc"), "utf8"),
    );
    return rc.projects?.default ?? "ironfight-mma";
  } catch {
    return "ironfight-mma";
  }
}

async function firebaseToolsAccessToken() {
  const file = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  let store;
  try {
    store = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(
      `Keine firebase-tools-Credentials gefunden (${file}). ` +
        "Entweder `npx firebase-tools login` ausführen oder " +
        "GOOGLE_APPLICATION_CREDENTIALS setzen.",
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
      client_id: FIREBASE_TOOLS_CLIENT_ID,
      client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
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

/** JS-Wert → Firestore-REST-Value (undefined-Felder werden ausgelassen). */
function toFsValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFsFields(v) } };
  throw new Error(`Nicht kodierbarer Wert: ${typeof v}`);
}

function toFsFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFsValue(v);
  }
  return fields;
}

async function restBackend() {
  const project = firebaseProject();
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const token = await firebaseToolsAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const call = async (method, url, body) => {
    const res = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`${method} ${url} → ${res.status}: ${await res.text()}`);
    }
    return res.json();
  };
  return {
    label: `REST (${project}, firebase-tools-Login)`,
    async gymExists(gymId) {
      return (await call("GET", `${base}/gyms/${gymId}`)) !== null;
    },
    async existingPlanIds(gymId) {
      const ids = new Set();
      let pageToken;
      do {
        const url = new URL(`${base}/gyms/${gymId}/workoutPlans`);
        url.searchParams.set("pageSize", "300");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const data = (await call("GET", url.toString())) ?? {};
        for (const doc of data.documents ?? []) {
          ids.add(doc.name.split("/").pop());
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
      return ids;
    },
    async writePlan(gymId, slug, payload) {
      // PATCH ohne updateMask ersetzt das Dokument komplett (set-Semantik).
      await call("PATCH", `${base}/gyms/${gymId}/workoutPlans/${slug}`, {
        fields: toFsFields(payload),
      });
    },
  };
}

// ─── Hauptlauf ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Lade Plan-Daten (tsc-Kompilierung) …`);
  const { plans, exerciseIds } = loadPlanData();
  console.log(`  ${plans.length} Start-Pläne, ${exerciseIds.size} Übungen in der DB.`);

  const { errors, warnings } = validate(plans, exerciseIds);
  for (const w of warnings) console.warn(`  WARNUNG: ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  FEHLER: ${e}`);
    throw new Error(`Validierung fehlgeschlagen (${errors.length} Fehler) — nichts geschrieben.`);
  }
  console.log(`  Validierung ok (${warnings.length} Warnungen).`);

  console.log(`\nZiel: gyms/${GYM_ID}/workoutPlans (Doc-ID = Slug)`);
  for (const p of plans) {
    const count = p.blocks.reduce((s, b) => s + b.exerciseIds.length, 0);
    console.log(
      `  ${String(p.sortOrder ?? "-").padStart(2)}  ${p.slug.padEnd(28)} ${p.discipline.padEnd(10)} ${p.difficulty.padEnd(15)} ${count} Übungen`,
    );
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: keine Netzwerk-Zugriffe, nichts geschrieben.");
    return;
  }

  const backend = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? await adminBackend()
    : await restBackend();
  console.log(`\nBackend: ${backend.label}`);

  if (!(await backend.gymExists(GYM_ID))) {
    throw new Error(
      `gyms/${GYM_ID} existiert nicht — Tippfehler? Das Default-Gym legt ` +
        "scripts/migrate-multi-gym.mjs an; neue Gyms kommen mit Phase 2.",
    );
  }
  const existing = await backend.existingPlanIds(GYM_ID);
  console.log(`  Gym vorhanden, ${existing.size} bestehende Plan-Dokumente.`);

  if (CHECK) {
    if (existing.size > 0) {
      console.log(`  Vorhandene Slugs: ${Array.from(existing).sort().join(", ")}`);
    }
    console.log("\n--check: nur gelesen, nichts geschrieben.");
    return;
  }

  const now = new Date();
  let written = 0;
  let skipped = 0;
  for (const plan of plans) {
    if (existing.has(plan.slug) && !FORCE) {
      skipped += 1;
      console.log(`  übersprungen (existiert): ${plan.slug}`);
      continue;
    }
    await backend.writePlan(GYM_ID, plan.slug, payloadFor(GYM_ID, plan, now));
    written += 1;
    console.log(`  geschrieben: ${plan.slug}`);
  }
  console.log(`\nSeeding abgeschlossen: ${written} geschrieben, ${skipped} übersprungen.`);
  if (written > 0) {
    console.log(
      "Nächster Schritt: Fallback abschalten (listWorkoutPlansForGym in lib/workout-plans.ts).",
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
