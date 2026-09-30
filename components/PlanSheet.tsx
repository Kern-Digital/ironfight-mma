"use client";

/**
 * WOCHENPLAN ANLEGEN UND BEARBEITEN (Leon 27.09.2026: „mehrere wochenpläne
 * für ferien etc.").
 *
 * NEU: Name, Vorlage, optional ein Zeitraum. Die Vorlage ist der Standardweg
 * (Konzept §7): Der neue Plan übernimmt alle Kurse mit Trainern, Räumen und
 * Termin-IDs aus einem bestehenden — so laufen Kurs-Abos und Plan-Freigaben
 * weiter, wenn der Ferienplan gilt. „Leer starten" ist die Ausnahme.
 *
 * BEARBEITEN: Name, Zeitraum, Löschen. Den aktiven Plan und den Grundplan
 * löscht niemand — es muss immer einer gelten, und nach jedem Zeitraum muss
 * die Woche wissen, wohin sie zurückfällt. Seit 29.09. öffnet der Knopf
 * „Aktivieren“ die Aufgabe „planen“: ab sofort, ab einem Tag oder von – bis.
 *
 * ZEITRAUM (Leon 27.09. abends: „pläne auch für einen gewissen zeitraum …
 * nichts passieren kann das einen fehler im ablauf hervor ruft"): Von und
 * Bis. In der Zeit gilt der Plan, danach wieder der Grundplan. Nur „Von"
 * heißt: ab dann dauerhaft, der Plan wird Grundplan. Der Grundplan selbst
 * hat keinen Zeitraum — das Feld erklärt dann, warum. Geprüft wird mit
 * `zeitraumPruefen`, derselben Funktion wie auf dem Server.
 */

import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import XKnopf from "@/components/ui/XKnopf";
import { Kalender, ZeitraumKalender } from "@/components/ui/Kalender";
import { parseDate, type DateValue } from "@internationalized/date";
import { MorphSwap, SheetShell, useLetzterWert } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import { tagSchluessel } from "@/lib/guthaben";
import {
  kurseGruppieren,
  PLANNAME_MAX,
  plannamePruefen,
  planStandRechnen,
  tagPlus,
  tagText,
  zeitraumPruefen,
  type Wochenplan,
} from "@/lib/kursplan";
import { useEffect, useState } from "react";

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

/** Vorlage „ohne Kurse" im Select. */
const LEER = "__leer__";
/** „Danach gilt": zurück zum Grundplan. */
const GRUND = "__grund__";

/**
 * Drei Aufgaben (Leon 28.09.2026: beim Anlegen noch nicht einstellen, wann
 * oder wie lang der Plan gilt):
 *   · neu    — Name und Vorlage
 *   · plan   — Name ändern, Plan löschen (Stift am Plannamen)
 *   · planen — „Aktivieren“: ab sofort, ab einem Tag oder von – bis, dazu
 *              der Nachfolger. Leon 29.09.: der eigene Knopf „Planen“ ist weg,
 *              der Tipp auf „Aktivieren“ öffnet dieses Popup.
 */
export type PlanSheetZiel =
  | { art: "neu"; vorlageId: string | null }
  | { art: "plan"; planId: string }
  | { art: "planen"; planId: string };

function kursZahlText(p: Wochenplan): string {
  const n = kurseGruppieren(p.kurse).length;
  return n === 0 ? "Noch kein Kurs" : `${n} ${n === 1 ? "Kurs" : "Kurse"}`;
}

function PlanInhalt({
  ziel,
  plaene,
  onClose,
  onAngelegt,
}: {
  ziel: PlanSheetZiel;
  plaene: Wochenplan[];
  onClose: () => void;
  onAngelegt: (planId: string) => void;
}) {
  const { user } = useAuth();
  const heute = tagSchluessel();
  const plan =
    ziel.art !== "neu"
      ? (plaene.find((p) => p.id === ziel.planId) ?? null)
      : null;
  const neu = ziel.art === "neu";
  const planen = ziel.art === "planen";

  const [name, setName] = useState(plan?.name ?? "");
  const [vorlage, setVorlage] = useState<string>(
    neu
      ? ziel.vorlageId && plaene.some((p) => p.id === ziel.vorlageId)
        ? ziel.vorlageId
        : LEER
      : LEER,
  );
  // Der Stand für heute, gerechnet wie auf dem Server: abgelaufene Zeiträume
  // sind weg, der Grundplan steht fest.
  const rechnung = planStandRechnen(plaene, heute);
  const st = plan ? (rechnung.stand.get(plan.id) ?? plan) : null;
  const istGrundplan = !!st?.grundplan;
  const grundName =
    plaene.find((p) => p.id === rechnung.grundplanId)?.name ?? "";
  const [von, setVon] = useState(st?.zeitraumVon ?? "");
  const [bis, setBis] = useState(st?.zeitraumBis ?? "");
  // "" = zurück zum Grundplan
  const [nachfolger, setNachfolger] = useState(st?.nachfolgerId ?? "");
  // Drei Arten, zwischen denen man umschaltet — so ist immer klar, ob ein
  // Ende gesetzt ist, und erst MIT Ende erscheint „Danach gilt".
  const [art, setArt] = useState<"keiner" | "ab" | "bereich">(
    st?.zeitraumVon ? (st.zeitraumBis ? "bereich" : "ab") : "keiner",
  );
  // Ein Zeitraum, der schon läuft, behält seinen Beginn; das Ende bleibt verschiebbar.
  const laeuftSchon = !!st?.zeitraumVon && st.zeitraumVon <= heute;
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const andere = plaene
    .filter((p) => p.id !== plan?.id)
    .map((p) => ({ ...p, ...(rechnung.stand.get(p.id) ?? {}) }));
  const vorlagePlan = plaene.find((p) => p.id === vorlage) ?? null;
  const aktiverName = plaene.find((p) => p.aktiv)?.name;

  async function senden(
    body: Record<string, unknown>,
  ): Promise<{ planId?: string } | null> {
    if (!user) return null;
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
      const daten = (await res.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!res.ok) {
        setFehler(daten.error ?? "Das ließ sich gerade nicht speichern.");
        return null;
      }
      return daten;
    } catch {
      setFehler("Keine Verbindung. Versuch es gleich noch einmal.");
      return null;
    } finally {
      setLaeuft(false);
    }
  }

  async function speichern() {
    if (laeuft) return;
    // Dieselben Prüfungen wie auf dem Server, damit der Satz sofort dasteht.
    const n = plannamePruefen(name, andere);
    if ("fehler" in n) return setFehler(n.fehler);
    if (art === "bereich" && von && !bis)
      return setFehler("Tipp noch den letzten Tag des Zeitraums an.");
    if (art !== "keiner" && !von)
      return setFehler("Tipp den Tag an, ab dem der Plan gilt.");
    const nach = bis && nachfolger ? nachfolger : null;
    if (
      von !== (st?.zeitraumVon ?? "") ||
      bis !== (st?.zeitraumBis ?? "") ||
      nach !== (st?.nachfolgerId ?? null)
    ) {
      const zr = zeitraumPruefen(
        { von: von || null, bis: bis || null, nachfolgerId: nach },
        heute,
        plan && st
          ? {
              id: plan.id,
              grundplan: istGrundplan,
              zeitraumVon: st.zeitraumVon,
            }
          : null,
        andere,
      );
      if ("fehler" in zr) return setFehler(zr.fehler);
    }
    const zeitraum = {
      zeitraumVon: von || null,
      zeitraumBis: bis || null,
      nachfolgerId: nach,
    };
    // „Ab sofort“ aktiviert direkt — der Server macht den Plan zum Grundplan
    // und räumt seinen eigenen Zeitraum dabei ab.
    if (planen && plan && art === "keiner" && !laeuftSchon) {
      if (plan.aktiv) return onClose();
      if (await senden({ aktion: "plan-aktivieren", planId: plan.id }))
        onClose();
      return;
    }
    if (neu) {
      const daten = await senden({
        aktion: "plan-anlegen",
        name: n.name,
        vorlagePlanId: vorlage === LEER ? null : vorlage,
        ...zeitraum,
      });
      if (daten?.planId) {
        onAngelegt(daten.planId);
        onClose();
      }
    } else if (plan) {
      const daten = await senden({
        aktion: "plan-aendern",
        planId: plan.id,
        name: n.name,
        ...zeitraum,
      });
      if (daten) onClose();
    }
  }

  async function loeschen() {
    if (!plan || plan.aktiv || istGrundplan || laeuft) return;
    if (!loeschenFragen) {
      setLoeschenFragen(true);
      setFehler(null);
      return;
    }
    if (await senden({ aktion: "plan-loeschen", planId: plan.id })) onClose();
    else setLoeschenFragen(false);
  }

  const sofort = planen && art === "keiner" && !laeuftSchon && !istGrundplan;
  // Der Hilfstext unter „Zeitraum" folgt der Eingabe.
  const tag = (t: string) => tagText(t, heute);
  const zeitraumHilfe =
    art === "keiner"
      ? "Deine Trainer und Athleten sehen den Plan sofort im Kursplan."
      : art === "ab"
        ? von
          ? `Ab dem ${tag(von)} gilt dieser Plan dauerhaft und wird dein Grundplan.`
          : "Tipp den Tag an, ab dem der Plan gilt."
        : !von || !bis
          ? "Tipp den ersten und dann den letzten Tag an."
          : laeuftSchon
            ? `Läuft seit dem ${tag(von)} bis zum ${tag(bis)}. Das Ende kannst du verschieben.`
            : `Vom ${tag(von)} bis ${tag(bis)} gilt dieser Plan.`;

  // NACHFOLGER (Leon 27.09.: „wenn ich ein enddatum setze soll ein neues
  // feld auftauchen mit nachfolge plan"). Zur Wahl: der Grundplan zuerst,
  // dann jeder Plan ohne eigenen Zeitraum — ein Nachfolger gilt danach
  // dauerhaft, ein Zeitraum an ihm widerspräche dem.
  const nachfolgerWahl = andere.filter((p) => !p.grundplan && !p.zeitraumVon);
  const nachfolgerName = plaene.find((p) => p.id === nachfolger)?.name;
  const nachfolgerHilfe = !bis
    ? ""
    : nachfolger && nachfolgerName
      ? `Ab dem ${tag(tagPlus(bis, 1))} gilt „${nachfolgerName}“ dauerhaft und wird dein Grundplan.`
      : `Ab dem ${tag(tagPlus(bis, 1))} gilt wieder dein Grundplan „${grundName}“.`;

  // Tage, die ein anderer Zeitraum schon belegt: im Kalender gesperrt — eine
  // Überschneidung lässt sich so gar nicht erst antippen.
  const belegt = (d: DateValue) => {
    const t = d.toString();
    return andere.some(
      (p) =>
        p.zeitraumVon &&
        p.zeitraumBis &&
        p.zeitraumVon <= t &&
        t <= p.zeitraumBis,
    );
  };
  // Tage, an denen schon ein anderer Plan Grundplan wird (für „Ab einem Tag").
  const wechselTage = new Set(
    andere.flatMap((p) => [
      ...(p.zeitraumVon && !p.zeitraumBis ? [p.zeitraumVon] : []),
      ...(p.zeitraumBis && p.nachfolgerId ? [tagPlus(p.zeitraumBis, 1)] : []),
    ]),
  );
  const minTag = parseDate(heute);
  const maxTag = parseDate(tagPlus(heute, 730));

  function artWaehlen(neueArt: "keiner" | "ab" | "bereich") {
    setArt(neueArt);
    setFehler(null);
    if (neueArt === "keiner") {
      setVon("");
      setBis("");
      setNachfolger("");
    } else if (neueArt === "ab") {
      setBis("");
      setNachfolger("");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-col items-start">
          <div
            aria-hidden
            className="mb-2 h-1 w-10 rounded-full sm:invisible"
            style={{ background: "var(--line-strong)" }}
          />
          <span className="t-sheet-title max-w-full truncate">
            {plan ? plan.name : "Neuer Wochenplan"}
          </span>
          {plan && (
            <span
              className="max-w-full truncate"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {planen
                ? "Wann der Plan gilt"
                : `${plan.aktiv ? "Aktiv" : "Nicht aktiv"} · ${kursZahlText(plan)}`}
            </span>
          )}
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
          {!planen && (
            <label className="flex flex-col gap-1.5">
              <span className="t-label">Name</span>
              <input
                type="text"
                value={name}
                maxLength={PLANNAME_MAX}
                onChange={(e) => {
                  setName(e.target.value);
                  setFehler(null);
                }}
                placeholder="z. B. Sommerferien"
                className="min-h-hit rounded-field px-3"
                style={FELD}
                data-plan-feld="name"
              />
            </label>
          )}

          {neu && (
            <div className="flex flex-col gap-1.5" data-plan-feld="vorlage">
              <span className="t-label">Vorlage</span>
              <Select
                value={vorlage}
                onChange={(v) => {
                  setVorlage(v || LEER);
                  setFehler(null);
                }}
                options={[
                  ...plaene.map((p) => ({ value: p.id, label: p.name })),
                  { value: LEER, label: "Leer starten" },
                ]}
                ariaLabel="Vorlage"
              />
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {vorlagePlan
                  ? vorlagePlan.kurse.length === 0
                    ? `„${vorlagePlan.name}“ hat noch keinen Kurs. Du startest leer.`
                    : `Übernimmt alle ${kurseGruppieren(vorlagePlan.kurse).length} Kurse aus „${vorlagePlan.name}“ mit Trainern und Räumen. Danach änderst du, was in diesem Plan anders läuft.`
                  : "Du startest ohne Kurse. Die Räume deines Gyms sind schon da."}
              </p>
            </div>
          )}

          {/* ── Zeitraum (Leon 27.09. abends) — nur unter „Planen" ───────── */}
          {planen && (
            <div className="flex flex-col gap-1.5" data-plan-feld="zeitraum">
              <span className="t-label">Zeitraum</span>
              {istGrundplan && plan ? (
                <p
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  data-zeitraum-grundplan
                >
                  „{plan.name}“ ist dein Grundplan. Er gilt immer, wenn kein
                  anderer Plan gerade seinen Zeitraum hat. Einen Zeitraum gibst
                  du dem Plan, der nur zeitweise gelten soll.
                </p>
              ) : (
                <>
                  {!laeuftSchon && (
                    <div
                      role="group"
                      aria-label="Art des Zeitraums"
                      className="flex flex-wrap gap-1.5"
                      data-zeitraum-art
                    >
                      {(
                        [
                          ["keiner", "Ab sofort"],
                          ["ab", "Ab einem Tag"],
                          ["bereich", "Von – Bis"],
                        ] as const
                      ).map(([wert, text]) => {
                        const an = art === wert;
                        return (
                          <button
                            key={wert}
                            type="button"
                            data-press
                            aria-pressed={an}
                            onClick={() => artWaehlen(wert)}
                            className="t-interactive inline-flex min-h-hit items-center whitespace-nowrap rounded-field px-3"
                            style={{
                              font: "600 13px/1.2 var(--font-archivo), system-ui, sans-serif",
                              background: an
                                ? "var(--accent-subtle)"
                                : "var(--surface-raised)",
                              color: an
                                ? "var(--accent-text)"
                                : "var(--text-2)",
                              border: `1px solid ${an ? "var(--accent)" : "var(--line)"}`,
                            }}
                            data-zeitraum-art-knopf={wert}
                          >
                            {text}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {art === "ab" && (
                    <div className="kal-rahmen" data-kalender="ab">
                      <Kalender
                        aria-label="Ab welchem Tag der Plan gilt"
                        value={von ? parseDate(von) : null}
                        onChange={(d) => {
                          setVon(d.toString());
                          setFehler(null);
                        }}
                        minValue={minTag}
                        maxValue={maxTag}
                        isDateUnavailable={(d) => wechselTage.has(d.toString())}
                      />
                    </div>
                  )}
                  {art === "bereich" &&
                    (laeuftSchon ? (
                      <div className="kal-rahmen" data-kalender="ende">
                        <Kalender
                          aria-label="Letzter Tag des Zeitraums"
                          value={bis ? parseDate(bis) : null}
                          onChange={(d) => {
                            setBis(d.toString());
                            setFehler(null);
                          }}
                          minValue={minTag}
                          maxValue={parseDate(tagPlus(von, 365))}
                          isDateUnavailable={belegt}
                        />
                      </div>
                    ) : (
                      <div className="kal-rahmen" data-kalender="bereich">
                        <ZeitraumKalender
                          aria-label="Zeitraum"
                          value={
                            von && bis
                              ? { start: parseDate(von), end: parseDate(bis) }
                              : null
                          }
                          onChange={(r) => {
                            if (!r) return;
                            setVon(r.start.toString());
                            setBis(r.end.toString());
                            setFehler(null);
                          }}
                          minValue={minTag}
                          maxValue={maxTag}
                          isDateUnavailable={belegt}
                        />
                      </div>
                    ))}
                  <span
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    data-zeitraum-hilfe
                  >
                    {zeitraumHilfe}
                    {art === "bereich" &&
                    andere.some((p) => p.zeitraumVon && p.zeitraumBis)
                      ? " Durchgestrichene Tage gehören schon zu einem anderen Plan."
                      : ""}
                  </span>
                  {art === "bereich" && bis && (
                    <div
                      className="flex flex-col gap-1.5 pt-2"
                      data-plan-feld="nachfolger"
                    >
                      <span className="t-label">Danach gilt</span>
                      <Select
                        value={nachfolger || GRUND}
                        onChange={(v) => {
                          setNachfolger(!v || v === GRUND ? "" : v);
                          setFehler(null);
                        }}
                        options={[
                          { value: GRUND, label: `${grundName} (Grundplan)` },
                          ...nachfolgerWahl.map((p) => ({
                            value: p.id,
                            label: p.name,
                          })),
                        ]}
                        ariaLabel="Danach gilt"
                      />
                      <p
                        style={{
                          font: "var(--type-sub)",
                          color: "var(--text-3)",
                        }}
                        data-nachfolger-hilfe
                      >
                        {nachfolgerHilfe}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {plan && ziel.art === "plan" && (
            <div
              className="mt-1 flex flex-col gap-2 border-t pt-4"
              style={{ borderColor: "var(--line)" }}
            >
              {plan.aktiv || istGrundplan ? (
                <p
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  data-plan-loeschen-gesperrt
                >
                  {plan.aktiv
                    ? "Diesen Plan sehen gerade alle. Aktivier zuerst einen anderen, dann kannst du ihn löschen."
                    : `„${plan.name}“ ist dein Grundplan, nach jedem Zeitraum gilt wieder er. Aktivier zuerst einen anderen Plan, dann kannst du ihn löschen.`}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void loeschen()}
                    disabled={laeuft}
                    className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 self-start rounded-field px-4 disabled:opacity-50"
                    style={{
                      ...BTN_FONT,
                      background: loeschenFragen
                        ? "var(--negative)"
                        : "transparent",
                      border: "1px solid",
                      borderColor: loeschenFragen
                        ? "var(--negative)"
                        : "var(--line)",
                      color: loeschenFragen
                        ? "var(--on-accent)"
                        : "var(--negative)",
                    }}
                    data-plan-loeschen
                  >
                    <Icon name="trash" size={13} strokeWidth={2.2} />
                    {loeschenFragen ? "Wirklich löschen" : "Plan löschen"}
                  </button>
                  <MorphSwap
                    activeKey={loeschenFragen ? "frage" : "ruhe"}
                    innerClassName="flex flex-col gap-2"
                  >
                    <>
                      {loeschenFragen && (
                        <p
                          style={{
                            font: "var(--type-sub)",
                            color: "var(--text-3)",
                          }}
                        >
                          {plan.kurse.length === 0
                            ? `„${plan.name}“ verschwindet.`
                            : `„${plan.name}“ verschwindet mit allen ${kurseGruppieren(plan.kurse).length} Kursen.`}
                          {aktiverName ? ` „${aktiverName}“ bleibt aktiv.` : ""}
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
                </>
              )}
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
          style={{
            font: "var(--type-sub)",
            color: fehler ? "var(--negative)" : "var(--text-3)",
          }}
          data-plan-fehler={fehler ? "" : undefined}
        >
          {fehler ?? ""}
        </span>
        <button
          type="button"
          onClick={() => void speichern()}
          disabled={laeuft}
          className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
          data-plan-speichern
          data-sofort={sofort ? "" : undefined}
        >
          <Icon
            name={neu && vorlagePlan ? "copy" : "check"}
            size={13}
            strokeWidth={2.4}
          />
          {laeuft
            ? "Speichere…"
            : neu
              ? "Plan anlegen"
              : sofort
                ? "Aktivieren"
                : "Speichern"}
        </button>
      </div>
    </>
  );
}

export default function PlanSheet({
  ziel,
  plaene,
  onClose,
  onAngelegt,
}: {
  /** null heißt geschlossen. */
  ziel: PlanSheetZiel | null;
  plaene: Wochenplan[];
  onClose: () => void;
  /** Nach dem Anlegen: den neuen Plan gleich zum Bearbeiten wählen. */
  onAngelegt: (planId: string) => void;
}) {
  const zeigen = useLetzterWert(ziel);
  const schluessel = zeigen
    ? zeigen.art === "neu"
      ? `neu-${zeigen.vorlageId ?? ""}`
      : `${zeigen.art}-${zeigen.planId}`
    : "zu";
  return (
    <SheetShell
      open={ziel !== null}
      onClose={onClose}
      label={
        zeigen?.art === "plan"
          ? "Wochenplan bearbeiten"
          : zeigen?.art === "planen"
            ? "Wochenplan aktivieren"
            : "Neuer Wochenplan"
      }
      panelClassName="pointer-events-auto relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "88dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {zeigen && (
        <PlanInhalt
          key={schluessel}
          ziel={zeigen}
          plaene={plaene}
          onClose={onClose}
          onAngelegt={onAngelegt}
        />
      )}
    </SheetShell>
  );
}
