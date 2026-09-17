/**
 * POST /api/video-analysis/flag — eine Analyse als „falscher Kämpfer"
 * markieren (oder die Marke zurücknehmen) und das Profil neu rechnen.
 * Plattform-Admin darf zusätzlich endgültig löschen (Demo-Bestand).
 *
 * Body:    { mode, targetId, analysisId, action: "flag", wrongFighter: boolean }
 *          { mode, targetId, analysisId, action: "delete" }        (nur Admin)
 * Antwort: { analysis: <Dokument mit id>, strength }  bzw.  { ok: true, strength }
 *
 * WARUM MARKIEREN STATT LÖSCHEN (Leon 14.09.): Niemand schaut mehr auf die
 * Übernahme. Eine Analyse, die falsch zählt, muss raus aus der Rechnung —
 * aber nachvollziehbar und umkehrbar. Das Dokument bleibt, `wrongFighter`
 * nimmt es aus der Rechnung, und der Trainer sieht, was er markiert hat.
 *
 * Zugriff wie /commit: dasselbe Tor wie die Rules, serverseitig geprüft.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import {
  canAccessMember,
  canAccessOpponent,
  readMember,
} from "@/lib/server/member-access";
import { analysesRef, recomputeProfile } from "@/lib/server/profile-recompute";
import {
  bearerToken,
  isAdmin,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";
import type { AnalysisMode } from "@/lib/video-analysis";

export const runtime = "nodejs";

interface Body {
  mode?: AnalysisMode;
  targetId?: string;
  analysisId?: string;
  action?: "flag" | "delete";
  wrongFighter?: boolean;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user || !isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const { mode, targetId, analysisId, action } = body;
  if (mode !== "opponent" && mode !== "athlete") {
    return NextResponse.json({ error: "Ungültiger Modus." }, { status: 400 });
  }
  if (!targetId?.trim() || !analysisId?.trim()) {
    return NextResponse.json({ error: "Ziel oder Analyse fehlt." }, { status: 400 });
  }
  if (action !== "flag" && action !== "delete") {
    return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
  }
  if (action === "delete" && !isAdmin(user)) {
    return NextResponse.json(
      { error: "Löschen ist Betreiber-Sache — markier die Analyse als falschen Kämpfer." },
      { status: 403 },
    );
  }

  try {
    const db = adminDb();

    // ── Tor ───────────────────────────────────────────────────────────────
    if (mode === "opponent") {
      const snap = await db.collection("opponents").doc(targetId).get();
      const gymId = snap.exists && typeof snap.data()?.gymId === "string" ? (snap.data()!.gymId as string) : "";
      if (!snap.exists || !canAccessOpponent(user, gymId)) {
        return NextResponse.json({ error: "Kein Zugriff auf dieses Gegnerprofil." }, { status: 403 });
      }
    } else {
      const member = await readMember(db, targetId);
      if (!member || !canAccessMember(user, targetId, member, "deepfight")) {
        return NextResponse.json({ error: "Kein Zugriff auf dieses Kampfprofil." }, { status: 403 });
      }
    }

    const ref = analysesRef(db, mode, targetId).doc(analysisId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Analyse nicht gefunden." }, { status: 404 });
    }

    if (action === "delete") {
      await ref.delete();
      const { profil } = await recomputeProfile(db, mode, targetId, user.uid);
      return NextResponse.json({ ok: true, strength: profil.evidence.staerke ?? 0 });
    }

    await ref.update({ wrongFighter: body.wrongFighter === true });
    const { profil } = await recomputeProfile(db, mode, targetId, user.uid);
    const data = (await ref.get()).data() ?? {};
    const createdAt = data.createdAt as { toDate(): Date } | undefined;
    return NextResponse.json({
      analysis: {
        ...data,
        id: ref.id,
        createdAt: (createdAt?.toDate() ?? new Date()).toISOString(),
      },
      strength: profil.evidence.staerke ?? 0,
    });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Vorgang fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
