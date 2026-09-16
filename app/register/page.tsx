"use client";

import GoogleMark from "@/components/GoogleMark";
import Icon from "@/components/ui/Icon";
import JoinLayout, { JOIN_BTN_FONT, JoinPrimary } from "@/components/JoinLayout";

import { useAuth } from "@/lib/auth-context";
import { inviteQueryFor, useAfterAuthTarget } from "@/lib/use-invite-param";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

function RegisterForm() {
  const { signUp, signInWithGoogle, user, redirectError } = useAuth();
  const router = useRouter();
  // Kam der Besucher über eine Einladung (?invite=), führt der Weg nach der
  // Anmeldung zurück auf /beitreten/{code} statt aufs Dashboard.
  const afterAuth = useAfterAuthTarget();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRedirectPending, setGoogleRedirectPending] = useState(false);

  useEffect(() => {
    if (user) router.replace(afterAuth);
  }, [user, router, afterAuth]);

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
      router.push(afterAuth);
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
      <JoinLayout eyebrow="Einen Moment" title="Weiter zu Google">
        <div className="flex justify-center py-2" style={{ color: "var(--panel-accent)" }}>
          <span className="animate-spin" style={{ animationDuration: "1.4s" }}>
            <Icon name="refresh" size={28} />
          </span>
        </div>
      </JoinLayout>
    );
  }

  return (
    <JoinLayout
      eyebrow="Dein Team wartet"
      title="Konto erstellen"
      sub="Ein paar Angaben, dann gehört das Konto dir — samt Training, Verlauf und Kampfprofil."
      legal
    >
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || submitting}
        className="join-fremdknopf inline-flex items-center justify-center gap-3 px-4 disabled:opacity-50"
        style={JOIN_BTN_FONT}
      >
        {googleLoading ? (
          <>
            <span className="animate-spin" style={{ animationDuration: "1.4s" }}>
              <Icon name="refresh" size={16} />
            </span>
            Verbinde…
          </>
        ) : (
          <>
            <GoogleMark />
            Mit Google registrieren
          </>
        )}
      </button>

      <div className="join-trenner">
        <span
          style={{
            font: "var(--type-meta)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
          }}
        >
          oder
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reg-name"
            className="t-label"
            style={{ color: "var(--panel-fg-2)" }}
          >
            Name (optional)
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            placeholder="z. B. Iron Mike"
            className="join-feld disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reg-email"
            className="t-label"
            style={{ color: "var(--panel-fg-2)" }}
          >
            E-Mail
          </label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            placeholder="name@beispiel.de"
            className="join-feld disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reg-passwort"
            className="t-label"
            style={{ color: "var(--panel-fg-2)" }}
          >
            Passwort
          </label>
          <input
            id="reg-passwort"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="mind. 6 Zeichen"
            className="join-feld disabled:opacity-50"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-field px-4 py-3"
            style={{
              font: "var(--type-sub)",
              border:
                "1px solid color-mix(in oklab, var(--negative) 45%, transparent)",
              background: "color-mix(in oklab, var(--negative) 14%, transparent)",
              color: "var(--panel-fg)",
            }}
          >
            {error}
          </p>
        )}

        <JoinPrimary type="submit" disabled={submitting || googleLoading}>
          {submitting ? "Lege an…" : "Konto erstellen"}
        </JoinPrimary>
      </form>

      <p className="text-center" style={{ font: "var(--type-sub)", color: "var(--panel-fg-2)" }}>
        Schon registriert?{" "}
        <Link
          href={`/login${inviteQueryFor(afterAuth)}`}
          style={{ color: "var(--panel-accent)", fontWeight: 600 }}
        >
          Zum Login
        </Link>
      </p>
    </JoinLayout>
  );
}

/**
 * useAfterAuthTarget liest die Adresszeile über useSearchParams — und das
 * verlangt in Next 14 eine Suspense-Grenze, sonst bricht der Build der
 * statisch vorgerenderten Seite. Der Wrapper ist genau dafür da; er hält
 * nichts eigenes.
 */
export default function RegistrierungPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
