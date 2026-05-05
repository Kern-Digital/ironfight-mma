"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Modal nach erstem Login: Frage nach FighterName.
 *
 * Verhalten:
 *  • Wird genau einmal nach dem allerersten erfolgreichen Login angezeigt
 *    (gesteuert durch profile.onboarded === false).
 *  • User kann einen Namen eintragen ODER überspringen → in beiden Fällen
 *    wird das Profil als onboarded markiert.
 *  • Wenn übersprungen wird, bleibt displayName null und die App nutzt
 *    weiter den Default "Fighter".
 *  • Auch Skip- und Save-Aktion zählt als User-Geste — kein iOS-Audio-Issue.
 */
export default function FighterNameModal() {
  const { user, profile, profileLoading, updateDisplayName, finishOnboarding } =
    useAuth();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Nicht zeigen während noch geladen wird oder kein User da ist
  if (!user || profileLoading) return null;
  if (!profile) return null;
  // Wenn schon onboarded oder displayName gesetzt → nicht mehr zeigen
  if (profile.onboarded || profile.displayName) return null;

  async function handleSave() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await updateDisplayName(name.trim());
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSubmitting(true);
    try {
      await finishOnboarding();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-fade-in space-y-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-blood">
            Willkommen im Cage
          </div>
          <h2 className="heading-display mt-2 text-3xl font-black">
            Wie sollen wir dich nennen?
          </h2>
          <p className="mt-3 text-sm text-foreground/70">
            Wähle deinen Fighter-Namen für die App. Du kannst das jederzeit in
            den Einstellungen ändern. Wenn du diesen Schritt überspringst,
            heißt du erstmal einfach <strong>Fighter</strong>.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-foreground/70">
            Fighter-Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={30}
            placeholder="z. B. IronWolf, Coach, Leon …"
            className="w-full rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none"
          />
          <p className="mt-1 text-[10px] uppercase tracking-widest text-foreground/40">
            Maximal 30 Zeichen — kein Zwang zur Eindeutigkeit.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            Überspringen
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || !name.trim()}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {submitting ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
