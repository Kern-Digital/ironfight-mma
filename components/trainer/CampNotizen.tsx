"use client";

/**
 * Notizen am Wettkampf — das Feld rechts im Seitenkopf (Leon 11.09.2026,
 * zweite Fassung: „einfach nur das dunkle Feld mit der Überschrift Notizen
 * darin. Klickt man darauf, erscheint nur der blinkende Strich; klicke ich
 * weg, wird automatisch gespeichert; klicke ich auf das, was ich geschrieben
 * habe, kommt nur das Mülleimer-Icon ohne Rahmen").
 *
 * Also: KEIN Eingabefeld mit Rand, KEIN Plus-Knopf, KEIN Leertext. Das Feld
 * selbst ist die Eingabe — ein Klick irgendwo auf die Karte setzt den Cursor
 * in eine unsichtbare Textfläche am Fuß. Speichern beim Verlassen (blur)
 * oder mit Enter; Shift+Enter macht eine neue Zeile, Escape verwirft.
 *
 * Mehrere Leute können eintragen; jede Zeile trägt deshalb den Namen. Löschen
 * kann nur die EIGENE Notiz, auf zwei Wegen, die ohne den anderen auskommen
 * (MOTION-BRIEF §3.3): Touch wischt (`SwipeAction`, roter Balken mit
 * Mülleimer), am Zeiger zeigt ein Klick auf die Zeile das nackte
 * Mülleimer-Icon. Fremde Notizen sind nur zu lesen.
 *
 * Neuestes oben — wer die Seite öffnet, will sehen, was zuletzt dazukam.
 *
 * KLEIN IM RUHEZUSTAND, GROSS BEIM SCHREIBEN (Leon 12.09.2026, zweite
 * Runde: „wenn ich auf das Feld klicke, etwas größer machen, sodass man gut
 * lesen und schreiben kann; klicke ich woanders hin, soll es wieder auf die
 * kleine Ansicht wandern").
 *
 * Der Vorgänger wuchs bis ans Vs.-Banner herunter und stand dort als hoher
 * leerer Kasten — die Karte nahm sich ihren Platz, bevor irgendjemand etwas
 * hineingeschrieben hatte. Jetzt gibt es ZWEI Maße, und der Fokus entscheidet:
 *
 *   ruhig   `--notiz-h-klein` — Überschrift, Eingabezeile, ein Blick auf die
 *           neueste Notiz. Endet weit über dem Banner.
 *   weit    `--notiz-h-weit` — genug Fläche zum Lesen und Schreiben. Die
 *           Karte legt sich dabei ÜBER das, was darunter steht (z-index),
 *           statt es zu verschieben: Ein Fokus-Zustand darf das Layout der
 *           Seite nicht umbauen.
 *
 * Zurück ins kleine Maß geht es über `pointerdown` daneben oder Escape —
 * derselbe Weg, den auch die Auswahl-Platten der DeepFight-Landung nehmen.
 * Der Entwurf ist dabei nicht verloren: Das Verlassen der Textfläche
 * speichert ihn wie eh und je (blur → `eintragen`).
 *
 * Innen gilt die Popup-Regel aus dem MOTION-BRIEF: Überschrift und Eingabe
 * stehen fest, GENAU EIN Bereich — die Liste — trägt `min-h-0 flex-1
 * overflow-y-auto`. Die Eingabe steht deshalb OBEN unter der Überschrift,
 * nicht am Fuß: Bei einer langen Liste wäre sie sonst erst nach dem Scrollen
 * erreichbar, und die neueste Notiz erscheint direkt unter ihr.
 *
 * Die Fläche ist durchlässiger als eine normale `.t-card` (Leon: „auch der
 * Hintergrund soll etwas mehr durchsichtig werden") — Maße und Farbe stehen
 * in globals.css unter „DIE NOTIZEN AM WETTKAMPF".
 */

import SwipeAction from "@/components/SwipeAction";
import { FlowItem, Pop, StaggerFlow } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import type { CampNotiz } from "@/lib/fight-camp";
import { useCallback, useEffect, useRef, useState } from "react";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function formatKurz(ms: number): string {
  return new Date(ms).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
}

export default function CampNotizen({
  notizen,
  eigeneUid,
  onAdd,
  onRemove,
  className = "",
}: {
  notizen: CampNotiz[];
  eigeneUid: string;
  /** Legt eine neue Notiz an; der Aufrufer baut das Objekt (Autor, Zeit). */
  onAdd: (text: string) => Promise<void>;
  onRemove: (notiz: CampNotiz) => Promise<void>;
  /** Höhengrenze (max-h-…) — darüber hinaus scrollt die Liste innen. */
  className?: string;
}) {
  const [entwurf, setEntwurf] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Eigene Zeile, an der gerade der Mülleimer steht (Zeiger-Weg). */
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  /** Das große Maß — solange hier gelesen oder geschrieben wird. */
  const [weit, setWeit] = useState(false);
  const feldRef = useRef<HTMLTextAreaElement>(null);
  const kartenRef = useRef<HTMLElement>(null);

  /* Zurück ins kleine Maß: ein Zeiger daneben oder Escape. `pointerdown`
     statt `click`, damit das Zusammenklappen nicht erst nach einer Aktion
     woanders passiert. Der Entwurf speichert dabei über blur. */
  const schliessen = useCallback(() => {
    setWeit(false);
    setGewaehlt(null);
  }, []);

  useEffect(() => {
    if (!weit) return;
    const daneben = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !kartenRef.current?.contains(event.target)
      ) {
        schliessen();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") schliessen();
    };
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", escape);
    };
  }, [weit, schliessen]);

  const sortiert = [...notizen].sort((a, b) => b.createdAt - a.createdAt);

  async function eintragen() {
    const text = entwurf.trim();
    if (!text || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      await onAdd(text);
      setEntwurf("");
      if (feldRef.current) feldRef.current.style.height = "auto";
    } catch {
      setFehler("Notiz konnte nicht gespeichert werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function loeschen(notiz: CampNotiz) {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      await onRemove(notiz);
      setGewaehlt(null);
    } catch {
      setFehler("Notiz konnte nicht gelöscht werden.");
    } finally {
      setLaeuft(false);
    }
  }

  /** Die Textfläche wächst mit dem Inhalt — kein Scrollbalken im Feld. */
  function wachsen(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <section
      ref={kartenRef}
      className={`t-card camp-notizen flex w-full min-h-0 cursor-text flex-col gap-3 overflow-hidden p-4 ${className}`}
      data-weit={weit || undefined}
      aria-label="Notizen zum Wettkampf"
      // Jede Berührung der Karte öffnet das große Maß — auch das Lesen einer
      // langen Notiz braucht Platz, nicht nur das Schreiben.
      onPointerDown={() => setWeit(true)}
      onFocusCapture={() => setWeit(true)}
      // Ein Klick auf die freie Fläche setzt den Cursor — nicht aber ein
      // Klick auf eine Zeile oder einen Knopf, die haben ihre eigene Arbeit.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, textarea")) return;
        feldRef.current?.focus();
      }}
    >
      <span className="t-label shrink-0">Notizen</span>

      {fehler && (
        <p
          className="t-danger shrink-0 rounded-field px-3 py-2"
          style={{ font: "var(--type-sub)" }}
        >
          {fehler}
        </p>
      )}

      {/* Die unsichtbare Eingabe: kein Rand, keine Fläche, kein Platzhalter —
          nur der Cursor, sobald sie den Fokus hat. Steht fest über der Liste. */}
      <textarea
        ref={feldRef}
        value={entwurf}
        rows={1}
        aria-label="Neue Notiz"
        disabled={laeuft}
        onChange={(e) => {
          setEntwurf(e.target.value);
          wachsen(e.target);
        }}
        onBlur={() => void eintragen()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void eintragen();
          } else if (e.key === "Escape") {
            setEntwurf("");
            e.currentTarget.blur();
          }
        }}
        className="w-full shrink-0 resize-none bg-transparent outline-none disabled:opacity-60"
        style={{
          font: "var(--type-sub)",
          color: "var(--text-body)",
          caretColor: "var(--accent)",
          /* Im großen Maß ist die Schreibfläche die Hauptsache: Sie startet
             mit Platz für ein paar Zeilen und wächst mit dem Text, bis die
             Liste darunter ihren Anteil braucht. */
          minHeight: weit ? "5em" : "1.6em",
          maxHeight: weit ? "55%" : "1.6em",
        }}
      />

      {sortiert.length > 0 && (
        <StaggerFlow className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {sortiert.map((n, i) => {
            const eigen = n.authorUid === eigeneUid;
            const offen = eigen && gewaehlt === n.id;
            const wisch = eigen
              ? {
                  color: "var(--gesture-delete)",
                  icon: "trash" as const,
                  onTrigger: () => void loeschen(n),
                }
              : undefined;
            return (
              <FlowItem key={n.id} index={i}>
                <SwipeAction left={wisch} right={wisch} disabled={laeuft}>
                  <div className="flex items-start gap-1">
                    {eigen ? (
                      <button
                        type="button"
                        onClick={() => setGewaehlt(offen ? null : n.id)}
                        aria-expanded={offen}
                        aria-label={`Eigene Notiz vom ${formatKurz(n.createdAt)}`}
                        data-press="quiet"
                        className="t-interactive -mx-2 flex min-h-hit min-w-0 flex-1 flex-col gap-0.5 rounded-field px-2 py-2 text-left"
                      >
                        <NotizKopf notiz={n} eigen />
                        <NotizText text={n.text} />
                      </button>
                    ) : (
                      <div className="flex min-h-hit min-w-0 flex-1 flex-col gap-0.5 py-2">
                        <NotizKopf notiz={n} eigen={false} />
                        <NotizText text={n.text} />
                      </div>
                    )}
                    {eigen && (
                      <Pop open={offen} originClass="origin-right">
                        {/* Nur das Icon, kein Rahmen — Leons Ansage. */}
                        <button
                          type="button"
                          onClick={() => void loeschen(n)}
                          disabled={laeuft}
                          aria-label="Notiz löschen"
                          className="t-interactive mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-field disabled:opacity-40"
                          style={{ color: "var(--negative)" }}
                        >
                          <Icon name="trash" size={16} strokeWidth={2.2} />
                        </button>
                      </Pop>
                    )}
                  </div>
                </SwipeAction>
              </FlowItem>
            );
          })}
        </StaggerFlow>
      )}
    </section>
  );
}

function NotizKopf({ notiz, eigen }: { notiz: CampNotiz; eigen: boolean }) {
  return (
    <span className="flex w-full items-baseline justify-between gap-2">
      <span
        className="truncate"
        style={{
          ...META_FONT,
          color: eigen ? "var(--accent-text)" : "var(--text-2)",
        }}
      >
        {notiz.authorName}
      </span>
      <span
        className="shrink-0"
        style={{ ...META_FONT, color: "var(--text-3)" }}
      >
        {formatKurz(notiz.createdAt)}
      </span>
    </span>
  );
}

function NotizText({ text }: { text: string }) {
  return (
    <span
      className="whitespace-pre-wrap break-words"
      style={{ font: "var(--type-sub)", color: "var(--text-body)" }}
    >
      {text}
    </span>
  );
}
