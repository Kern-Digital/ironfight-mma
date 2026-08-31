/**
 * Kulisse der Beitritts-Seiten (Multi-Gym Phase 2, Checkpoint 1C).
 *
 * Bänder schräg geschnittener Kampfsport-Fotos hinter dem Inhalt, Richtung
 * abwechselnd: links, rechts, links (Leon 31.08.). Mechanik und Klassen
 * stehen in app/globals.css unter „Beitritts-Kulisse"; hier liegt nur die
 * Bildauswahl.
 *
 * VIERZIG MOTIVE, auf drei Reihen AUFGETEILT statt in jeder Reihe alle zu
 * zeigen (Leon 31.08.: „mehr Motive, damit sie sich nicht so schnell
 * wiederholen"). Zwei Fliegen: keine Reihe zeigt dasselbe Bild wie eine
 * andere, und die DOM-Last bleibt bei 80 Kacheln statt 240.
 *
 * Bewusst KEINE Client-Komponente und KEIN next/image: die Bilder sind reine
 * Dekoration in fester Größe (320 × 427). Der Optimierer würde für jede
 * Kachel dieselbe Datei erneut aushandeln.
 *
 * Pfad-Falle wie bei public/library-stack/: die Dateien liegen unter
 * public/join-stack/ und NICHT unter einem Pfad, den middleware.ts gated —
 * ein Ausgeloggter muss sie sehen können.
 *
 * Bilder: Pexels (frei nutzbar, keine Namensnennung nötig), auf 3:4
 * beschnitten und klein gerechnet (zusammen rund 630 KB).
 */

/** Obere Reihe — läuft nach links. */
const ROW_TOP = [
  "ring-highkick.jpg",
  "gym-bag-dark.jpg",
  "cage-spar.jpg",
  "judo-throw.jpg",
  "cross-punch.jpg",
  "punch-smoke.jpg",
  "bjj-guard.jpg",
  "ring-kick.jpg",
  "muay-knee.jpg",
  "ground-work.jpg",
  "boxer-portrait.jpg",
  "bag-kick.jpg",
  "ring-corner.jpg",
  "flying-kick.jpg",
];

/** Mittlere Reihe — läuft nach rechts. */
const ROW_MID = [
  "smoke-clash.jpg",
  "pads-smoke.jpg",
  "bjj-throw.jpg",
  "ring-spar.jpg",
  "cage-fence.jpg",
  "muay-ring.jpg",
  "kick-dark.jpg",
  "boxer-bags.jpg",
  "ring-mitts.jpg",
  "fighter-look.jpg",
  "ground-pound.jpg",
  "bag-kick-crowd.jpg",
  "cage-kick.jpg",
  "ring-teep.jpg",
];

/** Untere Reihe — läuft wieder nach links. */
const ROW_BOTTOM = [
  "muay-guard.jpg",
  "bjj-gym.jpg",
  "spar-lowkick.jpg",
  "pads-smoke-2.jpg",
  "boxer-ready.jpg",
  "judo-throw-2.jpg",
  "muay-stance.jpg",
  "bag-combo.jpg",
  "cage-clinch.jpg",
  "pads-gym.jpg",
  "ground-scramble.jpg",
  "bjj-roll.jpg",
];

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
