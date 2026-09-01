"use client";

/**
 * Neuigkeiten (Multi-Gym Phase 2, Checkpoint 2) — Leons Wunsch vom
 * 31.08.2026: „Benachrichtigung der Verwaltung bei neuer Registrierung, im
 * Bereich der Neuigkeiten."
 *
 * QUELLE IST DAS AUDIT-LOG, keine zweite Sammlung: Der Vorgang „X ist
 * beigetreten" steht dort seit Checkpoint 1A (/api/invites/redeem). Zwei
 * Schreibpfade auf denselben Vorgang würden auseinanderdriften, sobald einer
 * fehlschlägt — deshalb EIN Protokoll und hier EINE Sicht darauf.
 *
 * GEZEIGT WIRD NUR, WAS MENSCHEN BETRIFFT (`NEWS_TYPES`): wer beigetreten
 * ist, wessen Rechte sich geändert haben, wer das Gym verlassen hat. Die
 * Einladungs-Buchhaltung (erstellt, zurückgezogen, Notiz geändert) stand hier
 * bis zum 01.09. unter „Alle Vorgänge" — sie ist aber kein Ereignis, sondern
 * der Zustand einer Einladung, und den zeigt /verwaltung/einladungen an jeder
 * Zeile. Nebenbei führte diese Ansicht die Codes im Klartext mit.
 *
 * RECHTE: nur die Verwaltung. Die Middleware gated die Route
 * (lib/verwaltung-routes.ts), `VerwaltungRoute` das Layout, die
 * Firestore-Regeln das Lesen — die Einträge führen die Einladungscodes im
 * Klartext.
 */

import Icon from "@/components/ui/Icon";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  auditDetail,
  auditHeadline,
  auditIcon,
  dayLabel,
  isNewsEntry,
  listGymAuditLog,
  readNewsSeen,
  timeLabel,
  writeNewsSeen,
  type AuditEntry,
} from "@/lib/audit";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export default function TrainerNewsPage() {
  const { user, profile, profileLoading } = useAuth();
  const isVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);

  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState(false);
  /**
   * Der Stand des LETZTEN Besuchs — einmal beim Öffnen eingefroren. Würde er
   * mitlaufen, verschwänden die „Neu"-Punkte noch während man sie liest.
   */
  const [seenBefore, setSeenBefore] = useState<number | null>(null);
  const stamped = useRef(false);

  const load = useCallback(() => {
    if (!user || profileLoading || !isVerwaltung) return;
    listGymAuditLog(gymId)
      .then((list) => {
        setEntries(list);
        setError(false);
      })
      .catch(() => {
        setEntries([]);
        setError(true);
      });
  }, [user, profileLoading, isVerwaltung, gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // Besuchsstempel: erst lesen, dann setzen — und nur einmal pro Aufruf.
  useEffect(() => {
    if (!isVerwaltung || stamped.current) return;
    stamped.current = true;
    setSeenBefore(readNewsSeen(gymId));
    writeNewsSeen(gymId);
  }, [isVerwaltung, gymId]);

  const visible = useMemo(() => (entries ?? []).filter(isNewsEntry), [entries]);

  /** Einträge zu Tagen bündeln — die Reihenfolge bleibt (neueste zuerst). */
  const days = useMemo(() => {
    const out: { label: string; items: AuditEntry[] }[] = [];
    for (const entry of visible) {
      const label = dayLabel(entry.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [visible]);

  const freshCount = useMemo(() => {
    if (seenBefore === null) return 0;
    return (entries ?? []).filter(
      (e) => isNewsEntry(e) && e.at && e.at.getTime() > seenBefore,
    ).length;
  }, [entries, seenBefore]);

  function isFresh(entry: AuditEntry): boolean {
    return (
      seenBefore !== null && !!entry.at && entry.at.getTime() > seenBefore
    );
  }

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
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
              Neuigkeiten
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {freshCount > 0
                ? `Seit deinem letzten Besuch gibt es hier ${
                    freshCount === 1
                      ? "eine Neuigkeit"
                      : `${freshCount} Neuigkeiten`
                  }: wer dazugekommen ist und wer andere Rechte bekommen hat.`
                : "Wer neu dazugekommen ist und wer andere Rechte bekommen hat — die letzten Vorgänge in deinem Gym."}
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
              : "Die Neuigkeiten des Gyms sieht die Verwaltung."}
          </p>
        ) : (
          <>
            {error && (
              <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
                Die Neuigkeiten konnten nicht geladen werden.
              </p>
            )}

            {entries === null ? null : visible.length === 0 && !error ? (
              <p
                className="py-8 text-center"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Noch ist niemand neu dazugekommen. Sobald jemand deine
                Einladung einlöst, steht es hier.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {days.map((day) => (
                  <section key={day.label} className="flex flex-col gap-3">
                    <span className="t-label">{day.label}</span>
                    {day.items.map((entry) => {
                      const fresh = isFresh(entry);
                      return (
                        <div
                          key={entry.id}
                          className="t-card flex items-start gap-3.5 p-4 sm:p-5"
                        >
                          <span
                            aria-hidden
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                            style={{
                              background: "var(--accent-subtle)",
                              color: "var(--accent-text)",
                            }}
                          >
                            <Icon
                              name={auditIcon(entry)}
                              size={16}
                              strokeWidth={2}
                            />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span
                              style={{
                                font: "var(--type-body)",
                                color: "var(--text-body)",
                              }}
                            >
                              {auditHeadline(entry)}
                            </span>
                            {auditDetail(entry) && (
                              <span
                                style={{
                                  font: "var(--type-sub)",
                                  color: "var(--text-3)",
                                }}
                              >
                                {auditDetail(entry)}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span
                              style={{
                                ...META_BASE,
                                fontSize: "10px",
                                color: "var(--text-3)",
                              }}
                            >
                              {timeLabel(entry.at)}
                            </span>
                            {fresh && (
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--accent)" }}
                                aria-label="Seit deinem letzten Besuch"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
