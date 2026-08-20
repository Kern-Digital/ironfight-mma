"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import FightCampPlanView from "@/components/trainer/FightCampPlanView";
import { competitionGroup } from "@/components/trainer/CompetitionCard";
import {
  campOpponentId,
  deleteFightCamp,
  getFightCamp,
  updateFightCamp,
  type FightCamp,
  type OpponentProfile,
} from "@/lib/fight-camp";
import {
  getOpponent,
  resolveCampOpponent,
  type Opponent,
} from "@/lib/opponents";
import { getStudentEntry, type StudentEntry } from "@/lib/admin";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const GROUP_LABEL = {
  upcoming: "Geplant / Aktiv",
  past: "Vergangen",
  archived: "Archiviert",
} as const;

const GROUP_ACCENT = {
  upcoming: "var(--ta-cyan)",
  past: "var(--fg-3)",
  archived: "#9D7BFA",
} as const;

function CompetitionDetailContent({
  uid,
  campId,
}: {
  uid: string;
  campId: string;
}) {
  const router = useRouter();
  const [camp, setCamp] = useState<FightCamp | null>(null);
  const [student, setStudent] = useState<StudentEntry | null>(null);
  // Verknüpftes DeepFight-Profil — ergänzt den eingefrorenen Snapshot um
  // Antworten, die erst nach dem Anlegen des Wettkampfs dazugekommen sind.
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDna, setEditingDna] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setCamp(null);
    setOpponent(null);
    try {
      const [c, s] = await Promise.all([
        getFightCamp(uid, campId),
        getStudentEntry(uid).catch(() => null),
      ]);
      if (!c) throw new Error("Wettkampf nicht gefunden");
      setCamp(c);
      setStudent(s);
      const oppId = campOpponentId(c);
      setOpponent(oppId ? await getOpponent(oppId).catch(() => null) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [uid, campId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveDna(value: OpponentEditorValue) {
    if (!camp) return;
    setBusy(true);
    try {
      const opponent: OpponentProfile = {
        name: value.name,
        style: value.style,
        stance: value.stance,
        heightCm: value.heightCm,
        weightKg: value.weightKg,
        reachCm: value.reachCm,
        strengths: value.strengths,
        weaknesses: value.weaknesses,
        favoriteAttacks: value.favoriteAttacks,
        notes: value.notes ?? undefined,
        dna: value.dna,
        dnaSplit: value.dnaSplit,
        actionStats: value.actionStats,
        opponentId: camp.opponent.opponentId ?? camp.opponentId ?? null,
      };
      await updateFightCamp(uid, campId, { opponent });
      await load();
      setEditingDna(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: FightCamp["status"]) {
    if (!camp) return;
    setBusy(true);
    try {
      await updateFightCamp(uid, campId, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status-Update fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!camp) return;
    if (!confirm("Wettkampf wirklich löschen? Diese Aktion ist endgültig.")) return;
    try {
      await deleteFightCamp(uid, campId);
      router.push("/trainer/competitions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  if (error && !camp) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Wettkampf konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!camp) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const group = competitionGroup(camp);
  // Angezeigt wird der Snapshot, ergänzt um Antworten, die inzwischen im
  // verknüpften Profil dazugekommen sind. Speichern friert genau diesen Stand ein.
  const { profile: effOpponent, addedDnaCount } = resolveCampOpponent(
    camp.opponent,
    opponent,
  );
  const studentName =
    student?.displayName ??
    student?.authProviderName ??
    student?.email ??
    "Schüler";

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="border-b px-4 py-7 sm:px-6"
        style={{
          borderColor: "rgba(255,79,168,0.2)",
          background:
            "radial-gradient(520px 220px at 100% 50%, rgba(255,79,168,0.12), transparent 60%), linear-gradient(160deg, #140A12, #080512)",
        }}
      >
        <div className="mx-auto max-w-4xl">
          <Link
            href="/trainer/competitions"
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            ← Wettkampfbereich
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="font-display-ta font-black uppercase leading-none"
                  style={{ fontSize: "clamp(22px, 4vw, 32px)", letterSpacing: "0.02em" }}
                >
                  {camp.competitionName}
                </h1>
                <span
                  className="font-mono-ta rounded-md px-2 py-1 text-[9px] font-bold uppercase"
                  style={{
                    letterSpacing: "0.12em",
                    background: "var(--ink-4)",
                    border: `1px solid ${GROUP_ACCENT[group]}`,
                    color: GROUP_ACCENT[group],
                  }}
                >
                  {GROUP_LABEL[group]}
                </span>
              </div>
              <p
                className="font-mono-ta mt-2 text-[10px]"
                style={{ letterSpacing: "0.18em", color: "var(--fg-4)" }}
              >
                <Link
                  href={`/trainer/students/${uid}`}
                  style={{ color: "var(--ta-cyan)" }}
                >
                  {studentName}
                </Link>{" "}
                · vs {camp.opponent.name} · {formatDate(camp.competitionDate)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {camp.opponent.opponentId && (
                <Link
                  href={`/trainer/opponents/${camp.opponent.opponentId}`}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  Geteiltes Profil
                </Link>
              )}
              {group === "archived" ? (
                <button
                  onClick={() => setStatus("active")}
                  disabled={busy}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  Reaktivieren
                </button>
              ) : (
                <button
                  onClick={() => setStatus("archived")}
                  disabled={busy}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  Archivieren
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
        {error && (
          <div className="mb-5">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {/* DeepFight-Profil (eingefrorener Snapshot dieses Wettkampfs) */}
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2
              className="font-display-ta font-black uppercase"
              style={{ fontSize: "18px", letterSpacing: "0.05em" }}
            >
              <DeepFightWordmark />
            </h2>
            {!editingDna && (
              <button
                onClick={() => setEditingDna(true)}
                className="btn-primary px-4 py-2 text-xs"
              >
                Bearbeiten
              </button>
            )}
          </div>

          {addedDnaCount > 0 && (
            <p
              className="font-mono-ta mb-3 rounded-lg px-3 py-2 text-[10px]"
              style={{
                letterSpacing: "0.1em",
                background: "rgba(157,123,250,0.1)",
                border: "1px solid rgba(157,123,250,0.3)",
                color: "#9D7BFA",
              }}
            >
              {addedDnaCount}{" "}
              {addedDnaCount === 1 ? "Antwort stammt" : "Antworten stammen"} aus
              dem verknüpften DeepFight-Profil und {addedDnaCount === 1 ? "kam" : "kamen"}{" "}
              nach dem Anlegen dieses Wettkampfs dazu. Eigene Wettkampf-Notizen
              bleiben unverändert. Beim Speichern wird dieser Stand fest
              übernommen.
            </p>
          )}

          {editingDna ? (
            <OpponentEditor
              initial={{
                name: effOpponent.name,
                style: effOpponent.style,
                stance: effOpponent.stance,
                heightCm: effOpponent.heightCm,
                weightKg: effOpponent.weightKg,
                reachCm: effOpponent.reachCm,
                strengths: effOpponent.strengths,
                weaknesses: effOpponent.weaknesses,
                favoriteAttacks: effOpponent.favoriteAttacks,
                notes: effOpponent.notes ?? null,
                dna: effOpponent.dna ?? {},
                dnaSplit: effOpponent.dnaSplit,
                actionStats: effOpponent.actionStats,
              }}
              busy={busy}
              submitLabel="DeepFight-Profil speichern"
              onSubmit={handleSaveDna}
              onCancel={() => setEditingDna(false)}
            />
          ) : (
            <OpponentProfileView
              opponent={{
                name: effOpponent.name,
                style: effOpponent.style,
                stance: effOpponent.stance,
                heightCm: effOpponent.heightCm,
                weightKg: effOpponent.weightKg,
                reachCm: effOpponent.reachCm,
                strengths: effOpponent.strengths,
                weaknesses: effOpponent.weaknesses,
                favoriteAttacks: effOpponent.favoriteAttacks,
                notes: effOpponent.notes ?? null,
                dna: effOpponent.dna ?? {},
                dnaSplit: effOpponent.dnaSplit,
                actionStats: effOpponent.actionStats,
              }}
            />
          )}
        </div>

        {/* Trainingsplan (4 Phasen) */}
        <div className="mt-8">
          <h2
            className="font-display-ta mb-3 font-black uppercase"
            style={{ fontSize: "18px", letterSpacing: "0.05em" }}
          >
            Trainingsplan
          </h2>
          <FightCampPlanView camp={camp} showOpponent={false} />
        </div>

        {/* Gefahrenzone */}
        <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--ink-4)" }}>
          <button
            onClick={handleDelete}
            className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] uppercase"
            style={{
              letterSpacing: "0.15em",
              background: "transparent",
              border: "1px solid var(--ink-5)",
              color: "var(--fg-4)",
            }}
          >
            Wettkampf löschen
          </button>
        </div>
      </div>
    </main>
  );
}

export default function CompetitionDetailPage({
  params,
}: {
  params: { uid: string; campId: string };
}) {
  return <CompetitionDetailContent uid={params.uid} campId={params.campId} />;
}
