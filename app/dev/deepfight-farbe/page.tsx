"use client";

/**
 * Prüfseite: Wie sieht der DeepFight-Bereich in seinen zwei Modi aus?
 * (DeepFight-Neuaufbau, Teilschritt 1, 2026-09-06)
 *
 * DIE GESCHICHTE DIESER SEITE, in drei Entscheidungen von Leon am 06.09.:
 *
 * 1. Zuerst stand die Frage, welchen FARBTON der Gegner-Modus bekommt.
 *    Vier Felder verglichen die Komplementär-Formel (--accent-h + 180°) in
 *    Varianten. Gemessen: Die reine Formel klemmt im dunklen Theme auf
 *    Lachsrosa, und der abgeleitete Ton liegt praktisch AUF dem Alarm-Rot
 *    (Abstand 0,029 im OKLab-Raum). Die Messwerte stehen im Memory
 *    „deepfight-neuaufbau"; die Felder sind weg, weil Leon die Frage anders
 *    beantwortet hat — siehe 3.
 * 2. Dann kam der bewegte Hintergrund (components/ui/Synthesis.tsx): fest
 *    Tidal-Blau bei „Unsere Leute", fest Silber beim Gegner, Grund Schwarz
 *    bzw. Weiß — unabhängig vom Branding-Kit.
 * 3. Und schließlich: **Der Gegner bekommt gar keinen eigenen Farbton.**
 *    Leon: „einfach dunkel/hell als Button-Farbe, so dass es zum Hintergrund
 *    passt." Also: Im Gegner-Modus wird die ganze Akzent-Familie NEUTRAL —
 *    Silber, wie der Hintergrund, wie der Gegner-Zweig der DNA-Helix. Das
 *    kostet im Token-System genau EINE Zeile: die Buntheit fällt auf fast
 *    null, und jede Ableitung (Knopf, Text, Tönung, Rand, Schein) wird grau.
 *    Und: Die Flächen des Bereichs werden GLAS — durchsichtig über dem
 *    Hintergrund, aber als eine Regel für alle Karten, damit es stimmig bleibt.
 *
 * Diese Seite zeigt deshalb ZWEI Felder: „Unsere Leute" gegen „Gegner".
 * Die Regeln dazu stehen seit Teilschritt 2 in globals.css — diese Seite
 * misst sie, statt eine Kopie zu tragen (Sichtprüfung wie /dev/kursfenster).
 *
 * In Produktion 404; liegt bewusst außerhalb des Middleware-Matchers
 * (wie /dev/kursfenster, /dev/auswahl-chips und /dev/motion-sheet).
 */

import Icon from "@/components/ui/Icon";
import Synthesis from "@/components/ui/Synthesis";
import { notFound } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme-context";

/* ── Die Regeln stehen seit Teilschritt 2 (07.09.2026) in globals.css ──────
 * (Abschnitt „Der DeepFight-Bereich": Gegner-Modus neutral, Glas als
 * Bereichsregel, --df-deckkraft). Diese Seite trägt KEINE Kopie mehr — sie
 * misst die echten Regeln, wie /dev/kursfenster die echte Flex-Kette. Der
 * Regler schreibt --df-deckkraft am Feld, damit Leons Zahl hier geprüft
 * werden kann, bevor sie im Token steht. */

type Feld = {
  key: "leute" | "gegner";
  titel: string;
  unter: string;
};

const FELDER: Feld[] = [
  {
    key: "leute",
    titel: "Unsere Leute",
    unter: "Gym-Akzent auf dem Tidal-Blau. So sieht der Bereich für Athleten und dich aus.",
  },
  {
    key: "gegner",
    titel: "Gegner",
    unter: "Die Akzent-Familie wird neutral — Silber wie der Hintergrund, wie in der DNA.",
  },
];

const GYM_VORLAGEN = [
  { name: "Tidal-Türkis", h: 197 },
  { name: "Rot", h: 25 },
  { name: "Grün", h: 145 },
  { name: "Violett", h: 305 },
];

/* ── Messen: oklch() steht im Computed-Wert unaufgelöst, also durch Canvas ──
 * getComputedStyle gibt oklch(…) als Text zurück. Erst wenn der Browser die
 * Farbe MALT, entsteht ein sRGB-Wert. Ein Canvas nimmt denselben Text als
 * fillStyle an und liefert danach das Pixel. */
type Rgb = [number, number, number];

function relativeHelligkeit([r, g, b]: Rgb): number {
  const kanal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function kontrast(a: Rgb, b: Rgb): number {
  const [hell, dunkel] = [relativeHelligkeit(a), relativeHelligkeit(b)].sort(
    (x, y) => y - x,
  );
  return (hell + 0.05) / (dunkel + 0.05);
}

function alsHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

type Messung = {
  akzentHex: string;
  aufAkzent: number;
  /** Akzenttext auf der getönten Fläche (--accent-subtle). */
  textAufTonung: number;
  /**
   * Fließtext auf GLAS — das Glas ist halbdurchsichtig, dahinter bewegt sich
   * der Hintergrund. Gemessen wird deshalb der SCHLECHTERE von zwei Fällen:
   * Glas über dem Grund (Schwarz/Weiß) und Glas über dem hellen Ton.
   */
  textAufGlas: number;
};

export default function DeepFightFarbePruefseite() {
  const { theme, toggleTheme } = useTheme();
  const [gymH, setGymH] = useState(197);
  const [hintergrund, setHintergrund] = useState(true);
  const [deckkraft, setDeckkraft] = useState(45);
  const [messungen, setMessungen] = useState<Record<string, Messung>>({});
  const feldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* Der Gym-Akzent liegt am Wurzelelement — dort setzt ihn später das
     Branding-Kit. So zeigt „Unsere Leute", dass die Knöpfe dem Gym folgen,
     während der Hintergrund es bewusst nicht tut. */
  useEffect(() => {
    const w = document.documentElement;
    w.style.setProperty("--accent-h", String(gymH));
    return () => {
      w.style.removeProperty("--accent-h");
    };
  }, [gymH]);

  const messen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    /**
     * Malt Schichten von unten nach oben und liest das Pixel. Jede Schicht
     * darf eine eigene Deckkraft tragen — so lässt sich der Hintergrund
     * (Ton mit seiner Deckkraft über dem Grund) unter dem Glas nachstellen.
     */
    const pixel = (...schichten: (string | [string, number])[]): Rgb => {
      ctx.clearRect(0, 0, 4, 4);
      for (const schicht of schichten) {
        const [farbe, alpha] = Array.isArray(schicht) ? schicht : [schicht, 1];
        ctx.globalAlpha = alpha;
        ctx.fillStyle = farbe;
        ctx.fillRect(0, 0, 4, 4);
      }
      ctx.globalAlpha = 1;
      const d = ctx.getImageData(1, 1, 1, 1).data;
      return [d[0], d[1], d[2]];
    };

    const naechste: Record<string, Messung> = {};
    for (const feld of FELDER) {
      const el = feldRefs.current[feld.key];
      if (!el) continue;
      const s = getComputedStyle(el);
      const p = (name: string) => s.getPropertyValue(name).trim();
      const akzent = p("--accent");
      if (!akzent) continue;

      const glasFarbe = p("--glass-bg");
      const grund = p("--df-grund");
      const ton = p(feld.key === "gegner" ? "--df-ton-gegner" : "--df-ton-leute");
      const text1 = pixel(p("--text-1"));
      /* Der Hintergrund liegt mit seiner Deckkraft über dem Grund; an seiner
         hellsten Stelle steht der volle Ton. Beide Fälle unter das Glas legen
         und den schlechteren nehmen — mehr Stellen gibt es nicht. */
      const glasUeberGrund = pixel(grund, glasFarbe);
      const glasUeberTon = pixel(grund, [ton, hintergrund ? deckkraft / 100 : 0], glasFarbe);

      naechste[feld.key] = {
        akzentHex: alsHex(pixel(akzent)),
        aufAkzent: kontrast(pixel(p("--on-accent")), pixel(akzent)),
        textAufTonung: kontrast(pixel(p("--accent-text")), pixel(p("--accent-subtle"))),
        textAufGlas: Math.min(
          kontrast(text1, glasUeberGrund),
          kontrast(text1, glasUeberTon),
        ),
      };
    }
    setMessungen(naechste);
  }, [hintergrund, deckkraft]);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(messen));
    return () => cancelAnimationFrame(id);
  }, [messen, theme, gymH]);

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      className="min-h-screen px-4 py-8"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <canvas ref={canvasRef} width={4} height={4} className="hidden" />

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1
            style={{
              font: "var(--type-display)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            DeepFight — die zwei Modi
          </h1>
          <p
            className="max-w-3xl"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            Links unsere Leute, rechts der Gegner. Der Hintergrund kennt nur
            hell gegen dunkel und folgt keinem Branding-Kit; die Knöpfe folgen
            bei unseren Leuten dem Gym und werden beim Gegner neutral. Stell
            das Gym um und sieh, was mitgeht und was nicht.
          </p>
        </header>

        <Steuerung
          theme={theme}
          onTheme={toggleTheme}
          gymH={gymH}
          onGymH={setGymH}
          hintergrund={hintergrund}
          onHintergrund={setHintergrund}
          deckkraft={deckkraft}
          onDeckkraft={setDeckkraft}
        />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {FELDER.map((feld) => (
            <FeldKarte
              key={feld.key}
              feld={feld}
              hintergrund={hintergrund}
              deckkraft={deckkraft}
              messung={messungen[feld.key]}
              innerRef={(el) => {
                feldRefs.current[feld.key] = el;
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

/* ── Steuerung ───────────────────────────────────────────────────────────── */

function Schalter({
  an,
  onAn,
  icon,
  children,
}: {
  an: boolean;
  onAn: (v: boolean) => void;
  icon?: "sun" | "moon";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onAn(!an)}
      aria-pressed={an}
      className="t-interactive min-h-hit rounded-field px-4"
      style={{
        font: "var(--type-body-strong)",
        background: an ? "var(--accent-subtle)" : "transparent",
        border: `1px solid ${an ? "var(--accent)" : "var(--line)"}`,
        color: an ? "var(--accent-text)" : "var(--text-2)",
      }}
    >
      <span className="flex items-center gap-2">
        <Icon name={icon ?? (an ? "check" : "minus")} size={18} />
        {children}
      </span>
    </button>
  );
}

function Steuerung({
  theme,
  onTheme,
  gymH,
  onGymH,
  hintergrund,
  onHintergrund,
  deckkraft,
  onDeckkraft,
}: {
  theme: string;
  onTheme: () => void;
  gymH: number;
  onGymH: (v: number) => void;
  hintergrund: boolean;
  onHintergrund: (v: boolean) => void;
  deckkraft: number;
  onDeckkraft: (v: number) => void;
}) {
  return (
    <div className="t-card flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Schalter an onAn={onTheme} icon={theme === "dark" ? "sun" : "moon"}>
          {theme === "dark" ? "Auf hell umschalten" : "Auf dunkel umschalten"}
        </Schalter>
        <Schalter an={hintergrund} onAn={onHintergrund}>
          Bewegter Hintergrund
        </Schalter>
      </div>

      <label className="flex flex-col gap-2">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="t-label">Deckkraft des Hintergrunds</span>
          <span style={{ font: "var(--type-body-strong)", color: "var(--accent-text)" }}>
            {deckkraft}%
          </span>
          <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Zieh ihn hoch, bis die Schrift kämpft — dort liegt die Grenze.
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={deckkraft}
          onChange={(e) => onDeckkraft(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--accent)" }}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="t-label">Gym-Akzent</span>
          <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Knöpfe und Ränder bei unseren Leuten folgen ihm. Hintergrund und
            Gegner tun es nicht.
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {GYM_VORLAGEN.map((v) => (
            <button
              key={v.h}
              type="button"
              onClick={() => onGymH(v.h)}
              data-press
              className="t-interactive min-h-hit rounded-pill px-4"
              style={{
                font: "var(--type-meta)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
                border: `1px solid ${gymH === v.h ? "var(--accent)" : "var(--line)"}`,
                color: gymH === v.h ? "var(--accent-text)" : "var(--text-2)",
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-pill"
                  style={{ background: `oklch(0.70 0.14 ${v.h})` }}
                />
                {v.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Ein Feld: Sidebar-Streifen + Werkbank im Modus ──────────────────────── */

function FeldKarte({
  feld,
  hintergrund,
  deckkraft,
  messung,
  innerRef,
}: {
  feld: Feld;
  hintergrund: boolean;
  deckkraft: number;
  messung?: Messung;
  innerRef: (el: HTMLDivElement | null) => void;
}) {
  const istGegner = feld.key === "gegner";
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2
          style={{
            font: "var(--type-h3)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
          }}
        >
          {feld.titel}
        </h2>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {feld.unter}
        </p>
      </div>

      <div
        className="flex overflow-hidden rounded-modal"
        style={{ border: "1px solid var(--line)" }}
      >
        <SidebarStreifen />
        <div
          ref={innerRef}
          data-mess={feld.key}
          data-area="deepfight"
          data-modus={feld.key}
          className="relative min-w-0 flex-1 p-4"
          // Das Token am Feld überschreibt den Wert aus globals.css — genau so
          // misst die Seite, was eine andere Zahl im Token bewirken würde.
          style={
            {
              background: "var(--surface-page)",
              "--df-deckkraft": deckkraft / 100,
            } as React.CSSProperties
          }
        >
          {hintergrund && <Synthesis modus={feld.key} />}
          <div className="relative">
            <Werkbank istGegner={istGegner} />
          </div>
        </div>
      </div>

      <Messwerte messung={messung} />
    </section>
  );
}

/**
 * Der Streifen liegt AUSSERHALB der Bereichsfärbung — genau wie die echte
 * Sidebar. Er zeigt, wie der Bereich neben den drei Rechte-Gruppen steht.
 */
function SidebarStreifen() {
  const gruppen: { titel: string; area?: string; icon: "users" | "settings" | "shield" }[] = [
    { titel: "Trainer", area: "trainer", icon: "users" },
    { titel: "Verwaltung", area: "verwaltung", icon: "settings" },
    { titel: "Plattform", area: "admin", icon: "shield" },
  ];
  return (
    <div
      className="flex w-32 shrink-0 flex-col gap-2 p-2"
      style={{
        background: "var(--surface-card)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {gruppen.map((g) => (
        <div
          key={g.titel}
          data-area={g.area}
          className="rounded-badge px-2 py-2"
          style={{
            background: "var(--sb-group-tint)",
            boxShadow: "var(--sb-group-edge)",
          }}
        >
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-label)" }}>
            <Icon name={g.icon} size={14} />
            <span
              style={{
                font: "var(--type-hd-label)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
              }}
            >
              {g.titel}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Die Werkbank — so weit nachgebaut, wie es für die Entscheidung nötig ist.
 * Alles, was Text trägt, liegt auf einer Karte: Auch die Segment-Reihe steht
 * auf einer Glas-Leiste, nie direkt auf dem bewegten Hintergrund. Das ist
 * die Regel für den Umbau, hier zum ersten Mal angewandt.
 */
function Werkbank({ istGegner }: { istGegner: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="t-card flex flex-wrap gap-1.5 rounded-pill p-1.5">
        {["Analysieren", "Gegner", "Athleten"].map((s, i) => (
          <span
            key={s}
            className="rounded-pill px-3 py-1.5"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              background: i === 0 ? "var(--accent-subtle)" : "transparent",
              border: `1px solid ${i === 0 ? "var(--accent)" : "transparent"}`,
              color: i === 0 ? "var(--accent-text)" : "var(--text-2)",
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="t-card flex flex-col gap-3 p-3">
        <span className="t-label">Wen analysierst du?</span>

        <div className="flex gap-2">
          {[
            { name: "Unsere Leute", aktiv: !istGegner },
            { name: "Gegner", aktiv: istGegner },
          ].map((m) => (
            <span
              key={m.name}
              className="flex-1 rounded-field px-3 py-2 text-center"
              style={{
                font: "var(--type-body-strong)",
                background: m.aktiv ? "var(--accent)" : "var(--surface-raised)",
                color: m.aktiv ? "var(--on-accent)" : "var(--text-2)",
                boxShadow: m.aktiv ? "var(--accent-glow)" : "none",
              }}
            >
              {m.name}
            </span>
          ))}
        </div>

        <div
          data-press="surface"
          className="t-interactive flex min-h-hit items-center gap-2.5 rounded-field px-3 py-2.5"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--accent)",
          }}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-badge"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            <Icon name={istGegner ? "target" : "user"} size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate"
              style={{ font: "var(--type-body-strong)", color: "var(--accent-text)" }}
            >
              {istGegner ? "Paul the Fighter" : "Noel Reichle"}
            </span>
            <span
              className="block truncate"
              style={{
                font: "var(--type-meta)",
                letterSpacing: "var(--ls-label)",
                color: "var(--text-3)",
              }}
            >
              DNA 98 % · 3 Videos
            </span>
          </span>
          <span
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--accent-text)",
            }}
          >
            Ändern
          </span>
        </div>

        <div
          className="flex items-center justify-center gap-2 rounded-field px-3 py-5"
          style={{
            border: "1px dashed var(--accent)",
            background: "color-mix(in oklab, var(--accent) 8%, transparent)",
            color: "var(--text-2)",
            font: "var(--type-sub)",
          }}
        >
          <Icon name="video" size={18} />
          Video hierher ziehen oder einfügen
        </div>

        <div className="t-progress">
          <span style={{ width: "42%" }} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-field px-4 py-2.5"
            style={{
              font: "var(--type-body-strong)",
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
            }}
          >
            Analyse starten
          </span>
          <span
            className="rounded-field px-4 py-2.5"
            style={{
              font: "var(--type-body-strong)",
              border: "1px solid var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            Meine Analysen
          </span>
        </div>
      </div>

      {/* Eine zweite Karte, damit sichtbar wird, wie Glas ÜBER Glas und
          Fließtext auf der Fläche wirken — im echten Bereich stehen unter der
          Werkbank die Bibliothekskarten aus Etappe 3a. */}
      <div className="t-card flex flex-col gap-2 p-3">
        <span className="t-label">Letzte Analyse</span>
        <p style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
          Kick-Boxen, 8 Minuten. Drei neue Befunde, einer davon in Konflikt mit
          dem Profil.
        </p>
        <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          Gestern, 19:42 · von Leon
        </p>
      </div>
    </div>
  );
}

/* ── Messwerte ───────────────────────────────────────────────────────────── */

function Messwerte({ messung }: { messung?: Messung }) {
  if (!messung) {
    return (
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        Messung läuft …
      </p>
    );
  }
  const zeilen: { name: string; wert: string; ok: boolean | null }[] = [
    { name: "Akzentfläche", wert: messung.akzentHex, ok: null },
    {
      name: "Knopfschrift auf der Fläche",
      wert: `${messung.aufAkzent.toFixed(2)}:1`,
      ok: messung.aufAkzent >= 4.5,
    },
    {
      name: "Akzenttext auf getönter Fläche",
      wert: `${messung.textAufTonung.toFixed(2)}:1`,
      ok: messung.textAufTonung >= 4.5,
    },
    {
      name: "Fließtext auf Glas (schlechtester Fall)",
      wert: `${messung.textAufGlas.toFixed(2)}:1`,
      ok: messung.textAufGlas >= 4.5,
    },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {zeilen.map((z) => (
        <span key={z.name} className="flex items-baseline gap-1.5">
          <span
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {z.name}
          </span>
          <span
            style={{
              font: "var(--type-body-strong)",
              color:
                z.ok === null
                  ? "var(--text-1)"
                  : z.ok
                    ? "var(--positive)"
                    : "var(--negative)",
            }}
          >
            {z.wert}
          </span>
        </span>
      ))}
    </div>
  );
}
