"use client";

/**
 * Der Gameplan auf der Wettkampfseite — dein Athlet gegen genau diesen Gegner
 * (Leon 17.09.2026: „Claude, nur mit Beleg" · „nach jeder neuen Analyse
 * automatisch" · „drei Blöcke, Drills in den Plan"). Entscheidungen und Ablage
 * im Kopf von lib/gameplan.ts.
 *
 * Drei Blöcke nebeneinander (Handy untereinander): Deine Waffen · Die Gefahren
 * · So kämpfst du. Jeder Punkt trägt seinen Beleg. Die Drills stehen NICHT
 * hier, sondern in Phase 2 und 3 des Trainingsplans darunter.
 *
 * DER ZUSTAND KOMMT LIVE (`useGameplan` beobachtet das Dokument): Schreibt
 * Claude nach einer neuen Analyse neu, bleibt der alte Inhalt stehen, und oben
 * steht „Schreibt neu". Ein „schreibt", das länger als das Zeitbudget der
 * Funktion hängt, gilt als abgebrochen — dann gibt es „Neu schreiben".
 */

import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import {
  beobachteGameplan,
  gameplanHaengt,
  starteGameplan,
  type Gameplan,
  type GameplanPunkt,
} from "@/lib/gameplan";
import { SPORT_KURZ, type Sport } from "@/lib/video-analysis";

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

/** Beobachtet den Gameplan eines Wettkampfs. `aktiv=false` (keine Freigabe) liest nichts. */
export function useGameplan(uid: string, campId: string, aktiv: boolean) {
  const [gameplan, setGameplan] = useState<Gameplan | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [gesperrt, setGesperrt] = useState(false);

  useEffect(() => {
    if (!aktiv) return;
    setGeladen(false);
    return beobachteGameplan(
      uid,
      campId,
      (g) => {
        setGameplan(g);
        setGesperrt(false);
        setGeladen(true);
      },
      () => {
        setGesperrt(true);
        setGeladen(true);
      },
    );
  }, [uid, campId, aktiv]);

  return { gameplan, geladen, gesperrt };
}

function Punkte({ titel, icon, punkte }: { titel: string; icon: IconName; punkte: GameplanPunkt[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2">
        <span aria-hidden style={{ color: "var(--accent-2)", lineHeight: 0 }}>
          <Icon name={icon} size={16} />
        </span>
        <span className="t-label">{titel}</span>
      </div>
      {punkte.length === 0 ? (
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>Dafür geben die Profile noch nichts her.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {punkte.map((p, i) => (
            <li key={`${p.titel}-${i}`}>
              <div style={{ font: "var(--type-body-strong)" }}>{p.titel}</div>
              <p className="mt-0.5" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                {p.text}
              </p>
              {/* Belege sind ganze Sätze mit Zahlen (Nachweis 17.09.: bis 200
                  Zeichen) — in Versalien unlesbar, deshalb die kleine Fließschrift. */}
              {p.beleg && (
                <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  <span style={META_FONT}>Beleg</span> {p.beleg}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function zeit(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function GameplanBlock({
  uid,
  campId,
  sport,
  athletName,
  gegnerName,
  profilGesperrt,
  gameplan,
  geladen,
  gesperrt,
}: {
  uid: string;
  campId: string;
  sport: Sport | null;
  athletName: string;
  gegnerName: string;
  /** Kampfprofil nicht freigegeben — dann gibt es auch keinen Gameplan zu lesen. */
  profilGesperrt: boolean;
  gameplan: Gameplan | null;
  geladen: boolean;
  gesperrt: boolean;
}) {
  const [startet, setStartet] = useState(false);
  const [startFehler, setStartFehler] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());

  // Solange Claude schreibt, einmal je halbe Minute prüfen, ob der Lauf hängt.
  const schreibt = gameplan?.status === "schreibt";
  useEffect(() => {
    if (!schreibt) return;
    const t = window.setInterval(() => setJetzt(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [schreibt]);
  // Sobald das Dokument einen neuen Zustand meldet, ist der Start-Knopf erledigt.
  useEffect(() => {
    setStartet(false);
  }, [gameplan?.status, gameplan?.gestartetAt]);

  async function schreiben() {
    setStartet(true);
    setStartFehler(null);
    try {
      await starteGameplan(uid, campId, true);
    } catch (err) {
      setStartet(false);
      setStartFehler(err instanceof Error ? err.message : "Gameplan konnte nicht starten.");
    }
  }

  const haengt = gameplanHaengt(gameplan, jetzt);
  const inhalt = gameplan?.inhalt ?? null;
  const kurz = sport ? SPORT_KURZ[sport] : null;
  const laeuft = (schreibt && !haengt) || startet;

  const knopf = (label: string, primaer = false) => (
    <button
      type="button"
      onClick={() => void schreiben()}
      disabled={laeuft}
      data-press
      className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:cursor-not-allowed disabled:opacity-50"
      style={
        primaer
          ? { ...BTN_FONT, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--accent-glow)" }
          : { ...BTN_FONT, background: "var(--surface-raised)", border: "1px solid var(--line)", color: "var(--text-body)" }
      }
    >
      <Icon name="refresh" size={14} strokeWidth={2.4} />
      {startet ? "Startet…" : label}
    </button>
  );

  const hinweis = (text: string, aktion?: React.ReactNode) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>{text}</p>
      {aktion}
    </div>
  );

  let koerper: React.ReactNode;
  if (profilGesperrt || gesperrt) {
    koerper = hinweis(
      `Der Gameplan liest das Kampfprofil von ${athletName}. Sobald ${athletName} es für dich freigibt, steht er hier.`,
    );
  } else if (!sport) {
    koerper = hinweis("Wähl oben die Kampfart des Wettkampfs — dann schreibt Claude den Gameplan.");
  } else if (!geladen) {
    koerper = <Skeleton className="h-40 w-full rounded-field" />;
  } else if (!gameplan) {
    koerper = hinweis("Für dieses Duell steht noch kein Gameplan.", knopf("Gameplan schreiben", true));
  } else if (!inhalt && laeuft) {
    koerper = (
      <div className="flex flex-col gap-3">
        {hinweis(
          "Claude schreibt den Gameplan aus beiden Profilen. Das dauert ein bis zwei Minuten — lass die Seite offen oder komm später wieder.",
        )}
        <Skeleton className="h-28 w-full rounded-field" />
      </div>
    );
  } else if (!inhalt) {
    koerper = zustandsHinweis(gameplan, haengt, athletName, gegnerName, kurz, hinweis, knopf);
  } else {
    koerper = (
      <div className="flex flex-col gap-5">
        {(gameplan.status !== "fertig" || startet) &&
          zustandsHinweis(gameplan, haengt, athletName, gegnerName, kurz, hinweis, knopf, laeuft)}
        {inhalt.lage && <p style={{ font: "var(--type-body)" }}>{inhalt.lage}</p>}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Punkte titel="Deine Waffen" icon="target" punkte={inhalt.waffen} />
          <Punkte titel="Die Gefahren" icon="shield" punkte={inhalt.gefahren} />
          <Punkte titel="So kämpfst du" icon="spark" punkte={inhalt.soKaempfstDu} />
        </div>
        <div
          className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--line)" }}
        >
          <div style={{ ...META_FONT, color: "var(--text-3)" }}>
            {gameplan.stand &&
              `Du: ${gameplan.stand.athletAnalysen} ${gameplan.stand.athletAnalysen === 1 ? "Video" : "Videos"} · Profilstärke ${gameplan.stand.athletStaerke} %  ·  ${gegnerName}: ${gameplan.stand.gegnerAnalysen} ${gameplan.stand.gegnerAnalysen === 1 ? "Video" : "Videos"}${gameplan.stand.gegnerScouting ? " + Scouting" : ""}`}
            {gameplan.geschriebenAt && ` · geschrieben ${zeit(gameplan.geschriebenAt)}`}
            {inhalt.drills.length > 0 && " · Drills im Trainingsplan, Phase 2 und 3"}
          </div>
          {gameplan.status === "fertig" && knopf("Neu schreiben")}
        </div>
      </div>
    );
  }

  return (
    <section className="mt-10" id="gameplan" style={{ scrollMarginTop: "6rem" }} data-gameplan-status={gameplan?.status ?? "leer"}>
      <div className="mb-3">
        <h2 style={{ font: "var(--type-h2)", letterSpacing: "var(--ls-display)", textTransform: "uppercase" }}>
          Gameplan
        </h2>
        <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          {kurz ? `${kurz} · ` : ""}
          {athletName} gegen {gegnerName}
        </p>
      </div>
      <div className="t-card p-4 sm:p-5">
        {koerper}
        {startFehler && (
          <p className="mt-3" role="alert" style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
            {startFehler}
          </p>
        )}
      </div>
    </section>
  );
}

/** Hinweis zu „schreibt", „offen" und „fehler" — mit und ohne stehenden Inhalt. */
function zustandsHinweis(
  g: Gameplan,
  haengt: boolean,
  athlet: string,
  gegner: string,
  kurz: string | null,
  hinweis: (text: string, aktion?: React.ReactNode) => React.ReactNode,
  knopf: (label: string, primaer?: boolean) => React.ReactNode,
  laeuft = false,
): React.ReactNode {
  if (laeuft) {
    return (
      <div className="flex items-center gap-2" style={{ ...META_FONT, color: "var(--accent-text)" }}>
        <span aria-hidden className="h-2 w-2 rounded-full motion-safe:animate-pulse" style={{ background: "var(--accent)" }} />
        Claude schreibt den Gameplan neu
      </div>
    );
  }
  if (haengt) return hinweis("Das letzte Schreiben ist nicht fertig geworden.", knopf("Neu schreiben", true));
  if (g.status === "fehler") {
    return hinweis(`Claude konnte den Gameplan nicht schreiben: ${g.fehler ?? "unbekannter Fehler"}`, knopf("Erneut versuchen", true));
  }
  if (g.status === "offen") {
    switch (g.offen) {
      case "athlet":
        return hinweis(
          `${athlet} braucht zuerst ein ausgewertetes ${kurz ?? ""}-Video. Analysier eins auf der Athleten-Seite — danach schreibt Claude den Gameplan von selbst.`,
        );
      case "gegner":
        return hinweis(
          `Zu ${gegner} fehlen Videos und Scouting. Analysier ein Video oder trag im Gegnerprofil Stärken und Schwächen ein.`,
          knopf("Gameplan schreiben", true),
        );
      case "zeit":
        return hinweis("Neue Analysen sind da — schreib den Gameplan auf den neuen Stand.", knopf("Jetzt schreiben", true));
      case "kampfart":
        return hinweis("Wähl oben die Kampfart des Wettkampfs — dann schreibt Claude den Gameplan.");
    }
  }
  return null;
}
