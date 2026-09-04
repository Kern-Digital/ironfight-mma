"use client";

import PageHead from "@/components/shell/PageHead";
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
import { getMemberEntry, type StudentEntry } from "@/lib/admin";
import { hasAnyRight } from "@/lib/roles";

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
  archived: "var(--accent-2)",
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
      // getMemberEntry statt getStudentEntry: Die Seite braucht nur den
      // NAMEN, und der steht am users-Dokument. Das Athletenprofil eine Ebene
      // tiefer hängt am Bereich „athlet" — wer seinen Wettkampf freigibt,
      // muss dafür nicht auch sein Profil hergeben, und dann stünde hier
      // sonst „Athlet" statt eines Namens.
      const [c, s] = await Promise.all([
        getFightCamp(uid, campId),
        getMemberEntry(uid).catch(() => null),
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

  /**
   * `ownerIsStaff` bei jedem Speichern mitschreiben (Schritt 2b). Es heilt
   * Camps aus der Zeit vor dem Backfill und zieht nach, falls sich die Rechte
   * des Besitzers geändert haben. Steht der Name (noch) nicht fest, bleibt das
   * Feld weg — dann behält das Dokument seinen bisherigen Wert, und die Regel
   * prüft weiter gegen den.
   */
  function ownerFlag(): { ownerIsStaff?: boolean } {
    return student ? { ownerIsStaff: hasAnyRight(student.rights) } : {};
  }

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
      await updateFightCamp(uid, campId, { opponent, ...ownerFlag() });
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
      await updateFightCamp(uid, campId, { status, ...ownerFlag() });
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
    "Athlet";

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      <PageHead
        lane="detail"
        back={{ href: "/trainer/competitions", label: "Wettkampfbereich" }}
        title={camp.competitionName}
        description={
          <>
            <Link
              href={`/trainer/athleten/${uid}`}
              style={{ color: "var(--accent-text)" }}
            >
              {studentName}
            </Link>{" "}
            · vs {camp.opponent.name} · {formatDate(camp.competitionDate)}
          </>
        }
        aside={
          <>
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
          </>
        }
      >
        <span
          className="inline-flex w-fit rounded-badge px-2 py-1"
          style={{
            font: "var(--type-meta)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            background: "var(--surface-raised)",
            border: `1px solid ${GROUP_ACCENT[group]}`,
            color: GROUP_ACCENT[group],
          }}
        >
          {GROUP_LABEL[group]}
        </span>
      </PageHead>

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
                background: "color-mix(in oklab, var(--accent-2) 10%, transparent)",
                border:
                  "1px solid color-mix(in oklab, var(--accent-2) 30%, transparent)",
                color: "var(--accent-2)",
              }}
            >
              {addedDnaCount}{" "}
              {addedDnaCount === 1 ? "Antwort stammt" : "Antworten stammen"} aus
              dem verknüpften DeepFight-Profil und {addedDnaCount === 1 ? "kam" : "kamen"}{" "}
              nach dem Anlegen dieses Wettkampfs dazu. Deine eigenen
              Wettkampf-Notizen bleiben, wie sie sind. Mit dem Speichern frierst
              du diesen Stand ein.
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
