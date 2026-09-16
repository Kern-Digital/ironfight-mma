/**
 * Angedeutete Kartei: die ersten Einträge als kompakte Kacheln, nach unten in
 * den Grund ausgeblendet. Man sieht den Anfang, der Rest „läuft aus".
 *
 * SIE WOHNTE BIS 08.09.2026 LOKAL IN `app/workout/generator/page.tsx`
 * („Letzte Workouts", „Meine Workouts"). Als die DeepFight-Landung dieselbe
 * Geste brauchte, war die Wahl: kopieren oder herausziehen. Herausgezogen —
 * zwei Kopien einer Maskenhöhe laufen beim ersten Anfassen auseinander.
 *
 * DIE DEEPFIGHT-LANDUNG BENUTZT SIE SEIT DEM 10.09. NICHT MEHR. Leon wollte
 * dort anklickbare Zeilen ohne Rahmen, die sich unter dem Zeiger hervorheben
 * während die anderen dimmen, dazu acht Einträge und eine Mehr-Zeile — davon
 * bliebe von „Andeutung" nichts übrig. Sie hat deshalb eine eigene Kartei
 * bekommen (die frühere Kartei „Meine Analysen" auf der DeepFight-Landung, seit 12.09. abgelöst), und diese hier ist
 * wieder das, was sie war: die Andeutung. **Optionen, die nur ein Aufrufer
 * kennt, gehören nicht in einen geteilten Baustein** — sonst trägt der
 * Generator irgendwann fünf Schalter, von denen er keinen benutzt.
 *
 * DIE MASKE MACHT DIE ARBEIT, NICHT EIN VERLAUF ÜBER DER LISTE: `maskImage`
 * blendet die Kacheln selbst aus, egal welcher Grund dahinter liegt. Ein
 * aufgelegter Verlauf müsste die Hintergrundfarbe kennen.
 *
 * `aria-hidden`: Die Kartei ist die ANDEUTUNG einer Liste, die ein Klick
 * vollständig öffnet. Vorgelesen wäre sie eine zweite, abgeschnittene Fassung
 * derselben Einträge — der Aufrufer beschriftet stattdessen seinen Knopf.
 */

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

export interface PeekItem {
  key: string;
  title: string;
  meta: string;
}

export default function PeekStack({
  items,
  empty,
  emptyText,
}: {
  items: PeekItem[];
  empty: boolean;
  emptyText: string;
}) {
  if (empty) {
    return (
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {emptyText}
      </p>
    );
  }
  return (
    <div
      aria-hidden
      className="relative overflow-hidden"
      style={{
        // Zeigt gut zwei Kacheln, die dritte läuft in der Maske aus.
        height: 96,
        maskImage: "linear-gradient(to bottom, black 40%, transparent 96%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 40%, transparent 96%)",
      }}
    >
      <div className="flex flex-col gap-1.5">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex flex-col rounded-field px-2.5 py-1.5"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
            }}
          >
            <span
              className="truncate"
              style={{
                font: "600 14px/1.3 var(--font-archivo), system-ui, sans-serif",
                color: "var(--text-body)",
              }}
            >
              {it.title}
            </span>
            <span className="truncate" style={{ ...META_FONT, color: "var(--text-3)" }}>
              {it.meta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
