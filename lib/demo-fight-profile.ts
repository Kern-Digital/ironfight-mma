/**
 * Das Kampfprofil des DNA-Strangs auf der DeepFight-Landung.
 *
 * ES IST EINE KONSTANTE UND KEIN KONTO — Leons Entscheidung 08.09.2026.
 * Er wollte auf der Landung ECHTE Daten sehen, nicht die üblichen Platzhalter:
 * ein voll entwickelter Strang, der zeigt, was am Ende einer Analyse steht.
 * Die Frage war nur, WOHER die Daten kommen.
 *
 * Ein echtes Firestore-Konto hätte aus JEDER Liste gefiltert werden müssen —
 * Athletenliste, Zielauswahl, Freigabe-Sheet, /verwaltung/mitglieder,
 * Wettkampf-Auswahl, Mitgliederzahlen. Das ist genau die Ghost-Konten-Arbeit,
 * die noch offen im Backlog steht (CLAUDE.md), und ein einziger vergessener
 * Filter wäre ein Phantom-Athlet in der Mitgliederliste — in Phase 4 einer,
 * für den Beitrag anfällt (die Abrechnung zählt aktive Mitglieder). Eine
 * Konstante taucht nirgends auf, weil es sie in der Datenbank nicht gibt.
 *
 * SIE HAT DIE FORM EINES ECHTEN PROFILS, NICHT NUR SEIN AUSSEHEN: Der Typ ist
 * `FightProfile` (lib/fight-profile.ts), die Frage-IDs stammen aus
 * `DNA_CATEGORIES` (lib/gegner-dna.ts), die Aktions-IDs aus `ACTION_CATALOG`
 * (lib/fight-stats.ts), und `dnaSplit` summiert sich auf 100. Die Helix
 * rendert sie deshalb über denselben Weg wie jedes echte Profil
 * (`buildHelixModel`) — es IST dieselbe Datenstruktur. Ein Test dafür braucht
 * es nicht: Läuft eine Frage-ID je aus dem Katalog, fällt ihre Antwort in der
 * Helix still weg, und `DEMO_OFFENE_FRAGEN` unten stimmt nicht mehr.
 *
 * WARUM NICHT ALLE 60 FRAGEN BEANTWORTET SIND: Ein Strang mit 100 % hätte
 * keine offenen Sprossen — und genau die sind das Versprechen des Werkzeugs
 * („da geht noch was"). Fünf Fragen bleiben offen; gemessen gegen den echten
 * Katalog sind das **55 von 60 Antworten = 92 %**, und alle neun Kategorien
 * tragen mindestens eine. Die offenen stehen unten als Kommentar an ihrem
 * Platz, damit man sie beim Erweitern findet statt sie zu suchen.
 *
 * DER KÄMPFER: Südpfote, Druckmacher im Stand mit Ringer-Basis. Bewusst kein
 * Name — die Helix zeigt keinen, und ein Name würde die Frage aufwerfen, wer
 * das ist. Die Daten sind der Inhalt, nicht die Person.
 */

import type { FightProfile } from "./fight-profile";

export const DEMO_FIGHT_PROFILE: FightProfile = {
  dna: {
    // ── Real Habits ────────────────────────────────────────────────────────
    "real-habits_repeats":
      "Setzt nach jeder Kombination denselben Seitschritt nach links an — drei von vier Malen in Runde 1 und 2.",
    "real-habits_after-hit":
      "Geht sofort nach vorn und antwortet mit dem Cross, statt abzurücken. Nimmt dafür den zweiten Treffer in Kauf.",
    "real-habits_after-miss":
      "Zieht die Führhand tief und dreht die Schulter — die Deckung öffnet für einen Moment auf der linken Seite.",
    "real-habits_when-tired":
      "Ab Mitte Runde 3 steht er breiter, hält die Hände tiefer und sucht den Clinch, um zu verschnaufen.",
    "real-habits_after-td-attempt":
      "Bleibt nach einem gescheiterten Takedown am Bein und drückt weiter zum Zaun, statt sauber zu lösen.",
    "real-habits_plan-fails":
      "Wechselt in den Vorwärtsgang und erhöht das Volumen — Präzision fällt, Druck steigt.",

    // ── Entry Patterns ─────────────────────────────────────────────────────
    // entry-patterns_jab ist seit 17.09.2026 in entry-patterns_start aufgegangen.
    "entry-patterns_start":
      "Doppelter Jab zum Körper als Blende, danach der Level-Change auf das Führbein. Fast immer beginnt er mit dem Jab, oft nur angedeutet.",
    "entry-patterns_clinch":
      "Über den Overhand: Der Schlag geht daneben, der Arm bleibt am Nacken hängen.",
    "entry-patterns_takedown":
      "Single Leg von außen, nach einem Schlagwechsel und fast nur in der Zaunhälfte.",
    "entry-patterns_center-or-cage":
      "Am Zaun. Im Center wartet er, dort geht die Initiative an den Gegner.",
    "entry-patterns_after-entry":
      "Nach dem Entry kommt der Knieschlag im Clinch oder der Zug an die Hüfte.",
    // offen: entry-patterns_counter

    // ── Preferred Weapons ──────────────────────────────────────────────────
    "preferred-weapons_most-common":
      "Der Jab zum Körper — er trägt fast ein Drittel seines Volumens.",
    "preferred-weapons_most-dangerous":
      "Der linke Overhand nach dem Wechsel in die Südpfote. Zwei seiner drei Niederschläge kommen daher.",
    "preferred-weapons_combo":
      "Jab Körper – Jab Kopf – linker Cross, danach der Seitschritt nach links.",
    "preferred-weapons_kick":
      "Low Kick auf das vordere Bein, meist als Abschluss einer Handserie.",
    "preferred-weapons_punch": "Linker Cross aus der Südpfote.",
    "preferred-weapons_takedown": "Single Leg an den Zaun.",
    "preferred-weapons_finish":
      "Ground and Pound aus der Halbdeckung, nachdem er den Zaun als Rückenstütze genommen hat.",
    "preferred-weapons_under-pressure":
      "Der Front Kick in den Bauch, um Raum zurückzukaufen.",

    // ── Defensive Reactions ────────────────────────────────────────────────
    "defensive-reactions_jabs":
      "Parriert mit der Führhand und lehnt den Oberkörper zurück — der Kopf bleibt dabei auf der Mittellinie.",
    "defensive-reactions_pressure":
      "Sucht den Clinch. Rückwärts arbeitet er kaum und läuft dabei gerade zurück.",
    "defensive-reactions_low-kicks":
      "Checkt das Führbein zuverlässig, das hintere Bein lässt er stehen.",
    "defensive-reactions_takedowns":
      "Sprawlt hart und sauber; am Zaun kommt er dagegen langsam wieder hoch.",
    "defensive-reactions_parry-shell":
      "Parry und Slip. Eine geschlossene Deckung nutzt er nur in Bedrängnis.",
    "defensive-reactions_shoots":
      "Antwortet auf Serien mit einem Konterhaken, nicht mit einem Shot.",

    // ── Cage- und Raumverhalten ────────────────────────────────────────────
    "cage-space_center-movement":
      "Schneidet den Ring ab und bewegt sich seitwärts nach links, um den Weg zum Zaun zu verkürzen.",
    "cage-space_at-cage":
      "Am gegnerischen Zaun arbeitet er mit Unterhaken und Knien; am eigenen wird er passiv.",
    "cage-space_pushes-cage":
      "Er drückt. Von 21 Zaun-Situationen hat er 17 selbst hergestellt.",
    "cage-space_escapes-cage":
      "Über den Unterhaken und einen Dreh — braucht dafür lange und kassiert dabei Knie.",
    // offen: cage-space_space-under-pressure
    "cage-space_dangerous-positions":
      "Mit dem Rücken zum Zaun und ohne Unterhaken. Dort hört seine Offensive auf.",

    // ── Schwächen ──────────────────────────────────────────────────────────
    "weaknesses_technical":
      "Der Kopf bleibt nach der eigenen Kombination auf der Mittellinie stehen — kein Ausweichen nach dem letzten Schlag.",
    "weaknesses_problem-situations":
      "Rückwärtsbewegung gegen Seitwärtsdruck: Er läuft gerade zurück und verliert den Winkel.",
    "weaknesses_repeated-mistakes":
      "Zieht die Führhand nach jedem verfehlten Schlag tief.",
    "weaknesses_loses-control":
      "Nach einem gelandeten Treffer gegen sich — dann tauscht er statt zu ordnen.",
    "weaknesses_bad-distance":
      "Die lange Distanz. Ab Kickreichweite hat er keine Antwort außer dem Vorwärtsgang.",
    "weaknesses_gets-hit-by":
      "Rechter Haken über den tiefen Führarm und Body Kick in den offenen Südpfoten-Winkel.",
    "weaknesses_conditioning-mental":
      "Das Volumen fällt in Runde 3 um rund ein Drittel; die Pausen zwischen den Serien werden doppelt so lang.",

    // ── Exploit-Möglichkeiten ──────────────────────────────────────────────
    "exploits_target-weakness":
      "Der tiefe Führarm nach dem Fehlschlag — dahinter passt der rechte Haken.",
    "exploits_technique-vs-pattern":
      "Sein Seitschritt nach links läuft in den rechten Haken hinein. Den Schritt vorbereiten, nicht den Schlag.",
    "exploits_provoke-reaction":
      "Ein angedeuteter Level-Change zieht seinen Sprawl — der Kopf kommt dabei nach vorn und unten.",
    "exploits_trap":
      "Rückwärts gehen, ihn zum Nachsetzen einladen und im dritten Schritt seitwärts abbiegen.",
    "exploits_seek-position":
      "Center halten und ihn im offenen Raum stellen, wo er warten muss.",
    "exploits_avoid-situations":
      "Den eigenen Rücken am Zaun und jeden Clinch ohne Unterhaken.",

    // ── Gameplan ───────────────────────────────────────────────────────────
    "gameplan_base-plan":
      "Auf Distanz halten, ihn ins Leere laufen lassen und nach jeder seiner Serien kontern. Das Center gehört uns.",
    "gameplan_seek-distance":
      "Lange Distanz, Kickreichweite — dort hat er keine Waffe.",
    "gameplan_avoid-distance":
      "Clinch und kurze Distanz am Zaun.",
    "gameplan_priority-techniques":
      "Front Kick zum Körper, rechter Haken über den tiefen Führarm, Body Kick in den offenen Winkel.",
    "gameplan_round-1":
      "Runde 1 vermessen: viel Bewegung, wenig Austausch. Er zeigt sein Muster in den ersten drei Minuten.",
    "gameplan_if-pressure":
      "Seitwärts abbiegen statt gerade zurück, und den Front Kick als Bremse setzen.",
    // offen: gameplan_if-passive
    "gameplan_key-to-win":
      "Ihn nicht zum Zaun kommen lassen. Sein ganzes Spiel hängt an dieser einen Position.",

    // ── Drills ─────────────────────────────────────────────────────────────
    "drills_preparation":
      "Zaun-Verteidigung mit Unterhaken gegen einen Partner mit Ringer-Basis, drei Runden zu drei Minuten.",
    "drills_defensive-reaction":
      "Abbiegen unter Vorwärtsdruck — der Partner setzt nach, wir gehen nie zwei Schritte gerade zurück.",
    "drills_automate-counters":
      "Rechter Haken direkt nach dem Fehlschlag des Partners, auf Signal des tiefen Führarms.",
    // offen: drills_cage-situations
    "drills_takedown-sequences":
      "Single-Leg-Abwehr am Zaun: Whizzer, Hüfte drehen, wieder ins Center.",
    // offen: drills_sparring-tasks
  },

  /**
   * Summe exakt 100 (`cleanDnaSplit` würde sonst normieren und der Strang
   * zeigte andere Bänder, als hier stehen). Das Bild passt zum Kämpfer oben:
   * Hände vorn, Ringen als zweite Säule, am Boden wenig.
   */
  dnaSplit: {
    boxing: 38,
    kicking: 14,
    wrestling: 24,
    ground: 11,
    clinch: 13,
  },

  /**
   * Die Gewichtssumme steht auf 5,2 — also rund sechs ausgewertete Videos.
   * Sie ist kein Schmuck: `mergeDnaSplit` rechnet damit, und ein Profil mit
   * Split, aber `dnaSplitWeight: 0`, sähe aus wie eines, in das noch nie ein
   * Video eingeflossen ist.
   */
  dnaSplitWeight: 5.2,

  /** IDs aus ACTION_CATALOG, Zonen aus CageZone (lib/fight-stats.ts). */
  actionStats: [
    { id: "jab", attempted: 184, landed: 71, zone: "center", setup: null },
    { id: "cross", attempted: 96, landed: 38, zone: "open", setup: "Doppelter Jab" },
    { id: "hook", attempted: 54, landed: 19, zone: "cage", setup: null },
    { id: "overhand", attempted: 31, landed: 12, zone: "open", setup: "Fehlschlag des Gegners" },
    { id: "low-kick", attempted: 42, landed: 29, zone: "center", setup: "Handserie" },
    { id: "front-kick", attempted: 23, landed: 14, zone: "open", setup: null },
    { id: "knee", attempted: 37, landed: 21, zone: "cage", setup: "Unterhaken" },
    { id: "single-leg", attempted: 28, landed: 11, zone: "cage", setup: "Schlagwechsel" },
    { id: "double-leg", attempted: 9, landed: 2, zone: "open", setup: null },
    { id: "ground-strikes", attempted: 44, landed: 30, zone: "cage", setup: "Halbdeckung" },
  ],

  // Kein Rechenstand: Das Demo-Profil ist aus keiner Analyse abgeleitet.
  evidence: null,
  updatedBy: null,
  updatedAt: null,
};
