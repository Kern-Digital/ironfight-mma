"use client";

import GoogleMark from "@/components/GoogleMark";
import Icon from "@/components/ui/Icon";
import JoinLayout, { JOIN_BTN_FONT, JoinPrimary } from "@/components/JoinLayout";
import { merkeGeraet, type Begruessung } from "@/lib/login-begruessung";

import { useAuth } from "@/lib/auth-context";
import { inviteQueryFor, useAfterAuthTarget } from "@/lib/use-invite-param";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    case "auth/cancelled-popup-request":
      return "Google-Anmeldung wurde abgebrochen.";
    case "auth/popup-blocked":
      return "Popup blockiert. Bitte nutze E-Mail und Passwort.";
    case "auth/network-request-failed":
      return "Netzwerkfehler. Bitte Internetverbindung prüfen.";
    default:
      return "Login fehlgeschlagen. Bitte erneut versuchen.";
  }
}

export default function LoginForm({ begruessung }: { begruessung: Begruessung }) {
  const { signIn, signInWithGoogle, user, redirectError } = useAuth();
  const router = useRouter();
  // Kam der Besucher über eine Einladung (?invite=), führt der Weg nach der
  // Anmeldung zurück auf /beitreten/{code} statt aufs Dashboard.
  const afterAuth = useAfterAuthTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRedirectPending, setGoogleRedirectPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    // EINE Stelle für alle Wege hinein (E-Mail, Google-Popup,
    // Google-Weiterleitung): Sobald ein angemeldeter Nutzer hier steht, ist
    // das Gerät bekannt. Beim nächsten Mal begrüßt es ihn entsprechend.
    merkeGeraet();
    router.replace(afterAuth);
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
      await signIn(email, password);
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

  /* Der Zwischenzustand steht jetzt IN der Karte statt auf nackter Seite —
     sonst blitzt beim Weg zu Google einmal die alte Oberfläche auf. */
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
      /* Kopf wie im Beitritts-Stapel: Wer über eine Einladung herkommt
         (?invite=), soll nicht in einem anders klingenden Fenster landen.
         KEIN Gym-Kontext hier — ausgeloggt und ohne Code weiß niemand, zu
         welchem Gym der Besucher gehört. Deshalb steht über der Karte das
         Tidal-Zeichen und der Standard-Akzent, und das ist richtig so. */
      eyebrow={begruessung.eyebrow}
      title={begruessung.title}
      sub={begruessung.sub}
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
            Mit Google anmelden
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
            htmlFor="login-email"
            className="t-label"
            style={{ color: "var(--panel-fg-2)" }}
          >
            E-Mail
          </label>
          <input
            id="login-email"
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
            htmlFor="login-passwort"
            className="t-label"
            style={{ color: "var(--panel-fg-2)" }}
          >
            Passwort
          </label>
          <input
            id="login-passwort"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="Dein Passwort"
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
          {submitting ? "Melde an…" : "Einloggen"}
        </JoinPrimary>
      </form>

      <div className="flex flex-col items-center gap-2 text-center">
        <Link
          href="/forgot-password"
          style={{
            font: "var(--type-sub)",
            fontSize: "12px",
            color: "var(--panel-fg-3)",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          Passwort vergessen?
        </Link>
        <p style={{ font: "var(--type-sub)", color: "var(--panel-fg-2)" }}>
          Noch kein Konto?{" "}
          <Link
            href={`/register${inviteQueryFor(afterAuth)}`}
            style={{ color: "var(--panel-accent)", fontWeight: 600 }}
          >
            Registrieren
          </Link>
        </p>
      </div>
    </JoinLayout>
  );
}
