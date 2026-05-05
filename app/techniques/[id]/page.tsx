import PageHeader from "@/components/PageHeader";
import {
  ALL_TECHNIQUES,
  CATEGORY_LABEL,
  getTechniqueById,
  youtubeSearchUrl,
} from "@/lib/techniques";
import { EQUIPMENT } from "@/lib/equipment";
import { DIFFICULTY_LABEL } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return ALL_TECHNIQUES.map((t) => ({ id: t.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const t = getTechniqueById(params.id);
  if (!t) return { title: "Technik nicht gefunden — IronFight" };
  return {
    title: `${t.name} — IronFight Techniken`,
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

  return (
    <>
      <PageHeader
        eyebrow={`${CATEGORY_LABEL[t.category]} · ${DIFFICULTY_LABEL[t.difficulty]}`}
        title={t.name}
        description={t.description}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-8">
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

        {/* Anwendung */}
        <div className="card">
          <h2 className="heading-display text-2xl font-black">Wann einsetzen?</h2>
          <p className="mt-3 text-sm text-foreground/85">{t.usage}</p>
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
