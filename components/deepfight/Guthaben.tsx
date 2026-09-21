"use client";

/**
 * DIE ZAHL VOR DEM KLICK — Schritt 2 des Geschäftsplans (21.09.2026).
 *
 * Konzept §6: „Der Trainer sieht die Zahl VOR dem Klick." Niemand soll ein
 * Video hochladen, die Kämpfer zuordnen und erst am Startknopf erfahren, dass
 * nichts mehr übrig ist.
 *
 * Der Vorlauf steht hier BEWUSST NICHT (Leon 21.09.: „das muss nicht extra
 * irgendwo stehen, es soll im Hintergrund passieren") — die Tagesbremse für
 * Vorläufe läuft still im Server.
 *
 * Die Farbe trägt das Signal nie allein: Bei leerem Guthaben steht der Satz
 * da, nicht nur ein roter Punkt (--warning als Schrift fällt im Hellen unter
 * AA, gemessen 14.09.).
 */

import Icon from "@/components/ui/Icon";
import { getGuthabenStand, type GuthabenStand } from "@/lib/guthaben";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/** Lädt den Stand und gibt einen Weg mit, ihn nach einem Lauf neu zu holen. */
export function useGuthaben(gymId: string) {
  const [stand, setStand] = useState<GuthabenStand | null>(null);
  const laden = useCallback(() => {
    let lebt = true;
    getGuthabenStand(gymId)
      .then((s) => {
        if (lebt) setStand(s);
      })
      .catch(() => {
        // Lesefehler: lieber gar nichts zeigen als eine falsche Zahl. Der
        // Server entscheidet ohnehin, ob eine Analyse startet.
        if (lebt) setStand(null);
      });
    return () => {
      lebt = false;
    };
  }, [gymId]);

  useEffect(() => laden(), [laden]);
  return { stand, laden };
}

/**
 * Der Einstieg auf der DeepFight-Landung (Schritt 3, 21.09.2026): EINE ruhige
 * Zeile über den zwei Feldern — der Stand und der Weg zur Abo-Seite. Kein
 * Knopf: Die Landung gehört dem Strang und dem Archiv (Leons Entwurf 12.09.).
 */
export function GuthabenEinstieg({ gymId }: { gymId: string }) {
  const { stand } = useGuthaben(gymId);
  if (!stand) return null;
  return (
    <Link
      href="/trainer/deepfight/abo"
      data-press
      data-guthaben-einstieg={stand.rest}
      className="t-interactive -mx-2 mb-3 flex min-h-hit items-center justify-between gap-3 rounded-field px-2"
      style={{ font: "var(--type-sub)", color: "var(--text-2)", textDecoration: "none" }}
    >
      <span>
        Noch <strong style={{ color: "var(--text-1)", fontWeight: 600 }}>{stand.rest}</strong>{" "}
        {stand.rest === 1 ? "Analyse" : "Analysen"}
      </span>
      <span
        className="inline-flex items-center gap-1.5"
        style={{ font: "var(--type-meta)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--text-1)" }}
      >
        {stand.rest > 0 ? "DeepFight-Abo" : "Analysen holen"}
        <Icon name="arrow-right" size={13} strokeWidth={2.2} />
      </span>
    </Link>
  );
}

export function GuthabenZeile({ stand }: { stand: GuthabenStand | null }) {
  if (!stand) return null;

  if (stand.rest > 0) {
    return (
      <span
        data-guthaben={stand.rest}
        style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
      >
        Noch {stand.rest} von {stand.gesamt} {stand.gesamt === 1 ? "Analyse" : "Analysen"}
        {stand.naechsterVerfall && (
          <>
            {" · "}
            {stand.naechsterVerfall.menge} davon bis{" "}
            {stand.naechsterVerfall.am.toLocaleDateString("de-DE", {
              month: "long",
              year: "numeric",
            })}
          </>
        )}
      </span>
    );
  }

  return (
    <div
      data-guthaben="0"
      role="status"
      className="rounded-field px-4 py-3"
      style={{
        font: "var(--type-sub)",
        color: "var(--text)",
        border: "1px solid color-mix(in oklab, var(--warning) 45%, transparent)",
        background: "color-mix(in oklab, var(--warning) 12%, transparent)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          <strong style={{ fontWeight: 600 }}>Eure Analysen sind aufgebraucht.</strong>{" "}
          Holt euch neue, dann geht es sofort weiter.
        </span>
        {/* Seit Schritt 3 (21.09.2026) führt der Knopf auf die Abo-Seite —
            dort bucht die Verwaltung, alle anderen sehen, wer das kann. */}
        <Link
          href="/trainer/deepfight/abo"
          data-press
          data-guthaben-kaufen
          className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
          style={{
            font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          <Icon name="spark" size={13} strokeWidth={2.4} />
          Analysen holen
        </Link>
      </div>
    </div>
  );
}
