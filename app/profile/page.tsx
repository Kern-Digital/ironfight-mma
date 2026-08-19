"use client";

/**
 * Account-Seite — das „normale Profil": Name, App-Einstellungen, Kurs-Abos,
 * Account-Infos. Alles Kämpferische (Athleten-Daten, DeepFight-Profil,
 * freigegebene Auswertungen/Gegner) lebt seit 2026-08-19 im Kampfprofil
 * (/kampfprofil, siehe components/AthleteProfileForm.tsx).
 */

import PageHeader from "@/components/PageHeader";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useTimerSettings } from "@/lib/use-timer-settings";
import { greetingFor } from "@/lib/greeting";
import { getSubscriptions, unsubscribeFromBlock } from "@/lib/training-sessions";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import { useEffect, useState } from "react";
import Link from "next/link";
import AchievementsPanel from "@/components/AchievementsPanel";
import type { BlockSubscription } from "@/lib/types";

// ─── Hilfs-Komponenten ─────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <div className="text-xs font-bold uppercase tracking-widest text-blood">
        {title}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none";

// ─── Einstellungs-Toggle ───────────────────────────────────────────────────

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-xs text-foreground/60">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{
          background: checked ? "var(--ta-cyan)" : "var(--ink-5)",
        }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{
            left: "2px",
            transform: checked ? "translateX(20px)" : "none",
          }}
        />
      </button>
    </div>
  );
}

// ─── Kurs-Abos Block ──────────────────────────────────────────────────────

function SubscriptionsBlock({ uid }: { uid: string }) {
  const [subs, setSubs] = useState<BlockSubscription[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const list = await getSubscriptions(uid);
    list.sort((a, b) => (a.weekday - b.weekday) || a.startTime.localeCompare(b.startTime));
    setSubs(list);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function handleRemove(blockId: string) {
    setBusy(blockId);
    try {
      await unsubscribeFromBlock(uid, blockId);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Meine Kurse">
      <p className="text-xs text-foreground/60">
        Abonnierte Kurse: Neue Techniken aus diesen Trainings landen automatisch
        in deiner Bibliothek — du musst nichts mehr manuell „Ich nehme teil"
        klicken.
      </p>

      {subs === null ? (
        <div className="h-10 animate-pulse rounded-sm bg-carbon-700" />
      ) : subs.length === 0 ? (
        <div className="text-sm text-foreground/60">
          Noch keine Kurse abonniert.{" "}
          <Link href="/schedule" className="text-blood underline">
            Stundenplan öffnen
          </Link>{" "}
          und einem Kurs folgen.
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => (
            <div
              key={s.trainingBlockId}
              className="flex items-center justify-between gap-3 py-1"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{s.blockTitle}</div>
                <div className="text-xs text-foreground/60">
                  {WEEKDAY_SHORT[s.weekday]} · {s.startTime}
                </div>
              </div>
              <button
                onClick={() => handleRemove(s.trainingBlockId)}
                disabled={busy === s.trainingBlockId}
                className="text-xs uppercase tracking-widest text-foreground/60 hover:text-blood disabled:opacity-50"
              >
                {busy === s.trainingBlockId ? "…" : "Entfernen"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Link href="/schedule" className="btn-secondary text-xs">
          Im Stundenplan abonnieren
        </Link>
      </div>
    </Section>
  );
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────

function ProfileContent() {
  const { user, profile, profileLoading, updateDisplayName, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const timer = useTimerSettings();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? "");
  }, [profile?.displayName]);

  const greeting = greetingFor(profile?.displayName);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(name.trim() || null);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={greeting}
        description="Dein Name, App-Einstellungen, Kurs-Abos und Account-Infos."
      />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {profileLoading ? (
          <div className="card animate-pulse">
            <div className="h-4 w-32 bg-carbon-600 mb-3" />
            <div className="h-10 bg-carbon-600" />
          </div>
        ) : (
          <>
            {/* Achievements */}
            {user && <AchievementsPanel uid={user.uid} />}

            {/* Verweis aufs Kampfprofil (Athleten-Daten sind umgezogen) */}
            <Link
              href="/kampfprofil"
              className="mt-8 flex items-center justify-between gap-3 rounded-xl p-4"
              style={{
                background:
                  "radial-gradient(300px 120px at 0% 0%, rgba(157,123,250,0.14), transparent 60%), var(--ink-2)",
                border: "1px solid rgba(157,123,250,0.35)",
                textDecoration: "none",
              }}
            >
              <div>
                <div
                  className="font-mono-ta text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.18em", color: "var(--ta-violet)" }}
                >
                  Kampfprofil
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--fg-3)" }}>
                  Athleten-Daten, DeepFight-Auswertungen und freigegebene
                  Gegnerprofile findest du jetzt in deinem Kampfprofil.
                </p>
              </div>
              <span style={{ color: "var(--fg-4)", flexShrink: 0 }}>→</span>
            </Link>

            {/* Fighter-Name */}
            <Section title="Fighter-Name">
              <p className="text-sm text-foreground/70">
                So heißt du in der App. Lass das Feld leer, wenn du einfach
                „Flex" bleiben willst.
              </p>
              <form onSubmit={handleSaveName} className="space-y-3">
                <input
                  type="text"
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Flex"
                  className={inputClass}
                />
                {nameError && (
                  <div className="rounded-sm border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
                    {nameError}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="btn-primary disabled:opacity-50"
                  >
                    {savingName ? "Speichere…" : "Speichern"}
                  </button>
                  {nameSaved && (
                    <span className="text-xs uppercase tracking-widest text-green-400">
                      Gespeichert ✓
                    </span>
                  )}
                </div>
              </form>
            </Section>

            {/* App-Einstellungen */}
            <Section title="Einstellungen">
              <ToggleRow
                label="Helles Design"
                hint="Standard ist das dunkle Design."
                checked={theme === "light"}
                onChange={() => toggleTheme()}
              />
              <ToggleRow
                label="Timer-Sound"
                hint="Signaltöne bei Rundenwechseln."
                checked={timer.settings.soundOn}
                onChange={timer.setSoundOn}
              />
              <ToggleRow
                label="Vibration"
                hint="Vibrieren bei Rundenwechseln (nur Mobile)."
                checked={timer.settings.vibrate}
                onChange={timer.setVibrate}
              />
              <ToggleRow
                label="Display anlassen"
                hint="Bildschirm bleibt an, solange der Timer läuft."
                checked={timer.settings.wakeLock}
                onChange={timer.setWakeLock}
              />
            </Section>

            {/* Kurs-Abos */}
            {user && <SubscriptionsBlock uid={user.uid} />}

            {/* Account-Info */}
            <Section title="Account">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-carbon-500/60 pb-2">
                  <dt className="text-foreground/60">E-Mail</dt>
                  <dd className="font-bold">{user?.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-carbon-500/60 pb-2">
                  <dt className="text-foreground/60">Auth-Anbieter</dt>
                  <dd className="font-bold">
                    {profile?.authProviderName
                      ? `Google (${profile.authProviderName})`
                      : "E-Mail"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground/60">Angezeigter Name</dt>
                  <dd className="font-bold text-blood">
                    {profile?.displayName?.trim() || "Flex"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-foreground/60">
                Dein Auth-Name (z. B. Google-Klarname) wird intern für die
                Anmeldung gespeichert, aber niemals in der App angezeigt.
              </p>
            </Section>

            {/* Logout */}
            <div className="mt-6 flex justify-end">
              <button onClick={() => logOut()} className="btn-secondary text-sm">
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
