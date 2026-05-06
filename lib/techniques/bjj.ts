import type { Technique } from "../types";

export const BJJ_TECHNIQUES: Technique[] = [
  // ─── Anfänger ────────────────────────────────────────────────────────────
  {
    id: "bjj_hip_escape",
    slug: "hip-escape",
    name: "Hip Escape (Shrimp)",
    category: "bjj",
    difficulty: "anfaenger",
    description:
      "Die fundamentalste Bewegung im BJJ. Hüfte explosiv aus der Linie schieben — Basis für jede Escape, Recovery und Sweep.",
    steps: [
      "Auf dem Rücken liegen, Knie angezogen, Füße flach auf der Matte.",
      "Eine Schulter und Ellbogen flach auf die Matte drücken.",
      "Mit den Füßen explosiv abdrücken, Hüfte schiebt zur Seite.",
      "Beide Beine kommen zur Brust ran.",
      "Wieder absetzen — fertig zum nächsten Shrimp.",
    ],
    commonMistakes: [
      "Schulter wird mitgenommen → Gegner folgt einfach.",
      "Hüfte hebt nicht ab → reines 'Ableger-Schieben'.",
      "Knie-Ellbogen-Verbindung fehlt → keine Defensive.",
      "Zu langsam — Shrimp muss explosiv sein.",
    ],
    usage:
      "Aus Mount, Side Control, Knee-on-Belly entkommen. Setup für Guard-Recovery.",
    equipment: ["mat", "bodyweight"],
    video: {
      url: "https://www.youtube.com/embed/yiA-UfMxq8s",
      source: "YouTube",
      license: "YouTube-Embed",
      attribution: "BJJ Tutorial",
    },
    relatedTechniqueIds: ["bjj_bridge_roll", "bjj_mount_escape"],
    nextTechniqueId: "bjj_bridge_roll",
  },
  {
    id: "bjj_technical_standup",
    slug: "technical-standup",
    name: "Technical Stand-up",
    category: "bjj",
    difficulty: "anfaenger",
    description:
      "Sicheres Aufstehen vom Boden — eine Hand am Boden, Augen am Gegner. Verhindert, dass der Gegner einen Schlag oder Takedown setzt.",
    steps: [
      "Aus dem Sitz: eine Hand hinter den Körper auf die Matte.",
      "Anderes Bein anziehen, Fuß zwischen Hand und Hüfte.",
      "Andere Hand schützt das Gesicht.",
      "Mit Hand und Fuß abdrücken, Körper hebt sich.",
      "Hinteres Bein schwingt nach unten in Boxstellung.",
    ],
    commonMistakes: [
      "Beide Hände am Boden → Schlaghand fehlt zur Verteidigung.",
      "Augen am Boden → keine Reaktion auf Gegner.",
      "Zu langsam — Gegner schließt die Distanz.",
      "Nach dem Aufstehen offene Stellung — kein Übergang in Guard.",
    ],
    usage:
      "Vom Boden zurück auf die Beine kommen, ohne sich für Schläge oder Takedowns zu öffnen. Wichtig in MMA und Selbstverteidigung.",
    equipment: ["mat", "bodyweight"],
    relatedTechniqueIds: ["bjj_hip_escape"],
  },
  {
    id: "bjj_bridge_roll",
    slug: "bridge-roll",
    name: "Bridge & Roll",
    category: "bjj",
    difficulty: "anfaenger",
    description:
      "Klassische Mount-Escape: durch eine starke Brücke und einen Roll wird der Gegner über den Kopf geworfen.",
    steps: [
      "Aus der Mount-Verteidigung: einen Arm des Gegners trappen.",
      "Auf der gleichen Seite ein Bein des Gegners trappen (Fuß auf Wade).",
      "Hüfte explosiv nach oben in eine starke Brücke.",
      "Auf die getrapte Seite rollen — Gegner landet auf dem Rücken.",
      "Aus der Closed Guard sofort weiterarbeiten.",
    ],
    commonMistakes: [
      "Kein Fuß-Trap → Gegner postet das Bein und blockt den Roll.",
      "Brücke nicht hoch genug → kein Lift.",
      "Falsche Seite gerollt → Gegner bleibt drauf.",
      "Arm nicht getrapt → Gegner postet die Hand.",
    ],
    usage:
      "Erster Mount-Escape, den jeder lernt. Auch im MMA gegen Ground-and-Pound essentiell.",
    equipment: ["mat"],
    relatedTechniqueIds: ["bjj_mount_escape", "bjj_hip_escape"],
    nextTechniqueId: "bjj_mount_escape",
  },
  {
    id: "bjj_closed_guard",
    slug: "closed-guard",
    name: "Closed Guard",
    category: "bjj",
    difficulty: "anfaenger",
    description:
      "Die fundamentale Guard: Beine um den Gegner geschlossen, Hüfte aktiv, Hände kontrollieren Arme oder Kragen.",
    steps: [
      "Auf dem Rücken: Beine um die Hüfte des Gegners.",
      "Knöchel kreuzen — Beine fest geschlossen.",
      "Eine Hand am Handgelenk des Gegners, andere am Kragen oder Hinterkopf.",
      "Hüfte aktiv — niemals stillliegen.",
      "Aus der Closed Guard arbeiten: Sweeps, Submissions oder Distanz.",
    ],
    commonMistakes: [
      "Beine offen → Guard wird durchgesetzt.",
      "Passive Hüfte → Gegner postet auf die Brust.",
      "Hände unten → keine Kontrolle des Oberkörpers.",
      "Auf den Rücken gelegt → Mount-Threat.",
    ],
    usage:
      "Zentrale Position für Sweeps und Submissions. Guard ist die Grundlage des BJJ.",
    equipment: ["mat"],
    relatedTechniqueIds: ["bjj_armbar_from_guard", "bjj_triangle_from_guard"],
    nextTechniqueId: "bjj_scissor_sweep",
  },
  {
    id: "bjj_mount_escape",
    slug: "mount-escape",
    name: "Mount Escape (Elbow Escape)",
    category: "bjj",
    difficulty: "anfaenger",
    description:
      "Aus der Mount durch wiederholte Hip Escapes auf eine Seite, das Knie des Gegners blocken und in die Half/Closed Guard recovern.",
    steps: [
      "Eine Schulter und Ellbogen flach auf die Matte.",
      "Hüfte explosiv zur Seite shrimpen.",
      "Knie zur Brust, dann zwischen sich und den Gegner schieben.",
      "Mit dem Fuß das Knie des Gegners auf die Außenseite hooken.",
      "Weiter shrimpen → Half Guard oder Closed Guard.",
    ],
    commonMistakes: [
      "Schulter mitgenommen → Gegner folgt mit der Mount.",
      "Knie nicht zwischen die Körper → Gegner sitzt weiter drauf.",
      "Fuß hooked nicht → Bein wird wieder mitgenommen.",
      "Zu wenig Shrimps — Mount-Escape ist meistens 2-3 Shrimps.",
    ],
    usage:
      "Standard-Escape aus der Mount, wenn Bridge & Roll nicht funktioniert.",
    equipment: ["mat"],
    video: {
      url: "https://www.youtube.com/embed/5Y1CahWUA_s",
      source: "YouTube",
      license: "YouTube-Embed",
      attribution: "BJJ Tutorial",
    },
    relatedTechniqueIds: ["bjj_bridge_roll", "bjj_hip_escape"],
  },
  {
    id: "bjj_side_control_escape",
    slug: "side-control-escape",
    name: "Side-Control Escape",
    category: "bjj",
    difficulty: "anfaenger",
    description:
      "Aus Side Control durch Frame, Hip Escape und Underhook in Guard-Recovery oder zurück auf die Knie.",
    steps: [
      "Frames bauen: Unterarm an den Hals, andere Hand zur Hüfte.",
      "Hüfte explosiv zur Wand-Seite shrimpen.",
      "Bein zwischen sich und Gegner einbringen.",
      "Underhook auf der Far-Side suchen.",
      "Recovery in Half Guard oder zurück auf alle Viere (Turtle).",
    ],
    commonMistakes: [
      "Keine Frames → Gegner crusht den Kopf.",
      "Falsche Shrimp-Richtung — von Gegner weg, nicht zu ihm.",
      "Bein klein bleibt nicht eingehakt → Side Control bleibt.",
      "Aufgegeben — Side-Control-Escape ist mühsam, aber lernbar.",
    ],
    usage:
      "Eine der schwierigsten Positionen zu entkommen. Tägliches Drilling ist Pflicht.",
    equipment: ["mat"],
    relatedTechniqueIds: ["bjj_hip_escape"],
  },

  // ─── Fortgeschritten ─────────────────────────────────────────────────────
  {
    id: "bjj_armbar_from_guard",
    slug: "armbar-from-guard",
    name: "Armbar from Guard",
    category: "bjj",
    difficulty: "fortgeschritten",
    description:
      "Klassische Submission aus der Closed Guard. Hüfte aushängen, Bein über den Kopf, Hebel auf den Ellbogen.",
    steps: [
      "Aus der Closed Guard: Arm des Gegners isolieren (z. B. mit C-Grip).",
      "Hüfte zur Seite des isolierten Arms ausschwenken — 90° zum Gegner.",
      "Eines der Beine über den Kopf des Gegners.",
      "Knie schließen, Daumen des Gegners zeigt nach oben.",
      "Hüfte heben → Hebel auf den Ellbogen → Submission.",
    ],
    commonMistakes: [
      "Daumen des Gegners zeigt nach unten → kein Hebel.",
      "Knie nicht zusammen → Gegner zieht Arm raus.",
      "Hüfte nicht ausgeschwenkt → kein Winkel.",
      "Zu langsam → Gegner stackt und entkommt.",
    ],
    usage:
      "Eine der ältesten und sichersten Submissions im BJJ. Pflicht-Technik für jeden Blue Belt.",
    equipment: ["mat"],
    video: {
      url: "https://www.youtube.com/embed/ybdyDkzfQG8",
      source: "YouTube",
      license: "YouTube-Embed",
      attribution: "BJJ Tutorial",
    },
    relatedTechniqueIds: ["bjj_closed_guard", "bjj_triangle_from_guard"],
    nextTechniqueId: "bjj_triangle_from_guard",
  },
  {
    id: "bjj_triangle_from_guard",
    slug: "triangle-from-guard",
    name: "Triangle from Guard",
    category: "bjj",
    difficulty: "fortgeschritten",
    description:
      "Choke mit den Beinen — ein Arm in, ein Arm out, Bein um den Hals, andere Knie blockt.",
    steps: [
      "Aus der Closed Guard: einen Arm des Gegners durchziehen, anderen draußen lassen.",
      "Eigenes Bein der Arm-In-Seite über den Hals des Gegners.",
      "Anderes Knie unter das Knie der ersten Bein-Position klemmen.",
      "Winkel suchen — Hüfte zur Seite, Schulter des Gegners ziehen.",
      "Schenkel-Pressing → Choke.",
    ],
    commonMistakes: [
      "Zwei Arme in oder zwei Arme out → kein Triangle.",
      "Schlechter Winkel → Gegner stackt durch.",
      "Knie nicht geschlossen → Druck fehlt.",
      "Eigener Kopf nicht zum Knie gezogen — kein Tightness.",
    ],
    usage:
      "Klassische Closed-Guard-Submission. Auch aus offener Guard, von oben, von der Side Control möglich.",
    equipment: ["mat"],
    relatedTechniqueIds: ["bjj_armbar_from_guard", "bjj_closed_guard"],
  },
];
