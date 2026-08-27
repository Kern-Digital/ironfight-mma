"use client";

/**
 * Editierbares Athleten-Profil (Basics, Körperdaten, Gym & Coach) — aus der
 * Account-Seite extrahiert und Teil des Kampfprofils (/kampfprofil).
 * Schreibt nach users/{uid}.athlete — seit 2026-08-22 AUTOMATISCH (debounced
 * 800 ms nach der letzten Änderung, kein Speichern-Button). Nach der ersten
 * eigenen Eingabe wird das Formular nie mehr aus dem Profil überschrieben,
 * damit der refreshProfile() nach dem Speichern keine laufende Eingabe
 * wegwirft.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import {
  ATHLETE_LEVEL_LABEL,
  BJJ_BELT_LABEL,
  DISCIPLINE_LABEL,
  FIGHTER_STANCE_LABEL,
  GENDER_LABEL,
  WEIGHT_CLASS_LABEL,
  type AthleteLevel,
  type AthleteProfile,
  type BjjBelt,
  type Discipline,
  type FighterStance,
  type Gender,
  type WeightClass,
  weightClassForKg,
} from "@/lib/types";
import { updateAthleteProfile } from "@/lib/user-profile";

// ─── Hilfs-Komponenten (neues Token-System, Muster: Referenzseiten) ────────

const STATUS_FONT: React.CSSProperties = {
  font: "600 11px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="t-label" style={{ color: "var(--accent-text)" }}>
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
      <span className="t-label">{label}</span>
      {hint && (
        <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {hint}
        </p>
      )}
      <div className="mt-2">{children}</div>
    </label>
  );
}

// Inputs/Selects: Fläche 1 Ebene über der Karte + Haarlinie, Touch ≥ 44px.
// Fokus-Ring kommt aus .t-interactive (focus-visible, Akzent-Outline).
const inputClass = "t-interactive w-full min-h-hit rounded-field px-3.5";
const inputStyle: React.CSSProperties = {
  font: "var(--type-body)",
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  outline: "none",
};

// ─── Form-State Helpers ────────────────────────────────────────────────────

type AthleteForm = {
  primaryDiscipline: Discipline | "";
  gender: Gender | "";
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
};

function emptyForm(): AthleteForm {
  return {
    primaryDiscipline: "",
    gender: "",
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
  f.gender = a.gender ?? "";
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
    gender: form.gender || null,
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
    // „Nächster Wettkampf" wurde 2026-08-21 aus dem Formular entfernt —
    // die Wettkampfplanung läuft über die Fight Camps des Trainers.
    // Die Felder fehlen hier bewusst: updateAthleteProfile lässt
    // nicht gepatchte Felder unangetastet (Bestandsdaten bleiben).
  };
}

// ─── Komponente ────────────────────────────────────────────────────────────

export default function AthleteProfileForm() {
  const { user, profile, refreshProfile } = useAuth();

  const [form, setForm] = useState<AthleteForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-Speichern: dirty = ungespeicherte Änderung (steuert den Debounce),
  // edited = je selbst editiert (stoppt den Profil→Form-Sync dauerhaft),
  // inFlight/pending serialisieren überlappende Speichervorgänge.
  const dirtyRef = useRef(false);
  const editedRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    // Nur solange synchronisieren, bis der User selbst etwas eingegeben hat —
    // danach ist das Formular die Quelle der Wahrheit (sonst würde der
    // refreshProfile() nach jedem Auto-Save laufende Eingaben überschreiben).
    if (editedRef.current) return;
    setForm(formFromAthlete(profile?.athlete));
  }, [profile?.athlete]);

  // Trainings-Dauer als lesbarer Hinweis-Satz (Dezimalkomma + korrekter
  // Dativ — „seit 1,4 Jahren", „seit 8 Monaten", „seit einem Jahr")
  const trainingHint = useMemo(() => {
    if (!form.trainingStartDate) return undefined;
    const start = new Date(form.trainingStartDate);
    if (Number.isNaN(start.getTime())) return undefined;
    const months = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 1) return "Frisch dabei — willkommen im Training.";
    if (months < 12) {
      const m = Math.round(months);
      return `Du trainierst seit ${m} ${m === 1 ? "Monat" : "Monaten"}.`;
    }
    const years = Math.round((months / 12) * 10) / 10;
    if (Number.isInteger(years)) {
      return `Du trainierst seit ${years === 1 ? "einem Jahr" : `${years} Jahren`}.`;
    }
    return `Du trainierst seit ${years.toLocaleString("de-DE")} Jahren.`;
  }, [form.trainingStartDate]);

  // Auto-Gewichtsklasse Vorschau
  const autoWeightClass = useMemo(() => {
    const kg = Number(form.weightKg);
    if (!form.weightKg || !Number.isFinite(kg) || kg <= 0) return null;
    return weightClassForKg(kg);
  }, [form.weightKg]);

  const persist = useCallback(async () => {
    if (!user) return;
    if (inFlightRef.current) {
      // Läuft schon ein Save, danach mit dem dann aktuellen Stand erneut
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    dirtyRef.current = false;
    setError(null);
    setSaving(true);
    try {
      await updateAthleteProfile(user.uid, patchFromForm(formRef.current));
      await refreshProfile();
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
  }, [user, refreshProfile]);

  // Debounce: 800 ms nach der letzten Änderung automatisch speichern
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => void persist(), 800);
    return () => clearTimeout(t);
  }, [form, persist]);

  // Flush beim Unmount: Wer innerhalb der Debounce-Zeit wegnavigiert, verlöre
  // sonst die letzte Eingabe (SPA-Navigation — der Firestore-Write läuft nach
  // dem Unmount normal weiter).
  useEffect(
    () => () => {
      if (dirtyRef.current) void persist();
    },
    [persist],
  );

  function update<K extends keyof AthleteForm>(key: K, value: AthleteForm[K]) {
    editedRef.current = true;
    dirtyRef.current = true;
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    // Mobil: eine Spalte; Desktop: Sektionen nebeneinander (linkslastige
    // Schmalspalte vermeiden), Gym & Coach + Fußzeile über volle Breite.
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10"
    >
      <Section title="Athleten-Basics">
        <Field label="Hauptdisziplin">
          <Select
            clearable
            value={form.primaryDiscipline}
            onChange={(v) => update("primaryDiscipline", v as Discipline | "")}
            options={[
              { value: "", label: "— wählen —" },
              ...(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => ({
                value: d,
                label: DISCIPLINE_LABEL[d],
              })),
            ]}
          />
        </Field>

        <Field label="Geschlecht">
          <div className="space-y-2">
            <Select
              clearable
              value={form.gender}
              onChange={(v) => update("gender", v as Gender | "")}
              options={[
                { value: "", label: "— wählen —" },
                ...(Object.keys(GENDER_LABEL) as Gender[]).map((g) => ({
                  value: g,
                  label: GENDER_LABEL[g],
                })),
              ]}
            />
            {/* Fehlende Angabe kostet Analyse-Qualität (Physis-Einordnung,
                Gegner-Vergleiche, Gewichtsklassen-Raster) — deshalb ein
                sichtbarer Hinweis, solange nichts gewählt ist. */}
            {!form.gender && (
              <div
                className="flex items-start gap-2 rounded-field px-3.5 py-2.5"
                style={{
                  font: "var(--type-sub)",
                  background: "color-mix(in oklab, var(--warning) 12%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
                  color: "var(--warning)",
                }}
              >
                <span className="mt-0.5 shrink-0">
                  <Icon name="warn" size={14} strokeWidth={2.2} />
                </span>
                Ohne Angabe kann die KI-Analyse Physis und Gegner-Vergleiche
                schlechter einordnen — mit Angabe werden deine Auswertungen
                präziser.
              </div>
            )}
          </div>
        </Field>

        <Field label="Trainingslevel">
          <Select
            clearable
            value={form.level}
            onChange={(v) => update("level", v as AthleteLevel | "")}
            options={[
              { value: "", label: "— wählen —" },
              ...(Object.keys(ATHLETE_LEVEL_LABEL) as AthleteLevel[]).map((l) => ({
                value: l,
                label: ATHLETE_LEVEL_LABEL[l],
              })),
            ]}
          />
        </Field>

        <Field label="Trainingsbeginn" hint={trainingHint}>
          <input
            type="date"
            value={form.trainingStartDate}
            onChange={(e) => update("trainingStartDate", e.target.value)}
            className={inputClass} style={inputStyle}
          />
        </Field>

        {form.primaryDiscipline === "bjj" && (
          <Field label="BJJ-Gurt">
            <Select
              clearable
              value={form.bjjBelt}
              onChange={(v) => update("bjjBelt", v as BjjBelt | "")}
              options={[
                { value: "", label: "— wählen —" },
                ...(Object.keys(BJJ_BELT_LABEL) as BjjBelt[]).map((b) => ({
                  value: b,
                  label: BJJ_BELT_LABEL[b],
                })),
              ]}
            />
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
              className={inputClass} style={inputStyle}
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
              className={inputClass} style={inputStyle}
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
              className={inputClass} style={inputStyle}
            />
          </Field>
          <Field label="Auslage">
            <Select
              clearable
              value={form.stance}
              onChange={(v) => update("stance", v as FighterStance | "")}
              options={[
                { value: "", label: "— wählen —" },
                ...(Object.keys(FIGHTER_STANCE_LABEL) as FighterStance[]).map(
                  (s) => ({ value: s, label: FIGHTER_STANCE_LABEL[s] }),
                ),
              ]}
            />
          </Field>
        </div>

        <Field label="Gewichtsklasse">
          <div className="space-y-2">
            <div
              className="flex flex-wrap gap-x-4 gap-y-1"
              style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
            >
              <label className="flex min-h-hit items-center gap-1.5">
                <input
                  type="radio"
                  style={{ accentColor: "var(--accent)" }}
                  checked={form.weightClassMode === "auto"}
                  onChange={() => update("weightClassMode", "auto")}
                />
                Automatisch (aus Gewicht)
              </label>
              <label className="flex min-h-hit items-center gap-1.5">
                <input
                  type="radio"
                  style={{ accentColor: "var(--accent)" }}
                  checked={form.weightClassMode === "manual"}
                  onChange={() => update("weightClassMode", "manual")}
                />
                Selbst wählen
              </label>
            </div>
            {form.weightClassMode === "auto" ? (
              <div
                className="flex min-h-hit items-center rounded-field px-3.5"
                style={{
                  font: "var(--type-body)",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                }}
              >
                {autoWeightClass ? (
                  <span style={{ color: "var(--accent-text)" }}>
                    {WEIGHT_CLASS_LABEL[autoWeightClass]}
                  </span>
                ) : (
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    Trag dein Gewicht ein, dann wird die Klasse automatisch
                    ermittelt.
                  </span>
                )}
              </div>
            ) : (
              <Select
                clearable
                value={form.weightClass}
                onChange={(v) => update("weightClass", v as WeightClass | "")}
                options={[
                  { value: "", label: "— wählen —" },
                  ...(Object.keys(WEIGHT_CLASS_LABEL) as WeightClass[]).map(
                    (w) => ({ value: w, label: WEIGHT_CLASS_LABEL[w] }),
                  ),
                ]}
              />
            )}
          </div>
        </Field>
      </Section>

      <Section title="Gym & Coach" className="lg:col-span-2">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-10">
          <Field label="Gym / Verein">
            <input
              type="text"
              maxLength={60}
              value={form.gymName}
              onChange={(e) => update("gymName", e.target.value)}
              placeholder="z. B. Iron Fight Club"
              className={inputClass} style={inputStyle}
            />
          </Field>
          <Field label="Hauptcoach">
            <input
              type="text"
              maxLength={60}
              value={form.trainerName}
              onChange={(e) => update("trainerName", e.target.value)}
              placeholder="z. B. Coach Mike"
              className={inputClass} style={inputStyle}
            />
          </Field>
        </div>
      </Section>

      <div className="lg:col-span-2">
        {error && (
          <div
            className="mb-3 rounded-field px-3.5 py-2.5"
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
    </form>
  );
}
