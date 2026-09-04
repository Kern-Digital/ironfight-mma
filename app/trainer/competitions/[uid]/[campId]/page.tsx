"use client";

import PageHead from "@/components/shell/PageHead";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import FightCampPlanView from "@/components/trainer/FightCampPlanView";
import { MorphSwap } from "@/components/motion";
// GROUP_ACCENT kommt aus der Uebersicht — es gab hier eine zweite Fassung,
// und die beiden liefen auseinander: „Archiviert" war dort neutral und hier
// Brand-Violett. Eine Quelle, ein Aussehen.
import {
  GROUP_ACCENT,
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
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

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Zweitrangige Handlung im Seitenkopf — Fläche statt Farbe. */
const SEC_BTN: React.CSSProperties = {
  ...BTN_FONT,
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  textDecoration: "none",
};

const GROUP_LABEL = {
  upcoming: "Geplant / Aktiv",
  past: "Vergangen",
  archived: "Archiviert",
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
  // Rueckfrage vor dem Loeschen — inline statt Browser-Popup, siehe unten.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (!camp || deleting) return;
    setDeleting(true);
    try {
      await deleteFightCamp(uid, campId);
      router.push("/trainer/competitions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setDeleting(false);
      setConfirmDelete(false);
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
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
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
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
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
                data-press
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
                style={SEC_BTN}
              >
                Geteiltes Profil
              </Link>
            )}
            {group === "archived" ? (
              <button
                type="button"
                onClick={() => setStatus("active")}
                disabled={busy}
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-50"
                style={SEC_BTN}
              >
                Reaktivieren
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatus("archived")}
                disabled={busy}
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-50"
                style={SEC_BTN}
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
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              <DeepFightWordmark />
            </h2>
            {!editingDna && (
              <button
                type="button"
                onClick={() => setEditingDna(true)}
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                Bearbeiten
              </button>
            )}
          </div>

          {addedDnaCount > 0 && (
            <p
              className="mb-3 rounded-field px-3 py-2"
              style={{
                font: "var(--type-sub)",
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

          {/* Ansicht und Editor liegen am selben Platz — MorphSwap laesst den
              einen in den anderen uebergehen und federt auf die neue Hoehe,
              statt die halbe Seite auszutauschen. */}
          <MorphSwap activeKey={editingDna ? "editor" : "ansicht"}>
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
          </MorphSwap>
        </div>

        {/* Trainingsplan (4 Phasen) */}
        <div className="mt-8">
          <h2
            className="mb-3"
            style={{
              font: "var(--type-h2)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            Trainingsplan
          </h2>
          <FightCampPlanView camp={camp} showOpponent={false} />
        </div>

        {/* Gefahrenzone */}
        {/* ── Löschen — Inline-Rückfrage statt Browser-Popup ──────────────
            Vorher stand hier `confirm()`. Das Fenster kommt vom BROWSER: Es
            trägt dessen Schrift, dessen Knöpfe und die Zeile „Auf
            localhost:3000 wird Folgendes angezeigt" — mitten in einer App,
            die sonst jede Fläche selbst gestaltet. Es lässt sich weder
            beschriften noch gestalten, und in einer Capacitor-WebView sieht
            es wieder anders aus.
            Der Knopf verwandelt sich stattdessen in die Rückfrage (MorphSwap
            misst die neue Breite und federt dorthin) — dasselbe Muster wie
            beim Trainer-Plan. Rot ist er schon im Ruhezustand: Was endgültig
            löscht, soll man vor dem Klick erkennen, nicht erst danach. */}
        <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <MorphSwap
            activeKey={confirmDelete ? "confirm" : "idle"}
            innerClassName="flex flex-wrap items-center gap-3"
          >
            {confirmDelete ? (
              <>
                <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Wettkampf wirklich löschen? Das Camp samt Plan und
                  Gegner-Snapshot ist danach weg.
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="t-danger-strong t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:opacity-50"
                  style={BTN_FONT}
                >
                  <Icon name="trash" size={13} strokeWidth={2.2} />
                  {deleting ? "Lösche…" : "Endgültig löschen"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-50"
                  style={{ ...BTN_FONT, color: "var(--text-3)" }}
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="t-danger t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                style={BTN_FONT}
              >
                <Icon name="trash" size={13} strokeWidth={2.2} />
                Wettkampf löschen
              </button>
            )}
          </MorphSwap>
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
