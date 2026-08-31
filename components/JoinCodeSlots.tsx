"use client";

/**
 * Die Code-Felder der Beitritts-Karte (Checkpoint 1C) — ein Kästchen pro
 * Zeichen, Gestaltung nach Leons Vorlage (31.08.), auf INVITE_CODE_LENGTH
 * erweitert und in zwei Vierergruppen geteilt, weil der Code überall als
 * ABCD-2345 geschrieben steht.
 *
 * Zwei Dinge, die die Vorlage nicht hatte und die hier gebraucht werden:
 *   • Einfügen aus der Zwischenablage verteilt sich über alle Kästchen —
 *     der Code kommt fast immer als Kopie aus einer Nachricht, und acht
 *     Kästchen einzeln zu befüllen wäre eine Zumutung.
 *   • Gefiltert wird auf INVITE_CODE_ALPHABET: 0/O und 1/I/L gibt es dort
 *     nicht, ein „O" ist also immer eine Null und wird still korrigiert.
 *
 * `readOnly` zeigt einen bereits bekannten Code in derselben Optik — so
 * sieht der Code auf beiden Beitritts-Seiten gleich aus.
 */

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
} from "@/lib/invites";
import { useEffect, useRef } from "react";

/** „O" statt „0" ist der häufigste Abtippfehler — leise geradeziehen. */
const LOOKALIKE: Record<string, string> = {
  O: "0",
  Q: "0",
  I: "J",
  L: "J",
};

function sanitize(raw: string): string {
  return normalizeInviteCode(raw)
    .split("")
    .map((c) => (INVITE_CODE_ALPHABET.includes(c) ? c : LOOKALIKE[c] ?? ""))
    .filter((c) => INVITE_CODE_ALPHABET.includes(c))
    .join("");
}

export default function JoinCodeSlots({
  value,
  onChange,
  onComplete,
  readOnly,
  autoFocus,
}: {
  /** Normalisierter Code, höchstens INVITE_CODE_LENGTH Zeichen. */
  value: string;
  onChange?: (next: string) => void;
  /** Läuft, sobald alle Felder gefüllt sind (Enter ist dann nur noch Kür). */
  onComplete?: (code: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus && !readOnly) refs.current[0]?.focus();
  }, [autoFocus, readOnly]);

  function put(next: string) {
    const clean = sanitize(next).slice(0, INVITE_CODE_LENGTH);
    onChange?.(clean);
    // Fokus wandert auf das erste noch leere Feld — auch nach dem Einfügen
    // eines ganzen Codes.
    const target = Math.min(clean.length, INVITE_CODE_LENGTH - 1);
    window.requestAnimationFrame(() => refs.current[target]?.focus());
    if (clean.length === INVITE_CODE_LENGTH) onComplete?.(clean);
  }

  function handleChange(index: number, raw: string) {
    const typed = sanitize(raw);
    if (!typed) return;
    if (typed.length > 1) {
      // Mehrere Zeichen auf einmal (Einfügen oder Autofill) ab hier einsetzen
      put(value.slice(0, index) + typed);
      return;
    }
    const next =
      value.slice(0, index) + typed + value.slice(index + 1, INVITE_CODE_LENGTH);
    put(next.slice(0, INVITE_CODE_LENGTH));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[index]) {
        // Zeichen im aktuellen Feld löschen und stehen bleiben
        onChange?.(value.slice(0, index) + value.slice(index + 1));
        return;
      }
      if (index > 0) {
        onChange?.(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < INVITE_CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  const group = (from: number, to: number) => (
    <div className="flex flex-1 gap-1.5 sm:gap-2">
      {chars.slice(from, to).map((c, i) => {
        const index = from + i;
        return (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            className="join-slot"
            type="text"
            inputMode="text"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoCapitalize="characters"
            spellCheck={false}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : 0}
            aria-label={`Zeichen ${index + 1} von ${INVITE_CODE_LENGTH}`}
            value={c}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => {
              e.preventDefault();
              put(value.slice(0, index) + e.clipboardData.getData("text"));
            }}
            onFocus={(e) => e.currentTarget.select()}
          />
        );
      })}
    </div>
  );

  return (
    <div
      className="flex items-center gap-2 sm:gap-3"
      role={readOnly ? "group" : undefined}
      aria-label={readOnly ? "Einladungscode" : undefined}
    >
      {group(0, 4)}
      <span
        aria-hidden
        className="h-px w-2 shrink-0 sm:w-3"
        style={{ background: "var(--panel-fg-3)" }}
      />
      {group(4, INVITE_CODE_LENGTH)}
    </div>
  );
}
