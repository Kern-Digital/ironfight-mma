"use client";

/**
 * DeepFight → Gegner → EIN Profil.
 *
 * DER TAB „VIDEOS" IST WEG (Teilschritt 4 des DeepFight-Neuaufbaus,
 * 08.09.2026). Er trug eine EIGENE `VideoAnalysisSection`, gleich neben der
 * auf `/trainer/deepfight` — zwei Ablagen für denselben Gegner, jede mit
 * eigenem Zwischenstand im localStorage. Wer hier ein Video hochlud und
 * drüben nachsah, fand nichts. Analysiert wird ab jetzt an EINER Stelle, der
 * Werkbank; diese Seite zeigt, was dabei herausgekommen ist, und führt mit
 * einem Knopf hinüber.
 *
 * ─── IM TOKEN-LOOK SEIT 18.09.2026 (Rest von Rollout-Etappe 3b) ─────────────
 *
 * Leon: „Gegnerseite in den neuen Look". Bis dahin trug die Seite als letzte
 * im Wettkampf- und DeepFight-Bereich das VORHERIGE Farbsystem: `--ink-*`,
 * `--fg-*`, `--ta-pink`, Mono- und Display-Schrift, ein festes Violett, und
 * einen handgebauten Kopfstreifen auf `top-16` — 64 px, die Höhe einer
 * Navbar, die es seit der Stab-Hülle nicht mehr gibt. Vier Entscheidungen:
 *
 * 1. **Der Kopf ist eine Glas-Karte, kein `PageHead`.** Im Bereich sitzt Text
 *    IMMER auf einer Karte (globals.css, „Der DeepFight-Bereich"); der
 *    PageHead setzte Titel und Zurück-Weg direkt auf die bewegte Schicht. Und
 *    ein Gegnername ist INHALT, keine Überschrift: `--type-display` OHNE
 *    Versalien, wie der Name auf der Wettkampfseite.
 * 2. **EINE Zahl, dieselbe wie überall** (Leon 17.09.2026): Profilstärke statt
 *    „DNA 6 %". Der Ring zählt weiter die gescouteten Kategorien — die Zeile
 *    darunter sagt es in Worten, statt „Score" unter den Ring zu schreiben.
 * 3. **Die Reiter sind die Reiter des Wettkampf-Sheets** (Knöpfe mit
 *    `aria-pressed`, der gewählte in der Akzentfarbe — im Gegner-Modus ist die
 *    grau). Sie kleben unter dem Kopf der Hülle; der Abstand ist eine
 *    Rechnung in globals.css (`.df-reiter`), keine Zahl in der Seite.
 * 4. **Jeder Block steht auf Glas.** Übersicht und Statistik bekommen je eine
 *    Karte, der Kategorien-Rost bringt seine Kacheln selbst mit (und in
 *    seinem Leerzustand eine eigene Karte — deshalb dort kein Rahmen, sonst
 *    Glas in Glas).
 *
 * ─── LEONS ZWEITE RUNDE, DIESELBE SITZUNG ────────────────────────────────────
 *
 * 5. **Der Weg zurück steht im Kopf der Hülle** („auf dieser Seite könnte der
 *    Zurück-‚Gegner'-Button oben drinnen liegen"): Ab `lg` ist das Segment
 *    „← Gegner" des Bereichs der Rückweg (app/trainer/deepfight/layout.tsx);
 *    in der Kopfkarte steht er nur noch auf dem Handy, wo es keinen Kopf gibt.
 * 6. **Bearbeiten speichert von selbst** („der Speichern- und Abbrechen-Button
 *    soll weg, da automatisch gespeichert werden soll"): 900 ms nach dem
 *    letzten Tastendruck, beim Verlassen („Fertig", andere Seite, Tab weg)
 *    sofort. Beim Bearbeiten stehen nur das Gegnerprofil und die
 *    DeepFight-Kategorien — keine Fight-DNA (OpponentEditor, Kopf).
 * 7. **„Profil löschen" steht beim Bearbeiten oben rechts** in der Kopfkarte,
 *    mit Rückfrage (Leon: „Nur beim Bearbeiten, oben rechts").
 * 8. **Die Freigabe hat eine Suche** und zeigt etwa zwanzig Athleten, der
 *    Rest scrollt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import GooeySearch from "@/components/ui/GooeySearch";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import { Collapse, MorphSwap } from "@/components/motion";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useHatKopf } from "@/components/shell/KopfNavigation";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  deleteOpponent,
  getOpponent,
  updateOpponent,
  updateOpponentSharing,
  type Opponent,
} from "@/lib/opponents";
import { listAllStudents, type StudentEntry } from "@/lib/admin";
import { DNA_CATEGORIES, answeredCount } from "@/lib/gegner-dna";
import { FIGHTER_STANCE_LABEL, FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { hasActionData, isDnaSplitEmpty } from "@/lib/fight-stats";
import {
  ansichtDesProfils,
  filtereTechnikStats,
  splitNachSteckbrief,
} from "@/lib/kampfart-steckbrief";
import { meldeScoutingAenderung } from "@/lib/gameplan";
import XKnopf from "@/components/ui/XKnopf";

type DetailTab = "uebersicht" | "dna" | "stats";

const DETAIL_TABS: [DetailTab, string][] = [
  ["uebersicht", "Übersicht"],
  ["dna", "Kampf-DNA"],
  ["stats", "Statistik"],
];

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** Knopf mit Rahmen — die Nebenwege im Kopf (Muster: „Bearbeiten"-Pille der Wettkampfseite). */
const NEBENKNOPF: React.CSSProperties = {
  ...BTN_FONT,
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-1)",
  textDecoration: "none",
};

/** So lange wartet das Speichern nach dem letzten Tastendruck. */
const SPEICHER_AUFSCHUB_MS = 900;
/**
 * So lange wartet die Meldung an den Gameplan nach dem letzten Speichern.
 * Der Server wartet danach ohnehin 90 s auf weitere Änderungen
 * (lib/server/gameplan.ts) — hier geht es nur darum, nicht bei JEDEM
 * Speichern eine Anfrage zu schicken, solange jemand tippt.
 */
const MELDUNG_AUFSCHUB_MS = 5000;

// ─── Auf einen Blick: Stärken / Schwächen / Waffen ───────────────────────────

/**
 * Dieselbe Semantik wie im Gegnerbericht, auf der Bibliothekskarte und im
 * Camp-Plan: `+` Stärke, `−` Schwäche, `★` Waffe. Die drei Farben des alten
 * Looks (Cyan, Pink, festes Violett) behaupteten eine Ordnung, die es nicht
 * gibt — das Zeichen trägt die Bedeutung, die Signalfarbe unterstreicht sie.
 */
function MarkerRow({
  icon,
  color,
  label,
  text,
}: {
  icon: IconName;
  color: string;
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden style={{ color, flexShrink: 0, marginTop: "3px", lineHeight: 0 }}>
        <Icon name={icon} size={13} strokeWidth={2.8} />
      </span>
      <span className="sr-only">{label}:</span>
      <span style={{ color: "var(--text-2)" }}>{text}</span>
    </div>
  );
}

function hatBlick(o: Opponent): boolean {
  return (
    (o.strengths?.length ?? 0) > 0 ||
    (o.weaknesses?.length ?? 0) > 0 ||
    (o.favoriteAttacks?.length ?? 0) > 0 ||
    !!o.notes
  );
}

function AufEinenBlick({ opponent }: { opponent: Opponent }) {
  const strengths = opponent.strengths ?? [];
  const weaknesses = opponent.weaknesses ?? [];
  const favorites = opponent.favoriteAttacks ?? [];
  if (!hatBlick(opponent)) return null;

  return (
    <section data-block="auf-einen-blick">
      <div className="mb-3">
        <div className="t-label">Auf einen Blick</div>
        <div style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Was dein Trainerteam eingetragen hat
        </div>
      </div>
      <div className="flex flex-col gap-1.5" style={{ font: "var(--type-sub)" }}>
        {strengths.length > 0 && (
          <MarkerRow icon="plus" color="var(--positive)" label="Stärken" text={strengths.join(", ")} />
        )}
        {weaknesses.length > 0 && (
          <MarkerRow icon="minus" color="var(--negative)" label="Schwächen" text={weaknesses.join(", ")} />
        )}
        {favorites.length > 0 && (
          <MarkerRow icon="star" color="var(--warning)" label="Waffen" text={favorites.join(", ")} />
        )}
        {opponent.notes && (
          <p className="mt-1 italic" style={{ color: "var(--text-3)" }}>
            &bdquo;{opponent.notes}&ldquo;
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Athleten-Freigabe: Profil nur lesend für ausgewählte Athleten ──────────

function studentLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

function SharePanel({
  opponent,
  onSaved,
  onClose,
}: {
  opponent: Opponent;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [draft, setDraft] = useState<Set<string>>(
    () => new Set(opponent.sharedWith),
  );
  const [suche, setSuche] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAllStudents(gymId)
      .then(setStudents)
      .catch(() => setError("Die Athletenliste kam nicht an. Lad die Seite neu."));
  }, [gymId]);

  // Leon 18.09.2026: „eine Suche, damit ich die Schüler direkt suchen kann".
  // Name und E-Mail, wie in der Athletenliste des Bereichs.
  const gezeigt = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!students || !q) return students;
    return students.filter(
      (s) =>
        studentLabel(s).toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }, [students, suche]);

  function toggle(uid: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateOpponentSharing(
        opponent.id,
        Array.from(draft),
        user?.uid ?? null,
      );
      await onSaved();
      onClose();
    } catch {
      setError("Die Freigabe ist nicht gespeichert. Versuch es noch mal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="t-card p-4 sm:p-5" data-block="freigabe" aria-label="Für Athleten freigeben">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="t-label">Für Athleten freigeben</div>
          <p className="mt-1 max-w-xl" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            Wen du hier anhakst, sieht dieses Gegnerprofil in seinem Kampfprofil
            — nur zum Lesen, etwa zur Vorbereitung auf den Kampf.
          </p>
        </div>
        <XKnopf
          onClick={onClose}
          ariaLabel="Freigabe schließen"
          wort="Schließen"
          drehung="roll"
          style={{ color: "var(--text-2)" }}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-field px-3 py-2"
          style={{
            font: "var(--type-sub)",
            background: "color-mix(in oklab, var(--negative) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--negative) 45%, transparent)",
            color: "var(--negative)",
          }}
        >
          {error}
        </p>
      )}

      {students !== null && students.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <GooeySearch
            value={suche}
            onChange={setSuche}
            label="Athlet suchen"
            placeholder="Athlet suchen…"
          />
          <span className="ml-auto" style={{ ...META_FONT, color: "var(--text-3)" }} data-freigabe-zahl>
            {draft.size} von {students.length} freigegeben
          </span>
        </div>
      )}

      {students === null ? (
        !error && <Skeleton className="mt-4 h-16 w-full rounded-field" />
      ) : students.length === 0 ? (
        <p className="mt-4" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          In deinem Gym gibt es noch keine Athleten.
        </p>
      ) : gezeigt && gezeigt.length === 0 ? (
        <p className="mt-4" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          Zu &bdquo;{suche.trim()}&ldquo; passt kein Athlet.
        </p>
      ) : (
        // Etwa zwanzig Namen sind zu sehen (zehn Reihen à zwei), der Rest
        // scrollt IN der Liste (Leon: „die Anzeige auf ca. 20 Schüler, der Rest
        // scrollbar"). Auf dem Handy deckelt die Fensterhöhe früher.
        <div
          className="mt-3 grid max-h-[min(33rem,60vh)] gap-2 overflow-y-auto overscroll-contain p-0.5 sm:grid-cols-2"
          data-freigabe-liste
        >
          {(gezeigt ?? []).map((s) => {
            const checked = draft.has(s.uid);
            return (
              <button
                key={s.uid}
                type="button"
                onClick={() => toggle(s.uid)}
                aria-pressed={checked}
                data-press
                className="t-interactive flex min-h-hit items-center gap-3 rounded-field px-3 text-left"
                style={{
                  font: "var(--type-sub)",
                  fontWeight: 600,
                  background: checked ? "var(--accent-subtle)" : "var(--surface-raised)",
                  border: `1px solid ${checked ? "color-mix(in oklab, var(--accent) 45%, transparent)" : "var(--line)"}`,
                  color: checked ? "var(--text-1)" : "var(--text-2)",
                  transition:
                    "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
                }}
              >
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
                  style={{
                    background: checked ? "var(--accent)" : "transparent",
                    border: checked ? "1px solid var(--accent)" : "1px solid var(--line-strong)",
                    color: "var(--on-accent)",
                  }}
                >
                  {checked && <Icon name="check" size={12} strokeWidth={2.8} />}
                </span>
                <span className="min-w-0 truncate">{studentLabel(s)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || students === null}
          data-press
          className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5 disabled:opacity-50"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          <Icon name="check" size={13} strokeWidth={2.4} />
          {busy ? "Speichert…" : "Freigabe speichern"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-50"
          style={{ ...BTN_FONT, color: "var(--text-3)" }}
        >
          Abbrechen
        </button>
      </div>
    </section>
  );
}

// ─── Automatisches Speichern ─────────────────────────────────────────────────

type SpeicherStand = "ruhig" | "wartet" | "speichert" | "gespeichert" | "fehler";

/**
 * Was beim Bearbeiten neben „Fertig" steht. EIN Satz je Zustand — der Trainer
 * soll nie raten müssen, ob seine Änderung schon im Profil steht.
 */
function SpeicherZeile({
  stand,
  ohneName,
  alterName,
  onNochmal,
}: {
  stand: SpeicherStand;
  ohneName: boolean;
  alterName: string;
  onNochmal: () => void;
}) {
  const text =
    stand === "fehler"
      ? "Nicht gespeichert — prüf die Verbindung."
      : stand === "speichert" || stand === "wartet"
        ? "Speichert…"
        : stand === "gespeichert"
          ? "Gespeichert"
          : "Jede Änderung ist sofort gespeichert.";
  return (
    <span
      role="status"
      aria-live="polite"
      data-speicherstand={stand}
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
      style={{
        font: "var(--type-sub)",
        color: stand === "fehler" ? "var(--negative)" : "var(--text-2)",
      }}
    >
      {stand === "gespeichert" && (
        <span aria-hidden style={{ color: "var(--positive)", lineHeight: 0 }}>
          <Icon name="check" size={15} strokeWidth={2.6} />
        </span>
      )}
      {text}
      {stand === "fehler" && (
        <button
          type="button"
          onClick={onNochmal}
          className="t-interactive rounded-field px-2 py-1"
          style={{ ...BTN_FONT, color: "var(--text-1)", border: "1px solid var(--line)" }}
        >
          Nochmal
        </button>
      )}
      {ohneName && (
        <span style={{ color: "var(--text-3)" }}>
          Ohne Namen bleibt der alte: &bdquo;{alterName}&ldquo;.
        </span>
      )}
    </span>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function OpponentDetailContent({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const hatKopf = useHatKopf();
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Rueckfrage vor dem Loeschen — inline statt Browser-Popup.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<DetailTab>("uebersicht");
  const [sharingOpen, setSharingOpen] = useState(false);
  // Wie viele Gameplans sich nach dem letzten Speichern neu schreiben.
  const [nachzug, setNachzug] = useState<number | null>(null);
  const [stand, setStand] = useState<SpeicherStand>("ruhig");
  const [ohneName, setOhneName] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setOpponent(null);
    try {
      const o = await getOpponent(id);
      if (!o) throw new Error("DeepFight-Profil nicht gefunden");
      setOpponent(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Stilles Neuladen ohne Skeleton — z. B. nach dem Speichern der Freigabe. */
  const reload = useCallback(async () => {
    try {
      const o = await getOpponent(id);
      if (o) setOpponent(o);
    } catch {
      /* Ansicht behält den letzten Stand */
    }
  }, [id]);

  // ── Automatisches Speichern (Leon 18.09.2026) ────────────────────────────
  //
  // Jede Änderung zählt `version` hoch; gespeichert ist, was `gespeichert`
  // erreicht hat. Es läuft höchstens EIN Schreibvorgang zugleich — wer
  // währenddessen tippt, bekommt danach einen zweiten mit dem neuesten Stand.
  // Alles in Refs: Die Zähler sollen nicht rendern, und die Aufräum-Effekte
  // unten brauchen beim Aushängen den letzten Stand, nicht den vom Einhängen.
  const entwurf = useRef<OpponentEditorValue | null>(null);
  const version = useRef(0);
  const gespeichert = useRef(0);
  const laeuft = useRef<Promise<boolean> | null>(null);
  const speicherTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meldungTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meldungOffen = useRef(false);
  const geloescht = useRef(false);
  const uid = user?.uid ?? null;

  /**
   * Gameplan folgt dem Scouting (Leon 17.09.2026: „Ja, mit Aufschub"): Der
   * Server wartet 90 s auf weitere Änderungen und schreibt dann die Gameplans
   * der anstehenden Wettkämpfe gegen diesen Gegner neu. Scheitert die
   * Meldung, bleibt das Speichern trotzdem gültig.
   */
  const meldenJetzt = useCallback(() => {
    if (meldungTimer.current) {
      clearTimeout(meldungTimer.current);
      meldungTimer.current = null;
    }
    if (!meldungOffen.current || geloescht.current) return;
    meldungOffen.current = false;
    void meldeScoutingAenderung(id)
      .then((n) => setNachzug(n > 0 ? n : null))
      .catch(() => {});
  }, [id]);

  /** Speichert den neuesten Entwurf — sofort. Liefert, ob alles gespeichert ist. */
  const speichernJetzt = useCallback(async (): Promise<boolean> => {
    if (speicherTimer.current) {
      clearTimeout(speicherTimer.current);
      speicherTimer.current = null;
    }
    while (laeuft.current) await laeuft.current;
    const v = version.current;
    const wert = entwurf.current;
    if (!wert || v === gespeichert.current || geloescht.current) return true;

    setStand("speichert");
    const lauf = (async () => {
      try {
        const felder = {
          style: wert.style,
          stance: wert.stance,
          heightCm: wert.heightCm,
          weightKg: wert.weightKg,
          reachCm: wert.reachCm,
          strengths: wert.strengths,
          weaknesses: wert.weaknesses,
          favoriteAttacks: wert.favoriteAttacks,
          notes: wert.notes,
          dna: wert.dna,
        };
        // Ein leeres Namensfeld heißt „tippt gerade", nicht „Unbekannter
        // Gegner": Der alte Name bleibt, alles andere speichert.
        await updateOpponent(id, {
          ...felder,
          ...(wert.name ? { name: wert.name } : {}),
          updatedBy: uid,
        });
        gespeichert.current = v;
        setOpponent((prev) =>
          prev ? { ...prev, ...felder, ...(wert.name ? { name: wert.name } : {}) } : prev,
        );
        meldungOffen.current = true;
        if (meldungTimer.current) clearTimeout(meldungTimer.current);
        meldungTimer.current = setTimeout(meldenJetzt, MELDUNG_AUFSCHUB_MS);
        setStand(version.current === v ? "gespeichert" : "wartet");
        return true;
      } catch {
        setStand("fehler");
        return false;
      }
    })();
    laeuft.current = lauf;
    const ok = await lauf;
    laeuft.current = null;
    // Während des Schreibens getippt? Dann gleich den nächsten Stand.
    if (ok && version.current !== gespeichert.current && !geloescht.current) {
      speicherTimer.current = setTimeout(() => void speichernJetzt(), SPEICHER_AUFSCHUB_MS);
    }
    return ok && version.current === gespeichert.current;
  }, [id, uid, meldenJetzt]);

  const aendern = useCallback(
    (wert: OpponentEditorValue) => {
      entwurf.current = wert;
      version.current += 1;
      setOhneName(!wert.name);
      setStand("wartet");
      if (speicherTimer.current) clearTimeout(speicherTimer.current);
      speicherTimer.current = setTimeout(() => void speichernJetzt(), SPEICHER_AUFSCHUB_MS);
    },
    [speichernJetzt],
  );

  // Wer die Seite verlässt oder den Tab wegschickt, verliert nichts: Der
  // offene Stand geht sofort raus, die Meldung an den Gameplan gleich mit.
  const abschluss = useRef<() => void>(() => {});
  abschluss.current = () => {
    if (version.current !== gespeichert.current) void speichernJetzt();
    meldenJetzt();
  };
  useEffect(() => {
    const weg = () => {
      if (document.visibilityState === "hidden") abschluss.current();
    };
    document.addEventListener("visibilitychange", weg);
    return () => {
      document.removeEventListener("visibilitychange", weg);
      abschluss.current();
    };
  }, []);

  function bearbeitenStarten() {
    setSharingOpen(false);
    setNachzug(null);
    entwurf.current = null;
    version.current = 0;
    gespeichert.current = 0;
    setOhneName(false);
    setStand("ruhig");
    setEditing(true);
  }

  async function fertig() {
    const ok = await speichernJetzt();
    if (!ok) return; // Fehler bleibt sichtbar, der Editor bleibt offen
    meldenJetzt();
    setConfirmDelete(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!opponent || deleting) return;
    setDeleting(true);
    // Nichts darf nach dem Löschen noch schreiben.
    geloescht.current = true;
    if (speicherTimer.current) clearTimeout(speicherTimer.current);
    if (meldungTimer.current) clearTimeout(meldungTimer.current);
    try {
      while (laeuft.current) await laeuft.current;
      await deleteOpponent(opponent.id);
      router.push("/trainer/deepfight/gegner");
    } catch (err) {
      geloescht.current = false;
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (error && !opponent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:max-w-5xl">
        <ErrorState
          title="Profil konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-4 sm:px-6 lg:max-w-5xl">
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const ansicht = ansichtDesProfils(opponent.evidence);
  const coveredCategories = DNA_CATEGORIES.filter(
    (c) => answeredCount(c, opponent.dna) > 0,
  ).length;
  const stammdaten = [
    FIGHT_STYLE_LABEL[opponent.style],
    FIGHTER_STANCE_LABEL[opponent.stance],
    opponent.heightCm ? `${opponent.heightCm} cm` : null,
    opponent.weightKg ? `${opponent.weightKg} kg` : null,
    opponent.reachCm ? `Reach ${opponent.reachCm} cm` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const gezaehlt = opponent.evidence?.countedAnalyses ?? 0;
  const standZeile = [
    `${coveredCategories} von ${DNA_CATEGORIES.length} Kategorien gescoutet`,
    gezaehlt > 0 ? `Profilstärke ${opponent.evidence?.staerke ?? 0} %` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Hat der Bericht überhaupt etwas zu zeigen? Dieselben Prüfungen wie in
  // OpponentProfileView — sonst stünde eine leere Glas-Karte da.
  const stats = ansicht.sport
    ? filtereTechnikStats(opponent.actionStats ?? [], ansicht.sport).stats
    : (opponent.actionStats ?? []);
  const split = ansicht.sport
    ? splitNachSteckbrief(opponent.dnaSplit, ansicht.sport)
    : (opponent.dnaSplit ?? null);
  const hatZahlen = (!!split && !isDnaSplitEmpty(split)) || stats.some(hasActionData);
  const hatStats = stats.some(hasActionData);

  const profilAnsicht = {
    name: opponent.name,
    style: opponent.style,
    stance: opponent.stance,
    heightCm: opponent.heightCm,
    weightKg: opponent.weightKg,
    reachCm: opponent.reachCm,
    strengths: opponent.strengths,
    weaknesses: opponent.weaknesses,
    favoriteAttacks: opponent.favoriteAttacks,
    notes: opponent.notes,
    dna: opponent.dna,
    dnaSplit: opponent.dnaSplit,
    actionStats: opponent.actionStats,
  };

  return (
    <main className="min-h-screen pb-12" style={{ color: "var(--text-body)" }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 sm:px-6 lg:max-w-5xl">
        {/* ── Kopf: Glas-Karte mit Weg zurück, Ring, Name und Wegen ── */}
        <section className="t-card flex flex-col gap-4 p-4 sm:p-5" data-block="kopf">
          {/* Obere Zeile: der Weg zurück (nur ohne Kopf der Hülle — ab lg
              steht „← Gegner" dort) und beim Bearbeiten „Profil löschen"
              ganz rechts. Ist beides nicht da, fällt die Zeile weg. */}
          <div
            className={`items-center justify-between gap-3 ${
              editing ? "flex" : hatKopf ? "flex lg:hidden" : "flex"
            }`}
          >
            <Link
              data-press
              href="/trainer/deepfight/gegner"
              aria-label="Zurück zur Gegner-Bibliothek"
              className={`t-interactive -ml-2 inline-flex w-fit items-center gap-1.5 rounded-field px-2 py-1 ${
                hatKopf ? "lg:hidden" : ""
              }`}
              style={{ ...META_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Gegner
            </Link>
            {editing && (
              <button
                type="button"
                onClick={() => setConfirmDelete((v) => !v)}
                aria-expanded={confirmDelete}
                data-aktion="profil-loeschen"
                className="t-danger t-interactive ml-auto inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                style={BTN_FONT}
              >
                <Icon name="trash" size={13} strokeWidth={2.2} />
                Profil löschen
              </button>
            )}
          </div>

          {/* Löschen — Inline-Rückfrage statt Browser-Popup (Leon 04.09.2026). */}
          <Collapse open={editing && confirmDelete}>
            <div
              role="alertdialog"
              aria-label="Profil löschen"
              className="flex flex-wrap items-center gap-3 rounded-field px-3 py-3"
              style={{
                background: "color-mix(in oklab, var(--negative) 10%, transparent)",
                border: "1px solid color-mix(in oklab, var(--negative) 40%, transparent)",
              }}
            >
              <span className="min-w-0 flex-1" style={{ font: "var(--type-sub)", color: "var(--text-body)" }}>
                &bdquo;{opponent.name}&ldquo; wirklich löschen? Angelegte
                Wettkämpfe behalten ihren gespeicherten Stand.
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
                style={{ ...BTN_FONT, color: "var(--text-2)" }}
              >
                Abbrechen
              </button>
            </div>
          </Collapse>

          {/* Der Ring steht ab sm LINKS vom Namen (wie auf der Bibliothekskarte).
              Auf dem Handy bekäme der Name daneben nur ~250 px und bräche
              dreizeilig um — dort steht der Name über die volle Breite, und
              ein kleiner Ring wandert in die Standzeile. Zwei Instanzen, weil
              der Ring seine Größe als Zahl bekommt; die verborgene fällt per
              `display: none` auch aus dem Barrierefreiheitsbaum. */}
          <div className="flex items-center gap-4">
            <div className="hidden shrink-0 sm:block">
              <DnaCompletenessRing
                covered={coveredCategories}
                total={DNA_CATEGORIES.length}
                size={72}
                stroke={5}
              />
            </div>
            <div className="min-w-0 flex-1">
              {/* KEINE VERSALIEN: Ein Gegnername ist Inhalt — dieselbe Regel
                  wie auf der Bibliothekskarte und der Wettkampfseite. */}
              <h1 style={{ font: "var(--type-display)", overflowWrap: "anywhere" }}>
                {opponent.name}
              </h1>
              <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                {stammdaten}
              </p>
              <div className="mt-2 flex items-center gap-2.5 sm:mt-0.5">
                <div className="shrink-0 sm:hidden">
                  <DnaCompletenessRing
                    covered={coveredCategories}
                    total={DNA_CATEGORIES.length}
                    size={40}
                    stroke={3.5}
                  />
                </div>
                <p style={{ ...META_FONT, color: "var(--text-3)" }} data-stand>
                  {standZeile}
                </p>
              </div>
            </div>
          </div>

          {editing ? (
            // Beim Bearbeiten gibt es keinen Speichern-Knopf — nur den Weg
            // hinaus und die Auskunft, was schon gespeichert ist.
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void fertig()}
                data-press
                data-aktion="bearbeiten-fertig"
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                <Icon name="check" size={13} strokeWidth={2.4} />
                Fertig
              </button>
              <SpeicherZeile
                stand={stand}
                ohneName={ohneName}
                alterName={opponent.name}
                onNochmal={() => void speichernJetzt()}
              />
            </div>
          ) : (
            // Handy: Raster mit zwei Spalten — der Hauptweg und „Wettkampf
            // anlegen" über die volle Breite, die zwei kurzen nebeneinander.
            // Ab sm eine Reihe.
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
              {/* Der Weg in die Werkbank — sie ist seit Teilschritt 4 die
                  eine Stelle, an der analysiert wird (siehe Kopf der Datei). */}
              <Link
                href={`/trainer/deepfight/analyse?modus=gegner&ziel=${opponent.id}`}
                data-press
                className="t-interactive col-span-2 inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                  textDecoration: "none",
                }}
              >
                <Icon name="spark" size={13} strokeWidth={2.4} />
                Video analysieren
              </Link>
              <button
                type="button"
                onClick={bearbeitenStarten}
                data-press
                data-aktion="bearbeiten"
                className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-4"
                style={NEBENKNOPF}
              >
                <Icon name="edit" size={14} strokeWidth={2.2} />
                Bearbeiten
              </button>
              <Link
                href={`/trainer/competitions/new?opponent=${opponent.id}`}
                data-press
                // Handy: ans Ende, über die volle Breite (Raster oben).
                className="t-interactive order-last col-span-2 inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-4 sm:order-none"
                style={NEBENKNOPF}
              >
                <Icon name="plus" size={14} strokeWidth={2.2} />
                Wettkampf anlegen
              </Link>
              <button
                type="button"
                onClick={() => setSharingOpen((v) => !v)}
                aria-expanded={sharingOpen}
                data-press
                data-aktion="freigabe"
                className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-4"
                style={{
                  ...NEBENKNOPF,
                  // Offen = der Zustand trägt die Farbe, wie bei den Reitern.
                  ...(sharingOpen
                    ? {
                        background: "var(--accent-subtle)",
                        border: "1px solid color-mix(in oklab, var(--accent) 45%, transparent)",
                      }
                    : {}),
                }}
              >
                <Icon name="users" size={14} strokeWidth={2.2} />
                Freigabe
                {opponent.sharedWith.length > 0 && (
                  <span
                    className="ml-0.5 inline-flex min-w-[20px] items-center justify-center rounded-pill px-1.5 py-0.5"
                    style={{
                      font: "var(--type-meta)",
                      fontVariantNumeric: "tabular-nums",
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                    }}
                    aria-label={`${opponent.sharedWith.length} freigegeben`}
                  >
                    {opponent.sharedWith.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </section>

        {error && <ErrorState title="Fehler" message={error} onRetry={load} />}

        {nachzug !== null && (
          <p
            role="status"
            data-gameplan-nachzug={nachzug}
            className="t-card flex items-center gap-2 px-4 py-3"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            <span aria-hidden style={{ color: "var(--accent-text)", lineHeight: 0 }}>
              <Icon name="target" size={15} strokeWidth={2.2} />
            </span>
            {nachzug === 1
              ? `Gespeichert. Claude schreibt den Gameplan für den anstehenden Wettkampf gegen ${opponent.name} in 90 Sekunden neu.`
              : `Gespeichert. Claude schreibt die Gameplans für ${nachzug} anstehende Wettkämpfe gegen ${opponent.name} in 90 Sekunden neu.`}
          </p>
        )}

        <Collapse open={sharingOpen && !editing} ueberstehen>
          <SharePanel
            opponent={opponent}
            onSaved={reload}
            onClose={() => setSharingOpen(false)}
          />
        </Collapse>

        {/* ── Reiter: kleben unter dem Kopf der Hülle (.df-reiter) ── */}
        {!editing && (
          <div
            role="group"
            aria-label="Ansicht wählen"
            className="df-reiter t-card flex gap-1.5 rounded-card p-1.5"
          >
            {DETAIL_TABS.map(([tabId, label]) => {
              const an = tab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
                  aria-pressed={an}
                  data-press
                  data-reiter={tabId}
                  className="t-interactive inline-flex min-h-hit flex-1 items-center justify-center rounded-field px-2"
                  style={{
                    ...BTN_FONT,
                    background: an ? "var(--accent)" : "transparent",
                    color: an ? "var(--on-accent)" : "var(--text-2)",
                    border: `1px solid ${an ? "var(--accent)" : "transparent"}`,
                    transition:
                      "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Editor und die drei Reiter teilen sich denselben Platz. Der
            activeKey trägt deshalb BEIDES — den Editor-Zustand und den Reiter:
            So verwandelt sich auch ein reiner Reiterwechsel, statt die halbe
            Seite hart auszutauschen. */}
        <MorphSwap activeKey={editing ? "editor" : tab}>
          {editing ? (
            // `OpponentEditor` ist ein blankes <form> ohne Fläche (Etappe 3a) —
            // hier bekommt es seine Glas-Karte, wie in der Bibliothek. Ohne
            // `onSubmit` trägt es keine Knöpfe: Jede Änderung geht an
            // `aendern` und speichert von selbst.
            <section className="t-card p-4 sm:p-5" data-block="editor">
              <OpponentEditor initial={profilAnsicht} onChange={aendern} />
            </section>
          ) : tab === "dna" ? (
            // Die Kacheln sind selbst Flächen, der Leerzustand eine eigene
            // Karte — ein Rahmen außen herum wäre Glas in Glas.
            <OpponentProfileView section="dna" showBasics={false} {...ansicht} opponent={profilAnsicht} />
          ) : tab === "stats" ? (
            <section className="t-card p-4 sm:p-5" data-block="statistik">
              {hatStats ? (
                <OpponentProfileView section="stats" showBasics={false} {...ansicht} opponent={profilAnsicht} />
              ) : (
                <Leer
                  titel="Noch keine Technik gezählt."
                  text="Die Zahlen kommen aus den KI-Video-Analysen. Analysier ein Video, dann zählt DeepFight Versuche, Treffer und Zonen."
                />
              )}
            </section>
          ) : (
            <section className="t-card flex flex-col gap-6 p-4 sm:p-5" data-block="uebersicht">
              <AufEinenBlick opponent={opponent} />
              {hatZahlen && (
                <OpponentProfileView section="overview" showBasics={false} {...ansicht} opponent={profilAnsicht} />
              )}
              {!hatBlick(opponent) && !hatZahlen && (
                <Leer
                  titel="Noch nichts gescoutet."
                  text="Analysier ein Video oder trag über „Bearbeiten“ Stärken, Schwächen und Waffen ein."
                />
              )}
            </section>
          )}
        </MorphSwap>
      </div>
    </main>
  );
}

function Leer({ titel, text }: { titel: string; text: string }) {
  return (
    <div className="py-6 text-center">
      <p style={{ font: "var(--type-body-strong)" }}>{titel}</p>
      <p className="mx-auto mt-1 max-w-md" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
        {text}
      </p>
    </div>
  );
}

export default function OpponentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <OpponentDetailContent id={params.id} />;
}
