"use client";

import { getTechniqueById, youtubeSearchUrl, CATEGORY_LABEL } from "@/lib/techniques";
import {
  DIFFICULTY_LABEL,
  DISCIPLINE_LABEL,
  TRAINING_AREA_LABEL,
  TECHNIQUE_ROLE_LABEL,
  TECHNIQUE_LEVEL_LABEL,
} from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

interface TechniqueInlinePanelProps {
  id: string;          // for aria-controls
  techniqueId: string;
}

export default function TechniqueInlinePanel({
  id,
  techniqueId,
}: TechniqueInlinePanelProps) {
  const technique = getTechniqueById(techniqueId);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [mistakesExpanded, setMistakesExpanded] = useState(false);

  if (!technique) {
    return (
      <div
        id={id}
        role="region"
        className="mt-2 rounded-sm border border-carbon-500 bg-carbon-800/60 px-4 py-3 text-xs text-foreground/50"
      >
        Technik nicht gefunden.
      </div>
    );
  }

  const t = technique;

  const trainingAreas = t.trainingArea
    ? Array.isArray(t.trainingArea)
      ? t.trainingArea
      : [t.trainingArea]
    : [];

  const STEPS_PREVIEW = 3;
  const MISTAKES_PREVIEW = 3;
  const CUES_PREVIEW = 3;

  const showStepsToggle = t.steps.length > 4;
  const visibleSteps = showStepsToggle && !stepsExpanded
    ? t.steps.slice(0, STEPS_PREVIEW)
    : t.steps;

  const visibleMistakes = !mistakesExpanded
    ? t.commonMistakes.slice(0, MISTAKES_PREVIEW)
    : t.commonMistakes;
  const showMistakesToggle = t.commonMistakes.length > MISTAKES_PREVIEW;

  const visibleCues = t.coachingCues?.slice(0, CUES_PREVIEW) ?? [];

  const relatedTechniques = (t.relatedTechniqueIds ?? [])
    .map((rid) => getTechniqueById(rid))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div
      id={id}
      role="region"
      className="mt-2 rounded-sm border border-carbon-500 bg-carbon-800/60 p-4 space-y-4 text-sm"
    >
      {/* Header */}
      <div>
        <h4 className="heading-display text-lg font-black">{t.name}</h4>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-sm border border-blood/40 bg-blood/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blood">
            {CATEGORY_LABEL[t.category]}
          </span>
          {t.disciplines?.slice(0, 2).map((d) => (
            <span
              key={d}
              className="rounded-sm border border-blood/30 bg-blood/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blood/80"
            >
              {DISCIPLINE_LABEL[d]}
            </span>
          ))}
          {trainingAreas.slice(0, 2).map((area) => (
            <span
              key={area}
              className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60"
            >
              {TRAINING_AREA_LABEL[area]}
            </span>
          ))}
          {t.role && (
            <span className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
              {TECHNIQUE_ROLE_LABEL[t.role]}
            </span>
          )}
          {t.level ? (
            <span className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
              {TECHNIQUE_LEVEL_LABEL[t.level]}
            </span>
          ) : (
            <span className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
              {DIFFICULTY_LABEL[t.difficulty]}
            </span>
          )}
        </div>

        {/* Short description */}
        <p className="mt-2 text-xs text-foreground/70 leading-relaxed">
          {t.description}
        </p>
      </div>

      {/* Steps */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-blood mb-2">
          Schritt für Schritt
        </div>
        <ol className="space-y-1.5">
          {visibleSteps.map((step, idx) => (
            <li key={idx} className="flex gap-2 text-xs text-foreground/80">
              <span className="font-display font-black text-blood shrink-0 w-4">
                {idx + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {showStepsToggle && (
          <button
            onClick={() => setStepsExpanded((p) => !p)}
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-foreground/50 hover:text-blood"
          >
            {stepsExpanded
              ? "Weniger anzeigen ▴"
              : `+${t.steps.length - STEPS_PREVIEW} weitere Schritte ▾`}
          </button>
        )}
      </div>

      {/* Common Mistakes */}
      {t.commonMistakes.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-blood mb-2">
            Typische Fehler
          </div>
          <ul className="space-y-1">
            {visibleMistakes.map((m) => (
              <li key={m} className="flex gap-2 text-xs text-foreground/75">
                <span className="text-blood shrink-0">⚠</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
          {showMistakesToggle && (
            <button
              onClick={() => setMistakesExpanded((p) => !p)}
              className="mt-2 text-[10px] font-bold uppercase tracking-widest text-foreground/50 hover:text-blood"
            >
              {mistakesExpanded
                ? "Weniger anzeigen ▴"
                : `+${t.commonMistakes.length - MISTAKES_PREVIEW} weitere ▾`}
            </button>
          )}
        </div>
      )}

      {/* Coaching Cues */}
      {visibleCues.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-2">
            Coaching-Hinweise
          </div>
          <ul className="space-y-1">
            {visibleCues.map((cue) => (
              <li key={cue} className="flex gap-2 text-xs text-foreground/75">
                <span className="text-green-400 shrink-0">✓</span>
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Safety Notes */}
      {t.safetyNotes?.length ? (
        <div className="rounded-sm border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 mb-1.5">
            Sicherheit
          </div>
          <ul className="space-y-1">
            {t.safetyNotes.map((note) => (
              <li key={note} className="flex gap-2 text-xs text-foreground/75">
                <span className="text-yellow-400 shrink-0">⚠</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Video */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-blood mb-2">
          Video
        </div>
        {t.video ? (
          <div className="aspect-video overflow-hidden rounded-sm border border-carbon-500 bg-black">
            <iframe
              className="h-full w-full"
              src={t.video.url}
              title={t.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-sm border border-dashed border-carbon-400 bg-carbon-800/40 px-3 py-2">
            <p className="text-xs text-foreground/50 flex-1">
              Kein lizenzgeprüftes Video vorhanden.
            </p>
            <a
              href={youtubeSearchUrl(t)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-blood hover:underline"
            >
              YouTube →
            </a>
          </div>
        )}
      </div>

      {/* Related Techniques */}
      {relatedTechniques.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-blood mb-2">
            Verwandte Techniken
          </div>
          <div className="flex flex-wrap gap-1.5">
            {relatedTechniques.map((r) => (
              <Link
                key={r.id}
                href={`/techniques/${r.id}`}
                target="_blank"
                className="rounded-sm border border-carbon-400 bg-carbon-700/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground/70 hover:border-blood/60 hover:text-blood transition-colors"
              >
                {r.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="border-t border-carbon-500/60 pt-3 text-right">
        <Link
          href={`/techniques/${techniqueId}`}
          target="_blank"
          className="text-[10px] font-bold uppercase tracking-widest text-blood hover:underline"
        >
          Vollständige Technikseite →
        </Link>
      </div>
    </div>
  );
}
