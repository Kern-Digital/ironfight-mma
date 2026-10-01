"use client";

/**
 * /gym-finden — der Weg in ein Gym (Leon 30.09.2026).
 *
 * ETAPPE 1 (Grundgerüst): Kopf, Einladungscode, Gym anmelden. Die Liste
 * aller Gyms, die Tidal Athletics nutzen, mit Suche nach PLZ/Ort,
 * Standort-Freigabe, Radius und Karte kommt in Etappe 3 (CLAUDE.md
 * „KONTEN OHNE GYM"). Die Seite gehört zu den drei Seiten, die ein Konto
 * ohne Gym sehen darf (OhneGymGate); Mitglieder dürfen sie ebenfalls öffnen.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Icon from "@/components/ui/Icon";
import { useHasStaffShell } from "@/lib/auth-context";
import Link from "next/link";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function GymFindenContent() {
  const hasStaffShell = useHasStaffShell();
  return (
    <div
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8 lg:max-w-5xl lg:px-6 lg:pt-12">
        <header className="flex flex-col gap-1">
          <span className="t-label">Gym finden</span>
          <h1 style={{ font: "var(--type-h1)", color: "var(--text-1)" }}>
            Dein Gym auf Tidal Athletics
          </h1>
          <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
            Mit dem Einladungscode deines Gyms bist du in einer Minute drin.
          </p>
        </header>

        <div className="t-card flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
              style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}
            >
              <Icon name="hash" size={18} strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span style={{ font: "var(--type-body-strong)" }}>Einladungscode</span>
              <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Den Code bekommst du von deinem Gym.
              </span>
            </span>
          </div>
          <Link
            data-press
            href="/beitreten"
            className="t-interactive inline-flex min-h-hit items-center gap-2 self-start rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            Code eingeben
          </Link>
        </div>

        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Du führst selbst ein Gym?{" "}
          <Link href="/gym-anmelden" style={{ color: "var(--accent-text)" }}>
            Gym anmelden
          </Link>
        </p>
      </div>
      {!hasStaffShell && <AthleteTabBar />}
    </div>
  );
}

export default function GymFindenPage() {
  return (
    <ProtectedRoute>
      <GymFindenContent />
    </ProtectedRoute>
  );
}
