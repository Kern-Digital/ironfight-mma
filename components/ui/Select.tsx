"use client";

/**
 * Gestylter Ersatz für native <select>-Menüs (neues Token-System). Das
 * aufgeklappte Panel eines nativen Selects rendert das Betriebssystem und
 * fällt als Fremdkörper aus dem Design — deshalb hier ein Listbox-Pattern.
 *
 * Aufgeklappt bilden Feld und Panel EINE Einheit: gleiche Fläche
 * (--surface-raised), ein durchgehender Rahmen (Feld verliert unten
 * Rundung + Linie, Panel setzt sie fort), kleine Aufklapp-Animation
 * (.t-select-panel in globals.css, nur transform/opacity).
 *
 * Der Placeholder („— wählen —") steht NUR im Feld, nie als Listenzeile;
 * Options mit value "" werden nicht gelistet. Bei clearable löscht ein
 * Klick auf die bereits markierte Option die Auswahl (onChange("")) —
 * NUR für optionale Felder setzen; Pflichtfelder ohne Leerzustand
 * (z. B. Stil/Auslage im OpponentEditor) bleiben ohne clearable.
 * Tastatur: Pfeiltasten, Home/End, Enter, Escape; Klick außerhalb schließt.
 * STANDARD app-weit (Entscheidung 2026-08-21): keine nativen <select> mehr.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

export type SelectOption = { value: string; label: string };

export default function Select({
  value,
  options,
  onChange,
  placeholder = "— wählen —",
  clearable = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optionales Feld: Klick auf die markierte Option wählt ab (→ "") */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Placeholder gehört ins Feld, nicht in die Liste
  const listOptions = options.filter((o) => o.value !== "");
  const selected = listOptions.find((o) => o.value === value) ?? null;

  const close = useCallback((refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  }, []);

  // Klick/Tap außerhalb schließt
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  // Beim Öffnen die gewählte (sonst erste) Option fokussieren
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, listOptions.findIndex((o) => o.value === value));
    requestAnimationFrame(() => optionRefs.current[idx]?.focus());
    // listOptions ist pro Render neu — als Dep würde der Effekt dauerfeuern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onPanelKeyDown(e: React.KeyboardEvent) {
    const active = optionRefs.current.findIndex(
      (el) => el === document.activeElement,
    );
    if (e.key === "ArrowDown") {
      e.preventDefault();
      optionRefs.current[Math.min(listOptions.length - 1, active + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      optionRefs.current[Math.max(0, active - 1)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      optionRefs.current[listOptions.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className="t-interactive flex min-h-hit w-full items-center justify-between gap-2 px-3.5 text-left"
        style={{
          font: "var(--type-body)",
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          // Aufgeklappt: Feld + Panel = ein Rahmen (unten offen)
          borderBottomColor: open ? "transparent" : "var(--line)",
          borderRadius: open ? "var(--r-md) var(--r-md) 0 0" : "var(--r-md)",
          color: selected ? "var(--text-body)" : "var(--text-3)",
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span
          className="shrink-0"
          aria-hidden
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-fast) var(--ease-out)",
            lineHeight: 0,
          }}
        >
          <Icon name="chevron-down" size={16} strokeWidth={2.2} />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          onKeyDown={onPanelKeyDown}
          className="t-select-panel absolute inset-x-0 top-full z-40 overflow-y-auto p-1"
          style={{
            maxHeight: "min(300px, 40vh)",
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            borderTop: "none",
            borderRadius: "0 0 var(--r-md) var(--r-md)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          {listOptions.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                onClick={() => {
                  onChange(clearable && isSelected ? "" : o.value);
                  close(true);
                }}
                className="t-interactive t-select-option flex min-h-hit w-full items-center justify-between gap-2 rounded-badge px-2.5 text-left"
                style={{
                  // Staffelung der Gleit-Animation; Deckel, damit lange
                  // Listen nicht endlos nachtröpfeln
                  animationDelay: `${Math.min(i, 10) * 32}ms`,
                  font: "var(--type-body)",
                  // background nur setzen, wenn gewählt — sonst bliebe der
                  // Hover-Zustand aus .t-interactive wirkungslos (Inline-Stil
                  // schlägt die Hover-Regel)
                  background: isSelected ? "var(--accent-subtle)" : undefined,
                  color: isSelected ? "var(--accent-text)" : "var(--text-body)",
                }}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && (
                  <Icon
                    name="check"
                    size={14}
                    strokeWidth={2.6}
                    className="shrink-0"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
