"use client";

/**
 * Der Umschalter je Kampfart oben in der Fight-DNA (Etappe 3, Leon 16./17.09.2026).
 *
 * „Fight-DNA · MMA · Sambo": Der erste Eintrag heißt NICHT „Gesamt", sondern
 * Fight-DNA (Leon: „schreibe nicht Gesamt sondern Fight-DNA und daneben dann,
 * wenn er mehr als einen hat, beide Arten dazu"). Er zeigt die Zusammenstellung
 * aller Kampfart-Profile (`fightProfile/main`, lib/profile-evidence.ts
 * `stelleZusammen`), die anderen Einträge je ein `fightProfile/{sport}`.
 *
 * WER NUR EINE KAMPFART HAT, SIEHT KEINEN UMSCHALTER — dann IST die Fight-DNA
 * dieses eine Profil. Welche Kampfarten es gibt, steht am Gesamtprofil
 * (`evidence.kampfarten`, vom Server gerechnet): ein Lesevorgang, keine
 * Sammlungs-Abfrage.
 *
 * Die Regeln decken `users/{uid}/fightProfile/{docId}` für den Inhaber und für
 * Trainer mit DeepFight-Freigabe ab — der Umschalter braucht keine eigene Regel.
 */

import { getFightProfile, type FightProfile } from "@/lib/fight-profile";
import type { Flaeche } from "@/lib/kampfart-steckbrief";
import { SPORT_KURZ, type Sport } from "@/lib/video-analysis";
import { useEffect, useMemo, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Was die Seite zum Anzeigen braucht — das gewählte Profil und seine Wörter. */
export interface KampfartAnsicht {
  /** Kampfarten mit Profil, in Anzeige-Reihenfolge (leer = keine Rechnung). */
  kampfarten: Sport[];
  /** null = die Fight-DNA über alle Kampfarten. */
  sport: Sport | null;
  setSport: (s: Sport | null) => void;
  /** Das angezeigte Profil — die Fight-DNA oder das der gewählten Kampfart. */
  profil: FightProfile | null;
  /** Kampfart für Wörter und Fragen der Karte: die gewählte, oder die einzige. */
  sportFuerKarte: Sport | null;
  flaeche: Flaeche | null;
  /** Profilstärke 0–100 des angezeigten Profils (Leon: EINE Zahl überall). */
  staerke: number;
  laedt: boolean;
}

/**
 * Hält die Wahl und lädt das Profil der gewählten Kampfart nach. `main` lädt
 * die Seite selbst (sie braucht es ohnehin für Leerzustand und Wachstum).
 */
export function useKampfartAnsicht(uid: string | null | undefined, main: FightProfile | null): KampfartAnsicht {
  const [sport, setSport] = useState<Sport | null>(null);
  const [geladen, setGeladen] = useState<Partial<Record<Sport, FightProfile>>>({});
  const kampfarten = useMemo(() => main?.evidence?.kampfarten ?? [], [main]);

  // Nach jeder Neuberechnung (neues `main`) sind auch die Kampfart-Profile neu.
  useEffect(() => {
    setGeladen({});
  }, [main]);

  // Eine Wahl, die es nicht mehr gibt (Analyse markiert), fällt auf die Fight-DNA zurück.
  useEffect(() => {
    if (sport && main && !kampfarten.includes(sport)) setSport(null);
  }, [sport, main, kampfarten]);

  useEffect(() => {
    if (!uid || !sport || geladen[sport]) return;
    let lebt = true;
    getFightProfile(uid, sport)
      .then((p) => {
        if (lebt) setGeladen((g) => ({ ...g, [sport]: p }));
      })
      .catch(() => {
        if (lebt) setSport(null);
      });
    return () => {
      lebt = false;
    };
  }, [uid, sport, geladen]);

  const profil = sport ? (geladen[sport] ?? null) : main;
  const anzeige = profil ?? main;
  return {
    kampfarten,
    sport,
    setSport,
    profil: anzeige,
    sportFuerKarte: sport ?? (kampfarten.length === 1 ? kampfarten[0] : null),
    flaeche: anzeige?.evidence?.flaeche ?? null,
    staerke: anzeige?.evidence?.staerke ?? 0,
    laedt: !!sport && !geladen[sport],
  };
}

/** Die Leiste selbst — erscheint erst ab zwei Kampfarten. */
export default function KampfartUmschalter({ ansicht }: { ansicht: KampfartAnsicht }) {
  const { kampfarten, sport, setSport } = ansicht;
  if (kampfarten.length < 2) return null;
  const eintraege: { wert: Sport | null; label: string }[] = [
    { wert: null, label: "Fight-DNA" },
    ...kampfarten.map((s) => ({ wert: s, label: SPORT_KURZ[s] })),
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Kampfart wählen">
      {eintraege.map(({ wert, label }) => {
        const aktiv = sport === wert;
        return (
          <button
            key={wert ?? "fight-dna"}
            type="button"
            onClick={() => setSport(wert)}
            aria-pressed={aktiv}
            data-press
            className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
            style={{
              ...BTN_FONT,
              background: aktiv ? "var(--accent)" : "var(--surface-card)",
              color: aktiv ? "var(--on-accent)" : "var(--text-2)",
              border: `1px solid ${aktiv ? "var(--accent)" : "var(--line)"}`,
              transition:
                "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
