import type { Technique } from "../types";

export const WRESTLING_TECHNIQUES: Technique[] = [
  // ─── Anfänger ────────────────────────────────────────────────────────────
  {
    id: "wrestling_stance",
    slug: "stance",
    name: "Stance & Motion",
    category: "wrestling",
    difficulty: "anfaenger",
    description:
      "Der wrestlerische Stand: leicht abgesenkt, Hände aktiv, immer in Bewegung. Fundament für jedes Takedown und jeden Sprawl.",
    steps: [
      "Schulterbreiter Stand, ein Fuß leicht vor dem anderen.",
      "Knie weich, Hüfte abgesenkt, Rücken gerade.",
      "Hände aktiv vor dem Körper — bereit zu greifen oder abzuwehren.",
      "Gewicht auf den Fußballen, Augen am Gegner.",
      "Bewegung: gleitende Schritte, niemals kreuzen.",
    ],
    commonMistakes: [
      "Zu aufrechter Stand → leicht zu Takedown.",
      "Hände unten → Underhooks gehen verloren.",
      "Auf den Fersen → langsame Reaktion.",
      "Statisch — Wrestler ist immer in Bewegung.",
    ],
    usage:
      "Default-Position vor jedem Wrestling-Austausch. Aus der Stance werden Shots, Sprawls und Ties initiiert.",
    equipment: ["mat", "bodyweight"],
    relatedTechniqueIds: ["wrestling_level_change", "wrestling_sprawl"],
    nextTechniqueId: "wrestling_level_change",
  },
  {
    id: "wrestling_level_change",
    slug: "level-change",
    name: "Level Change",
    category: "wrestling",
    difficulty: "anfaenger",
    description:
      "Schnelle Höhenveränderung — die Bewegung, die jedem Takedown vorausgeht. Knie biegen, Hüfte tief, ohne den Oberkörper vorzukippen.",
    steps: [
      "Aus der Stance Knie schnell beugen.",
      "Hüfte sinkt, Oberkörper bleibt aufrecht.",
      "Hände auf Schulterhöhe, bereit den Schuss vorzubereiten.",
      "Augen bleiben am Gegner.",
      "Aufrichten ohne Hüfte vorzukippen — sonst Sprawl möglich.",
    ],
    commonMistakes: [
      "Oberkörper kippt vor → Front-Headlock-Position.",
      "Knie nicht über die Zehenspitzen → kein wirklicher Level Change.",
      "Hände sinken ab → keine aktive Position.",
      "Vorhersehbar getelegrafiert — Gegner sprawlt.",
    ],
    usage:
      "Setup für jeden Takedown. Auch als Feint, um den Gegner zur Sprawl-Reaktion zu zwingen.",
    equipment: ["mat", "bodyweight"],
    relatedTechniqueIds: ["wrestling_penetration_step", "wrestling_single_leg"],
    nextTechniqueId: "wrestling_penetration_step",
  },
  {
    id: "wrestling_penetration_step",
    slug: "penetration-step",
    name: "Penetration Step",
    category: "wrestling",
    difficulty: "anfaenger",
    description:
      "Der explosive Schritt nach vorn, der die Distanz zum Gegner schließt. Der Schritt MUSS tief unter dem Schwerpunkt des Gegners landen.",
    steps: [
      "Aus dem Level Change explosiv mit dem Vorderfuß nach vorn.",
      "Vorderknie landet zwischen den Beinen des Gegners.",
      "Hüfte folgt sofort — Schwerpunkt unter dem Gegner.",
      "Hinterer Fuß kommt nach, schiebt nach vorn.",
      "Kopf bleibt aufrecht, Augen am Gegner.",
    ],
    commonMistakes: [
      "Vorderfuß zu kurz → Gegner kann sprawlen.",
      "Kopf nach unten → Front-Headlock-Risiko.",
      "Hüfte bleibt zurück → kein Drive nach vorn.",
      "Zu langsam — der Step muss explosiv sein.",
    ],
    usage:
      "Fundament jedes Single- oder Double-Leg-Takedowns. Wer den Penetration Step nicht beherrscht, scheitert an jedem ernsthaften Gegner.",
    equipment: ["mat"],
    relatedTechniqueIds: ["wrestling_single_leg", "wrestling_double_leg"],
    nextTechniqueId: "wrestling_single_leg",
  },
  {
    id: "wrestling_sprawl",
    slug: "sprawl",
    name: "Sprawl",
    category: "wrestling",
    difficulty: "anfaenger",
    description:
      "Die Anti-Takedown-Bewegung. Hüfte schießt explosiv nach hinten und unten, Hände kontrollieren den Kopf des Schussversuchs.",
    steps: [
      "Beide Beine explosiv nach hinten schießen.",
      "Hüfte fällt nach unten auf den Gegner.",
      "Hände drücken den Kopf des Gegners zur Matte.",
      "Brust auf den Schultern des Gegners — Druck nach vorn.",
      "Aus der Sprawl-Position weiterarbeiten (Front-Headlock, Whizzer, etc.).",
    ],
    commonMistakes: [
      "Hüfte bleibt oben → Gegner kommt rein.",
      "Beine zu langsam → erst halb gesprawlt.",
      "Hände nicht am Kopf → kein Druck nach unten.",
      "Brust nicht auf den Schultern → Gegner steht auf.",
    ],
    usage:
      "Erste und wichtigste Verteidigung gegen jeden Takedown-Versuch. Wer nicht sprawlt, geht zu Boden.",
    equipment: ["mat", "bodyweight"],
    relatedTechniqueIds: ["wrestling_stance", "wrestling_single_leg"],
  },
  {
    id: "wrestling_single_leg",
    slug: "single-leg",
    name: "Single-Leg Takedown",
    category: "wrestling",
    difficulty: "anfaenger",
    description:
      "Klassischer Takedown: ein Bein des Gegners greifen, kontrollieren, zu Boden bringen. Die meistgenutzte Wrestling-Technik im MMA.",
    steps: [
      "Aus dem Penetration Step ein Bein des Gegners umklammern.",
      "Eigener Kopf an die Innenseite des Oberschenkels.",
      "Beide Hände hinter dem Knie zu einem Lock greifen.",
      "Hüfte ankreuzen — eigene Hüfte an die Hüfte des Gegners.",
      "Finish: Trip, Run-the-Pipe oder Lift-and-Dump.",
    ],
    commonMistakes: [
      "Kopf außen → Gegner kann Sprawl + Whizzer einsetzen.",
      "Eigene Hüfte zu weit weg → kein Druck nach vorn.",
      "Bein ohne festen Lock → Gegner schiebt es weg.",
      "Kein klares Finish → der Single bleibt stehen.",
    ],
    usage:
      "Standard-Takedown auf jedem Niveau. Im MMA besonders gegen die Wand effektiv.",
    equipment: ["mat"],
    relatedTechniqueIds: ["wrestling_double_leg", "wrestling_penetration_step"],
    nextTechniqueId: "wrestling_double_leg",
  },
  {
    id: "wrestling_double_leg",
    slug: "double-leg",
    name: "Double-Leg Takedown",
    category: "wrestling",
    difficulty: "anfaenger",
    description:
      "Der explosive Takedown durch beide Beine. Tiefer Schuss, Schulter im Bauch des Gegners, beide Beine fest umklammert.",
    steps: [
      "Penetration Step tief unter den Gegner.",
      "Schulter trifft den Bauch/die Hüfte des Gegners.",
      "Beide Arme umklammern beide Beine direkt unter dem Knie.",
      "Kopf hoch, Rücken gerade — niemals den Kopf senken.",
      "Drive vor und seitlich → Gegner geht auf den Rücken.",
    ],
    commonMistakes: [
      "Kopf gesenkt → Guillotine-Risiko, besonders im MMA.",
      "Zu hoher Schuss → Gegner sprawlt sofort.",
      "Beine nur an den Knöcheln gegriffen → wenig Kontrolle.",
      "Drive seitlich vergessen → Gegner kann nicht zu Boden gebracht werden.",
    ],
    usage:
      "Volle Power-Takedown. Gegen statische Gegner oder nach einem Setup wie einem Snap-Down sehr stark.",
    equipment: ["mat"],
    relatedTechniqueIds: ["wrestling_single_leg"],
    nextTechniqueId: "wrestling_snap_down",
  },

  // ─── Fortgeschritten ─────────────────────────────────────────────────────
  {
    id: "wrestling_snap_down",
    slug: "snap-down",
    name: "Snap Down",
    category: "wrestling",
    difficulty: "fortgeschritten",
    description:
      "Setup-Technik: den Gegner aus der Stellung nach vorn ziehen, oft als Vorbereitung für Front-Headlock oder Single-Leg.",
    steps: [
      "Beide Hände auf den Hinterkopf/Nacken des Gegners.",
      "Eigene Hüfte explosiv nach hinten ziehen.",
      "Gegnerischen Kopf scharf nach vorn-unten reißen.",
      "Wenn der Gegner sich krümmt → Front-Headlock fixieren.",
      "Alternativ: aus der gebeugten Position einen Single-Leg schießen.",
    ],
    commonMistakes: [
      "Kein Hüft-Pull → reines Armziehen.",
      "Hände zu hoch → kein Hebel.",
      "Snap zu früh ohne Setup → Gegner reagiert.",
      "Nach dem Snap keine Folgeaktion.",
    ],
    usage:
      "Zwingt aufrechte, defensive Gegner in eine schwächere Position. Setup für Front-Headlock-Serien oder Schüsse.",
    equipment: ["mat"],
    relatedTechniqueIds: ["wrestling_single_leg", "wrestling_double_leg"],
  },
];
