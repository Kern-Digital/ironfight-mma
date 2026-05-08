"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";

function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Diese E-Mail ist bereits registriert. Bitte melde dich an.";
    case "auth/invalid-email":
      return "Ungültige E-Mail-Adresse.";
    case "auth/weak-password":
      return "Passwort zu schwach — mindestens 6 Zeichen.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google-Anmeldung wurde abgebrochen.";
    case "auth/popup-blocked":
      return "Popup wurde blockiert. Bitte nutze E-Mail und Passwort.";
    case "auth/network-request-failed":
      return "Netzwerkfehler. Bitte Internetverbindung prüfen.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte kurz warten.";
    default:
      return "Registrierung fehlgeschlagen. Bitte erneut versuchen.";
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function RegisterPage() {
  const { signUp, signInWithGoogle, user, redirectError } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRedirectPending, setGoogleRedirectPending] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (redirectError) setError(redirectError);
  }, [redirectError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || googleLoading) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, name.trim() || undefined);
      router.push("/dashboard");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(authErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (submitting || googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result === null) {
        // Redirect-Fallback: Browser navigiert weg, kein weiterer Code nötig
        setGoogleRedirectPending(true);
        return;
      }
      // Popup-Erfolg: onAuthStateChanged aktualisiert user → useEffect übernimmt Redirect.
      // Kein router.push hier, da user noch null sein kann (Race Condition).
      // googleLoading bleibt true bis die Seite wegnavigiert.
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(authErrorMessage(code));
      setGoogleLoading(false);
    }
  }

  if (googleRedirectPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-4 text-2xl">🔄</div>
          <p className="font-mono-ta text-sm uppercase" style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}>
            Weiterleitung zu Google…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl font-display-ta text-2xl font-black"
            style={{
              background: "linear-gradient(135deg, var(--ta-cyan), var(--ta-cyan-deep))",
              color: "#001417",
              boxShadow:
                "0 0 40px rgba(0,212,230,.25), 0 0 80px rgba(255,45,120,.1)",
            }}
          >
            TA
          </div>
          <div>
            <h1
              className="font-display-ta text-center font-black uppercase leading-none"
              style={{ fontSize: "32px", letterSpacing: "0.04em" }}
            >
              Tidal Athletics
            </h1>
            <div
              className="font-mono-ta mt-1.5 text-center text-[10px] uppercase"
              style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
            >
              Konto erstellen
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
            border: "1px solid var(--ink-4)",
          }}
        >
          {/* Google SSO */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || submitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all disabled:opacity-50"
            style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ink-5)",
              color: "var(--fg-2)",
            }}
          >
            {googleLoading ? (
              <>
                <div
                  className="h-4 w-4 animate-spin rounded-full border-2"
                  style={{ borderColor: "var(--fg-4)", borderTopColor: "var(--ta-cyan)" }}
                />
                Verbinde…
              </>
            ) : (
              <>
                <GoogleIcon />
                Mit Google registrieren
              </>
            )}
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "var(--ink-5)" }} />
            <span
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
            >
              oder
            </span>
            <div className="h-px flex-1" style={{ background: "var(--ink-5)" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="font-mono-ta mb-1.5 block text-[10px] uppercase"
                style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
              >
                Name (optional)
              </label>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                placeholder="z. B. Iron Mike"
                className="input-field disabled:opacity-50"
              />
            </div>
            <div>
              <label
                className="font-mono-ta mb-1.5 block text-[10px] uppercase"
                style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
              >
                E-Mail
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="name@beispiel.de"
                className="input-field disabled:opacity-50"
              />
            </div>
            <div>
              <label
                className="font-mono-ta mb-1.5 block text-[10px] uppercase"
                style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
              >
                Passwort
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="mind. 6 Zeichen"
                className="input-field disabled:opacity-50"
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  border: "1px solid rgba(255,45,120,.4)",
                  background: "rgba(255,45,120,.08)",
                  color: "var(--ta-pink)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2"
                    style={{ borderColor: "rgba(0,20,23,.3)", borderTopColor: "#001417" }}
                  />
                  Erstelle Account…
                </span>
              ) : (
                "Account erstellen"
              )}
            </button>
          </form>

          {/* Footer link */}
          <p
            className="font-mono-ta mt-5 text-center text-xs"
            style={{ color: "var(--fg-3)" }}
          >
            Schon registriert?{" "}
            <Link
              href="/login"
              className="font-bold transition-colors"
              style={{ color: "var(--ta-cyan)" }}
            >
              Zum Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
