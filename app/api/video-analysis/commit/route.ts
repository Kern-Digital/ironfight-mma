/**
 * POST /api/video-analysis/commit — fertige Analyse speichern und das
 * Profil aus ALLEN Analysen neu rechnen (Automatik statt Review, Etappe 1).
 *
 * Body:    { analysis: VideoAnalysisInput }   (lib/video-analysis.ts)
 * Antwort: { analysis: <gespeichertes Dokument mit id und `wirkung`>, strength: 0–100 }
 *
 * WAS DER SERVER SELBST SETZT — und dem Client deshalb nicht glaubt:
 *   • gymId und targetIsStaff aus dem ZIEL (Gegnerprofil bzw. users-Dokument),
 *     nie aus dem Body und nie aus dem Aufrufer: Die collectionGroup-Regel
 *     hängt an diesen zwei Feldern.
 *   • videoType (bis Etappe 2 aus der Beobachtung abgeleitet) und das
 *     aufgeschlüsselte Gewicht — die Währung des Profils rechnet nur hier.
 *   • wrongFighter=false, sharedWithAthlete=false, createdBy/-Name, createdAt.
 *
 * ZUGRIFF: dasselbe Tor wie die Rules (lib/server/member-access.ts). Das
 * Admin-SDK umgeht die Regeln, also prüft die Route es selbst — sonst wäre
 * sie eine Hintertür für Analysen über gesperrte Kollegen.
 *
 * KOSTEN werden hier gebucht (aiUsage/summary und aiUsage/gym-{gymId} mit
 * Monatsverlauf), nicht mehr vom Client. Best-effort: Eine Buchung, die
 * scheitert, lässt die Analyse nicht scheitern.
 */

import { NextResponse } from "next/server";
import { nachAntwortWeiter } from "@/lib/server/nachlauf";
import { FieldValue } from "firebase-admin/firestore";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { gameplaeneNachAnalyse } from "@/lib/server/gameplan";
import {
  canAccessMember,
  canAccessOpponent,
  readMember,
} from "@/lib/server/member-access";
import { bucheKiKosten } from "@/lib/server/ki-kosten";
import { analysesRef, recomputeProfile } from "@/lib/server/profile-recompute";
import {
  filtereBeobachtung,
  filtereTechnikStats,
  isFlaeche,
  splitNachSteckbrief,
  varianteFuer,
} from "@/lib/kampfart-steckbrief";
import {
  bearerToken,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";
import {
  computeVideoWeight,
  isSport,
  sideKeyFromText,
  videoTypeFromObservation,
  type VideoAnalysisInput,
} from "@/lib/video-analysis";

export const runtime = "nodejs";
// Der Nachlauf (Gameplans der betroffenen Wettkämpfe) läuft per waitUntil im
// Budget dieser Funktion — Claude braucht dafür 1–2 Minuten je Wettkampf.
export const maxDuration = 300;

const RECENCIES = new Set(["recent", "mid", "old", "ancient", "unknown"]);
const TYPES = new Set(["full", "excerpt", "sparring", "highlight"]);

function validate(a: VideoAnalysisInput | undefined): string | null {
  if (!a || (a.mode !== "opponent" && a.mode !== "athlete")) return "Ungültiger Modus.";
  if (!a.targetId?.trim()) return "Ziel fehlt.";
  if (!a.observation?.identification || !a.observation.meta) return "Beobachtung fehlt.";
  if (!a.evaluation || !Array.isArray(a.evaluation.findings)) return "Bewertung fehlt.";
  if (a.recency && !RECENCIES.has(a.recency)) return "Ungültiger Zeitraum.";
  if (a.videoType && !TYPES.has(a.videoType)) return "Ungültige Video-Art.";
  if (a.sport != null && !isSport(a.sport)) return "Ungültige Kampfart.";
  return null;
}

export async function POST(req: Request) {
  // Bis dahin läuft der Nachlauf sicher (maxDuration 300 s minus Puffer).
  const frist = Date.now() + 280_000;
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user || !isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }

  let body: { analysis?: VideoAnalysisInput };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const invalid = validate(body.analysis);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const input = body.analysis!;

  try {
    const db = adminDb();

    // ── Ziel lesen, Tor prüfen, gymId/targetIsStaff aus dem Ziel ──────────
    let gymId: string;
    let targetIsStaff = false;
    let targetName = input.targetName?.trim() || "";
    if (input.mode === "opponent") {
      const snap = await db.collection("opponents").doc(input.targetId).get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Gegnerprofil nicht gefunden." }, { status: 404 });
      }
      const d = snap.data() ?? {};
      gymId = typeof d.gymId === "string" ? d.gymId : "";
      if (!canAccessOpponent(user, gymId)) {
        return NextResponse.json({ error: "Kein Zugriff auf dieses Gegnerprofil." }, { status: 403 });
      }
      targetName = targetName || (typeof d.name === "string" ? d.name : "");
    } else {
      const member = await readMember(db, input.targetId);
      if (!member) {
        return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
      }
      if (!canAccessMember(user, input.targetId, member, "deepfight")) {
        return NextResponse.json({ error: "Kein Zugriff auf dieses Kampfprofil." }, { status: 403 });
      }
      gymId = member.gymId;
      targetIsStaff = member.isStaff;
      targetName = targetName || member.displayName || "";
    }

    // ── Währung rechnen ───────────────────────────────────────────────────
    const recency = input.recency ?? "unknown";
    const videoType = input.videoType ?? videoTypeFromObservation(input.observation);
    const weight = computeVideoWeight({ recency, videoType, observation: input.observation });

    // Seiten-Schlüssel sichern: fehlt einer (älteres Modell, Fallback), aus dem Text.
    const findings = input.evaluation.findings.map((f) => ({
      ...f,
      sideKey: f.sideKey?.trim() || sideKeyFromText(f.answer ?? ""),
    }));
    const confirms = (input.evaluation.merge?.confirms ?? []).map((c) =>
      typeof c === "string" ? { questionId: c, evidence: [] } : c,
    );

    // Kampfart-Steckbrief (17.09.2026): Zähler und Split gegen die Kampfart,
    // `verworfen` aus der Rohbeobachtung — der Server glaubt dem Client nicht.
    const sport = isSport(input.sport) ? input.sport : null;
    const variante = varianteFuer(sport, input.variante);
    const { verworfen } = filtereBeobachtung(input.observation, sport, variante);
    const zaehler = filtereTechnikStats(input.evaluation.actionStats, sport, variante).stats;

    const now = new Date();
    const ref = analysesRef(db, input.mode, input.targetId).doc();
    // Firestore verträgt kein undefined — JSON-Roundtrip räumt Reste weg.
    const doc = JSON.parse(
      JSON.stringify({
        mode: input.mode,
        targetId: input.targetId,
        targetName,
        gymId,
        targetIsStaff,
        sourceLabel: input.sourceLabel ?? "",
        sourceKind: input.sourceKind ?? "upload",
        youtubeUrl: input.youtubeUrl ?? null,
        fileFingerprint: input.fileFingerprint ?? null,
        fighter: input.fighter,
        tier: input.tier ?? "flash",
        recency,
        videoType,
        // Kampfart des VIDEOS (Etappe 2) — der Trainer hat sie auf dem
        // Zuordnungs-Schirm bestätigt; gültig ist sie oben geprüft.
        sport,
        // Nur bei Kickboxen: "kickboxen" | "muay-thai" (sonst null).
        variante,
        // Käfig, Ring oder Matte aus dem Vorlauf — Wörter und Kartenform.
        flaeche: isFlaeche(input.flaeche) ? input.flaeche : null,
        // Was in der Kampfart nicht zählt — Beleg für „Details anzeigen".
        verworfen,
        fightMonth: input.fightMonth ?? null,
        weight,
        models: input.models ?? { gemini: "", claude: "" },
        usage: input.usage ?? null,
        observation: input.observation,
        evaluation: {
          ...input.evaluation,
          findings,
          actionStats: zaehler,
          dnaSplit: splitNachSteckbrief(input.evaluation.dnaSplit, sport),
          merge: {
            confirms,
            contradicts: input.evaluation.merge?.contradicts ?? [],
            weight: input.evaluation.merge?.weight ?? 0,
          },
        },
        wrongFighter: false,
        sharedWithAthlete: false,
        createdBy: user.uid,
        createdByName: null,
      }),
    ) as Record<string, unknown>;
    await ref.set({ ...doc, createdAt: FieldValue.serverTimestamp() });

    // ── Profil neu rechnen — und festhalten, was DIESE Analyse bewegt hat ──
    const { profil, wirkung } = await recomputeProfile(db, input.mode, input.targetId, user.uid, {
      wirkungFuer: ref.id,
    });

    // ── Kosten buchen (Nebenbuchhaltung) ──────────────────────────────────
    // Seit 17.09.2026 über lib/server/ki-kosten.ts (gemeinsam mit Satz- und
    // Gameplan-Aufrufen). Die alte `bookUsage` schrieb `set({ "months.JJJJ-MM.x" },
    // { merge: true })` — das legt WÖRTLICHE Feldnamen mit Punkten an, die
    // Admin-Seite las für den Monat 0 €. bucheKiKosten schreibt echte Pfade
    // und hebt die Altfelder beim ersten Buchen um.
    if (input.usage) {
      try {
        await bucheKiKosten(db, gymId, input.usage, now, "analyse");
      } catch {
        /* darf die Analyse nie scheitern lassen */
      }
    }

    // ── Nachlauf: Gameplans der anstehenden Wettkämpfe neu schreiben ──────
    // Leon 17.09.2026: „nach jeder neuen Analyse automatisch". Läuft nach der
    // Antwort weiter und wirft nie (lib/server/gameplan.ts).
    nachAntwortWeiter(gameplaeneNachAnalyse(db, { mode: input.mode, targetId: input.targetId, sport, gymId, frist }));

    return NextResponse.json({
      analysis: { ...doc, id: ref.id, createdAt: now.toISOString(), wirkung },
      strength: profil.evidence.staerke ?? 0,
    });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Speichern fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
