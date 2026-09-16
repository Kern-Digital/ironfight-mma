"use client";

/**
 * Die Suche der DeepFight-Landung — über Gegner, Athleten UND Analysen.
 *
 * ─── LEONS ENTSCHEIDUNG UND DER GANZE TRICK (08.09.2026) ────────────────────
 *
 * „Er sucht über ALLES — Gegner, Athleten und Analysen, Treffer nach Art
 * gruppiert, ein Tipp führt direkt zum Ziel."
 *
 * Gegner und Athleten kosten nichts extra: Ihre Listen sind ohnehin geladen,
 * gefiltert wird lokal. **Analysen liegen dagegen verstreut** — in
 * `users/{uid}/videoAnalyses` und `opponents/{id}/videoAnalyses`, ohne Leser
 * über alle. Der Fächer holt sie mit einer Abfrage je Ziel, beim aktuellen Gym
 * rund 38.
 *
 * **Eine Suche, die je Tastendruck 38 Abfragen auslöst, wäre der Fehler.**
 * Deshalb lädt `lib/deepfight-analysen.ts` sie GENAU EINMAL je Sitzung und
 * hält sie im Speicher; getippt wird danach ohne jede Abfrage. Diese
 * Komponente ruft den Loader nur an — sie kennt seine Kosten nicht und muss
 * sie nicht kennen.
 *
 * **Die Suche blockiert nicht auf den Analysen.** Gegner- und Athleten-Treffer
 * stehen sofort da; die Analysen-Gruppe zeigt so lange eine Ladezeile, bis der
 * Fächer durch ist (~1 s, einmalig). Andersherum — erst warten, dann alles
 * zeigen — machte die billigen Treffer so langsam wie die teuren.
 *
 * ─── WAS NICHT ERSCHEINT ────────────────────────────────────────────────────
 *
 * Kollegen ohne Freigabe im Bereich `deepfight` und Ghost-Konten stehen nicht
 * in der Liste — dieselbe Regel wie in der Auswahl (`darfSehen`,
 * `isGhostAccount`). Die Suche ist kein Schlupfloch um die Freigabe herum: Sie
 * filtert die Listen, die ihr der Aufrufer gibt, und der filtert sie wie die
 * Auswahlseiten. Bei den Analysen erledigt es der Loader selbst — er fragt
 * gesperrte Ziele gar nicht erst ab.
 *
 * ─── FORM ───────────────────────────────────────────────────────────────────
 *
 * Das Feld ist `GooeySearch` (Suchfeld-Standard der App, Leon 04.09.), nur
 * breiter — hier ist es die Hauptsache der Kopfzeile, nicht ein Filter neben
 * einem Knopf. Die Trefferliste steht als eigene Glaskarte darunter: Die
 * Komponente bringt bewusst keine eigene mit (ausprobiert und verworfen am
 * 03.09. — die „Tropfen" legten sich über genau die Karten, die dieselben
 * Namen schon zeigten).
 */

import { StaggerList } from "@/components/motion";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { StudentEntry } from "@/lib/admin";
import { nameVon, sucheAnalysen, type AnalyseEintrag } from "@/lib/deepfight-analysen";
import { dnaCompleteness } from "@/lib/gegner-dna";
import { searchOpponents, type Opponent } from "@/lib/opponents";
import Link from "next/link";
import { useMemo } from "react";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** Wie viele Treffer je Gruppe höchstens stehen — der Rest wird gezählt. */
const PRO_GRUPPE = 5;

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Treffer({
  href,
  icon,
  titel,
  meta,
}: {
  href: string;
  icon: IconName;
  titel: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      data-press="quiet"
      className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--line)",
        textDecoration: "none",
        color: "var(--text-body)",
      }}
    >
      <span className="flex shrink-0 items-center" style={{ color: "var(--accent-text)" }}>
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ font: "var(--type-body-strong)" }}>
          {titel}
        </span>
        <span className="block truncate" style={{ ...META_FONT, color: "var(--text-2)" }}>
          {meta}
        </span>
      </span>
      <span aria-hidden className="shrink-0" style={{ color: "var(--text-2)", lineHeight: 0 }}>
        <Icon name="arrow-right" size={14} strokeWidth={2.2} />
      </span>
    </Link>
  );
}

/**
 * Eine Treffergruppe.
 *
 * ─── WARUM `StaggerList` UND NICHT `StaggerFlow` (gemessen 09.09.2026) ──────
 *
 * `StaggerFlow` ist der Baustein für Listen, die BLEIBEN und sich neu
 * sortieren — die zwei Bibliotheken filtern so, und dort ist er richtig. Eine
 * Trefferliste bleibt aber nicht: Sie wird bei jedem Tastendruck NEU GEBAUT,
 * ganze Gruppen erscheinen und verschwinden.
 *
 * Der Unterschied ist messbar, nicht theoretisch. `StaggerFlow` läuft über
 * `AnimatePresence mode="popLayout"`, und popLayout nimmt gehende Einträge aus
 * dem Fluss, statt sie sofort zu entfernen. Wechselt der Inhalt schneller, als
 * eine Austritts-Feder braucht, bleiben sie stehen — gemessen beim Tippen von
 * „Mira" ohne Pause: **13 Zeilen im Panel statt 2, und sie verschwanden auch
 * nach sechs Sekunden nicht.** Mit menschlichem Tempo (350 ms je Anschlag) trat
 * es nicht auf; ein schneller Tipper hätte Geister-Treffer gesehen.
 *
 * `StaggerList` hat keinen Austritt: Die Zeilen treten in Wellen auf
 * (MOTION-BRIEF, Prinzip 3), und ein neuer Suchbegriff ersetzt sie schlicht.
 * Sie wickelt ihre Kinder selbst in `StaggerItem` — deshalb steht hier auch
 * kein `FlowItem` mehr, und die Ref-Falle (Falle 31) ist gleich mit weg.
 */
function Gruppe({
  titel,
  anzahl,
  children,
}: {
  titel: string;
  anzahl: number;
  children: React.ReactNode;
}) {
  if (anzahl === 0) return null;
  return (
    <div>
      <p className="t-label mb-2">
        {titel} <span style={{ fontVariantNumeric: "tabular-nums" }}>({anzahl})</span>
      </p>
      <StaggerList className="flex flex-col gap-2">{children}</StaggerList>
      {anzahl > PRO_GRUPPE && (
        <p className="mt-2" style={{ ...META_FONT, color: "var(--text-2)" }}>
          und {anzahl - PRO_GRUPPE} weitere
        </p>
      )}
    </div>
  );
}

export default function DeepFightSuche({
  wert,
  onWert,
  members,
  opponents,
  analysen,
  analysenLaufen,
  eigeneUid,
}: {
  wert: string;
  onWert: (v: string) => void;
  /** Bereits gefiltert (Freigabe + Ghost) — siehe Kopf. */
  members: StudentEntry[] | null;
  opponents: Opponent[] | null;
  /** `null`, solange der Fächer läuft bzw. noch nicht angestoßen wurde. */
  analysen: AnalyseEintrag[] | null;
  analysenLaufen: boolean;
  eigeneUid: string;
}) {
  const q = wert.trim().toLowerCase();

  const gegnerTreffer = useMemo(
    () => (q ? searchOpponents(opponents ?? [], wert) : []),
    [opponents, wert, q],
  );

  const leuteTreffer = useMemo(() => {
    if (!q) return [];
    return (members ?? []).filter(
      (s) =>
        nameVon(s).toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }, [members, q]);

  const analyseTreffer = useMemo(
    () => (q && analysen ? sucheAnalysen(analysen, wert) : []),
    [analysen, wert, q],
  );

  const nichtsGefunden =
    q.length > 0 &&
    gegnerTreffer.length === 0 &&
    leuteTreffer.length === 0 &&
    analyseTreffer.length === 0 &&
    !analysenLaufen;

  return (
    <div className="relative flex flex-col items-end">
      {/* ZUGEKLAPPT NUR DIE LUPE (Leon 10.09.2026): Die Suche sitzt ganz
          rechts in der Kopfzeile, auf Höhe der Wortmarke — dort steht sie
          allein, und ein Wort daneben wäre eine Beschriftung ohne Gegenstück.
          Der Kreis hat die Höhe eines Touch-Ziels (44 px); geöffnet wächst er
          auf 420 px. */}
      <GooeySearch
        value={wert}
        onChange={onWert}
        label="Suchen"
        placeholder="Gegner, Athlet oder Analyse…"
        nurSymbol
        breiteZu={44}
        breiteAuf={420}
      />

      {/* DIE TREFFER LIEGEN ÜBER DER SEITE, NICHT IN IHR. Stünden sie im
          Fluss, schöbe jeder Tastendruck die Kopfzeile und mit ihr die
          Überschrift nach unten — die Seite zuckte unter dem Tippen. Als
          Überlagerung bleibt alles stehen. Rechts ausgerichtet wie das Feld,
          Breite gedeckelt auf den Bildschirm minus Rand. */}
      {q.length > 0 && (
        <div
          className="t-card absolute right-0 top-full z-30 mt-2 flex w-[min(30rem,calc(100vw-2.5rem))] flex-col gap-4 p-4 sm:p-5">
          <Gruppe titel="Gegner" anzahl={gegnerTreffer.length}>
            {gegnerTreffer.slice(0, PRO_GRUPPE).map((o) => (
              <Treffer
                key={o.id}
                href={`/trainer/deepfight/gegner/${o.id}`}
                icon="target"
                titel={o.name}
                meta={`DNA ${dnaCompleteness(o.dna)} %`}
              />
            ))}
          </Gruppe>

          <Gruppe titel="Athleten" anzahl={leuteTreffer.length}>
            {leuteTreffer.slice(0, PRO_GRUPPE).map((s) => (
              <Treffer
                key={s.uid}
                href={`/trainer/deepfight/athleten/${s.uid}`}
                icon="user"
                titel={nameVon(s)}
                meta={s.uid === eigeneUid ? "Ich selbst" : "Kampfprofil"}
              />
            ))}
          </Gruppe>

          {/* Die Analysen laufen nach — sie kosten den einen Fächer je
              Sitzung, alles darüber steht längst. */}
          {analysenLaufen ? (
            <div>
              <p className="t-label mb-2">Analysen</p>
              <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                Deine Analysen kommen gleich dazu.
              </p>
            </div>
          ) : (
            <Gruppe titel="Analysen" anzahl={analyseTreffer.length}>
              {analyseTreffer.slice(0, PRO_GRUPPE).map((e) => (
                <Treffer
                  key={`${e.modus}:${e.zielId}:${e.analyse.id}`}
                  href={`/trainer/deepfight/analyse?modus=${e.modus}&ziel=${e.zielId}&analyse=${e.analyse.id}`}
                  icon="video"
                  titel={e.zielName}
                  meta={`${e.analyse.sourceLabel} · ${formatDate(e.analyse.createdAt)}`}
                />
              ))}
            </Gruppe>
          )}

          {nichtsGefunden && (
            <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
              Dazu findet sich nichts. Such nach einem anderen Namen oder leer
              die Suche.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
