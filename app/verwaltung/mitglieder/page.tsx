"use client";

/**
 * Mitgliederbereich (Multi-Gym Phase 2, Konzept §4) — die Liste aller
 * Menschen im Gym mit den beiden Rechte-Häkchen.
 *
 * Aufbau im Token-Look nach app/verwaltung/einladungen/page.tsx:
 * Ambient-Kopf, `.t-card`-Zeilen, BTN_FONT, META_BASE/META_SIZE.
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

import GooeySearch from "@/components/ui/GooeySearch";
import MemberRoleSheet from "@/components/MemberRoleSheet";
import Icon from "@/components/ui/Icon";
import { StaggerList } from "@/components/motion";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  MEMBER_GROUP_LABEL,
  memberGroupOf,
  memberMatches,
  memberName,
  membershipShort,
  memberSince,
} from "@/lib/members";
import { rightsLabel } from "@/lib/roles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const META_SIZE = "text-[10px] sm:text-[13px]";

type MemberGroup = ReturnType<typeof memberGroupOf>;

const GROUP_ORDER: MemberGroup[] = ["verwaltung", "trainer", "athlet"];

export default function TrainerMembersPage() {
  const { user, profile, profileLoading } = useAuth();
  // Verwaltungsrecht kommt aus dem Custom Claim (auth-context spiegelt ihn);
  // der Plattform-Admin verwaltet jedes Gym.
  const isVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<StudentEntry | null>(null);

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

  const visibleCount = useMemo(
    () => GROUP_ORDER.reduce((n, k) => n + groups[k].length, 0),
    [groups],
  );

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
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href="/trainer"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{
                ...BTN_FONT,
                color: "var(--text-3)",
                textDecoration: "none",
              }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Trainer
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Mitglieder
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Hier steht dein ganzes Gym. Jeder ist zuerst Athlet — mit den
              beiden Häkchen machst du daraus einen Trainer, jemanden aus der
              Verwaltung oder beides.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
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

            {/* Suche steht oben und immer — auch bei zwölf Mitgliedern ist
                sie schneller als das Auge. Sie durchsucht ausschließlich die
                bereits geladene Liste des EIGENEN Gyms (siehe memberMatches);
                fremde Gyms sind für die Abfrage wie für die Firestore-Regeln
                gar nicht erst erreichbar. */}
            {members !== null && members.length > 0 && (
              <GooeySearch
                value={search}
                onChange={setSearch}
                placeholder="Mitglied suchen…"
              />
            )}

            {members !== null && members.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span
                  className={META_SIZE}
                  style={{ ...META_BASE, color: "var(--text-2)" }}
                >
                  {counts.total} {counts.total === 1 ? "Mitglied" : "Mitglieder"}{" "}
                  · {counts.trainer} Trainer · {counts.verwaltung} Verwaltung
                </span>
              </div>
            )}

            {/* Liste erst mit Ladeergebnis (kein Leer-Blitz) */}
            {members === null ? null : members.length === 0 && !error ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Außer dir ist noch niemand da. Hol dein erstes Mitglied
                  dazu — mit einer Einladung dauert das eine Minute.
                </p>
                <Link
                  href="/verwaltung/einladungen"
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
                  Einladung erstellen
                </Link>
              </div>
            ) : visibleCount === 0 ? (
              <p
                className="py-8 text-center"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Zu „{search}“ passt niemand.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {GROUP_ORDER.map((key) => {
                  const list = groups[key];
                  if (list.length === 0) return null;
                  return (
                    <StaggerList
                      as="section"
                      key={key}
                      className="flex flex-col gap-3"
                    >
                      <span className="t-label">
                        {MEMBER_GROUP_LABEL[key]} · {list.length}
                      </span>
                      {list.map((member) => {
                        const rights = member.rights;
                        const isSelf = member.uid === user?.uid;
                        return (
                          <button
                            key={member.uid}
                            type="button"
                            onClick={() => setDetail(member)}
                            className="t-card t-interactive flex w-full items-center gap-4 p-4 text-left sm:p-5"
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex flex-wrap items-baseline gap-x-2">
                                <span
                                  className="truncate"
                                  style={{
                                    font: "var(--type-body-strong)",
                                    color: "var(--text-body)",
                                  }}
                                >
                                  {memberName(member)}
                                </span>
                                {isSelf && (
                                  <span
                                    style={{
                                      ...META_BASE,
                                      fontSize: "10px",
                                      color: "var(--accent-text)",
                                    }}
                                  >
                                    Du
                                  </span>
                                )}
                              </span>
                              <span
                                className={`${META_SIZE} truncate`}
                                style={{ ...META_BASE, color: "var(--text-2)" }}
                              >
                                {rightsLabel(rights)} ·{" "}
                                {membershipShort(memberSince(member))}
                                {member.email ? ` · ${member.email}` : ""}
                              </span>
                            </div>
                            <span
                              aria-hidden
                              className="shrink-0"
                              style={{ color: "var(--text-3)" }}
                            >
                              <Icon
                                name="arrow-right"
                                size={18}
                                strokeWidth={2}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </StaggerList>
                  );
                })}
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
    </main>
  );
}
