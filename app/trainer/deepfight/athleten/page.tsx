"use client";

/**
 * DeepFight → Athleten: die „umgekehrte" Richtung des Werkzeugs — statt einen
 * Gegner zu scouten wertest du deine eigenen Leute aus.
 *
 * TEILSCHRITT 3 DES NEUAUFBAUS (07.09.2026). Diese Seite war die letzte im
 * ALTEN Token-System: Ink- und Foreground-Flächen, zwei fest verdrahtete
 * Farbwerte (das Tidal-Türkis und das KI-Violett) und halbdurchsichtige
 * Ränder in Hex-Alpha. Über der bewegten Schicht des Bereichs fiel das
 * doppelt auf — 32 deckende Karten legten die Schicht schlicht tot. Jetzt
 * trägt jede Zeile `.t-card` und wird damit durch die EINE Bereichsregel in
 * globals.css zu Glas, ohne dass diese Datei etwas davon weiß.
 *
 * VIER ÄNDERUNGEN GEGENÜBER DEM ALTSTAND:
 *
 * 1. **Der Seitenkopf ist weg** (Leons Entscheidung 07.09.) — dieselbe
 *    Begründung wie in der Gegner-Bibliothek: Die Glas-Leiste des Bereichs
 *    sagt bereits „ATHLETEN", und Titel plus Beschreibung saßen direkt auf
 *    der bewegten Schicht. Für Screenreader bleibt eine `sr-only`-Überschrift.
 * 2. **DIE FREIGABE FILTERT JETZT HIER** (`darfSehen(…, "deepfight", …)`,
 *    dazu `isGhostAccount`) — dieselbe Regel wie in der Ziel-Auswahl der
 *    Werkbank und in „Neuer Wettkampf". Vorher listete die Seite jeden
 *    Kollegen, und wer einen antippte, landete auf der Detailseite im Hinweis
 *    „noch nicht freigegeben". Diese Sackgasse ist damit weg, und die
 *    Ghost-Konten (Plattform-Admins, lib/admin.ts) stehen nicht mehr als
 *    Kollegen im Team — auf dieser Seite standen sie bisher sogar doppelt,
 *    weil derselbe Mensch ein Ghost- UND ein Trainerkonto hat.
 *    Bleibt eine Gruppe dadurch leer, sagt die Seite WARUM: Der Kollege
 *    entscheidet selbst.
 * 3. **Zwei Wege je Zeile**: die Karte führt aufs Kampfprofil, der Knopf
 *    daneben direkt in die Werkbank
 *    (`/trainer/deepfight?modus=leute&ziel=<uid>`). Technisch dasselbe Muster
 *    wie in der Gegner-Bibliothek — Klickziel als unsichtbares Geschwister
 *    (`.t-row-card`/`.t-row-target`), Aktion darüber; ein Knopf IM Link wäre
 *    ungültiges HTML. Der Werkbank-Knopf trägt hier nur sein Zeichen: Bei
 *    ~32 Namen zählt die Scanbarkeit der Liste mehr als ein zweites Wort pro
 *    Zeile (Muster: die Zeilen-Aktion in /verwaltung/einladungen).
 * 4. **Der Knopf „Gegner-Scouting" ist weg** — dafür sind die Segmente da.
 *
 * Gruppiert wie die Werkbank und wie „Neuer Wettkampf": Ich selbst · Trainer
 * & Coaches · Athleten. Trainer sind auch Athleten (CLAUDE.md), deshalb liest
 * die Seite `listAllMembers` und nicht `listAllStudents`.
 */

import { FlowItem, StaggerFlow } from "@/components/motion";
import TrainerHint from "@/components/TrainerHint";
import ErrorState from "@/components/ui/ErrorState";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import {
  isGhostAccount,
  isStaffEntry,
  listAllMembers,
  type StudentEntry,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { darfSehen } from "@/lib/profile-sharing";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function labelOf(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ─── Eine Zeile ──────────────────────────────────────────────────────────────

function PersonRow({ entry, self }: { entry: StudentEntry; self: boolean }) {
  const name = labelOf(entry);
  return (
    <div className="t-card t-row-card relative flex items-center gap-3 p-3.5">
      {/* Klickziel über der GANZEN Karte — der Alltagsweg führt aufs Profil. */}
      <Link
        href={`/trainer/deepfight/athleten/${entry.uid}`}
        className="t-row-target absolute inset-0 rounded-[var(--r-lg)]"
        aria-label={
          self ? "Mein Kampfprofil öffnen" : `Kampfprofil von ${name} öffnen`
        }
      />

      <span
        aria-hidden
        className="pointer-events-none relative flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
        style={{
          font: "var(--type-body-strong)",
          letterSpacing: "var(--ls-label)",
          background: "var(--accent-subtle)",
          border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
          color: "var(--accent-text)",
        }}
      >
        {initialsOf(name)}
      </span>

      <span
        className="pointer-events-none relative min-w-0 flex-1 truncate"
        style={{ font: "var(--type-body-strong)" }}
      >
        {name}
      </span>

      {/* Der zweite Weg: direkt an die Werkbank, mit dieser Person als Ziel. */}
      <Link
        href={`/trainer/deepfight?modus=leute&ziel=${entry.uid}`}
        data-press
        className="t-interactive relative flex h-hit w-hit shrink-0 items-center justify-center rounded-field"
        style={{
          color: "var(--accent-text)",
          border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
        }}
        aria-label={self ? "Mich analysieren" : `${name} analysieren`}
        title="Analysieren"
      >
        <Icon name="spark" size={16} strokeWidth={2.2} />
      </Link>

      <span
        aria-hidden
        className="pointer-events-none relative shrink-0 pr-0.5"
        style={{ color: "var(--text-3)", lineHeight: 0 }}
      >
        <Icon name="arrow-right" size={16} strokeWidth={2.2} />
      </span>
    </div>
  );
}

function Gruppe({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="t-label mb-2">{title}</p>
      {/* Die Suche filtert live — bleibende Namen rutschen an ihren neuen
          Platz (MOTION-BRIEF §3.7, Schlüssel ist die uid). */}
      <StaggerFlow className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </StaggerFlow>
    </div>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function DeepFightAthletesPage() {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";
  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setMembers(null);
    try {
      setMembers(await listAllMembers(gymId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Wer hier steht: ich selbst, Kollegen NUR mit Freigabe im Bereich
   * `deepfight`, Athleten — und keine Ghost-Konten. Wortgleich zur
   * Ziel-Auswahl der Werkbank (app/trainer/deepfight/page.tsx).
   *
   * `staffGesamt` zählt die Kollegen VOR dem Freigabe-Filter. Nur so kann die
   * Seite den leeren Fall erklären, statt die Gruppe wortlos wegzulassen.
   */
  const gruppen = useMemo(() => {
    const q = search.trim().toLowerCase();
    const alle = (members ?? []).filter(
      (s) =>
        !q ||
        labelOf(s).toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
    const self = alle.find((s) => s.uid === eigeneUid) ?? null;
    const kollegen = alle.filter(
      (s) => s.uid !== eigeneUid && isStaffEntry(s) && !isGhostAccount(s),
    );
    const staff = kollegen
      .filter((s) => darfSehen(s.profileShares, "deepfight", eigeneUid))
      .sort((a, b) => labelOf(a).localeCompare(labelOf(b), "de"));
    const students = alle.filter((s) => s.uid !== eigeneUid && !isStaffEntry(s));
    return { self, staff, staffGesamt: kollegen.length, students };
  }, [members, search, eigeneUid]);

  const leer =
    members !== null &&
    gruppen.self === null &&
    gruppen.staffGesamt === 0 &&
    gruppen.students.length === 0;

  return (
    <main className="min-h-screen pb-12" style={{ color: "var(--text-body)" }}>
      {/* Sichtbar sagt die Glas-Leiste des Layouts, wo man steht — die
          Überschrift steht hier für Screenreader und Suchmaschinen. */}
      <h1 className="sr-only">DeepFight — Athleten</h1>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-4 sm:px-6">
        <TrainerHint id="deepfight-athletes" title="Eigene Leute auswerten">
          Tipp auf einen Namen und du siehst sein Kampfprofil; der Knopf
          daneben bringt dich mit ihm als Ziel direkt an die Werkbank. Deine
          Kollegen entscheiden selbst, wer ihr Kampfprofil sieht — sobald dich
          jemand freischaltet, steht er hier. Dich selbst wertest du jederzeit
          aus.
        </TrainerHint>

        {error && (
          <ErrorState
            title="Athleten konnten nicht geladen werden"
            message={error}
            hint="Prüfe die Firestore-Regeln — Trainer brauchen Lesezugriff auf die users-Collection."
            onRetry={load}
          />
        )}

        {/* Werkzeugzeile — die Suche in einer Glas-Pille, wie in der
            Gegner-Bibliothek. Sie ersetzt den alten Seitenkopf als erstes
            sichtbares Element der Seite. Radius wie dort: Karte auf dem
            Handy, Pille ab sm (Begründung im Zwilling). */}
        <div className="t-card flex flex-wrap items-center gap-2.5 rounded-card px-3 py-2 sm:rounded-pill sm:px-4">
          <GooeySearch
            value={search}
            onChange={setSearch}
            label="Suchen"
            placeholder="Athlet suchen…"
          />
          {members !== null && (
            <span
              className="ml-auto hidden pr-1 sm:inline"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {gruppen.students.length + gruppen.staff.length}{" "}
              {gruppen.students.length + gruppen.staff.length === 1
                ? "Person"
                : "Personen"}
            </span>
          )}
        </div>

        {members === null ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[74px] w-full rounded-card" />
            ))}
          </div>
        ) : leer ? (
          <div className="t-card p-10 text-center">
            <p style={{ font: "var(--type-body-strong)" }}>
              {search
                ? "Zu diesem Namen passt gerade niemand."
                : "In deinem Gym ist noch niemand angemeldet."}
            </p>
            <p
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              {search
                ? "Such nach einem anderen Namen oder leer die Suche."
                : "Lade dein Team über die Verwaltung ein — danach wertest du hier jeden aus."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {gruppen.self && (
              <Gruppe title="Ich selbst">
                <FlowItem key={gruppen.self.uid}>
                  <PersonRow entry={gruppen.self} self />
                </FlowItem>
              </Gruppe>
            )}

            {gruppen.staff.length > 0 ? (
              <Gruppe title="Trainer & Coaches">
                {gruppen.staff.map((s, i) => (
                  <FlowItem key={s.uid} index={i}>
                    <PersonRow entry={s} self={false} />
                  </FlowItem>
                ))}
              </Gruppe>
            ) : (
              gruppen.staffGesamt > 0 && (
                <div>
                  <p className="t-label mb-2">Trainer & Coaches</p>
                  {/* Der leere Fall bekommt seinen Grund. Ohne diese Zeile
                      verschwände die Gruppe wortlos, und die alte Sackgasse
                      wäre nur unsichtbar geworden statt behoben. */}
                  <div className="t-card px-4 py-3.5">
                    <p style={{ font: "var(--type-body-strong)" }}>
                      Dein Team entscheidet selbst.
                    </p>
                    <p
                      className="mt-1"
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      {gruppen.staffGesamt === 1
                        ? "Ein Kollege kann dir sein Kampfprofil freigeben"
                        : `${gruppen.staffGesamt} Kollegen können dir ihr Kampfprofil freigeben`}{" "}
                      — über &bdquo;Profil teilen&ldquo; in ihrem eigenen
                      Kampfprofil. Danach wertest du sie hier aus wie jeden
                      Athleten.
                    </p>
                  </div>
                </div>
              )
            )}

            {gruppen.students.length > 0 && (
              <Gruppe title="Athleten">
                {gruppen.students.map((s, i) => (
                  <FlowItem key={s.uid} index={i}>
                    <PersonRow entry={s} self={false} />
                  </FlowItem>
                ))}
              </Gruppe>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
