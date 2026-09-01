/**
 * Admin-SDK-Zugang für Node-Scripts — mit dem Dienstkonto aus `.env.local`.
 *
 * WARUM NICHT `applicationDefault()` WIE IN DEN ÄLTEREN SCRIPTS: Das verlangt
 * `GOOGLE_APPLICATION_CREDENTIALS`, also eine Schlüsseldatei irgendwo auf der
 * Platte. Genau die soll verschwinden — der Schlüssel liegt seit dem
 * 31.08.2026 in `.env.local` (und in Vercel), wo ihn auch die Server-Routen
 * lesen (`lib/server/firebase-admin.ts`). Ein Geheimnis an zwei Orten ist
 * eines zu viel.
 *
 * Der alte Weg bleibt als Rückfall: Ist `FIREBASE_SERVICE_ACCOUNT_KEY` nicht
 * gesetzt, greift `applicationDefault()` wie bisher.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";

/**
 * Liest `.env.local` von Hand — die Scripts laufen ohne Next.js, das die
 * Datei sonst einliest. Bewusst schlicht: `KEY=WERT` pro Zeile, keine
 * Anführungszeichen (so steht es in der Konvention in CLAUDE.md), `#` ist
 * ein Kommentar.
 */
function readEnvLocal() {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function serviceAccount() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ||
    readEnvLocal().FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  // Base64 ist der empfohlene Weg: Der private Schlüssel enthält
  // Zeilenumbrüche, die in .env-Dateien zerbrechen.
  const json = raw.startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY unvollständig (project_id, client_email oder private_key fehlt).",
    );
  }
  return parsed;
}

/** Initialisiert firebase-admin und meldet, woher die Credentials kamen. */
export function initAdmin() {
  const account = serviceAccount();
  if (account) {
    initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key.replace(/\n/g, "\n"),
      }),
      projectId: account.project_id,
    });
    return { source: ".env.local", projectId: account.project_id };
  }
  initializeApp({ credential: applicationDefault() });
  return {
    source: "GOOGLE_APPLICATION_CREDENTIALS",
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "(unbekannt)",
  };
}
