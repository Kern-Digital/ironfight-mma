"use client";

/**
 * Technik-Detail — Client-Ansicht (Redesign-Etappe 5, Rollout).
 * Formensprache der Referenzseiten: Kopf mit Ambient + Rubrik-Schein
 * (Muster Disziplin-Seite), Abschnitte im Muster des Technik-Popups aus
 * dem ExerciseDetailSheet (nummerierte Schritte, Check-/X-Listen),
 * Athleten-Shell (Tab-Bar, Training aktiv); Trainer behalten die Navbar.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import { TechniqueViewTracker } from "@/components/TechniqueViewTracker";
import { useHasStaffShell } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  CATEGORY_LABEL,
  getTechniqueById,
  youtubeSearchUrl,
} from "@/lib/techniques";
import { EQUIPMENT } from "@/lib/equipment";
import { CATEGORY_COLOR, DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import {
  DIFFICULTY_LABEL,
  DISCIPLINE_LABEL,
  TECHNIQUE_LEVEL_LABEL,
  type Technique,
} from "@/lib/types";
import Link from "next/link";

// ─── Typo-Konstanten (Muster der Referenzseiten) ──────────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** Level als TEXT — granulares Feld hat Vorrang (nie farbcodiert) */
function levelLabel(t: Technique): string {
  return t.level
    ? TECHNIQUE_LEVEL_LABEL[t.level] ?? DIFFICULTY_LABEL[t.difficulty]
    : DIFFICULTY_LABEL[t.difficulty];
}

/** Abschnitts-Überschrift — bewusst groß (Leon 2026-08-29: lesbarer) */
function SectionTitle({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <h2
      style={{
        font: "var(--type-h2)",
        letterSpacing: "var(--ls-display)",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </h2>
  );
}

// ─── Ansicht ──────────────────────────────────────────────────────────────────

export default function TechniqueDetailView({ id }: { id: string }) {
  
  const { theme, toggleTheme } = useTheme();
  // Wer eines der drei Häkchen trägt, steht in der Stab-Hülle: Die bringt
  // Menü und Bottom-Bar selbst mit, der Hell/Dunkel-Umschalter sitzt in ihrer
  // Fußgruppe. Diese Seite lässt ihre eigenen Entsprechungen dann weg.
  const hasStaffShell = useHasStaffShell();

  // Existenz ist serverseitig geprüft (page.tsx → notFound)
  const t = getTechniqueById(id);
  if (!t) return null;

  const related = (t.relatedTechniqueIds ?? [])
    .map((rid) => getTechniqueById(rid))
    .filter((x): x is Technique => Boolean(x));
  const next = t.nextTechniqueId ? getTechniqueById(t.nextTechniqueId) : null;

  // Bodyweight ist keine Geräte-Empfehlung — Chip entfällt
  const gear = t.equipment.filter((eq) => eq !== "bodyweight");

  return (
    <main
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <TechniqueViewTracker techniqueId={t.id} />

      {/* ── Kopf — Muster der Disziplin-Seite (Ambient + Rubrik-Schein) ── */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
          <div data-ambient>
            <span
              data-glow
              style={{
                left: "-12%",
                top: "-30%",
                width: "55%",
                height: "160%",
                background: `color-mix(in oklab, ${CATEGORY_COLOR[t.category]} var(--cat-glow-mix), transparent)`,
              }}
            />
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link data-press
              href="/techniques"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{ ...BTN_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Techniken
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {t.name}
            </h1>
            {/* Rubrik-Meta als Text: Level nie farbcodiert */}
            <span style={{ ...META_FONT, color: "var(--text-2)" }}>
              {levelLabel(t)} · {CATEGORY_LABEL[t.category]}
            </span>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {t.description}
            </p>
          </div>
          {!hasStaffShell && (
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-4 lg:px-6 lg:pt-5">
        {/* ── Einordnung — nur Disziplinen (farbig) + Alternativnamen;
            Trainingsbereich und Rolle bewusst raus (Leon 2026-08-29:
            Curriculum-Vokabular, für Athleten ohne Nutzwert) ── */}
        {(t.disciplines?.length || t.alternativeNames?.length) ? (
          <div className="flex flex-col gap-2">
            {t.disciplines?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {/* Rubrik-Farbe wie überall in der App (lib/discipline-colors.ts) */}
                {t.disciplines.map((d) => (
                  <span
                    key={d}
                    className="rounded-badge px-2 py-1"
                    style={{
                      ...META_FONT,
                      color: DISCIPLINE_COLOR[d],
                      border: `1px solid color-mix(in oklab, ${DISCIPLINE_COLOR[d]} 40%, transparent)`,
                      background: `color-mix(in oklab, ${DISCIPLINE_COLOR[d]} 10%, transparent)`,
                    }}
                  >
                    {DISCIPLINE_LABEL[d]}
                  </span>
                ))}
              </div>
            ) : null}
            {t.alternativeNames?.length ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Auch bekannt als: {t.alternativeNames.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ── Video ── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Video</SectionTitle>
          {t.video ? (
            <div className="flex flex-col gap-2">
              <div
                className="aspect-video overflow-hidden rounded-card"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                }}
              >
                <iframe
                  className="h-full w-full"
                  src={t.video.url}
                  title={t.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Quelle: {t.video.source}
                {t.video.attribution && ` · ${t.video.attribution}`} ·{" "}
                {t.video.license}
              </p>
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-3 rounded-card p-6 text-center"
              style={{ border: "1px dashed var(--line-strong)" }}
            >
              <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                Für diese Technik ist noch kein lizenzgeprüftes Video
                hinterlegt. Wir nehmen lieber kein Video als ein falsches.
              </p>
              <a
                href={youtubeSearchUrl(t)}
                target="_blank"
                rel="noopener noreferrer"
                className="t-interactive inline-flex min-h-hit items-center gap-1.5 rounded-field px-4"
                style={{ ...BTN_FONT, color: "var(--accent-text)", textDecoration: "none" }}
              >
                YouTube-Suche öffnen
                <Icon name="arrow-right" size={14} strokeWidth={2.2} />
              </a>
            </div>
          )}
        </section>

        {/* ── Schritt für Schritt ── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Schritt für Schritt</SectionTitle>
          <ol className="flex flex-col gap-1.5">
            {t.steps.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-2.5"
                style={{ font: "var(--type-body)", color: "var(--text-2)" }}
              >
                <span
                  className="shrink-0 tabular-nums"
                  style={{
                    ...META_FONT,
                    color: "var(--accent-text)",
                    marginTop: "4px",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Sicherheitshinweise — direkt unter den Schritten (Leon
            2026-08-29) ── */}
        {t.safetyNotes?.length ? (
          <section
            className="flex flex-col gap-2 rounded-card p-4 sm:p-5"
            style={{
              border: "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
              background: "color-mix(in oklab, var(--warning) 8%, transparent)",
            }}
          >
            <SectionTitle color="var(--warning)">
              Sicherheitshinweise
            </SectionTitle>
            <ul className="flex flex-col gap-1.5">
              {t.safetyNotes.map((note) => (
                <li
                  key={note}
                  className="flex items-start gap-2"
                  style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                >
                  <span
                    className="mt-[3px] shrink-0"
                    style={{ color: "var(--warning)" }}
                  >
                    <Icon name="warn" size={14} strokeWidth={2.2} />
                  </span>
                  {note}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Coaching-Hinweise ── */}
        {t.coachingCues?.length ? (
          <section className="flex flex-col gap-2">
            <SectionTitle>Coaching-Hinweise</SectionTitle>
            <ul className="flex flex-col gap-1.5">
              {t.coachingCues.map((cue) => (
                <li
                  key={cue}
                  className="flex items-start gap-2"
                  style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                >
                  <span
                    className="mt-[3px] shrink-0"
                    style={{ color: "var(--accent-text)" }}
                  >
                    <Icon name="check" size={14} strokeWidth={2.6} />
                  </span>
                  {cue}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Typische Fehler ── */}
        {t.commonMistakes.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Typische Fehler</SectionTitle>
            <ul className="flex flex-col gap-1.5">
              {t.commonMistakes.map((m) => (
                <li
                  key={m}
                  className="flex items-start gap-2"
                  style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                >
                  <span
                    className="mt-[3px] shrink-0"
                    style={{ color: "var(--negative)" }}
                  >
                    <Icon name="x" size={14} strokeWidth={2.4} />
                  </span>
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Einsatzbereich ── */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Einsatzbereich</SectionTitle>
          <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
            {t.usage}
          </p>
          {t.useCases?.length ? (
            <ul className="flex flex-col gap-1.5">
              {t.useCases.map((uc) => (
                <li
                  key={uc}
                  className="flex items-start gap-2"
                  style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                >
                  <span
                    className="mt-[3px] shrink-0"
                    style={{ color: "var(--accent-text)" }}
                  >
                    <Icon name="arrow-right" size={14} strokeWidth={2.2} />
                  </span>
                  {uc}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* ── Equipment — „Keine Geräte" (bodyweight) wird nicht angezeigt
            (Leon 2026-08-29: als Empfehlung sinnlos) ── */}
        {gear.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Empfohlenes Equipment</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {gear.map((eq) => {
                const def = EQUIPMENT[eq];
                if (!def) return null;
                return (
                  <span
                    key={eq}
                    className="inline-flex items-center gap-2 rounded-badge px-2.5 py-1.5"
                    style={{
                      ...META_FONT,
                      background: "var(--surface-raised)",
                      border: "1px solid var(--line)",
                      color: "var(--text-2)",
                    }}
                  >
                    <Icon name={def.icon} size={14} />
                    {def.label}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Nächster Schritt / Verwandte Techniken ── */}
        {(related.length > 0 || next) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {next && (
              <Link data-press="surface"
                href={`/techniques/${next.id}`}
                className="t-card t-interactive flex items-center gap-3 p-4 sm:p-5"
                style={{ textDecoration: "none", color: "var(--text-body)" }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-label">Nächster Schritt</span>
                  <span
                    style={{
                      font: "var(--type-h3)",
                      letterSpacing: "var(--ls-display)",
                      textTransform: "uppercase",
                    }}
                  >
                    {next.name}
                  </span>
                  <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                    {levelLabel(next)}
                  </span>
                </div>
                <span
                  aria-hidden
                  className="shrink-0"
                  style={{ color: "var(--accent-text)", lineHeight: 0 }}
                >
                  <Icon name="arrow-right" size={18} strokeWidth={2} />
                </span>
              </Link>
            )}
            {related.length > 0 && (
              <div className="flex flex-col gap-1">
                <SectionTitle>Verwandt</SectionTitle>
                <div className="flex flex-col">
                  {related.map((r) => (
                    <Link data-press="quiet"
                      key={r.id}
                      href={`/techniques/${r.id}`}
                      className="t-interactive flex min-h-hit items-center justify-between gap-3 rounded-field px-2"
                      style={{
                        font: "var(--type-body-strong)",
                        color: "var(--text-2)",
                        textDecoration: "none",
                      }}
                    >
                      <span className="min-w-0 truncate">{r.name}</span>
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{ color: "var(--text-3)", lineHeight: 0 }}
                      >
                        <Icon name="arrow-right" size={16} strokeWidth={2} />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasStaffShell && <AthleteTabBar />}
    </main>
  );
}
