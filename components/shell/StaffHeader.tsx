"use client";

/**
 * Der Kopf über dem Inhalt der Stab-Hülle (Leons Vorgabe 01.09.2026
 * nachmittags): links das Gym und der Pfad zur offenen Seite, rechts der
 * Kurs, der gerade läuft oder als nächster kommt — mit Klick als Abkürzung
 * zum Kursplan.
 *
 * ER SITZT RECHTS NEBEN DER SIDEBAR, NICHT DARÜBER. Die Sidebar behält die
 * volle Fensterhöhe; dieser Kopf gehört zum Inhalt und klebt an dessen
 * Oberkante. Ein Balken über beidem hätte die Sidebar zu einer Spalte UNTER
 * einer Navigation gemacht — also genau die Kopfzeile zurückgeholt, die mit
 * der Hülle wegfallen sollte.
 *
 * ER STEHT FREI (Leon 01.09.): eigene Fläche, Rundung an allen Ecken, Abstand
 * zum Bildschirmrand und zur Sidebar — dieselben Tokens wie dort
 * (`--shell-gap`, `--r-shell`). Fest bleibt er trotzdem: `sticky` mit genau
 * dem Abstand oben, den er ringsum hat, damit er beim Blättern an derselben
 * Stelle stehen bleibt und nicht an den Rand springt.
 *
 * NUR AB `lg`. Auf dem Handy fehlt die Breite für Pfad UND Kurs, und der Pfad
 * steht dort ohnehin als Seitentitel. Die Grenze ist dieselbe wie in
 * `StaffShell` — zwei verschiedene Umbruchpunkte ergäben einen Bereich, in
 * dem die Sidebar schon steht, der Kopf aber noch fehlt.
 */

import Icon from "@/components/ui/Icon";
import { useAuth, useRights } from "@/lib/auth-context";
import { getGymName, gymInitials, resolveGymId } from "@/lib/gym";
import { getCurrentBlock, type CurrentBlock } from "@/lib/schedule";
import { shellBreadcrumb } from "@/lib/shell-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const LABEL: React.CSSProperties = {
  font: "var(--type-hd-label)",
  letterSpacing: "var(--ls-nav-heading)",
  textTransform: "uppercase",
  color: "var(--text-label)",
};

/** „18:30" bleibt „18:30" — die Blöcke tragen die Zeit schon als Text. */
function courtesyDay(offset: number): string {
  if (offset === 0) return "";
  if (offset === 1) return "Morgen · ";
  return "";
}

/** Was rechts steht: Zustand, Kursname, Zeitangabe. */
function courseParts(current: CurrentBlock): {
  label: string;
  title: string;
  time: string;
} {
  if (current.state === "now") {
    return {
      label: "Jetzt",
      title: current.block.title,
      time: `bis ${current.block.endTime}`,
    };
  }
  return {
    label: "Als Nächstes",
    title: current.block.title,
    time: `${courtesyDay(current.dayOffset)}${current.block.startTime}`,
  };
}

function CourseChip() {
  // DIE UHR DARF ERST NACH DEM EINHÄNGEN GELESEN WERDEN: Der Server rendert
  // diesen Kopf vor, der Browser rendert ihn noch einmal. Stünde in beiden
  // eine eigene `new Date()`, wären es zwei verschiedene Zeiten und React
  // meldete einen Hydrations-Fehler. Deshalb `null` als erster Zustand.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    // Halbminütlich nachziehen — der Wechsel von „als Nächstes" auf „jetzt"
    // soll passieren, ohne dass jemand neu lädt.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const current = useMemo(() => (now ? getCurrentBlock(now) : null), [now]);
  // Kein Kurs in der ganzen Woche (leerer Plan) → gar nichts anzeigen. Ein
  // leerer Rahmen wäre eine Aussage über nichts.
  if (!current) return null;

  const { label, title, time } = courseParts(current);
  const live = current.state === "now";

  return (
    <Link
      href="/schedule"
      className="t-interactive flex min-w-0 shrink-0 items-center gap-2.5 px-3 py-1.5"
      style={{ borderRadius: "var(--r-nav)", textDecoration: "none" }}
    >
      <span
        className="flex shrink-0 items-center"
        style={{ color: live ? "var(--accent-text)" : "var(--text-3)" }}
      >
        <Icon name="timer" size={18} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          style={{ ...LABEL, color: live ? "var(--accent-text)" : "var(--text-label)" }}
        >
          {label}
        </span>
        <span
          className="truncate"
          style={{ font: "var(--type-nav)", color: "var(--text-2)" }}
        >
          {title}
          <span style={{ color: "var(--text-3)" }}> · {time}</span>
        </span>
      </span>
    </Link>
  );
}

export default function StaffHeader() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const rights = useRights();

  const gymId = resolveGymId(profile);
  const [gymName, setGymName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getGymName(gymId).then((n) => {
      if (alive) setGymName(n);
    });
    return () => {
      alive = false;
    };
  }, [gymId]);

  const crumbs = useMemo(
    () => shellBreadcrumb(pathname, rights),
    [pathname, rights],
  );

  return (
    <header
      // FREISTEHEND UND AUS GLAS (Leon 01.09.): `t-glass` bringt Milchglas,
      // Rahmen und Schatten aus dem Token-System mit; überschrieben wird nur
      // der Radius, weil die Hülle ihren eigenen, größeren hat.
      className="t-glass sticky z-30 hidden shrink-0 items-center gap-4 lg:flex"
      style={{
        top: "var(--shell-gap)",
        height: "var(--hd-h)",
        flexShrink: 0,
        // ABSTAND RINGSUM (Leon 01.09.) — ein Zwischenstand hatte ihn bündig an
        // Ober- und rechten Rand gesetzt, das war falsch. Nach UNTEN ist der
        // Abstand bewusst größer als die anderen: Der Inhalt soll nicht am Kopf
        // kleben („das Hauptfeld soll etwas nach unten").
        margin: "var(--shell-gap) var(--shell-gap) calc(var(--shell-gap) * 4)",
        padding: "0 var(--hd-pad-x)",
        borderRadius: "var(--r-shell)",
      }}
    >
      {/* Gym — seit Leons Entscheidung 01.09. hier statt im Sidebar-Kopf.
          Kein Link: Eine Gym-Seite gibt es nicht; sie käme erst mit der
          Admin-Konsole in Phase 3. */}
      <span className="flex shrink-0 items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center"
          style={{
            borderRadius: "var(--r-kbd)",
            background: "var(--accent)",
            color: "var(--on-accent)",
            font: "600 12px/1 var(--font-body)",
          }}
        >
          {gymInitials(gymName ?? "Tidal Athletics")}
        </span>
        <span className="truncate" style={LABEL}>
          {gymName ?? ""}
        </span>
      </span>

      {crumbs.length > 0 && (
        <span
          aria-hidden
          className="h-4 w-px shrink-0"
          style={{ background: "var(--line)" }}
        />
      )}

      {/* Pfad — letztes Glied ist Text, davor Links. Eine Gruppe wie
          „Coach" ist keine Adresse und deshalb nie ein Link. */}
      <nav aria-label="Pfad" className="flex min-w-0 flex-1 items-center gap-1.5">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span
                  aria-hidden
                  className="flex shrink-0 items-center"
                  style={{ color: "var(--text-3)", transform: "rotate(-90deg)" }}
                >
                  <Icon name="chevron-down" size={14} strokeWidth={2} />
                </span>
              )}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="truncate"
                  style={{
                    font: "var(--type-nav)",
                    color: "var(--text-3)",
                    textDecoration: "none",
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="truncate"
                  style={{
                    font: last ? "var(--type-nav-active)" : "var(--type-nav)",
                    color: last ? "var(--text-body)" : "var(--text-3)",
                  }}
                  aria-current={last ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <CourseChip />
    </header>
  );
}
