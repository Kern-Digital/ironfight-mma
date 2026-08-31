"use client";

/**
 * Einladungen des Gyms (Multi-Gym Phase 2, Checkpoint 1B) — Übersicht im
 * Token-Look (DESIGN-BRIEF), Aufbau nach app/trainer/plans/page.tsx:
 * Ambient-Kopf, t-card-Zeilen, BTN_FONT, META_BASE/META_SIZE, ein Symbol
 * rechts in der Zeile.
 *
 * RECHTE: Einladen darf nur die Verwaltung (Leon 31.08.). Die Rolle
 * `verwaltung` entsteht erst in Checkpoint 3 — bis dahin steht `admin`
 * stellvertretend, hier wie in den Server-Routen und den Firestore-Regeln.
 * Ein Trainer ohne dieses Recht sieht deshalb nicht nur keinen Knopf: er darf
 * die Codes auch gar nicht lesen (Regel `gyms/{gymId}/invites`), denn wer die
 * Codes sieht, kann sie weiterreichen — und damit einladen.
 *
 * Gelesen wird per listGymInvites; GESCHRIEBEN wird ausschließlich über die
 * Server-Routen /api/invites/create und /revoke (lib/invites.ts).
 */

import InviteCreateSheet from "@/components/InviteCreateSheet";
import InviteDetailSheet from "@/components/InviteDetailSheet";
import InviteStatusChip from "@/components/InviteStatusChip";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { copyText } from "@/lib/clipboard";
import { resolveGymId } from "@/lib/gym";
import {
  formatInviteCode,
  INVITE_ROLE_LABEL,
  inviteJoinUrl,
  inviteStatus,
  listGymInvites,
  type GymInvite,
} from "@/lib/invites";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// Größe kommt responsiv über Klassen (Muster der Plan-Übersicht)
const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const META_SIZE = "text-[10px] sm:text-[13px]";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default function TrainerInvitesPage() {
  const { user, profile, profileLoading } = useAuth();
  // Bis Checkpoint 3 ist `admin` die Verwaltung (siehe Kopf).
  const isVerwaltung = profile?.role === "admin";

  const [invites, setInvites] = useState<GymInvite[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<GymInvite | null>(null);
  // Code, dessen Link gerade kopiert wurde (Symbol wechselt kurz auf „check")
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);

  const load = useCallback(() => {
    if (!user || profileLoading || !isVerwaltung) return;
    listGymInvites(resolveGymId(profile))
      .then((list) => {
        setInvites(list);
        setError(false);
      })
      .catch(() => {
        setInvites([]);
        setError(true);
      });
  }, [user, profile, profileLoading, isVerwaltung]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (Muster der Workout-Seiten) */}
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
              Einladungen
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Lade neue Athleten und Trainer in dein Gym ein und bau dein Team
              weiter aus.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {!isVerwaltung ? (
          /* Trainer ohne Verwaltungsrecht: klare Ansage statt leerer Liste —
             die Regeln würden das Lesen ohnehin abweisen. */
          <p
            className="py-8 text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            {profileLoading
              ? ""
              : "Einladungen verwaltet die Gym-Verwaltung. Wende dich an sie, wenn jemand neu dazukommen soll."}
          </p>
        ) : (
          <>
            <div>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                <Icon name="plus" size={13} strokeWidth={2.4} />
                Einladung erstellen
              </button>
            </div>

            {error && (
              <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                Einladungen konnten nicht geladen werden.
              </p>
            )}
            {copyError && (
              <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                Kopieren hat nicht geklappt — öffne die Einladung und übernimm
                den Link von Hand.
              </p>
            )}

            {/* Liste erst mit Ladeergebnis (kein Leer-Blitz) */}
            {invites === null ? null : invites.length === 0 && !error ? (
              <p
                className="py-8 text-center"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Noch keine Einladungen — erstell die erste und hol dein
                nächstes Mitglied dazu.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {invites.map((invite) => {
                  const usable = inviteStatus(invite) === "open";
                  const copied = copiedCode === invite.code;
                  return (
                    <div
                      key={invite.code}
                      className="t-card t-row-card relative flex items-start gap-4 p-4 sm:items-center sm:p-5"
                    >
                      {/* Klickziel über der GANZEN Karte (siehe .t-row-card) */}
                      <button
                        type="button"
                        onClick={() => setDetail(invite)}
                        className="t-row-target absolute inset-0 rounded-[var(--r-lg)]"
                        aria-label={`Einladung ${formatInviteCode(invite.code)} ansehen`}
                      />
                      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span
                            className="font-mono-ta text-base sm:text-lg"
                            style={{
                              fontWeight: 700,
                              color: "var(--text-body)",
                            }}
                          >
                            {formatInviteCode(invite.code)}
                          </span>
                          <InviteStatusChip invite={invite} />
                        </div>
                        <div className="mt-1 flex flex-col gap-0.5">
                          <span
                            className={META_SIZE}
                            style={{ ...META_BASE, color: "var(--text-2)" }}
                          >
                            {INVITE_ROLE_LABEL[invite.role]} ·{" "}
                            {invite.usedCount} von {invite.maxUses} ·{" "}
                            {invite.expiresAt
                              ? `gültig bis ${DATE_FMT.format(invite.expiresAt)}`
                              : "ohne Ablauf"}
                          </span>
                          {invite.note && (
                            <span
                              className="truncate"
                              style={{
                                font: "var(--type-sub)",
                                color: "var(--text-3)",
                              }}
                            >
                              {invite.note}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Zeilen-Symbol: der Alltagsgriff ist „Link kopieren";
                          Zurückziehen liegt im Detail-Sheet. Steht über dem
                          Klickziel und behält seine eigenen Ereignisse. */}
                      <button
                        type="button"
                        onClick={() => void handleCopy(invite)}
                        disabled={!usable}
                        aria-label={`Link zu ${formatInviteCode(invite.code)} kopieren`}
                        className="t-interactive relative -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-field disabled:opacity-40 sm:mt-0 sm:h-14 sm:w-14"
                        style={{
                          color: usable
                            ? "var(--accent-text)"
                            : "var(--text-3)",
                        }}
                      >
                        <Icon
                          name={copied ? "check" : "copy"}
                          size={20}
                          strokeWidth={2}
                          className="sm:hidden"
                        />
                        <Icon
                          name={copied ? "check" : "copy"}
                          size={34}
                          strokeWidth={1.8}
                          className="hidden sm:block"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {creating && (
        <InviteCreateSheet
          canInviteTrainer={isVerwaltung}
          onCreated={load}
          onClose={() => setCreating(false)}
        />
      )}

      {detail && (
        <InviteDetailSheet
          invite={detail}
          onChanged={load}
          onClose={() => setDetail(null)}
        />
      )}
    </main>
  );
}
