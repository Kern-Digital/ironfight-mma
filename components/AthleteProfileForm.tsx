"use client";

/**
 * Editierbares Athleten-Profil (Basics, Körperdaten, Gym & Coach, nächster
 * Wettkampf) — aus der Account-Seite extrahiert und Teil des Kampfprofils
 * (/kampfprofil). Schreibt nach users/{uid}.athlete.
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
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

// ─── Hilfs-Komponenten (gleiche Optik wie die Account-Seite) ───────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 first:mt-0">
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

// ─── Komponente ────────────────────────────────────────────────────────────

export default function AthleteProfileForm() {
  const { user, profile, refreshProfile } = useAuth();

  const [form, setForm] = useState<AthleteForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromAthlete(profile?.athlete));
  }, [profile?.athlete]);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await updateAthleteProfile(user.uid, patchFromForm(form));
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof AthleteForm>(key: K, value: AthleteForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={handleSave}>
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
            onChange={(e) => update("level", e.target.value as AthleteLevel | "")}
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
              {(Object.keys(FIGHTER_STANCE_LABEL) as FighterStance[]).map((s) => (
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
                {(Object.keys(WEIGHT_CLASS_LABEL) as WeightClass[]).map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_CLASS_LABEL[w]}
                  </option>
                ))}
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

      <div className="mt-8">
        {error && (
          <div className="mb-3 rounded-sm border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Speichere…" : "Athleten-Profil speichern"}
          </button>
          {saved && (
            <span className="text-xs uppercase tracking-widest text-green-400">
              Gespeichert ✓
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
