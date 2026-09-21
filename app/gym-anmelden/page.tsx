"use client";

/**
 * /gym-anmelden — ein Gym meldet sich selbst an (Schritt 1 des
 * Geschäftsplans, 21.09.2026). Öffentlich, ohne Login: Der Betreiber kommt
 * von der Website hierher, ohne mit Leon zu reden.
 *
 * Zwei Wege in EINEM Formular:
 *   • Ohne Konto: Gym-Name, eigener Name, E-Mail, Passwort → Konto entsteht
 *     wie auf /register, danach ruft die Seite /api/gyms/anmelden.
 *   • Mit Konto ohne Gym-Claim: nur der Gym-Name.
 *   • Mit Konto UND Gym: kein Formular — der Weg zurück in die App.
 *
 * Nach dem Anlegen erzwingt `refreshRole` das Token-Refresh (die Claims
 * kommen vom Admin-SDK) und die Seite führt in die Verwaltung.
 */

import Icon from "@/components/ui/Icon";
import JoinLayout, { JoinPrimary } from "@/components/JoinLayout";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FirebaseError } from "firebase/app";

function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Diese E-Mail ist bereits registriert. Melde dich an und lege dein Gym danach hier an.";
    case "auth/invalid-email":
      return "Ungültige E-Mail-Adresse.";
    case "auth/weak-password":
      return "Passwort zu schwach — mindestens 6 Zeichen.";
    case "auth/network-request-failed":
      return "Netzwerkfehler. Bitte Internetverbindung prüfen.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte kurz warten.";
    default:
      return "Das hat nicht geklappt. Bitte erneut versuchen.";
  }
}

const FELD = "join-feld disabled:opacity-50";
const LABEL: React.CSSProperties = { color: "var(--panel-fg-2)" };

export default function GymAnmeldenPage() {
  const { user, profile, loading, profileLoading, signUp, refreshRole } = useAuth();
  const router = useRouter();
  const [gymName, setGymName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fertig, setFertig] = useState<string | null>(null);

  const angemeldet = !!user;
  const hatGym = !!profile?.gymId;

  async function gymAnlegen(idToken: string): Promise<string> {
    const res = await fetch("/api/gyms/anmelden", {
      method: "POST",
      headers: { authorization: `Bearer ${idToken}`, "content-type": "application/json" },
      body: JSON.stringify({ name: gymName }),
    });
    const data = (await res.json().catch(() => ({}))) as { gymId?: string; error?: string };
    if (!res.ok || !data.gymId) throw new Error(data.error || "Das Gym ließ sich nicht anlegen.");
    return data.gymId;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      let idToken: string;
      if (user) {
        idToken = await user.getIdToken();
      } else {
        const neu = await signUp(email, password, name.trim() || undefined);
        idToken = await neu.getIdToken();
      }
      const gymId = await gymAnlegen(idToken);
      await refreshRole();
      setFertig(gymId);
      router.replace("/verwaltung");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(code ? authErrorMessage(code) : err instanceof Error ? err.message : authErrorMessage(""));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (angemeldet && profileLoading)) {
    return (
      <JoinLayout eyebrow="Einen Moment" title="Gym anmelden">
        <div className="flex justify-center py-2" style={{ color: "var(--panel-accent)" }}>
          <span className="animate-spin" style={{ animationDuration: "1.4s" }}>
            <Icon name="refresh" size={28} />
          </span>
        </div>
      </JoinLayout>
    );
  }

  if (fertig) {
    return (
      <JoinLayout eyebrow="Willkommen" title="Dein Gym steht" sub="Kursplan, Mitglieder und Pläne warten. Du bist die Verwaltung deines Gyms.">
        <JoinPrimary type="button" onClick={() => router.replace("/verwaltung")}>
          Zur Verwaltung
        </JoinPrimary>
      </JoinLayout>
    );
  }

  if (angemeldet && hatGym) {
    return (
      <JoinLayout
        eyebrow="Schon dabei"
        title="Dein Konto hat ein Gym"
        sub="Ein Konto gehört zu genau einem Gym. Ein Wechsel läuft über die Verwaltung deines Gyms."
      >
        <JoinPrimary type="button" onClick={() => router.replace("/dashboard")}>
          Zurück in die App
        </JoinPrimary>
      </JoinLayout>
    );
  }

  return (
    <JoinLayout
      eyebrow="Dein Gym auf Tidal"
      title="Gym anmelden"
      sub="Kursplan, Mitglieder, Trainingspläne — kostenlos und ohne Mitgliedergrenze. Du bist danach die Verwaltung deines Gyms und dein erster Trainer."
      legal
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-gym-anmelden>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gym-name" className="t-label" style={LABEL}>
            Name des Gyms
          </label>
          <input
            id="gym-name"
            type="text"
            required
            minLength={2}
            maxLength={60}
            autoComplete="organization"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            disabled={submitting}
            placeholder="z. B. Gracie Barra Freiburg"
            className={FELD}
          />
        </div>

        {!angemeldet && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gym-person" className="t-label" style={LABEL}>
                Dein Name
              </label>
              <input
                id="gym-person"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                placeholder="z. B. Marco"
                className={FELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gym-email" className="t-label" style={LABEL}>
                E-Mail
              </label>
              <input
                id="gym-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="name@dein-gym.de"
                className={FELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gym-passwort" className="t-label" style={LABEL}>
                Passwort
              </label>
              <input
                id="gym-passwort"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="mind. 6 Zeichen"
                className={FELD}
              />
            </div>
          </>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-field px-4 py-3"
            style={{
              font: "var(--type-sub)",
              border: "1px solid color-mix(in oklab, var(--negative) 45%, transparent)",
              background: "color-mix(in oklab, var(--negative) 14%, transparent)",
              color: "var(--panel-fg)",
            }}
          >
            {error}
          </p>
        )}

        <JoinPrimary type="submit" disabled={submitting}>
          {submitting ? "Lege an…" : angemeldet ? "Gym anlegen" : "Gym anlegen und loslegen"}
        </JoinPrimary>
      </form>

      {!angemeldet && (
        <p className="text-center" style={{ font: "var(--type-sub)", color: "var(--panel-fg-2)" }}>
          Schon ein Konto?{" "}
          <Link href="/login?next=/gym-anmelden" style={{ color: "var(--panel-accent)", fontWeight: 600 }}>
            Anmelden und Gym anlegen
          </Link>
        </p>
      )}
    </JoinLayout>
  );
}
