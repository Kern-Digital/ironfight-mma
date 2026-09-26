import type { Technique } from "../types";

/**
 * Einstiegs-Drills — die Übungen für den Anfang, 3 je Kampfart.
 *
 * Bauprinzip: Jeder Drill sperrt etwas, damit genau eine Fähigkeit übrig
 * bleibt. Die Hände fallen weg, also arbeitet der Kopf. Die Würfe fallen weg,
 * also arbeiten die Hände. Wer weniger darf, wiederholt öfter.
 *
 * Diese Drills tragen `role: "drill"` und `level: "anfaenger"` und erscheinen
 * damit im Einstieg jeder Kampfart. Runden und Dauer stehen bewusst NICHT hier
 * — die kommen aus dem passenden Eintrag in lib/exercises.ts, der über
 * `techniqueIds` auf den Drill zeigt.
 *
 * `whyItMatters` steht VOR der Anleitung und beantwortet die erste Frage eines
 * Einsteigers: wofür mache ich das?
 *
 * TEXTE: Der Skill `.claude/skills/tidal-stimme` gilt für jeden Satz hier.
 * Die drei Regeln, an denen die erste Fassung scheiterte:
 *   • Der Mangel gehört nie dem Leser. Wer einen Mangel besitzen darf: der
 *     Gegner, die alte Methode, die Umstände.
 *   • ABER: Ein Fehler darf deshalb KEIN bloßer Infinitiv werden (Leons Fund
 *     24.09.). „Rückwärts ausweichen statt seitlich" liest sich im Deutschen
 *     als Aufforderung — und genau diese Form tragen die `coachingCues` auf
 *     derselben Seite („Jeden Schlag ansagen"). Dieselbe Grammatik hieße dann
 *     einmal „mach das" und einmal „mach das nicht". Statt „du" wird deshalb
 *     ein KÖRPERTEIL zum Subjekt: „Die Füße gehen nach hinten statt zur
 *     Seite." Beschreibt den Fehler, klagt niemanden an, ist kein Befehl.
 *     `scripts/test-einstiegs-drills.mjs` prüft jeden Satzanfang.
 *   • Keine Zweitakt-Konstruktion mit Dreh und kein „nicht X, sondern Y" —
 *     Leon nennt das künstlich.
 *   • Ziffern statt Zahlwörter, „du" statt „ihr", kein Ausrufezeichen, kein
 *     Passiv ohne Handelnden.
 *
 * Glossar-Markierungen (`{{clinch}}`, siehe lib/glossar.ts) stehen NUR in
 * `whyItMatters` und `description`. Die übrigen Felder erscheinen an Stellen
 * ohne Glossar-Rahmen, bis hin zu den Seiten-Metadaten.
 */
export const DRILL_TECHNIQUES: Technique[] = [
  // ─── Boxen ───────────────────────────────────────────────────────────────
  {
    id: "boxing_drill_distance",
    slug: "distanz-halten",
    name: "Distanz halten",
    category: "boxing",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Die {{distanz}} entscheidet, welche Technik überhaupt ankommt. Hier baust du das Gefühl dafür auf, bevor der erste Schlag fliegt.",
    description:
      "Dein Partner geht vor und zurück, du hältst genau eine Armlänge Abstand. Schläge bleiben draußen, die ganze Aufmerksamkeit liegt auf den Füßen.",
    steps: [
      "Geh mit deinem Partner auf Armlänge in die Boxstellung.",
      "Dein Partner geht vor, zurück und seitwärts und wechselt selbst das Tempo.",
      "Du hältst den Abstand konstant auf Armlänge.",
      "Die Füße gleiten über den Boden, die Hacken bleiben unten.",
      "Nach 2 Minuten übernimmst du die Führung.",
    ],
    commonMistakes: [
      "Die Beine überkreuzen sich beim Seitwärtsgehen.",
      "Die Füße springen statt zu gleiten, das kostet Kraft und Balance.",
      "Der Blick klebt an den Füßen des Partners.",
      "Der Abstand wächst von Runde zu Runde aus Vorsicht.",
    ],
    usage:
      "Vor dem ersten Sparring. Fußarbeit ohne Druck, damit die Beine im Sparring schon wissen, wohin.",
    equipment: ["bodyweight"],
    trainingArea: ["footwork", "drills"],
    disciplines: ["boxing", "kickboxen", "muay-thai", "mma"],
    coachingCues: [
      "Die Armlänge einmal vormessen, dann den Abstand ansagen.",
      "Das Tempo alle 30 Sekunden wechseln.",
      "Beide Richtungen gleich lange führen.",
    ],
    safetyNotes: [
      "Genug Platz zu den anderen Paaren lassen, der Weg geht quer durch die Halle.",
      "Keine Schläge, auch keine angedeuteten.",
    ],
    useCases: ["Probetraining und erste Einheit", "Aufwärmen vor dem Sparring"],
    relatedTechniqueIds: ["boxing_footwork", "boxing_guard"],
    nextTechniqueId: "boxing_drill_slip_only",
    priorityScore: 9,
    frequencyScore: 8,
    diversityGroup: "footwork-basics",
    videoSearchQuery: "boxing distance control mirror drill beginner",
  },
  {
    id: "boxing_drill_slip_only",
    slug: "taktisches-ausweichen",
    name: "Taktisches Ausweichen",
    category: "boxing",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Ausweichen ist die wichtigste Technik, egal welchen Kampfsport du später machst. Jeder Schlag, der ins Leere geht, spart dir Kraft für die letzte Runde.",
    description:
      "Deine Hände liegen hinter dem Rücken, dein Partner schlägt eine lockere {{gerade|Gerade}} zum Gesicht. Dir bleibt nur der Kopf, und genau das bringt die Bewegung schnell in den Reflex.",
    steps: [
      "Fass die Hände hinter dem Rücken und geh in die Boxstellung, Kinn runter.",
      "Dein Partner schlägt angesagte Gerade zum Gesicht, halbes Tempo.",
      "Geh seitlich aus der Linie, mal nach links, mal nach rechts.",
      "Halt den Blick auf dem Partner, die Augen bleiben offen.",
      "Komm nach jedem Ausweichen zurück in die Mitte.",
    ],
    commonMistakes: [
      "Die Füße gehen nach hinten statt zur Seite — an der Wand endet dieser Weg.",
      "Die Augen gehen im Moment des Schlags zu.",
      "Der Oberkörper knickt weg, der Kopf bleibt in der Linie.",
      "Der Kopf bleibt unten, während der zweite Schlag schon kommt.",
    ],
    usage:
      "Erste Wochen im Boxen und im MMA-Stand. Der Reflex sitzt, bevor Deckung und Konter dazukommen.",
    equipment: ["bodyweight"],
    trainingArea: ["defense", "drills"],
    disciplines: ["boxing", "kickboxen", "muay-thai", "mma"],
    coachingCues: [
      "Jeden Schlag ansagen, solange der Athlet unsicher steht.",
      "Das Tempo erst hochdrehen, wenn 3 Runden sauber durchlaufen.",
      "Auf die Füße schauen — der Weg geht zur Seite.",
    ],
    safetyNotes: [
      "Kein voller Kontakt. Der Partner schlägt, um zu treffen, nicht um zu verletzen.",
      "Mundschutz ab halbem Tempo.",
      "Bei Brillenträgern nur getippte Schläge.",
    ],
    useCases: ["Erste Wochen im Stand", "Aufwärmen vor technischem Sparring"],
    relatedTechniqueIds: ["boxing_slip", "boxing_roll"],
    nextTechniqueId: "boxing_drill_jab_only",
    priorityScore: 10,
    frequencyScore: 9,
    diversityGroup: "head-movement",
    videoSearchQuery: "boxing slip drill hands behind back beginner",
  },
  {
    id: "boxing_drill_jab_only",
    slug: "sparring-nur-mit-jab",
    name: "Sparring nur mit Jab",
    category: "boxing",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Der {{gerade|Jab}} ist der meistgenutzte Schlag im Boxen. Mit dieser einen Waffe baust du Timing und {{distanz}} schneller auf als im freien {{sparring}}.",
    description:
      "Leichtes Sparring, in dem nur der Jab zählt. Die schwere Hand bleibt draußen, damit {{finte|Finten}}, Timing und Fußarbeit die Runde bestimmen.",
    steps: [
      "Zieh Mundschutz und Handschuhe an und geh auf Armlänge in Stellung.",
      "Beide schlagen ausschließlich die Führhand, alles andere bleibt in der Deckung.",
      "Arbeite mit Finten: erst antäuschen, dann schlagen.",
      "Weich mit dem Kopf aus und antworte sofort mit dem eigenen Jab.",
      "Nach 2 Minuten kurz auswerten, dann die nächste Runde.",
    ],
    commonMistakes: [
      "Der Jab kommt aus dem Stand, ohne dass der Fuß mitgeht.",
      "Die Führhand sinkt nach dem Schlag.",
      "Die schwere Hand rutscht aus Gewohnheit doch heraus.",
      "Aus dem leichten Sparring wird ein Wettkampf um Treffer.",
    ],
    usage:
      "Das erste Sparring-Format für Einsteiger. Kontakt lernen mit nur einer Technik und wenig Risiko.",
    equipment: ["bodyweight"],
    trainingArea: ["punches", "combos", "drills"],
    disciplines: ["boxing", "kickboxen", "mma"],
    coachingCues: [
      "Die Härte vor der Runde festlegen und laut wiederholen.",
      "Paare nach Gewicht und Erfahrung zusammenstellen.",
      "Nach jeder Runde eine Sache benennen, die gut lief.",
    ],
    safetyNotes: [
      "Mundschutz ist Pflicht, Kopfschutz nach Ansage des Trainers.",
      "Höchstens 30 Prozent Härte. Wer härter schlägt, setzt eine Runde aus.",
      "Bei Nasenbluten oder Benommenheit sofort abbrechen.",
    ],
    useCases: ["Erstes Sparring", "Technik unter leichtem Druck"],
    relatedTechniqueIds: ["boxing_jab", "boxing_double_jab"],
    nextTechniqueId: "boxing_jab_cross",
    priorityScore: 9,
    frequencyScore: 8,
    diversityGroup: "light-sparring",
    videoSearchQuery: "jab only sparring drill boxing beginner",
  },

  // ─── Ringen ──────────────────────────────────────────────────────────────
  {
    id: "wrestling_drill_stance_hold",
    slug: "stand-halten",
    name: "Stand halten",
    category: "wrestling",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Ein stabiler Stand trägt jeden Wurf und jede Abwehr. Hier baust du ihn unter echtem Zug und Druck auf.",
    description:
      "Du stehst in der {{ringerstellung}}, dein Partner zieht und schiebt dich aus der Balance. Du hältst nur den Stand, jeder Gegengriff bleibt aus.",
    steps: [
      "Geh in die Ringerstellung: Knie gebeugt, Rücken gerade, Hände vor dem Körper.",
      "Dein Partner greift Handgelenke, Nacken und Schultern und zieht in alle Richtungen.",
      "Du folgst mit kleinen Schritten und hältst Hüfte und Kopf über den Füßen.",
      "Bei starkem Zug gehst du tiefer statt nach vorn.",
      "Nach 60 Sekunden tauschst du mit deinem Partner.",
    ],
    commonMistakes: [
      "Der Rücken rundet sich unter Zug.",
      "Die Füße kommen zu eng zusammen, die Basis wird schmal.",
      "Der Kopf sinkt auf die Brust.",
      "Der Stand hält über Kraft statt über Fußarbeit.",
    ],
    usage:
      "Die erste Ringer-Einheit und jedes Aufwärmen danach. Aus diesem Stand starten Single Leg, Double Leg und Sprawl.",
    equipment: ["mat"],
    trainingArea: ["takedown-defense", "drills"],
    disciplines: ["wrestling", "mma", "bjj", "self-defense"],
    coachingCues: [
      "Den Zug langsam steigern, erst am Arm, dann am Nacken.",
      "Auf den Abstand der Füße achten, schulterbreit bleibt schulterbreit.",
      "Nach jeder Runde den Rücken kontrollieren.",
    ],
    safetyNotes: [
      "Kein Reißen am Nacken und kein Ruck aus dem Stand.",
      "Bei Knieschmerzen die Tiefe verringern.",
    ],
    useCases: ["Erste Ringer-Einheit", "Aufwärmen vor Wurftraining"],
    relatedTechniqueIds: ["wrestling_stance", "wrestling_sprawl"],
    nextTechniqueId: "wrestling_drill_pummel_only",
    priorityScore: 10,
    frequencyScore: 9,
    diversityGroup: "stance-base",
    videoSearchQuery: "wrestling stance and motion drill beginner",
  },
  {
    id: "wrestling_drill_pummel_only",
    slug: "handkampf-im-clinch",
    name: "Handkampf im Clinch",
    category: "wrestling",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Wer die {{innenposition}} hat, entscheidet, was als Nächstes passiert — im Ringen, im MMA und im Muay Thai.",
    description:
      "Du gehst mit deinem Partner in den {{clinch}} und kämpfst nur um die Innenposition. Würfe und {{abtauchen|Abtauchen}} bleiben draußen, damit die Hände die ganze Arbeit machen.",
    steps: [
      "Geh aus der Ringerstellung in den Clinch, Stirn an Stirn.",
      "Ein Arm liegt innen, ein Arm außen — dein Partner startet genauso.",
      "Führ den Außenarm unter den Arm deines Partners und hol dir die Innenposition.",
      "Dein Partner macht auf der anderen Seite dasselbe, daraus wird ein Fluss.",
      "Nimm zwischendurch beide Arme innen und halte deinen Partner kurz fest.",
    ],
    commonMistakes: [
      "Der Kopf hängt tief, der Nacken liegt frei.",
      "Die Arme schieben, die Hüfte bleibt stehen.",
      "Die Füße kleben am Boden.",
      "Aus dem Drill wird ein Kräftemessen.",
    ],
    usage:
      "Grundlage für jeden Clinch — im Ringen, im MMA und im Muay Thai. Wer hier innen ankommt, wählt den nächsten Schritt.",
    equipment: ["mat"],
    trainingArea: ["clinch", "drills"],
    disciplines: ["wrestling", "mma", "muay-thai", "bjj"],
    coachingCues: [
      "Die Regel vor jeder Runde laut nennen: nur Hände.",
      "Auf Hüftkontakt achten, bei Abstand wird daraus Armdrücken.",
      "Beide Seiten gleich oft führen lassen.",
    ],
    safetyNotes: [
      "Kein Reißen am Nacken.",
      "Ohne Schuhe und mit kurzen Fingernägeln arbeiten.",
      "Bei großem Gewichtsunterschied das Tempo herunternehmen.",
    ],
    useCases: ["Aufwärmen vor Ringen und MMA", "Erste Clinch-Erfahrung"],
    relatedTechniqueIds: ["wrestling_underhook_battle", "wrestling_snap_down"],
    nextTechniqueId: "wrestling_drill_shot_only",
    priorityScore: 10,
    frequencyScore: 9,
    diversityGroup: "clinch-position",
    videoSearchQuery: "wrestling pummeling drill underhooks beginner",
  },
  {
    id: "wrestling_drill_shot_only",
    slug: "abtauchen-ohne-abschluss",
    name: "Abtauchen ohne Abschluss",
    category: "wrestling",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "{{abtauchen|Abtauchen}} trägt jeden Wurf im Ringen. Ohne Abschluss wiederholst du den Weg so oft, dass er von selbst kommt.",
    description:
      "Du tauchst ab, berührst mit beiden Händen das vordere Bein und stehst wieder auf. Der Wurf bleibt aus, damit der Eintritt sauber bleibt und oft läuft.",
    steps: [
      "Beginn in der Ringerstellung, dein Partner steht locker gegenüber.",
      "Senk die Höhe über die Knie, der Rücken bleibt gerade.",
      "Setz den vorderen Fuß zwischen die Füße deines Partners.",
      "Fass mit beiden Händen hinter sein vorderes Knie, der Kopf bleibt außen oben.",
      "Steh sofort wieder auf und geh zurück in die Stellung.",
    ],
    commonMistakes: [
      "Der Oberkörper klappt nach vorn, statt dass die Knie beugen.",
      "Das hintere Knie schleift über die Matte.",
      "Der Kopf geht unter die Brust des Partners.",
      "Nach der Berührung fehlt der Weg zurück in den Stand.",
    ],
    usage:
      "Sobald die Ringerstellung sitzt. Baut den Eintritt für Single Leg und Double Leg auf, bevor der Wurf dazukommt.",
    equipment: ["mat"],
    trainingArea: ["takedowns", "drills"],
    disciplines: ["wrestling", "mma", "bjj"],
    coachingCues: [
      "Die Tiefe zählen lassen, nicht das Tempo.",
      "Nach jedem Eintritt den sauberen Stand abwarten.",
      "Darauf achten, dass der Partner die Hände oben hält.",
    ],
    safetyNotes: [
      "Knieschoner bei mehr als 10 Wiederholungen am Stück.",
      "Der Partner bleibt stehen und sprawlt in dieser Stufe nicht.",
    ],
    useCases: ["Technikblock im Ringen", "Vorbereitung auf Wurftraining"],
    relatedTechniqueIds: ["wrestling_penetration_step", "wrestling_level_change"],
    nextTechniqueId: "wrestling_single_leg",
    priorityScore: 9,
    frequencyScore: 8,
    diversityGroup: "shot-entry",
    videoSearchQuery: "wrestling penetration step drill no finish beginner",
  },

  // ─── BJJ ─────────────────────────────────────────────────────────────────
  {
    id: "bjj_drill_standup",
    slug: "sicher-aufstehen",
    name: "Sicher aufstehen",
    category: "bjj",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "{{technisches-aufstehen|Technisch aufstehen}} ist die erste Sache am Boden, die dich wirklich schützt. Sie ist dein Ausweg, bevor du überhaupt eine Befreiung kennst.",
    description:
      "Du sitzt, dein Partner steht vor dir. Du stehst über die Stützhand auf und hältst dabei durchgehend eine Hand und einen Fuß zwischen dir und deinem Partner.",
    steps: [
      "Setz dich auf die Matte, ein Fuß steht auf, der andere liegt.",
      "Stütz dich hinter dir mit einer Hand ab, die andere Hand deckt das Gesicht.",
      "Heb die Hüfte an und zieh das hintere Bein unter dem Körper durch.",
      "Steh auf und halte den Blick dabei auf deinem Partner.",
      "Geh 2 Schritte rückwärts, bevor du die Hände senkst.",
    ],
    commonMistakes: [
      "Beide Hände stützen gleichzeitig, das Gesicht liegt frei.",
      "Der Blick geht zu Boden.",
      "Der Rücken dreht sich zum Partner.",
      "Nach dem Aufstehen fehlt der Schritt zurück.",
    ],
    usage:
      "Die allererste Bodenstunde, auch in der Selbstverteidigung. Ohne diesen Weg bleibt jede Bodenposition eine Sackgasse.",
    equipment: ["mat"],
    trainingArea: ["escapes", "drills"],
    disciplines: ["bjj", "mma", "self-defense"],
    coachingCues: [
      "Den Ablauf 3-mal langsam vorzeigen, dann erst zählen lassen.",
      "Auf die deckende Hand achten, sie bleibt oben.",
      "Beide Seiten üben, auch die unbequeme.",
    ],
    safetyNotes: [
      "Genug Abstand zu den anderen Paaren, der Weg geht nach hinten.",
      "Bei Handgelenksbeschwerden auf den Unterarm stützen.",
    ],
    useCases: ["Erste Bodeneinheit", "Selbstverteidigungs-Grundlage"],
    relatedTechniqueIds: ["bjj_technical_standup", "bjj_bridge_roll"],
    nextTechniqueId: "bjj_drill_frames_only",
    priorityScore: 10,
    frequencyScore: 8,
    diversityGroup: "standup-escape",
    videoSearchQuery: "bjj technical standup drill beginner",
  },
  {
    id: "bjj_drill_frames_only",
    slug: "rahmenarbeit-unter-druck",
    name: "Rahmenarbeit unter Druck",
    category: "bjj",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "{{rahmen|Rahmen}} halten deinen Partner auf Abstand, ohne dass du Kraft verbrennst. Jede Befreiung am Boden beginnt damit.",
    description:
      "Dein Partner hält dich in der {{seitenlage}} und darf nur halten — kein {{aufgabegriff}}, kein Positionswechsel. Du schaffst nur Platz. Weil beide Rollen so eng sind, arbeitet jede Sekunde an derselben Sache.",
    steps: [
      "Leg dich unten in die Seitenlage, dein Partner kontrolliert von oben.",
      "Setz einen Unterarm an seine Hüfte, den anderen an seinen Hals.",
      "Halt die Arme steif, die Kraft kommt aus dem Skelett.",
      "Schieb dich mit den Füßen weg und dreh die Hüfte heraus.",
      "Zieh das untere Knie durch die Lücke, sobald Platz entsteht.",
    ],
    commonMistakes: [
      "Gebeugte Arme drücken statt zu stützen, nach 2 Versuchen ist die Kraft weg.",
      "Die Hüfte bleibt flach am Boden liegen.",
      "Der Rücken dreht sich nach oben.",
      "Die Füße finden keinen Kontakt zum Boden und schieben ins Leere.",
    ],
    usage:
      "Die erste Bodenstunde nach dem Aufstehen. Rahmen tragen später jede Befreiung aus Seitenlage und Mount.",
    equipment: ["mat"],
    trainingArea: ["escapes", "drills"],
    disciplines: ["bjj", "mma"],
    coachingCues: [
      "Oben darf nur halten. Diese Regel bei jedem Wechsel laut wiederholen.",
      "Mit 40 Prozent Druck starten und langsam steigern.",
      "Nach jeder Runde tauschen, damit beide die Unterseite kennen.",
    ],
    safetyNotes: [
      "Der Partner oben legt sein Gewicht ab, statt sich fallen zu lassen.",
      "Abklopfen gilt auch ohne Aufgabegriff. Bei Atemnot sofort lösen.",
      "Kein Knie auf den Bauch in dieser Stufe.",
    ],
    useCases: ["Erste Bodeneinheit", "Positionsspiel statt freiem Rollen"],
    relatedTechniqueIds: ["bjj_side_control_escape", "bjj_hip_escape"],
    nextTechniqueId: "bjj_drill_position_hold",
    priorityScore: 10,
    frequencyScore: 9,
    diversityGroup: "bottom-escape",
    videoSearchQuery: "bjj frames side control escape drill beginner",
  },
  {
    id: "bjj_drill_position_hold",
    slug: "position-halten",
    name: "Position halten",
    category: "bjj",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Im BJJ zählt die Position vor dem {{aufgabegriff}}. Hier lernst du, sie gegen echten Widerstand zu halten.",
    description:
      "Du kontrollierst von oben, dein Partner arbeitet sich frei. Aufgabegriffe bleiben draußen, damit die ganze Runde an Druck und Gewichtsverteilung geht.",
    steps: [
      "Beginn in der Seitenlage, du liegst quer über der Brust deines Partners.",
      "Leg die Hüfte tief ab und such den Druck über Brust und Schulter.",
      "Halt die Ellbogen eng am Körper deines Partners.",
      "Folg seiner Bewegung, statt gegen sie zu drücken.",
      "Nach 90 Sekunden tauschst du nach oben oder unten.",
    ],
    commonMistakes: [
      "Die Hüfte steht hoch, der Druck fehlt.",
      "Die Arme klammern, die Ellbogen stehen ab.",
      "Der Griff wandert zum Aufgabegriff und die Position geht auf.",
      "Bei jeder Bewegung des Partners folgt ein Gegenzug mit Kraft.",
    ],
    usage:
      "Sobald die Rahmenarbeit sitzt. Aus gehaltener Position kommen später Mount, Rückenkontrolle und jeder Aufgabegriff.",
    equipment: ["mat"],
    trainingArea: ["ground-control", "drills"],
    disciplines: ["bjj", "mma"],
    coachingCues: [
      "Die Zeit laut mitzählen, damit die Runde ein Ziel hat.",
      "Auf abstehende Ellbogen hinweisen, sie öffnen jede Position.",
      "Den Athleten unten früh zum Abklopfen ermuntern.",
    ],
    safetyNotes: [
      "Kein Gewicht auf Hals oder Gesicht.",
      "Abklopfen beendet die Runde sofort, auch ohne Griff.",
      "Bei Atemnot oder Übelkeit aufhören.",
    ],
    useCases: ["Positionsspiel im Anfängerkurs", "Vorbereitung aufs Rollen"],
    relatedTechniqueIds: ["bjj_mount_escape", "bjj_closed_guard"],
    nextTechniqueId: "bjj_closed_guard",
    priorityScore: 9,
    frequencyScore: 8,
    diversityGroup: "top-control",
    videoSearchQuery: "bjj side control positional sparring no submissions",
  },

  // ─── Muay Thai ───────────────────────────────────────────────────────────
  {
    id: "muaythai_drill_teep_only",
    slug: "teep-auf-distanz",
    name: "Teep auf Distanz",
    category: "muay-thai",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Der {{teep}} stoppt deinen Gegner, bevor er auf seine Reichweite kommt. Von allen Techniken im Muay Thai kostet er dich am wenigsten Kraft.",
    description:
      "Dein Partner geht mit dem Pratzenschild vor, du stoppst ihn mit dem Teep. Andere Techniken bleiben draußen, damit du die Distanz findest, aus der der Teep trifft.",
    steps: [
      "Dein Partner hält das Schild vor dem Bauch und geht langsam auf dich zu.",
      "Zieh das vordere Knie hoch und stoß den Fuß gerade nach vorn.",
      "Triff mit dem Fußballen, die Hüfte schiebt mit.",
      "Zieh den Fuß sofort zurück und steh wieder in Stellung.",
      "Nach 10 Teeps übernimmst du das Schild.",
    ],
    commonMistakes: [
      "Der Fuß schwingt nach oben, statt gerade nach vorn zu stoßen.",
      "Die Hüfte bleibt zurück, der Stoß kommt nur aus dem Bein.",
      "Nach dem Teep steht der Fuß vorne und die Balance kippt.",
      "Der Teep kommt zu spät, wenn der Partner schon in Reichweite ist.",
    ],
    usage:
      "Erste Wochen im Muay Thai und im Kickboxen. Der Teep hält die Distanz, aus der alle anderen Techniken starten.",
    equipment: ["pads"],
    trainingArea: ["kicks", "defense", "drills"],
    disciplines: ["muay-thai", "kickboxen", "mma"],
    coachingCues: [
      "Den Vorwärtsdruck langsam steigern, erst Schrittgeschwindigkeit, dann schneller.",
      "Auf den Rückzug des Fußes achten, er gehört zur Technik.",
      "Beide Beine gleich oft treten lassen.",
    ],
    safetyNotes: [
      "Der Teep trifft das Schild, nie den ungeschützten Bauch.",
      "Auf trockenem Boden arbeiten, der Standfuß rutscht sonst weg.",
    ],
    useCases: ["Erste Muay-Thai-Einheit", "Distanzarbeit vor dem Sparring"],
    relatedTechniqueIds: ["muaythai_teep", "muaythai_teep_counter"],
    nextTechniqueId: "muaythai_drill_check_only",
    priorityScore: 10,
    frequencyScore: 9,
    diversityGroup: "push-kick",
    videoSearchQuery: "muay thai teep drill distance control beginner",
  },
  {
    id: "muaythai_drill_check_only",
    slug: "low-kick-abfangen",
    name: "Low Kick abfangen",
    category: "muay-thai",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Ein abgefangener {{low-kick|Low Kick}} kostet deinen Gegner mehr als dich. Das Schienbein hält, sobald es rechtzeitig oben steht.",
    description:
      "Dein Partner tritt angesagte Low Kicks, du hebst nur das Schienbein. Konter bleiben draußen, damit die ganze Aufmerksamkeit beim Timing liegt.",
    steps: [
      "Steh in Muay-Thai-Stellung, das Gewicht liegt mittig.",
      "Dein Partner sagt die Seite an und tritt mit 30 Prozent Härte.",
      "Heb das Knie und dreh das Schienbein nach außen gegen den Kick.",
      "Setz den Fuß sofort wieder ab und steh stabil.",
      "Nach 20 Kicks trittst du.",
    ],
    commonMistakes: [
      "Das Knie hebt zu spät und der Kick trifft den Oberschenkel.",
      "Der Fuß bleibt am Boden, nur das Bein spannt an.",
      "Das Gewicht kippt nach hinten.",
      "Die Hände sinken, während das Bein arbeitet.",
    ],
    usage:
      "Sobald der Athlet sicher steht. Ohne das Abfangen bremst ein Low Kick nach wenigen Treffern das ganze Beinspiel.",
    equipment: ["bodyweight"],
    trainingArea: ["defense", "kicks", "drills"],
    disciplines: ["muay-thai", "kickboxen", "mma"],
    coachingCues: [
      "Die Seite ansagen lassen, solange das Timing wackelt.",
      "Auf die Hände achten, sie bleiben oben.",
      "Die Härte in Stufen freigeben, 30 dann 50 Prozent.",
    ],
    safetyNotes: [
      "Schienbeinschoner bei mehr als 20 Kicks je Seite.",
      "Ein verfehltes Abfangen beendet die Runde, kein Nachtreten.",
      "Bei Schmerzen am Schienbein sofort aufhören.",
    ],
    useCases: ["Technikblock Muay Thai", "Vorbereitung auf Kick-Sparring"],
    relatedTechniqueIds: ["muaythai_low_kick", "muaythai_body_kick"],
    nextTechniqueId: "muaythai_drill_clinch_only",
    priorityScore: 9,
    frequencyScore: 8,
    diversityGroup: "kick-defense",
    videoSearchQuery: "muay thai check low kick drill beginner",
  },
  {
    id: "muaythai_drill_clinch_only",
    slug: "nackenkontrolle-im-clinch",
    name: "Nackenkontrolle im Clinch",
    category: "muay-thai",
    difficulty: "anfaenger",
    role: "drill",
    level: "anfaenger",
    subCategory: "Einstiegs-Drill",
    whyItMatters:
      "Im Muay-Thai-{{clinch}} gewinnt, wer den Nacken kontrolliert. Aus dieser einen Position kommen Knie, Würfe und Ellbogen.",
    description:
      "Du kämpfst mit deinem Partner nur um die {{nackenklammer}}. Knie bleiben draußen, damit Handarbeit und Haltung die Runde bestimmen.",
    steps: [
      "Geh in den Clinch und leg beide Hände in den Nacken deines Partners.",
      "Die Ellbogen bleiben eng beieinander und drücken auf sein Schlüsselbein.",
      "Dein Partner arbeitet seine Hände innen und übernimmt die Klammer.",
      "Hol sie dir zurück, indem du eine Hand innen durchführst.",
      "Halt den eigenen Rücken gerade und den Kopf oben.",
    ],
    commonMistakes: [
      "Die Ellbogen stehen weit auseinander, die Klammer ist offen.",
      "Der Zug kommt aus den Armen statt aus dem Körpergewicht.",
      "Der eigene Kopf sinkt unter die Schulter des Partners.",
      "Die Füße stehen parallel und die Balance geht verloren.",
    ],
    usage:
      "Sobald Teep und Abfangen sitzen. Der Clinch entscheidet im Muay Thai viele Runden und braucht eigene Zeit im Training.",
    equipment: ["mat"],
    trainingArea: ["clinch", "drills"],
    disciplines: ["muay-thai", "kickboxen", "mma"],
    coachingCues: [
      "Die Klammer einmal an einem Athleten vorzeigen, dann frei arbeiten lassen.",
      "Auf gerade Rücken achten, der Clinch zieht nach unten.",
      "Alle 60 Sekunden die Startposition neu setzen.",
    ],
    safetyNotes: [
      "Kein Reißen und kein Ruck am Nacken.",
      "Keine Knie in dieser Stufe, auch keine angedeuteten.",
      "Bei Nackenschmerzen aussetzen.",
    ],
    useCases: ["Clinch-Block im Anfängerkurs", "Kraftausdauer am Ende der Einheit"],
    relatedTechniqueIds: ["muaythai_clinch_basic", "muaythai_knee"],
    nextTechniqueId: "muaythai_knee",
    priorityScore: 9,
    frequencyScore: 8,
    diversityGroup: "clinch-control",
    videoSearchQuery: "muay thai clinch plum control drill beginner",
  },
];
