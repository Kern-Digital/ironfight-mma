"use client";

/**
 * DIE DREI ABO-STUFEN — Laufzeit-Schalter und Karten (22.09.2026).
 *
 * Leon: „baue die Abo anzeige so ca" wie die Vorlage „pricing-section-3"
 * (Überschrift links, Schalter rechts, drei Karten auf einer Bühne, die
 * mittlere hervorgehoben, Preise rollen beim Umschalten). Nachgebaut mit den
 * Tidal-Bausteinen statt shadcn/lucide/motion — Farben aus den Tokens,
 * Bewegung aus `components/motion`. Seine Antworten dazu (wörtlich):
 * Abzeichen „„Empfohlen" (Empfohlen)" · Werbung „Behalten, Karten darunter
 * (Empfohlen)" · Knöpfe „In jeder Karte (Empfohlen)".
 *
 * KEIN „BELIEBT". Es hat noch niemand gekauft, und der Geschäftsplan schließt
 * eine Beliebtheits-Behauptung ohne Beleg aus. „Empfohlen" ist Leons
 * Empfehlung, keine Aussage über Käufer.
 */

import { Etage } from "@/components/deepfight/AboWerbung";
import { Reveal, RollZahl } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import {
  ABO_STUFEN,
  ABO_VORWAHL,
  STEUERMODUS,
  UST_SATZ,
  brutto,
  type AboIntervall,
  type AboStufe,
} from "@/lib/abo";
import { useEffect, useRef, useState } from "react";

// ─── Was in den Karten steht ───────────────────────────────────────────────

/** Für wen die Stufe gedacht ist — ein Satz je Karte (Konzept §6, Zeile „Für wen"). */
const FUER: Record<AboStufe, string> = {
  team: "Für 1 bis 2 Wettkämpfer im Monat.",
  gym: "Für 10 bis 25 Wettkämpfer im Monat.",
  saison: "Für das ganze Wettkampfteam, mehrere Trainer.",
};

/**
 * WAS DIE KARTEN AUFZÄHLEN.
 *
 * `IMMER_DABEI` ist der Kern, den JEDE Stufe hat — auch die gratis drei
 * Analysen (Konzept §6: „nichts, was die Analyse selbst ausmacht, wird
 * gesperrt").
 *
 * `EXTRAS` ist das, was eine Stufe VORAUS hat. Leon hat am 22.09. die Staffel
 * beschlossen (Konzept §6, Tabelle „WAS DIE STUFEN AUSSER DER MENGE TRENNT":
 * Branding-Kit ab Gym, Videolänge 10/15/15, Nachkauf 35/30/25 €,
 * Hilfe-Leiter). Seit dem 24.09. GREIFEN die ersten drei:
 *   · Videolänge  → `videoSekundenFuerGym` in lib/server/gym-status.ts
 *   · Branding    → /verwaltung/branding, geprüft in /api/gym/branding
 *   · Nachkauf    → `nachkaufNetto` in lib/abo.ts, ein Stripe-Preis je Stufe
 *
 * **Ein Punkt kommt erst hierher, wenn er wirklich greift.** „Kommt bald" in
 * einer Preistabelle ist in Deutschland irreführend (Konzept §6). Die
 * Hilfe-Leiter steht deshalb NICHT hier: Sie ist Leons Versprechen, kein Code.
 * Eine höhere Stufe schreibt von selbst „Alles aus Team, plus:" und listet nur
 * das Neue.
 */
const IMMER_DABEI = [
  "Fight-DNA für jeden Athleten",
  "Gegner-Scouting inklusive",
  "Gameplan ohne Aufpreis",
  "Ungenutztes sammelt sich an",
];
const EXTRAS: Record<AboStufe, string[]> = {
  team: ["Videos bis 10 Minuten"],
  gym: [
    "Videos bis 15 Minuten",
    "Dein Logo und deine Farbe in der App",
    "Nachkauf für 30 € statt 35 €",
  ],
  saison: ["Nachkauf für 25 € statt 30 €"],
};

function inhalt(i: number): { kopf: string; liste: string[] } {
  const s = ABO_STUFEN[i];
  const vorige = ABO_STUFEN[i - 1];
  if (vorige && EXTRAS[s.id].length) return { kopf: `Alles aus ${vorige.name}, plus:`, liste: EXTRAS[s.id] };
  return { kopf: "Immer dabei:", liste: [...IMMER_DABEI, ...EXTRAS[s.id]] };
}

const KNOPF: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// ─── Der Laufzeit-Schalter ─────────────────────────────────────────────────

/**
 * Zwei Knöpfe, darunter eine Kapsel, die zum gewählten gleitet. Reines CSS
 * (MOTION-BRIEF: CSS macht, was CSS kann) — die Kapsel misst den Knopf und
 * übernimmt Lage und Breite. Die Übergänge schalten sich erst nach dem
 * ersten Messen ein, sonst flöge die Kapsel beim Laden von links herein.
 */
function Laufzeit({ wert, onWert }: { wert: AboIntervall; onWert: (w: AboIntervall) => void }) {
  const huelle = useRef<HTMLDivElement>(null);
  const [lage, setLage] = useState<{ x: number; w: number } | null>(null);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const messen = () => {
      const b = el.querySelector<HTMLElement>(`[data-abo-intervall="${wert}"]`);
      if (b) setLage({ x: b.offsetLeft, w: b.offsetWidth });
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wert]);

  useEffect(() => {
    if (!lage || bereit) return;
    const f = requestAnimationFrame(() => setBereit(true));
    return () => cancelAnimationFrame(f);
  }, [lage, bereit]);

  return (
    <div ref={huelle} className="abo-laufzeit" role="group" aria-label="Laufzeit">
      <span
        aria-hidden
        className="abo-laufzeit__daumen"
        data-bereit={bereit || undefined}
        style={lage ? { transform: `translateX(${lage.x}px)`, width: lage.w } : { opacity: 0 }}
      />
      {(["monat", "jahr"] as const).map((i) => (
        <button
          key={i}
          type="button"
          aria-pressed={wert === i}
          data-abo-intervall={i}
          onClick={() => onWert(i)}
        >
          {i === "monat" ? (
            "Monatlich"
          ) : (
            <>
              Jährlich
              <span className="abo-laufzeit__rabatt">2 Monate geschenkt</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Die Karten ────────────────────────────────────────────────────────────

export default function AboKarten({
  intervall,
  onIntervall,
  darfKaufen,
  laeuft,
  onKaufen,
}: {
  intervall: AboIntervall;
  onIntervall: (i: AboIntervall) => void;
  darfKaufen: boolean;
  /** Die Stufe, deren Kasse gerade öffnet — oder irgendein anderer Vorgang. */
  laeuft: string | null;
  onKaufen: (stufe: AboStufe) => void;
}) {
  return (
    <section aria-labelledby="abo-stufen-titel" className="flex scroll-mt-24 flex-col gap-7">
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
        <Etage id="abo-stufen-titel" label="Dein Abo" zeile="Wähl deine Stufe." />
        <Reveal delay={0.2} className="shrink-0">
          <Laufzeit wert={intervall} onWert={onIntervall} />
        </Reveal>
      </div>

      <div className="abo-buehne grid md:grid-cols-3">
        {ABO_STUFEN.map((s, i) => {
          const empfohlen = s.id === ABO_VORWAHL;
          const netto = s.netto[intervall];
          const { kopf, liste } = inhalt(i);
          return (
            <Reveal key={s.id} delay={0.25 + i * 0.08} className="flex">
              <article
                data-abo-stufe={s.id}
                data-empfohlen={empfohlen || undefined}
                className={`abo-karte flex w-full flex-col gap-5 rounded-card p-5 ${empfohlen ? "abo-karte--empfohlen" : ""}`}
              >
                <div className={`items-center ${empfohlen ? "flex" : "hidden md:flex"} md:min-h-[24px]`}>
                  {empfohlen && <span className="abo-abzeichen">Empfohlen</span>}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    {/* Preis 48 px — die Größe, mit der McFit ihn setzt. */}
                    <RollZahl
                      wert={netto}
                      waehrung
                      style={{ font: "800 48px/1 var(--font-body)", letterSpacing: "-0.02em", color: "var(--text-1)" }}
                    />
                    <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                      / {intervall === "jahr" ? "Jahr" : "Monat"}
                      {STEUERMODUS === "regel" ? " zzgl. USt." : ""}
                    </span>
                  </div>
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    {STEUERMODUS === "regel" ? (
                      <>
                        <RollZahl wert={brutto(netto)} waehrung /> inkl. {UST_SATZ} % USt.
                      </>
                    ) : (
                      "Endpreis nach § 19 UStG"
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 style={{ font: "700 22px/1.2 var(--font-body)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-1)" }}>{s.name}</h3>
                  <p style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>
                    {s.analysenJeMonat} Analysen im Monat
                  </p>
                  <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    {intervall === "jahr"
                      ? `${(s.analysenJeMonat * 12).toLocaleString("de-DE")} im Jahr. `
                      : ""}
                    {FUER[s.id]}
                  </p>
                </div>

                <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                  <h4 style={{ font: "var(--type-label)", color: "var(--text-1)" }}>{kopf}</h4>
                  <ul className="flex flex-col gap-2.5">
                    {liste.map((punkt) => (
                      <li key={punkt} className="flex items-start gap-3">
                        <span aria-hidden className="abo-haken">
                          <Icon name="check" size={13} strokeWidth={2.6} />
                        </span>
                        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>{punkt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {darfKaufen && (
                  <button
                    type="button"
                    data-press
                    data-abo-kaufen={s.id}
                    onClick={() => onKaufen(s.id)}
                    disabled={laeuft !== null}
                    className={`abo-kaufknopf t-interactive mt-auto inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-field px-5 ${empfohlen ? "abo-kaufknopf--primaer" : ""}`}
                    style={KNOPF}
                  >
                    <Icon name="spark" size={14} strokeWidth={2.4} />
                    {laeuft === s.id ? "Kasse öffnet …" : `${s.name} abonnieren`}
                  </button>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
