# MOTION-BRIEF — wie sich Tidal Athletics anfühlt

> Verbindlich für JEDE Session, die UI anfasst. Beschlossen von Leon am
> 2026-09-04. Ergänzt `docs/DESIGN-BRIEF.md` — der regelt, wie die App
> AUSSIEHT; dieser regelt, wie sie sich ANFÜHLT.
>
> **Farben, Themes und Komponentengrößen bleiben unangetastet.** Dieser
> Brief ändert ausschließlich Bewegung, Haptik und Übergänge.

## 1. Die drei Prinzipien

**1. Verwandeln statt umschalten.** Ein Element wechselt seinen Zustand
nicht hart, es verwandelt sich: Der Knopf dehnt sich zum Eingabefeld, die
Karte klappt auf, das Symbol gleitet an seinen neuen Platz. Technisch:
Feder-Physik (`type: "spring"`) und `AnimatePresence`, damit auch das
VERSCHWINDEN eine Bewegung hat — nicht nur das Erscheinen. Ein Panel, das
aufwächst und dann wegblinkt, ist halb fertig.

**2. Alles Anfassbare antwortet.** Unter dem Finger sinkt es ein, unter der
Maus kommt es entgegen. Ohne Ausnahme, auf jedem Knopf, jeder Karte, jeder
Listenzeile.

**3. Auftreten in Wellen.** Neu erscheinende Elemente fließen herein statt
aufzupoppen: leichte Skalierung, feine Unschärfe, und mehrere Elemente
zeitversetzt nacheinander statt alle auf einen Schlag.

## 2. Wo was herkommt

| Schicht | Datei | Zuständig für |
|---|---|---|
| Werte | `lib/motion.ts` | Federn, Skalierungen, Stagger-Abstände |
| Bausteine | `components/motion/` | Pressable, Stagger, Collapse, Pop, MorphSwap, Reveal, SheetShell |
| Grundhaptik | `app/globals.css`, Abschnitt GRUNDHAPTIK | alle 240 Knöpfe der App |

**Arbeitsteilung, und sie ist nicht verhandelbar:** CSS macht die Haptik
(Drücken, Anheben), Framer Motion macht alles, was CSS nicht kann
(Verwandlung, Layout-Fluss, Ein- UND Austritt, Stagger dynamischer Listen).

Der Grund ist Rechenzeit: Die App hat 240 Knöpfe in 70 Dateien. Jeden davon
in eine JavaScript-Feder zu wickeln, kostet Bundle und Hauptthread für eine
Bewegung, die der Compositor umsonst macht. Umgekehrt kann CSS keine Höhe
auf `auto` animieren und weiß nichts vom Verschwinden eines Elements —
dafür ist Framer da.

## 3. Harte Regeln

1. **Kein `import { motion } from "framer-motion"` in Seiten oder
   Bereichs-Komponenten.** Alles läuft über `@/components/motion`.
   Grund: Wer die Bibliothek direkt anfasst, umgeht die Touch- und
   Reduced-Motion-Sperren, und ein späterer Wechsel der Animations-Bibliothek
   würde 70 Dateien treffen statt einer.

   **Die vollständige Ausnahmeliste** (Leon 04.09.2026 — dort IST die
   Bewegung der Inhalt, ein Baustein dafür hätte genau einen Aufrufer):
   Diagramme (`CourseLoadChart`, `WeeklyFeedbackChart`, `MemberGrowthChart`,
   `GrowthSparkline`, `ExerciseAnimation`), die Helix (`FightDnaHelix`,
   `HelixGlyph`), die beiden Verwandlungs-Primitive in `components/ui/`
   (`GooeySearch`, `MultiFilter`) und `PwaInstallPrompt`. Sie stehen alle in
   `components/`, nie in `app/` — eine SEITE fasst die Bibliothek nie an.
   Jede Ausnahme trägt oben im Kopf einen Kommentar, der auf diese Zeile
   verweist. Wer die Liste erweitern will, fragt vorher.

2. **Kein `whileHover` ohne Zeiger-Prüfung.** Immer über
   `useMotionCapability().canHover`. Auf iOS löst der erste Tap `:hover`
   aus und der Zustand BLEIBT hängen. In Tailwind erledigt das
   `future.hoverOnlyWhenSupported` (seit 2026-09-04 gesetzt); in
   handgeschriebenem CSS ist `@media (hover: hover)` Pflicht.

3. **Hover verstärkt, Hover trägt nie.** Keine Funktion und keine
   Information nur im Hover-Zustand — auf Touch gibt es ihn nicht
   (steht so auch in DESIGN-BRIEF §1.8).

4. **Tap-Feedback gilt auf JEDEM Gerät.** Das Einsinken unter dem Finger ist
   die Hälfte des Gefühls; nur das Anheben ist zeiger-exklusiv.

5. **Animiertes `filter: blur()` sparsam und nie auf Touch.** In WKWebView
   (Capacitor) ist Blur pro Bild ein Repaint und NICHT GPU-beschleunigt wie
   `transform`/`opacity`. 20 gleichzeitig unscharfe Listenzeilen ruckeln auf
   älteren iPhones sichtbar. Deshalb: höchstens `BLUR_IN` (4px), und
   `useMotionCapability().canBlur` schaltet ihn auf Touch ab. Die Bewegung
   bleibt, die Unschärfe geht.

6. **`prefers-reduced-motion` ist keine Kür.** Jeder Baustein in
   `components/motion/` prüft es selbst; wer daran vorbei animiert, prüft es
   von Hand. Bei abbestellter Bewegung bleiben Farbe und Rand als
   Rückmeldung — die Zustände müssen lesbar bleiben.

7. **Stabile Keys in fließenden Listen.** `StaggerFlow`/`FlowItem` brauchen
   die Firestore-ID als `key`, nie den Array-Index — sonst hält Framer die
   falsche Zeile für die gebliebene und die Liste morpht falsch.

8. **Nie zwei Federn auf einem Element.** Die CSS-Grundhaptik nimmt alles mit
   `[data-motion]` aus; wer von Hand animiert, setzt das Attribut. Sonst
   multiplizieren sich die Skalierungen (`.97 × .97 = .94`).

## 4. Die Werte (aus `lib/motion.ts`, nicht neu erfinden)

| Was | Wert | Wofür |
|---|---|---|
| `springSnappy` | 420 / 32 / 0.7 | Antwort auf Finger und Maus |
| `springSoft` | 260 / 26 / 0.9 | Form- und Größenwechsel |
| `springGentle` | 190 / 24 / 1.0 | Auftritt neuer Elemente |
| `HOVER_LIFT` | 1.02 | Knöpfe unter der Maus |
| `TAP_PRESS` | 0.97 | Knöpfe unter dem Finger |
| `HOVER_LIFT_SURFACE` | 1.008 | Karten, Listenzeilen |
| `TAP_PRESS_SURFACE` | 0.99 | Karten, Listenzeilen |
| `STAGGER_STEP` | 45 ms | Abstand zweier Listenzeilen |
| `BLUR_IN` | 4 px | Unschärfe beim Hereinfließen |
| `STACK_LIFT` | −44 px | Hinteres Sheet im Kartei-Stapel rückt nach oben |
| `STACK_SHRINK` | 0.92 | … und wird schmaler (nur `scaleX`, nie die Höhe) |

**Sheets:** Jedes Sheet läuft über `SheetShell` (`open`, `onClose`, `label`,
optional `zIndex`, `stacked` und `placement`). Der Aufrufer rendert es IMMER
und meldet „zu" über `open={false}` bzw. `x={null}` — nur so hat das
Schließen eine Bewegung. `useLetzterWert` hält den Inhalt während der
Austritts-Feder fest. `stacked` ist die Kartei-Choreografie (Übungs-Detail
→ Technik davor): dieselbe Feder wie Ein-/Austritt, nur mit anderer
Ruhelage. `placement="bottom"` hält ein Sheet auf JEDER Breite an der
Unterkante (Listen-Popups wie „Meine Workouts"); Standard ist mobil unten,
ab `sm` zentriert. Auch Seiten-Overlays, deren Inhalt inline im JSX steht,
laufen über die Hülle — Achtung: Der Inhalt wird vom Aufrufer auch bei
`open={false}` ausgewertet, `null`-Daten also im Ausdruck abfangen
(`(liste ?? []).map(…)`).
Sichtprüfung: `node scripts/motion-sheet-shots.mjs` gegen `/dev/motion-sheet`.

**Popups nehmen den Platz, den der Bildschirm hergibt** (Leon 04.09.): Das
Panel ist `flex flex-col overflow-hidden` mit `max-h-[NNvh]` und scrollt NIE
selbst. Genau EIN Bereich in der Mitte trägt `min-h-0 flex-1
overflow-y-auto` und füllt damit die Resthöhe; Kopf, Fuß und Knopfreihen
bekommen `shrink-0`. `min-h-0` ist Pflicht — ohne das weigert sich ein
Flex-Kind zu schrumpfen und der Scrollbereich wächst aus dem Panel heraus.
Ein fester px-Deckel (`max-h-64`) auf einem Scrollbereich ist in einem Sheet
VERBOTEN: Er ist auf jedem Bildschirm gleich klein, und zusammen mit einem
scrollenden Panel entstehen zwei verschachtelte Scrollbereiche. Listen-Popups
wachsen in der Breite mit (`sm:max-w-xl lg:max-w-3xl`) — Formular- und
Detail-Sheets NICHT (Leon 04.09.): Auf 768 px werden Eingabezeilen so lang,
dass das Auge den Zeilenanfang verliert. Gewachsen sind damit
Bibliotheks-Suche, Gym-Pläne, Athleten-Auswahl im Plan-Sheet und der
Übungs-Picker; schmal bleiben Einladung anlegen/Detail, Rolle ändern,
Profil teilen, Übungs-Detail, Trainings-Log und der Auto-Generator. Prüfen: Die
Panel-Höhe muss den vh-Deckel erreichen und es darf genau EIN scrollendes
Element im Panel geben.

**Drei Stärken der Grundhaptik** (Attribut `data-press`):
- *Knopf* (kein Attribut bzw. bare `data-press` auf `<a>`): hebt 1.02, sinkt .97.
- `surface` (Karten, Kacheln): hebt 1.008, sinkt .99.
- `quiet` (Zeilen dichter Listen, Rubrik-Köpfe, Akkordeon-Header): hebt
  sich NIE, sinkt .99. Grund: In einer Liste wackelt sonst jede Zeile unter
  der Maus (Leon 04.09. im Kurs-Editor: „das nervt"), und ein angehobener
  Kopf läuft links aus seinem Scroll-Container — der erste Buchstabe wird
  angefressen und unten erscheint ein Querbalken. Hover-Rückmeldung ist dort
  die Flächen-Tönung (`.t-interactive:hover`).
Die Knopf-Regeln schließen `surface`/`quiet` ausdrücklich aus — ohne diese
Sperre gewinnt die Knopf-Regel per Spezifität, und das Attribut wirkt nicht.

**Akkordeons starten geschlossen** (Leon 04.09.), außer eine aktive Suche
braucht die Treffer sichtbar — dann stehen alle Gruppen offen.

**Links:** Die Grundhaptik greift bei `<a>` nur mit `data-press`
(Knopf-Stärke) bzw. `data-press="surface"` (Karten, Listenzeilen) — ein
Text-Link im Fließtext soll sich nicht heben. Jeder `next/link`, der wie ein
Knopf oder eine Karte aussieht, trägt das Attribut.

Die Skalierungen sind KEINE Erfindung: `.97` beim Drücken und `1.02` beim
Anheben liefen seit dem Sidebar-Umbau in `globals.css`. `lib/motion.ts` zieht
sie nur heraus, damit CSS und Framer dieselbe Sprache sprechen. Ändert sich
ein Wert, muss er an BEIDEN Orten mitgehen.

## 5. Native-Ready (Capacitor)

Die App wird via Capacitor in WKWebView (iOS) und Android-WebView laufen
(`CLAUDE.md`: keine Engine, kein React-Native-Neubau). Dort rendert
`framer-motion` identisch zum Browser — alles in diesem Brief ist
uneingeschränkt native-tauglich.

Drei Dinge sind trotzdem WebView-spezifisch und stehen deshalb in der
Grundhaptik-Schicht:

- `-webkit-tap-highlight-color: transparent` — ohne das blitzt unter jedem
  Finger ein graues Rechteck auf, das die Federbewegung zerreißt.
- `touch-action: manipulation` — nimmt WKWebView die 300 ms Wartezeit auf
  einen möglichen Doppeltipp. Der häufigste Grund, warum sich eine
  WebView-App träge anfühlt.
- `@media (hover: hover)` als Sperre um jeden Hover-Zustand (siehe Regel 2).

**Sollte je auf React Native gewechselt werden:** `framer-motion` läuft dort
NICHT. Dann sind `lib/motion.ts` plus `components/motion/` die einzigen
Dateien, die neu geschrieben werden müssen (gegen `reanimated`/`moti`); die
aufrufenden Seiten bleiben unberührt. Genau dafür existiert die Schicht.

## 6. Abnahme (vor „fertig" selbst ausführen)

1. Maus über jeden neuen Knopf: kommt er entgegen?
2. Klick halten: sinkt er ein, federt er zurück?
3. Panel/Modal schließen: verwandelt es sich zurück, oder blinkt es weg?
4. Liste filtern: rutschen die bleibenden Einträge, oder springen sie?
5. Im Browser Touch-Modus (DevTools) prüfen: bleibt nach einem Tap irgendwo
   ein Hover-Zustand stehen?
6. `prefers-reduced-motion` einschalten: bleibt alles bedienbar und lesbar?
