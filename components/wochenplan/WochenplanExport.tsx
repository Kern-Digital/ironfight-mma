"use client";

/**
 * WOCHENPLAN HERUNTERLADEN — das Sheet hinter dem Knopf „Herunterladen"
 * (Leon 28.09.2026, Auftrag und Antworten in lib/wochenplan-export.ts).
 *
 * Oben die Wahl des Formats, darunter die Vorschau — und die Vorschau IST die
 * Datei: `html-to-image` nimmt genau diese Fläche auf (die Verkleinerung sitzt
 * am Rahmen drumherum, die Aufnahme sieht sie nicht). Was Leon sieht, landet
 * in der Halle.
 *
 * Bibliotheken nur beim Klick nachgeladen (html-to-image 1.11.13, jspdf
 * 4.2.1, beide exakt gepinnt) — die Seite selbst wird dadurch nicht schwerer.
 *
 * Wird eingebunden von der echten Seite (app/verwaltung/wochenplan) und von
 * Entwurf B; beide geben den Plan, den man gerade ansieht, und die Kurse, die
 * gerade sichtbar sind (Raumfilter), herein.
 */

import { SheetShell } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { tagSchluessel } from "@/lib/guthaben";
import { tagText, type Wochenplan } from "@/lib/kursplan";
import { getBlocksForDay, WEEKDAY_LABELS } from "@/lib/schedule";
import type { TrainingBlock } from "@/lib/types";
import {
  dateiName,
  EXPORT_FORMATE,
  gueltigText,
  markeAusGym,
  planNameFuerDruck,
  type DruckMarke,
  type ExportFormatId,
} from "@/lib/wochenplan-export";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import WochenplanDruck, { type DruckTag, type WochenplanDruckGriff } from "./WochenplanDruck";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const LABEL: React.CSSProperties = {
  font: "600 11px/1.3 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

const FORMAT_WAHL: { id: ExportFormatId; name: string; hilfe: string }[] = [
  { id: "pdf-a4", name: "PDF", hilfe: "A4 quer, zum Ausdrucken" },
  { id: "bild-quer", name: "Bild quer", hilfe: "1920 × 1080" },
  { id: "bild-hoch", name: "Bild hoch", hilfe: "1080 × 1350, fürs Handy" },
];

/** Ein https-Logo (die Route erlaubt es) als data-URL — sonst fehlt es im Bild. */
async function logoAlsDataUrl(url: string | null): Promise<string | null> {
  if (!url || url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((ok, fehl) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fehl(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    // Ohne CORS kein Logo — dann steht der Gym-Name als Schriftzug da.
    return null;
  }
}

function speichern(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Maße, die die Aufnahme NICHT aus der Vorschau übernimmt (siehe herunterladen). */
const OHNE_MASS = new Set(["width", "height", "inline-size", "block-size"]);

/** Safari lädt Bilder und Schriften im ersten Durchgang manchmal nicht mit. */
function istSafari() {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|android|crios|fxios/i.test(ua);
}

export default function WochenplanExport({
  offen,
  onClose,
  gymId,
  plan,
  plaene,
  kurse,
  raumFilter,
  trainerVon,
  raumVon,
  trainerGeladen,
}: {
  offen: boolean;
  onClose: () => void;
  gymId: string;
  /** Der Plan, den man gerade ansieht (Leon 28.09.: auch ein Ferienplan). */
  plan: Wochenplan | null;
  plaene: Wochenplan[];
  /** Die Kurse, die gerade sichtbar sind — mit Raumfilter nur die des Raums. */
  kurse: TrainingBlock[];
  /** Name des gefilterten Raums; null = alle Räume. */
  raumFilter: string | null;
  trainerVon: (k: TrainingBlock) => string[];
  raumVon: (k: TrainingBlock) => string | undefined;
  /** Solange die Trainer laden, fehlten ihre Namen in der Datei. */
  trainerGeladen: boolean;
}) {
  const [formatId, setFormatId] = useState<ExportFormatId>("pdf-a4");
  const [bildTyp, setBildTyp] = useState<"png" | "jpg">("png");
  const [marke, setMarke] = useState<DruckMarke | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const griff = useRef<WochenplanDruckGriff>(null);
  const rahmen = useRef<HTMLDivElement>(null);
  const [rahmenBreite, setRahmenBreite] = useState(0);
  const format = EXPORT_FORMATE[formatId];
  const heute = tagSchluessel();

  useEffect(() => {
    if (!offen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen, onClose]);

  // Marke bei JEDEM Öffnen frisch lesen: Die Stufe entscheidet beim Lesen,
  // und wer gerade unter „Marke" sein Logo getauscht hat, sieht es sofort.
  useEffect(() => {
    if (!offen || !gymId) return;
    let lebt = true;
    setFehler(null);
    (async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { getFirestoreDb } = await import("@/lib/firebase");
        const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
        const name = (snap.get("name") as string | undefined)?.trim() || gymId;
        const m = markeAusGym(name, { subscription: snap.get("subscription"), branding: snap.get("branding") });
        const logo = m.tidal ? null : await logoAlsDataUrl(m.logo);
        if (lebt) setMarke({ ...m, logo });
      } catch {
        if (lebt) setFehler("Dein Gym ließ sich gerade nicht laden. Versuch es gleich noch einmal.");
      }
    })();
    return () => {
      lebt = false;
    };
  }, [offen, gymId]);

  // Die Vorschau füllt die Breite des Sheets; die Datei behält ihre Größe.
  useLayoutEffect(() => {
    const el = rahmen.current;
    if (!offen || !el) return;
    const messen = () => setRahmenBreite(el.clientWidth);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [offen, marke]);

  // Schriften fertig → noch einmal einpassen (Archivo breiter als der Ersatz).
  useEffect(() => {
    if (!offen || !marke) return;
    let lebt = true;
    void document.fonts.ready.then(() => {
      if (lebt) griff.current?.einpassen();
    });
    return () => {
      lebt = false;
    };
  }, [offen, marke, formatId]);

  const tage: DruckTag[] = useMemo(
    () =>
      WEEKDAY_LABELS.map((label, i) => ({
        label,
        kurse: getBlocksForDay(kurse, i).map((k) => ({
          id: k.id,
          zeit: `${k.startTime} – ${k.endTime}`,
          titel: k.title,
          trainer: trainerVon(k).join(", "),
          // Mit Raumfilter steht der Raum schon im Kopf.
          raum: raumFilter ? undefined : raumVon(k),
        })),
      })),
    [kurse, trainerVon, raumVon, raumFilter],
  );

  const endung = formatId === "pdf-a4" ? "pdf" : bildTyp;
  const leer = kurse.length === 0;
  const bereit = !!marke && !!plan && trainerGeladen && !leer;
  const massstab = rahmenBreite > 0 ? rahmenBreite / format.breite : 0;

  async function herunterladen() {
    const knoten = griff.current?.knoten;
    if (!bereit || !knoten || !plan || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      await document.fonts.ready;
      griff.current?.einpassen();
      const { toCanvas } = await import("html-to-image");
      const optionen = {
        pixelRatio: format.pixelRatio,
        width: format.breite,
        height: format.hoehe,
        backgroundColor: "#ffffff",
        // Ohne Breite und Höhe aus der Vorschau: html-to-image setzt die
        // Schrift beim Aufnehmen 0,1 px kleiner. Mit festen Maßen blieb in
        // Karten, deren Titel dadurch eine Zeile weniger brauchte, unten Luft.
        // Die Wurzel bekommt ihre Maße über width/height oben.
        includeStyleProperties: Array.from(window.getComputedStyle(document.documentElement)).filter(
          (p) => !OHNE_MASS.has(p),
        ),
      };
      if (istSafari()) await toCanvas(knoten, optionen);
      const canvas = await toCanvas(knoten, optionen);
      let blob: Blob;
      if (formatId === "pdf-a4") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        // Bezahlt steht nirgends Tidal — auch nicht in den Datei-Angaben.
        pdf.setProperties({
          title: `Wochenplan ${marke!.gymName}${planNameFuerDruck(plan.name) ? ` · ${plan.name}` : ""}`,
          author: marke!.gymName,
          creator: marke!.tidal ? "Tidal Athletics" : marke!.gymName,
        });
        pdf.addImage(canvas, "PNG", 0, 0, 297, 210, undefined, "FAST");
        blob = pdf.output("blob");
      } else {
        blob = await new Promise<Blob>((ok, fehl) =>
          canvas.toBlob(
            (b) => (b ? ok(b) : fehl(new Error("leer"))),
            bildTyp === "jpg" ? "image/jpeg" : "image/png",
            0.92,
          ),
        );
      }
      speichern(blob, dateiName(plan.name, formatId, endung));
    } catch {
      setFehler("Die Datei ließ sich gerade nicht erstellen. Versuch es gleich noch einmal.");
    } finally {
      setLaeuft(false);
    }
  }

  const knopfText = laeuft ? `Erstelle ${endung.toUpperCase()}…` : `${endung.toUpperCase()} herunterladen`;

  return (
    <SheetShell
      open={offen}
      onClose={onClose}
      label="Wochenplan herunterladen"
      panelClassName="pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-3xl sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "92dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <div className="flex min-w-0 flex-col items-start">
          <div aria-hidden className="mb-2 h-1 w-10 rounded-full sm:invisible" style={{ background: "var(--line-strong)" }} />
          <span className="t-sheet-title">Wochenplan herunterladen</span>
        </div>
        <XKnopf onClick={onClose} ariaLabel="Schließen" wort="Schließen" drehung="roll" style={{ color: "var(--text-2)" }} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-2 pt-3" data-export-sheet>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Als PDF für den Aushang in der Halle oder als Bild für deine Gruppen.
        </p>

        <div className="flex flex-col gap-2">
          <span style={LABEL}>Format</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format" data-export-formate>
            {FORMAT_WAHL.map((f) => {
              const an = f.id === formatId;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={an}
                  data-press
                  onClick={() => setFormatId(f.id)}
                  className="t-interactive flex min-h-hit flex-col items-start justify-center gap-0.5 rounded-field px-3 py-2.5 text-left"
                  style={{
                    background: an ? "var(--accent-subtle)" : "var(--surface-raised)",
                    border: `1px solid ${an ? "var(--accent)" : "var(--line)"}`,
                  }}
                  data-export-format={f.id}
                >
                  <span style={{ font: "var(--type-body-strong)", color: an ? "var(--accent-text)" : "var(--text-1)" }}>
                    {f.name}
                  </span>
                  {/* Schmal steht nur der Name — die Vorschau darunter zeigt das Format. */}
                  <span className="hidden sm:block" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    {f.hilfe}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {formatId !== "pdf-a4" && (
          <div className="flex items-center gap-3">
            <span style={LABEL}>Datei</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Dateityp" data-export-typ>
              {(["png", "jpg"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={bildTyp === t}
                  data-press
                  onClick={() => setBildTyp(t)}
                  className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
                  style={{
                    ...BTN_FONT,
                    fontSize: "12px",
                    background: bildTyp === t ? "var(--accent-subtle)" : "transparent",
                    border: `1px solid ${bildTyp === t ? "var(--accent)" : "var(--line)"}`,
                    color: bildTyp === t ? "var(--accent-text)" : "var(--text-2)",
                  }}
                  data-export-typ-wahl={t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Die Vorschau ist die Datei: aufgenommen wird die Fläche selbst,
            die Verkleinerung sitzt nur am Rahmen. */}
        <div
          ref={rahmen}
          className="relative w-full overflow-hidden rounded-field"
          style={{
            height: massstab ? format.hoehe * massstab : undefined,
            aspectRatio: massstab ? undefined : `${format.breite} / ${format.hoehe}`,
            border: "1px solid var(--line)",
            background: "#ffffff",
            maxWidth: format.lage === "hoch" ? 420 : undefined,
            marginInline: format.lage === "hoch" ? "auto" : undefined,
          }}
          data-export-vorschau
        >
          {marke && plan && massstab > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `scale(${massstab})`,
                transformOrigin: "0 0",
                pointerEvents: "none",
              }}
            >
              <WochenplanDruck
                ref={griff}
                format={format}
                marke={marke}
                planName={planNameFuerDruck(plan.name)}
                gueltig={gueltigText(plan, plaene, heute)}
                raum={raumFilter}
                tage={tage}
                stand={`Stand ${tagText(heute)}`}
              />
            </div>
          )}
        </div>

        {raumFilter && (
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }} data-export-filter>
            Nur die Kurse in „{raumFilter}“, so wie du gerade filterst.
          </p>
        )}
        {marke?.tidal && (
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }} data-export-hinweis="tidal">
            Ab dem Gym-Abo trägt der Aushang dein Logo und deine Farbe.
          </p>
        )}
        {marke && !marke.tidal && !marke.logo && (
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }} data-export-hinweis="ohne-logo">
            Lad unter{" "}
            <Link href="/verwaltung/branding" className="underline" style={{ color: "var(--accent-text)" }}>
              Marke
            </Link>{" "}
            dein Logo hoch, dann steht es oben rechts.
          </p>
        )}
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t px-5 pt-3"
        style={{ borderColor: "var(--line)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <p
          role={fehler ? "alert" : undefined}
          className="min-w-0 flex-1"
          style={{ font: "var(--type-sub)", color: fehler ? "var(--negative)" : "var(--text-3)" }}
        >
          {fehler ?? (leer ? "In diesem Plan steht noch kein Kurs." : "")}
        </p>
        <button
          type="button"
          data-press
          disabled={!bereit || laeuft}
          onClick={() => void herunterladen()}
          className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-2 rounded-field px-5 disabled:opacity-50"
          style={{ ...BTN_FONT, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--accent-glow)" }}
          data-export-los
        >
          <Icon name="download" size={14} strokeWidth={2.4} />
          {knopfText}
        </button>
      </div>
    </SheetShell>
  );
}
