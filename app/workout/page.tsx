"use client";

/**
 * Workout-Detail (?payload=…) — Wiedereinstiegs-Ansicht eines laufenden
 * Workouts im selben Aufbau wie die Plan-Seite (PlanView). Das Payload ist
 * seit der Runner-Umstellung das Plan-JSON selbst (parseSessionPayload hebt
 * alte WorkoutDefinition-Payloads beim Einlesen); Alt-Links mit der id
 * „plan-<slug>" lösen weiter auf den echten Start-Plan auf. Der alte
 * Timer-Runner dieser Route ist ersatzlos raus (Leon 2026-08-27) — geführt
 * trainiert wird nur noch in /workout/session; „Workout starten" hier
 * steigt mit dem unveränderten Payload wieder ein.
 */

import Icon from "@/components/ui/Icon";
import { getDefaultPlanBySlug } from "@/lib/workout-plan-defaults";
import { parseSessionPayload } from "@/lib/workout-plans";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import PlanView from "./plans/[slug]/PlanView";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function WorkoutDetail() {
  const params = useSearchParams();
  const raw = params.get("payload");
  const plan = useMemo(() => {
    const parsed = parseSessionPayload(raw);
    if (!parsed) return null;
    // Alt-Link auf einen Start-Plan (die frühere Brücke setzte die id
    // „plan-<slug>") → echten Plan mit voller Beschreibung zeigen
    if (parsed.id.startsWith("plan-")) {
      return getDefaultPlanBySlug(parsed.id.slice("plan-".length)) ?? parsed;
    }
    return parsed;
  }, [raw]);

  if (!plan) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 pt-16 lg:px-6">
          <h1
            style={{
              font: "var(--type-h2)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            Kein Workout geladen
          </h1>
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Diese Ansicht zeigt die Details eines laufenden Workouts. Starte
            eins über den Workout-Hub.
          </p>
          <Link data-press
            href="/workout/generator"
            className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            <Icon name="arrow-left" size={13} strokeWidth={2.2} />
            Zum Workout-Hub
          </Link>
        </div>
      </main>
    );
  }

  // Generierte Workouts führen zurück zum Generator, Pläne in ihre
  // Disziplin-Navigation (PlanView-Default)
  if (plan.gymId === "generated") {
    return (
      <PlanView
        plan={plan}
        sessionPayload={raw ?? undefined}
        backHref="/workout/generator"
        backLabel="Workout"
      />
    );
  }
  return <PlanView plan={plan} sessionPayload={raw ?? undefined} />;
}

export default function WorkoutDetailPage() {
  // useSearchParams braucht die Suspense-Grenze (Next-App-Router)
  return (
    <Suspense fallback={null}>
      <WorkoutDetail />
    </Suspense>
  );
}
