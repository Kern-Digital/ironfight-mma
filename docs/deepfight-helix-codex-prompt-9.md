# Auftrag: DeepFight-Helix — Runde 9: Kornform, Blitz-Reparatur, Theme-Trennung

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

## 1. Diese Konfiguration ist abgenommen — als Defaults übernehmen

Der Nutzer hat den Zustand **Vollständigkeit + Athlet + Dark** ausdrücklich als
gut bezeichnet. **Übernimm diese Reglerwerte als neue Defaults** (im Renderer
UND in `app/page.tsx`), damit sie nicht wieder verloren gehen:

| Bereich | Regler | Wert |
|---|---|---|
| Energie & Blitze | Puls-Frequenz | 1,0× |
| | Gruppengröße | 3 |
| | Pausenlänge | 2,00 s |
| | Sprossen-Stich | 0,80× |
| | Blitz-Stärke | 1,20× |
| | Blitztempo | 3,3× |
| | Blitzbreite | 0,42× |
| | Austritt | 0 s |
| | Funkeln | 1,40 |
| | Glow | 1,30 |
| Fight-Split | Dämpfung | 0,25× |
| | Übergang | 5,0 Sprossen |
| Hintergrund | Lava-Tempo | 0,70× |
| | Lava-Deckkraft | 0,45× |
| | Lava-Schärfe | 0,70× |
| | Fernpartikel | 80 |
| | Mittendichte | 0,90× |
| | Nah-Anteil | 0,50× |
| | Split-Zoom | 13,30 |
| Form & Partikel | Neigung | 5° |
| | Strangdichte | 30 / Schritt |
| | Sprossendichte | 180 / Stab |
| | Streuung | 1,35× |
| | Innen/Außen | 1,40× |
| | Stummel-Varianz | 0,55× |
| | Knick-Anteil | 0,25× |
| | Knick-Stärke | 0,020 |
| | Geisterkörner | 315 |
| | Wobbeln | 1,00 |

Telemetrie in diesem Zustand: 4 Draw Calls, 0 Dreiecke, **41.644 Punkte**, 24 FPS.
**Das Budget ist damit fast ausgereizt** — alle Forderungen unten müssen ohne
nennenswerte Punktzunahme umgesetzt werden.

## 2. Vorbefunde: fünf Fehler, keine Geschmacksfragen

Der Ist-Stand wurde vor diesem Auftrag im Detail vermessen. Diese fünf Punkte
sind der Grund, warum mehrere Beschwerden über Runden hinweg nicht verschwinden.
**Lies sie, bevor du irgendetwas anfasst.**

1. **Ein Korn ist ein exakt runder, achsparalleler Sprite** — die Form ist im
   Fragment-Shader hart als Kreis kodiert und seit Runde 4 unverändert. Die
   letzten drei Runden haben nur Position, Skalar-Größe und Alpha gedreht.
   „Länglich/organisch" ist so **prinzipiell unerreichbar**. Siehe §4.
2. **Die Blitz-Invertierung des Gegners hat kein Gate auf den Blitztyp.**
   `vPulse` ist eine Sammelgröße aus Großpuls, allen Wanderköpfen, dem
   Sprossen-Stich **und dem Wachstumsleuchten**. Alles davon wird geschwärzt.
   Zusätzlich plättet ein `clamp(…,0,1)` das weiche Profil zu einem Plateau, das
   Mischziel ist faktisch reines Schwarz und das Alpha wird auf 0,88 gezwungen.
   Siehe §3.
3. **Im Dark-Gegner ist jede Blitz-Aufhellung abgeschaltet** (der Faktor
   `(1.0 - uDarkOpponent)` setzt sie auf exakt 0). Deshalb sind dort *alle*
   Blitze schwarz — es existiert kein heller Anteil mehr.
4. **Hintere Körner werden nach `--bg-0` gemischt** — im Light ist das
   annähernd Weiß. Ein hinteres Korn erreicht dort **3 von 255** Codewerten
   Unterschied zum Grund (vorne: 72). Das ist die Ursache für „der hintere
   Strang ist zu weiß". Betrifft strukturell **nur den Athleten**, weil beim
   Gegner dieser Mix von der Chrom-Berechnung überschrieben wird. Siehe §7.
5. **Die Light-Korrektur der Vignette aus Runde 8 hat das falsche Element
   getroffen.** Der Div mit der Klasse `deepfight-helix__vignette` ist in
   Wahrheit die Ambient-Fläche *unter* der Lava. Die echte Vignette ist ein
   **klassenloser Inline-Div mit zIndex 3 über dem Canvas**, der ohne
   Theme-Zweig auf 72 % der Bühnenfläche bis zu 78 % Richtung `--bg-0` zieht —
   und damit Lava **und** Bokeh gemeinsam wegradiert. Siehe §8.

## 3. Blitze: Reparatur und ein echter Lichtblitz

### 3.1 Den Invertierungs-Fehler beheben
- **Gate auf den Blitztyp:** Führe die Blitzanteile getrennt (Großpuls,
  Wanderköpfe, Sprossen-Stich, Wachstumsleuchten) und invertiere **nur die
  Anteile, die invertiert werden sollen**. Das **Wachstumsleuchten neu
  beantworteter Sprossen darf NIE geschwärzt werden** — es ist die
  Erfolgsmeldung des Systems.
- **Weiches Profil statt Plateau:** Der Nutzer will „in der Mitte schwarz, an
  den Seiten etwas Helligkeit behalten". Ersetze das harte `clamp` durch ein
  **radiales/längs verlaufendes Profil**: im Kern maximal dunkel, zu den
  Rändern des Blitzes hin weich auslaufend. Kein deckender schwarzer Balken.
- **Mischziel abmildern:** Nicht mehr auf faktisch reines Schwarz mischen und
  das Alpha nicht hart auf 0,88 zwingen — beides zusammen erzeugt den
  Vollton-Balken.
- **Der Großpuls hat kein Breiten-/Winkelgate** (die Wanderblitze haben eines).
  Deshalb schwärzt er die komplette Partikelschale über den vollen Umfang. Gib
  ihm ein entsprechendes Gate.
- **Im Dark-Gegner muss wieder ein heller Anteil möglich sein** — heb die
  Nullsetzung der Aufhellung so weit auf, dass ein Blitz einen Kern **und**
  eine dunkle Kontur haben kann.
- **Im Light-Theme klemmen die Blitze auf Weiß**, weil die Chrom-Basis des
  Gegners mit Faktor ~2,34 bereits an der Grenze liegt. Deckle die Chromspitzen,
  damit ein Blitz dort wieder als Form und nicht als weiße Fläche erscheint.

### 3.2 Es ist zu ruhig — und ein heller Lichtblitz fehlt
- Die Gruppen aus Runde 7 bleiben im Prinzip, kommen aber **häufiger**: kürzere
  Stillephasen, sodass insgesamt mehr passiert. Die Stille selbst bleibt
  erhalten — es darf nicht wieder Dauerbetrieb werden.
- **NEU: ein heller Lichtblitz**, fast so stark wie der große Puls, aber
  **sporadisch und unregelmäßig** — wie ein echter Blitz: fängt an einer
  zufälligen Stelle plötzlich an, läuft **mal länger, mal kürzer**, hört
  wieder auf. Kein festes Intervall, keine feste Länge, kein Durchlaufen der
  ganzen Helix wie beim Puls.
- Dieser Lichtblitz ist der neue „Wow"-Moment zwischen den ruhigen Phasen und
  muss deutlich vom Großpuls (breit, langsam, volle Länge) und von den kleinen
  Funken (dünn, kurz, schnell) unterscheidbar sein.
- Beim **Dark-Gegner** erscheint auch dieser Blitz invertiert (dunkler Kern,
  helle Ränder nach §3.1).

## 4. Strangkörner: die Form ändern, nicht die Größe

**Das ist der wichtigste Punkt des Auftrags.** Der Nutzer fordert zum vierten
Mal „größere, längliche, organisch aussehende Formen". Bisher wurde ausschließlich
an Position, Größe und Alpha gedreht — die Form selbst ist ein perfekter Kreis
im Fragment-Shader.

- **Elliptische Sprite-Maske mit Ausrichtung entlang des Strangs.** Ein
  `gl_PointSize`-Sprite ist immer quadratisch und achsparallel; die Streckung
  muss deshalb **im Fragment-Shader** über eine elliptische Maske passieren,
  deren Achse pro Korn aus der Bildschirmrichtung des Strangs kommt.
- **Kein neues Attribut nötig:** Die Helix ist analytisch. Die Tangente lässt
  sich im Vertex-Shader direkt aus den vorhandenen Attributen für Fortschritt
  und Strangseite bilden — **genau dieses Muster steht bereits im Shader der
  Austrittsfunken derselben Datei**. Für die Sprossen gilt dasselbe (deren
  Achse folgt ebenfalls analytisch aus dem Fortschritt).
- **Bildschirmprojektion ohne neues Uniform:** Tangente in den View-Raum, zwei
  Clip-Punkte projizieren, Differenz normalisieren; das Seitenverhältnis steckt
  bereits in der Projektionsmatrix.
- **ACHTUNG, häufigster Fehler:** `gl_PointCoord.y` läuft **nach unten**, NDC-y
  nach oben. Ohne Vorzeichenkorrektur kippen alle Körner spiegelverkehrt und das
  Ergebnis sieht aus wie ein Fischgrätmuster quer zum Strang — schlechter als
  jetzt.
- **Flächengleich strecken, sonst kommt der Weißbrand zurück:** Bei Streckfaktor
  k die Punktgröße mit √k multiplizieren und die kurze Achse durch √k teilen.
  **Richtwert k = 3:** aus einem ~4,9-px-Korn wird ~8,4 px lang und ~2,8 px
  dick — bei exakt gleicher additiver Energie.
- **Gegen Verkürzung absichern:** Läuft der Strang in die Bildtiefe, muss das
  Korn automatisch wieder rund werden (Dämpfung über die Länge der projizierten
  Tangente). Das ist gleichzeitig der Schutz gegen `normalize()` auf einem
  Nullvektor — sonst flackern ganze Kornbänder.
- **k nicht über 4:** Die Gruppe rotiert dauerhaft, der Bildschirmwinkel jedes
  Korns ändert sich pro Frame; zu starke Streckung erzeugt ein sichtbares
  Umklappen im Rotationstakt.
- **Kurze Achse nicht unter ~2 CSS-px**, sonst kribbelt der Strang bei
  Gerätepixelverhältnis 1. Staubkörner bleiben rund.
- **Die Kante muss schärfer werden, sonst bleibt die Ellipse unsichtbar.** Der
  heutige weiche Ausklang macht rund 40 % der Spritefläche zu fast
  transparentem Dunst und verschmiert jede Formaussage zu einem runden Fleck.
  Zieh den Ausklang deutlich kürzer — **und miss danach neu**, denn eine
  schärfere Kante erhöht die mittlere Deckung und damit die additive Summe,
  auch wenn die Spritegröße gleich bleibt.
- **Für „größer" ohne mehr Punkte:** Öffne die untere Klemmgrenze der
  Strangdichte (heute 26) nach unten. Weniger Samples bei entsprechend größeren
  Körnern halten die Deckung konstant und erlauben spürbar größere Formen.
  Unterhalb von etwa 16 Körnern pro Schritt reißt der Strang perlenkettenartig
  auf — dort ist die Grenze.
- **Organik kommt aus Korrelation, nicht aus Zufall:** Die Korngröße ist heute
  reines Weißrauschen pro Korn, deshalb wirkt der Strang homogen. Moduliere
  Größe und Alpha zusätzlich mit **tieffrequentem Rauschen entlang des
  Fortschritts und des Umfangswinkels** (2–3 Oktaven, aus vorhandenen Attributen
  berechenbar). Erst dadurch entstehen dickere und dünnere Passagen.
- **Bokeh und Austrittsfunken bleiben rund** — der Fragment-Shader ist ein
  gemeinsamer String für alle vier Punktwolken; neutralisiere die Ellipse dort.
- **SVG-Zwilling nachziehen:** Dort werden die Stränge bereits als
  Strich-Kapseln gezeichnet — die Strichlänge entsprechend anheben, damit beide
  Darstellungen formgleich bleiben.

## 5. Theme- und Varianten-Trennung (Vorbedingung für §6–§8)

Die Wünsche sind **gegenläufig**: Der Gegner soll im **Dark heller** und im
**Light dunkler** werden. Heute hängen Farbmischung, Alpha, Blending und
Kern-Boost an gemeinsamen Schaltern für alle vier Punktwolken und beide
Varianten. **Ohne saubere Auftrennung führt jede punktuelle Zahlenänderung zum
nächsten Fehlversuch.**

- Führe eine **eigene Kennung für den Fall „Light + Gegner"** ein (analog zur
  bereits vorhandenen für „Dark + Gegner").
- Führe eine **eigene Tiefenfarbe** ein (siehe §7) statt überall `--bg-0` zu
  verwenden.
- **Differenziere pro Punktwolke:** Was für das Bokeh im Light richtig ist,
  ist für Strang und Sprossen falsch.
- **Neue Tokens sind ein Scharfschalter:** Jeder zusätzlich verwendete Token
  muss in die Token-Liste des Renderers aufgenommen **und in beiden
  Theme-Blöcken deklariert** sein. Ein Token, das nur in einem Block steht,
  fällt **stillschweigend** auf einen Elternwert zurück, ohne dass die
  Bereitschaftsprüfung anschlägt. Hex/rgb bleiben verboten (der Abnahme-Scan
  prüft darauf).
- Nutzbar und bereits geladen, aber ungenutzt: `--text-1` und `--bg-1`.
  `--text-2` (im Light ein mittleres Grau) wäre der ideale weiche Mischpartner
  und muss dafür in die Liste aufgenommen werden.

## 6. Gegner: Dark heller, Light dunkler

### 6.1 Dark: hellere, graustufige DNA
- Deutlich heller als heute, mit **mehreren unterscheidbaren Graustufen** statt
  eines dunklen Einheitsbreis (mindestens drei erkennbare Hell-Dunkel-Zonen
  entlang eines Strangs).
- **Nicht auf additives Blending umstellen** — die dunklen Blitze aus §3
  funktionieren nur unter Normal-Blending, weil additiv nicht unter den Grund
  gehen kann. Die Aufhellung kommt über **hellere Tokens und höheres Alpha**.
- **Zielwert:** Kontrast der Körner gegen `--bg-0` im Dark **mindestens 2,5:1**,
  gemessen, nicht geschätzt.
- **Vorsicht:** Unter Normal-Blending schlägt jede Aufhellung direkt durch —
  ohne die weiche Sättigung des additiven Athleten. Zu großzügig aufgehellt
  kippt es in flächiges Silber; der Kontrast muss aus den Stufen kommen, nicht
  aus einem einzelnen höheren Wert.

### 6.2 Light: dunklere DNA mit schwarzen Elementen
- Im Light muss der Gegner **deutlich dunkler** werden; **einzelne fast schwarze
  Körner dürfen einfließen** (Richtwert 10–14 % der Körner, Rampe über mehrere
  Stufen).
- **Nicht flächig schwarz:** Sonst gehen Chromfaltung, Tiefenstaffelung und die
  Sprossenknicke verloren — es soll eine dunkle DNA mit Binnenzeichnung sein,
  keine Silhouette.
- Achtung: Die Farbfunktion liefert auch die Ankerfarbe für Fokuskarte und
  Leader-Linie. Prüfe, dass die Karte im Light nicht mit ins Schwarze kippt.

## 7. Der hintere Strang darf im Light nicht verschwinden

- **Ursache** (§2.4): Die Tiefenstaffelung mischt hintere Körner nach `--bg-0`
  — im Dark ist das dunkel und richtig, im Light nahezu weiß und damit
  unsichtbar (3 von 255 Codewerten Unterschied, bei einem theoretischen Maximum
  von 53 gegenüber 244 vorne).
- **Fix:** Eigene **Tiefenfarbe** einführen — im Dark weiterhin `--bg-0`, im
  Light ein **dunkler** Mischpartner (`--text-2`). Dann tritt der hintere Strang
  im Light zurück, ohne zu verschwinden, und die Tiefe wird zusätzlich über die
  bereits vorhandene Alpha-Staffelung getragen.
- Gilt für **Stränge und Sprossen**. Offene Sprossen sind der Extremfall: Sie
  stehen im Light auf einem hellen Token und sind nach dem Rückseiten-Mix
  faktisch unsichtbar.
- **Im Split ist es schlimmer**, weil der Athlet dort zusätzlich um ~12 %
  aufgehellt wird — im Dark ein Kontrastgewinn, im Light ein Kontrastverlust.
  Mach diesen Faktor theme-abhängig.
- **Gleiche Fehlerklasse an zweiter Stelle:** Auch die Fokus-Dämpfung mischt
  nicht-fokussierte Rubriken nach `--bg-0`. Im Light multipliziert sich das mit
  dem Rückseiten-Mix auf unter 18 % Restfarbe. Ebenfalls auf die Tiefenfarbe
  umstellen.

## 8. Light-Hintergrund: erst die Vignette, dann Lava und Bokeh

### 8.1 Die Vignette (Ursache Nummer eins)
- **Benenne die Ebenen richtig:** Der Div mit der Klasse
  `deepfight-helix__vignette` trägt in Wahrheit die Ambient-Fläche; die echte
  Vignette ist der klassenlose Inline-Div darüber. **Gib beiden eindeutige
  Klassen** — sonst zielt auch die nächste Runde wieder daneben.
- **Gib der echten Vignette einen Light-Zweig:** Startpunkt nach außen
  verschieben (Richtwert von 42 % auf ~62 %) und die Enddeckung von 78 % auf
  höchstens 30–35 % senken. Sie soll den Rand abdunkeln, nicht weiß waschen.
- **Nimm die Ambient-Fläche im Light zurück** (heute fälschlich auf 0,56
  angehoben, Richtwert ~0,30) — sie liegt unter der Lava und kostet genau den
  Kontrastbereich, den die Lava braucht.
- **Der Dark-Zustand darf sich dabei nicht ändern** (dort bändigt die Vignette
  die additiven Partikel am Rand).

### 8.2 Lava: es fehlt die Farbe, nicht die Dunkelheit
- Gemessen liegt die Lava heute bei 9–14 % Helligkeitsunterschied, aber nur
  **5–8 Stufen Farbspreizung** — Runde 8 hat sie mit fast unbunten Tokens
  verdünnt, das Ergebnis ist ein grauer Schleier.
- **Nimm wieder chromatische Mischpartner** (Akzentfarben statt neutraler
  Grautöne) und **heb die Sättigungsdämpfung auf** — sie nimmt genau die Chroma
  weg, die fehlt. Die Multiply-Mischung ist richtig und bleibt.
- **Zielwerte (nachrechenbar):** Blobkern höchstens **200,206,206** gegen den
  Light-Grund (244,248,248), **und** eine Kanalspreizung von **mindestens 20
  Stufen**, damit die Fläche als Cyan bzw. Violett gelesen wird und nicht als
  Grau. Deckkraft dafür auf ~0,26–0,30 anheben.
- Färbe die Blobs **gegenläufig zu den Bändern** ein, damit ein cyaner Blob
  nicht hinter einem cyanen Strang die Lesbarkeit senkt.

### 8.3 Fernpartikel: heute messbar unsichtbar
- In der Referenzaufnahme aus Runde 8 ist **kein einziger Bokehpunkt messbar**
  (konstant Grundfarbe über die gesamte Zeile). Die Farbumkehr wurde zwar
  umgesetzt, aber vier Faktoren arbeiten dagegen:
  1. ein gemeinsamer **Alpha-Deckel** für Nah- und Fernstufe,
  2. eine **Größenreduktion um 28 %** im Light,
  3. eine **härtere Gaußkurve** im Light (der sichtbare Kern schrumpft auf
     wenige Pixel),
  4. die Mischung läuft im **Linearraum**, aus „42 %" werden wahrnehmungsseitig
     nur ~30 %.
- **Fix:** Alpha-Deckel anheben (Nahstufe getrennt), die Light-Größenreduktion
  aufheben, die Gaußhärtung im Light nicht über den Dark-Wert legen, und den
  dunkleren Mischpartner deutlich stärker gewichten (die fast grundgleiche
  Variante ersetzen).
- **Zielwerte:** Fernstufe **≥ 14 sRGB-Stufen**, Nahstufe **20–24 Stufen**
  Unterschied zum Grund — **nach** der Vignette gemessen.
- **Zieh die zehn fest am Rand verankerten Punkte nach innen**, sonst landen sie
  im Split-Zoom in der stärksten Vignettenzone oder außerhalb des Bildes.

## 9. Fight-Split: Athlet vorn, Fokus heller

- **Der Athlet muss in JEDER Kombination leuchtender sein als der Gegner**
  (Dark und Light). Heute ist es umgekehrt: Der Gegner bekommt die volle
  Farbbindung, der Athlet nur 0,9 — und die Aufhellung des Athleten wirkt im
  Light sogar kontrastmindernd (§7).
- **Abnahmekriterium:** Leuchtdichte Athlet > Gegner in **allen vier**
  Kombinationen aus Theme und Modus, gemessen im selben zentralen Bildausschnitt.
  Der Gegner darf dabei nicht schlechter werden als heute — der Nutzer findet
  ihn „zu leuchtend" nur **im Verhältnis** zum Athleten.
- **Bei ausgewähltem Segment leuchtet der zugehörige Strangbereich stärker.**
  Heute wird nur die Umgebung abgedunkelt und der Fokusbereich eingefärbt — es
  gibt keine echte Aufhellung. Ergänze eine: entweder als Helligkeitsfaktor nach
  dem Einfärben oder — besser — als **Fokus-Kennzeichen pro Korn**, damit auch
  der Dark-Gegner einen heißen Kern bekommen kann (dort ist der Puls-Boost
  abgeschaltet).
- Beim Gegner die Fokus-Aufhellung **graustufig** halten statt farbig, damit er
  monochrom bleibt.
- Achte darauf, dass helle Split-Tokens beim Aufhellen nicht über die Grenze
  klemmen.

## 10. Budget und Konsistenz

- **≤ 8 Draw Calls, ≤ 45.000 Punkte, max. 4 `Points`-Objekte**, keine
  Mesh-Draws, `dpr={[1, 2]}`. Aktuell 41.644 — **es ist fast keine Luft mehr**.
  §4 muss über Form und Umverteilung gelöst werden, nicht über mehr Punkte.
- **Weißbrand-Grenze ist gemessen:** Im Pfad Athlet + Dark (der einzige additive)
  steht der hellste Kanal bei 252/255. Reines Vergrößern erlaubt bei konstantem
  Alpha nur ~1,3 %. Jede Flächenänderung muss im Alpha gegenkompensiert werden.
- **SVG-Zwilling mitziehen** bei: Kornform (§4), Gegner-Rampen (§6), Split-
  Verhältnis (§9). Er ist der sichtbare Zustand vor dem ersten Frame, bei
  Kontextverlust, bei reduced-motion und bei `size="sm"` — läuft also nicht nur
  im Notfall.
- Alle Schutzpfade erhalten und erneut testen; alles `dispose()`-en.

## 11. Dev-Seite

- Neue Regler in die **bestehenden** Gruppen, Labels ≤ 14 Zeichen:
  „Energie & Blitze" (Lichtblitz-Frequenz, Invertierungs-Weichheit),
  „Form & Partikel" (Streckung k, Kantenschärfe, Rausch-Anteil),
  „Hintergrund" (Vignetten-Stärke).
- Final gewählte Werte werden Defaults (im Bericht nennen).

## 12. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber
  (0 Treffer für Hex und `rgb(`); Spiegel-Dateien per SHA-256 byte-identisch;
  `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- **Messwerte statt Behauptungen.** Runde 8 hat im Bericht Sichtbarkeit
  behauptet, die messbar nicht vorhanden war. Erfasse deshalb **in allen vier
  Kombinationen** (Athlet/Gegner × Dark/Light, je Vollständigkeit und Split) im
  selben zentralen Bildausschnitt:
  - hellstes **und dunkelstes** repräsentatives Korn sowie den Median;
  - **Kontrast gegen den Grund** (Dark: gegen `--bg-0`; Light: gegen 244,248,248);
  - Leuchtdichte-Vergleich **Athlet gegen Gegner** (§9);
  - Zahl reinweißer Pixel (Ziel: 0).
- Zusätzlich messen: dunkelster **Lava**-Pixel samt Kanalspreizung und
  dunkelster **Bokeh**-Pixel in einem helixfreien Bereich — gegen die Zielwerte
  aus §8.2 und §8.3. Die heutigen Werte (Lava ~216,220,223 bei Spreizung ~3;
  Bokeh 0 Stufen) gehören als Vorher-Referenz in den Bericht.
- Aufnahmen in `report/`:
  - **Strangkorn bei 300–400 % Zoom:** klar längliche, entlang des Strangs
    ausgerichtete Körner mit unterschiedlich dicken Passagen — keine runden
    Punkte, kein Fischgrätmuster quer zum Strang.
  - Rotation über eine halbe Umdrehung: kein sichtbares Umklappen der Körner.
  - **Blitz-Bildfolge Dark-Gegner:** dunkler Kern mit hell auslaufenden Rändern,
    kein deckender schwarzer Balken; eine neu gewachsene Sprosse leuchtet dabei
    **hell**, nicht schwarz.
  - **Blitz-Bildfolge Light-Gegner:** Blitz als Form erkennbar, keine weiße
    Fläche.
  - Der neue **Lichtblitz** in mindestens zwei Aufnahmen unterschiedlicher Länge.
  - Gegner Dark (heller, mehrstufig grau) und Gegner Light (dunkler, mit
    einzelnen fast schwarzen Körnern) je in Nahaufnahme.
  - **Light, Athlet, rotiert:** der hintere Strang ist klar erkennbar — in
    Vollständigkeit **und** Split.
  - Light-Hintergrund ohne Helix-Fokus: Lava als farbige Formen und
    Bokeh-Scheiben mit bloßem Auge erkennbar, auch am Rand.
  - Split mit fokussiertem Segment: der Bereich leuchtet sichtbar heller als der
    Rest — für Athlet und Gegner.
- `REPORT.md` und `HANDOFF.md` aktualisieren. Danach STOPPEN — keine Integration
  nach Tidal.
