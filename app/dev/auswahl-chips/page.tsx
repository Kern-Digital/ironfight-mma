"use client";

/**
 * Dev-only Sichtprüfung der Auswahl-Chips im Kurs-Editor (04.09.2026).
 *
 * Der echte Ort liegt hinter Trainer-Login und einem geöffneten Kurs-Modal —
 * headless nicht erreichbar. Diese Seite rendert dieselbe Komponente mit 51
 * Techniken, also dem Fall, an dem die alte Reihe mit `max-h-32` einen
 * zweiten Scrollbereich im Fenster aufmachte. Geprüft wird:
 * höchstens zwei Zeilen, Zähler-Chip stimmt, Aufklappen zeigt alle.
 *
 * In Produktion 404; liegt bewusst außerhalb des Middleware-Matchers
 * (wie /dev/motion-sheet und /dev/helix).
 */

import { notFound } from "next/navigation";
import { useState } from "react";
import AuswahlChips from "@/components/schedule/AuswahlChips";
import { ALL_TECHNIQUES } from "@/lib/techniques";

export default function AuswahlChipsDevPage() {
  const [ids, setIds] = useState<string[]>(() =>
    ALL_TECHNIQUES.slice(0, 51).map((t) => t.id),
  );

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      className="min-h-screen px-4 py-8"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <h1 style={{ font: "var(--type-h2)" }}>Auswahl-Chips</h1>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {ids.length} Techniken gewählt — die Reihe darf höchstens zwei Zeilen
          hoch sein und niemals scrollen. &bdquo;+N weitere&ldquo; klappt auf sechs Zeilen
          auf; bleibt danach noch etwas übrig, sagt das ein Satz am Ende der
          Reihe. Der ist Auskunft, kein Knopf: Im echten Kurs-Fenster steht
          über den Chips die Technik-Liste, dort werden die restlichen
          abgewählt. Hier auf der Prüfseite fehlt diese Liste.
        </p>
        <div
          data-pruefflaeche
          className="t-card flex flex-col p-5"
          style={{ boxShadow: "var(--glass-shadow)" }}
        >
          <AuswahlChips
            ids={ids}
            onToggle={(id) => setIds((v) => v.filter((x) => x !== id))}
          />
        </div>
      </div>
    </main>
  );
}
