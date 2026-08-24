# Auftrag: DeepFight-Helix — Runde 8: Helligkeit, Fokus-Wahrheit, Split-Zoom

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

**Reihenfolge dieses Auftrags ist bindend.** §2, §3 und §7 wirken alle in
dieselbe Helligkeitsrichtung und können die Weißbrand-Abnahme aus Runde 7
gemeinsam kippen. Arbeite **§2 → §3 → §4 → §5 → §6 → §7 → §8** ab und **miss
nach jedem Schritt** (hellstes Korn, Zahl reinweißer Pixel).

## 1. Vorab: drei Befunde aus der Analyse des Runde-7-Standes

Der Ist-Stand wurde vor diesem Auftrag untersucht. Drei Dinge sind **Fehler,
keine Geschmacksfragen** — sie erklären mehrere Beschwerden auf einmal:

1. **Der Anker der Fokus-Linie zeigt im Vollständigkeits-Modus auf eine fremde
   Kategorie.** `makeVisualLayout` sortiert dort alle 60 Sprossen global per
   Hash; `focusIndex` ist das arithmetische Mittel der verstreuten Slots und
   landet dadurch immer im mittleren Drittel. **Bei 7 von 9 Kategorien** gehört
   die Sprosse an der Ankerposition zu einer anderen Kategorie. Siehe §4.3.
2. **Karte und Helix benutzen zwei verschiedene Farbquellen.** Die Karte liest
   im Split die **Band**farbe an der Segmentmitte, die Helix tönt das
   fokussierte Segment mit dem **Kategorie**-Token (`SEGMENT_COLOR_TOKENS`).
   Im Mock „Kampfreif" laufen **8 von 9** Segmenten auseinander. Siehe §4.2.
3. **Der Gegner ist im Dark zu dunkel, weil die Token-Farben doppelt
   linearisiert werden.** `use-resolved-tokens` linearisiert bereits; im Ergebnis
   landet `--line-strong` statt bei Byte ~66 bei ~14 und `--text-3` statt bei
   ~128 bei ~55. Das ist die Ursache für „im Dunklen nicht erkennbar". Siehe §2.1.

## 2. Helligkeits-Kette (zuerst!)

### 2.1 Farbraum-Fehler beheben
- Prüfe die Kette Token → `THREE.Color` → Shader → Framebuffer auf eine
  **doppelte Linearisierung** und behebe sie an der Wurzel.
- **Achtung:** Die Korrektur ist material-, nicht variantengebunden — sie hebt
  **alle vier Punktwolken beider Varianten** gleichzeitig. Der Athlet läuft im
  Dark additiv und würde massiv heller. **Ziehe im selben Schritt gegen:**
  Kern-Boost, die Alpha-Basiswerte von Strang und Sprossen sowie das
  Bokeh-Alpha.
- **Abnahme-Zielwerte:** Gegner-Körner im Dark erreichen gegen `--bg-0` einen
  Kontrast von **mindestens 2,5:1**; gleichzeitig bleibt die Zahl **reinweißer
  Pixel bei 0** und das hellste Korn dokumentiert (Referenz Runde 7: 59/66/66).
- **Die Abnahme aus Runde 7 hat den Fehler durchgelassen**, weil sie nur gegen
  reines Weiß geprüft hat. Ergänze die Prüfung um **Mindestkontrast Korn gegen
  `--bg-0`** — in beiden Themes, für beide Varianten.
- **Auch die offenen Sprossen** (`--line-strong`) sind betroffen. Sie tragen die
  Kernaussage des Vollständigkeits-Modus und dürfen im Dark nicht im
  Hintergrund verschwinden.

### 2.2 Athlet im Fight-Split: der lebendigere von beiden
Der Nutzer sagt: „Der Gegner sieht aktiver/frischer aus — was eigentlich genau
andersherum sein sollte." Ursache ist der Split-Tausch aus Runde 7, der in
**einer Zeile** steckt (`binding = variant === "opponent" ? 1 : 0.62`).

- **Der Gegner-Split gefällt und bleibt unverändert** (`binding` = 1). Er ist
  der Regressionstest: nach dem Umbau muss er **pixelgleich** zu vorher sein.
- **Der Athlet wird angehoben:** `binding` auf **0,90** (zulässig 0,88–0,95 —
  nicht 1,0, sonst sind beide Varianten farblich fast deckungsgleich und nur
  noch über den Chrom-Look unterscheidbar). Dazu ein Helligkeitsfaktor von
  ~1,12 und der Wegfall des zusätzlichen Dämpfungs-Zuschlags auf den
  Sprossenkern beim Athleten.
- **Zielmetrik:** Chroma des Athleten in der Strangmitte **mindestens auf
  Gegnerniveau**, Hue-Abweichung zur Bandfarbe **< 10°**. Kein milchiges Pastell
  mehr.
- **`HelixGlyph.tsx` identisch nachziehen.** Achtung: Der SVG-Pfad mischt in
  oklab, WebGL in linearem sRGB — gleiche Zahlen ergeben **nicht** exakt gleiche
  Farben. Visuell gegenprüfen.

## 3. Gegner im Dark: helle DNA, dunkle Blitze

Nach §2.1 ist der Gegner sichtbar. Der Nutzer will im Dark zusätzlich den
Spieß umdrehen: **die DNA selbst heller, die Umgebung dunkel — und die Blitze
dann schwarz statt weiß.**

- **Gilt ausschließlich für `variant="opponent"`.** Beim Athleten wäre die
  Invertierung ein Umbau des ganzen Erscheinungsbilds (Verlust der Akkumulation
  von ~29.000 Körnern) — dort bleibt es beim hellen Puls.
- **Technisch geht das nur unter Normal-Blending** (additiv addiert Schwarz = 0
  und ist unsichtbar). Der Gegner hat Normal-Blending für Strang und Sprossen
  **bereits** — die Forderung ist damit lokal umsetzbar.
- **Der Blitzkopf dunkelt die Körner ab** statt sie aufzuhellen: ein dunkles
  Band, das über den helleren Strang läuft. Ziel-Alpha am Kopf ≥ 0,85 (heute
  enthält der Alpha-Term überhaupt keinen Puls-Anteil — das musst du ergänzen).
- **Die Austrittsfunken sind heute für BEIDE Varianten additiv gebaut.** Ein
  weißer Funke neben einem schwarzen Blitz sieht falsch aus: Zieh sie für den
  Gegner mit (dunkel) oder unterdrücke sie dort.
- Die **Umgebung** (DOM-Hintergrund, Lava, Vignette) darf dabei **nicht**
  mit aufgehellt werden.
- Im **Light-Theme bleibt der Gegner wie er ist** — dort gefällt er.

## 4. Fokus-Callout: Linie, Farbe, richtige Zielstelle

### 4.1 Leader-Linie: nur Z, maximal 2 Knicke
Der heutige Generator erzeugt 1–3 Knicke und würfelt das **Vorzeichen der
Auslenkung pro Knick unabhängig** — daraus entstehen die abgelehnten Dreiecke
und Zickzacks (die Folge der ersten sechs Öffnungen liefert nachweislich
2/3/1/2/3/1 Knicke mit bis zu 4 Richtungswechseln).

- **Neu: höchstens 2 Knicke, echtes Z.** Baue den Pfad in **Bildschirmachsen**
  statt senkrecht zur Basislinie:
  `M anchor → horizontal bis t1 → vertikal auf die Kartenhöhe → horizontal zur
  Karte`.
- **Harte Formregel:** Die x-Achse läuft **streng monoton** (nie zurück Richtung
  Anker), die y-Richtung wechselt **genau einmal**. Kein Raus-und-zurück,
  kein W, kein Zickzack.
- **Der Zufall darf nur noch die Lage der Knicke seeden, nie ein Vorzeichen.**
  Richtwerte: erster Knick bei 28–46 % der Strecke, Abstand der beiden Knicke
  6–22 %.
- Liegen Anker und Karte fast auf gleicher Höhe (< 6 px Differenz), fällt die
  Linie auf **gerade** zurück.
- **Kippt das Vorzeichen der Horizontaldistanz** (der Anker wandert durch die
  seitliche Verschiebung und die wechselnde Kartenseite hinter den
  Kartenanschluss), muss die erste Teilstrecke trotzdem vorwärts laufen —
  Regel dafür festlegen.
- Die Variation beim Wiederöffnen bleibt erhalten (t-Bereich ausreichend
  spreizen). Der Kompaktpfad (< 620 px) ist bereits regelkonform und bleibt.

### 4.2 Farbe exakt an der Stelle, auf die gezeigt wird
Der Nutzer: „Die Farbe passt nicht mit der Farbe überein, auf die sie zeigt."
Das stimmt und hat drei Gründe: unterschiedliche Quellen (Karte = Band, Helix =
Kategorie), unterschiedliche Verrechnung (der Strang trägt an der Ankerstelle
beim Athleten nur ~48 % Bandfarbe, die Karte 100 %) und die Rotation (der Anker
sitzt fest auf einer Strangseite; rund die Hälfte der Zeit zeigt die Linie auf
den nach hinten gedrehten, fast hintergrundfarbenen Strang).

**Vorgabe — der Weg ist entschieden, nicht neu zu bewerten:** Die Farbe wird
**an der Ankerstelle aus der Szene abgegriffen und hochgereicht.**

- Erweitere die Anker-Meldung um die **aufgelöste Farbe**. Alle Zutaten liegen
  dort bereits vor: Fortschritt, Sprosse und dieselbe Farbfunktion, die auch die
  Körner einfärbt — rufe sie mit **exakt denselben Argumenten** auf.
- **Wähle die Strangseite nach Tiefe** (die dem Betrachter zugewandte, so wie es
  der SVG-Zwilling schon macht) und **überspringe den Rückseiten-Mix**, damit
  die Karte nicht mitdunkelt.
- **Als sRGB hochreichen** (die Token-Auflösung linearisiert — vor der Ausgabe
  zurückwandeln, siehe auch §2.1).
- **Pflicht-Guard gegen einen Render-Sturm:** Nur bei **Wechsel von
  Fokus-Segment, Modus, Variante oder Theme** neu melden — nicht pro Frame. Die
  vorhandene Positions-Schwelle greift dafür nicht.
- Das gilt in **beiden** Modi. Im Vollständigkeits-Modus ist die Karte heute
  pauschal eingefärbt und hat gar keine Ortsabfrage.

### 4.3 Der Anker muss auf die richtige Kategorie zeigen
Reparier den in §1.1 beschriebenen Fehler: Im Vollständigkeits-Modus muss die
Linie auf eine Sprosse zeigen, die **tatsächlich zur fokussierten Kategorie
gehört** (z. B. auf den Median der Slots dieser Kategorie statt auf das
arithmetische Mittel verstreuter Positionen). Sonst zeigt die Karte weiterhin
auf abgedunkelten Strang einer fremden Kategorie — und keine Farbkorrektur der
Welt hilft.

## 5. Split-Zoom — nur zusammen mit dem Strang-Überstand

Beim Umschalten von „Vollständigkeit" auf „Fight-Split" soll die Kamera
**herausfahren**, damit der ganze Farbbereich sichtbar wird; ein Klick auf ein
Segment fährt wieder heran wie bisher.

**Das kollidiert direkt mit der harten Regel „oben und unten nie ein
Helix-Ende sichtbar".** Gerechnet: Für alle fünf Bänder in jeder Rotationsphase
braucht es **camZ ≈ 13,0–13,5**; ohne Gegenmaßnahme wäre **10,4** das Maximum,
das noch kein Ende zeigt — und das deckt nur 77–85 % der Bänder ab.

**Deshalb ist der Zoom nur zulässig, wenn du gleichzeitig den Strang
verlängerst:**

- **Überstand** über beide Enden hinaus (Richtwert Fortschritt −0,15 … +1,15),
  mit **auslaufender Dichte** und einer **Alpha-Rampe** im Überstand, damit die
  Helix ins Nichts ausläuft statt zu enden. (Der vorhandene Szenennebel ist
  hier wirkungslos.)
- **Punktbudget:** Der Überstand verlängert den Strang um Faktor ~1,3.
  Dichtekonstant wären das ~520 Schritte. **520 × 36 × 2 = 37.440 sprengt das
  Budget** zusammen mit den Sprossen. **520 × 32 × 2 = 33.280 passt** und
  liefert trotzdem ~16 % mehr Punkte als heute. §7 (mehr Körner) und §5 sind
  also **nur gemeinsam planbar** — reize §7 nicht allein aus.
- **Der Fokus-Clamp ist heute eine hartkodierte Konstante**, die zufällig zur
  aktuellen Kameradistanz passt. Stell ihn auf eine **abgeleitete Formel** um
  (aus Helixende, Sichtwinkel und Kameradistanz), sonst stimmt er nach dem
  Zoom-Umbau stillschweigend nicht mehr. Er verhindert heute außerdem, dass die
  **erste und letzte Kategorie** je zentriert werden — das fällt mit der neuen
  Fahrt stärker auf. Behebe das mit.
- **Körner werden beim Herausfahren kleiner** (~69 %) — also genau dann, wenn
  die Bänder lesbar sein sollen. Kompensiere die Punktgröße gegen die
  Kameradistanz.
- **Der Rand des Bokeh-Felds wird ab ~camZ 11 sichtbar** (leerer Rahmen um die
  Szene). Skaliere die Ausdehnung des Fernfelds mit.
- Fahrt weich gedämpft, an die vorhandene Fokus-Fahrt angelehnt.

## 6. Sprossen: einzelne mit Knick

Sprossen sind heute **exakt gerade**. Einzelne sollen anders aussehen — ein
leichter Knick, manchmal zwei.

- **Anteil:** 25–35 % der Sprossen bekommen einen Knick, davon ~20 % zwei.
- **Amplitude:** ~0,045 Welteinheiten (≈ 28 % des Sprossenabstands, ergibt
  6–7,5° Knickwinkel). Scheitel bei 22–32 % bzw. 68–78 % der Sprossenlänge,
  hart begrenzt auf 18–82 %.
- **Richtung überwiegend vertikal/binormal.** Ein reiner Knick in
  Normalenrichtung ist zwar kollisionsfrei, aber je nach Rotationsphase
  periodisch unsichtbar und wirkt dann wie Flackern.
- **Kollisionsschutz (der Nutzer nennt das ausdrücklich):**
  - **Mindestabstand von 3 Slots** zwischen zwei geknickten Sprossen — zwei
    benachbarte Knicke halbieren das Budget.
  - **Bemiss den Knick gegen den Ruhezustand**, nicht gegen den Blitzmoment: Der
    Puls vergrößert die Körner kurzzeitig, dann verklebt jeder geplante Spalt.
  - **Unterhalb ~500 px Canvas-Höhe den Knick ganz abschalten.** Bei `size="md"`
    (390 px) und im Kompaktpfad überlappen benachbarte Sprossen **bereits heute
    ohne Knick** — dort darf kein Knick dazukommen.
- **Die Wachstums-Ausgangsposition muss denselben Knick bekommen**, sonst klappt
  eine neu beantwortete Sprosse beim Wachsen sichtbar auf.
- **SVG-Zwilling:** Dort ist gar kein vertikales Budget frei (die Sprossen
  überlappen schon heute). Entweder zuerst Strichstärke/Streuung reduzieren —
  oder den Knick dort bewusst weglassen und das im Bericht festhalten.

## 7. Stränge: mehr und verbundener

Der Nutzer: „hier sind zwar jetzt viele Partikel, aber mir fehlen noch mehr und
etwas größere verbundene Partikel."

- **Der wirksamste Hebel kostet keinen einzigen Punkt:** Der Längsversatz der
  Körner deckt heute nur 22–60 % des Ringabstands ab — dadurch entsteht eine
  **deterministische Ringstruktur** mit Lücken. Korrigiere ihn auf die **echte
  Bogenlänge** (halber Ringabstand als Amplitude). Danach liest sich die Röhre
  als zusammenhängende Fläche statt als Kette isolierter Funken.
- **Punktzahl:** siehe §5 — **520 Schritte × 32 Körner × 2 Stränge = 33.280**.
  Die untere Klemmgrenze der Dichte muss dafür gesenkt werden.
- **Größe:** Kernkörner von heute 2,1–4,8 auf ~2,6–5,4 anheben — **mit erneuter
  Weißbrand-Messung** (§2.1).
- Die Staubkörner dürfen den Zusammenhang **nicht mehr zerreißen**.

## 8. Hintergrund

### 8.1 Fernpartikel teilweise näher
- Führe ein **Nah-Tier** ein: ~30 % der Fernpartikel rücken näher heran.
- **z-Bereich −2,6 bis −1,6 — niemals näher als −1,5.** Das Helixvolumen liegt
  bei z ∈ [−1, 1]; alles davor verschmutzt den Kern optisch und zerstört die in
  Runde 7 erkämpfte Mittenverdichtung.
- Nah-Tier **kleiner und schärfer** als das Fernfeld (Richtwert Größe 10–26
  statt 22–76, höherer Unschärfe-Exponent), sonst werden daraus Flächen.
- **Hänge das Nah-Tier in die rotierende Gruppe** — das ergibt echte Parallaxe
  und kostet keinen zusätzlichen Punkt.
- Kein zusätzliches `Points`-Objekt: Das Nah-Tier lebt im vorhandenen
  Bokeh-Objekt (max. 4 Points-Objekte bleiben).

### 8.2 Light-Theme: Hintergrund sichtbar machen
Im Light ist heute **weder Bokeh noch Lava** zu erkennen. Ursachen und Fixes:

- **Bokeh:** wird im Light Richtung `--bg-0` gemischt und zusätzlich im Alpha
  gedämpft — hell auf hell. **Dreh die Mischrichtung um:** Die Partikel müssen
  **dunkler als der Grund** sein (grau, Richtung `--text-3`/`--line-strong`).
- **Achtung, gemeinsamer Schalter:** Der Light-Umschalter steuert Alpha,
  Blending und Kern-Boost **gemeinsam für alle vier Punktwolken**. Die
  Light-Abstimmung des Gegners hängt daran. **Differenziere pro
  Points-Objekt** — sonst reparierst du das Bokeh und zerlegst den Gegner.
- **Lava:** liegt im Light bei nur 17–23 % Akzentanteil gegen einen hellen
  Grund und damit über der Grundhelligkeit. Neues Light-Rezept mit **dunklerem
  Mischpartner**, sodass die Blobs **unter** der Grundhelligkeit liegen. Der
  Deckkraft-Regler allein reicht nachweislich nicht.
- Den Vignetten-Anteil im Light prüfen (deckt heute bis 78 % ab und schluckt die
  Ränder).
- **Gegenprobe:** HUD-Zahl und Fokuskarte behalten ihren Kontrast, das
  Dark-Theme bleibt unverändert.

## 9. Budget und Konsistenz

- **≤ 8 Draw Calls, ≤ 45.000 Punkte, max. 4 `Points`-Objekte**, keine
  Mesh-Draws, `dpr={[1, 2]}`. Worst Case ist 60/60 bei Dev-Maximalreglern.
- **Neue Farbtokens sind ein Scharfschalter:** Jeder zusätzlich verwendete Token
  **muss** in die Token-Liste des Renderers aufgenommen werden — sonst bleibt er
  undefiniert, der Bereitschafts-Flag fällt auf `false` und **die Szene rendert
  gar nicht mehr**. Hex/rgb bleiben verboten.
- **SVG-Zwilling zwingend mitziehen bei:** §2.2 (Athlet/Gegner-Verhältnis), §4.2
  (Farbquelle), §6 (Sprossen-Knick, oder begründet weglassen). Der Glyph läuft
  bei `size="sm"`, reduced-motion, fehlendem WebGL und Kontextverlust.
- Alle Schutzpfade erhalten und erneut testen; alles `dispose()`-en.

## 10. Dev-Seite

- Neue Regler in die **bestehenden** Gruppen, Labels ≤ 14 Zeichen:
  „Energie & Blitze" (Blitz-Invertierung Gegner), „Form & Partikel"
  (Knick-Anteil, Knick-Stärke), „Hintergrund" (Nah-Anteil des Bokeh,
  Split-Zoom-Distanz).
- Final gewählte Werte werden Defaults (im Bericht nennen).

## 11. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber;
  Spiegel-Dateien per SHA-256 byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- **Messwerte statt Behauptungen** — im Bericht ausweisen:
  - hellstes Korn (RGB) und Zahl reinweißer Pixel, **je Variante und Theme**;
  - **Kontrast Korn gegen `--bg-0`** im Dark für den Gegner (Ziel ≥ 2,5:1);
  - Punkte, Draw Calls, FPS im Worst Case.
- Aufnahmen in `report/`:
  - Leader-Linie: **sechs aufeinanderfolgende Öffnungen** — kein einziges
    Dreieck, höchstens 2 Knicke, y wechselt genau einmal die Richtung.
  - Farbprobe: Kartenrahmen, Ankerraute und das Pixel **an der Spitze der
    Linie** im selben Screenshot — Farbton deckungsgleich (Ziel: Hue-Abstand
    ≤ 3°). **In beiden Modi, beiden Themes, und zweimal im Abstand von ~19 s**
    (halbe Rotationsperiode), damit der Rückseiten-Fall mitgeprüft ist.
  - Gegner Dark: Körner heben sich ab; ein Blitz-Frame zeigt ein **dunkles** Band
    auf hellerem Strang, kein weißer Austrittsfunke.
  - Split Athlet und Gegner nebeneinander, gleiche Rotationsphase — der Athlet
    ist der sattere; der Gegner **unverändert** gegenüber Runde 7.
  - Split-Zoom: alle **fünf** Bandfarben im Bild abzählbar, **gleichzeitig kein
    Helix-Ende** oben oder unten — in 16:9, 9:16, Mobil und zwei
    Rotationsphasen. Kein leerer Rahmen am Bildrand. Danach Klick auf ein
    Segment: fährt heran und **zentriert auch die erste und letzte Kategorie**.
  - Sprossen-Knick bei 60/60 herangezoomt: erkennbarer Richtungswechsel, Mehrzahl
    gerade, **keine zwei benachbarten Sprossen berühren sich**. Gegenprobe
    `size="md"` und Mobil: dort kein Knick.
  - Stränge bei 300–400 % Zoom: **keine Ringstruktur mehr**, zusammenhängende
    Fläche.
  - Light-Theme: Fernpartikel als eigenständige Scheiben erkennbar (dunkler als
    der Grund), mindestens zwei Lavaformen **mit bloßem Auge** identifizierbar.
- `REPORT.md` und `HANDOFF.md` aktualisieren. Danach STOPPEN — keine Integration
  nach Tidal.
