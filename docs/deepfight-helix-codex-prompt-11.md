# Auftrag: DeepFight-Helix — Runde 11: Feinabstimmung Bauplan, Blitze, Farbbalance

Du überarbeitest den Prototyp in `D:\DeepFight-Helix`. Dieser Text + zwei zu
lesende Dateien sind alles — kein früherer Chat nötig.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— **§0 (Arbeitsregeln) und §0b (Skills) gelten unverändert und absolut**
(`D:\Tidal-Athletics\` nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben, Spiegel-Dateien byte-identisch, Props nur
ergänzen, Mobile-/Fallback-Mechanik erhalten). Danach `REPORT.md` und den
aktuellen Code lesen.

### 0.1 Änderungen von außen — NICHT zurückdrehen
- **`strandElongation = 1`, `grainEdgeSharpness = 0`, `grainNoiseAmount = 0`.**
  Die längliche Kornform ist vom Nutzer **abgelehnt**. Die Mechanik bleibt im
  Code, die Defaults bleiben rund und weich. Auch die Shader-Kalibrierung, die
  `grainEdgeSharpness = 0` exakt dem Zustand davor gleichsetzt, bleibt.
- **Neu im Dev-Panel: die Sektion „Werte übernehmen"** mit einem Knopf, der
  alle aktuellen Reglerstellungen als Liste ausgibt und in die Zwischenablage
  kopiert (`copySettings`, `settingsDump`, CSS-Klasse `.settings-dump`).
  **Diese Sektion erhalten** — sie ist das Werkzeug, mit dem der Nutzer
  abgestimmte Werte an das Projekt zurückgibt.
- Die klappbaren `ControlSection`-Gruppen, das sticky Panel und das kompakte
  `.tuning-grid` (Labels ≤ 14 Zeichen) bleiben wie sie sind.

## 1. Lage

Runde 10 sitzt gut. Es bleiben vier gezielte Korrekturen — keine davon ist ein
Umbau.

## 2. Bauplan-Sprossen im Light-Theme: blasser und weicher

Die angedeuteten Zwischenstreben (die noch offenen Sprossen) sind im
**Light-Theme zu dunkel** und wirken **zu klar und scharf** gegenüber allen
anderen Bestandteilen der Helix. Sie ziehen dadurch mehr Aufmerksamkeit auf
sich als die tatsächlich beantworteten Sprossen — genau verkehrt herum.

- **Betrifft im Light beide Modi:** Fight-Split **und** Vollständigkeit
  (dort besonders beim Athleten).
- **Deutlich blasser:** Sie dürfen im Light nur eine zarte Andeutung sein.
  Prüfe, ob die Umkehrung der Tiefen-/Grundfarbe für das Light-Theme hier zu
  stark greift und die offenen Sprossen dadurch dunkler geraten als die
  beantworteten.
- **Deutlich weicher:** Ihre Körner sollen **unschärfer** wirken als die
  restlichen Bestandteile — weicherer Ausklang, kein harter Kern, gerne auch
  minimal größer bei geringerer Deckkraft. Der Eindruck soll „aus dem Nebel
  angedeutet" sein, nicht „fein gezeichnet".
- **Die Rangfolge muss stimmen:** beantwortete Sprossen am präsentesten,
  Stränge dahinter, offene Sprossen am zurückhaltendsten — in **beiden**
  Themes.
- Im Dark-Theme passt die aktuelle Abstimmung; ändere sie dort nicht.

## 3. Blitze

### 3.1 Gegner im Dark: noch dunkler
Die invertierten Blitze im Vollständigkeits-Modus gehen in die richtige
Richtung, sind dem Nutzer aber **noch nicht dunkel genug**. Zieh den dunklen
Kern weiter herunter — er darf im Zentrum des Blitzverlaufs praktisch schwarz
werden, während die Enden weich auslaufen (die Verlaufsform aus Runde 10
bleibt).

### 3.2 Der lange sporadische Blitz: kräftiger
Der Lichtblitz, der gelegentlich auftaucht und ein langes Stück durch die DNA
läuft, **darf spürbar kräftiger wirken** — heller und präsenter, ohne die Form
des großen Pulses anzunehmen. Er bleibt der unregelmäßige, „echte" Blitz.

### 3.3 Die kleinen Zwischenblitze: etwas sichtbarer
Die kurzen Funken zwischen den großen Ereignissen dürfen **ein kleines bisschen
mehr** zu sehen sein — eine leichte Anhebung, kein Sprung. Ihr Charakter (dünn,
schnell, nah an der Mittellinie) bleibt unverändert.

**Für alle drei:** Der Abstand zwischen den Effekten muss erhalten bleiben —
großer Puls am wuchtigsten, Lichtblitz kräftig aber unregelmäßig, Funken klein.
Und: Zahl reinweißer Pixel bleibt 0.

## 4. Athlet im Dark: die violette Komponente fehlt

Im Dark-Theme wirkt der Athleten-Strang überwiegend grün/cyan — **der violette
Anteil fehlt praktisch ganz**. Er soll **in derselben Intensität** erscheinen
wie der cyane. Im Light-Theme stimmt das Verhältnis bereits; dort nichts ändern.

Mögliche Ursachen, die du prüfen sollst:
- Der Strangverlauf läuft von `--accent` nach `--accent-2` und ist zwischen den
  beiden Strangseiten **gespiegelt**. Wird die vom Betrachter abgewandte Seite
  stark abgedunkelt, sieht man überwiegend eine Verlaufsrichtung — und damit
  überwiegend eine Farbe.
- Violett hat gegenüber Cyan die **deutlich geringere Eigenhelligkeit**. Bei
  additivem Blending und der niedrigen Grundhelligkeit des Athleten im Dark
  verschwindet der dunklere Ton, während der hellere dominiert.

Gesucht ist ein Ausgleich, der **beide Farben gleich präsent** macht — etwa
indem die Verlaufskurve nicht linear läuft, sondern dem violetten Bereich mehr
Weg gibt, und/oder indem seine Luminanz gezielt angehoben wird, ohne ihn
Richtung Weiß zu ziehen (siehe Weißbrand-Grenze). **Der cyane Anteil darf dabei
nicht schwächer werden.**

**Nachweis:** Ein Screenshot des Athleten im Dark, in dem beide Farben über die
Helixlänge etwa gleich stark vertreten sind — plus die gemessenen Chroma- und
Luminanzwerte an je einer Stelle im cyanen und im violetten Abschnitt.

## 5. Budget und Konsistenz

- **≤ 8 Draw Calls, ≤ 45.000 Punkte, max. 4 `Points`-Objekte**, keine
  Mesh-Draws, `dpr={[1, 2]}`.
- **SVG-Zwilling mitziehen** bei §2 (Bauplan im Light) und §4 (Farbbalance).
- Alle Schutzpfade (Viewport, Visibility, Kontextverlust → Glyph,
  reduced-motion → Glyph) erhalten und erneut testen; alles `dispose()`-en.

## 6. Dev-Seite

- Falls für §2 oder §3 neue Regler nötig sind: in die **bestehenden** Gruppen
  einsortieren, Labels ≤ 14 Zeichen.
- **Die Sektion „Werte übernehmen" bleibt** (§0.1).
- Final gewählte Werte werden Defaults (im Bericht nennen).

## 7. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber;
  Spiegel-Dateien per SHA-256 byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- Messwerte wie gehabt in allen vier Kombinationen aus Variante und Theme:
  hellstes und dunkelstes Korn, Median, Kontrast gegen den Grund, Zahl
  reinweißer Pixel (Ziel 0), Punkte, Draw Calls, FPS.
- Aufnahmen in `report/`:
  - **Light-Theme mit teilbeantwortetem Profil**, Vollständigkeit und Split:
    die offenen Sprossen sind klar die zurückhaltendsten Elemente im Bild —
    blass und weich, nicht schärfer als der Rest.
  - Gegner Dark: der invertierte Blitz ist im Kern praktisch schwarz.
  - Der lange Lichtblitz in voller Ausprägung, daneben ein Frame mit kleinen
    Funken — der Größenunterschied zwischen beiden bleibt erkennbar.
  - Athlet Dark über die volle Helixlänge: cyaner und violetter Abschnitt
    gleich präsent, mit den gemessenen Werten aus §4.
- `REPORT.md` und `HANDOFF.md` aktualisieren. Danach STOPPEN — keine
  Integration nach Tidal.
