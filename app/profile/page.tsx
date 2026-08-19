"use client";

import PageHeader from "@/components/PageHeader";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";
import {
  ATHLETE_LEVEL_LABEL,
  BJJ_BELT_LABEL,
  DISCIPLINE_LABEL,
  FIGHTER_STANCE_LABEL,
  WEIGHT_CLASS_LABEL,
  type AthleteLevel,
  type AthleteProfile,
  type BjjBelt,
  type Discipline,
  type FighterStance,
  type WeightClass,
  weightClassForKg,
} from "@/lib/types";
import { updateAthleteProfile } from "@/lib/user-profile";
import { getSubscriptions, unsubscribeFromBlock } from "@/lib/training-sessions";
import { TRAINING_BLOCKS, WEEKDAY_SHORT } from "@/lib/schedule";
import { useEffect, useMemo, useState } from "react";
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-foreground/60">
        {label}
      </span>
      {hint && <p className="mt-1 text-xs text-foreground/50">{hint}</p>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none";

// ─── Form-State Helpers ────────────────────────────────────────────────────

type AthleteForm = {
  primaryDiscipline: Discipline | "";
  level: AthleteLevel | "";
  trainingStartDate: string; // YYYY-MM-DD
  weightKg: string;
  heightCm: string;
  reachCm: string;
  stance: FighterStance | "";
  weightClassMode: "auto" | "manual";
  weightClass: WeightClass | "";
  bjjBelt: BjjBelt | "";
  gymName: string;
  trainerName: string;
  nextCompetitionDate: string;
  nextCompetitionName: string;
};

function emptyForm(): AthleteForm {
  return {
    primaryDiscipline: "",
    level: "",
    trainingStartDate: "",
    weightKg: "",
    heightCm: "",
    reachCm: "",
    stance: "",
    weightClassMode: "auto",
    weightClass: "",
    bjjBelt: "",
    gymName: "",
    trainerName: "",
    nextCompetitionDate: "",
    nextCompetitionName: "",
  };
}

function dateToInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formFromAthlete(a: AthleteProfile | undefined): AthleteForm {
  const f = emptyForm();
  if (!a) return f;
  f.primaryDiscipline = a.primaryDiscipline ?? "";
  f.level = a.level ?? "";
  f.trainingStartDate = dateToInputValue(a.trainingStartDate);
  f.weightKg = a.weightKg != null ? String(a.weightKg) : "";
  f.heightCm = a.heightCm != null ? String(a.heightCm) : "";
  f.reachCm = a.reachCm != null ? String(a.reachCm) : "";
  f.stance = a.stance ?? "";
  f.weightClass = a.weightClass ?? "";
  f.weightClassMode = a.weightClass ? "manual" : "auto";
  f.bjjBelt = a.bjjBelt ?? "";
  f.gymName = a.gymName ?? "";
  f.trainerName = a.trainerName ?? "";
  f.nextCompetitionDate = dateToInputValue(a.nextCompetitionDate);
  f.nextCompetitionName = a.nextCompetitionName ?? "";
  return f;
}

function patchFromForm(form: AthleteForm): Partial<AthleteProfile> {
  const weightKg = form.weightKg ? Number(form.weightKg) : null;
  const heightCm = form.heightCm ? Number(form.heightCm) : null;
  const reachCm = form.reachCm ? Number(form.reachCm) : null;

  let weightClass: WeightClass | null = null;
  if (form.weightClassMode === "manual" && form.weightClass) {
    weightClass = form.weightClass;
  } else if (form.weightClassMode === "auto" && weightKg) {
    weightClass = weightClassForKg(weightKg);
  }

  return {
    primaryDiscipline: form.primaryDiscipline || null,
    level: form.level || null,
    trainingStartDate: form.trainingStartDate
      ? new Date(form.trainingStartDate)
      : null,
    weightKg: Number.isFinite(weightKg) ? weightKg : null,
    heightCm: Number.isFinite(heightCm) ? heightCm : null,
    reachCm: Number.isFinite(reachCm) ? reachCm : null,
    stance: form.stance || null,
    weightClass,
    bjjBelt: form.bjjBelt || null,
    gymName: form.gymName.trim() || null,
    trainerName: form.trainerName.trim() || null,
    nextCompetitionDate: form.nextCompetitionDate
      ? new Date(form.nextCompetitionDate)
      : null,
    nextCompetitionName: form.nextCompetitionName.trim() || null,
  };
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
  const { user, profile, profileLoading, updateDisplayName, refreshProfile, logOut } =
    useAuth();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [form, setForm] = useState<AthleteForm>(emptyForm());
  const [savingAthlete, setSavingAthlete] = useState(false);
  const [athleteSaved, setAthleteSaved] = useState(false);
  const [athleteError, setAthleteError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? "");
    setForm(formFromAthlete(profile?.athlete));
  }, [profile?.displayName, profile?.athlete]);

  const greeting = greetingFor(profile?.displayName);

  // Trainings-Jahre live berechnen
  const trainingYears = useMemo(() => {
    if (!form.trainingStartDate) return null;
    const start = new Date(form.trainingStartDate);
    if (Number.isNaN(start.getTime())) return null;
    const months = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 1) return "Frisch dabei";
    if (months < 12) return `${Math.round(months)} Monate`;
    const years = months / 12;
    return years >= 2 ? `${years.toFixed(1)} Jahre` : `${years.toFixed(1)} Jahr`;
  }, [form.trainingStartDate]);

  // Auto-Gewichtsklasse Vorschau
  const autoWeightClass = useMemo(() => {
    const kg = Number(form.weightKg);
    if (!form.weightKg || !Number.isFinite(kg) || kg <= 0) return null;
    return weightClassForKg(kg);
  }, [form.weightKg]);

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

  async function handleSaveAthlete(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setAthleteError(null);
    setSavingAthlete(true);
    try {
      await updateAthleteProfile(user.uid, patchFromForm(form));
      await refreshProfile();
      setAthleteSaved(true);
      setTimeout(() => setAthleteSaved(false), 2000);
    } catch (err) {
      setAthleteError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setSavingAthlete(false);
    }
  }

  function update<K extends keyof AthleteForm>(key: K, value: AthleteForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={greeting}
        description="Dein Athletenprofil, Kurs-Abos und persönliche Einstellungen."
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

            {/* Athleten-Profil */}
            <form onSubmit={handleSaveAthlete}>
              <Section title="Athleten-Basics">
                <Field label="Hauptdisziplin">
                  <select
                    value={form.primaryDiscipline}
                    onChange={(e) =>
                      update("primaryDiscipline", e.target.value as Discipline | "")
                    }
                    className={inputClass}
                  >
                    <option value="">— wählen —</option>
                    {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => (
                      <option key={d} value={d}>
                        {DISCIPLINE_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Trainingslevel">
                  <select
                    value={form.level}
                    onChange={(e) =>
                      update("level", e.target.value as AthleteLevel | "")
                    }
                    className={inputClass}
                  >
                    <option value="">— wählen —</option>
                    {(Object.keys(ATHLETE_LEVEL_LABEL) as AthleteLevel[]).map((l) => (
                      <option key={l} value={l}>
                        {ATHLETE_LEVEL_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Trainingsbeginn"
                  hint={trainingYears ? `Du trainierst seit ${trainingYears}.` : undefined}
                >
                  <input
                    type="date"
                    value={form.trainingStartDate}
                    onChange={(e) => update("trainingStartDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                {form.primaryDiscipline === "bjj" && (
                  <Field label="BJJ-Gurt">
                    <select
                      value={form.bjjBelt}
                      onChange={(e) => update("bjjBelt", e.target.value as BjjBelt | "")}
                      className={inputClass}
                    >
                      <option value="">— wählen —</option>
                      {(Object.keys(BJJ_BELT_LABEL) as BjjBelt[]).map((b) => (
                        <option key={b} value={b}>
                          {BJJ_BELT_LABEL[b]}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </Section>

              <Section title="Körperdaten">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Gewicht (kg)">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="250"
                      value={form.weightKg}
                      onChange={(e) => update("weightKg", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Größe (cm)">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="250"
                      value={form.heightCm}
                      onChange={(e) => update("heightCm", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Reichweite (cm)">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="250"
                      value={form.reachCm}
                      onChange={(e) => update("reachCm", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Auslage">
                    <select
                      value={form.stance}
                      onChange={(e) =>
                        update("stance", e.target.value as FighterStance | "")
                      }
                      className={inputClass}
                    >
                      <option value="">— wählen —</option>
                      {(
                        Object.keys(FIGHTER_STANCE_LABEL) as FighterStance[]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {FIGHTER_STANCE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Gewichtsklasse">
                  <div className="space-y-2">
                    <div className="flex gap-3 text-xs">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={form.weightClassMode === "auto"}
                          onChange={() => update("weightClassMode", "auto")}
                        />
                        Automatisch (aus Gewicht)
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={form.weightClassMode === "manual"}
                          onChange={() => update("weightClassMode", "manual")}
                        />
                        Selbst wählen
                      </label>
                    </div>
                    {form.weightClassMode === "auto" ? (
                      <div className="rounded-sm border border-carbon-500 bg-carbon-800 px-3 py-2 text-sm">
                        {autoWeightClass ? (
                          <span className="text-blood">
                            {WEIGHT_CLASS_LABEL[autoWeightClass]}
                          </span>
                        ) : (
                          <span className="text-foreground/50">
                            Trag dein Gewicht ein, dann wird die Klasse automatisch
                            ermittelt.
                          </span>
                        )}
                      </div>
                    ) : (
                      <select
                        value={form.weightClass}
                        onChange={(e) =>
                          update("weightClass", e.target.value as WeightClass | "")
                        }
                        className={inputClass}
                      >
                        <option value="">— wählen —</option>
                        {(Object.keys(WEIGHT_CLASS_LABEL) as WeightClass[]).map(
                          (w) => (
                            <option key={w} value={w}>
                              {WEIGHT_CLASS_LABEL[w]}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                </Field>
              </Section>

              <Section title="Gym & Coach">
                <Field label="Gym / Verein">
                  <input
                    type="text"
                    maxLength={60}
                    value={form.gymName}
                    onChange={(e) => update("gymName", e.target.value)}
                    placeholder="z. B. Iron Fight Club"
                    className={inputClass}
                  />
                </Field>
                <Field label="Hauptcoach">
                  <input
                    type="text"
                    maxLength={60}
                    value={form.trainerName}
                    onChange={(e) => update("trainerName", e.target.value)}
                    placeholder="z. B. Coach Mike"
                    className={inputClass}
                  />
                </Field>
              </Section>

              <Section title="Nächster Wettkampf">
                <Field label="Datum">
                  <input
                    type="date"
                    value={form.nextCompetitionDate}
                    onChange={(e) => update("nextCompetitionDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Event-Name (optional)">
                  <input
                    type="text"
                    maxLength={80}
                    value={form.nextCompetitionName}
                    onChange={(e) => update("nextCompetitionName", e.target.value)}
                    placeholder="z. B. Bavarian Open"
                    className={inputClass}
                  />
                </Field>
              </Section>

              {/* Save Athlete */}
              <div className="mt-8">
                {athleteError && (
                  <div className="mb-3 rounded-sm border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
                    {athleteError}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={savingAthlete}
                    className="btn-primary disabled:opacity-50"
                  >
                    {savingAthlete ? "Speichere…" : "Athleten-Profil speichern"}
                  </button>
                  {athleteSaved && (
                    <span className="text-xs uppercase tracking-widest text-green-400">
                      Gespeichert ✓
                    </span>
                  )}
                </div>
              </div>
            </form>

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
