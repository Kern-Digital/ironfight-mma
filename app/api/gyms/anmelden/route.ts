/**
 * POST /api/gyms/anmelden — ein Gym legt sich selbst an (Schritt 1 des
 * Geschäftsplans, 21.09.2026).
 *
 * Body:    { name: string }
 * Antwort: { gymId, name }
 *
 * Leon 21.09.: „ich will das es automatisch erstellt wird sobald der gym
 * betreiber sich dafür anmeldet. dann soll er nach abschluss der
 * registrierung die kostenlose version direkt nutzen können." Also KEINE
 * Freigabe, keine Warteliste: Das Gym entsteht in diesem Aufruf, und der
 * Aufrufer wird seine Verwaltung und sein erster Trainer. Stilllegen bleibt
 * Leons Notfallhebel (/admin).
 *
 * Wer darf das: jedes angemeldete Konto, das noch KEINEM Gym gehört (kein
 * gymId-Claim). Ein fehlender Claim gilt heute als Default-Gym-Mitglied —
 * wer hier ein Gym anlegt, verlässt damit das Default-Gym. Wer schon einen
 * Claim trägt, bekommt 409: Ein Wechsel ist ein Verwaltungsvorgang.
 *
 * Kürzel: aus dem Namen (slugifyGym); ist es vergeben — auch das
 * Default-Gym „tidal-athletics" —, hängt die Route -2 … -9 an.
 *
 * Reihenfolge und Rücknahme: (1) Gym-Dokument in einer Transaktion anlegen
 * (nur, wenn es noch nicht existiert), (2) Claims setzen — gymId, trainer,
 * verwaltung, bestehende Claims gemergt, (3) users-Spiegel, (4) Protokoll.
 * Scheitert (2), wird (1) zurückgenommen — sonst gäbe es ein Gym ohne
 * Verwaltung. Scheitert (3), bleibt das Gym: Der Spiegel heilt sich beim
 * nächsten Rechte-Vorgang, und der Claim ist ohnehin autoritativ.
 */

import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AdminUnavailableError, adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { displayNameFor, writeAudit } from "@/lib/server/audit";
import { bearerToken, verifyUser } from "@/lib/server/verify-user";
import { DEFAULT_GYM_ID, FREIE_ANALYSEN, slugifyGym } from "@/lib/gym";
import { claimsWithRights, rightsMirror, type RoleSet } from "@/lib/roles";

export const runtime = "nodejs";

const NAME_MIN = 2;
const NAME_MAX = 60;

/** Freies Kürzel — der Wunschname, sonst -2 bis -9. */
async function freiesKuerzel(db: FirebaseFirestore.Firestore, name: string): Promise<string | null> {
  const basis = slugifyGym(name);
  const kandidaten = [basis, ...Array.from({ length: 8 }, (_, i) => `${basis}-${i + 2}`)];
  for (const k of kandidaten) {
    if (k === DEFAULT_GYM_ID) continue;
    const snap = await db.collection("gyms").doc(k).get();
    if (!snap.exists) return k;
  }
  return null;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (user.gymId) {
    return NextResponse.json(
      { error: "Dein Konto gehört bereits zu einem Gym. Ein Wechsel läuft über die Verwaltung." },
      { status: 409 },
    );
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return NextResponse.json(
      { error: `Der Gym-Name braucht ${NAME_MIN} bis ${NAME_MAX} Zeichen.` },
      { status: 400 },
    );
  }

  try {
    const db = adminDb();
    const gymId = await freiesKuerzel(db, name);
    if (!gymId) {
      return NextResponse.json(
        { error: "Diesen Namen tragen schon zu viele Gyms. Bitte wähle einen anderen." },
        { status: 409 },
      );
    }
    const ref = db.collection("gyms").doc(gymId);

    // ── 1. Gym anlegen — atomar, nur wenn das Kürzel noch frei ist ──────
    const now = Timestamp.now();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) throw new Error("gym-existiert");
      tx.create(ref, {
        name,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
        branding: null,
        // Der Gratis-Tarif (Plan „Das zweite Gym"): kein Zeitraum, kein
        // Betrag — nur die drei Analysen zum Ausprobieren. Schritt 2 zählt
        // `analysisUsed` hoch und stoppt bei `analysisQuota`.
        subscription: {
          status: "active",
          plan: "free",
          analysisQuota: FREIE_ANALYSEN,
          analysisUsed: 0,
          currentPeriodEnd: null,
        },
      });
    });

    // ── 2. Claims: Gründer = Verwaltung + Trainer, alles andere bleibt ──
    const rechte: RoleSet = { ...user.stored, trainer: true, verwaltung: true };
    try {
      const existing = (await adminAuth().getUser(user.uid)).customClaims ?? {};
      await adminAuth().setCustomUserClaims(user.uid, {
        ...claimsWithRights(existing, rechte),
        gymId,
      });
    } catch (claimErr) {
      await ref.delete().catch(() => {});
      throw claimErr;
    }

    // ── 3. users-Spiegel ────────────────────────────────────────────────
    await db
      .collection("users")
      .doc(user.uid)
      .set({ gymId, gymJoinedAt: now, ...rightsMirror(rechte) }, { merge: true })
      .catch((err) => console.warn("[gyms/anmelden] Spiegel fehlgeschlagen:", err));

    // ── 4. Protokoll — der erste Eintrag des neuen Gyms ─────────────────
    const actorName = await displayNameFor(db, user.uid, "Gründer");
    await writeAudit(db, gymId, {
      type: "gym.create",
      actorUid: user.uid,
      actorName,
      details: { name, freieAnalysen: FREIE_ANALYSEN },
    });

    return NextResponse.json({ gymId, name });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server nicht bereit." }, { status: 503 });
    }
    if (err instanceof Error && err.message === "gym-existiert") {
      return NextResponse.json({ error: "Dieses Kürzel wurde gerade vergeben. Bitte noch einmal." }, { status: 409 });
    }
    console.error("[gyms/anmelden]", err);
    return NextResponse.json({ error: "Das Gym ließ sich nicht anlegen." }, { status: 500 });
  }
}
