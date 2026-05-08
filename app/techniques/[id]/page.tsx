import PageHeader from "@/components/PageHeader";
import { TechniqueViewTracker } from "@/components/TechniqueViewTracker";
import {
  ALL_TECHNIQUES,
  CATEGORY_LABEL,
  getTechniqueById,
  youtubeSearchUrl,
} from "@/lib/techniques";
import { EQUIPMENT } from "@/lib/equipment";
import {
  DIFFICULTY_LABEL,
  DISCIPLINE_LABEL,
  TRAINING_AREA_LABEL,
  TECHNIQUE_ROLE_LABEL,
  TECHNIQUE_LEVEL_LABEL,
} from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return ALL_TECHNIQUES.map((t) => ({ id: t.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const t = getTechniqueById(params.id);
  if (!t) return { title: "Technik nicht gefunden — Tidal Athletics" };
  return {
    title: `${t.name} — Tidal Athletics Techniken`,
    description: t.description,
  };
}

export default function TechniqueDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTechniqueById(params.id);
  if (!t) notFound();

  const related = (t.relatedTechniqueIds ?? [])
    .map((id) => getTechniqueById(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const next = t.nextTechniqueId ? getTechniqueById(t.nextTechniqueId) : null;

  const trainingAreas = t.trainingArea
    ? Array.isArray(t.trainingArea)
      ? t.trainingArea
      : [t.trainingArea]
    : [];

  return (
    <>
      <TechniqueViewTracker techniqueId={t.id} />
      <PageHeader
        eyebrow={`${CATEGORY_LABEL[t.category]} · ${DIFFICULTY_LABEL[t.difficulty]}`}
        title={t.name}
        description={t.description}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-8">

        {/* Meta-Tags: disciplines, trainingArea, role, level, alternativeNames */}
        {(t.disciplines?.length ||
          trainingAreas.length ||
          t.role ||
          t.level ||
          t.alternativeNames?.length) ? (
          <div className="space-y-3">
            {/* Disciplines + TrainingArea tags */}
            {(t.disciplines?.length || trainingAreas.length) ? (
              <div className="flex flex-wrap gap-2">
                {t.disciplines?.map((d) => (
                  <span
                    key={d}
                    className="rounded-sm border border-blood/40 bg-blood/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blood"
                  >
                    {DISCIPLINE_LABEL[d]}
                  </span>
                ))}
                {trainingAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground/70"
                  >
                    {TRAINING_AREA_LABEL[area]}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Role + Level */}
            {(t.role || t.level) ? (
              <div className="flex flex-wrap gap-2">
                {t.role && (
                  <span className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground/80">
                    {TECHNIQUE_ROLE_LABEL[t.role]}
                  </span>
                )}
                {t.level && (
                  <span className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground/80">
                    {TECHNIQUE_LEVEL_LABEL[t.level]}
                  </span>
                )}
              </div>
            ) : null}

            {/* Alternative Namen */}
            {t.alternativeNames?.length ? (
              <p className="text-xs text-foreground/50">
                <span className="font-bold uppercase tracking-widest">Auch bekannt als:</span>{" "}
                {t.alternativeNames.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Video / Animation Slot */}
        <div className="card">
          <div className="text-xs font-bold uppercase tracking-widest text-blood">
            Visuell
          </div>
          {t.video ? (
            <div className="mt-3">
              <div className="aspect-video overflow-hidden rounded-sm border border-carbon-500 bg-black">
                <iframe
                  className="h-full w-full"
                  src={t.video.url}
                  title={t.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="mt-2 text-xs text-foreground/60">
                Quelle: {t.video.source}
                {t.video.attribution && ` · ${t.video.attribution}`} ·{" "}
                {t.video.license}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-dashed border-carbon-400 bg-carbon-800/40 p-6 text-center">
              <p className="text-sm text-foreground/70">
                Für diese Technik ist noch kein lizenzgeprüftes Video hinterlegt.
                Wir nehmen lieber kein Video als ein falsches.
              </p>
              <a
                href={youtubeSearchUrl(t)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-bold uppercase tracking-widest text-blood hover:underline"
              >
                YouTube-Suche öffnen →
              </a>
            </div>
          )}
        </div>

        {/* Schritt-für-Schritt */}
        <div className="card">
          <h2 className="heading-display text-2xl font-black">Schritt für Schritt</h2>
          <ol className="mt-4 space-y-3">
            {t.steps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="font-display text-2xl font-black text-blood leading-none">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <p className="text-sm text-foreground/85">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Coaching-Hinweise */}
        {t.coachingCues?.length ? (
          <div className="card">
            <h2 className="heading-display text-2xl font-black">Coaching-Hinweise</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {t.coachingCues.map((cue) => (
                <li key={cue} className="flex gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Typische Fehler */}
        <div className="card">
          <h2 className="heading-display text-2xl font-black">Typische Fehler</h2>
          <ul className="mt-4 space-y-2 text-sm text-foreground/85">
            {t.commonMistakes.map((m) => (
              <li key={m} className="flex gap-2">
                <span className="text-blood">⚠</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sicherheitshinweise */}
        {t.safetyNotes?.length ? (
          <div className="card border-yellow-500/30 bg-yellow-500/5">
            <h2 className="heading-display text-2xl font-black text-yellow-300">
              Sicherheitshinweise
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {t.safetyNotes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="text-yellow-400">⚠</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Anwendung / Einsatzbereich */}
        <div className="card">
          <h2 className="heading-display text-2xl font-black">Einsatzbereich</h2>
          <p className="mt-3 text-sm text-foreground/85">{t.usage}</p>
          {t.useCases?.length ? (
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {t.useCases.map((uc) => (
                <li key={uc} className="flex gap-2">
                  <span className="text-blood">›</span>
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Equipment */}
        {t.equipment.length > 0 && (
          <div className="card">
            <h2 className="heading-display text-2xl font-black">Empfohlenes Equipment</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.equipment.map((eq) => {
                const def = EQUIPMENT[eq];
                if (!def) return null;
                return (
                  <span
                    key={eq}
                    className="inline-flex items-center gap-2 rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                  >
                    <span>{def.icon}</span>
                    <span>{def.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Verwandte Techniken */}
        {(related.length > 0 || next) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {next && (
              <Link
                href={`/techniques/${next.id}`}
                className="card hover:border-blood/60"
              >
                <div className="text-xs font-bold uppercase tracking-widest text-blood">
                  Nächster Schritt
                </div>
                <div className="heading-display mt-2 text-xl font-black">
                  {next.name} →
                </div>
                <div className="mt-1 text-xs uppercase tracking-widest text-foreground/60">
                  {DIFFICULTY_LABEL[next.difficulty]}
                </div>
              </Link>
            )}
            {related.length > 0 && (
              <div className="card">
                <div className="text-xs font-bold uppercase tracking-widest text-blood">
                  Verwandt
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/techniques/${r.id}`}
                        className="text-foreground/80 hover:text-blood"
                      >
                        {r.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="text-center">
          <Link
            href="/techniques"
            className="text-xs font-bold uppercase tracking-widest text-foreground/60 hover:text-blood"
          >
            ← Zur Technikbibliothek
          </Link>
        </div>
      </div>
    </>
  );
}
