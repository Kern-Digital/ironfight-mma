"use client";

/**
 * EINE ANFRAGE „PROBETRAINING VEREINBAREN" — was die Verwaltung auf der
 * Mitglieder-Seite öffnet (Etappe 4 der Gym-Suche, 01.10.2026).
 *
 * Zwei Griffe: „E-Mail schreiben" öffnet das EIGENE Postfach der Verwaltung
 * (`mailto:` — die App verschickt keine Mail), „Erledigt" löscht die Anfrage.
 * Löschen braucht einen zweiten Tipp: Name, Adresse und Nachricht sind danach
 * weg.
 */

import { SheetShell, useLetzterWert } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { useAuth } from "@/lib/auth-context";
import { ANFRAGE_TAGE, anfrageTag, erledigeAnfrage, type GymAnfrage } from "@/lib/gym-anfrage";
import { useEffect, useState } from "react";

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

function Inhalt({
  anfrage,
  gymName,
  onChanged,
  onClose,
}: {
  anfrage: GymAnfrage;
  gymName: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [sicher, setSicher] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function erledigt() {
    if (!user || laeuft) return;
    if (!sicher) {
      setSicher(true);
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      await erledigeAnfrage(user, anfrage.uid);
      onChanged();
      onClose();
    } catch (err) {
      setLaeuft(false);
      setSicher(false);
      setFehler(err instanceof Error ? err.message : "Das ließ sich gerade nicht speichern.");
    }
  }

  const betreff = encodeURIComponent(`Dein Probetraining${gymName ? ` bei ${gymName}` : ""}`);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-col items-start">
          <div
            aria-hidden
            className="mb-2 h-1 w-10 rounded-full sm:invisible"
            style={{ background: "var(--line-strong)" }}
          />
          <span className="t-sheet-title">Anfrage</span>
          <span className="max-w-full truncate" style={{ ...META_FONT, color: "var(--text-3)" }}>
            Probetraining · {anfrageTag(anfrage.erstelltAm)}
          </span>
        </div>
        <XKnopf
          onClick={onClose}
          ariaLabel="Schließen"
          wort="Schließen"
          drehung="roll"
          style={{ color: "var(--text-2)" }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
        <div className="flex flex-col gap-4 pb-3">
          <div className="flex flex-col gap-0.5">
            <span style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>{anfrage.name}</span>
            <span className="break-all" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {anfrage.email}
            </span>
          </div>

          <p
            data-anfrage-nachricht
            className="whitespace-pre-wrap rounded-field px-4 py-3"
            style={{
              font: "var(--type-body)",
              color: anfrage.nachricht ? "var(--text-body)" : "var(--text-3)",
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              overflowWrap: "anywhere",
            }}
          >
            {anfrage.nachricht || "Ohne Nachricht."}
          </p>

          <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            Antworte per E-Mail und schick danach deine Einladung mit. Erledigt löscht die Anfrage sofort,
            sonst löschen wir sie {ANFRAGE_TAGE} Tage nach dem Eingang.
          </p>

          {fehler && (
            <p role="alert" style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
              {fehler}
            </p>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-wrap gap-3 px-5 pb-5 pt-3"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <a
          href={`mailto:${anfrage.email}?subject=${betreff}`}
          data-press
          data-anfrage-mail
          className="t-interactive inline-flex min-h-hit flex-1 items-center justify-center gap-2 rounded-field px-5"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <Icon name="brief" size={14} strokeWidth={2.2} />
          E-Mail schreiben
        </a>
        <button
          type="button"
          data-press
          data-anfrage-erledigt
          onClick={() => void erledigt()}
          disabled={laeuft}
          className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
          style={{
            ...BTN_FONT,
            background: "var(--surface-raised)",
            border: `1px solid ${sicher ? "var(--line-strong)" : "var(--line)"}`,
            color: "var(--text-1)",
            whiteSpace: "nowrap",
          }}
        >
          <Icon name="check" size={13} strokeWidth={2.4} />
          {laeuft ? "Löscht …" : sicher ? "Ja, löschen" : "Erledigt"}
        </button>
      </div>
    </>
  );
}

export default function AnfrageDetailSheet({
  anfrage,
  gymName,
  onChanged,
  onClose,
}: {
  /** null heißt geschlossen. */
  anfrage: GymAnfrage | null;
  gymName: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const zeigen = useLetzterWert(anfrage);
  return (
    <SheetShell
      open={anfrage !== null}
      onClose={onClose}
      label={zeigen ? `Anfrage von ${zeigen.name}` : "Anfrage"}
      panelClassName="pointer-events-auto relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "80dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {zeigen && (
        <Inhalt key={zeigen.uid} anfrage={zeigen} gymName={gymName} onChanged={onChanged} onClose={onClose} />
      )}
    </SheetShell>
  );
}
