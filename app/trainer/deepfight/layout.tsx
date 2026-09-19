"use client";

/**
 * Bereichs-Layout von DeepFight — es färbt, es bewegt, es ordnet.
 *
 * DREI DINGE, ALLE HIER UND NIRGENDS SONST (Leons Neuaufbau, Teilschritt 2,
 * 07.09.2026):
 *
 *  1. `data-area="deepfight"` + `data-modus` — die Bereichsfärbung
 *     (globals.css, „Der DeepFight-Bereich"). Der Modus kommt aus dem
 *     Context (components/deepfight/deepfight-modus.tsx): Die Landung setzt
 *     ihn mit der Ziel-Auswahl, die Bibliotheken bekommen ihn aus der
 *     Adresse.
 *  2. Die bewegte Schicht (components/ui/Synthesis.tsx), EINMAL gemountet,
 *     fixiert hinter allem — wie `.shell-ambient`, nur für diesen Bereich.
 *     Drei Seiten mit je eigener Schicht hätten bei jedem Wechsel neu
 *     aufgebaut und geflackert.
 *  3. Die Glas-Leiste, auf den vier Seiten des Flusses. Die Detailseiten (ein
 *     Gegner, ein Athlet) tragen stattdessen ihren Zurück-Weg im Seitenkopf.
 *     Sie trägt seit Leons Neugestaltung (08.09.2026) keine Segmente mehr,
 *     sondern Wortmarke und Ortsangabe — Begründung in DeepFightLeiste.
 *
 * WARUM EIN CLIENT-LAYOUT, anders als app/admin/layout.tsx: Der Modus ist
 * Zustand, und der lebt in React. Die Falle aus CLAUDE.md („redirect() unter
 * einem Client-Layout greift nicht") trifft nicht — Adressen ziehen über
 * next.config.mjs um, keine Seite hier ruft redirect() auf.
 *
 * FALLE 17 (globals.css, `.staff-content > [data-area] > main`): Mit dieser
 * Hülle ist das <main> der Seite kein direktes Kind der Stab-Hülle mehr. Die
 * Regel deckt genau diesen Fall ab und schaltet den deckenden Seitengrund
 * ab — sonst schnitte er die Schicht quer über die Inhaltsspalte ab.
 */

import DeepFightLeiste from "@/components/deepfight/DeepFightLeiste";
import {
  DeepFightModusProvider,
  useDeepFightModus,
} from "@/components/deepfight/deepfight-modus";
import Synthesis from "@/components/ui/Synthesis";
import {
  KopfNavigation,
  KopfSegmente,
  type KopfSegment,
} from "@/components/shell/KopfNavigation";
import { usePathname } from "next/navigation";

/**
 * Wo die Glas-Leiste steht: auf den Seiten des Flusses unterhalb der Landung.
 *
 * DIE LANDUNG FEHLT SEIT DEM 10.09.2026. Leon: „oben links: DeepFight größer
 * ohne Rahmen, nur Text" — und rechts daneben, auf derselben Höhe, die Suche.
 * Beides gehört in EINE Kopfzeile, und die kann nur die Seite selbst bauen:
 * Die Leiste steht im Layout, also über dem `<main>` der Seite, und könnte
 * nie neben einem Element aus der Seite sitzen. Die Landung bringt ihre
 * Wortmarke deshalb selbst mit.
 *
 * Die Detailseiten fehlen weiterhin — sie tragen ihren Zurück-Weg selbst und
 * stünden sonst unter zwei Köpfen.
 */
const HAUPTROUTEN = new Set([
  "/trainer/deepfight/gegner",
  "/trainer/deepfight/athleten",
  "/trainer/deepfight/analyse",
]);

/**
 * DIE SEGMENTE IM KOPF DER HÜLLE (Leon 18.09.2026): „auf der DeepFight-Seite
 * oben drei Buttons — DeepFight, das zur Standardseite führt, dann Athleten
 * … und Gegner". Auf einer Detailseite (ein Gegner, ein Athlet) trägt das
 * gewählte Segment einen Pfeil — es IST dort der Weg zurück zur Liste, wie
 * Leons „zurück ‚Gegner‘ oben drinnen".
 *
 * Die Analyse gehört zu ihrem Ziel: `/analyse?modus=gegner` steht unter
 * „Gegner", `modus=leute` unter „Athleten" — der Modus kommt aus demselben
 * Kontext, der auch die Schicht färbt.
 */
function segmenteFuer(pathname: string, modus: "leute" | "gegner"): KopfSegment[] {
  const LANDUNG = "/trainer/deepfight";
  const ATHLETEN = "/trainer/deepfight/athleten";
  const GEGNER = "/trainer/deepfight/gegner";
  const analyse = pathname.startsWith("/trainer/deepfight/analyse");
  const unter = (basis: string) => pathname === basis || pathname.startsWith(`${basis}/`);
  const athletenAktiv = unter(ATHLETEN) || (analyse && modus === "leute");
  const gegnerAktiv = unter(GEGNER) || (analyse && modus === "gegner");
  return [
    { href: LANDUNG, label: "DeepFight", aktiv: pathname === LANDUNG, wortmarke: true },
    { href: ATHLETEN, label: "Athleten", aktiv: athletenAktiv, zurueck: athletenAktiv && pathname !== ATHLETEN },
    { href: GEGNER, label: "Gegner", aktiv: gegnerAktiv, zurueck: gegnerAktiv && pathname !== GEGNER },
  ];
}

function Bereich({ children }: { children: React.ReactNode }) {
  const { modus } = useDeepFightModus();
  const pathname = usePathname();
  const mitLeiste = HAUPTROUTEN.has(pathname);

  return (
    <div data-area="deepfight" data-modus={modus} className="relative flex-1">
      {/* Fixiert hinter allem (.df-schicht in globals.css, z-index −1 im
          Stapelkontext der Hülle). Synthesis selbst ist absolut und füllt
          diesen Rahmen; der Rahmen hält sie am Fenster fest. */}
      <div className="df-schicht" aria-hidden>
        <Synthesis modus={modus} />
      </div>

      {/* Ab lg stehen die Segmente im Kopf der Hülle (unten) — die
          Glas-Leiste bleibt nur für das Handy, dort gibt es keinen Kopf. */}
      {mitLeiste && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:hidden">
          <DeepFightLeiste />
        </div>
      )}
      <KopfNavigation rang={2}>
        <KopfSegmente label="DeepFight-Bereich" segmente={segmenteFuer(pathname, modus)} />
      </KopfNavigation>
      {children}
    </div>
  );
}

export default function DeepFightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DeepFightModusProvider>
      <Bereich>{children}</Bereich>
    </DeepFightModusProvider>
  );
}
