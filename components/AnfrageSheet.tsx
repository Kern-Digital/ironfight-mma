"use client";

/**
 * „PROBETRAINING VEREINBAREN" — das Formular auf /gym-finden (Etappe 4 der
 * Gym-Suche, 01.10.2026). Modell und Begründung: lib/gym-anfrage.ts.
 *
 * Drei Angaben gehen ans Gym: Name (vorbelegt aus dem Profil, änderbar),
 * E-Mail-Adresse (die des Kontos, NICHT änderbar — der Server nimmt sie aus
 * dem Konto, nicht aus dem Formular) und eine Nachricht. Unter dem Formular
 * steht, wer das sieht und wann es gelöscht wird — vor dem Senden, nicht
 * danach.
 */

import { SheetShell, useLetzterWert } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import WachsendesFeld from "@/components/ui/WachsendesFeld";
import XKnopf from "@/components/ui/XKnopf";
import { useAuth } from "@/lib/auth-context";
import {
  ANFRAGE_NACHRICHT_MAX,
  ANFRAGE_NAME_MAX,
  ANFRAGE_NAME_MIN,
  ANFRAGE_TAGE,
  sendeAnfrage,
  type MeineAnfrage,
} from "@/lib/gym-anfrage";
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

const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

export interface AnfrageZiel {
  gymId: string;
  gymName: string;
}

function Inhalt({
  ziel,
  onGesendet,
  onClose,
}: {
  ziel: AnfrageZiel;
  onGesendet: (a: MeineAnfrage) => void;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const [name, setName] = useState(
    () => profile?.displayName?.trim() || profile?.authProviderName?.trim() || "",
  );
  const [nachricht, setNachricht] = useState("");
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

  const nameOk = name.trim().length >= ANFRAGE_NAME_MIN;

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    if (!user || laeuft) return;
    if (!nameOk) {
      setFehler("Trag deinen Namen ein, damit das Gym weiß, wer anfragt.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      onGesendet(await sendeAnfrage(user, { gymId: ziel.gymId, name, nachricht }));
      onClose();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Deine Anfrage ging gerade nicht raus.");
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={senden} className="flex min-h-0 flex-1 flex-col" data-anfrage-formular>
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-col items-start">
          <div
            aria-hidden
            className="mb-2 h-1 w-10 rounded-full sm:invisible"
            style={{ background: "var(--line-strong)" }}
          />
          <span className="t-sheet-title">Probetraining vereinbaren</span>
          <span className="max-w-full truncate" style={{ ...META_FONT, color: "var(--text-3)" }}>
            {ziel.gymName}
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
          <label className="flex flex-col gap-1.5">
            <span className="t-label">Dein Name</span>
            <input
              type="text"
              value={name}
              maxLength={ANFRAGE_NAME_MAX}
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                setFehler(null);
              }}
              className="min-h-hit rounded-field px-3"
              style={FELD}
              data-anfrage-feld="name"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="t-label">Deine E-Mail</span>
            <span
              data-anfrage-feld="email"
              className="flex min-h-hit items-center rounded-field px-3"
              style={{ ...FELD, background: "transparent", color: "var(--text-2)" }}
            >
              <span className="truncate">{user?.email ?? ""}</span>
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="t-label">Nachricht</span>
              <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {nachricht.length} / {ANFRAGE_NACHRICHT_MAX}
              </span>
            </span>
            <WachsendesFeld
              value={nachricht}
              minZeilen={4}
              maxLength={ANFRAGE_NACHRICHT_MAX}
              onChange={(e) => {
                setNachricht(e.target.value);
                setFehler(null);
              }}
              placeholder="z. B. welche Kampfart du trainieren willst und wann du Zeit hast"
              className="rounded-field px-3 py-2.5"
              style={{ ...FELD, resize: "none" }}
              data-anfrage-feld="nachricht"
            />
          </label>

          <p data-anfrage-hinweis style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            Das Gym sieht deinen Namen, deine E-Mail-Adresse und deine Nachricht. Es meldet sich per E-Mail
            bei dir. Nach {ANFRAGE_TAGE} Tagen löschen wir die Anfrage.
          </p>

          {fehler && (
            <p role="alert" style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
              {fehler}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-3 px-5 pb-5 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <button
          type="submit"
          data-press
          data-anfrage-senden
          disabled={laeuft}
          className="t-interactive inline-flex min-h-hit flex-1 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-60"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          <Icon name="brief" size={14} strokeWidth={2.2} />
          {laeuft ? "Sendet …" : "Anfrage senden"}
        </button>
      </div>
    </form>
  );
}

export default function AnfrageSheet({
  ziel,
  onGesendet,
  onClose,
}: {
  /** null heißt geschlossen. */
  ziel: AnfrageZiel | null;
  onGesendet: (a: MeineAnfrage) => void;
  onClose: () => void;
}) {
  const zeigen = useLetzterWert(ziel);
  return (
    <SheetShell
      open={ziel !== null}
      onClose={onClose}
      label={zeigen ? `Probetraining vereinbaren bei ${zeigen.gymName}` : "Probetraining vereinbaren"}
      panelClassName="pointer-events-auto relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "88dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {zeigen && <Inhalt key={zeigen.gymId} ziel={zeigen} onGesendet={onGesendet} onClose={onClose} />}
    </SheetShell>
  );
}
