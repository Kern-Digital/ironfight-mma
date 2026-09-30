"use client";

/**
 * KURS ANLEGEN UND BEARBEITEN — das Sheet des Wochenplans der Verwaltung.
 *
 * Leon 26.09.2026: „Kurs bekommt Trainer". Leon 27.09.2026: „bedenke auch
 * das ein kurs an mehreren Tagen passieren kann … für mehrere tage und dann
 * noch für unterschiedliche zeiten. finde eine user freundliche lösung die
 * nicht verwirrend ist."
 *
 * DIE LÖSUNG: Oben steht, was für den GANZEN Kurs gilt — Name, Kampfart,
 * Gruppe, Trainer. Darunter die TAGE zum Antippen, mehrere auf einmal (Leon
 * 27.09.: „wenn ich auf tag klicke möchte ich mehrere auswählen und wenn ich
 * dann auf dem kurs an jeweiligen tag bin ändere ich für dort die uhrzeit").
 * Je gewähltem Tag eine Zeile mit seiner Uhrzeit (TimePicker, HH : MM, 24 h —
 * Leon: „dass das menü so aussieht. nur ohne am pm") und ab zwei Räumen dem
 * Raum. Ein Kurs an drei Tagen ist so EIN Formular, nicht dreimal dasselbe. Im Wochenplan stehen die
 * Termine weiter einzeln an ihren Tagen; ein Tipp auf irgendeinen davon
 * öffnet hier den ganzen Kurs.
 *
 * Geschrieben wird über `/api/gym/kurse` (`kurs-speichern` ersetzt alle
 * Termine des Kurses in einem Schritt, bestehende behalten ihre ID). Der
 * Server prüft Verwaltungsrecht und dass jeder Trainer wirklich Trainer
 * DIESES Gyms ist. Die Feldprüfung läuft hier vorab, damit der Satz unter
 * dem Knopf steht, bevor jemand auf den Server wartet.
 *
 * Das Sheet arbeitet in dem Plan, den die Verwaltung gerade gewählt hat
 * (`plan`, Leon 27.09.: mehrere Wochenpläne) — nicht zwingend im aktiven.
 * Nach dem Speichern braucht es nichts neu zu laden: Die Pläne kommen live
 * (useWochenplaene), der Wochenplan dahinter steht von selbst neu da.
 */

import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import XKnopf from "@/components/ui/XKnopf";
import { MorphSwap, SheetShell, useLetzterWert } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import type { StudentEntry } from "@/lib/admin";
import { memberName } from "@/lib/members";
import {
  KAMPFARTEN,
  KURS_GRUPPEN,
  KURS_GRUPPE_LABEL,
  KURSNAME_MAX,
  kursMitTerminenPruefen,
  minutenAus,
  TERMINE_MAX,
  termineKurz,
  ueberschneidungen,
  type KursEingabe,
  type KursGruppe,
  type Raum,
} from "@/lib/kursplan";
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/schedule";
import TimePicker from "@/components/ui/TimePicker";
import { DISCIPLINE_LABEL, type Discipline, type TrainingBlock } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

/**
 * Der Plan, in dem das Sheet arbeitet (Leon 27.09.: mehrere Wochenpläne).
 * `id` null = das Gym hat noch keinen Plan; der erste Kurs legt ihn an.
 */
export interface KursSheetPlan {
  id: string | null;
  name: string;
  kurse: TrainingBlock[];
  raeume: Raum[];
}

/** Was das Sheet öffnet: einen bestehenden Kurs (per Name) oder einen neuen. */
export type KursSheetZiel = { art: "neu"; weekday?: number } | { art: "kurs"; titel: string };

/** Eine Termin-Zeile im Formular. `schluessel` hält React die Zeile fest. */
interface TerminZeile {
  schluessel: string;
  id?: string;
  tag: number;
  von: string;
  bis: string;
  raum: string;
}

let zaehler = 0;
const neuerSchluessel = () => `t${Date.now().toString(36)}${(zaehler++).toString(36)}`;

/** „A", „A und B", „A, B und C" */
function aufzaehlung(namen: string[]): string {
  if (namen.length <= 1) return namen.join("");
  return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

function KursInhalt({
  ziel,
  plan,
  trainer,
  onClose,
}: {
  ziel: KursSheetZiel;
  plan: KursSheetPlan;
  /** Mitglieder DIESES Gyms mit Trainer-Häkchen; null = lädt noch. */
  trainer: StudentEntry[] | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { kurse, raeume } = plan;

  // Die Termine des Kurses, EINMAL beim Öffnen gelesen — ändert jemand
  // anderes den Plan, während das Formular offen ist, bleibt die Eingabe.
  const [alteTermine] = useState<TrainingBlock[]>(() =>
    ziel.art === "kurs" ? kurse.filter((k) => k.title === ziel.titel) : [],
  );
  const alterTitel = ziel.art === "kurs" && alteTermine.length > 0 ? ziel.titel : null;
  const erster = alteTermine[0];

  const [titel, setTitel] = useState(erster?.title ?? "");
  const [kampfart, setKampfart] = useState<string>(erster?.discipline ?? "");
  const [gruppe, setGruppe] = useState<string>(erster?.level ?? "");
  // Trainer gelten für den ganzen Kurs. Standen bei alten Terminen
  // verschiedene, kommen alle zusammen — nichts geht beim Öffnen verloren.
  const [trainerUids, setTrainerUids] = useState<string[]>(() =>
    Array.from(new Set(alteTermine.flatMap((t) => t.trainerUids ?? []))),
  );
  const [termine, setTermine] = useState<TerminZeile[]>(() =>
    alteTermine.length > 0
      ? alteTermine.map((t) => ({
          schluessel: t.id,
          id: t.id,
          tag: t.weekday,
          von: t.startTime,
          bis: t.endTime,
          raum: t.raumId ?? "",
        }))
      : [
          {
            schluessel: neuerSchluessel(),
            tag: ziel.art === "neu" ? (ziel.weekday ?? 0) : 0,
            von: "18:00",
            bis: "19:30",
            raum: "",
          },
        ],
  );

  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);

  // Ab ZWEI Räumen zählt der Raum (Leon 27.09.) — mit einem gibt es nichts zu wählen.
  const raumWahl = raeume.length >= 2;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Nur wer HEUTE Trainer im Gym ist, steht zur Wahl. Eine gespeicherte uid,
  // die das nicht mehr ist (ausgetreten, Häkchen weg), fällt beim Speichern
  // heraus — sonst lehnte der Server den ganzen Kurs ab.
  const trainerIds = useMemo(() => new Set((trainer ?? []).map((t) => t.uid)), [trainer]);
  const gewaehlt = trainerUids.filter((u) => trainerIds.has(u));
  const gewaehltNamen = (trainer ?? []).filter((t) => gewaehlt.includes(t.uid)).map(memberName);
  const nameVon = (uid: string) => {
    const m = (trainer ?? []).find((t) => t.uid === uid);
    return m ? memberName(m) : "Ein Trainer";
  };

  function eingabe(): KursEingabe {
    return {
      title: titel,
      discipline: (kampfart || null) as Discipline | null,
      level: (gruppe || null) as KursGruppe | null,
      trainerUids: gewaehlt,
      termine: termine.map((t) => ({
        id: t.id ?? null,
        weekday: t.tag,
        startTime: t.von,
        endTime: t.bis,
        raumId: raumWahl && raeume.some((r) => r.id === t.raum) ? t.raum : null,
      })),
    };
  }

  // Überschneidungen je Termin: nur WARNEN, speichern geht trotzdem (Leon
  // 27.09.). Die eigenen alten Termine zählen nicht als Gegenüber.
  const andere = kurse.filter((k) => k.title !== alterTitel);
  const warnungen = termine.flatMap((t) => {
    const raumId = raumWahl && t.raum ? t.raum : undefined;
    const k = ueberschneidungen(andere, {
      weekday: t.tag as TrainingBlock["weekday"],
      startTime: t.von,
      endTime: t.bis,
      raumId,
      trainerUids: gewaehlt,
    });
    const wann = termine.length > 1 ? `${WEEKDAY_LABELS[t.tag]} ${t.von}: ` : "";
    const raumName = raeume.find((r) => r.id === raumId)?.name ?? "";
    return [
      ...(k.raum.length > 0
        ? [`${wann}${raumName} ist zur selben Zeit schon belegt: ${k.raum.map((x) => `${x.title}, ${x.startTime}–${x.endTime}`).join(" · ")}.`]
        : []),
      ...k.trainer.map(
        (x) => `${wann}${nameVon(x.uid)} gibt zur selben Zeit schon ${x.kurs.title}, ${x.kurs.startTime}–${x.kurs.endTime}.`,
      ),
    ];
  });

  async function senden(body: Record<string, unknown>): Promise<boolean> {
    if (!user) return false;
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await fetch("/api/gym/kurse", {
        method: "POST",
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const daten = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFehler(daten.error ?? "Das ließ sich gerade nicht speichern.");
        return false;
      }
      return true;
    } catch {
      setFehler("Keine Verbindung. Versuch es gleich noch einmal.");
      return false;
    } finally {
      setLaeuft(false);
    }
  }

  async function speichern() {
    if (laeuft) return;
    const geprueft = kursMitTerminenPruefen(eingabe());
    if ("fehler" in geprueft) {
      setFehler(geprueft.fehler);
      return;
    }
    // Derselbe Satz wie vom Server, nur ohne den Umweg über ihn.
    const belegt = andere.find((k) => k.title.toLowerCase() === geprueft.title.toLowerCase());
    if (belegt) {
      setFehler(`Einen Kurs „${belegt.title}" gibt es schon. Öffne ihn und tipp dort den Tag dazu.`);
      return;
    }
    if (await senden({ aktion: "kurs-speichern", planId: plan.id, alterTitel, kurs: eingabe() })) onClose();
  }

  async function loeschen() {
    if (!alterTitel || laeuft) return;
    if (!loeschenFragen) {
      setLoeschenFragen(true);
      setFehler(null);
      return;
    }
    if (await senden({ aktion: "kurs-loeschen", planId: plan.id, titel: alterTitel })) onClose();
    else setLoeschenFragen(false);
  }

  function trainerUmschalten(uid: string) {
    setFehler(null);
    setTrainerUids((liste) => (liste.includes(uid) ? liste.filter((u) => u !== uid) : [...liste, uid]));
  }

  function terminAendern(schluessel: string, patch: Partial<TerminZeile>) {
    setFehler(null);
    setTermine((liste) => liste.map((t) => (t.schluessel === schluessel ? { ...t, ...patch } : t)));
  }

  /**
   * Tag an- oder abwählen (Leon 27.09.: „wenn ich auf tag klicke möchte ich
   * mehrere auswählen"). Ein neuer Tag übernimmt Uhrzeit und Raum des zuletzt
   * gewählten — meist läuft ein Kurs an allen Tagen gleich, und wo nicht,
   * stellt man die eine Zeile um. Abwählen nimmt alle Uhrzeiten des Tages.
   */
  function tagUmschalten(tag: number) {
    setFehler(null);
    setTermine((liste) => {
      if (liste.some((t) => t.tag === tag)) return liste.filter((t) => t.tag !== tag);
      const vorlage = liste[liste.length - 1];
      return [
        ...liste,
        {
          schluessel: neuerSchluessel(),
          tag,
          von: vorlage?.von ?? "18:00",
          bis: vorlage?.bis ?? "19:30",
          raum: vorlage?.raum ?? "",
        },
      ];
    });
  }

  /** Zweite Uhrzeit am selben Tag: direkt im Anschluss, gleich lang. */
  function zeitDazu(tag: number) {
    setFehler(null);
    setTermine((liste) => {
      const amTag = liste.filter((t) => t.tag === tag).sort((a, b) => a.von.localeCompare(b.von));
      const letzte = amTag[amTag.length - 1];
      const von = minutenAus(letzte?.bis ?? "18:00");
      const dauer = letzte ? minutenAus(letzte.bis) - minutenAus(letzte.von) : 90;
      const hhmm = (min: number) => {
        const x = Math.min(Math.max(min, 0), 23 * 60 + 55);
        return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
      };
      return [
        ...liste,
        { schluessel: neuerSchluessel(), tag, von: hhmm(von), bis: hhmm(von + (dauer > 0 ? dauer : 60)), raum: letzte?.raum ?? "" },
      ];
    });
  }

  // Gewählte Tage in Wochenreihenfolge, je Tag seine Uhrzeiten.
  const tage = Array.from(new Set(termine.map((t) => t.tag))).sort((a, b) => a - b);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-col items-start">
          <div
            aria-hidden
            className="mb-2 h-1 w-10 rounded-full sm:invisible"
            style={{ background: "var(--line-strong)" }}
          />
          <span className="t-sheet-title max-w-full truncate">{alterTitel ?? "Neuer Kurs"}</span>
          <span className="max-w-full truncate" style={{ ...META_FONT, color: "var(--text-3)" }}>
            {alterTitel ? termineKurz(alteTermine) : plan.name}
          </span>
        </div>
        <XKnopf
          onClick={onClose}
          ariaLabel="Schließen"
          wort="Schließen"
          drehung="roll"
          style={{ color: "var(--text-2)" }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
        <div className="flex flex-col gap-4 pb-3">
          <label className="flex flex-col gap-1.5">
            <span className="t-label">Name</span>
            <input
              type="text"
              value={titel}
              maxLength={KURSNAME_MAX}
              onChange={(e) => {
                setTitel(e.target.value);
                setFehler(null);
              }}
              placeholder="z. B. MMA Teens"
              className="min-h-hit rounded-field px-3"
              style={FELD}
              data-kurs-feld="name"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5" data-kurs-feld="kampfart">
              <span className="t-label">Kampfart</span>
              <Select
                value={kampfart}
                onChange={setKampfart}
                clearable
                placeholder="Keine"
                options={KAMPFARTEN.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d] }))}
              />
            </div>
            <div className="flex flex-col gap-1.5" data-kurs-feld="gruppe">
              <span className="t-label">Gruppe</span>
              <Select
                value={gruppe}
                onChange={setGruppe}
                clearable
                placeholder="Alle"
                options={KURS_GRUPPEN.map((g) => ({ value: g, label: KURS_GRUPPE_LABEL[g] }))}
              />
            </div>
          </div>

          {/* ── Tage und Uhrzeiten (Leon 27.09.) ─────────────────────────
              Oben die Tage zum Antippen, mehrere auf einmal. Darunter je
              gewähltem Tag seine Uhrzeit — dort stellt man sie für genau
              diesen Tag ein. Ein Tag mit zwei Stunden (z. B. MMA Teens am
              Mittwoch 16:00 und 17:15) bekommt über „+ Uhrzeit" eine zweite
              Zeile. */}
          <div className="flex flex-col gap-2" data-kurs-feld="tage">
            <span className="t-label">Tage</span>
            <div role="group" aria-label="Tage" className="flex flex-wrap gap-1.5 sm:gap-2">
              {WEEKDAY_SHORT.map((kurz, tag) => {
                const an = tage.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    data-press
                    aria-pressed={an}
                    aria-label={WEEKDAY_LABELS[tag]}
                    onClick={() => tagUmschalten(tag)}
                    className="t-interactive inline-flex min-h-hit min-w-hit items-center justify-center rounded-field px-1.5 sm:px-3"
                    style={{
                      font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
                      letterSpacing: "0.04em",
                      background: an ? "var(--accent-subtle)" : "var(--surface-raised)",
                      color: an ? "var(--accent-text)" : "var(--text-2)",
                      border: `1px solid ${an ? "transparent" : "var(--line)"}`,
                    }}
                    data-tag-chip={tag}
                  >
                    {kurz}
                  </button>
                );
              })}
            </div>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {tage.length === 0
                ? "Tipp die Tage an, an denen der Kurs läuft."
                : tage.length === 1
                  ? "Läuft der Kurs öfter, tipp weitere Tage an."
                  : "Die Uhrzeit stellst du für jeden Tag einzeln ein."}
            </p>
          </div>

          {tage.length > 0 && (
            <div className="flex flex-col gap-1" data-kurs-feld="uhrzeiten">
              <span className="t-label">Uhrzeit</span>
              {tage.map((tag, n) => {
                const amTag = termine
                  .filter((t) => t.tag === tag)
                  .sort((a, b) => a.von.localeCompare(b.von));
                return (
                  <div
                    key={tag}
                    className="flex flex-col gap-2 py-2.5"
                    style={n > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
                    data-tag-zeilen={tag}
                  >
                    {amTag.map((t, j) => (
                      <div key={t.schluessel} className="flex flex-col gap-2" data-termin={termine.indexOf(t)}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          {/* Der Tagesname steht nur vor der ersten Uhrzeit —
                              mobil in eigener Zeile, ab sm links daneben. */}
                          <span
                            className={`w-full sm:w-24 ${j > 0 ? "hidden sm:block" : ""}`}
                            style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}
                          >
                            {j === 0 ? WEEKDAY_LABELS[tag] : ""}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <div data-termin-feld="beginn">
                              <TimePicker
                                value={t.von}
                                onChange={(v) => terminAendern(t.schluessel, { von: v })}
                                ariaLabel={`Beginn am ${WEEKDAY_LABELS[tag]}`}
                              />
                            </div>
                            <span aria-hidden style={{ color: "var(--text-3)" }}>
                              –
                            </span>
                            <div data-termin-feld="ende">
                              <TimePicker
                                value={t.bis}
                                onChange={(v) => terminAendern(t.schluessel, { bis: v })}
                                ariaLabel={`Ende am ${WEEKDAY_LABELS[tag]}`}
                              />
                            </div>
                            {j > 0 && (
                              <button
                                type="button"
                                data-press
                                onClick={() => {
                                  setFehler(null);
                                  setTermine((liste) => liste.filter((x) => x.schluessel !== t.schluessel));
                                }}
                                aria-label={`Uhrzeit ${t.von} am ${WEEKDAY_LABELS[tag]} entfernen`}
                                className="t-interactive inline-flex h-hit w-9 items-center justify-center rounded-field"
                                style={{ color: "var(--text-3)" }}
                                data-termin-weg
                              >
                                <Icon name="minus" size={16} strokeWidth={2.4} />
                              </button>
                            )}
                          </div>
                        </div>
                        {raumWahl && (
                          <div className="sm:pl-[108px]" data-termin-feld="raum">
                            <Select
                              value={t.raum}
                              onChange={(v) => terminAendern(t.schluessel, { raum: v })}
                              clearable
                              placeholder="Kein Raum"
                              options={raeume.map((r) => ({ value: r.id, label: r.name }))}
                              ariaLabel={`Raum am ${WEEKDAY_LABELS[tag]} um ${t.von}`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {termine.length < TERMINE_MAX && (
                      <button
                        type="button"
                        data-press
                        onClick={() => zeitDazu(tag)}
                        className="t-interactive inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2 sm:ml-[100px]"
                        style={{ ...BTN_FONT, fontSize: "11px", color: "var(--text-3)" }}
                        aria-label={`Zweite Uhrzeit am ${WEEKDAY_LABELS[tag]}`}
                        data-zeit-dazu={tag}
                      >
                        <Icon name="plus" size={12} strokeWidth={2.4} />
                        Uhrzeit
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Trainer: Pflicht, mindestens einer (Leon 16./26.09.) ── */}
          <div className="flex flex-col gap-2" data-kurs-feld="trainer">
            <span className="t-label">Trainer</span>
            {trainer === null ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>Lädt …</p>
            ) : trainer.length === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                Gib zuerst einem Mitglied das Trainer-Recht. Danach wählst du es hier aus.{" "}
                <Link href="/verwaltung/mitglieder" style={{ color: "var(--accent-text)" }}>
                  Zu den Mitgliedern
                </Link>
              </p>
            ) : (
              <>
                <div role="group" aria-label="Trainer" className="flex flex-wrap gap-2">
                  {trainer.map((t) => {
                    const an = gewaehlt.includes(t.uid);
                    return (
                      <button
                        key={t.uid}
                        type="button"
                        data-press
                        aria-pressed={an}
                        onClick={() => trainerUmschalten(t.uid)}
                        className="t-interactive inline-flex items-center gap-1.5 whitespace-nowrap rounded-field px-3 py-2"
                        style={{
                          font: "600 12px/1.2 var(--font-archivo), system-ui, sans-serif",
                          background: an ? "var(--accent-subtle)" : "var(--surface-raised)",
                          color: an ? "var(--accent-text)" : "var(--text-2)",
                        }}
                      >
                        {an && <Icon name="check" size={12} strokeWidth={2.6} />}
                        {memberName(t)}
                      </button>
                    );
                  })}
                </div>
                {/* Der Hilfstext folgt der Auswahl (Hilfstext-Regel) */}
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {gewaehltNamen.length === 0
                    ? "Wähl aus, wer den Kurs gibt. Mehrere gehen auch, etwa für Co-Trainer oder Vertretung."
                    : `${aufzaehlung(gewaehltNamen)} ${gewaehltNamen.length === 1 ? "gibt" : "geben"} den Kurs${tage.length > 1 ? " an allen Tagen" : ""}.`}
                </p>
              </>
            )}
          </div>

          {/* Überschneidungen — Hinweis in Worten, speichern bleibt möglich */}
          {warnungen.length > 0 && (
            <div
              className="flex items-start gap-2.5 rounded-field px-3 py-2.5"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--line-strong)" }}
              data-kurs-warnung={warnungen.length}
            >
              <span className="mt-0.5 shrink-0" style={{ color: "var(--accent-text)" }}>
                <Icon name="info" size={15} strokeWidth={2.2} />
              </span>
              <div className="flex flex-col gap-1" style={{ font: "var(--type-sub)", color: "var(--text-1)" }}>
                {warnungen.map((w) => (
                  <p key={w}>{w}</p>
                ))}
                <p style={{ color: "var(--text-3)" }}>Speichern geht trotzdem.</p>
              </div>
            </div>
          )}

          {alterTitel && (
            <div className="mt-1 flex flex-col gap-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <button
                type="button"
                onClick={() => void loeschen()}
                disabled={laeuft}
                className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 self-start rounded-field px-4 disabled:opacity-50"
                style={{
                  ...BTN_FONT,
                  background: loeschenFragen ? "var(--negative)" : "transparent",
                  border: "1px solid",
                  borderColor: loeschenFragen ? "var(--negative)" : "var(--line)",
                  color: loeschenFragen ? "var(--on-accent)" : "var(--negative)",
                }}
                data-kurs-loeschen
              >
                <Icon name="trash" size={13} strokeWidth={2.2} />
                {loeschenFragen ? "Wirklich löschen" : "Kurs löschen"}
              </button>
              <MorphSwap activeKey={loeschenFragen ? "frage" : "ruhe"} innerClassName="flex flex-col gap-2">
                <>
                  {loeschenFragen && (
                    <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                      {alteTermine.length === 1
                        ? "Der Kurs verschwindet aus dem Kursplan deiner Athleten."
                        : `Der Kurs verschwindet mit allen ${alteTermine.length} Terminen aus dem Kursplan deiner Athleten.`}{" "}
                      Ihre bisherigen Rückmeldungen bleiben erhalten.
                    </p>
                  )}
                  {loeschenFragen && !laeuft && (
                    <button
                      type="button"
                      onClick={() => setLoeschenFragen(false)}
                      className="t-interactive self-start rounded-field px-2 py-1"
                      style={{ ...BTN_FONT, color: "var(--text-3)" }}
                    >
                      Abbrechen
                    </button>
                  )}
                </>
              </MorphSwap>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t px-5 pt-3"
        style={{
          borderColor: "var(--line)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        }}
      >
        <span
          role={fehler ? "alert" : undefined}
          className="min-w-0 flex-1"
          style={{ font: "var(--type-sub)", color: fehler ? "var(--negative)" : "var(--text-3)" }}
          data-kurs-fehler={fehler ? "" : undefined}
        >
          {fehler ?? ""}
        </span>
        <button
          type="button"
          onClick={() => void speichern()}
          disabled={laeuft || trainer === null}
          className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
          data-kurs-speichern
        >
          <Icon name="check" size={13} strokeWidth={2.6} />
          {laeuft ? "Speichere…" : alterTitel ? "Speichern" : "Kurs anlegen"}
        </button>
      </div>
    </>
  );
}

export default function KursSheet({
  ziel,
  plan,
  trainer,
  onClose,
}: {
  /** null heißt geschlossen. */
  ziel: KursSheetZiel | null;
  plan: KursSheetPlan;
  trainer: StudentEntry[] | null;
  onClose: () => void;
}) {
  // Beim Schließen den letzten Inhalt stehen lassen, damit das Sheet sich
  // zurückverwandelt statt leer zu verschwinden (Muster MemberRoleSheet).
  const zeigen = useLetzterWert(ziel);
  // Ein neuer Schlüssel je Ziel: Öffnet die Verwaltung nacheinander zwei
  // Kurse, startet das Formular jedes Mal mit den Werten DIESES Kurses.
  // Der Plan gehört mit in den Schlüssel: Derselbe Kurs in zwei Plänen sind
  // zwei Formulare.
  const schluessel = zeigen
    ? `${plan.id ?? "erster"}-${zeigen.art === "kurs" ? `kurs-${zeigen.titel}` : `neu-${zeigen.weekday ?? ""}`}`
    : "zu";
  return (
    <SheetShell
      open={ziel !== null}
      onClose={onClose}
      label={zeigen?.art === "kurs" ? `Kurs ${zeigen.titel}` : "Neuer Kurs"}
      panelClassName="pointer-events-auto relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-lg sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "88dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {zeigen && <KursInhalt key={schluessel} ziel={zeigen} plan={plan} trainer={trainer} onClose={onClose} />}
    </SheetShell>
  );
}
