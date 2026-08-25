# Auftrag: DeepFight-Helix — Runde 10: Vereinfachen, Leuchten, Hintergrund entkoppeln

Du überarbeitest den Prototyp in `D:\DeepFight-Helix`. Dieser Text + zwei zu
lesende Dateien sind alles — kein früherer Chat nötig.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— **§0 (Arbeitsregeln) und §0b (Skills) gelten unverändert und absolut**
(`D:\Tidal-Athletics\` nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben, Spiegel-Dateien byte-identisch, Props nur
ergänzen, Mobile-/Fallback-Mechanik erhalten). Danach `REPORT.md` und den
aktuellen Code lesen.

**Erhalten bleiben:** die klappbaren `ControlSection`-Gruppen in `app/page.tsx`,
das sticky Steuerpanel, das kompakte `.tuning-grid` (Labels ≤ 14 Zeichen).

### 0.1 Änderungen von außen — NICHT zurückdrehen
Nach deinem letzten Lauf wurde am Prototyp von Hand korrigiert:

- **`strandElongation` steht auf 1, `grainEdgeSharpness` auf 0,
  `grainNoiseAmount` auf 0.** Die längliche Kornform wurde vom Nutzer
  **abgelehnt** — bei 3,0/0,78 sah der Strang aus wie ein Fischgrätmuster aus
  harten Strichen. Die Ellipsen-Mechanik **bleibt im Code**, aber der
  Default ist rund und weich. **Dreh diese Werte nicht wieder hoch.**
- Im Fragment-Shader sind zwei Grenzwerte so gesetzt, dass
  `grainEdgeSharpness = 0` **exakt** dem Zustand vor der Formänderung
  entspricht (weicher Ausklang ab 0,18, keine Alpha-Kompensation). Diese
  Kalibrierung muss erhalten bleiben.
- `OPPONENT_SPLIT_BINDING` wurde eingeführt, weil der Gegner im Split gar
  keine Farbe mehr hatte. **Diese Konstante entfällt mit §2 wieder** — siehe
  dort.

## 1. Lage

Der Grundlook stimmt. Runde 10 hat drei Schwerpunkte:
**vereinfachen** (§2), **wieder zum Leuchten bringen** (§3–§5) und den
**Hintergrund von der Helix entkoppeln** (§6). Dazu kommt ein neues
Gestaltungsthema: leere Profile sollen nicht mehr leer wirken (§7).

## 2. Fight-Split wird für Athlet und Gegner IDENTISCH

**Entscheidung des Nutzers:** Der Fight-Split sieht künftig für beide
Varianten gleich aus — und zwar so, **wie er heute beim Athleten aussieht**.
Begründung: weniger Sonderfälle, bessere Wiedererkennung.

- Die variantenabhängige Farbbindung im Split **entfällt vollständig**
  (inklusive `OPPONENT_SPLIT_BINDING`, der Luminanz-Modulation für den Gegner
  und der variantenabhängigen Aufhellung).
- **Die Dämpfung sinkt auf höchstens 0,1** (heute 0,25) — der Nutzer will die
  Kategoriefarben deutlich kräftiger sehen. Setz den Default auf 0,1 und
  begrenze den Regler nach oben entsprechend, damit niemand versehentlich
  zurückfällt.
- Der Split-Modus ist damit **variantenblind**: `variant` darf die Farbe im
  Split an keiner Stelle mehr beeinflussen.
- **Achtung, das räumt auf:** Der „Split-Tausch" aus früheren Runden und alle
  daraus entstandenen Sonderpfade fallen ersatzlos weg. Räum sie aus dem Code,
  statt sie zu neutralisieren — auch im SVG-Zwilling.
- Der **Vollständigkeits-Modus behält** seine Unterscheidung: Athlet farbig,
  Gegner monochrom/chrom.

## 3. Der große Puls muss wieder stark werden

Der Nutzer: „Der Puls-Blitz war die Versionen davor stärker, das soll wieder
so sein, aktuell sieht er zu schwach aus."

**Ursache:** In einer früheren Runde wurde der Großpuls mit einem Radial- und
einem Winkelgate versehen (`radialGate`, `pulseAngleGate`). Er erfasst dadurch
nur noch Körner nahe der Mittellinie und nur einen Ausschnitt des Umfangs —
genau das macht ihn schwach.

- **Der Großpuls bekommt seine volle Wucht zurück:** Er darf wieder die
  komplette Partikelschale über den vollen Umfang erfassen. Nimm die Gates für
  **diesen einen Effekt** heraus oder öffne sie so weit, dass sie praktisch
  nicht mehr greifen.
- Die **kleinen Wanderfunken behalten ihre Gates** — dünn und kurz ist dort
  gewollt. Der Kontrast zwischen beiden ist der Punkt.
- Der neue Lichtblitz bleibt wie er ist.
- Gegenprobe: Der Puls darf trotz voller Breite **keinen Weißbrand** erzeugen
  (Zahl reinweißer Pixel bleibt 0).

## 4. Fokussiertes Segment: es soll leuchten, nicht absaufen

Heute wird beim Fokus vor allem **abgedunkelt** (alle fremden Rubriken um 58 %
Richtung Tiefenfarbe), während das gewählte Segment nur um ~16 % aufgehellt
wird. Ergebnis: Das Bild wird insgesamt dunkler, statt dass das Segment
hervorsticht — der Nutzer nennt es „viel zu dunkel".

- **Das fokussierte Segment leuchtet deutlich:** klar heller als der
  ungedimmte Normalzustand, mit hellerem Kern der Körner (nicht nur eine
  hellere Grundfarbe). Richtwert: sichtbar über dem Normalzustand, nicht nur
  über dem gedimmten Rest.
- **Das Abdunkeln der übrigen Rubriken wird zurückgenommen**, damit die Szene
  als Ganzes nicht absäuft.
- Für den **Gegner** bleibt die Aufhellung **graustufig** (keine Buntfarbe), er
  soll monochrom bleiben.
- Der Effekt muss in **beiden Themes** tragen: im Light darf „leuchten" nicht
  bedeuten, dass das Segment weiß ausbrennt.

## 5. Farbe und Blitze pro Variante

### 5.1 Athlet, Vollständigkeit: mehr Farbe
Der Strang wirkt zu blass.
- **„Mehr Farbe" heißt mehr Sättigung, nicht mehr Helligkeit.** Der
  Athlet läuft im Dark additiv und steht dicht an der Weißbrand-Grenze; ein
  höherer Alpha-Wert würde die Körner Richtung Weiß drücken und die Farbe
  **verlieren** statt verstärken.
- Prüf gezielt die Stelle, an der die Grundhelligkeit des Athleten im Dark
  stark gedämpft wird (Faktor ~0,12), und die Rückseiten-Mischung: Beides
  entzieht dem Strang Farbigkeit. Such den Weg, der die Chroma anhebt, ohne die
  Luminanz mitzuziehen.
- **Messen:** Chroma der Strangmitte vorher/nachher dokumentieren, Zahl
  reinweißer Pixel bleibt 0.

### 5.2 Gegner-Blitze: Dark schwarz, Light weiß
- **Dark + Gegner + Vollständigkeit: Die Blitze sind heute weiß, sollen aber
  schwarz sein.** Zwei Ursachen, beide beheben:
  1. Der Puls **vergrößert** die Körner und der Fragment-Shader **hellt**
     zusätzlich auf — beides wirkt der Verdunkelung entgegen. Nimm beides für
     den Dark-Gegner deutlich zurück.
  2. **Die Verdunkelung wird heute pro Korn radial angewendet** (dunkles
     Zentrum im einzelnen Sprite, helle Sprite-Ränder). Das war als „Blitz in
     der Mitte dunkel, an den Rändern heller" gemeint — bezogen auf den
     **Verlauf des Blitzes entlang der Helix**, nicht auf jedes einzelne Korn.
     Stell das um: Der Blitzkern (dort, wo der Blitz gerade steht) ist dunkel,
     zu seinen **Enden hin** läuft er weich aus. Das einzelne Korn wird als
     Ganzes eingefärbt.
- **Light + Gegner + Vollständigkeit: Der Strang ist gut, aber die Blitze
  müssen deutlich weiß sein.** Dort ist die Invertierung korrekt abgeschaltet,
  der helle Blitz ist aber zu schwach, um auf dem dunklen Strang aufzufallen.
  Heb ihn an, bis er klar als weißer Blitz lesbar ist.

## 6. Hintergrund von der Helix entkoppeln

### 6.1 Die Partikel dürfen sich nicht mit der DNA drehen
**Ursache gefunden:** Das Bokeh liegt im selben rotierenden Objekt wie die
Helix — es macht deshalb exakt deren Drehung mit und wirkt wie eine
aufgeklebte Tapete.

- **Nimm die Hintergrundpartikel aus der rotierenden Gruppe heraus** und gib
  ihnen eine **eigene Bewegung**.
- **Nah und Fern bewegen sich unterschiedlich** — verschiedene Richtungen,
  verschiedene Geschwindigkeiten, beide **deutlich langsamer** als die Helix.
  Eine sanfte Drift genügt; es soll nach eigenem Leben aussehen, nicht nach
  Rotation.
- **Die meisten Partikel bleiben hinter dem Strang.** Nur wenige dürfen im
  Vordergrund liegen, und die dann klein und stark unscharf. Nichts darf den
  Kern der Helix optisch verschmutzen.
- Die Sichtbarkeitswerte aus der letzten Runde (Light-Theme) bleiben erhalten.

### 6.2 Lava: mehr Blur, weniger erkennbare Form
Farben und Deckkraft passen dem Nutzer, **die Formen sind zu deutlich**.
- Die Blobs sollen wie ein **bewegter, weicher Schleier** wirken, nicht wie
  abgegrenzte Tropfen. Deutlich stärkere Weichzeichnung, weichere Ränder.
- Die Bewegung bleibt (lange Bahnen, organische Drift, langsames Morphen) —
  nur die Kante verschwindet.
- Setz den Schärfe-Regler-Default entsprechend niedriger und prüfe, dass auch
  bei hohem Reglerwert keine harten Kanten entstehen.

## 7. Leere Profile sollen nicht leer wirken (neues Thema)

Der Nutzer: „Ein Profil mit wenig Profilstärke sieht so leer aus, denn außer
den gedrehten Röhren sieht man nichts." Noch nicht erreichte Prozente sollen
**teilweise als leichte DNA-Stränge sichtbar** sein. Eigene Ideen sind
ausdrücklich erwünscht — hier ist die Richtung:

### 7.1 Drei Sichtbarkeitsstufen für offene Sprossen
Statt „Stummel oder fast nichts" bekommen offene Sprossen drei Zustände
(deterministisch gehasht, stabil über Re-Renders):
1. **Bauplan** — die Sprosse ist **durchgehend** als sehr feine, blasse
   Punktkette sichtbar. Sie zeigt, wo später etwas entsteht, und gibt der
   Helix ihre volle Struktur.
2. **Stummel** — wie heute: von einer oder beiden Seiten kommend,
   unterschiedlich weit ragend, mit sichtbarer Lücke.
3. **Andeutung** — nur vereinzelte Staubkörner auf der Achse.

### 7.2 Die Mischung ist dynamisch — das ist der Kern der Idee
Der Anteil der **Bauplan**-Sprossen läuft **gegenläufig zur Profilstärke**:
- Bei **niedriger** Profilstärke überwiegt der Bauplan (Richtwert ~50 % der
  offenen Sprossen) — ein leeres Profil zeigt die vollständige DNA als
  Potenzial und wirkt nie leer.
- Bei **hoher** Profilstärke fällt er auf ~15 %, damit die beantworteten
  Sprossen die Bühne bekommen und das Bild nicht überfüllt wirkt.
- Der Übergang ist stufenlos; die Zuordnung einer einzelnen Sprosse bleibt
  stabil (eine Sprosse springt beim Wachsen nicht zwischen den Stufen).

### 7.3 Ruhiges Eigenleben
- Die offenen Sprossen **atmen sehr langsam**: eine unregelmäßige,
  versetzte Helligkeitswelle über 6–10 Sekunden. Kein Blitz, kein Funkeln —
  nur so viel, dass die Fläche lebt.
- **Sie bleiben klar als „offen" lesbar:** farblos, deutlich blasser und
  feiner als beantwortete Sprossen. Der Unterschied beantwortet/offen darf
  nicht verwischen — das ist die Kernaussage des Modus.
- Beim Beantworten verdichtet sich der Bauplan zur vollen Sprosse (die
  bestehende Wachstums-Choreografie greift dafür).

### 7.4 Grenzen
- **Kein zusätzliches Punktbudget:** Der Bauplan ersetzt Körner, die heute für
  Stummel verwendet werden — die Gesamtzahl bleibt gleich. Der Worst Case
  (alle 60 Fragen offen) darf das Budget nicht sprengen.
- Bei hoher Profilstärke dürfen sich Bauplan-Sprossen und beantwortete
  Sprossen **nicht berühren** (dieselbe Abstandsregel wie beim Sprossen-Knick).
- Der SVG-Zwilling zieht die drei Stufen nach.

## 8. Budget und Konsistenz

- **≤ 8 Draw Calls, ≤ 45.000 Punkte, max. 4 `Points`-Objekte**, keine
  Mesh-Draws, `dpr={[1, 2]}`. Zuletzt gemessen: ~40.800 Punkte bei 25 FPS.
- Wenn die Hintergrundpartikel eine eigene Gruppe brauchen: **kein
  zusätzliches `Points`-Objekt** — die Gruppierung im Szenengraph ist frei,
  die Zahl der Punktwolken nicht.
- **SVG-Zwilling mitziehen** bei: §2 (Split identisch), §7 (drei Stufen).
- Alle Schutzpfade (Viewport, Visibility, Kontextverlust → Glyph,
  reduced-motion → Glyph) erhalten und erneut testen; alles `dispose()`-en.

## 9. Dev-Seite

- Neue Regler in die **bestehenden** Gruppen, Labels ≤ 14 Zeichen:
  „Form & Partikel" (Bauplan-Anteil), „Hintergrund" (Drift-Tempo nah, Drift
  fern), „Energie & Blitze" (Fokus-Leuchtkraft).
- **Die Regler für Streckung, Kantenschärfe und Rausch-Anteil bleiben mit
  ihren aktuellen Defaults (1 / 0 / 0) erhalten** — nicht entfernen, nicht
  hochsetzen.
- Final gewählte Werte werden Defaults (im Bericht nennen).

## 10. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber;
  Spiegel-Dateien per SHA-256 byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- **Messwerte statt Behauptungen** (in allen vier Kombinationen aus Variante
  und Theme): hellstes und dunkelstes Korn, Median, Kontrast gegen den Grund,
  Zahl reinweißer Pixel (Ziel 0), Punkte, Draw Calls, FPS.
- Aufnahmen in `report/`:
  - Fight-Split **Athlet und Gegner nebeneinander**, gleiche Kamera: die
    Darstellung ist identisch.
  - Großpuls im Moment der größten Ausdehnung — sichtbar kräftiger als zuvor,
    Vergleichsbild aus der Vorrunde daneben.
  - Fokussiertes Segment: leuchtet klar hervor, die Umgebung ist **nicht**
    abgesoffen — Dark und Light, Athlet und Gegner.
  - Gegner Dark: **schwarzer** Blitz mit weich auslaufenden Enden.
    Gegner Light: **weißer**, deutlich erkennbarer Blitz.
  - Hintergrund: Bildfolge über ~10 s, aus der hervorgeht, dass Nah- und
    Fernpartikel sich **anders** bewegen als die Helix und **anders als
    zueinander**.
  - Lava: weicher Schleier ohne erkennbare Tropfenkanten.
  - **Leeres Profil** (Preset „Unbekannt" bzw. sehr niedrige Profilstärke):
    die DNA ist als vollständige Struktur erkennbar, wirkt nicht leer — und
    daneben ein Bild bei hoher Profilstärke, das zeigt, dass der Bauplan dort
    zurücktritt.
- `REPORT.md` und `HANDOFF.md` aktualisieren. Danach STOPPEN — keine
  Integration nach Tidal.
