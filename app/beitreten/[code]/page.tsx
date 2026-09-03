"use client";

/**
 * Einladung öffnen — /beitreten/{code} (Multi-Gym Phase 2, Checkpoint 1C).
 *
 * Das ist der Link, der geteilt wird (lib/invites.ts → inviteJoinUrl), und für
 * viele Menschen der ERSTE Bildschirm der App. Entsprechend führt die Seite
 * durch, statt zu prüfen: eine Aussage pro Zustand, ein nächster Schritt.
 *
 * ZWEI DINGE, DIE HIER ABSICHT SIND:
 *
 * 1. /beitreten/* steht NICHT im matcher von middleware.ts. Stünde es dort,
 *    würde ein ausgeloggter Eingeladener auf /login geworfen, bevor er die
 *    Einladung überhaupt sieht — der Link führte ins Leere.
 *
 * 2. Ausgeloggt wird der GYM-NAME NICHT gezeigt. /api/invites/preview verlangt
 *    bewusst ein Konto, sonst wäre die Route ein Orakel zum Durchprobieren.
 *    Ausgeloggt steht deshalb nur der Code da — welches Gym dahintersteckt,
 *    erfährt man nach der Anmeldung. Der Code reist als ?invite= mit, damit
 *    Login und Registrierung hierher zurückführen.
 *
 * Geschrieben wird nichts direkt: Prüfen und Einlösen laufen über die
 * Server-Routen (Bearer-Token aus user.getIdToken()).
 */

import JoinCodeSlots from "@/components/JoinCodeSlots";
import JoinLayout, {
  JoinPrimary,
  JoinSecondary,
} from "@/components/JoinLayout";
import { useAuth } from "@/lib/auth-context";
import {
  isPlausibleInviteCode,
  normalizeInviteCode,
  previewInviteRequest,
  redeemInviteRequest,
  type InvitePreview,
} from "@/lib/invites";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** Was der Beitritt für den Eingeladenen bedeutet — Text folgt der Rolle. */
const ROLE_EXPLAINER: Record<string, string> = {
  user: "Du steigst als Athlet ein — deine Kurse, deine Workout-Pläne und dein eigenes Kampfprofil warten hinter diesem Knopf.",
  trainer:
    "Du steigst als Trainer ein — dein eigenes Training plus die Werkzeuge deines Teams: DeepFight, Wettkämpfe und die Athletenliste.",
};

export default function JoinWithCodePage({
  params,
}: {
  params: { code: string };
}) {
  const router = useRouter();
  const { user, loading, refreshRole } = useAuth();

  const code = normalizeInviteCode(decodeURIComponent(params.code ?? ""));
  const plausible = isPlausibleInviteCode(code);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const check = useCallback(async () => {
    if (!user) return;
    setChecking(true);
    setError(null);
    try {
      setPreview(await previewInviteRequest(await user.getIdToken(), code));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Die Einladung konnte nicht geprüft werden.",
      );
    } finally {
      setChecking(false);
    }
  }, [user, code]);

  useEffect(() => {
    // Nur mit Konto: /preview verlangt ein ID-Token (siehe Kopf). Ein Code in
    // unmöglicher Form wird gar nicht erst zum Server geschickt.
    if (loading || !user || !plausible) return;
    void check();
  }, [loading, user, plausible, check]);

  async function handleJoin() {
    if (!user || joining) return;
    setJoining(true);
    setError(null);
    try {
      await redeemInviteRequest(await user.getIdToken(), code);
      // Der frische gymId-Claim steckt im ID-Token — ohne Refresh arbeitet
      // die App weiter mit dem alten Stand (auth-context.refreshRole).
      await refreshRole();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen.");
      setJoining(false);
    }
  }

  // ─── Code in unmöglicher Form: gar nicht erst fragen ──────────────────
  if (!plausible) {
    return (
      <JoinLayout
        eyebrow="Dein Team wartet"
        title="Der Link ist unvollständig"
        sub="Der Code in diesem Link hat nicht die richtige Form. Häufig fehlt beim Kopieren das letzte Stück — du kannst ihn auch von Hand eintragen."
      >
        <JoinPrimary href="/beitreten" icon="arrow-right">
          Code eintragen
        </JoinPrimary>
      </JoinLayout>
    );
  }

  // ─── Auth wird noch geladen ───────────────────────────────────────────
  if (loading) {
    return (
      <JoinLayout eyebrow="Dein Team wartet" title="Einen Moment">
        <JoinCodeSlots value={code} readOnly />
      </JoinLayout>
    );
  }

  // ─── Ausgeloggt: einladen, nicht abweisen ─────────────────────────────
  if (!user) {
    const back = `?invite=${code}`;
    return (
      <JoinLayout
        eyebrow="Dein Team wartet"
        title="Komm dazu"
        sub="Ab hier trainierst du nicht mehr allein: dein Kursplan, deine Workouts und dein Kampfprofil liegen fertig für dich bereit."
        legal
      >
        <JoinCodeSlots value={code} readOnly />
        <div className="flex flex-col gap-2">
          <JoinPrimary href={`/register${back}`}>Jetzt loslegen</JoinPrimary>
          <JoinSecondary href={`/login${back}`}>
            Ich habe schon ein Konto
          </JoinSecondary>
        </div>
      </JoinLayout>
    );
  }

  // ─── Eingeloggt, Prüfung läuft ────────────────────────────────────────
  if (checking || (!preview && !error)) {
    return (
      <JoinLayout
        eyebrow="Dein Team wartet"
        title="Einen Moment"
        sub="Wir schauen nach, wohin dieser Code gehört."
      >
        <JoinCodeSlots value={code} readOnly />
      </JoinLayout>
    );
  }

  // ─── Aufruf selbst gescheitert (Netz, 429, Server aus) ────────────────
  if (error && !preview) {
    return (
      <JoinLayout eyebrow="Dein Zugang" title="Das hat nicht geklappt" sub={error}>
        <div className="flex flex-col gap-2">
          <JoinPrimary onClick={() => void check()}>
            Noch einmal versuchen
          </JoinPrimary>
          <JoinSecondary href="/dashboard">Zum Dashboard</JoinSecondary>
        </div>
      </JoinLayout>
    );
  }

  // ─── Code nicht (mehr) nutzbar ────────────────────────────────────────
  if (preview && !preview.valid) {
    return (
      <JoinLayout
        eyebrow="Dein Zugang"
        title="Das hat nicht geklappt"
        sub={`${preview.reason ?? "Diese Einladung ist nicht mehr gültig."} Frag die Person, die dich eingeladen hat, nach einem frischen Link — das ist für sie ein Klick.`}
      >
        <JoinCodeSlots value={code} readOnly />
        <div className="flex flex-col gap-2">
          <JoinPrimary href="/beitreten">Anderen Code eintragen</JoinPrimary>
          <JoinSecondary href="/dashboard">Zum Dashboard</JoinSecondary>
        </div>
      </JoinLayout>
    );
  }

  // ─── Schon Mitglied dieses Gyms ───────────────────────────────────────
  // Einlösen würde funktionieren, aber eine Nutzung verbrauchen — der Code
  // bleibt so für jemand anderen übrig.
  if (preview?.alreadyMember) {
    return (
      <JoinLayout
        eyebrow="Schon dabei"
        title={preview.gymName ?? "Dein Gym"}
        logo={preview.gymLogo}
        sub="Du bist hier schon Mitglied — es gibt nichts mehr zu tun."
      >
        <JoinPrimary href="/dashboard">Zum Dashboard</JoinPrimary>
      </JoinLayout>
    );
  }

  // ─── Gültig: der eigentliche Moment ───────────────────────────────────
  return (
    <JoinLayout
      eyebrow="Willkommen bei"
      title={preview?.gymName ?? "Deinem Gym"}
      logo={preview?.gymLogo}
      sub={ROLE_EXPLAINER[preview?.role ?? "user"]}
      legal
    >
      <JoinCodeSlots value={code} readOnly />
      {error && (
        <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
          {error}
        </p>
      )}
      <JoinPrimary onClick={() => void handleJoin()} disabled={joining} icon="check">
        {joining ? "Trete bei…" : "Jetzt beitreten"}
      </JoinPrimary>
    </JoinLayout>
  );
}
