# Auftrag: DeepFight-Helix — Runde 5: Feinschliff am Partikel-Look

Du überarbeitest den Prototyp in `D:\DeepFight-Helix`. Dieser Text + zwei zu
lesende Dateien sind alles — kein früherer Chat nötig.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— **§0 (Arbeitsregeln) und §0b (Skills) gelten unverändert und absolut**
(`D:\Tidal-Athletics\` nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben, Spiegel-Dateien byte-identisch, Props nur
ergänzen, Mobile-/Fallback-Mechanik erhalten). Danach `REPORT.md` und den
aktuellen Code lesen.

## 1. Lage

Runde 4 (Partikel-Helix) ist die erste Runde, die der Nutzer grundsätzlich
angenommen hat: „passt schon besser". Es folgt KEIN Kurswechsel, sondern
gezielter Feinschliff an fünf Punkten — Reihenfolge = Priorität. Der
Partikel-Aufbau, das Modell (`lib/fight-dna-helix.ts`) und die Props-API
bleiben unangetastet (Props dürfen nur ergänzt werden).

## 2. Stützröhren entfernen (größter Störfaktor)

Die zwei dunklen Röhren unter den Partikeln sind im Bild sichtbar und stören
den Nutzer am meisten. **Beide Stützmeshes ersatzlos entfernen** (auch die
6.048 Dreiecke und die zwei Mesh-Draws).

Tiefe und Verdeckung stattdessen rein im Partikel-Shader lösen: hintere
Körner (View-Space-Tiefe relativ zur Helixachse) deutlich dunkler, kleiner
und transparenter abstufen, ggf. leicht Richtung `--bg-0` mischen — die
Rückseite tritt zurück, ohne dass irgendein solider Körper in der Szene
liegt. Es darf danach keinerlei sichtbare geschlossene Fläche mehr geben.

## 3. Lebendige Blitze (Energie-System ausbauen)

Der große Puls über die volle Länge (aktuell alle 3–8 s) **bleibt** und
bleibt der stärkste Effekt. NEU dazu:

### 3.1 Wanderblitze
- **2–3 gleichzeitig aktive, schwächere Blitze** mit kürzerem Schweif als
  der große Puls. Jeder spawnt an einer zufälligen Stelle EINES Strangs,
  läuft ein zufälliges Stück den Strang entlang, wechselt gelegentlich
  **über eine beantwortete Sprosse auf den anderen Strang** (die Sprosse
  leuchtet beim Überqueren kurz auf) und läuft dort weiter, dann Fade-out.
- Richtung, Laufweite und Timing zufällig; Ziel-Eindruck: es ist fast immer
  irgendwo etwas Kleines unterwegs — die DNA wirkt lebendig und organisch,
  nicht wie ein einzelner Timer-Effekt.

### 3.2 Seitlicher Austritt
- Ungefähr **alle 20 s** tritt ein Blitz kurz **seitlich aus der DNA aus**:
  ein kurzer Funken-/Lichtbogen, der wenige Zehntelsekunden aus dem Strang
  herausschießt und im Bokeh-Raum verglüht. Immer kombiniert mit einem
  Wanderlauf aus 3.1 (der Austritt ist dessen Höhepunkt, kein eigener
  Timer-Fremdkörper). Bewusst selten halten.

### 3.3 Umsetzung
- Uniform-/shaderbasiert: z. B. ein kleines Array von Pulsköpfen
  (Strangseite, Kurvenposition, Intensität) in Strang- UND Sprossen-Shader.
  Für den seitlichen Austritt notfalls ein kleines viertes `Points`-Objekt
  (wenige hundert Punkte) — Budget siehe §7.
- Alles pausiert außerhalb des Viewports und bei reduced-motion (wie gehabt).

## 4. Sprossen-Verteilung & Wachstum

- **Vollständigkeits-Modus:** Die beantworteten Sprossen sollen sich über
  die GANZE Helix verteilen — deterministische, stabile Zuordnung
  Frage → visuelle Position (Hash über die Frage-ID; eine Sprosse springt
  bei Wachstum/Re-Render NIE um). Beim Mock „Im Aufbau" (wenige Antworten)
  also gleichmäßig gestreute helle Sprossen statt eines Clusters.
- **Fight-Split-Modus:** Jede Sprosse bleibt im Segment ihrer Kategorie,
  verteilt sich aber INNERHALB des Segments nach derselben stabilen Logik.
- **Geister (offen):** weiterhin über die ganze DNA angedeutet — gleiche
  Slot-Logik, damit Geist und spätere helle Sprosse dieselbe Position haben.
- **Teil-Sprossen:** Offene/angedeutete Sprossen dürfen als Stummel
  erscheinen — nur von einem Strang ausgehend ODER von beiden Enden
  beginnend, partiell in den Zwischenraum ragend. Beim Beantworten wächst
  der Stummel zur vollen Sprosse auf die andere Seite durch (die bestehende
  1,2-s-Einflug-Choreo darf dafür zur Durchwachs-Choreo umgebaut werden).
- Das Modell bleibt Quelle der Wahrheit für beantwortet/offen und Prozent;
  die visuelle Slot-Zuordnung ist reine Renderer-Sache.

## 5. Fight-Split: Farbgrenzen vermischen

- An jeder Segmentgrenze stechen die Farben ineinander statt hart zu
  schneiden: Der Strang-Farbverlauf mischt über eine Übergangszone von
  **ca. 2 Sprossen ober- und unterhalb** der Grenze in die Nachbarfarbe.
- Sprossen in dieser Zone mischen beide Farben, wobei die **eigene
  Segmentfarbe dominant bleibt** (~60–70 %).
- Außerhalb der Übergangszonen bleiben die `--cat-*`-Töne unverfälscht.
  Light-Theme separat prüfen (keine schlammigen Mischtöne).

## 6. Lavalampen-Hintergrund NEU BAUEN

Der aktuelle Effekt ist abgelehnt: **zu langsam** und die Blobs kleben
**lokal an ihrer Stelle** (der Nutzer nimmt nur zwei wahr). Die
Notlösung auf der Dev-Seite (Default 2,5×, Regler bis 5×) war nur ein
Sichtbarkeits-Test — sie ersetzt den Neubau nicht:

- Blobs wandern auf **langen organischen Bahnen über die GESAMTE Fläche**
  (Translate-Distanzen 40–80 % der Viewport-Größe, waypoint-artige Kurven —
  KEIN Ping-Pong-Oszillieren um einen Fixpunkt).
- Bewegung muss **in Sekunden wahrnehmbar** sein: eine Traverse grob
  12–20 s beim neuen Default-Tempo; der Form-Morph läuft weiter dazu.
- **3–4 Blobs, alle sichtbar im Bild**; Deckkraft moderat höher als jetzt.
  Dark UND Light getrennt abstimmen — kein Farbschleier über Text/Bedienung.
- Technik unverändert: nur `transform`/`opacity`/`border-radius`,
  reduced-motion stoppt. Tempo- und Deckkraft-Regler auf der Dev-Seite;
  die final gewählten Werte werden Defaults (im Bericht nennen).

## 7. Budget

- **≤ 8 Draw Calls, ≤ 45.000 Punkte gesamt, max. 4 `Points`-Objekte**
  (Stränge + Sprossen + Bokeh + optional Effekt-Funken). Die
  Stützröhren-Dreiecke entfallen ersatzlos — es gibt keine Mesh-Draws mehr.
- Idle-Demand-Takt ~24 fps bleibt; Wanderblitze dürfen den Takt nicht
  dauerhaft anheben. Mobile-Emulation testen.
- Alle Schutzpfade (Viewport, Visibility, Kontextverlust → Glyph,
  reduced-motion → Glyph) erhalten und erneut testen; alles `dispose()`-en.

## 8. Dev-Seite

- Neue Regler: Wanderblitz-Anzahl (0–4) und -Intensität, Austritts-Frequenz,
  Lava-Tempo und Lava-Deckkraft. Final gewählte Werte werden Defaults
  (im Bericht nennen).

## 9. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber;
  Spiegel-Dateien byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- Screenshots/Aufnahmen in `report/`: Dark + Light; Sprossen-Verteilung beim
  Mock „Im Aufbau" (Vollständigkeit UND Fight-Split); Split-Grenzzone in
  Nahaufnahme; Wanderblitz mit Sprossen-Übergang (Bildfolge/WebM);
  seitlicher Austritt; Lava-Bahnen (Bildfolge über ~15 s); Szene ohne
  Stützröhren aus Runde-4-Perspektive.
- `REPORT.md`: was entfernt/ersetzt wurde, Messwerte (Punkte, Draw Calls,
  FPS Idle/Puls, Desktop + Mobile-Emulation), neue Defaults. `HANDOFF.md`
  aktualisieren. Danach STOPPEN — keine Integration nach Tidal.
