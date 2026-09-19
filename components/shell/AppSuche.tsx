"use client";

/**
 * Die Lupe der ganzen App (Leon 19.09.2026: „ein permanentes Suchsymbol, das
 * soweit die Berechtigung des Benutzers langt immer app-weit sucht").
 *
 * Was durchsucht wird und warum das die Berechtigung hält, steht in
 * lib/app-suche.ts. Hier steht nur die Form:
 *
 *   · Das Feld ist `GooeySearch` (Suchfeld-Standard, Leon 04.09.) — zugeklappt
 *     nur die Lupe, geöffnet ein Feld. Dieselbe Bauweise wie die Suche der
 *     DeepFight-Landung (components/deepfight/DeepFightSuche.tsx), nur über
 *     die ganze App.
 *   · `darstellung="kopf"`: Die Treffer liegen als Karte ÜBER der Seite unter
 *     der Lupe — im Fluss schöbe jeder Tastendruck den Kopf. Ein Klick
 *     daneben, Escape oder ein Seitenwechsel schließt sie.
 *   · `darstellung="liste"`: Im Menü auf dem Handy (dort gibt es keinen Kopf)
 *     stehen die Treffer im Fluss unter dem Feld, über den Menüpunkten.
 *
 * Es lädt erst mit dem ERSTEN Buchstaben: Wer nie sucht, kostet keine Abfrage.
 * Seiten, Techniken und Kurse stehen sofort da; jede geladene Gruppe kommt
 * dazu, sobald sie da ist — die billigen warten nicht auf die teuren.
 */

import { StaggerList } from "@/components/motion";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon, { type IconName } from "@/components/ui/Icon";
import {
  SUCH_GRUPPEN,
  kursTreffer,
  seitenTreffer,
  sucheIn,
  suchQuellen,
  technikTreffer,
  type SuchGruppe,
  type SuchTreffer,
} from "@/lib/app-suche";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** Wie viele Treffer je Gruppe höchstens stehen — der Rest wird gezählt. */
const PRO_GRUPPE = 5;

const SYMBOL: Record<SuchGruppe, IconName> = {
  seiten: "arrow-right",
  athleten: "user",
  gegner: "target",
  wettkaempfe: "trophy",
  analysen: "video",
  plaene: "clipboard",
  techniken: "glove",
  kurse: "calendar",
};

function TrefferZeile({ t, onGehen }: { t: SuchTreffer; onGehen: () => void }) {
  return (
    <Link
      href={t.href}
      onClick={onGehen}
      data-press="quiet"
      data-such-treffer={t.gruppe}
      className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--line)",
        textDecoration: "none",
        color: "var(--text-body)",
      }}
    >
      <span className="flex shrink-0 items-center" style={{ color: "var(--accent-text)" }}>
        <Icon name={SYMBOL[t.gruppe]} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ font: "var(--type-body-strong)" }}>
          {t.titel}
        </span>
        <span className="block truncate" style={{ ...META_FONT, color: "var(--text-2)" }}>
          {t.zusatz}
        </span>
      </span>
      <span aria-hidden className="shrink-0" style={{ color: "var(--text-2)", lineHeight: 0 }}>
        <Icon name="arrow-right" size={14} strokeWidth={2.2} />
      </span>
    </Link>
  );
}

export default function AppSuche({
  darstellung = "kopf",
  onGehen,
  offenStart = false,
}: {
  darstellung?: "kopf" | "liste";
  /** Feld schon offen und fokussiert einhängen (Sheet der Athleten-Leiste). */
  offenStart?: boolean;
  /** Wird gerufen, wenn ein Treffer angetippt wird (z. B. Menü schließen). */
  onGehen?: () => void;
}) {
  const { user, profile } = useAuth();
  const rights = useRights();
  const gymId = resolveGymId(profile);
  const uid = user?.uid ?? "";
  const pathname = usePathname();
  const [wert, setWert] = useState("");
  const [offen, setOffen] = useState(false);
  const [geladen, setGeladen] = useState<Partial<Record<SuchGruppe, SuchTreffer[]>>>({});
  const [laeuft, setLaeuft] = useState<SuchGruppe[]>([]);
  const huelle = useRef<HTMLDivElement>(null);
  const q = wert.trim();

  // Wie weit das Feld im Kopf aufgeht: ab 1440 px 300, darunter 220 — der
  // Kurs rechts bleibt auch bei offener Suche stehen (Leon 19.09.2026) und
  // braucht seinen Rest. GooeySearch nimmt Pixel, keine Klassen, deshalb hier
  // per matchMedia.
  const [breit, setBreit] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1440px)");
    const setzen = () => setBreit(mq.matches);
    setzen();
    mq.addEventListener("change", setzen);
    return () => mq.removeEventListener("change", setzen);
  }, []);

  // Was im Code steht, kostet nichts — sofort da.
  const fest = useMemo(
    () => ({ seiten: seitenTreffer(rights), techniken: technikTreffer(), kurse: kursTreffer() }),
    [rights],
  );

  // Mit dem ersten Buchstaben laden (einmal je fünf Minuten, lib/app-suche.ts).
  useEffect(() => {
    if (!q || !uid) return;
    const quellen = suchQuellen({ uid, gymId, rights });
    const offeneGruppen = Object.keys(quellen) as SuchGruppe[];
    let aktiv = true;
    setLaeuft(offeneGruppen);
    for (const g of offeneGruppen) {
      void quellen[g]!.then((liste) => {
        if (!aktiv) return;
        setGeladen((alt) => ({ ...alt, [g]: liste }));
        setLaeuft((l) => l.filter((x) => x !== g));
      });
    }
    return () => {
      aktiv = false;
    };
    // Nur beim Übergang „leer → etwas": Die Quellen hängen am Konto, nicht am
    // Suchwort — jeder weitere Buchstabe sucht im Speicher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q !== "", uid, gymId, rights]);

  // Ein Seitenwechsel schließt die Suche und leert sie.
  useEffect(() => {
    setWert("");
    setOffen(false);
  }, [pathname]);

  // Klick daneben oder Escape schließt die Treffer (nur im Kopf — im Menü
  // gehören sie zum Menü).
  useEffect(() => {
    if (darstellung !== "kopf" || !offen) return;
    const weg = (e: PointerEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("pointerdown", weg);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("pointerdown", weg);
      document.removeEventListener("keydown", taste);
    };
  }, [darstellung, offen]);

  const gruppen = useMemo(() => {
    if (!q) return [];
    return SUCH_GRUPPEN.map((g) => {
      const liste = g.id in fest ? fest[g.id as keyof typeof fest] : geladen[g.id];
      return { ...g, treffer: liste ? sucheIn(liste, q) : [], laedt: laeuft.includes(g.id) };
    });
  }, [q, fest, geladen, laeuft]);

  const zahl = gruppen.reduce((n, g) => n + g.treffer.length, 0);
  const laedtNoch = gruppen.some((g) => g.laedt);
  const zeigen = q.length > 0 && (darstellung === "liste" || offen);

  const gehen = () => {
    setOffen(false);
    onGehen?.();
  };

  const inhalt = (
    <>
      {gruppen
        .filter((g) => g.treffer.length > 0)
        .map((g) => (
          <section key={g.id} data-such-gruppe={g.id}>
            <p className="t-label mb-2">
              {g.titel}{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>({g.treffer.length})</span>
            </p>
            <StaggerList className="flex flex-col gap-2">
              {g.treffer.slice(0, PRO_GRUPPE).map((t) => (
                <TrefferZeile key={`${g.id}:${t.id}`} t={t} onGehen={gehen} />
              ))}
            </StaggerList>
            {g.treffer.length > PRO_GRUPPE && (
              <p className="mt-2" style={{ ...META_FONT, color: "var(--text-2)" }}>
                und {g.treffer.length - PRO_GRUPPE} weitere — tipp genauer
              </p>
            )}
          </section>
        ))}
      {laedtNoch && (
        <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }} data-such-laedt>
          Athleten, Gegner, Wettkämpfe und Pläne kommen gleich dazu.
        </p>
      )}
      {!laedtNoch && zahl === 0 && (
        <p style={{ font: "var(--type-body)", color: "var(--text-2)" }} data-such-leer>
          Zu &bdquo;{q}&ldquo; findet sich nichts, das du sehen darfst.
        </p>
      )}
    </>
  );

  return (
    <div
      ref={huelle}
      className={darstellung === "kopf" ? "relative flex shrink-0 flex-col items-end" : "flex flex-col gap-3"}
      data-app-suche={darstellung}
    >
      <GooeySearch
        value={wert}
        onChange={(v) => {
          setWert(v);
          setOffen(true);
        }}
        label="In der App suchen"
        placeholder="Athlet, Gegner, Technik, Seite…"
        nurSymbol={darstellung === "kopf"}
        offenStart={offenStart}
        // Kopf: nur die Lupe, ein Kreis in Touch-Höhe (GooeySearch verlangt
        // für `nurSymbol` breiteZu = Höhe). Menü: eine Pille mit dem Wort.
        breiteZu={darstellung === "kopf" ? 44 : 200}
        breiteAuf={darstellung === "kopf" ? (breit ? 300 : 220) : 260}
      />
      {zeigen &&
        (darstellung === "kopf" ? (
          <div
            // Unter sm am Fensterrand festgemacht: Neben dem Menü-Knopf der
            // Navbar ragte eine rechtsbündige Karte sonst links hinaus.
            className="t-card fixed inset-x-4 top-20 z-40 flex max-h-[min(70vh,40rem)] flex-col gap-4 overflow-y-auto overscroll-contain p-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(32rem,calc(100vw-2.5rem))] sm:p-5"
            style={{ boxShadow: "var(--shadow-pop)" }}
            data-such-treffer-liste
          >
            {inhalt}
          </div>
        ) : (
          <div className="flex flex-col gap-4" data-such-treffer-liste>
            {inhalt}
          </div>
        ))}
    </div>
  );
}
