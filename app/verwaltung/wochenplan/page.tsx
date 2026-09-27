"use client";

/**
 * WOCHENPLAN — die Trainingswoche des Gyms, mit Trainer je Kurs.
 *
 * Leon 26.09.2026: „Kurs bekommt Trainer" (Weg 2, Kursplan je Gym).
 * Leon 27.09.2026: „in der verwaltungsebene soll der Kursplan wochenplan
 * heißen und wenn ich darauf gehe dann soll ich kurse hinzufügen können,
 * bearbeiten etc." — deshalb ist das hier EINE Seite im selben Raster wie der
 * Kursplan (components/schedule/WochenRaster), nur dass ein Tipp auf den Kurs
 * den KURS öffnet (Tag, Uhrzeit, Trainer) und nicht die Stunde dieser Woche.
 * Die kurze Zwischenfassung als Liste unter /verwaltung/kurse gibt es nicht
 * mehr.
 *
 * WAS HIER PASSIERT UND WAS NICHT:
 *   · Hier: Kurs anlegen, Tag und Uhrzeit, Kampfart, Gruppe, Trainer.
 *   · Im Kursplan (/schedule): was in der Stunde dieser Woche geübt wird —
 *     das pflegen Trainer UND Verwaltung wie bisher.
 *
 * DER TRAINER IST PFLICHT (Leon 16.09.: „ein Kurs braucht immer einen
 * Trainer"). Die aus der alten Konstante übernommenen Kurse stehen ohne da;
 * die Seite zählt sie oben und sagt es in jeder Zeile in Worten, nicht nur in
 * Farbe. Wer das Gym verlassen oder sein Trainer-Häkchen verloren hat, zählt
 * nicht mehr als Trainer — sein Kurs steht dann wieder offen da.
 *
 * RECHTE: nur mit Verwaltungs-Häkchen — auch für einen Trainer, der es trägt
 * (Leon 26.09.). Middleware und VerwaltungRoute lassen niemanden sonst
 * herein, der Server prüft beim Schreiben noch einmal.
 */

import KursSheet, { type KursSheetZiel } from "@/components/KursSheet";
import RaeumeSheet from "@/components/RaeumeSheet";
import { DayColumn } from "@/components/schedule/WochenRaster";
import { SeitenZurueck } from "@/components/shell/KopfNavigation";
import Icon from "@/components/ui/Icon";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { kurseGruppieren, kurseOhneTrainer } from "@/lib/kursplan";
import { useKursplan } from "@/lib/kursplan-context";
import { memberName } from "@/lib/members";
import { getBlocksForDay, getCurrentWeekday, WEEKDAY_LABELS } from "@/lib/schedule";
import type { TrainingBlock } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

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

/** Filterwert für Kurse ohne (gültigen) Raum. */
const OHNE_RAUM = "__ohne-raum__";

export default function VerwaltungWochenplanPage() {
  const { user, profile, profileLoading } = useAuth();
  const istVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);
  const { kurse, geladen, raeume } = useKursplan();
  // Ab zwei Räumen steht der Raum am Kurs, und der Plan lässt sich danach
  // filtern (Leon 27.09.). "" = alle, OHNE_RAUM = Kurse ohne Raum.
  const mitRaeumen = raeume.length >= 2;
  const [raumFilter, setRaumFilter] = useState("");
  const [raeumeOffen, setRaeumeOffen] = useState(false);
  const heute = getCurrentWeekday();

  const [trainer, setTrainer] = useState<StudentEntry[] | null>(null);
  const [ziel, setZiel] = useState<KursSheetZiel | null>(null);

  // Wer kann einen Kurs geben? Alle Mitglieder mit Trainer-Häkchen.
  useEffect(() => {
    if (!user || profileLoading || !istVerwaltung) return;
    let lebt = true;
    listAllMembers(gymId)
      .then((liste) => {
        if (!lebt) return;
        setTrainer(
          liste
            .filter((m) => m.rights.trainer)
            .sort((a, b) => memberName(a).localeCompare(memberName(b), "de", { sensitivity: "base" })),
        );
      })
      .catch(() => {
        if (lebt) setTrainer([]);
      });
    return () => {
      lebt = false;
    };
  }, [user, profileLoading, istVerwaltung, gymId]);

  const trainerName = useMemo(() => {
    const m = new Map((trainer ?? []).map((t) => [t.uid, memberName(t)]));
    return (uid: string) => m.get(uid);
  }, [trainer]);

  const offen = useMemo(
    () => (trainer === null ? [] : kurseOhneTrainer(kurse, (uid) => trainerName(uid) !== undefined)),
    [kurse, trainer, trainerName],
  );
  const offenIds = useMemo(() => new Set(offen.map((k) => k.id)), [offen]);
  // Gezählt werden KURSE (Namen), nicht Termine — „MMA Teens" an vier
  // Terminen ist ein Kurs, der einen Trainer braucht (Leon 27.09.).
  const offeneKurse = useMemo(() => new Set(offen.map((k) => k.title)).size, [offen]);
  const kursZahl = useMemo(() => kurseGruppieren(kurse).length, [kurse]);

  const raumName = useMemo(() => new Map(raeume.map((r) => [r.id, r.name])), [raeume]);
  // Ein Filter auf einen gelöschten Raum darf nicht unsichtbar weiterfiltern.
  const filter = mitRaeumen && (raumFilter === OHNE_RAUM || raumName.has(raumFilter)) ? raumFilter : "";
  const sichtbar = useMemo(
    () =>
      filter === ""
        ? kurse
        : kurse.filter((k) => (filter === OHNE_RAUM ? !k.raumId || !raumName.has(k.raumId) : k.raumId === filter)),
    [kurse, filter, raumName],
  );
  const ohneRaum = mitRaeumen && kurse.some((k) => !k.raumId || !raumName.has(k.raumId));

  /** Unter jedem Kurs: der Raum (ab zwei Räumen), dann der Trainer. */
  function zusatzZeilen(k: TrainingBlock) {
    const raum = mitRaeumen && k.raumId ? raumName.get(k.raumId) : undefined;
    return (
      <>
        {raum && (
          <span className="flex items-start gap-1.5" style={{ font: "var(--type-sub)", color: "var(--text-2)", overflowWrap: "anywhere" }}>
            <span className="mt-[3px] shrink-0">
              <Icon name="mat" size={12} strokeWidth={2.2} />
            </span>
            {raum}
          </span>
        )}
        {trainerZeile(k)}
      </>
    );
  }

  /** Die Trainer-Zeile unter jedem Kurs: Namen, sonst die Aufforderung. */
  function trainerZeile(k: TrainingBlock) {
    if (trainer === null) return null;
    const fehlt = offenIds.has(k.id);
    const namen = (k.trainerUids ?? []).map(trainerName).filter((n): n is string => !!n);
    return (
      <span
        className="flex items-start gap-1.5"
        style={{
          font: "var(--type-sub)",
          color: fehlt ? "var(--accent-text)" : "var(--text-2)",
          fontWeight: fehlt ? 600 : undefined,
          overflowWrap: "anywhere",
        }}
      >
        <span className="mt-[3px] shrink-0">
          <Icon name={fehlt ? "plus" : "user"} size={12} strokeWidth={2.2} />
        </span>
        {fehlt ? "Trainer zuweisen" : namen.join(", ")}
      </span>
    );
  }

  return (
    <main className="min-h-screen pb-12" style={{ background: "var(--surface-page)", color: "var(--text-body)" }}>
      {/* `week-page` wie im Kursplan: Ob sieben Tage nebeneinander passen,
          hängt am Platz NEBEN der Sidebar (globals.css, „Wochenplan-Raster"). */}
      <div className="week-page">
        <section className="relative">
          <div
            className="absolute inset-0 overflow-hidden"
            aria-hidden
            style={{
              maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            }}
          >
            <div data-ambient style={{ background: "var(--ambient)" }} />
          </div>
          <div className="week-lane relative flex items-start gap-3 pb-5 pt-4 lg:pb-7 lg:pt-6">
            <div className="flex flex-1 flex-col gap-1">
              <SeitenZurueck href="/verwaltung" label="Verwaltung" />
              <h1
                style={{
                  font: "var(--type-display)",
                  letterSpacing: "var(--ls-display)",
                  textTransform: "uppercase",
                }}
              >
                Wochenplan
              </h1>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Deine Trainingswoche: Tag, Uhrzeit und wer den Kurs gibt. Was du hier änderst, steht sofort im
                Kursplan deiner Athleten.
              </p>
            </div>
          </div>
        </section>

        {!istVerwaltung ? (
          <p className="week-lane py-8 text-center" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {profileLoading ? "" : "Den Wochenplan legt die Verwaltung deines Gyms an."}
          </p>
        ) : !geladen ? null : (
          <>
            <div className="week-lane flex flex-col gap-4 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={META_SIZE} style={{ ...META_BASE, color: "var(--text-2)" }}>
                  {kurse.length === 0
                    ? "Noch kein Kurs"
                    : `${kursZahl} ${kursZahl === 1 ? "Kurs" : "Kurse"} · ${kurse.length} ${kurse.length === 1 ? "Termin" : "Termine"}`}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-press
                    onClick={() => setRaeumeOffen(true)}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                    style={{ ...BTN_FONT, border: "1px solid var(--line-strong)", color: "var(--text-1)" }}
                    data-raeume-knopf
                  >
                    <Icon name="mat" size={14} strokeWidth={2.2} />
                    {raeume.length === 0 ? "Räume" : `Räume · ${raeume.length}`}
                  </button>
                  <button
                    type="button"
                    data-press
                    onClick={() => setZiel({ art: "neu" })}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                    style={{
                      ...BTN_FONT,
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                      boxShadow: "var(--accent-glow)",
                    }}
                    data-kurs-anlegen
                  >
                    <Icon name="plus" size={13} strokeWidth={2.4} />
                    Kurs anlegen
                  </button>
                </span>
              </div>

              {/* Filter nach Raum — erst ab zwei Räumen, sonst trennt er nichts */}
              {mitRaeumen && (
                <div role="group" aria-label="Nach Raum filtern" className="flex flex-wrap gap-2.5" data-raum-filter>
                  {[
                    { id: "", name: "Alle Räume" },
                    ...raeume,
                    ...(ohneRaum ? [{ id: OHNE_RAUM, name: "Ohne Raum" }] : []),
                  ].map((r) => {
                    const an = filter === r.id;
                    return (
                      <button
                        key={r.id || "alle"}
                        type="button"
                        data-press
                        aria-pressed={an}
                        onClick={() => setRaumFilter(r.id)}
                        // Groß wie die übrigen Knöpfe der Seite (Leon 27.09.: „mach den
                        // ausgewählten raum größer … das ganze feld dazu"); der gewählte
                        // trägt zusätzlich einen Rand in Akzentfarbe.
                        className="t-interactive inline-flex min-h-hit items-center whitespace-nowrap rounded-field px-4"
                        style={{
                          font: "600 14px/1.2 var(--font-archivo), system-ui, sans-serif",
                          background: an ? "var(--accent-subtle)" : "var(--surface-raised)",
                          color: an ? "var(--accent-text)" : "var(--text-2)",
                          border: `1px solid ${an ? "var(--accent)" : "var(--line)"}`,
                        }}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {kurse.length === 0 && (
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)", maxWidth: "60ch" }} data-kurse-leer>
                  Leg deinen ersten Kurs an: Name, Tag, Uhrzeit und wer ihn gibt. Danach steht er im Kursplan, und
                  deine Athleten melden sich direkt zurück.
                </p>
              )}

              {/* Offene Kurse: in Worten, mit Zahl — Farbe ist nie das
                  einzige Signal. Der Mangel gehört dem Kurs, nicht dem Leser. */}
              {offeneKurse > 0 && (
                <p
                  className="flex items-start gap-2.5 rounded-field px-4 py-3"
                  style={{
                    font: "var(--type-sub)",
                    color: "var(--text-1)",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line-strong)",
                  }}
                  data-kurse-offen={offeneKurse}
                >
                  <span className="mt-0.5 shrink-0" style={{ color: "var(--accent-text)" }}>
                    <Icon name="users" size={16} strokeWidth={2.2} />
                  </span>
                  <span>
                    {offeneKurse === 1 ? "1 Kurs braucht" : `${offeneKurse} Kurse brauchen`} noch einen
                    Trainer. Tipp einen Kurs an und wähl aus, wer ihn gibt.
                  </span>
                </p>
              )}
            </div>

            <div className="week-lane week-grid pt-1">
              {WEEKDAY_LABELS.map((label, i) => (
                <DayColumn
                  key={i}
                  label={label}
                  blocks={getBlocksForDay(sichtbar, i)}
                  isToday={i === heute}
                  onBlockClick={(termin) => setZiel({ art: "kurs", titel: termin.title })}
                  zusatz={zusatzZeilen}
                  fuss={
                    <button
                      type="button"
                      data-press
                      onClick={() => setZiel({ art: "neu", weekday: i })}
                      aria-label={`Kurs am ${label} anlegen`}
                      className="t-interactive my-1 inline-flex min-h-hit w-full items-center gap-1.5 rounded-badge"
                      style={{ ...BTN_FONT, fontSize: "11px", color: "var(--text-3)" }}
                      data-kurs-anlegen-tag={i}
                    >
                      <Icon name="plus" size={12} strokeWidth={2.4} />
                      Kurs
                    </button>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Immer gerendert, `ziel={null}` heißt geschlossen — so verwandelt
          sich das Sheet beim Schließen zurück (components/motion/SheetShell). */}
      <KursSheet ziel={ziel} trainer={trainer} onClose={() => setZiel(null)} />
      <RaeumeSheet offen={raeumeOffen} onClose={() => setRaeumeOffen(false)} />
    </main>
  );
}
