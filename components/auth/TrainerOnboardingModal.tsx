"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, useRights } from "@/lib/auth-context";
import Icon from "@/components/ui/Icon";

/**
 * Erst-Login-Onboarding speziell für Trainer.
 *
 * Verhalten:
 *  • Wird genau einmal pro Trainer-Account angezeigt.
 *  • Steuerung über `profile.trainerOnboarded` (Firestore).
 *  • Wird erst angezeigt, wenn der allgemeine FighterName-Onboarding-Flow
 *    abgeschlossen ist (`profile.onboarded === true`), damit nicht beide
 *    Modals übereinander erscheinen.
 *  • Mehr-Schritt-Hinweis: kurz erklärt, was Trainer in der App tun.
 */

const STEPS = [
  {
    eyebrow: "Willkommen, Coach",
    title: "Du bist als Trainer eingeloggt",
    body: (
      <>
        <p>
          Schön, dass du dabei bist. In der App kannst du den Kursplan
          deiner Schule sehen, Kurse mit Inhalten füllen und den Fortschritt
          deiner Athleten einsehen.
        </p>
        <p className="mt-3">
          Diese Einführung dauert nur 30 Sekunden — danach kannst du direkt
          loslegen.
        </p>
      </>
    ),
  },
  {
    eyebrow: "Deine Hauptaufgaben",
    title: "Was du als Trainer tust",
    body: (
      <ul className="space-y-2">
        <li>
          <strong>Kursplan ansehen:</strong> alle Kurse der Woche auf einen
          Blick.
        </li>
        <li>
          <strong>Kurse öffnen:</strong> Details zu jedem Trainingsblock — wer,
          wann, welcher Inhalt.
        </li>
        <li>
          <strong>Techniken zuweisen:</strong> wähle aus der Bibliothek aus,
          was diese Woche behandelt wird.
        </li>
        <li>
          <strong>Athletenprofile:</strong> sieh dir Fortschritt, abonnierte
          Kurse und Aktivität deiner Athleten an.
        </li>
      </ul>
    ),
  },
  {
    eyebrow: "Was deine Athleten davon haben",
    title: "Inhalte landen automatisch in der Bibliothek",
    body: (
      <>
        <p>
          Sobald du einem Kurs Techniken hinzufügst, erscheinen diese in der
          persönlichen Bibliothek aller Athleten, die diesen Kurs abonniert
          haben — ganz ohne Extra-Klick.
        </p>
        <p className="mt-3">
          Tipp: Im Menüpunkt <strong>Hilfe</strong> findest du jederzeit eine
          Kurzanleitung zu allen Trainer-Funktionen.
        </p>
      </>
    ),
  },
];

export default function TrainerOnboardingModal() {
  const { user, profile, profileLoading, finishTrainerOnboarding } = useAuth();
  // VOR den frühen Returns: Hooks müssen bei jedem Render in derselben
  // Reihenfolge laufen.
  const rights = useRights();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!user || profileLoading || !profile) return null;
  if (!rights.trainer) return null;

  // Erst zeigen, wenn der Fighter-Name-Flow erledigt ist
  if (!profile.onboarded) return null;
  if (profile.trainerOnboarded) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  async function handleFinish() {
    setBusy(true);
    try {
      await finishTrainerOnboarding();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-sm"
      style={{ background: "var(--overlay)" }}
    >
      {/* Der Grund war ein VERLAUF (`--ink-3` nach `--ink-2`) — als
          Flächenfüllung schließt DESIGN-BRIEF §3 das aus. Jetzt der
          Karten-Flächenton, der in beiden Themes stimmt. */}
      <div
        className="w-full max-w-md animate-fade-in space-y-5 rounded-modal p-6"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--line)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        {/* Eyebrow + Step-Indicator */}
        <div className="flex items-center justify-between">
          <div className="t-label">{current.eyebrow}</div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-6 rounded-full transition-colors"
                style={{
                  background:
                    i === step
                      ? "var(--accent)"
                      : i < step
                        ? "color-mix(in oklab, var(--accent) 45%, transparent)"
                        : "var(--line)",
                }}
              />
            ))}
          </div>
        </div>

        <h2
          className="text-2xl uppercase leading-tight sm:text-3xl"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 800,
            letterSpacing: "var(--ls-display)",
            color: "var(--text-1)",
          }}
        >
          {current.title}
        </h2>

        <div className="leading-relaxed" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          {current.body}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Zurück
            </button>
          )}
          {!isLast && (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={busy}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              Weiter
            </button>
          )}
          {isLast && (
            <button
              onClick={handleFinish}
              disabled={busy}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {busy ? "Speichere…" : "Los geht's"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <Link
            href="/help"
            onClick={handleFinish}
            data-press
            className="inline-flex items-center gap-1.5"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            Hilfe-Bereich öffnen
            <Icon name="arrow-right" size={12} strokeWidth={2.2} />
          </Link>
          <button
            onClick={handleFinish}
            disabled={busy}
            className="disabled:opacity-50"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
