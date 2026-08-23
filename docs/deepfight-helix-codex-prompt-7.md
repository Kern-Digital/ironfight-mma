# Auftrag: DeepFight-Helix — Runde 7: Blitz-Choreografie, Sprossen-Zustände, Fokus-Inszenierung

Du überarbeitest den Prototyp in `D:\DeepFight-Helix`. Dieser Text + zwei zu
lesende Dateien sind alles — kein früherer Chat nötig.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— **§0 (Arbeitsregeln) und §0b (Skills) gelten unverändert und absolut**
(`D:\Tidal-Athletics\` nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben, Spiegel-Dateien byte-identisch, Props nur
ergänzen, Mobile-/Fallback-Mechanik erhalten). Danach `REPORT.md` und den
aktuellen Code lesen.

**`app/page.tsx` wurde nach deinem letzten Lauf von außen geändert:**
Neigung-Default `5` (Regler max. `8`), Streuung-Default `1.35`
(Regler 1,10–1,45). Das sind Nutzer-Entscheidungen — **übernimm sie als neue
Defaults im Renderer**. Ebenfalls erhalten: die klappbaren
`ControlSection`-Gruppen, das sticky Steuerpanel, das kompakte `.tuning-grid`
(Labels ≤ 14 Zeichen).

**Referenzbilder liegen dieser Nachricht bei.**

## 1. Lage und Schwerpunkt

Runde 6 hat verschmolzene Sprossen-Enden, dünnere Blitze und gedämpfte
Split-Farben gebracht. Runde 7 hat einen klaren Schwerpunkt: **Die Blitze sind
zum dritten Mal in Folge bemängelt worden (§2)** — das ist der wichtigste
Punkt. Danach folgen Sprossen-Zustände (§4) und die Fokus-Inszenierung (§7).

Kein Kurswechsel. Partikel-Aufbau, Modell (`lib/fight-dna-helix.ts`) und
Props-API bleiben (nur ergänzen).

**Drei Vorab-Klarstellungen, damit du nicht am Ziel vorbeibaust** (der Ist-Stand
wurde vor diesem Auftrag analysiert):

1. **Teil-Sprossen existieren bereits** (`ghostAlong`, HelixScene.tsx:239–244).
   Sie sind nur nicht wahrnehmbar. §4.2 ist deshalb ein Sichtbarkeits- und
   Varianz-Auftrag, kein Neubau.
2. **Die Split-Bänder sind bereits längengewichtet** (`bandRanges` legt
   `band.share` kumulativ auf die progress-Achse, HelixScene.tsx:613–620).
   §6 ist deshalb ein Lesbarkeits-Auftrag. **Die Sprossen-Slots werden NICHT
   umverteilt** — `progress` ist gleichzeitig Positions- und Zeitachse für Puls,
   Wanderblitze und Fokusanker; eine Umgewichtung bräche all das.
3. **Sichtbare Helix-Enden kommen nicht vom `tilt`**, sondern von der
   Fokus-Kamera (HelixScene.tsx:977 fährt auf `focusY`). Siehe §8.

## 2. Blitze: echte Choreografie statt gleichförmigem Wandern

**Das Problem:** „Aktuell ist es etwas zu viel und das gleiche." Die kleinen
Blitze wandern gleichförmig, es gibt keine Stille und keine Überraschung.

### 2.1 Der große Puls
- Intervall auf **12–22 s** (heute 3–8 s, `HelixScene.tsx:896`). Er bleibt
  der breiteste, stärkste Effekt und wird dadurch ein Ereignis.

### 2.2 Die kleinen Funken — Ablauf einer Gruppe
Kleine Funken laufen NICHT dauerhaft. Sie kommen in **Gruppen (Bursts) mit
Stille dazwischen**:

1. Ein Funke spawnt an zufälliger Höhe auf **einem** Strang und läuft ein
   **kurzes** Stück (10–35 % der Gesamtlänge) in **0,4–1,0 s**.
2. **Während er läuft, springt er auf dem Strang seitlich hin und her:** Der
   Leuchtpunkt wandert nicht nur entlang der Kurve, sondern auch im **Winkel um
   die Strangachse** — ruckartig, 1–3 Sprünge pro Lauf. Er bleibt dabei immer
   auf dem Strang („auf der Röhre") und verlässt ihn nie.
3. **In ca. 40 % der Läufe schlägt er auf eine Sprosse aus:** ein kurzer Stich
   in die Sprosse hinein (nur ein Stück weit, nicht zwingend bis zum anderen
   Strang), dann läuft er auf seinem Strang weiter.
4. **Noch während Funke 1 läuft**, startet **weiter oben** ein zweiter; kurz
   darauf **weiter unten** ein dritter — unterschiedlich schnell und weit.
5. **Dann passiert bewusst GAR NICHTS: 2–5 s Stille.**
6. Danach eine neue Gruppe mit **anderer Anzahl (1–3)**, anderen Startpunkten
   und anderer Richtung.

### 2.3 Harte Regeln
- **Stille ist Pflicht.** Es darf nie ein Zustand entstehen, in dem permanent
  irgendwo etwas läuft. Gefühl: ruhige DNA, in die es unregelmäßig hineinzuckt.
- **Keine zwei Gruppen gleich:** Anzahl, Startpositionen, Richtung, Laufweite,
  Tempo und Sprossen-Ausschläge werden je Gruppe neu gewürfelt.
- `wanderFlashCount` steuert künftig die **maximale Gruppengröße**, nicht die
  Zahl dauerhaft laufender Funken. Bei `0` bleibt alles ruhig.
- Der seltene seitliche Austritt (~alle 20 s) bleibt und ist der **Höhepunkt
  einer Gruppe**, nie ein isoliertes Einzelereignis.
- **Wichtig:** Der Arbeitsbereich `shellSpread ≈ 1,35` senkt den Anteil der vom
  Blitz erfassten Körner (`radialGate`, HelixScene.tsx:497) von ~14 % auf ~8 %.
  **Hebe `wanderFlashWidth` entsprechend an** (Default und Clamp), sonst werden
  die Funken schwächer statt präsenter.
- **Der `nearby`-Term (HelixScene.tsx:533) muss auf beantwortete Sprossen
  gegatet werden.** Heute glimmt jede Sprosse beim Vorbeilaufen auf — auch
  offene. Das leuchtet genau die Stummel an, die laut §4.1 zurücktreten sollen.
- Alles pausiert außerhalb des Viewports und bei reduced-motion.

## 3. Athlet und Gegner

### 3.1 Gegner-Look: Chrom statt Silber
Der Gegner (`--text-3`/`--line-strong`, HelixScene.tsx:670–671) wirkt milchig
und „komisch". Er **bleibt monochrom** — das unterscheidet ihn bewusst vom
Athleten — soll aber **chromhaft/metallisch** wirken:

- **Deutlich mehr Kontrast innerhalb der Wolke:** dunkle, fast schwarze Zonen
  neben wenigen sehr hellen Glanzpunkten, statt eines gleichmäßig hellgrauen
  Schleiers. Mehrere Hell-Dunkel-Bänder entlang des Strangs (3–5 Faltungen)
  statt eines durchgehenden Verlaufs.
- **Technische Hürde, die du lösen musst:** Im Dark-Theme läuft
  `AdditiveBlending` (HelixScene.tsx:608). Additiv kann nicht abdunkeln, und
  graue Körner clippen kanalgleich auf **Weiß** — genau daher kommt der
  Silbereindruck. Verstärkt wird er durch die Multiplikatoren > 1
  (Fragment-Kern `0.85` bei HelixScene.tsx:601, Puls-Boosts bei :507 und :546)
  bei `toneMapped: false`. Chrom braucht **dunkle Zonen**: senke den Kern-Boost
  für diese Variante und/oder rendere den Gegner im Dark mit einem Blending, das
  Abdunkeln erlaubt. Heute trägt **keine** Uniform die Variante — dafür ist eine
  neue nötig.
- Der Glanz sitzt **kantenbetont** (Körner mit kameragerichteter Normale hell,
  abgewandte fast schwarz), die hellsten Körner bleiben **punktuell, nie
  flächig**.
- Ein Hauch Kühle ist erlaubt, aber **keine Akzentfarbe**.
- **Light-Theme getrennt prüfen:** dort ist `--line-strong` heller als der
  Hintergrund dunkel ist — die Chromrampe muss in beiden Themes tragen, sonst
  verschwindet der Gegner im Hellmodus.

### 3.2 Fight-Split zwischen Gegner und Athlet tauschen
Heute mischt der Split-Modus die `--cat-*`-Bänder auf die Basisfarbe der
Variante: beim Athleten auf Cyan/Violett (satt gebunden), beim Gegner auf Grau
(ausgeblichen). **Diese beiden Split-Darstellungen werden getauscht:** Der
Gegner zeigt künftig die klar gebundene Variante, der Athlet die zurückhaltende.

**Wichtig — der Tausch gilt AUSSCHLIESSLICH für `mode="split"`.** Im
Vollständigkeits-Modus bleibt alles wie bisher: Athlet farbig
(`--accent`/`--accent-2`), Gegner monochrom/chrom nach §3.1. Ein Tausch der
Basis-Tokens selbst wäre falsch — er würde den Athleten grau machen und §3.1
aufheben.

Prüfe nach dem Tausch, dass im Split weiterhin **beantwortete von
unbeantworteten Sprossenmitten unterscheidbar** bleiben
(HelixScene.tsx:727–731).

## 4. Sprossen: Andeutung, Stummel, Wachstum

### 4.1 Offene Sprossen stärker nur andeuten
- Offene Sprossen werden **blasser und farblos**: möglichst **ohne Buntanteil**,
  nur ein schwaches, entsättigtes Signal. Sie sollen als Ahnung lesbar sein, nie
  als eigenständiges Element konkurrieren.
- Zusammen mit dem `nearby`-Gate aus §2.3: offene Sprossen leuchten auch beim
  Vorbeilaufen eines Funkens nicht mehr auf.
- **Farblos heißt nicht unsichtbar:** Die Form muss erkennbar bleiben
  (siehe §4.2), nur eben ohne Farbe und mit niedriger Deckkraft.

### 4.2 Teil-Sprossen sichtbar machen und stärker variieren
Die Mechanik ist vorhanden (`ghostAlong`, HelixScene.tsx:239–244): ein Drittel
der offenen Sprossen ist einseitig (Reichweite 0,035–0,415), zwei Drittel sind
beidseitig (0,035–0,305 und 0,695–0,965). **Der Nutzer nimmt sie trotzdem nicht
wahr.** Zwei Ursachen, beide beheben:

- **Zu wenig Varianz:** Alle Stummel beginnen bei 0,035 und enden in einem
  engen Fenster — dadurch sehen sie gleich aus und die Spitzen bilden optisch
  Linien. Streue **Startpunkt und Reichweite pro Sprosse deutlich breiter**
  (deterministisch gehasht, stabil über Re-Renders), sodass die Spitzen sichtbar
  auf **unterschiedlichen Längen** enden und **keine gemeinsame Linie** bilden.
  Auch die Aufteilung einseitig/beidseitig darf variieren (heute fest
  `hash % 3`), und bei beidseitigen Paaren sollen die beiden Hälften
  **unterschiedlich weit** ragen (nicht symmetrisch), mit sichtbar bleibender
  Lücke in der Mitte.
- **Zu schwach:** Die Deckkraft so anheben, dass die Stummel als Andeutung
  klar erkennbar sind — bei gleichzeitig entfernter Farbe (§4.1).
- Verteilung über die **gesamte Helixlänge**, nicht geclustert.

### 4.3 Wachstum: verbinden, dann zurücktreten
- Beim Beantworten **verbinden sich** die Stummel: Der vorhandene Teil wächst
  zur vollen Sprosse durch und schließt die Lücke.
- **Neu gewachsene Sprossen dürfen nicht dauerhaft leuchten.** Heute leuchten
  sie im WebGL dauerhaft nach (HelixScene.tsx:539–540). Gefordert ist eine
  **dreiphasige** Choreografie: **Aufleuchten (~0,5 s) → kurz halten (~0,6 s) →
  in die normale Sprossenfarbe ausklingen (~0,9 s)**. Danach ist die Sprosse von
  älteren **nicht mehr zu unterscheiden**.
- **Der SVG-Zwilling verhält sich heute gegenteilig** (einmaliger Auftritt ohne
  Nachleuchten, HelixGlyph.tsx:247–249). Bring beide Pfade auf dieselbe Abfolge.

### 4.4 Farbschwung auf der Sprosse
Der Farbwechsel entlang einer Sprosse sitzt zu exakt in der Mitte — das wirkt
mechanisch geteilt.
- Der Mischpunkt verschiebt sich **abhängig von der Höhe** auf der Helix und
  bekommt eine geschwungene Kurve statt einer geraden Trennung: **an den oberen
  und unteren Enden deutlich stärker versetzt**, in der Helixmitte nahezu
  mittig.
- Zusätzlich eine kleine gehashte Abweichung pro Sprosse, damit keine zwei
  gleich geteilt sind und die Nähte **keine gerade Linie** über alle Sprossen
  bilden.
- **Grenze:** Bleib im Bereich ca. 0,28–0,72. Weiter außen zerstörst du die
  Verschmelzung der Sprossen-Enden aus Runde 6 (`endpointBlend`, wirksam ab
  0,15/0,85).
- **Farbe und Geometrie müssen denselben Versatz bekommen**
  (HelixScene.tsx:719 und :317) — sonst bekommt ein Korn, das geometrisch links
  eingeschmolzen ist, die rechte Strangfarbe.

## 5. Strang-Partikel: dicker innen, feiner außen

- Arbeitsbereich der Streuung ist jetzt **~1,35** (Default übernehmen, §0).
- Körner auf der **Innenseite** des Strangs — der Seite, **an der die Sprossen
  ansetzen** (zur Helixachse hin) — werden **größer, dichter und sichtbar
  verbundener**, sodass dort ein zusammenhängender körniger Grat entsteht.
- Zur **Außenseite** hin werden die Körner **stufenlos kleiner, bis sie exakt
  die heutige Größe erreichen**. Die Außenkante bleibt so fein wie jetzt.
- Der Übergang ist weich, die Gesamtsilhouette des Strangs bleibt gleich dick.
- **Zwei harte Randbedingungen:**
  - **Nicht über mehr Punkte lösen.** Das Budget ist mit ~39.800 von 45.000
    Punkten fast ausgereizt (bei vollen Reglern ~43.000). „Innen dichter" heißt
    **größere Sprites und engerer Längsversatz**, nicht mehr Körner.
  - **Gegenläufig zu §9 (zu weiß) und §3.1:** Mehr Dichte in der Bildmitte
    erhöht genau dort die additive Überlagerung. Kompensiere über einen
    **niedrigeren Kern-Boost/Alpha**, damit die Verdichtung nicht als
    Weißbrand ankommt.

## 6. Fight-Split soll die Anteile ablesbar machen

Der Nutzer will die prozentualen Auswertungswerte im Bild sehen (viel Lila =
großer Abschnitt). **Die Längengewichtung existiert bereits** — `bandRanges`
legt `band.share` kumulativ auf die Helixachse. Sie ist nur nicht ablesbar,
weil die Dämpfung aus Runde 6 (`splitDamping` 0,38) nur ~62 % Kategorieton
durchlässt.

- **Mach die Bänder ablesbar**, ohne zum knalligen Zustand vor Runde 6
  zurückzukehren: Dämpfung im Split spürbar senken (Richtwert ~0,22) und die
  Bandgrenzen klarer markieren, ohne die weichen, unregelmäßigen Übergänge
  aufzugeben.
- Bei **kurzen Bändern** die Übergangszonen **proportional verkürzen**, damit
  ein kleines Band nicht vollständig aus Übergang besteht.
- **Die Sprossen-Slots bleiben unangetastet** (siehe §1). `dnaCompleteness()`
  bleibt die einzige Prozentquelle für die Profilstärke.
- **Fallback:** Ist `dnaSplit` nicht gesetzt (`bands === null`), bleibt die
  gleichmäßige Vollständigkeitsdarstellung — kein Absturz.
- Die Legende muss zu den Bandlängen passen (Reihenfolge identisch).

## 7. Segmentfokus: Farbe, geknickte Linie, Seitenwechsel

### 7.1 Karte und Linie in der Farbe des Abschnitts
Callout, Leader-Linie, Ankerraute und Rahmen tragen heute fest `--accent-2`
(FightDnaHelix.tsx:436, 445, 451, 477, 480, 493–494, 502, 507, 511). Künftig
tragen sie **die Farbe des Abschnitts, auf den die Linie zeigt**.

- **Farbquelle:** `HelixSegment` hat heute kein Farbfeld. **Ergänze ein
  `colorToken` je Segment in `lib/fight-dna-helix.ts`** (Ergänzen ist erlaubt)
  — oder lies im Split-Modus die Bandfarbe an der progress-Mitte des Segments.
  **`lib/gegner-dna.ts` ist Spiegeldatei und tabu**; das dort vorhandene
  `DnaCategory.accent` enthält außerdem Hex-Werte, die den Farbscan brechen
  würden.
- Nur Token-Farben verwenden (`--cat-1..--cat-5`, `--cat-mixed`,
  `--cat-neutral`).
- Fallback ohne `dnaSplit` definieren (dann die dort geltende Strangfarbe).
- Die Farbe wechselt beim Segmentwechsel sichtbar mit.

### 7.2 Geknickte Verbindungslinie
- Die Linie läuft **nicht mehr gerade**, sondern hat **1 bis 3 Knickpunkte**
  im HUD-Stil.
- **Bei jedem neu geöffneten Segment neu gewürfelt** — auch dasselbe Segment
  zweimal hintereinander geöffnet ergibt einen anderen Verlauf. Der Seed braucht
  deshalb einen **Öffnungszähler**, nicht nur die `categoryId`.
- **Zwingend:** Die Knicke als **normierte Parameter** (Anteil entlang der
  Basislinie + Querversatz) in einem `useMemo` festhalten, nicht als Pixel und
  nicht pro Frame neu würfeln — der Anker wird während des Fokus praktisch jeden
  Frame neu gemeldet, unmemoisiertes Random ergibt ein **zuckendes Kabel**.
- Das `<motion.svg>` braucht ein `key` auf dem Fokus-Segment, damit sich die
  Linie beim Wechsel **neu einzeichnet** statt hart umzuspringen.
- Kein Knick darf hinter der Karte liegen oder die Sektion verlassen. Der
  Compact-Pfad (< 620 px) bleibt schlicht.

### 7.3 Helix rückt zur Seite, Karte wechselt die Seite
- Wird ein Segment geöffnet, **verschiebt sich die Helix seitlich aus der
  Mitte** (weiche Verschiebung über ~1 s), damit Platz für die Karte entsteht.
- Die Karte erscheint **abwechselnd rechts und links** — bei jedem neu
  geöffneten Segment auf der anderen Seite; die Helix weicht zur Gegenseite aus.
- Beim Schließen fährt die Helix weich in die Mitte zurück.
- Unter 640 px bleibt das bisherige Verhalten (Karte unter dem Canvas, keine
  Verschiebung).
- **Die Regel aus §8 gilt auch während dieser Verschiebung.**

## 8. Kein Helix-Ende im Bild, nur minimale Neigung

- **Oben und unten darf NIE ein Helix-Ende sichtbar sein** — in keiner Neigung,
  keinem Seitenverhältnis, keiner Bildschirmgröße und auch nicht während der
  seitlichen Verschiebung aus §7.3. Die Helix läuft immer über den oberen und
  unteren Rand hinaus.
- **Die Ursache liegt in der Fokus-Kamera, nicht im `tilt`:** Sie fährt auf
  `focusY` (HelixScene.tsx:977), die sichtbare Halbhöhe beträgt dort ~3,03 bei
  Enden auf ±4,675 — sobald `|focusY| > 1,645` ist ein Ende im Bild. Das trifft
  **sechs von neun Kategorien**. Klemme die Fokus-Kamera (Richtwert `focusY` auf
  ±1,5) und löse den Rest über `lookAt`, oder erhöhe den Fokus-Abstand.
- **Änderungen an `HELIX_HEIGHT`/`HELIX_TURNS` sind gefährlich:** Der
  Austritts-Shader rechnet die Helix mit hartkodierten Werten selbst nach
  (`12.5663706144` und `9.35`, HelixScene.tsx:572–575) — **ohne Compilerfehler**.
  Wenn du die Maße änderst, ziehe diese Konstanten mit, sonst sitzen die
  Austrittsfunken neben der Helix.
- **Abnahmekriterium:** Die oberste und unterste sichtbare Sprosse erreicht den
  Bildrand nie; es bleibt immer Helix jenseits des Rands.
- **Neigung:** `tilt` auf **0–8°** klemmen, Default 5°. Heute gibt es **drei
  widersprüchliche Wahrheiten** (Prop-Default 12 in FightDnaHelix.tsx:88,
  Lab-State 5, Slider 0–8) und **keinen Clamp im Renderer** — führe das zusammen.

## 9. Lavalampen-Hintergrund — dritter Anlauf

Weiterhin abgelehnt. Zwei Punkte, beide hart:

- **Es leuchtet immer noch zu weiß.** Kein heller Kern, kein Weißanteil, kein
  Strahlen. Die Blobs sind **dunkle, gedämpfte Farbflächen**, die sich nur wenig
  vom Hintergrund abheben und die Helix nie überstrahlen. Prüfe ausdrücklich die
  **Mitte** der Blobs auf ungewollte Aufhellung. **Prüfe außerdem, ob der
  Weiß-Eindruck des Nutzers vom Blob kommt oder vom additiven Helix-Kern**
  (§3.1/§5) — beides braucht unterschiedliche Eingriffe; behebe beides.
- **Die Formen sind zu rund und zu unscharf.** Gewünscht sind erkennbare
  **Lavalampen-Muster**: gestreckte Tropfen mit Einschnürungen, die sich beim
  Wandern verformen, teilen und wieder verschmelzen; deutlich asymmetrische
  Silhouetten, verschiedene Größen, unterschiedliche Achsenverhältnisse. **Die
  Blur-Kante darf schärfer werden** — ein Blob muss als Form lesbar sein, nicht
  als Nebelfleck.
- 3–5 Stück, lange Bahnen über die ganze Fläche (Runde 5) bleiben.
- Technik unverändert: nur `transform`/`opacity`/`border-radius`,
  reduced-motion stoppt.

## 10. Budget und Konsistenz

- Unverändert: **≤ 8 Draw Calls, ≤ 45.000 Punkte, max. 4 `Points`-Objekte**,
  keine Mesh-Draws, `dpr={[1, 2]}`. Aktuell sind ~39.800 Punkte belegt — es ist
  fast keine Luft mehr (§5).
- Idle-Demand-Takt ~24 fps. Die Stille-Phasen aus §2 sind eine Chance: dort darf
  der Takt sinken.
- **`MAX_WANDER_FLASHES` steht redundant an vier Stellen**
  (HelixScene.tsx:46, 467–469, 485, 532) — beim Umbau zusammenführen.
- **SVG-Zwilling nicht vergessen:** `HelixGlyph.tsx` ist ein eigener Codepfad
  und läuft bei `size="sm"`, reduced-motion, fehlendem WebGL und Kontextverlust
  — also nicht nur im Notfall. Stummel, Wachstum und der Split-Tausch müssen
  dort mitgezogen werden. **Bekannter Bug, bitte gleich mit erledigen:** Im
  SVG-Split ist der Gegner heute farblich identisch zum Athleten, weil
  `baseCssColor` (HelixGlyph.tsx:71–76) keinen `variant`-Parameter hat.
- Alle Schutzpfade (Viewport, Visibility, Kontextverlust → Glyph,
  reduced-motion → Glyph) erhalten und erneut testen; alles `dispose()`-en.

## 11. Dev-Seite

- Neue Regler in die **bestehenden** `ControlSection`-Gruppen einsortieren,
  Labels ≤ 14 Zeichen:
  - „Energie & Blitze": Gruppengröße, Pausenlänge, Sprossen-Ausschlag.
  - „Form & Partikel": Innen/Außen-Größenverhältnis, Stummel-Varianz.
  - „Hintergrund": Lava-Schärfe.
- Ein Schalter, der die Fokus-Karte **links/rechts erzwingt** (für Screenshots).
- Final gewählte Werte werden Defaults (im Bericht nennen).

## 12. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber
  (0 Treffer für Hex und `rgb(`); **Spiegel-Dateien per SHA-256 byte-identisch**;
  `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer;
  `lib/fight-dna-helix.ts` nur **ergänzt** (Diff zeigt keine gelöschten oder
  geänderten Felder).
- Aufnahmen in `report/`:
  - **Blitz-Choreografie als Video oder Bildfolge über mindestens 30 s.** Darin
    muss nachweisbar sein: ein Frame **ganz ohne** kleinen Blitz; ein Frame mit
    zwei Funken auf unterschiedlichen Höhen; ein Funke, der die Strangseite
    mehr als einmal wechselt; höchstens ein großer Puls in 20 s.
  - Gegner-Chrom in Nahaufnahme (dark **und** light) — im hellsten Kornbereich
    dürfen nicht alle drei Kanäle bei 255 liegen.
  - Athlet und Gegner im Split nach dem Tausch, gleiche Kamera.
  - Teil-Sprossen bei Preset „Im Aufbau": unterschiedliche Längen, Spitzen
    **nicht** auf einer Linie, über die ganze Helix verteilt, ohne Buntfarbe.
  - Wachstum als Bildfolge (t ≈ 0,3 s / 1,5 s / 4 s) — im letzten Frame ist die
    neue Sprosse **nicht heller** als ihre Nachbarn.
  - Split mit stark ungleichen Anteilen: der größte Anteil belegt sichtbar ein
    Vielfaches der Länge des kleinsten.
  - Fokus-Karte **links und rechts**, mit geknickter Linie in Segmentfarbe;
    dasselbe Segment zweimal geöffnet = zwei verschiedene Verläufe.
  - Lava-Bildfolge über ~15 s (dark und light).
  - Nachweis, dass in 16:9, 9:16, bei Fokus auf ein **randnahes** Segment und
    auf Mobil oben/unten **kein** Helix-Ende sichtbar ist.
- `REPORT.md`: was geändert wurde, Messwerte (Punkte, Draw Calls, FPS
  Idle/Puls, Desktop + Mobile-Emulation), neue Defaults. `HANDOFF.md`
  aktualisieren. Danach STOPPEN — keine Integration nach Tidal.
