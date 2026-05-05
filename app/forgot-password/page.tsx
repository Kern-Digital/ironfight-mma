"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { FirebaseError } from "firebase/app";
import Link from "next/link";
import { useState } from "react";

function authErrorMessage(code: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Ungültige E-Mail-Adresse.";
    case "auth/user-not-found":
      // Aus Sicherheitsgründen nicht unterscheiden — user soll nicht raten können
      return "Wenn diese E-Mail registriert ist, ist eine Reset-Mail unterwegs.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte später erneut probieren.";
    default:
      return "E-Mail konnte nicht gesendet werden.";
  }
}

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(authErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Passwort vergessen"
        description="Wir schicken dir einen Reset-Link an deine E-Mail."
      />
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card space-y-5">
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-sm border border-green-500/40 bg-green-500/10 px-3 py-3 text-sm text-green-300">
                ✓ Wenn diese E-Mail registriert ist, ist eine Reset-Mail
                unterwegs. Schau auch im Spam-Ordner nach.
              </div>
              <Link href="/login" className="btn-primary w-full">
                Zurück zum Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-foreground/70">
                  E-Mail
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none"
                  placeholder="fighter@ironfight.app"
                />
              </div>

              {error && (
                <div className="rounded-sm border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full disabled:opacity-50"
              >
                {submitting ? "Sende E-Mail…" : "Reset-Link senden"}
              </button>

              <p className="text-center text-sm text-foreground/60">
                <Link href="/login" className="font-bold text-blood hover:underline">
                  ← Zurück zum Login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
