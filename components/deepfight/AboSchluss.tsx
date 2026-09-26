"use client";

/**
 * DAS SCHLUSS-BAND (24.09.2026).
 *
 * Foto: public/abo/schluss.jpg (Pexels, docs/abo-bilder-herkunft.md).
 * Nike, Adidas, McFit: Die Seite endet mit einem Foto und EINEM Angebot,
 * nicht mit Kleingedrucktem. Hier: das erste Sparring hochladen — die drei
 * gratis Analysen sind das Angebot, das Abo kommt danach.
 */

import Icon from "@/components/ui/Icon";
import { Etage } from "@/components/deepfight/AboWerbung";

const KNOPF: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function AboSchluss({ restAnalysen, darfKaufen }: { restAnalysen: number; darfKaufen: boolean }) {
  return (
    <section aria-labelledby="abo-schluss-titel" className="abo-band abo-band--foto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/abo/schluss.jpg" alt="" aria-hidden decoding="async" loading="lazy" className="abo-band__bild" style={{ objectPosition: "50% 35%" }} />
      <span aria-hidden className="abo-band__schleier abo-band__schleier--mitte" />
      <div className="abo-spalte abo-band__inhalt abo-band__inhalt--mitte">
        <Etage
          id="abo-schluss-titel"
          label="Dein Start"
          zeile="Lad dein erstes Sparring hoch."
          nutzen={
            restAnalysen > 0
              ? `Die ersten ${restAnalysen} Analysen sind gratis. Du siehst das Ergebnis, bevor du ein Abo buchst.`
              : "Mit dem Abo kommen jeden Monat neue Analysen dazu. Ungenutztes bleibt dir 24 Monate."
          }
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          {restAnalysen > 0 && (
            <a
              href="/trainer/deepfight"
              data-press
              className="abo-hero__knopf abo-hero__knopf--primaer t-interactive inline-flex min-h-[52px] items-center gap-2 rounded-field px-6"
              style={KNOPF}
            >
              <Icon name="play" size={14} strokeWidth={2.4} />
              {restAnalysen} gratis einlösen
            </a>
          )}
          <a
            href="#abo-stufen-titel"
            data-press
            className={`abo-hero__knopf ${restAnalysen > 0 ? "" : "abo-hero__knopf--primaer"} t-interactive inline-flex min-h-[52px] items-center gap-2 rounded-field px-5`}
            style={KNOPF}
          >
            <Icon name="arrow-right" size={14} strokeWidth={2.4} />
            {darfKaufen ? "Jetzt durchstarten" : "Stufen ansehen"}
          </a>
        </div>
      </div>
    </section>
  );
}
