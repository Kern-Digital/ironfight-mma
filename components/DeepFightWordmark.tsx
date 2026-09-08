/**
 * DeepFight-Wortmarke: Funkeln-Symbol + Schriftzug als untrennbare Einheit.
 * Das Symbol skaliert em-basiert mit der Schriftgröße des Elternelements und
 * funktioniert dadurch überall — von der Subnav (10px) bis zum Seitentitel (42px).
 *
 * ─── `shimmer` — das Funkeln als Maske (Leons Ansage 08.09.2026) ───────────
 *
 * „das symbol in weiß und innerhalb des symbols die regenbogenfarben (wie beim
 * DNA-%-Regenbogen, jedoch etwas langsamer) schimmern."
 *
 * DESIGN-BRIEF §1.6 stellt die Wortmarke unter Änderungsvorbehalt — diese
 * Ausnahme ist Leons ausdrückliche Entscheidung und deshalb ein SCHALTER, kein
 * neuer Standard: Sidebar, Segment-Leiste und Subnav zeigen die Marke
 * unverändert. Der Schalter beantwortet genau EINE Frage („schimmert das
 * Funkeln?") und bündelt damit nicht zwei (Falle 35).
 *
 * Warum eine Maske statt des Bildes: Das PNG ist ein türkises Funkeln auf
 * Transparenz. Als Maske zählt nur sein Alphakanal — die Form bleibt, die
 * Farbe kommt aus CSS. Anders wäre „weiß mit Regenbogen darin" nicht zu haben:
 * Ein `<img>` ist ein ersetztes Element, es nimmt weder Hintergrund noch
 * Pseudo-Elemente an. Die Schichten selbst stehen in globals.css
 * (`.df-funke`) — Farben und Zeiten gehören dorthin.
 */
export default function DeepFightWordmark({
  className,
  shimmer = false,
}: {
  className?: string;
  /** Funkeln als Maske: weiß, mit langsam wanderndem Regenbogen darin. */
  shimmer?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] ${className ?? ""}`}>
      {shimmer ? (
        <span aria-hidden className="df-funke" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src="/deepfight-icon.png"
          alt=""
          aria-hidden="true"
          className="h-[1em] w-auto shrink-0"
          style={{ transform: "translateY(-0.04em)" }}
        />
      )}
      <span>DeepFight</span>
    </span>
  );
}
