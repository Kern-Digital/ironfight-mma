"use client";

/**
 * DEN KAMPF VERSCHIEBEN (Leon 17.09.2026: „Stufe 2: Kampf verschoben" — im
 * Amateurbereich der häufigste Fall).
 *
 * Ein Datumsfeld, die Vorschau der vier Phasen und — sobald ein Gameplan
 * steht — der Schalter „Gameplan gleich neu schreiben" (Leons Freitext: „nein,
 * aber eine Option einfügen, dass man direkt einen neuen erstellen lassen
 * kann"). Ohne den Schalter kostet eine Verschiebung nichts: Das Kampfdatum
 * steht nicht mehr im Auftrag an Claude (lib/server/gameplan-prompt.ts).
 *
 * DIE VORSCHAU IST DER KERN, nicht das Feld: Leon hat „wie beim Anlegen neu
 * verteilen" gewählt, und dabei kann die LAUFENDE Phase wechseln — ein Kampf,
 * der zwei Wochen nach hinten rückt, schickt den Athleten aus dem Schwerpunkt
 * zurück in den Aufbau. Wer das erst nach dem Speichern sieht, erschrickt.
 * Deshalb rechnet der Editor dieselbe Zeitachse wie der Server
 * (`phasenZeitachse`) und zeigt sie vor dem Speichern.
 */

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  PHASE_LABEL,
  fightCampProgress,
  fruehestesKampfdatum,
  kampfdatumText,
  phasenZeitachse,
  planWochen,
  pruefeKampfdatum,
  spaetestesKampfdatum,
  type FightCamp,
} from "@/lib/fight-camp";

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

const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

/**
 * Ein Datum als Wert für `<input type="date">`. ÖRTLICHE Felder, nicht UTC:
 * Die Seite zeigt das Kampfdatum mit `toLocaleDateString`, und beide sollen
 * denselben Tag nennen. Gespeichert wird danach wieder `new Date("2026-11-11")`
 * — UTC-Mitternacht, genau wie beim Anlegen des Wettkampfs.
 */
export function datumFeldWert(d: Date): string {
  const zwei = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

const kurz = (d: Date) => d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });

/** „4 Wochen" oder, bei kurzen Phasen, „5 Tage". */
function dauerText(startsAt: Date, endsAt: Date): string {
  const tage = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 86_400_000));
  if (tage < 7) return `${tage} ${tage === 1 ? "Tag" : "Tage"}`;
  const wochen = Math.round(tage / 7);
  return `${wochen} ${wochen === 1 ? "Woche" : "Wochen"}`;
}

export default function KampfVerschieben({
  camp,
  gameplanDa,
  onSpeichern,
  onAbbrechen,
}: {
  camp: FightCamp;
  /** Es gibt einen fertigen Gameplan — nur dann lohnt der Schalter. */
  gameplanDa: boolean;
  /** Speichert und stößt bei `neuSchreiben` den Gameplan an. Wirft bei Fehlern. */
  onSpeichern: (neuesDatum: Date, neuSchreiben: boolean) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [wert, setWert] = useState(() => datumFeldWert(camp.competitionDate));
  const [neuSchreiben, setNeuSchreiben] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const grenzen = useMemo(
    () => ({ frueh: fruehestesKampfdatum(camp.startedAt), spaet: spaetestesKampfdatum() }),
    [camp.startedAt],
  );

  const roh = wert ? new Date(wert) : null;
  const neu = roh && !Number.isNaN(roh.getTime()) ? roh : null;
  const gleich = !!neu && neu.getTime() === camp.competitionDate.getTime();
  const grenzFehler = neu ? pruefeKampfdatum(camp, neu) : "Wähl ein Kampfdatum.";
  // Der Termin, der schon steht, ist kein Fehler — nur nichts zu speichern.
  const meldung = fehler ?? (gleich ? null : grenzFehler);
  // Die Vorschau rechnet auch dann, wenn das Datum noch am Anschlag liegt —
  // sie verschwindet nur, wenn gar kein Datum steht.
  const vorschau = useMemo(() => {
    if (!neu) return null;
    const achse = phasenZeitachse(camp.startedAt, neu);
    const jetzt = Date.now();
    const alt = new Map(camp.phases.map((p) => [p.phase, p]));
    const laufendAlt = fightCampProgress(camp).currentPhase;
    const laufendNeu =
      achse.find((z) => z.startsAt.getTime() <= jetzt && z.endsAt.getTime() > jetzt)?.phase ?? null;
    return {
      wochen: planWochen(camp.startedAt, neu),
      zeilen: achse.map((z) => ({
        ...z,
        vorher: alt.get(z.phase) ?? null,
      })),
      laufendAlt,
      laufendNeu,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neu?.getTime(), camp]);

  async function speichern() {
    if (speichert || !neu) return;
    if (grenzFehler) {
      setFehler(grenzFehler);
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern(neu, neuSchreiben && gameplanDa);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Kampf konnte nicht verschoben werden.");
      setSpeichert(false);
    }
  }

  const phasenWechsel =
    vorschau && vorschau.laufendNeu !== vorschau.laufendAlt
      ? { von: vorschau.laufendAlt, auf: vorschau.laufendNeu }
      : null;

  return (
    <form
      className="t-card mt-3 flex max-w-xl flex-col gap-4 p-4 sm:p-5"
      data-verschieben-editor
      aria-label="Kampf verschieben"
      onSubmit={(e) => {
        e.preventDefault();
        void speichern();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onAbbrechen();
        }
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="t-label">Neues Kampfdatum</span>
        <input
          type="date"
          value={wert}
          min={datumFeldWert(grenzen.frueh)}
          max={datumFeldWert(grenzen.spaet)}
          data-feld="kampfdatum"
          onChange={(e) => {
            setWert(e.target.value);
            setFehler(null);
          }}
          className="min-h-hit w-full rounded-field px-3 sm:w-56"
          style={FELD}
        />
        <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Bisher: {kampfdatumText(camp.competitionDate)}
        </span>
      </label>

      {vorschau && (
        <div className="flex flex-col gap-2" data-verschieben-vorschau>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="t-label">So läuft der Plan danach</span>
            <span style={{ ...META_FONT, color: "var(--text-3)" }}>
              {vorschau.wochen} {vorschau.wochen === 1 ? "Woche" : "Wochen"} ab{" "}
              {kurz(camp.startedAt)}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {vorschau.zeilen.map((z) => {
              const laeuft = z.phase === vorschau.laufendNeu;
              const neueDauer = dauerText(z.startsAt, z.endsAt);
              const alteDauer = z.vorher ? dauerText(z.vorher.startsAt, z.vorher.endsAt) : null;
              return (
                <li
                  key={z.phase}
                  data-vorschau-phase={z.phase}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-field px-3 py-2"
                  style={{
                    background: laeuft ? "var(--accent-subtle)" : "var(--surface-raised)",
                    border: `1px solid ${laeuft ? "color-mix(in oklab, var(--accent) 40%, transparent)" : "var(--line)"}`,
                  }}
                >
                  <span
                    className="min-w-0 flex-1"
                    style={{
                      font: "var(--type-body-strong)",
                      color: laeuft ? "var(--accent-text)" : "var(--text-body)",
                    }}
                  >
                    {PHASE_LABEL[z.phase]}
                  </span>
                  <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    {alteDauer && alteDauer !== neueDauer ? `${alteDauer} → ${neueDauer}` : neueDauer}
                  </span>
                  <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                    {kurz(z.startsAt)} – {kurz(z.endsAt)}
                  </span>
                </li>
              );
            })}
          </ul>
          {phasenWechsel && (
            <p data-vorschau-wechsel style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              Heute steht dein Athlet damit in{" "}
              {phasenWechsel.auf ? (
                <strong style={{ color: "var(--text-body)" }}>{PHASE_LABEL[phasenWechsel.auf]}</strong>
              ) : (
                "keiner Phase mehr"
              )}
              {phasenWechsel.von ? ` statt in ${PHASE_LABEL[phasenWechsel.von]}` : ""}.
            </p>
          )}
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Fokus, Einheiten, Sparring-Anteil und Notizen bleiben in ihren Phasen stehen. Dein
            Athlet sieht den neuen Termin sofort.
          </p>
        </div>
      )}

      {gameplanDa && (
        <div className="flex flex-col gap-1.5">
          {/* Kein `<input>` im Knopf — dasselbe Muster wie die Bereichs-Chips
              im Freigabe-Sheet: Das Kästchen zeigt an, der ganze Chip klickt. */}
          <button
            type="button"
            role="switch"
            aria-checked={neuSchreiben}
            disabled={speichert}
            onClick={() => setNeuSchreiben((v) => !v)}
            data-press
            data-aktion="gameplan-neu"
            className="t-interactive flex min-h-hit items-center gap-2 rounded-field px-3 text-left"
            style={{
              font: "var(--type-sub)",
              background: neuSchreiben ? "var(--accent-subtle)" : "var(--surface-raised)",
              border: `1px solid ${neuSchreiben ? "color-mix(in oklab, var(--accent) 45%, transparent)" : "var(--line)"}`,
              color: neuSchreiben ? "var(--accent-text)" : "var(--text-2)",
            }}
          >
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-badge"
              style={{
                background: neuSchreiben ? "var(--accent)" : "transparent",
                border: "1.5px solid",
                borderColor: neuSchreiben ? "var(--accent)" : "var(--line-strong)",
                color: "var(--on-accent)",
              }}
            >
              {neuSchreiben && <Icon name="check" size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">Gameplan gleich neu schreiben</span>
          </button>
          <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {neuSchreiben
              ? "Claude schreibt den Gameplan nach dem Speichern neu — das dauert ein bis zwei Minuten."
              : "Der Gameplan bleibt stehen: Er baut allein auf den beiden DeepFight-Profilen auf."}
          </span>
        </div>
      )}

      {meldung && (
        <p role="alert" style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
          {meldung}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={speichert || !!grenzFehler}
          data-press
          data-aktion="verschieben-speichern"
          className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          <Icon name="check" size={14} strokeWidth={2.4} />
          {speichert ? "Verschiebt…" : "Kampf verschieben"}
        </button>
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={speichert}
          data-press
          className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-60"
          style={{
            ...BTN_FONT,
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            color: "var(--text-body)",
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
