/**
 * Kulisse der Beitritts-Seiten (Multi-Gym Phase 2, Checkpoint 1C).
 *
 * Bänder schräg geschnittener Kampfsport-Fotos hinter dem Inhalt, Richtung
 * abwechselnd: links, rechts, links (Leon 31.08.). Mechanik und Klassen
 * stehen in app/globals.css unter „Beitritts-Kulisse"; hier liegt nur die
 * Bildauswahl.
 *
 * ─── DIE SCHLEIFE DECKT NUR DIE HALBE BANDBREITE (Leon 14.09.2026) ─────────
 *
 * Leons Befund auf einem 3440-px-Schirm: rechts steht schwarze Fläche. Der
 * Grund steckt in der Endlosschleife selbst. Das Band trägt seine Kacheln
 * DOPPELT und wandert um genau 50 % — nur so schließt es ohne Sprung an sich
 * an. Am Ende der Bewegung reicht es damit aber nur noch die HALBE Bandbreite
 * weit. Eine Reihe deckt also höchstens `Kachelzahl × Vorschub` Pixel ab.
 *
 * Gemessen am 14.09. mit 232-px-Kacheln (Vorschub 160 px nach dem Schnitt):
 *
 *   Reihe      Kacheln   Deckung    1440 px   2560 px   3440 px
 *   oben/mitte    14      2241 px      OK      −319 px  −1199 px
 *   unten         12      1920 px      OK      −640 px  −1520 px
 *
 * Es fiel niemandem auf, weil es erst ab rund 2500 px auftritt.
 *
 * ALLE ZWEIUNDFUENFZIG MOTIVE IN JEDER REIHE, statt sie auf drei Reihen aufzuteilen.
 * Vorher hatte jede Reihe ihren eigenen Satz (14/14/12) — dadurch war zwar
 * jedes Bild nur einmal im Bild, aber keine Reihe wurde lang genug. Jetzt
 * trägt jede Reihe alle 52, in EIGENER Reihenfolge.
 *
 * WARUM DAS TROTZDEM NICHT NACH WIEDERHOLUNG AUSSIEHT: Die drei Reihen sind
 * gegeneinander VERDREHT — Reihe 2 um 13, Reihe 3 um 27 Schritte. Innerhalb
 * einer Reihe sieht man ein Bild erst nach 52 Kacheln wieder; bei 320-px-
 * Kacheln sind das über zwölf Meter Bildstrecke.
 *
 * REIHE 1 UND 3 KÖNNEN SICH DAUERHAFT NIE DOPPELN: Beide laufen nach LINKS,
 * halten also für immer denselben Abstand zueinander, und `M[i]` gegen
 * `M[i+27]` ist an keiner Stelle gleich.
 *
 * BEI REIHE 2 GEHT DAS NICHT, UND ZWAR AUS EINEM GRUND, DEN MAN NICHT
 * WEGBAUEN KANN: Sie läuft in die GEGENRICHTUNG. Ihr Versatz zu den anderen
 * beiden wandert dadurch über die Zeit durch alle möglichen Werte — jede
 * denkbare Paarung kommt irgendwann einmal vor. Das ließe sich nur
 * verhindern, wenn Reihe 2 aus anderen Motiven bestünde als Reihe 1 und 3,
 * und dafür reichen auch 52 Bilder nicht. Zum Startzeitpunkt steht nichts
 * doppelt; später trifft es im Schnitt 0 bis 1 von sechzehn Spalten, und der
 * Treffer wandert sofort weiter. Das ist der Preis für gegenläufige Bänder —
 * und er ist kleiner als schwarze Fläche.
 *
 * Bewusst KEINE Client-Komponente und KEIN next/image: die Bilder sind reine
 * Dekoration in fester Größe (320 × 427). Der Optimierer würde für jede
 * Kachel dieselbe Datei erneut aushandeln. Aus demselben Grund kosten die
 * jetzt 312 Kacheln fast nichts zusätzlich: Es bleiben DIESELBEN 52 Dateien
 * (zusammen rund 780 KB), jede weitere Kachel ist ein Treffer im Cache.
 *
 * Pfad-Falle wie bei public/library-stack/: die Dateien liegen unter
 * public/join-stack/ und NICHT unter einem Pfad, den middleware.ts gated —
 * ein Ausgeloggter muss sie sehen können.
 *
 * Bilder: Pexels (frei nutzbar, keine Namensnennung nötig), auf 3:4
 * beschnitten und klein gerechnet.
 */

/**
 * Alle 52 Motive, grob gemischt: Stand, Boden, Ring, Käfig, Sack und
 * Pratzen wechseln sich ab, damit nirgends drei Bodenkämpfe nebeneinander
 * stehen. Die Reihenfolge ist Handarbeit und bewusst KEIN Zufall — sie muss
 * auf Server und Client identisch sein.
 */
const MOTIVE = [
  "ring-highkick.jpg",
  "bjj-guard.jpg",
  "gym-bag-dark.jpg",
  "muay-ring.jpg",
  "ring-spar-bw.jpg",
  "ground-work.jpg",
  "cage-spar.jpg",
  "boxer-portrait.jpg",
  "glove-twins.jpg",
  "judo-throw.jpg",
  "pads-smoke.jpg",
  "cross-punch.jpg",
  "boxer-profile.jpg",
  "bjj-throw.jpg",
  "ring-kick.jpg",
  "punch-smoke.jpg",
  "ground-pound.jpg",
  "rope-skip.jpg",
  "muay-knee.jpg",
  "cage-fence.jpg",
  "bag-kick.jpg",
  "gloves-wall.jpg",
  "fighter-look.jpg",
  "ring-corner.jpg",
  "bjj-gym.jpg",
  "ring-raise.jpg",
  "flying-kick.jpg",
  "smoke-clash.jpg",
  "ring-spar.jpg",
  "muay-guard.jpg",
  "muay-bagkick.jpg",
  "kick-dark.jpg",
  "spar-lowkick.jpg",
  "boxer-bags.jpg",
  "ring-night.jpg",
  "pads-smoke-2.jpg",
  "ring-mitts.jpg",
  "boxer-ready.jpg",
  "ropes-rest.jpg",
  "bag-kick-crowd.jpg",
  "judo-throw-2.jpg",
  "cage-kick.jpg",
  "muay-stance.jpg",
  "muay-fighter.jpg",
  "ring-teep.jpg",
  "bag-combo.jpg",
  "cage-clinch.jpg",
  "gloves-vintage.jpg",
  "pads-gym.jpg",
  "ground-scramble.jpg",
  "bjj-roll.jpg",
  "corner-glow.jpg",
];

/** Dieselbe Liste, vorne abgeschnitten und hinten angehängt. */
function gedreht(liste: string[], schritte: number): string[] {
  const n = schritte % liste.length;
  return [...liste.slice(n), ...liste.slice(0, n)];
}

/*
 * REINE VERDREHUNG, KEIN UMKEHREN. Ein erster Anlauf drehte die mittlere
 * Reihe zusätzlich um — und zerstörte damit genau die Eigenschaft, für die
 * die Verdrehung da ist: Bei `M[i]` gegen `M[12-i]` fallen beide Seiten bei
 * `i = 6` und `i = 26` zusammen, und dort stand dann zweimal derselbe Wurf
 * übereinander (gemessen 14.09.). Bei reiner Verdrehung um 13 und 27 ist
 * `M[i]` gegen `M[i+13]` gegen `M[i+27]` an KEINER Stelle gleich.
 */
const ROW_TOP = MOTIVE;
const ROW_MID = gedreht(MOTIVE, 13);
const ROW_BOTTOM = gedreht(MOTIVE, 27);

function Band({ tiles, dir }: { tiles: string[]; dir: "left" | "right" }) {
  // Zweimal dieselbe Liste: das Band wandert um genau 50 % und schließt
  // deshalb ohne Sprung an sich selbst an.
  const doubled = [...tiles, ...tiles];
  return (
    <div className="join-band-wrap">
      <div className="join-band" data-dir={dir}>
        {doubled.map((file, i) => (
          <div className="join-tile" key={`${dir}-${file}-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/join-stack/${file}`}
              alt=""
              width={320}
              height={427}
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JoinBackdrop() {
  return (
    <div className="join-backdrop" aria-hidden>
      <Band tiles={ROW_TOP} dir="left" />
      <Band tiles={ROW_MID} dir="right" />
      <Band tiles={ROW_BOTTOM} dir="left" />
      <div className="join-veil" />
    </div>
  );
}
