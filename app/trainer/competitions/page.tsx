"use client";

/**
 * Wettkampf-Übersicht — Rollout-Etappe 2a (04.09.2026).
 *
 * Umzug auf das neue Token-System: `.t-card`-Raster statt Ink-Verläufen, Typo
 * aus den `--type-*`-Tokens, Gooey-Suche statt nativem Suchfeld (dieselbe
 * Geste wie in der Athletenliste — eine Suche in zwei Ausführungen wäre eine
 * Suche zu viel). Der Kopf stand schon auf `PageHead`.
 *
 * ZWEI QUELLEN, EINE LISTE (Schritt 2b, 04.09.): `listAllFightCamps` liest
 * gym-weit nur Athleten-Camps und holt die eigenen sowie die freigegebenen
 * Kollegen-Camps einzeln dazu — deshalb hängt die Abfrage an der
 * Mitgliederliste, die die Freigaben trägt.
 */

import PageHead from "@/components/shell/PageHead";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TrainerHint from "@/components/TrainerHint";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { StaggerFlow, FlowItem } from "@/components/motion";
import CompetitionCard, {
  GROUP_ACCENT,
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
import { useAuth } from "@/lib/auth-context";
import { belongsToGym, resolveGymId } from "@/lib/gym";
import {
  campOpponentId,
  listAllFightCamps,
  type FightCamp,
} from "@/lib/fight-camp";
import { listOpponentsForGym, type Opponent } from "@/lib/opponents";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { werTeiltMitMir } from "@/lib/profile-sharing";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function studentLabelOf(entry: StudentEntry | undefined): string {
  if (!entry) return "Athlet";
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? "Athlet";
}

// ─── Gruppen-Sektion ─────────────────────────────────────────────────────────

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      {/* Die Gruppen-Überschrift trägt die Farbe der Gruppe — bei „Vergangen"
          und „Archiviert" ist das derselbe neutrale Ton (Begründung in
          CompetitionCard). */}
      <h2 className="t-label" style={{ color: accent }}>
        {title}
      </h2>
      {/* Die Suche filtert live — bleibende Karten rutschen zu ihrer neuen
          Rasterposition, statt zu springen (Muster Athletenliste). */}
      <StaggerFlow className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </StaggerFlow>
    </section>
  );
}

// ─── Hauptinhalt ─────────────────────────────────────────────────────────────

function CompetitionsHubContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";

  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  // Alle Mitglieder inkl. Trainer: auch Coaches treten als Athleten an.
  const [members, setMembers] = useState<Map<string, StudentEntry>>(new Map());
  // Verknüpfte DeepFight-Profile: die Karten zeigen den AKTUELLEN Scouting-Stand,
  // nicht nur den beim Anlegen eingefrorenen Snapshot.
  const [opponents, setOpponents] = useState<Map<string, Opponent>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Die Gegner-DNA lebt jetzt im eigenen Bereich — alte Links (?tab=dna) umleiten.
  useEffect(() => {
    if (searchParams.get("tab") === "dna") router.replace("/trainer/opponents");
  }, [searchParams, router]);

  const load = useCallback(async () => {
    setError(null);
    setCamps(null);
    try {
      // Die Camps hängen an der Mitgliederliste: Sie trägt die Freigaben, und
      // ohne sie wüsste die Abfrage nicht, welche Kollegen-Camps sie einzeln
      // holen darf (lib/fight-camp.ts, listAllFightCamps). Nur DIESE eine
      // Kette ist seriell — die Gegner laufen weiter nebenher.
      const memberP = listAllMembers(gymId).catch(() => [] as StudentEntry[]);
      const campP = memberP.then((liste) =>
        listAllFightCamps(gymId, {
          eigeneUid,
          freigegebeneUids: werTeiltMitMir(liste, "wettkampf", eigeneUid),
        }).catch(() => [] as FightCamp[]),
      );
      const [allCamps, memberList, gymOpponents] = await Promise.all([
        campP,
        memberP,
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
      ]);
      setCamps(allCamps.filter((c) => belongsToGym(c.gymId, gymId)));
      setMembers(new Map(memberList.map((s) => [s.uid, s])));
      setOpponents(new Map(gymOpponents.map((o) => [o.id, o])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setCamps([]);
    }
  }, [gymId, eigeneUid]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Wettkämpfe filtern + gruppieren ──
  const filteredCamps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = camps ?? [];
    if (!q) return list;
    return list.filter((c) => {
      const label = studentLabelOf(members.get(c.studentUid)).toLowerCase();
      return (
        c.competitionName.toLowerCase().includes(q) ||
        c.opponent.name.toLowerCase().includes(q) ||
        label.includes(q)
      );
    });
  }, [camps, search, members]);

  const grouped = useMemo(() => {
    const g = { upcoming: [] as FightCamp[], past: [] as FightCamp[], archived: [] as FightCamp[] };
    for (const c of filteredCamps) g[competitionGroup(c)].push(c);
    g.upcoming.sort((a, b) => a.competitionDate.getTime() - b.competitionDate.getTime());
    g.past.sort((a, b) => b.competitionDate.getTime() - a.competitionDate.getTime());
    g.archived.sort((a, b) => b.competitionDate.getTime() - a.competitionDate.getTime());
    return g;
  }, [filteredCamps]);

  // Eine Karte im fließenden Raster — der Schlüssel ist die Firestore-ID,
  // nie der Index, sonst hält Framer die falsche Karte für die gebliebene.
  const karte = (c: FightCamp, i: number) => (
    <FlowItem key={c.id} index={i}>
      <CompetitionCard
        camp={c}
        studentLabel={studentLabelOf(members.get(c.studentUid))}
        href={`/trainer/competitions/${c.studentUid}/${c.id}`}
        opponent={opponents.get(campOpponentId(c) ?? "")}
      />
    </FlowItem>
  );

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <PageHead
        lane="wide"
        title="Wettkampf"
        description="Jeder Wettkampf verbindet einen Athleten mit einem Gegner — von der Planung über das Camp bis zum Rückblick."
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-1 sm:px-6">
        <TrainerHint id="competitions-hub" title="Wettkampfbereich">
          Hier legst du Wettkämpfe an und verfolgst sie — jeder Wettkampf
          verbindet einen Athleten mit einem Gegner aus der
          DeepFight-Bibliothek und friert deren damaligen Stand ein. Die
          Bibliothek selbst findest du im Bereich &bdquo;DeepFight&ldquo;.
        </TrainerHint>

        {error && (
          <ErrorState
            title="Daten konnten nicht geladen werden"
            message={error}
            onRetry={load}
          />
        )}

        {/* Aktionsleiste — Knopf und Suche in EINER Reihe aus Pillen, wie in
            der Athletenliste. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/trainer/competitions/new"
            data-press
            className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            <Icon name="plus" size={13} strokeWidth={2.4} />
            Neuer Wettkampf
          </Link>

          <GooeySearch
            value={search}
            onChange={setSearch}
            label="Suchen"
            placeholder="Wettkampf, Gegner oder Athlet…"
          />
        </div>

        {/* Inhalt */}
        {camps === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : filteredCamps.length === 0 ? (
          <EmptyState
            title={search ? "Keine Wettkämpfe gefunden." : "Noch keine Wettkämpfe."}
            hint={
              search
                ? "Such nach einem anderen Namen oder leer die Suche."
                : "Leg deinen ersten Wettkampf an — wähle einen Athleten und einen Gegner."
            }
          />
        ) : (
          // Auch die GRUPPEN fließen: Leert die Suche „Vergangen" komplett,
          // rutscht „Archiviert" nach oben, statt dorthin zu springen. Die
          // Karten selbst fließen im Raster jeder Gruppe (Section).
          <StaggerFlow className="flex flex-col gap-6 pb-4">
            {grouped.upcoming.length > 0 && (
              <FlowItem key="upcoming">
                <Section title="Geplant / Aktiv" accent={GROUP_ACCENT.upcoming}>
                  {grouped.upcoming.map(karte)}
                </Section>
              </FlowItem>
            )}
            {grouped.past.length > 0 && (
              <FlowItem key="past">
                <Section title="Vergangene Wettkämpfe" accent={GROUP_ACCENT.past}>
                  {grouped.past.map(karte)}
                </Section>
              </FlowItem>
            )}
            {grouped.archived.length > 0 && (
              <FlowItem key="archived">
                <Section title="Archiviert" accent={GROUP_ACCENT.archived}>
                  {grouped.archived.map(karte)}
                </Section>
              </FlowItem>
            )}
          </StaggerFlow>
        )}
      </div>
    </main>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="rounded-card p-10 text-center"
      style={{
        border: "1px dashed var(--line-strong)",
        background: "var(--surface-card)",
      }}
    >
      <p style={{ font: "var(--type-body-strong)" }}>{title}</p>
      {hint && (
        <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function CompetitionsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <CompetitionsHubContent />
    </Suspense>
  );
}
