/**
 * Glossar — Fachwörter, die ein Einsteiger nicht kennen kann.
 *
 * Markierung im Text: `{{clinch}}` zeigt den Begriff unter seinem Namen.
 * `{{clinch|Clinch-Position}}` zeigt eigenen Text an — nötig, weil deutsche
 * Wörter gebeugt werden und „im {{clinch|Clinch}}" sonst falsch stünde.
 *
 * Unbekannte Schlüssel fallen still auf reinen Text zurück. Ein Tippfehler
 * kostet also die Erklärung, nie die Lesbarkeit.
 *
 * Regel für `kurz`: zwei Sätze, keiner länger als eine Zeile. Wer mehr
 * braucht, verlinkt über `techniqueId` auf die volle Technik.
 */
export interface GlossarBegriff {
  /** Schlüssel in der Markierung, klein und ohne Umlaute. */
  id: string;
  /** Anzeigename im Popup-Kopf. */
  begriff: string;
  /** Die Erklärung. Kurz, in ganzen Sätzen, mit „du". */
  kurz: string;
  /** Gängige andere Bezeichnungen, oft englisch. */
  auchGenannt?: string[];
  /** Verwandte Begriffe — im Popup als weiterführende Wörter. */
  siehe?: string[];
  /** Brücke zur Technikdatenbank, falls es dazu eine volle Technik gibt. */
  techniqueId?: string;
}

export const GLOSSAR: GlossarBegriff[] = [
  {
    id: "clinch",
    begriff: "Clinch",
    kurz: "Die Umklammerung auf kurzer Distanz, bei der ihr euch gegenseitig festhaltet. Aus dem Clinch kommen Knie, Würfe und die Kontrolle über den Gegner.",
    auchGenannt: ["Umklammerung", "Nahdistanz"],
    siehe: ["innenposition", "underhook"],
  },
  {
    id: "innenposition",
    begriff: "Innenposition",
    kurz: "Dein Arm liegt unter dem Arm des Gegners statt darüber. Wer innen ist, kontrolliert die Hüfte und entscheidet, was als Nächstes passiert.",
    auchGenannt: ["Inside Position"],
    siehe: ["underhook", "clinch"],
  },
  {
    id: "underhook",
    begriff: "Underhook",
    kurz: "Der Griff, mit dem du deinen Arm unter die Achsel des Gegners führst. Der Underhook ist der häufigste Weg in die Innenposition.",
    auchGenannt: ["Unterhaken"],
    siehe: ["innenposition", "clinch"],
    techniqueId: "wrestling_underhook_battle",
  },
  {
    id: "rahmen",
    begriff: "Rahmen",
    kurz: "Ein steif gehaltener Arm, der Abstand schafft, ohne dass du drückst. Die Kraft kommt aus den Knochen, deshalb hält ein Rahmen auch gegen schwerere Gegner.",
    auchGenannt: ["Frame"],
    siehe: ["seitenlage", "huftarbeit"],
  },
  {
    id: "seitenlage",
    begriff: "Seitenlage",
    kurz: "Die Bodenposition, in der dein Gegner quer über deinem Oberkörper liegt. Eine der unangenehmsten Lagen im BJJ, und deshalb die erste, aus der du dich befreien lernst.",
    auchGenannt: ["Side Control", "Seitkontrolle"],
    siehe: ["rahmen", "huftarbeit"],
    techniqueId: "bjj_side_control_escape",
  },
  {
    id: "huftarbeit",
    begriff: "Hüftarbeit",
    kurz: "Das seitliche Herausdrehen der Hüfte, mit dem du am Boden Platz schaffst. Fast jede Befreiung im BJJ beginnt damit.",
    auchGenannt: ["Shrimping", "Hip Escape"],
    siehe: ["rahmen", "seitenlage"],
    techniqueId: "bjj_hip_escape",
  },
  {
    id: "boxstellung",
    begriff: "Boxstellung",
    kurz: "Die Grundstellung im Boxen: Füße schulterbreit versetzt, Knie locker, Hände am Kinn. Aus ihr kommt jeder Schlag und jede Bewegung.",
    auchGenannt: ["Auslage", "Stance"],
    siehe: ["deckung", "gerade"],
  },
  {
    id: "ringerstellung",
    begriff: "Ringerstellung",
    kurz: "Tiefer Stand mit gebeugten Knien und geradem Rücken, Hände vor dem Körper. Sie macht dich schwer zu werfen und bereit zum Abtauchen.",
    auchGenannt: ["Wrestling Stance"],
    siehe: ["abtauchen"],
    techniqueId: "wrestling_stance",
  },
  {
    id: "gerade",
    begriff: "Gerade",
    kurz: "Ein Schlag, der auf direktem Weg nach vorn geht, statt einen Bogen zu fliegen. Jab und Cross sind die beiden Geraden im Boxen.",
    auchGenannt: ["Straight", "Jab", "Cross"],
    siehe: ["boxstellung", "deckung"],
    techniqueId: "boxing_jab",
  },
  {
    id: "deckung",
    begriff: "Deckung",
    kurz: "Die Haltung der Hände und Arme, die Kopf und Körper schützt. Deckung fängt Schläge ab — Ausweichen lässt sie ins Leere gehen.",
    auchGenannt: ["Guard", "Garde"],
    siehe: ["boxstellung"],
    techniqueId: "boxing_guard",
  },
  {
    id: "abtauchen",
    begriff: "Abtauchen",
    kurz: "Der Wechsel in eine tiefere Höhe, um unter die Arme des Gegners an die Beine zu kommen. Der Beginn fast jedes Wurfs im Ringen.",
    auchGenannt: ["Level Change", "Shot"],
    siehe: ["ringerstellung"],
    techniqueId: "wrestling_level_change",
  },
  {
    id: "aufgabegriff",
    begriff: "Aufgabegriff",
    kurz: "Ein Hebel oder Würgegriff, der den Gegner zum Abklopfen zwingt. Im Einstieg bleiben Aufgabegriffe bewusst gesperrt, damit die Position im Vordergrund steht.",
    auchGenannt: ["Submission", "Aufgabetechnik"],
    siehe: ["abklopfen"],
  },
  {
    id: "abklopfen",
    begriff: "Abklopfen",
    kurz: "Zweimal deutlich auf den Partner oder die Matte klopfen — das Zeichen, sofort loszulassen. Abklopfen gilt immer, auch ohne Griff und ohne Begründung.",
    auchGenannt: ["Tap", "Abtappen"],
    siehe: ["aufgabegriff"],
  },
  {
    id: "sparring",
    begriff: "Sparring",
    kurz: "Freies Üben mit einem Partner, der sich wehrt. Tempo und Härte werden vorher abgesprochen, nicht im Kampf entschieden.",
    auchGenannt: ["Freikampf"],
    siehe: ["rollen"],
  },
  {
    id: "rollen",
    begriff: "Rollen",
    kurz: "Das Sparring am Boden im BJJ. Ihr startet meist kniend oder aus einer festen Position und arbeitet frei weiter.",
    auchGenannt: ["Rolling"],
    siehe: ["sparring", "seitenlage"],
  },
  {
    id: "single-leg",
    begriff: "Single Leg",
    kurz: "Ein Wurf, bei dem du ein Bein des Gegners greifst und ihn darüber zu Fall bringst. Einer der beiden Grundwürfe im Ringen.",
    auchGenannt: ["Einbeinangriff"],
    siehe: ["abtauchen"],
    techniqueId: "wrestling_single_leg",
  },
  {
    id: "sprawl",
    begriff: "Sprawl",
    kurz: "Die Abwehr gegen einen Wurf: Beine nach hinten schleudern, Hüfte auf die Schultern des Gegners fallen lassen. Damit stirbt der Angriff, bevor er greift.",
    auchGenannt: ["Absprawlen"],
    siehe: ["abtauchen"],
    techniqueId: "wrestling_sprawl",
  },
  {
    id: "technisches-aufstehen",
    begriff: "Technisches Aufstehen",
    kurz: "Der Weg vom Boden in den Stand, bei dem eine Hand und ein Fuß zwischen dir und dem Gegner bleiben. So kommst du hoch und bleibst dabei gedeckt.",
    auchGenannt: ["Technical Stand-up"],
    siehe: ["rahmen", "seitenlage"],
    techniqueId: "bjj_technical_standup",
  },
  {
    id: "finte",
    begriff: "Finte",
    kurz: "Eine angedeutete Bewegung, die den Gegner reagieren lässt. Die echte Technik kommt erst, wenn seine Deckung sich geöffnet hat.",
    auchGenannt: ["Feint", "Täuschung"],
    siehe: ["gerade", "distanz"],
  },
  {
    id: "teep",
    begriff: "Teep",
    kurz: "Der gerade Fußstoß im Muay Thai, meist mit der Führseite. Er hält den Gegner auf Abstand und kostet dich dabei wenig Kraft.",
    auchGenannt: ["Push Kick", "Frontkick"],
    siehe: ["distanz", "low-kick"],
    techniqueId: "muaythai_teep",
  },
  {
    id: "low-kick",
    begriff: "Low Kick",
    kurz: "Ein Tritt mit dem Schienbein auf den Oberschenkel. Mehrere davon nehmen dem Gegner den Stand und damit jede Schlagkraft.",
    auchGenannt: ["Beintritt"],
    siehe: ["teep", "clinch"],
    techniqueId: "muaythai_low_kick",
  },
  {
    id: "nackenklammer",
    begriff: "Nackenklammer",
    kurz: "Beide Hände liegen im Nacken des Gegners, die Ellbogen eng zusammen. Aus dieser Kontrolle kommen im Muay Thai Knie, Würfe und Ellbogen.",
    auchGenannt: ["Plum", "Double Collar Tie"],
    siehe: ["clinch", "innenposition"],
    techniqueId: "muaythai_clinch_basic",
  },
  {
    id: "distanz",
    begriff: "Distanz",
    kurz: "Der Abstand zwischen euch beiden. Wer die Distanz bestimmt, bestimmt, welche Techniken überhaupt möglich sind.",
    auchGenannt: ["Reichweite", "Range"],
    siehe: ["clinch", "gerade"],
  },
];

const BY_ID = new Map<string, GlossarBegriff>(GLOSSAR.map((g) => [g.id, g]));

export function getBegriff(id: string): GlossarBegriff | undefined {
  return BY_ID.get(id);
}

/** Alle Schlüssel — für Tests, die tote Markierungen finden sollen. */
export function alleBegriffIds(): string[] {
  return GLOSSAR.map((g) => g.id);
}

/** Die Markierung `{{id}}` oder `{{id|Anzeigetext}}`. */
export const GLOSSAR_MUSTER = /\{\{([a-z0-9-]+)(?:\|([^}]*))?\}\}/g;

export interface TextStueck {
  text: string;
  begriff?: GlossarBegriff;
}

/**
 * Zerlegt einen Text in Stücke — reiner Text und erklärte Begriffe.
 *
 * Bewusst hier und nicht in der Komponente: So kann ein Test ohne React
 * prüfen, ob jede Markierung im Inhalt einen Begriff trifft.
 */
export function zerlegeText(roh: string): TextStueck[] {
  const stuecke: TextStueck[] = [];
  let zuletzt = 0;
  // Ein frischer Regex pro Aufruf — `lastIndex` ist Zustand und `GLOSSAR_MUSTER`
  // wird geteilt. Ohne die Kopie verschluckt der zweite Aufruf Treffer.
  const muster = new RegExp(GLOSSAR_MUSTER.source, "g");

  let treffer: RegExpExecArray | null;
  while ((treffer = muster.exec(roh)) !== null) {
    if (treffer.index > zuletzt) {
      stuecke.push({ text: roh.slice(zuletzt, treffer.index) });
    }
    const begriff = BY_ID.get(treffer[1]);
    const anzeige = treffer[2] ?? begriff?.begriff ?? treffer[1];
    stuecke.push(begriff ? { text: anzeige, begriff } : { text: anzeige });
    zuletzt = treffer.index + treffer[0].length;
  }

  if (zuletzt < roh.length) stuecke.push({ text: roh.slice(zuletzt) });
  return stuecke;
}

/** Entfernt alle Markierungen — für Suche, Sortierung und `aria-label`. */
export function reinerText(roh: string): string {
  return zerlegeText(roh)
    .map((s) => s.text)
    .join("");
}
