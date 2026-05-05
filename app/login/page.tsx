"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FirebaseError } from "firebase/app";

function authErrorMessage(code: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Ungültige E-Mail-Adresse.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-Mail oder Passwort falsch.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte später erneut probieren.";
    case "auth/popup-closed-by-user":
      return "Google-Anmeldung wurde abgebrochen.";
    default:
      return "Login fehlgeschlagen. Bitte erneut versuchen.";
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

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(authErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(authErrorMessage(code));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Account" title="Login" />
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card space-y-5">

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || submitting}
            className="flex w-full items-center justify-center gap-3 rounded-sm border border-carbon-400 bg-carbon-800 px-4 py-2.5 text-sm font-bold transition-all hover:border-foreground/50 hover:bg-carbon-700 active:scale-95 disabled:opacity-50"
          >
            <GoogleIcon />
            {googleLoading ? "Verbinde mit Google…" : "Mit Google anmelden"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-carbon-500" />
            <span className="text-xs uppercase tracking-widest text-foreground/40">oder</span>
            <div className="h-px flex-1 bg-carbon-500" />
          </div>

          {/* E-Mail Form */}
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
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-foreground/70">
                Passwort
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-sm border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? "Logge ein…" : "Login"}
            </button>
          </form>

          <div className="space-y-2 text-center text-sm text-foreground/60">
            <div>
              <Link
                href="/forgot-password"
                className="text-xs uppercase tracking-widest text-foreground/50 hover:text-blood"
              >
                Passwort vergessen?
              </Link>
            </div>
            <p>
              Noch kein Account?{" "}
              <Link href="/register" className="font-bold text-blood hover:underline">
                Registrieren
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
