import type { Technique } from "../types";

/**
 * Boxing-Techniken — kuratierte Auswahl Anfänger + ausgewählte Fortgeschrittene.
 * Video-/Animation-Slots bleiben absichtlich leer, bis ein rechtssicheres
 * exakt passendes Asset zugeordnet wird (siehe Plan: lieber keins als ein
 * falsches).
 */
export const BOXING_TECHNIQUES: Technique[] = [
  // ─── Anfänger ────────────────────────────────────────────────────────────
  {
    id: "boxing_jab",
    slug: "jab",
    name: "Jab",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Der Jab ist der wichtigste Schlag im Boxen — schnell, gerade, mit der Führhand. Setzt Distanz, hält den Gegner beschäftigt und bereitet alle Folgekombinationen vor.",
    steps: [
      "Boxstellung — Schulter linke Seite leicht zum Gegner (für Rechtsausleger).",
      "Hüfte und Schulter rotieren leicht mit, um Reichweite zu gewinnen.",
      "Vorderhand schießt geradlinig nach vorn, Schulter deckt das Kinn.",
      "Faust dreht in den letzten 15 cm 90° nach unten — 'Daumen nach unten' auf Treffermoment.",
      "Hand kommt sofort wieder in Deckung zurück — schneller Rückzug ist Pflicht.",
    ],
    commonMistakes: [
      "Hand wird vor dem Schlag erst gesenkt ('Telegrafieren').",
      "Kinn nicht durch die Schulter gedeckt.",
      "Nach dem Schlag bleibt die Hand draußen — offene Deckung.",
      "Zu viel Hüftrotation — beim Jab nur leicht!",
    ],
    usage:
      "Distanz halten, Gegner antesten, Combos einleiten. Im MMA auch zur Distanz-Kontrolle vor Takedowns.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["boxing_cross", "boxing_jab_cross"],
    nextTechniqueId: "boxing_cross",
  },
  {
    id: "boxing_cross",
    slug: "cross",
    name: "Cross",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Der Cross ist der gerade Schlag mit der Schlaghand. Mehr Power als der Jab, weil die Hüfte voll mitrotiert.",
    steps: [
      "Aus der Boxstellung Hüfte und Schulter explosiv rotieren.",
      "Hinterer Fuß dreht — Ferse hebt sich, Knie zeigt zur Mitte.",
      "Schlaghand schießt geradlinig zur Mitte des Ziels.",
      "Faust dreht im Kontaktmoment 90° (Daumen nach unten).",
      "Sofort zurück in Deckung — Schulter deckt das Kinn.",
    ],
    commonMistakes: [
      "Kein Hüftdreh — Schlag kommt nur aus dem Arm.",
      "Hinterer Fuß bleibt flach — keine Power.",
      "Vorderhand sinkt während des Crosses — Konter-Hook möglich.",
      "Nach dem Schlag steht der Boxer 'offen' da.",
    ],
    usage:
      "Schwerer Folge-Schlag nach Jab. Im 1-2 die schmerzhafte Hand. Auch als Konter gegen einen kommenden Gegner stark.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["boxing_jab", "boxing_jab_cross"],
    nextTechniqueId: "boxing_hook",
  },
  {
    id: "boxing_hook",
    slug: "hook",
    name: "Hook",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Der Hook ist ein seitlicher Halbkreis-Schlag — meistens mit der Führhand zum Kopf oder Körper. Kommt aus dem Toten Winkel.",
    steps: [
      "Ellbogen waagerecht auf Schulterhöhe heben.",
      "Faust auf Höhe des Ellbogens, Daumen zeigt nach oben (Vertical Hook) oder zur Mitte (Horizontal Hook).",
      "Hüfte und Vorderfuß rotieren explosiv in Schlagrichtung.",
      "Schlag entsteht durch Hüftdrehung, nicht durch Armschwingen.",
      "Nach dem Schlag sofort Deckung — Hook lässt einen offen.",
    ],
    commonMistakes: [
      "Ellbogen zu tief → wird zum 'Schwinger'.",
      "Kein Hüftdreh → Schlag aus dem Arm = keine Power.",
      "Andere Hand sinkt während des Hooks ab.",
      "Zu großer Bogen → Gegner sieht ihn kommen.",
    ],
    usage:
      "Nach Jab-Cross die klassische 1-2-3-Combo. Auch als Konter gegen einen reinkommenden Gegner.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["boxing_uppercut", "boxing_jab_cross_hook"],
    nextTechniqueId: "boxing_uppercut",
  },
  {
    id: "boxing_uppercut",
    slug: "uppercut",
    name: "Uppercut",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Der Uppercut ist ein Schlag von unten nach oben — Knock-Out-Schlag aus der Nahdistanz, ideal gegen vorbeugende Gegner.",
    steps: [
      "Knie leicht beugen — die Power kommt von unten.",
      "Faust seitlich am Körper, Handfläche nach innen.",
      "Beine, Hüfte und Schulter explosiv strecken/rotieren.",
      "Faust schießt diagonal nach oben zur Mitte des Ziels (Kinn oder Solar plexus).",
      "Sofort zurück in Deckung — Uppercut öffnet die Mitte.",
    ],
    commonMistakes: [
      "Schlag kommt nur aus dem Arm, nicht aus den Beinen.",
      "Zu großer Holpunkt — Gegner sieht es kommen.",
      "Hand zu weit nach unten geholt → andere Hand sinkt ab.",
      "Auf Distanz gespielt — Uppercut ist ein Nahdistanz-Schlag.",
    ],
    usage:
      "Gegen Gegner, die sich zur Mitte einkrümmen. Body-Uppercut zermürbt, Kopf-Uppercut endet Kämpfe.",
    equipment: ["heavy-bag", "pads", "bodyweight"],
    relatedTechniqueIds: ["boxing_hook"],
    nextTechniqueId: "boxing_jab_cross_hook",
  },
  {
    id: "boxing_guard",
    slug: "guard",
    name: "Guard / Deckung",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Die Deckung ist das Fundament jeder Verteidigung. Hände schützen das Kinn, Ellbogen schützen Rippen und Leber.",
    steps: [
      "Hände auf Höhe der Wangen, Daumen nach innen.",
      "Ellbogen eng am Körper, schützen Leber und Rippen.",
      "Kinn leicht eingezogen, Blick über die Fäuste hinweg.",
      "Schultern locker, nicht hochgezogen.",
      "Atmung gleichmäßig — Anspannung kostet Ausdauer.",
    ],
    commonMistakes: [
      "Kinn zu hoch → leichtes Ziel.",
      "Ellbogen abstehend → Body-Shots gehen durch.",
      "Hände zu weit weg vom Kopf → Reaktionszeit zu lang.",
      "Schultern hochgezogen → schnelle Ermüdung.",
    ],
    usage:
      "Grundzustand zwischen Aktionen. Aus der Deckung werden alle Schläge und Verteidigungen geschossen.",
    equipment: ["bodyweight"],
    relatedTechniqueIds: ["boxing_footwork", "boxing_slip"],
  },
  {
    id: "boxing_footwork",
    slug: "footwork",
    name: "Footwork",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Bewegung im Boxring entscheidet alles. Stride, Pivot, Side-Step — Boxer arbeitet immer aus Bewegung.",
    steps: [
      "Schultergurt-breite Stellung, Vorderfuß zum Gegner.",
      "Kleine, gleitende Schritte — niemals Beine kreuzen.",
      "Schritte starten immer mit dem näheren Fuß zur Bewegungsrichtung.",
      "Knie weich, Gewicht auf den Fußballen.",
      "Pivot: Vorderfuß bleibt, Hinterfuß dreht zur Seite.",
    ],
    commonMistakes: [
      "Beine werden gekreuzt → Sturzgefahr beim Treffer.",
      "Zu weite Schritte → Balance weg.",
      "Auf den Fersen → langsame Reaktion.",
      "Statisch gegen einen beweglichen Gegner.",
    ],
    usage:
      "Distanz aufbauen, Winkel öffnen, aus Druckzonen rauskommen. Footwork unterscheidet den Boxer vom Schläger.",
    equipment: ["bodyweight", "jump-rope"],
    relatedTechniqueIds: ["boxing_guard", "boxing_jab"],
  },
  {
    id: "boxing_slip",
    slug: "slip",
    name: "Slip",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Slip ist eine Kopfbewegung zur Seite, mit der man Geraden Schlägen ausweicht — ohne die Schlaghand wegzunehmen.",
    steps: [
      "Aus der Boxstellung leichter Knickschlag mit dem Knie.",
      "Oberkörper neigt sich seitlich (nicht nach hinten!).",
      "Kopf schiebt sich aus der Schlaglinie — entweder nach links (gegen Cross) oder rechts (gegen Jab).",
      "Hände bleiben in Deckung, Augen am Gegner.",
      "Sofort wieder in Mittelstellung — fertig zum Konter.",
    ],
    commonMistakes: [
      "Nach hinten ausweichen → Distanz verloren, kein Konter möglich.",
      "Kopf zu tief → schwer wieder hochzukommen.",
      "Augen geschlossen → nichts mehr gesehen.",
      "Slip zu früh → Gegner nutzt es als Feint.",
    ],
    usage:
      "Verteidigung gegen Geradeschläge. Setzt den Boxer gleichzeitig in eine perfekte Konter-Position.",
    equipment: ["bodyweight", "pads"],
    relatedTechniqueIds: ["boxing_roll", "boxing_counter_cross"],
    nextTechniqueId: "boxing_roll",
  },
  {
    id: "boxing_roll",
    slug: "roll",
    name: "Roll",
    category: "boxing",
    difficulty: "anfaenger",
    description:
      "Der Roll ist eine Halbkreis-Bewegung des Oberkörpers, um Hooks zu vermeiden. Klassische Verteidigung gegen seitliche Schläge.",
    steps: [
      "Knie beugen, Oberkörper bewegt sich in einer 'U'-Form.",
      "Auf der Schlagseite des Gegners abtauchen.",
      "Halbkreis durch die Schlaglinie unter dem Hook hindurch.",
      "Auf der anderen Seite wieder hochkommen — Hände bleiben oben.",
      "Aus der Roll-Endposition direkt kontern (Hook oder Cross).",
    ],
    commonMistakes: [
      "Tiefes Abtauchen statt Halbkreis → langsame Rückkehr.",
      "Kein Knie-Knick → Roll wird flach.",
      "Hände sinken während des Rollens.",
      "Augen weg vom Gegner.",
    ],
    usage:
      "Klassische Verteidigung gegen Hooks. Endposition ist ideal für Konter.",
    equipment: ["bodyweight", "pads"],
    relatedTechniqueIds: ["boxing_slip"],
  },

  // ─── Fortgeschritten ─────────────────────────────────────────────────────
  {
    id: "boxing_jab_cross",
    slug: "jab-cross",
    name: "Jab-Cross (1-2)",
    category: "boxing",
    difficulty: "fortgeschritten",
    description:
      "Die fundamentalste Combo im Boxen. Der Jab öffnet, der Cross trifft. Beidhändig, schnell, präzise.",
    steps: [
      "Jab: schnell, geradlinig, Hand auf Augenhöhe.",
      "Sofort danach Cross — keine Pause zwischen den Schlägen.",
      "Hüfte rotiert mit dem Cross voll mit.",
      "Beide Hände kehren sofort in Deckung zurück.",
      "Optional: Halben Schritt nach vorn, um Distanz zu schließen.",
    ],
    commonMistakes: [
      "Jab und Cross werden mit Pause geschlagen — verliert Tempo.",
      "Cross verlangsamt durch Vorbereitung.",
      "Vorderhand sinkt nach dem Jab.",
      "Hüftdreh fehlt beim Cross.",
    ],
    usage:
      "Erste Combo, die jeder lernt. Universell einsetzbar — am Sandsack, auf Pads, im Sparring.",
    equipment: ["heavy-bag", "pads"],
    techniqueIds: ["boxing_jab", "boxing_cross"],
    relatedTechniqueIds: ["boxing_jab_cross_hook", "boxing_jab", "boxing_cross"],
    nextTechniqueId: "boxing_jab_cross_hook",
  },
  {
    id: "boxing_jab_cross_hook",
    slug: "jab-cross-hook",
    name: "Jab-Cross-Hook (1-2-3)",
    category: "boxing",
    difficulty: "fortgeschritten",
    description:
      "Die klassische 3-Schlag-Kombo: Jab öffnet, Cross trifft mittig, Hook landet im Toten Winkel.",
    steps: [
      "1: Jab — schnell, scharf.",
      "2: Cross — mit Hüftdreh, voller Power.",
      "3: Hook — kommt vom Cross-Rückzug, mit Vorderhand.",
      "Hüfte rotiert dabei zweimal: einmal in Cross-Richtung, einmal zurück für den Hook.",
      "Nach dem Hook: sofort wieder in Deckung oder Pivot zur Seite.",
    ],
    commonMistakes: [
      "Hook ohne Hüftrotation — schlägt aus dem Arm.",
      "Pause zwischen Schlag 2 und 3.",
      "Cross-Hand fällt vor dem Hook ab.",
      "Boxer steht nach Hook offen — kein Pivot.",
    ],
    usage:
      "Nach dem 1-2 lernt jeder Boxer das 1-2-3. Setup für Body-Shots oder Übergang in Defensive.",
    equipment: ["heavy-bag", "pads"],
    techniqueIds: ["boxing_jab", "boxing_cross", "boxing_hook"],
    relatedTechniqueIds: ["boxing_jab_cross"],
  },
];
