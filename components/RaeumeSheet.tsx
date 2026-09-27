"use client";

/**
 * RÄUME DES GYMS — Anlegen, Umbenennen, Löschen (Leon 27.09.2026: „bedenke
 * das es gyms gibt die verschiedene räume haben"; gepflegt im Wochenplan).
 *
 * Geschrieben wird über `/api/gym/kurse` (`raum-anlegen` / `raum-umbenennen`
 * / `raum-loeschen`). Die Liste kommt live aus useKursplan — nach dem
 * Speichern steht sie von selbst neu da.
 *
 * Ab ZWEI Räumen steht der Raum an jedem Kurs (Wochenplan und Kursplan der
 * Athleten). Ein Gym mit einem Raum braucht die Angabe nicht.
 */

import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { SheetShell } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import { RAUMNAME_MAX, type Raum } from "@/lib/kursplan";
import { useKursplan } from "@/lib/kursplan-context";
import { useEffect, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

function RaumZeile({
  raum,
  kursZahl,
  senden,
  laeuft,
}: {
  raum: Raum;
  kursZahl: number;
  senden: (body: Record<string, unknown>) => Promise<boolean>;
  laeuft: boolean;
}) {
  const [name, setName] = useState(raum.name);
  const [fragen, setFragen] = useState(false);
  useEffect(() => setName(raum.name), [raum.name]);
  const geaendert = name.trim() !== raum.name;

  return (
    <li className="flex flex-col gap-2 py-3" style={{ borderTop: "1px solid var(--line)" }} data-raum={raum.id}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={RAUMNAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Name von ${raum.name}`}
          className="min-h-hit min-w-0 flex-1 rounded-field px-3"
          style={FELD}
        />
        {geaendert ? (
          <button
            type="button"
            data-press
            disabled={laeuft}
            onClick={() => void senden({ aktion: "raum-umbenennen", raumId: raum.id, name })}
            className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-1.5 rounded-field px-3 disabled:opacity-50"
            style={{ ...BTN_FONT, background: "var(--accent)", color: "var(--on-accent)" }}
          >
            <Icon name="check" size={13} strokeWidth={2.6} />
            Sichern
          </button>
        ) : (
          <button
            type="button"
            data-press
            disabled={laeuft}
            onClick={async () => {
              if (!fragen) {
                setFragen(true);
                return;
              }
              const ok = await senden({ aktion: "raum-loeschen", raumId: raum.id });
              if (!ok) setFragen(false);
            }}
            aria-label={fragen ? `${raum.name} wirklich löschen` : `${raum.name} löschen`}
            className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-1.5 rounded-field px-3 disabled:opacity-50"
            style={{
              ...BTN_FONT,
              border: "1px solid",
              borderColor: fragen ? "var(--negative)" : "var(--line)",
              background: fragen ? "var(--negative)" : "transparent",
              color: fragen ? "var(--on-accent)" : "var(--negative)",
            }}
          >
            <Icon name="trash" size={13} strokeWidth={2.2} />
            {fragen ? "Wirklich" : ""}
          </button>
        )}
      </div>
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {fragen
          ? kursZahl > 0
            ? `${kursZahl === 1 ? "Der Kurs" : `Die ${kursZahl} Kurse`} in diesem Raum ${kursZahl === 1 ? "bleibt" : "bleiben"}, nur ohne Raum.`
            : "Hier findet noch kein Kurs statt."
          : kursZahl === 0
            ? "Noch kein Kurs"
            : `${kursZahl} ${kursZahl === 1 ? "Kurs" : "Kurse"}`}
      </p>
    </li>
  );
}

export default function RaeumeSheet({ offen, onClose }: { offen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { raeume, kurse } = useKursplan();
  const [neuName, setNeuName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!offen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen, onClose]);

  async function senden(body: Record<string, unknown>): Promise<boolean> {
    if (!user) return false;
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await fetch("/api/gym/kurse", {
        method: "POST",
        headers: { authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const daten = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFehler(daten.error ?? "Das ließ sich gerade nicht speichern.");
        return false;
      }
      return true;
    } catch {
      setFehler("Keine Verbindung. Versuch es gleich noch einmal.");
      return false;
    } finally {
      setLaeuft(false);
    }
  }

  async function anlegen() {
    if (laeuft) return;
    if (await senden({ aktion: "raum-anlegen", name: neuName })) setNeuName("");
  }

  return (
    <SheetShell
      open={offen}
      onClose={onClose}
      label="Räume"
      panelClassName="pointer-events-auto relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "80dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-col items-start">
          <div aria-hidden className="mb-2 h-1 w-10 rounded-full sm:invisible" style={{ background: "var(--line-strong)" }} />
          <span className="t-sheet-title">Räume</span>
        </div>
        <XKnopf onClick={onClose} ariaLabel="Schließen" wort="Schließen" drehung="roll" style={{ color: "var(--text-2)" }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3">
        <p className="pb-3" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Leg an, wo trainiert wird. Ab zwei Räumen steht der Raum an jedem Kurs, im Wochenplan und im Kursplan
          deiner Athleten.
        </p>
        {raeume.length > 0 && (
          <ul className="flex flex-col">
            {raeume.map((r) => (
              <RaumZeile
                key={r.id}
                raum={r}
                kursZahl={kurse.filter((k) => k.raumId === r.id).length}
                senden={senden}
                laeuft={laeuft}
              />
            ))}
          </ul>
        )}
        <form
          className="flex items-center gap-2 py-3"
          style={{ borderTop: raeume.length > 0 ? "1px solid var(--line)" : undefined }}
          onSubmit={(e) => {
            e.preventDefault();
            void anlegen();
          }}
        >
          <input
            type="text"
            value={neuName}
            maxLength={RAUMNAME_MAX}
            onChange={(e) => {
              setNeuName(e.target.value);
              setFehler(null);
            }}
            placeholder="z. B. Mattenraum"
            aria-label="Name des neuen Raums"
            className="min-h-hit min-w-0 flex-1 rounded-field px-3"
            style={FELD}
            data-raum-neu
          />
          <button
            type="submit"
            data-press
            disabled={laeuft || !neuName.trim()}
            className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-1.5 rounded-field px-4 disabled:opacity-50"
            style={{ ...BTN_FONT, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--accent-glow)" }}
            data-raum-anlegen
          >
            <Icon name="plus" size={13} strokeWidth={2.4} />
            Raum anlegen
          </button>
        </form>
      </div>

      <div
        className="border-t px-5 pt-3"
        style={{ borderColor: "var(--line)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <p
          role={fehler ? "alert" : undefined}
          style={{ font: "var(--type-sub)", color: fehler ? "var(--negative)" : "var(--text-3)", minHeight: "1.4em" }}
        >
          {fehler ?? (raeume.length === 1 ? "Ein Raum allein steht nicht am Kurs. Ab dem zweiten schon." : "")}
        </p>
      </div>
    </SheetShell>
  );
}
