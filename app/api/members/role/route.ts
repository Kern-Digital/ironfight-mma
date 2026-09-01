/**
 * POST /api/members/role — Rechte eines Mitglieds setzen (Verwaltung).
 *
 * Body:    { uid, trainer: boolean, verwaltung: boolean }
 * Antwort: { ok: true, uid, role, verwaltung }
 *
 * Das ist die Rollen-API aus Konzept §4 — die Ablösung des Hand-Scripts
 * `scripts/set-role.mjs` für alles, was ein Gym selbst entscheiden darf.
 *
 * WAS DER BODY NICHT KANN, IST DER HALBE SCHUTZ: Er trägt genau zwei
 * Wahrheitswerte und eine uid. Es gibt kein Feld für `role` (also auch keins
 * für „admin") und keins für `gymId`. Beides ist damit nicht bloß verboten,
 * sondern nicht ausdrückbar. Der Rest sind die harten Prüfungen unten.
 *
 * Reihenfolge und ihre Begründung:
 *   1. ALLE Prüfungen zuerst — Aufrufer, Gym, Ziel, Aussperr-Schutz. Nichts
 *      wird geschrieben, solange eine davon offen ist.
 *   2. CLAIMS setzen (gemerged). Sie sind autoritativ: firestore.rules und
 *      die Middleware lesen ausschließlich sie.
 *   3. users-Dokument spiegeln. Der Spiegel existiert nur, weil Custom Claims
 *      nicht abfragbar sind — ohne ihn ließe sich „hat dieses Gym noch eine
 *      Verwaltung?" gar nicht beantworten. Schlägt er fehl, werden die Claims
 *      ZURÜCKGENOMMEN: ein Recht, das niemand mehr zählen kann, ist schlimmer
 *      als ein Klick, der sichtbar fehlgeschlagen ist.
 *
 * Wer sich selbst geändert hat, muss danach `refreshRole()` rufen — der neue
 * Claim steckt im ID-Token, und das holt der Client nicht von allein.
 */

import { NextResponse } from "next/server";
import {
  AdminUnavailableError,
  adminAuth,
  adminDb,
} from "@/lib/server/firebase-admin";
import { displayNameFor, writeAudit } from "@/lib/server/audit";
import {
  bearerToken,
  canManageGym,
  isAdmin,
  userGymId,
  verifyUser,
} from "@/lib/server/verify-user";
import { DEFAULT_GYM_ID } from "@/lib/gym";
import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Wie viele Menschen könnten dieses Gym noch verwalten, wenn `excludeUid`
 * das Recht verliert?
 *
 * Gezählt wird über den users-Spiegel (Claims sind nicht abfragbar) und in
 * EINER Abfrage über alle Mitglieder des Gyms — statt zweier Abfragen mit
 * Gleichheitsfiltern, die je nach Index-Lage zusammengeführt werden müssten.
 * Ein Gym hat Hunderte Mitglieder, keine Hunderttausende; der Vorgang läuft
 * selten.
 *
 * Der Plattform-Admin zählt MIT. Er ist heute die Verwaltung jedes Gyms
 * (der Verwaltungs-Claim entsteht erst durch genau diese Route), und ohne
 * ihn wäre die allererste Vergabe nicht mehr rückgängig zu machen.
 */
async function countRemainingManagers(
  db: Firestore,
  gymId: string,
  excludeUid: string,
): Promise<number> {
  const snap = await db.collection("users").where("gymId", "==", gymId).get();
  let count = 0;
  for (const doc of snap.docs) {
    if (doc.id === excludeUid) continue;
    if (doc.get("verwaltung") === true || doc.get("role") === "admin") {
      count += 1;
    }
  }
  return count;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!canManageGym(user)) {
    return NextResponse.json(
      { error: "Nur die Gym-Verwaltung kann Rechte vergeben." },
      { status: 403 },
    );
  }

  let body: { uid?: string; trainer?: boolean; verwaltung?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const uid = (body.uid ?? "").toString().trim();
  if (!uid) {
    return NextResponse.json({ error: "Kein Mitglied angegeben." }, { status: 400 });
  }
  // Strikt auf `true` prüfen: ein fehlendes Feld ist „Recht weg", kein
  // „unverändert" — die Oberfläche schickt immer beide Häkchen.
  const wantTrainer = body.trainer === true;
  const wantVerwaltung = body.verwaltung === true;

  try {
    const db = adminDb();

    // ─── Ziel bestimmen (autoritativ aus den Claims, nicht aus Firestore) ──
    let targetClaims: Record<string, unknown>;
    let targetDisabled = false;
    try {
      const target = await adminAuth().getUser(uid);
      targetClaims = (target.customClaims ?? {}) as Record<string, unknown>;
      targetDisabled = target.disabled;
    } catch {
      return NextResponse.json(
        { error: "Dieses Mitglied gibt es nicht." },
        { status: 404 },
      );
    }
    if (targetDisabled) {
      return NextResponse.json(
        { error: "Dieses Konto ist gesperrt. Rechte lassen sich nicht ändern." },
        { status: 409 },
      );
    }

    const targetRole =
      typeof targetClaims.role === "string" ? targetClaims.role : "user";
    const targetGymId =
      (typeof targetClaims.gymId === "string" && targetClaims.gymId.trim()) ||
      DEFAULT_GYM_ID;
    const targetVerwaltung = targetClaims.verwaltung === true;

    // Fremdes Gym: Die Verwaltung entscheidet über IHR Gym. Der
    // Plattform-Admin darf gym-übergreifend handeln (Konzept §1); er wirkt
    // dann im Gym des Ziels — ein WECHSEL des Gyms findet nirgends statt.
    if (!isAdmin(user) && targetGymId !== userGymId(user)) {
      return NextResponse.json(
        { error: "Dieses Mitglied gehört nicht zu deinem Gym." },
        { status: 403 },
      );
    }

    // Plattform-Rechte werden nie über eine Gym-Oberfläche verändert — weder
    // vergeben (der Body kann es nicht) noch entzogen (hier).
    if (targetRole === "admin") {
      return NextResponse.json(
        { error: "Plattform-Rechte werden hier nicht verändert." },
        { status: 403 },
      );
    }

    const nextRole = wantTrainer ? "trainer" : "user";
    const unchanged =
      nextRole === targetRole && wantVerwaltung === targetVerwaltung;
    if (unchanged) {
      // Kein Schreibvorgang, kein Protokolleintrag — sonst füllt jeder
      // versehentlich geöffnete und wieder gespeicherte Dialog die Neuigkeiten.
      return NextResponse.json({
        ok: true,
        uid,
        role: nextRole,
        verwaltung: wantVerwaltung,
        unchanged: true,
      });
    }

    // ─── Aussperr-Schutz (Konzept §4) ───────────────────────────────────
    // Gilt bewusst auch, wenn jemand einem ANDEREN das letzte
    // Verwaltungsrecht entzieht: ein Gym ohne Verwaltung kann niemanden
    // mehr einladen und sich selbst nicht mehr helfen — wer den Klick
    // gemacht hat, ändert daran nichts.
    if (targetVerwaltung && !wantVerwaltung) {
      const remaining = await countRemainingManagers(db, targetGymId, uid);
      if (remaining < 1) {
        return NextResponse.json(
          {
            error:
              "Dein Gym braucht mindestens eine Verwaltung. Gib das Recht erst jemand anderem, dann kannst du es hier abgeben.",
          },
          { status: 409 },
        );
      }
    }

    // ─── Claims setzen (MERGEN!) ────────────────────────────────────────
    // setCustomUserClaims ERSETZT alle Claims. Ohne Merge verlöre das
    // Mitglied hier seinen `gymId` — und damit die Gym-Zugehörigkeit
    // (gleiche Lektion wie in /api/invites/redeem und scripts/set-role.mjs).
    // `gymId` wird bewusst NICHT gesetzt, nur durchgereicht.
    await adminAuth().setCustomUserClaims(uid, {
      ...targetClaims,
      role: nextRole,
      verwaltung: wantVerwaltung,
    });

    // ─── Spiegel im users-Dokument ──────────────────────────────────────
    try {
      await db
        .collection("users")
        .doc(uid)
        .set({ role: nextRole, verwaltung: wantVerwaltung }, { merge: true });
    } catch (mirrorErr) {
      await adminAuth()
        .setCustomUserClaims(uid, {
          ...targetClaims,
          role: targetRole,
          verwaltung: targetVerwaltung,
        })
        .catch(() => {});
      throw mirrorErr;
    }

    const [actorName, targetName] = await Promise.all([
      displayNameFor(db, user.uid),
      displayNameFor(db, uid, "Ein Mitglied"),
    ]);

    await writeAudit(db, targetGymId, {
      type: "member.role",
      actorUid: user.uid,
      actorName,
      targetUid: uid,
      targetName,
      details: {
        trainer: wantTrainer,
        verwaltung: wantVerwaltung,
        trainerBefore: targetRole === "trainer",
        verwaltungBefore: targetVerwaltung,
      },
    });

    return NextResponse.json({
      ok: true,
      uid,
      role: nextRole,
      verwaltung: wantVerwaltung,
    });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Die Rechteverwaltung ist serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] members/role:", msg);
    return NextResponse.json(
      { error: "Die Rechte konnten nicht geändert werden." },
      { status: 500 },
    );
  }
}
