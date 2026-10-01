"use client";

/**
 * Mitgliederbereich (Multi-Gym Phase 2, Konzept §4) — die Liste aller
 * Menschen im Gym mit den beiden Rechte-Häkchen.
 *
 * Aufbau im Token-Look: Ambient-Kopf, `.t-card`-Zeilen im Raster der
 * Athletenliste, Kennzahlen und Einladen-Symbol rechts neben der Überschrift.
 *
 * ANFRAGEN WOHNEN AUCH HIER (01.10.2026, Etappe 4 der Gym-Suche): Wer auf
 * /gym-finden „Probetraining vereinbaren" schickt, steht oben im Abschnitt
 * „Anfragen" mit der Zahl an der Überschrift (lib/gym-anfrage.ts).
 *
 * EINLADUNGEN WOHNEN HIER (Leon 30.09.2026: „die menüleiste einladungen kann
 * auch weg … das ist ja jetzt unter mitglieder"). Über der Liste stehen die
 * OFFENEN Einladungen — kopieren direkt an der Zeile, Notiz und Zurückziehen
 * im Detail-Sheet. Aufgebrauchte, abgelaufene und zurückgezogene fehlen: Wer
 * hier schaut, will wissen, welche Links gerade jemanden hereinlassen. Die
 * alte Seite /verwaltung/einladungen leitet hierher um (next.config.mjs).
 * Lesen wie gehabt nur die Verwaltung (Regel `gyms/{gymId}/invites`),
 * geschrieben wird ausschließlich über /api/invites.
 *
 * RECHTE: Sichtbar nur für die Verwaltung. Ein Trainer ohne Verwaltungsrecht
 * kommt hier gar nicht an — die Middleware schickt ihn auf /dashboard
 * (lib/verwaltung-routes.ts), `VerwaltungRoute` im Bereichs-Layout ebenso,
 * und die Firestore-Regeln würden die Liste ohnehin abweisen.
 *
 * GRUPPIERUNG statt Sortierung nach Beitrittsdatum: Wer diese Seite öffnet,
 * sucht entweder eine bestimmte Person (dafür das Suchfeld) oder will sehen,
 * wer das Gym führt und wer Kurse gibt. Innerhalb der Gruppen alphabetisch.
 */

import AnfrageDetailSheet from "@/components/AnfrageDetailSheet";
import GooeySearch from "@/components/ui/GooeySearch";
import InviteCreateSheet from "@/components/InviteCreateSheet";
import InviteDetailSheet from "@/components/InviteDetailSheet";
import MemberRoleSheet from "@/components/MemberRoleSheet";
import { SeitenZurueck } from "@/components/shell/KopfNavigation";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { CountingNumber, FlowItem, StaggerFlow } from "@/components/motion";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth, useRights } from "@/lib/auth-context";
import { copyText } from "@/lib/clipboard";
import { getGymName, resolveGymId } from "@/lib/gym";
import { anfrageTag, ladeAnfragen, type GymAnfrage } from "@/lib/gym-anfrage";
import {
  formatInviteCode,
  inviteJoinUrl,
  inviteStatus,
  listGymInvites,
  type GymInvite,
} from "@/lib/invites";
import {
  MEMBER_GROUP_LABEL,
  memberGroupOf,
  memberMatches,
  memberName,
  membershipShort,
  memberSince,
} from "@/lib/members";
import { useCallback, useEffect, useMemo, useState } from "react";
import Profilbild from "@/components/ui/Profilbild";

type MemberGroup = ReturnType<typeof memberGroupOf>;

const GROUP_ORDER: MemberGroup[] = ["verwaltung", "trainer", "athlet"];

/**
 * Wie die Liste geordnet ist (Leon 29.09.2026, Stufe 1). „Aufgabe" statt
 * „Rolle": Verwaltung und Trainer sind im Gym Aufgaben, kein Rang. Es ist
 * der Standard und die alte Gruppierung.
 *
 * Alle vier kommen aus dem users-Dokument, das die Liste ohnehin lädt —
 * keine einzige zusätzliche Abfrage. Sortieren nach Kampfstil und Rang
 * (Stufe 2) wartet auf ein Graduierungs-Datenmodell; siehe Roadmap.
 */
type Sortierung = "aufgabe" | "neu" | "alt" | "name";

const SORTIERUNGEN: { value: Sortierung; label: string }[] = [
  { value: "aufgabe", label: "Nach Aufgabe" },
  { value: "neu", label: "Neueste zuerst" },
  { value: "alt", label: "Älteste zuerst" },
  { value: "name", label: "Name A–Z" },
];

function nachName(a: StudentEntry, b: StudentEntry): number {
  return memberName(a).localeCompare(memberName(b), "de", {
    sensitivity: "base",
  });
}

/** Beitritt als Zahl; ohne bekanntes Datum ans Ende, egal in welche Richtung. */
function beitritt(m: StudentEntry): number | null {
  return memberSince(m)?.getTime() ?? null;
}

/** „Leon Reichle" → „LR" — dieselbe Kachel wie in der Athletenliste. */
function initialsOf(entry: StudentEntry): string {
  const parts = memberName(entry).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function TrainerMembersPage() {
  const { user, profile, profileLoading } = useAuth();
  // Verwaltungsrecht kommt aus dem Custom Claim (auth-context spiegelt ihn);
  // der Plattform-Admin verwaltet jedes Gym.
  const isVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sortierung, setSortierung] = useState<Sortierung>("aufgabe");
  const [detail, setDetail] = useState<StudentEntry | null>(null);
  // Einladen direkt von hier (Leon 29.09.2026): Wer auf die Liste seiner
  // Leute schaut, will als Nächstes oft jemanden dazuholen.
  const [inviting, setInviting] = useState(false);
  const [invites, setInvites] = useState<GymInvite[] | null>(null);
  const [invitesError, setInvitesError] = useState(false);
  const [inviteDetail, setInviteDetail] = useState<GymInvite | null>(null);
  // Code, dessen Link gerade kopiert wurde (Symbol wechselt kurz auf „check")
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);

  // Anfragen „Probetraining vereinbaren" aus der Gym-Suche (Etappe 4,
  // 01.10.2026). Sie kommen über eine Route — die Sammlung ist im Browser zu.
  const [anfragen, setAnfragen] = useState<GymAnfrage[]>([]);
  const [anfragenError, setAnfragenError] = useState(false);
  const [anfrageDetail, setAnfrageDetail] = useState<GymAnfrage | null>(null);
  const [gymName, setGymName] = useState("");

  const loadAnfragen = useCallback(() => {
    if (!user || profileLoading || !isVerwaltung) return;
    ladeAnfragen(user)
      .then((list) => {
        setAnfragen(list);
        setAnfragenError(false);
      })
      .catch(() => {
        setAnfragen([]);
        setAnfragenError(true);
      });
  }, [user, profileLoading, isVerwaltung]);

  useEffect(() => {
    loadAnfragen();
  }, [loadAnfragen]);

  useEffect(() => {
    if (!isVerwaltung) return;
    let lebt = true;
    getGymName(gymId)
      .then((n) => lebt && setGymName(n))
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, [isVerwaltung, gymId]);

  // /verwaltung/mitglieder#anfragen: nachspringen, sobald der Abschnitt da ist.
  const hatAnfragen = anfragen.length > 0;
  useEffect(() => {
    if (!hatAnfragen || window.location.hash !== "#anfragen") return;
    document.getElementById("anfragen")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hatAnfragen]);

  const loadInvites = useCallback(() => {
    if (!user || profileLoading || !isVerwaltung) return;
    listGymInvites(gymId)
      .then((list) => {
        setInvites(list);
        setInvitesError(false);
      })
      .catch(() => {
        setInvites([]);
        setInvitesError(true);
      });
  }, [user, profileLoading, isVerwaltung, gymId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  // Nur, was gerade jemanden hereinlässt; die Liste kommt schon neueste
  // zuerst (listGymInvites).
  const offeneEinladungen = useMemo(() => {
    const jetzt = new Date();
    return (invites ?? []).filter((i) => inviteStatus(i, jetzt) === "open");
  }, [invites]);

  // Die Verwaltungs-Übersicht verlinkt auf #einladungen. Der Abschnitt
  // entsteht erst mit den Daten — der Browser findet den Anker beim Laden
  // also noch nicht; deshalb einmal nachspringen, sobald er da ist.
  const hatOffene = offeneEinladungen.length > 0;
  useEffect(() => {
    if (!hatOffene || window.location.hash !== "#einladungen") return;
    document
      .getElementById("einladungen")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hatOffene]);

  // „Einladen" auf der Verwaltungs-Übersicht kommt mit ?einladen=1 und
  // öffnet das Sheet gleich. Gelesen aus `window` statt `useSearchParams`:
  // Das verlangte eine Suspense-Grenze um die ganze Seite. Danach verschwindet
  // der Parameter wieder, sonst öffnete ein Neuladen das Sheet erneut.
  useEffect(() => {
    if (!isVerwaltung) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("einladen") !== "1") return;
    setInviting(true);
    url.searchParams.delete("einladen");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [isVerwaltung]);

  async function handleCopy(invite: GymInvite) {
    const ok = await copyText(inviteJoinUrl(invite.code));
    setCopyError(!ok);
    if (!ok) return;
    setCopiedCode(invite.code);
    window.setTimeout(
      () => setCopiedCode((c) => (c === invite.code ? null : c)),
      2000,
    );
  }

  const load = useCallback(() => {
    if (!user || profileLoading || !isVerwaltung) return;
    listAllMembers(gymId)
      .then((list) => {
        setMembers(list);
        setError(false);
      })
      .catch(() => {
        setMembers([]);
        setError(true);
      });
  }, [user, profileLoading, isVerwaltung, gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const byGroup: Record<MemberGroup, StudentEntry[]> = {
      verwaltung: [],
      trainer: [],
      athlet: [],
    };
    for (const m of members ?? []) {
      if (memberMatches(m, search)) byGroup[memberGroupOf(m)].push(m);
    }
    for (const key of GROUP_ORDER) {
      byGroup[key].sort((a: StudentEntry, b: StudentEntry) =>
        memberName(a).localeCompare(memberName(b), "de", {
          sensitivity: "base",
        }),
      );
    }
    return byGroup;
  }, [members, search]);

  const counts = useMemo(() => {
    const all = members ?? [];
    let trainer = 0;
    let verwaltung = 0;
    for (const m of all) {
      const r = m.rights;
      if (r.trainer) trainer += 1;
      if (r.verwaltung) verwaltung += 1;
    }
    return { total: all.length, trainer, verwaltung };
  }, [members]);

  // Die Liste als Abschnitte: „Nach Aufgabe" hat je Gruppe einen mit
  // Überschrift, die anderen Ordnungen sind EIN Abschnitt ohne (`key: null`).
  // Jeder Abschnitt läuft in senkrechten Spalten (siehe SpaltenListe).
  const abschnitte = useMemo((): {
    key: MemberGroup | null;
    members: StudentEntry[];
  }[] => {
    if (sortierung === "aufgabe") {
      return GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => ({
        key,
        members: groups[key],
      }));
    }
    const liste = GROUP_ORDER.flatMap((k) => groups[k]);
    if (sortierung === "name") {
      liste.sort(nachName);
    } else {
      const richtung = sortierung === "neu" ? -1 : 1;
      liste.sort((a, b) => {
        const ta = beitritt(a);
        const tb = beitritt(b);
        if (ta === null || tb === null) {
          if (ta === tb) return nachName(a, b);
          return ta === null ? 1 : -1;
        }
        return ta === tb ? nachName(a, b) : (ta - tb) * richtung;
      });
    }
    return liste.length > 0 ? [{ key: null, members: liste }] : [];
  }, [groups, sortierung]);

  // Spaltenzahl aus der Breite der Inhaltsspalte (Leon 30.09.2026: „mehrere
  // vertikale Spalten, so dass der Platz in der Breite besser genutzt wird").
  const [rahmenEl, setRahmenEl] = useState<HTMLDivElement | null>(null);
  const spalten = useSpaltenzahl(rahmenEl);

  const stats = [
    { label: counts.total === 1 ? "Mitglied" : "Mitglieder", value: counts.total },
    { label: "Trainer", value: counts.trainer },
    { label: "Verwaltung", value: counts.verwaltung },
  ];

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (Muster der Verwaltungs-Seiten) */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="mitglieder-rahmen relative mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 pb-6 pt-4 lg:max-w-5xl lg:px-6 lg:pb-8 lg:pt-6">
          {/* Zurück in die VERWALTUNG, nicht in den Trainerbereich: Diese
              Seite gehört dem Gym, und wer nur Verwaltungsrechte hat, kommt
              auf /trainer gar nicht hinein. Ab `lg` steht der Weg im Kopf
              der Hülle (Leon: „Zurück-Knöpfe nach oben").
              KEINE SPRUNGMARKEN auf die drei Gruppen (Leon 19.09.2026,
              nachdem er sie gesehen hat: „Gruppen weglassen"): Die erste
              Gruppe heißt „Verwaltung" wie der Weg zurück — das Wort stand
              zweimal nebeneinander im Kopf. Wer jemanden sucht, nimmt
              ohnehin die Suche. */}
          <SeitenZurueck href="/verwaltung" label="Verwaltung" />
          {/* Überschrift links, das Einladen-Symbol rechts auf ihrer Höhe,
              darunter die Kennzahlen (Leon 29.09.2026). Die Zahlen zählen das
              ganze Gym, auch während einer Suche — sie beschreiben das Gym,
              nicht den Treffer. Auf dem Handy steht das Symbol neben der
              Überschrift und die Zahlen bekommen eine eigene Zeile — alle
              drei nebeneinander passten nicht auf 390 px. */}
          <div className="mitglieder-kopf">
            <h1 className="mitglieder-titel">Mitglieder</h1>
            <p className="mitglieder-intro">
              Dein ganzes Gym auf einen Blick. Tipp einen Namen an und vergib
              Trainer- oder Verwaltungsrechte.
            </p>
            {isVerwaltung && (
              <>
                <dl className="mitglieder-zahlen">
                  {stats.map((s) => (
                    <div key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>
                        <CountingNumber target={s.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
                {/* Nach dem Erstellen zeigt das Sheet den Code sofort zum
                    Teilen; die neue Einladung steht danach unter „Offene
                    Einladungen". */}
                <button
                  type="button"
                  onClick={() => setInviting(true)}
                  aria-label="Einladung erstellen"
                  title="Einladung erstellen"
                  className="mitglieder-einladen"
                >
                  {/* Beim Hovern gleitet das Wort links aus dem Symbol,
                      ein Glanz huscht durch (Leon 29.09.). Nur Zierde: Der
                      Name steht im aria-label, auf Touch bleibt das Symbol. */}
                  <span aria-hidden className="mitglieder-einladen__wort">
                    Hinzufügen
                  </span>
                  <Icon name="einladen" size={48} strokeWidth={1.6} />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mitglieder-rahmen mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2 lg:max-w-5xl lg:px-6">
        {/* Misst die Breite der Inhaltsspalte für die Spaltenzahl. */}
        <div ref={setRahmenEl} aria-hidden className="h-0 w-full" />
        {!isVerwaltung ? (
          <p
            className="py-8 text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            {profileLoading
              ? ""
              : "Die Mitgliederliste führt die Gym-Verwaltung. Wende dich an sie, wenn jemand andere Rechte bekommen soll."}
          </p>
        ) : (
          <>
            {error && (
              <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                Die Mitglieder konnten nicht geladen werden.
              </p>
            )}

            {invitesError && (
              <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                Die Einladungen konnten nicht geladen werden.
              </p>
            )}

            {anfragenError && (
              <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                Die Anfragen konnten nicht geladen werden.
              </p>
            )}

            {/* Anfragen aus der Gym-Suche — ganz oben, weil dort jemand auf
                Antwort wartet. Nur, wenn es welche gibt; die Zahl steht an
                der Überschrift wie bei den Einladungen. */}
            {hatAnfragen && (
              <section
                id="anfragen"
                aria-labelledby="anfragen-titel"
                className="flex scroll-mt-24 flex-col gap-3"
              >
                <div className="flex items-baseline gap-2.5">
                  <h2 id="anfragen-titel" className="t-rubrik">
                    Anfragen
                  </h2>
                  <span
                    data-anfragen-zahl
                    style={{ font: "var(--type-rubrik)", color: "var(--text-3)" }}
                  >
                    {anfragen.length}
                  </span>
                </div>
                <SpaltenListe spalten={spalten} anzahl={anfragen.length}>
                  {(zeilen) =>
                    anfragen.map((a, i) => (
                      <FlowItem key={a.uid} index={i} className="mitglied-item min-w-0">
                        <AnfrageZeile
                          anfrage={a}
                          erste={i % zeilen === 0}
                          onOpen={() => setAnfrageDetail(a)}
                        />
                      </FlowItem>
                    ))
                  }
                </SpaltenListe>
              </section>
            )}

            {/* Offene Einladungen — nur, wenn es welche gibt. Ohne offene
                bleibt der Knopf oben der Weg; ein leerer Abschnitt stünde
                nur zwischen Kopf und Liste. */}
            {hatOffene && (
              <section
                id="einladungen"
                aria-labelledby="einladungen-titel"
                className="flex scroll-mt-24 flex-col gap-3"
              >
                <div className="flex items-baseline gap-2.5">
                  <h2 id="einladungen-titel" className="t-rubrik">
                    Offene Einladungen
                  </h2>
                  <span
                    style={{ font: "var(--type-rubrik)", color: "var(--text-3)" }}
                  >
                    {offeneEinladungen.length}
                  </span>
                </div>
                {copyError && (
                  <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                    Kopieren hat nicht geklappt. Öffne die Einladung und
                    übernimm den Link von Hand.
                  </p>
                )}
                <SpaltenListe spalten={spalten} anzahl={offeneEinladungen.length}>
                  {(zeilen) =>
                    offeneEinladungen.map((invite, i) => (
                      <FlowItem key={invite.code} index={i} className="mitglied-item min-w-0">
                        <EinladungZeile
                          invite={invite}
                          erste={i % zeilen === 0}
                          copied={copiedCode === invite.code}
                          onOpen={() => setInviteDetail(invite)}
                          onCopy={() => void handleCopy(invite)}
                        />
                      </FlowItem>
                    ))
                  }
                </SpaltenListe>
              </section>
            )}

            {/* Die Suche durchsucht ausschließlich die bereits geladene Liste
                des EIGENEN Gyms (siehe memberMatches); fremde Gyms sind für
                die Abfrage wie für die Firestore-Regeln gar nicht erst
                erreichbar. */}
            {members !== null && members.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <GooeySearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Name oder E-Mail…"
                  breiteAuf={280}
                />
                {/* Sortieren rechts, damit die Suche beim Aufklappen nach
                    rechts wachsen kann, ohne das Feld zu verschieben. */}
                <div className="w-[200px] shrink-0">
                  <Select
                    value={sortierung}
                    options={SORTIERUNGEN}
                    onChange={(v) => setSortierung(v as Sortierung)}
                    ariaLabel="Sortieren"
                  />
                </div>
              </div>
            )}

            {/* Liste erst mit Ladeergebnis (kein Leer-Blitz) */}
            {members === null ? null : members.length === 0 && !error ? (
              <p
                className="py-8 text-center"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Außer dir ist noch niemand da. Hol dein erstes Mitglied dazu —
                mit einer Einladung dauert das eine Minute.
              </p>
            ) : abschnitte.length === 0 ? (
              <p
                className="py-8 text-center"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Zu „{search}“ passt niemand.
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {abschnitte.map((ab) => (
                  <section key={ab.key ?? "alle"} className="flex flex-col gap-2">
                    {ab.key && (
                      <div className="flex items-baseline gap-2.5">
                        <h2 className="t-rubrik">{MEMBER_GROUP_LABEL[ab.key]}</h2>
                        <span
                          style={{ font: "var(--type-rubrik)", color: "var(--text-3)" }}
                        >
                          {ab.members.length}
                        </span>
                      </div>
                    )}
                    <SpaltenListe spalten={spalten} anzahl={ab.members.length}>
                      {(zeilen) =>
                        ab.members.map((member, i) => (
                          <FlowItem key={member.uid} index={i} className="mitglied-item min-w-0">
                            <MitgliedZeile
                              member={member}
                              group={ab.key}
                              erste={i % zeilen === 0}
                              isSelf={member.uid === user?.uid}
                              onOpen={() => setDetail(member)}
                            />
                          </FlowItem>
                        ))
                      }
                    </SpaltenListe>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Immer gerendert, `member={null}` heisst geschlossen — nur so kann
          das Sheet sich beim Schliessen zurueckverwandeln, statt zu
          verschwinden (components/motion/SheetShell). */}
      <MemberRoleSheet
        member={detail}
        onChanged={load}
        onClose={() => setDetail(null)}
      />

      {/* Eine neue Einladung ändert die Mitgliederliste nicht — dazu kommt
          jemand erst, wenn er den Code einlöst. Neu gelesen werden deshalb
          nur die Einladungen. */}
      <InviteCreateSheet
        open={inviting}
        canInviteTrainer={isVerwaltung}
        onCreated={loadInvites}
        onClose={() => setInviting(false)}
      />

      {/* Notiz ändern, Link kopieren, zurückziehen. Eine zurückgezogene
          Einladung fällt nach dem Neulesen aus dem Abschnitt. */}
      <InviteDetailSheet
        invite={inviteDetail}
        onChanged={loadInvites}
        onClose={() => setInviteDetail(null)}
      />

      {/* E-Mail schreiben oder erledigen. „Erledigt" löscht die Anfrage —
          danach fällt sie aus dem Abschnitt. */}
      <AnfrageDetailSheet
        anfrage={anfrageDetail}
        gymName={gymName}
        onChanged={loadAnfragen}
        onClose={() => setAnfrageDetail(null)}
      />
    </main>
  );
}

/** Mindestbreite einer Spalte und Abstand zwischen zwei Spalten (px). */
const SPALTE_MIN = 290;
const SPALTE_ABSTAND = 40;
const SPALTEN_MAX = 3;

/**
 * Wie viele Spalten in die Breite passen: eine auf dem Handy, zwei am
 * Laptop mit Seitenleiste, drei am Schreibtisch. Gemessen per
 * ResizeObserver am Element, nicht am Fenster — die Seitenleiste nimmt je
 * nach Gerät unterschiedlich viel weg.
 */
function useSpaltenzahl(el: HTMLElement | null): number {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([eintrag]) => {
      const breite = eintrag.contentRect.width;
      setN(
        Math.max(
          1,
          Math.min(
            SPALTEN_MAX,
            Math.floor((breite + SPALTE_ABSTAND) / (SPALTE_MIN + SPALTE_ABSTAND)),
          ),
        ),
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return n;
}

/**
 * Eine Liste in SENKRECHTEN Spalten: erst die erste Spalte von oben nach
 * unten, dann die nächste — alphabetisch liest man so weiter wie in einem
 * Verzeichnis, nicht im Zickzack. Ein Raster mit `grid-auto-flow: column`
 * und fester Zeilenzahl statt CSS-Spalten: So bleiben die Zeilen auf einer
 * Höhe, und StaggerFlow kann gehende Einträge weiter vermessen.
 * `children` bekommt die Zeilenzahl, damit jede Zeile weiß, ob sie oben in
 * ihrer Spalte steht (dort keine Linie).
 */
function SpaltenListe({
  spalten,
  anzahl,
  children,
}: {
  spalten: number;
  anzahl: number;
  children: (zeilen: number) => React.ReactNode;
}) {
  // Jeder Abschnitt nimmt DIESELBE Spaltenzahl, auch mit zwei Einträgen:
  // So stehen die Spalten über alle Gruppen hinweg bündig untereinander.
  const n = Math.max(1, spalten);
  const zeilen = Math.max(1, Math.ceil(anzahl / n));
  return (
    <StaggerFlow
      className="mitglieder-liste"
      style={{
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${zeilen}, auto)`,
        columnGap: SPALTE_ABSTAND,
      }}
    >
      {children(zeilen)}
    </StaggerFlow>
  );
}

const BIS_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
});

/**
 * Eine Anfrage „Probetraining vereinbaren" — dieselbe Zeile wie Mitglied und
 * Einladung. Name oben, darunter Eingang und der Anfang der Nachricht.
 */
function AnfrageZeile({
  anfrage,
  erste,
  onOpen,
}: {
  anfrage: GymAnfrage;
  /** Erste Zeile der Liste — ohne Linie darüber. */
  erste: boolean;
  onOpen: () => void;
}) {
  const tag = anfrageTag(anfrage.erstelltAm);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-press="surface"
      data-erste={erste || undefined}
      data-anfrage={anfrage.uid}
      className="mitglied-zeile"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{ color: "var(--accent-text)" }}
      >
        <Icon name="brief" size={24} strokeWidth={1.7} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className="truncate"
            style={{ font: "var(--type-body-strong)", color: "var(--text-body)" }}
          >
            {anfrage.name}
          </span>
          <span className="mitglied-marke">Probetraining</span>
        </span>
        <span className="mitglied-zeile__unter truncate">
          {tag}
          {anfrage.nachricht ? ` · ${anfrage.nachricht.replace(/\s+/g, " ")}` : ""}
        </span>
      </span>
    </button>
  );
}

/**
 * Eine offene Einladung — gebaut wie die Mitglieder-Zeile, damit beide
 * Listen gleich lesen. Oben der Code mit dem Kopieren-Symbol direkt daneben,
 * darunter Notiz, Plätze und Ablauf.
 *
 * Zwei Wege in einer Zeile: Das Klickziel liegt als unsichtbares Geschwister
 * über der ganzen Zeile und öffnet das Detail-Sheet, das Symbol am Code
 * kopiert den Link — der Alltagsgriff. Ein Knopf IM Knopf wäre ungültiges
 * HTML.
 */
function EinladungZeile({
  invite,
  erste,
  copied,
  onOpen,
  onCopy,
}: {
  invite: GymInvite;
  /** Erste Zeile der Liste — ohne Linie darüber. */
  erste: boolean;
  copied: boolean;
  onOpen: () => void;
  onCopy: () => void;
}) {
  const code = formatInviteCode(invite.code);
  const note = invite.note.trim();
  const plaetze =
    invite.maxUses === 1
      ? "Für eine Person"
      : `${invite.usedCount} von ${invite.maxUses} eingelöst`;
  const bis = invite.expiresAt ? `bis ${BIS_FMT.format(invite.expiresAt)}` : null;
  return (
    <div className="mitglied-zeile" data-erste={erste || undefined}>
      <button
        type="button"
        onClick={onOpen}
        data-press="surface"
        className="mitglied-zeile__ziel"
        aria-label={`Einladung ${note || code} öffnen`}
      />
      <span
        aria-hidden
        className="pointer-events-none relative flex h-10 w-10 shrink-0 items-center justify-center"
        style={{ color: "var(--accent-text)" }}
      >
        <Icon name="einladen" size={26} strokeWidth={1.7} />
      </span>
      <span className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className="truncate font-mono"
            style={{
              fontWeight: 700,
              letterSpacing: "var(--ls-label)",
              color: "var(--text-body)",
            }}
          >
            {code}
          </span>
          {/* Kopieren DIREKT am Code (Leon 30.09.: „zu weit weg von der
              Nummer"). Steht über dem Klickziel der Zeile und behält seine
              eigenen Ereignisse; die Hülle ist durchlässig, der Knopf nicht. */}
          <button
            type="button"
            onClick={onCopy}
            aria-label={copied ? "Link kopiert" : `Link zu ${code} kopieren`}
            title={copied ? "Kopiert" : "Link kopieren"}
            className="t-interactive pointer-events-auto relative -my-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
            style={{ color: "var(--accent-text)" }}
          >
            <Icon name={copied ? "check" : "copy"} size={18} strokeWidth={2} />
          </button>
          {invite.role === "trainer" && (
            <span className="mitglied-marke">Trainer</span>
          )}
        </span>
        <span className="mitglied-zeile__unter truncate">
          {note ? `${note} · ` : ""}
          {plaetze}
          {bis ? ` · ${bis}` : ""}
        </span>
      </span>
    </div>
  );
}

/**
 * Eine Zeile der Liste — Profilbild, Name, eine ruhige Unterzeile.
 *
 * OHNE RAHMEN (Leon 30.09.2026: „mir alles zu viel mit einzelnen Rahmen …
 * organisch, übersichtlich, intuitiv lesbar"): Die Zeilen stehen als EINE
 * Liste untereinander, getrennt nur von einer Haarlinie, die beim Profilbild
 * beginnt. Unter dem Zeiger hebt sich die Zeile als weiche Fläche ab. Die
 * Spalten laufen senkrecht (SpaltenListe): Man liest von oben nach unten,
 * nicht im Zickzack.
 *
 * Unter dem Namen steht, wie lange jemand dabei ist, und die E-Mail (in
 * normaler Schreibung — Namensgleiche wie die zwei „Theo Zimmer" sind nur an
 * ihr zu unterscheiden). Seit den Spalten (30.09.) ohne eigene Datumsspalte
 * und ohne Pfeil: In einer 300-px-Spalte kostete beides die E-Mail. Ein Recht steht nur dann am Namen, wenn es
 * ÜBER die Gruppe hinausgeht: der Cheftrainer in „Verwaltung" trägt
 * „Trainer".
 */
function MitgliedZeile({
  member,
  group,
  erste,
  isSelf,
  onOpen,
}: {
  member: StudentEntry;
  /** `null` = durchgehende Liste ohne Gruppen-Überschrift. */
  group: MemberGroup | null;
  /** Erste Zeile unter einer Überschrift — ohne Linie darüber. */
  erste: boolean;
  isSelf: boolean;
  onOpen: () => void;
}) {
  // Mit Überschrift sagt die Gruppe schon, was jemand macht — dann steht nur
  // ein Recht DARÜBER HINAUS am Namen. Ohne Überschrift stehen beide Rechte.
  const zeigeVerwaltung = group === null && member.rights.verwaltung;
  const zeigeTrainer =
    member.rights.trainer && (group === null || group === "verwaltung");
  const seit = membershipShort(memberSince(member));
  return (
    <button
      type="button"
      onClick={onOpen}
      data-press="surface"
      data-erste={erste || undefined}
      className="mitglied-zeile"
    >
      <Profilbild avatar={member.avatar} kuerzel={initialsOf(member)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className="truncate"
            style={{ font: "var(--type-body-strong)", color: "var(--text-body)" }}
          >
            {memberName(member)}
          </span>
          {isSelf && (
            <span className="mitglied-marke mitglied-marke--du">Du</span>
          )}
          {zeigeVerwaltung && (
            <span className="mitglied-marke">Verwaltung</span>
          )}
          {zeigeTrainer && <span className="mitglied-marke">Trainer</span>}
        </span>
        <span className="mitglied-zeile__unter truncate">
          {seit}
          {member.email ? ` · ${member.email}` : ""}
        </span>
      </span>
    </button>
  );
}
