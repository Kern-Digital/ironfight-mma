import type { Technique } from "../types";

export const MUAY_THAI_TECHNIQUES: Technique[] = [
  // ─── Anfänger ────────────────────────────────────────────────────────────
  {
    id: "muaythai_teep",
    slug: "teep",
    name: "Teep (Push Kick)",
    category: "muay-thai",
    difficulty: "anfaenger",
    description:
      "Der Teep ist der 'Jab des Beins' — ein Frontkick zur Distanz, zum Stoppen und zum Setup. Pflicht-Technik in jedem Muay-Thai-Kampf.",
    steps: [
      "Aus dem Stand: Knie des Schlagbeins explosiv anziehen.",
      "Hüfte schiebt nach vorn.",
      "Fuß schießt geradlinig auf Bauch oder Brust des Gegners.",
      "Kontaktstelle: Fußballen oder ganze Sohle.",
      "Sofort zurückziehen, Bein wieder in Stellung.",
    ],
    commonMistakes: [
      "Hüfte nicht mit nach vorn → kein Druck im Kick.",
      "Fuß zur Seite gedreht → kein gerader Push.",
      "Knie nicht hoch genug angezogen → niedriger, schwacher Kick.",
      "Stützbein steif — niemals gestreckt halten.",
    ],
    usage:
      "Distanz halten, Gegner stoppen, Kombinationen einleiten oder unterbrechen. Im Wettkampf zur Punktegewinnung.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["muaythai_low_kick", "muaythai_roundhouse"],
    nextTechniqueId: "muaythai_low_kick",
  },
  {
    id: "muaythai_low_kick",
    slug: "low-kick",
    name: "Low Kick",
    category: "muay-thai",
    difficulty: "anfaenger",
    description:
      "Der Schienbein-Kick auf Oberschenkel oder Wade des Gegners. Zermürbt das Standbein und führt oft zum K.O.-Setup.",
    steps: [
      "Standfuß dreht 45° nach außen — Hüfte folgt.",
      "Schlagbein kommt im Bogen mit voller Hüftrotation.",
      "Kontaktfläche: Schienbein (nicht Spann!).",
      "Trefferpunkt: Außenseite des Oberschenkels oder Wade.",
      "Bein zurückziehen oder nach Treffer Folge-Combo.",
    ],
    commonMistakes: [
      "Standfuß nicht gedreht → keine Hüftrotation, schwacher Kick.",
      "Mit Spann statt Schienbein → Verletzungsrisiko.",
      "Oberkörper bleibt aufrecht → keine Power.",
      "Kein Folge-Move — der Kick ist Setup, nicht Endpunkt.",
    ],
    usage:
      "Zermürbt das Standbein des Gegners über den Verlauf des Kampfes. Klassischer Damage-Dealer in Muay Thai und MMA.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["muaythai_roundhouse", "muaythai_teep"],
    nextTechniqueId: "muaythai_roundhouse",
  },
  {
    id: "muaythai_roundhouse",
    slug: "roundhouse",
    name: "Roundhouse Kick",
    category: "muay-thai",
    difficulty: "anfaenger",
    description:
      "Der Power-Kick aus Muay Thai — volle Hüftrotation, Schienbein als Aufprallfläche, Ziel: Körper, Arme oder Kopf.",
    steps: [
      "Standfuß dreht 90° nach außen.",
      "Schlagbein kommt nicht aus dem Knie — die Hüfte rotiert das ganze Bein durch.",
      "Schienbein trifft das Ziel mit voller Rotation.",
      "Oberkörper rotiert mit, freie Hand schwingt nach hinten für Ausgleich.",
      "Bein folgt durch oder kommt schnell zurück.",
    ],
    commonMistakes: [
      "Aus dem Knie tritt — kein Hüft-Drive.",
      "Standfuß starr — Knie-Verletzungsrisiko.",
      "Hände sinken während des Kicks.",
      "Gleichgewicht verloren nach dem Kick.",
    ],
    usage:
      "Schwerer Kick zum Body oder Kopf. Im MMA der gefährlichste Stand-Kick gegen Wrestler.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["muaythai_teep", "muaythai_low_kick"],
    nextTechniqueId: "muaythai_knee",
  },
  {
    id: "muaythai_knee",
    slug: "knee",
    name: "Knee Strike",
    category: "muay-thai",
    difficulty: "anfaenger",
    description:
      "Der Kniestoß ist die Waffe der Nahdistanz und des Clinches. Hüfte schiebt nach vorn, Knie schießt explosiv ins Ziel.",
    steps: [
      "Aus dem Stand oder Clinch: Standfuß fest am Boden.",
      "Schlagbein zieht das Knie an, Hüfte schiebt nach vorn.",
      "Spitze des Knies trifft Bauch, Solar plexus oder Kopf.",
      "Beim Treffer Hüfte voll durchstrecken.",
      "Bein zurück, Stellung halten.",
    ],
    commonMistakes: [
      "Hüfte nicht mit nach vorn → schwacher Knie.",
      "Knie zu früh — wird zu einem flachen Kick.",
      "Im Clinch nicht den Kopf des Gegners gezogen.",
      "Standfuß instabil — Sturzgefahr.",
    ],
    usage:
      "Hauptwaffe im Clinch. Auch zum Stoppen reinkommender Gegner extrem effektiv.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["muaythai_clinch_basic", "muaythai_elbow_basic"],
    nextTechniqueId: "muaythai_clinch_basic",
  },
  {
    id: "muaythai_clinch_basic",
    slug: "clinch-basic",
    name: "Basic Clinch",
    category: "muay-thai",
    difficulty: "anfaenger",
    description:
      "Der Plum-Clinch (Double-Collar Tie): beide Hände am Hinterkopf des Gegners, Ellbogen zur Mitte. Setup für Knees, Sweeps und Off-Balancing.",
    steps: [
      "Eine Hand zum Hinterkopf greifen.",
      "Andere Hand sofort dazu — beide Hände übereinander am Hinterkopf.",
      "Ellbogen eng zueinander — schließt das Tor zum eigenen Kopf.",
      "Gegnerischen Kopf nach unten ziehen → er kann nicht aufrichten.",
      "Aus der Position Knees oder Off-Balance-Sweeps setzen.",
    ],
    commonMistakes: [
      "Hände nebeneinander statt übereinander → kein Druck nach unten.",
      "Ellbogen offen → Gegner setzt Hooks oder Uppercuts.",
      "Gegnerischen Kopf nicht nach unten gezogen → er rotiert raus.",
      "Stille Position — im Clinch muss ständig gearbeitet werden.",
    ],
    usage:
      "Zentrale Nahdistanz-Position in Muay Thai. Auch in MMA gegen die Wand stark.",
    equipment: ["mat", "bodyweight"],
    relatedTechniqueIds: ["muaythai_knee", "muaythai_elbow_basic"],
  },
  {
    id: "muaythai_elbow_basic",
    slug: "elbow-basic",
    name: "Elbow Basics",
    category: "muay-thai",
    difficulty: "anfaenger",
    description:
      "Der Ellbogen ist die schärfste Waffe in Muay Thai — kurze Distanz, hoher Schaden. Standardvariante: horizontaler Slash.",
    steps: [
      "Aus dem Stand oder Clinch: Schulter rotiert in Schlagrichtung.",
      "Ellbogen zeigt zum Ziel, Arm gewinkelt 45°.",
      "Aufprallfläche: Spitze oder Kante des Ellbogens.",
      "Hüfte rotiert mit, Schulter deckt das Kinn.",
      "Sofort zurück in Deckung — Ellbogen lässt offen.",
    ],
    commonMistakes: [
      "Schulterdreh fehlt → Schlag aus dem Arm.",
      "Ellbogen nicht spitz → Schaden minimal.",
      "Andere Hand sinkt während des Schlags.",
      "Distanz falsch — Ellbogen funktioniert nur in Nähe.",
    ],
    usage:
      "Im Clinch oder bei plötzlichen Distanzschlüssen. Konflikt-beendend, wenn er sitzt.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["muaythai_knee", "muaythai_clinch_basic"],
  },

  // ─── Fortgeschritten ─────────────────────────────────────────────────────
  {
    id: "muaythai_switch_kick",
    slug: "switch-kick",
    name: "Switch Kick",
    category: "muay-thai",
    difficulty: "fortgeschritten",
    description:
      "Der Switch Kick ist ein blitzschneller Beinwechsel-Kick: Standfuß tauscht, das schwächere Bein wird zur Schlagseite. Macht den Kick explosiv und unerwartet.",
    steps: [
      "Aus der Stellung: Vorderfuß und Hinterfuß tauschen explosiv.",
      "Beim Tausch sofort der 'neue Hinterfuß' als Standfuß.",
      "Der 'neue Vorderfuß' startet einen Roundhouse.",
      "Volle Hüftrotation — wie beim normalen Roundhouse.",
      "Schienbein trifft das Ziel.",
    ],
    commonMistakes: [
      "Switch zu langsam → Gegner sieht es kommen.",
      "Tausch nicht in der Luft → kein Tempo-Gewinn.",
      "Hüftdreh halbiert → schwacher Kick.",
      "Stand nach Kick instabil.",
    ],
    usage:
      "Überraschungs-Kick mit dem schwachen Bein, das durch den Switch zum starken Bein wird. Klassische Muay-Thai-Setup-Technik.",
    equipment: ["heavy-bag", "pads"],
    relatedTechniqueIds: ["muaythai_roundhouse"],
  },
];
