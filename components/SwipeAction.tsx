"use client";

/**
 * Listen-Gesten auf Zeilen (Etappe Workout-Pläne, Spec-Punkt 4; Leons
 * Vorgaben 2026-08-28): Der Zeileninhalt zieht mit dem Finger, in der
 * freiwerdenden Kante haftet ein leuchtender Aktions-Balken und wächst mit —
 * pro Richtung eine eigene Aktion (z. B. rechts = Grün/hinzufügen bzw.
 * kopieren, links = Rot/löschen). Loslassen jenseits der Schwelle löst aus,
 * sonst schnappt die Zeile zurück. Kurzes Halten (Touch UND Maus) meldet
 * onHold — der Editor nutzt das zum Auswählen fürs Verschieben.
 *
 * Wischen ist NUR Touch (Desktop behält sichtbare Buttons). Vertikales
 * Scrollen bleibt frei — touch-action: pan-y überlässt dem Browser die
 * Vertikale (React registriert touchmove passiv, preventDefault wäre
 * wirkungslos), der Achsen-Lock hält diagonale Gesten sauber.
 */

import Icon, { type IconName } from "@/components/ui/Icon";
import { useEffect, useRef, useState } from "react";

/** Auslöse-Schwelle bzw. maximale Auslenkung in px */
const TRIGGER_PX = 64;
const MAX_PX = 96;
/** Kurzes Halten: Dauer + erlaubtes Zittern */
const HOLD_MS = 400;
const HOLD_TOLERANCE_PX = 8;

export interface SwipeSpec {
  /** Balken-Farbe als Token, z. B. var(--gesture-add) */
  color: string;
  icon: IconName;
  onTrigger: () => void;
}

export default function SwipeAction({
  left,
  right,
  onHold,
  disabled,
  children,
}: {
  /** Aktion beim Nach-links-Wischen (Balken an der rechten Kante) */
  left?: SwipeSpec;
  /** Aktion beim Nach-rechts-Wischen (Balken an der linken Kante) */
  right?: SwipeSpec;
  /** Kurzes Halten ohne Bewegung — Touch und Maus; bekommt die
      Zeigerposition, damit der Aufrufer direkt einen Drag starten kann
      (der Zeiger ist zu dem Zeitpunkt noch unten) */
  onHold?: (start: { x: number; y: number }) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"h" | "v" | null>(null);
  const suppressClickRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0);
  dxRef.current = dx;

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  function clearHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function armHold(start: { x: number; y: number }) {
    if (!onHold) return;
    clearHold();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      // Halten gewinnt: laufende Geste nicht mehr als Wisch/Klick werten
      suppressClickRef.current = true;
      axisRef.current = "v";
      setSnapping(true);
      setDx(0);
      onHold(start);
    }, HOLD_MS);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    axisRef.current = null;
    suppressClickRef.current = false;
    setSnapping(false);
    armHold(startRef.current);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled || !startRef.current) return;
    const t = e.touches[0];
    const rawX = t.clientX - startRef.current.x;
    const rawY = t.clientY - startRef.current.y;
    if (
      Math.abs(rawX) > HOLD_TOLERANCE_PX ||
      Math.abs(rawY) > HOLD_TOLERANCE_PX
    ) {
      clearHold();
    }
    if (!axisRef.current) {
      // Achse erst festlegen, wenn die Bewegung eindeutig ist
      if (Math.abs(rawX) < 6 && Math.abs(rawY) < 6) return;
      axisRef.current = Math.abs(rawX) > Math.abs(rawY) ? "h" : "v";
    }
    if (axisRef.current !== "h") return;
    // Nur Richtungen mit Aktion, am Anschlag hält der Balken an
    let next = rawX;
    if (next > 0 && !right) next = 0;
    if (next < 0 && !left) next = 0;
    setDx(Math.max(-MAX_PX, Math.min(MAX_PX, next)));
  }

  function onTouchEnd() {
    clearHold();
    if (disabled) return;
    const cur = dxRef.current;
    if (axisRef.current === "h" && Math.abs(cur) > 10) {
      // Browser feuern nach echten Drags teils trotzdem ein click-Event —
      // das würde z. B. im Picker doppelt hinzufügen
      suppressClickRef.current = true;
    }
    if (axisRef.current === "h") {
      if (cur >= TRIGGER_PX && right) right.onTrigger();
      else if (cur <= -TRIGGER_PX && left) left.onTrigger();
    }
    setSnapping(true);
    setDx(0);
    startRef.current = null;
    axisRef.current = null;
  }

  // Maus: NUR Halten (kein Wisch — Desktop hat sichtbare Buttons)
  function onMouseDown(e: React.MouseEvent) {
    if (disabled || !onHold || e.button !== 0) return;
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    suppressClickRef.current = false;
    armHold(mouseStartRef.current);
  }

  function onMouseMove(e: React.MouseEvent) {
    const s = mouseStartRef.current;
    if (!s) return;
    if (
      Math.abs(e.clientX - s.x) > HOLD_TOLERANCE_PX ||
      Math.abs(e.clientY - s.y) > HOLD_TOLERANCE_PX
    ) {
      clearHold();
      mouseStartRef.current = null;
    }
  }

  function onMouseEnd() {
    clearHold();
    mouseStartRef.current = null;
  }

  const barWidth = Math.abs(dx);
  const spec = dx > 0 ? right : dx < 0 ? left : undefined;

  return (
    <div
      className={onHold ? "relative select-none" : "relative"}
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseEnd}
      onMouseLeave={onMouseEnd}
      onContextMenu={(e) => {
        // Langes Halten darf kein Kontextmenü/Textauswahl öffnen
        if (onHold) e.preventDefault();
      }}
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClickRef.current = false;
        }
      }}
    >
      {/* Aktions-Balken — füllt exakt die freigewischte Kante und leuchtet */}
      {barWidth > 0 && spec && (
        <div
          aria-hidden
          className="absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-field"
          style={{
            ...(dx > 0 ? { left: 0 } : { right: 0 }),
            width: barWidth,
            background: spec.color,
            color: "var(--on-accent)",
            boxShadow: `0 0 18px color-mix(in oklab, ${spec.color} 60%, transparent)`,
          }}
        >
          {barWidth >= 28 && (
            <Icon name={spec.icon} size={16} strokeWidth={2.4} />
          )}
        </div>
      )}
      <div
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: snapping ? "transform .2s ease-out" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
