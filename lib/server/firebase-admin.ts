/**
 * Admin-SDK-Zugang — NUR serverseitig (Route Handlers mit runtime="nodejs").
 *
 * Gebraucht wird er für genau die Vorgänge, die der Client per Definition
 * nicht darf: Custom Claims setzen (gymId + role beim Einlösen einer
 * Einladung) und Schreibzugriffe, die in den Firestore-Regeln bewusst
 * `write: if false` sind (Einladungen, Audit-Log).
 *
 * Credentials liegen in FIREBASE_SERVICE_ACCOUNT_KEY — entweder als rohes
 * JSON oder base64-kodiert. Base64 ist der empfohlene Weg: der private
 * Schlüssel enthält Zeilenumbrüche, die in .env-Dateien und in den
 * Eingabefeldern von Vercel zuverlässig zerbrechen.
 *
 * Initialisierung ist LAZY (Muster lib/firebase.ts) — ohne gesetzten
 * Schlüssel wirft erst der erste Aufruf, nicht schon der Import. Sonst
 * würde eine fehlende Variable den kompletten Build umwerfen.
 */

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** Fehlende/kaputte Credentials — Routen antworten darauf mit 503. */
export class AdminUnavailableError extends Error {}

const APP_NAME = "tidal-admin";

function readServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) {
    throw new AdminUnavailableError(
      "FIREBASE_SERVICE_ACCOUNT_KEY ist nicht gesetzt.",
    );
  }

  let json: string;
  try {
    json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
  } catch {
    throw new AdminUnavailableError(
      "FIREBASE_SERVICE_ACCOUNT_KEY ist weder JSON noch gültiges base64.",
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new AdminUnavailableError(
      "FIREBASE_SERVICE_ACCOUNT_KEY enthält kein gültiges JSON.",
    );
  }

  const projectId = typeof parsed.project_id === "string" ? parsed.project_id : "";
  const clientEmail =
    typeof parsed.client_email === "string" ? parsed.client_email : "";
  // Der Schlüssel trägt echte Zeilenumbrüche. Kommt er aus einer .env-Datei,
  // stehen dort oft die zwei Zeichen \n statt eines Umbruchs.
  const privateKey =
    typeof parsed.private_key === "string"
      ? parsed.private_key.replace(/\n/g, "\n")
      : "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new AdminUnavailableError(
      "Dienstkonto unvollständig (project_id, client_email oder private_key fehlt).",
    );
  }
  return { projectId, clientEmail, privateKey };
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  const account = readServiceAccount();
  return initializeApp(
    {
      credential: cert({
        projectId: account.projectId,
        clientEmail: account.clientEmail,
        privateKey: account.privateKey,
      }),
      projectId: account.projectId,
    },
    APP_NAME,
  );
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

/** Ist ein Dienstkonto hinterlegt? Für Vorab-Prüfungen in Routen. */
export function hasAdminCredentials(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
}
