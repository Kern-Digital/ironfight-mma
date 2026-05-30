"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

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
          Schön, dass du dabei bist. In der App kannst du den Wochenplan
          deiner Schule sehen, Kurse mit Inhalten füllen und den Fortschritt
          deiner Schüler einsehen.
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
          <strong>Stundenplan ansehen:</strong> alle Kurse der Woche auf einen
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
          <strong>Schülerprofile:</strong> sieh dir Fortschritt, abonnierte
          Kurse und Aktivität deiner Schüler an.
        </li>
      </ul>
    ),
  },
  {
    eyebrow: "Wie deine Schüler profitieren",
    title: "Inhalte landen automatisch in der Bibliothek",
    body: (
      <>
        <p>
          Sobald du einem Kurs Techniken hinzufügst, erscheinen diese in der
          persönlichen Bibliothek aller Schüler, die diesen Kurs abonniert
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
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!user || profileLoading || !profile) return null;

  const isTrainer = profile.role === "trainer" || profile.role === "admin";
  if (!isTrainer) return null;

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
      style={{ background: "var(--modal-backdrop)" }}
    >
      <div
        className="w-full max-w-md animate-fade-in space-y-5 rounded-2xl p-6"
        style={{
          background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
          border: "1px solid var(--ink-5)",
          boxShadow: "var(--modal-shadow)",
        }}
      >
        {/* Eyebrow + Step-Indicator */}
        <div className="flex items-center justify-between">
          <div
            className="font-mono-ta text-xs font-bold uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
          >
            {current.eyebrow}
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-6 rounded-full transition-colors"
                style={{
                  background:
                    i === step
                      ? "var(--ta-cyan)"
                      : i < step
                        ? "rgba(0,212,230,0.4)"
                        : "var(--ink-5)",
                }}
              />
            ))}
          </div>
        </div>

        <h2
          className="font-display-ta text-2xl font-black uppercase leading-tight sm:text-3xl"
          style={{ color: "var(--fg)", letterSpacing: "0.04em" }}
        >
          {current.title}
        </h2>

        <div className="text-sm leading-relaxed" style={{ color: "var(--fg-2)" }}>
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

        <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--ink-5)" }}>
          <Link
            href="/help"
            onClick={handleFinish}
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--fg-3)" }}
          >
            Hilfe-Bereich öffnen →
          </Link>
          <button
            onClick={handleFinish}
            disabled={busy}
            className="text-xs uppercase tracking-widest disabled:opacity-50"
            style={{ color: "var(--fg-4)" }}
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
