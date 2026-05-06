import PageHeader from "@/components/PageHeader";
import { getPlanBySlug, TRAINING_PLANS } from "@/lib/training-plans";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return TRAINING_PLANS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const plan = getPlanBySlug(params.slug);
  if (!plan) return { title: "Plan nicht gefunden — Tidal Athletics" };
  return {
    title: `${plan.name} Plan — Tidal Athletics`,
    description: plan.description,
  };
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

export default function TrainingPlanPage({
  params,
}: {
  params: { slug: string };
}) {
  const plan = getPlanBySlug(params.slug);
  if (!plan) notFound();

  const totalExercises = plan.blocks.reduce(
    (sum, b) => sum + b.exercises.length,
    0,
  );

  const timerHref = `/timer?rounds=${plan.preset.rounds}&work=${plan.preset.workSeconds}&rest=${plan.preset.restSeconds}&prep=${plan.preset.prepSeconds}&label=${encodeURIComponent(plan.name)}`;

  return (
    <>
      <PageHeader
        eyebrow={`${plan.tag} · ${plan.level}`}
        title={plan.name}
        description={plan.description}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="card mb-10">
          <div className="grid gap-6 sm:grid-cols-4">
            <Stat label="Runden" value={`${plan.preset.rounds}×`} />
            <Stat label="Kampfzeit" value={formatDuration(plan.preset.workSeconds)} />
            <Stat label="Pause" value={formatDuration(plan.preset.restSeconds)} />
            <Stat label="Übungen" value={String(totalExercises)} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={timerHref} className="btn-primary">
              Workout starten
            </Link>
            <Link href="/workout/generator" className="btn-secondary">
              Andere Disziplin
            </Link>
          </div>
        </div>

        <div className="space-y-10">
          {plan.blocks.map((block, idx) => (
            <section key={block.title}>
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-display text-3xl font-black text-blood">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h2 className="heading-display text-2xl font-black">
                  {block.title}
                </h2>
              </div>
              <div className="space-y-2">
                {block.exercises.map((ex) => (
                  <div
                    key={ex.name}
                    className="flex flex-col gap-2 rounded-sm border border-carbon-500 bg-carbon-700/60 p-4 transition-colors hover:border-blood/40 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <div className="flex-1">
                      <div className="font-bold">{ex.name}</div>
                      {ex.notes && (
                        <div className="mt-1 text-sm text-foreground/60">
                          {ex.notes}
                        </div>
                      )}
                    </div>
                    <div className="rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-blood sm:flex-shrink-0">
                      {ex.format}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
        {label}
      </div>
      <div className="font-display mt-1 text-2xl font-black text-blood sm:text-3xl">
        {value}
      </div>
    </div>
  );
}
