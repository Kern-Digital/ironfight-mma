"use client";

/**
 * Account-Seite — das „normale Profil": Name, App-Einstellungen, Kurs-Abos,
 * Account-Infos. Alles Kämpferische (Athleten-Daten, DeepFight-Profil,
 * freigegebene Auswertungen/Gegner) lebt seit 2026-08-19 im Kampfprofil
 * (/kampfprofil, siehe components/AthleteProfileForm.tsx).
 *
 * Neues Token-System (Rollout Etappe 3). Der Fighter-Name speichert wie die
 * Athleten-Daten AUTOMATISCH (debounced, kein Button); Theme-/Timer-Toggles
 * schreiben ohnehin sofort (Theme-Context bzw. localStorage).
 */

import ProtectedRoute from "@/components/ProtectedRoute";
import AthleteTabBar from "@/components/AthleteTabBar";
import AchievementsPanel from "@/components/AchievementsPanel";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth, useRights } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useTimerSettings } from "@/lib/use-timer-settings";
import { greetingFor } from "@/lib/greeting";
import { getSubscriptions, unsubscribeFromBlock } from "@/lib/training-sessions";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BlockSubscription } from "@/lib/types";

// ─── Typo-Konstanten (Muster der Referenzseiten) ───────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const STATUS_FONT: React.CSSProperties = {
  font: "600 11px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    // Kein Gap Titel↔Untertitel (Leon 2026-08-27) — Durchschuss reicht.
    <div className="flex flex-col">
      <h2
        style={{
          font: "var(--type-h2)",
          letterSpacing: "var(--ls-display)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{subtitle}</p>
    </div>
  );
}

// ─── Einstellungs-Toggle (Token-Switch) ────────────────────────────────────

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
    // Die ganze Zeile schaltet (Touch-Ziel ≥ 44px), der Switch ist Anzeige
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="t-interactive flex min-h-hit w-full items-center justify-between gap-3 rounded-badge py-2.5 text-left"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span style={{ font: "var(--type-body-strong)" }}>{label}</span>
        {hint && (
          <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-pill"
        style={{
          background: checked ? "var(--accent)" : "var(--surface-raised)",
          border: "1px solid",
          borderColor: checked ? "var(--accent)" : "var(--line-strong)",
          transition:
            "background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        }}
      >
        <span
          className="absolute top-1/2 rounded-pill"
          style={{
            width: "18px",
            height: "18px",
            left: checked ? "22px" : "2px",
            transform: "translateY(-50%)",
            background: checked ? "var(--on-accent)" : "var(--text-3)",
            transition:
              "left var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out)",
          }}
        />
      </span>
    </button>
  );
}

function Hairline() {
  return <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />;
}

// ─── Fighter-Name (Auto-Save, Muster AthleteProfileForm) ───────────────────

function FighterNameCard() {
  const { profile, updateDisplayName } = useAuth();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dirty = ungespeicherte Änderung (steuert den Debounce), edited = je selbst
  // getippt (stoppt den Profil→Feld-Sync dauerhaft), inFlight/pending
  // serialisieren überlappende Speichervorgänge.
  const dirtyRef = useRef(false);
  const editedRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (editedRef.current) return;
    setName(profile?.displayName ?? "");
  }, [profile?.displayName]);

  const persist = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    dirtyRef.current = false;
    setError(null);
    setSaving(true);
    try {
      await updateDisplayName(nameRef.current.trim() || null);
      setSaved(true);
    } catch (err) {
      dirtyRef.current = true; // nächste Eingabe versucht es erneut
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void persist();
      }
    }
  }, [updateDisplayName]);

  // Debounce: 800 ms nach der letzten Eingabe automatisch speichern
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => void persist(), 800);
    return () => clearTimeout(t);
  }, [name, persist]);

  // Flush beim Unmount — sonst verliert schnelle SPA-Navigation die Eingabe
  useEffect(
    () => () => {
      if (dirtyRef.current) void persist();
    },
    [persist],
  );

  return (
    <div className="t-card flex flex-col gap-3 p-4 sm:p-6">
      <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
        So heißt du in der App. Lass das Feld leer, wenn du einfach „Flex"
        bleiben willst.
      </p>
      <input
        type="text"
        maxLength={30}
        value={name}
        onChange={(e) => {
          editedRef.current = true;
          dirtyRef.current = true;
          setSaved(false);
          setName(e.target.value);
        }}
        placeholder="Flex"
        aria-label="Fighter-Name"
        className="t-interactive w-full min-h-hit rounded-field px-3.5"
        style={{
          font: "var(--type-body)",
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          color: "var(--text-body)",
          outline: "none",
        }}
      />
      {error && (
        <div
          className="rounded-field px-3.5 py-2.5"
          style={{
            font: "var(--type-sub)",
            background: "color-mix(in oklab, var(--negative) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--negative) 40%, transparent)",
            color: "var(--negative)",
          }}
        >
          {error}
        </div>
      )}
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-3">
        <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Änderungen werden automatisch gespeichert.
        </span>
        {saving ? (
          <span
            className="inline-flex items-center gap-1.5"
            style={{ ...STATUS_FONT, color: "var(--text-3)" }}
          >
            <Icon name="refresh" size={14} strokeWidth={2.2} />
            Speichere…
          </span>
        ) : saved ? (
          <span
            className="inline-flex items-center gap-1.5"
            style={{ ...STATUS_FONT, color: "var(--positive)" }}
          >
            <Icon name="check" size={14} strokeWidth={2.6} />
            Gespeichert
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Kurs-Abos ─────────────────────────────────────────────────────────────

function SubscriptionsCard({ uid }: { uid: string }) {
  const [subs, setSubs] = useState<BlockSubscription[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await getSubscriptions(uid);
    list.sort(
      (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
    );
    setSubs(list);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="flex flex-col gap-3">
      {subs === null ? (
        <Skeleton className="h-16 w-full rounded-card" />
      ) : subs.length === 0 ? (
        <div
          className="rounded-card p-6 text-center"
          style={{
            background: "var(--surface-card)",
            border: "1px dashed var(--line-strong)",
          }}
        >
          <p style={{ font: "var(--type-body-strong)" }}>
            Noch keine Kurse abonniert.
          </p>
          <p
            className="mx-auto mt-1 max-w-sm"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Öffne den Kursplan und folge einem Kurs — neue Techniken aus diesen
            Trainings landen dann automatisch in deiner Bibliothek.
          </p>
        </div>
      ) : (
        // Liste = EINE Karte mit Haarlinien-Trennern (eigene 1px-Elemente)
        <div className="t-card px-3.5 py-0.5">
          {subs.map((s, i) => (
            <Fragment key={s.trainingBlockId}>
              {i > 0 && <Hairline />}
              <div className="flex min-h-hit items-center gap-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate" style={{ font: "var(--type-body-strong)" }}>
                    {s.blockTitle}
                  </span>
                  <span
                    style={{
                      font: "var(--type-meta)",
                      letterSpacing: "var(--ls-label)",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                    }}
                  >
                    {WEEKDAY_SHORT[s.weekday]} · {s.startTime}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(s.trainingBlockId)}
                  disabled={busy === s.trainingBlockId}
                  className="t-interactive min-h-hit shrink-0 rounded-field px-3 disabled:opacity-50"
                  style={{ ...BTN_FONT, color: "var(--text-3)" }}
                >
                  {busy === s.trainingBlockId ? "…" : "Entfernen"}
                </button>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      <Link
        href="/schedule"
        className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 self-start rounded-field px-5"
        style={{
          ...BTN_FONT,
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          color: "var(--text-2)",
          textDecoration: "none",
        }}
      >
        <Icon name="calendar" size={14} strokeWidth={2.2} />
        Zum Kursplan
      </Link>
    </div>
  );
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────

function ProfileContent() {
  const { user, profile, profileLoading, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const timer = useTimerSettings();
  const isTrainer = useRights().trainer;

  const greeting = greetingFor(profile?.displayName);

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (nur hier — nie hinter Listen).
          Begrüßung bewusst OHNE Versalien (Begrüßungs-Ausnahme wie auf der
          Dashboard-Referenzseite — ein Satz, kein Label). */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-6 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-8">
          <div className="flex flex-1 flex-col gap-1">
            <span className="t-label">Account</span>
            <h1
              style={{
                font: "800 24px/1.15 var(--font-archivo), system-ui, sans-serif",
                letterSpacing: "0.01em",
              }}
            >
              {greeting}
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Dein Name, App-Einstellungen, Kurs-Abos und Account-Infos.
            </p>
          </div>
          {/* Mobil: Theme-Umschalter im Seitenkopf (Desktop: in der Tab-Bar) */}
          {!isTrainer && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Helles Design aktivieren"
                  : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 pt-1 lg:max-w-5xl lg:px-6">
        {profileLoading ? (
          <Skeleton className="h-64 w-full rounded-card" />
        ) : (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
            {/* Verweis aufs Kampfprofil — DeepFight-Kontext, daher t-card-fight */}
            <Link
              href="/kampfprofil"
              className="t-card-fight t-interactive flex items-center gap-3 p-4 lg:col-span-2"
              style={{ textDecoration: "none" }}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-label" style={{ color: "var(--accent-2)" }}>
                  Kampfprofil
                </span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Athleten-Daten, DeepFight-Auswertungen und freigegebene
                  Gegnerprofile findest du in deinem Kampfprofil.
                </span>
              </span>
              <span className="shrink-0" style={{ color: "var(--text-3)" }}>
                <Icon name="arrow-right" size={18} strokeWidth={2.2} />
              </span>
            </Link>

            {/* Fighter-Name */}
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Fighter-Name"
                subtitle="Dein Anzeigename in der ganzen App"
              />
              <FighterNameCard />
            </section>

            {/* App-Einstellungen */}
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Einstellungen"
                subtitle="Design und Timer — Änderungen gelten sofort"
              />
              <div className="t-card px-3.5 py-1">
                <ToggleRow
                  label="Helles Design"
                  hint="Standard ist das dunkle Design."
                  checked={theme === "light"}
                  onChange={() => toggleTheme()}
                />
                <Hairline />
                <ToggleRow
                  label="Timer-Sound"
                  hint="Signaltöne bei Rundenwechseln."
                  checked={timer.settings.soundOn}
                  onChange={timer.setSoundOn}
                />
                <Hairline />
                <ToggleRow
                  label="Vibration"
                  hint="Vibrieren bei Rundenwechseln (nur Mobile)."
                  checked={timer.settings.vibrate}
                  onChange={timer.setVibrate}
                />
                <Hairline />
                <ToggleRow
                  label="Display anlassen"
                  hint="Bildschirm bleibt an, solange der Timer läuft."
                  checked={timer.settings.wakeLock}
                  onChange={timer.setWakeLock}
                />
              </div>
            </section>

            {/* Kurs-Abos */}
            {user && (
              <section className="flex flex-col gap-3">
                <SectionHeader
                  title="Meine Kurse"
                  subtitle="Abonnierte Kurse füllen deine Technik-Bibliothek automatisch"
                />
                <SubscriptionsCard uid={user.uid} />
              </section>
            )}

            {/* Account-Infos */}
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Account"
                subtitle="Anmeldedaten — dein Auth-Name bleibt intern"
              />
              <div className="t-card px-3.5 py-0.5">
                <div className="flex min-h-hit items-center justify-between gap-3 py-2.5">
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    E-Mail
                  </span>
                  <span
                    className="truncate"
                    style={{ font: "var(--type-body-strong)" }}
                  >
                    {user?.email ?? "—"}
                  </span>
                </div>
                <Hairline />
                <div className="flex min-h-hit items-center justify-between gap-3 py-2.5">
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    Auth-Anbieter
                  </span>
                  <span style={{ font: "var(--type-body-strong)" }}>
                    {profile?.authProviderName
                      ? `Google (${profile.authProviderName})`
                      : "E-Mail"}
                  </span>
                </div>
                <Hairline />
                <div className="flex min-h-hit items-center justify-between gap-3 py-2.5">
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    Angezeigter Name
                  </span>
                  <span
                    style={{
                      font: "var(--type-body-strong)",
                      color: "var(--accent-text)",
                    }}
                  >
                    {profile?.displayName?.trim() || "Flex"}
                  </span>
                </div>
              </div>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Dein Auth-Name (z. B. Google-Klarname) wird intern für die
                Anmeldung gespeichert, aber niemals in der App angezeigt.
              </p>
              <button
                type="button"
                onClick={() => logOut()}
                className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 self-start rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                  color: "var(--text-2)",
                }}
              >
                Logout
              </button>
            </section>

            {/* Achievements */}
            {user && (
              <section className="flex flex-col gap-3 lg:col-span-2">
                <SectionHeader
                  title="Achievements"
                  subtitle="Meilensteine aus Workouts, Streaks und deiner Bibliothek"
                />
                <div className="t-card p-4 sm:p-6">
                  <AchievementsPanel uid={user.uid} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
