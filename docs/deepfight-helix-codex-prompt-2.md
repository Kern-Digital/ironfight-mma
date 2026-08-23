# Auftrag: DeepFight-Helix — Visuelle Überarbeitung („organisch statt Drahtgitter")

Du übernimmst einen bestehenden, technisch fertigen Prototyp und überarbeitest
ihn **optisch**. Dieser Text ist vollständig — du brauchst keinen früheren
Chat.

## 0. Arbeitsregeln (ABSOLUT)

- **Arbeitsordner: `D:\DeepFight-Helix\`** — ein eigenständiges Next.js-14-
  Projekt (React 18, TypeScript strict, Tailwind 3.4, three 0.184,
  `@react-three/fiber` v8, `@react-three/drei` 9, framer-motion 12).
  `node_modules` ist installiert; `npm run dev`, `npm run build`,
  `npm run typecheck` existieren.
- **`D:\Tidal-Athletics\` ist NUR-LESEN.** Das ist die Ziel-App (Tidal
  Athletics). Du darfst dort lesen, aber NICHTS anlegen, ändern, löschen,
  formatieren, installieren oder per `git` anfassen — auch keine „harmlosen"
  Korrekturen. Am Ende prüfst du mit
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short`, dass die
  Ausgabe leer ist, und nennst das im Bericht.
- **Keine neuen Dependencies** (`package.json` unverändert). KEIN
  `@react-three/postprocessing`, kein Bloom-Pass, kein Upgrade von
  fiber/drei/react.
- **Spiegel-Dateien nicht anfassen:** `lib/gegner-dna.ts`, `lib/fight-stats.ts`,
  `lib/discipline-colors.ts`, `lib/types.ts`, `components/ui/Icon.tsx` sind
  byte-identische Kopien aus Tidal (Liste in `MIRROR.md`). Sie bleiben
  identisch. Fehlt dir etwas, gehört es in die Übergabe-Dateien.
- **Übergabe-Dateien** (werden später unverändert nach Tidal kopiert):
  `lib/fight-dna-helix.ts`, `components/deepfight/FightDnaHelix.tsx`,
  `HelixScene.tsx`, `HelixGlyph.tsx`, `use-resolved-tokens.ts`, `HANDOFF.md`.
  Sie dürfen nur importieren aus `@/lib/gegner-dna`, `@/lib/fight-stats`,
  `@/lib/discipline-colors`, `@/lib/types`, `@/components/ui/Icon`,
  untereinander, sowie `react`, `three`, `@react-three/fiber`,
  `@react-three/drei`, `framer-motion`, `next/dynamic`. Nichts anderes.
- **Token-only-Farben:** Alle Farben kommen aus CSS-Variablen
  (`app/globals.css`: `--accent`, `--accent-2`, `--cat-1..5`, `--bg-0..2`,
  `--text-1..3`, `--line`, `--line-strong`, `--glow-sat`, `--ambient-fight`,
  `--grad-fight`). three.js kann die `oklch()`-Werte nicht lesen — dafür gibt
  es `components/deepfight/use-resolved-tokens.ts` (löst Tokens per
  `getComputedStyle` auf und reagiert auf Theme-Wechsel über das Attribut
  `data-theme` am `<html>`). **Kein Hex, kein `rgb(`, keine three-
  Farbkonstante** in Übergabe-Dateien — Prüfung:
  `grep -riE '#[0-9a-f]{3,8}|rgb\(' lib/fight-dna-helix.ts components/deepfight`
  muss leer bleiben.
- **Dark und Light gleichwertig** (Theme-Toggle auf der Dev-Seite). Light ist
  das größte Risiko: Neon verwäscht auf Hell — separat abstimmen.
- **Mobile/Native-Ready** (die App läuft später via Capacitor in iOS-WKWebView
  und Android-WebView): `dpr={[1, 2]}`, `frameloop="demand"` im Idle,
  Rendern stoppt außerhalb des Viewports und im Hintergrund, Kontextverlust
  → SVG-Fallback, `prefers-reduced-motion` → SVG-Fallback, `touch-action:
  pan-y` (vertikales Wischen scrollt die Seite), alles `dispose()`-en. Diese
  Mechanismen existieren bereits — erhalten und erneut prüfen.
- **Konventionen:** `"use client"` bei Hooks, Imports über `@/`, Komponenten
  Default-Export, Utilities benannte Exports, UI-Texte Deutsch, Code
  Englisch, **keine Emojis**, Icons nur aus `@/components/ui/Icon`,
  Versalien nur für Überschriften/Labels/Buttons, Fonts über
  `--font-display` / `--font-sans` / `--font-mono` / `--font-archivo`.
  Touchziele ≥ 44 px, keine Hover-only-Funktionen.
- **Props-API von `FightDnaHelix` bleibt bestehen** (ergänzen erlaubt,
  entfernen nicht): `profile`, `variant`, `size`, `mode`, `focusCategoryId`,
  `grownQuestionIds`, `onFocusChange`, `forceRenderer`, `className`.

## 0b. Skills

Nutze die installierten Skills `$r3f-shaders` (Fresnel-Rim, Partikel-Shader,
Uniforms), `$r3f-materials`, `$r3f-lighting` und `$r3f-animation` aus dem
Paket `EnzeD/r3f-skills` (verifiziert für R3F 8.x / Drei 9.x / React 18 —
exakt unser Stand). Falls ein Skill etwas vorschlägt, das den Regeln in §0
widerspricht (Postprocessing, `Environment`-Presets aus dem Netz, neue
Dependencies, Hex-Farben), gilt §0.

## 1. Zuerst lesen (nur lesen)

1. `D:\DeepFight-Helix\HANDOFF.md`, `REPORT.md`, `MIRROR.md` — was gebaut
   wurde und warum.
2. `lib/fight-dna-helix.ts` — das Modell: 9 Segmente (= Kategorien aus
   `DNA_CATEGORIES`), 60 Sprossen (= Fragen; `answered` = beantwortet),
   `bands` (= Fight-DNA-Split in den fünf Disziplinfarben `--cat-1..5`),
   `completeness` (einzige Prozentquelle: `dnaCompleteness()`), `depth`.
   **Das Modell bleibt, wie es ist.**
3. `components/deepfight/HelixScene.tsx` (R3F-Renderer), `HelixGlyph.tsx`
   (SVG-Zwilling), `FightDnaHelix.tsx` (Wrapper, Renderer-Wahl, Callout),
   `use-resolved-tokens.ts`.
4. `app/page.tsx` (Dev-Seite mit Mock-Profilen, Slider, Fokus-Buttons,
   Theme-/Renderer-Toggle), `app/globals.css` (Token-Spiegel).
5. Zum Verständnis der Ziel-App (nur lesen!):
   `D:\Tidal-Athletics\Tidal-Athletics-App\docs\DESIGN-BRIEF.md` und
   `components/trainer/FightProfileView.tsx`.

## 2. Was am aktuellen Stand nicht stimmt (Diagnose)

Technik ist solide (Modell, Fallbacks, 3 Draw Calls). Aber das Bild wirkt
wie eine **Drahtgitter-Treppe oder ein Turm**, nicht wie DNA. Ursachen in
`HelixScene.tsx`:

1. **Rückgrat ist `LineSegments` + `lineBasicMaterial`** — WebGL rendert
   Linien immer 1 px dünn. Die Stränge haben keinen Körper, kein Licht,
   keinen Glanz.
2. **Zu viele Windungen auf zu engem Radius:** `HELIX_TURNS = 4.4`,
   `HELIX_RADIUS = 0.78`, `HELIX_HEIGHT = 6.8`. Echte DNA: Ganghöhe zu
   Durchmesser ≈ 1,7 — aktuell ≈ 1,0 → Wendeltreppe.
3. **Sprossen hauchdünn** (Radius ≈ 0,026), ohne Leuchtkern und Halo → Stufen.
4. **Partikel zu spärlich** (3 pro offener Sprosse, 9 beim Wachstum), eine
   Ebene, keine Tiefenstaffelung, kein Bokeh.
5. **Kein Nebel, keine Beleuchtung, kein Raum** — die Helix steht flach vor
   einer CSS-Fläche; der Hintergrund gehört nicht zum Objekt.

## 3. Zielbild (angehängte Referenzbilder)

Falls du die Bilder nicht sehen kannst, hier die Beschreibung:

- **Referenz A (Gold/Glas-Helix mit Bokeh):** organische Doppelhelix, leicht
  diagonal geneigt; zwei dicke, rund gewölbte Stränge mit glänzender,
  glasig-metallischer Oberfläche; Sprossen als leuchtende Stäbe mit weichem
  Halo; viele kleine scharfe Partikel nah am Strang und große **unscharfe
  Bokeh-Kreise** weiter hinten; dunkler, tiefer Hintergrund, der in den
  Farben der Helix schimmert.
- **Referenz B (Blau/Violett-HUD, „DEFENSIVE REACTIONS 5 / 6"):** vertikale
  Helix mit massiven, facettierten Strängen; ein Segment leuchtet violett
  (Fokus), der Rest dunkelblau-gedimmt; von der Segmentmitte geht eine dünne
  Linie mit kleiner Raute zu einer HUD-Karte mit abgeschrägten Ecken: Titel
  in Versalien, Untertitel in normaler Schreibung, große Zahl „5 / 6" (die 5
  in Akzentfarbe), Trennlinie mit Raute, darunter „PROFILSTÄRKE 68 %". Am
  Fuß der Helix eine leuchtende Bodenplatte mit Ringen; links unten löst
  sich eine Sprosse in eine Partikelwolke auf. Unten rechts eine Leiste aus
  fünf farbigen Balken mit Label „FIGHT DNA" (= Split-Legende).
- **Referenz C (weiße Helix, „Memory Data"):** stark weichgezeichnete,
  überbelichtete Helix als Stimmungsschicht im Hintergrund, Schrift davor
  scharf.

**Gewünscht:** die **organische Körperlichkeit** aus A, die **HUD-Logik und
Fokus-Inszenierung** aus B, und eine **Hintergrundschicht, die zur Helix
gehört** (unscharfe Partikel/Bokeh, Farbschimmer) wie in A/C. Die bereits
vorhandenen schwebenden Partikel gefallen — sie sollen **ausgebaut** werden.

## 4. Konkrete Änderungen

### 4.1 Geometrie & Proportion
- Stränge als **`TubeGeometry`** entlang einer Helix-Kurve (`CatmullRomCurve3`
  oder eigene `Curve`-Subklasse): Strangradius ≈ 0,13–0,16 bei Helixradius
  ≈ 1,0; `radialSegments` 8–10, `tubularSegments` ≈ 60 pro Windung.
- **2,5–3 Windungen über die gesamte Länge** (statt 4,4), Ganghöhe ≈ 1,7 ×
  Durchmesser. Die Helix darf oben und unten **über den Bildrand hinausragen**
  (Kamera zeigt ein Fenster, wie in Referenz B) — monumental statt „Turm auf
  Sockel". Alle Proportionen als benannte Konstanten mit Kommentar.
- 60 Sprossen gleichmäßig verteilt; 9 Segmente wie im Modell. Segmentgrenzen
  dürfen als feine Ringe/Nähte am Strang sichtbar sein (Facetten-Anklang aus
  Referenz B), sehr dezent.
- Sprossen: **Kapsel oder Zylinder mit runden Enden**, Radius ≈ 0,045, die
  NICHT bis zur Strangmitte reichen (kleine Lücke zum Strang, wie in A).
  Beantwortet: heller Leuchtkern (emissiv) + **Halo-Sprite** (additiv,
  Billboard) in der Sprossenmitte. Unbeantwortet: glasig-transparenter
  Geist (Opacity ≈ 0,18) + abdriftende Partikel.
- Neues Prop `tilt` (Grad, Default ≈ 10–14°): leichte Neigung aus der
  Vertikalen wie Referenz A. Schmale Hero-Spalten bleiben vertikal (`tilt={0}`).

### 4.2 Material & Licht (ohne Postprocessing)
- Stränge: `MeshStandardMaterial`/`MeshPhysicalMaterial`, `metalness` ≈ 0,55,
  `roughness` ≈ 0,3, Grundfarbe aus dem Rückgrat-Token (Athlet: `--accent`
  → `--accent-2` als Verlauf entlang des Strangs; Gegner: neutral aus
  `--text-3`/`--line-strong`), `emissive` in derselben Farbe, niedrig.
  Dazu ein **Fresnel-Rim** (kleiner eigener `ShaderMaterial` oder
  `onBeforeCompile`), der die Strangkanten in Akzentfarbe aufleuchten lässt —
  der wichtigste Einzelschritt zum Glas/Metall-Look aus Referenz A.
- Licht: `hemisphereLight` (Himmel = Akzent-Token, Boden = Hintergrund-Token)
  + zwei `pointLight`s in `--accent` und `--accent-2`, + schwaches
  `ambientLight`. Keine Schatten. **Kein drei-`Environment`-Preset** (lädt
  HDR aus dem Netz — in der nativen App nicht erlaubt).
- Glow ausschließlich über **additive Sprites** (kleine radiale Textur, zur
  Laufzeit per Canvas generiert, keine Bilddatei) und Emissive.
- **Bodenplatte** (Referenz B): flache konzentrische Leuchtringe unter der
  Helix (`RingGeometry`, additiv, sehr transparent), die im Takt der Idle-
  Rotation ganz leicht pulsieren. Teil des 3D-Objekts, keine UI-Box.

### 4.3 Partikel in drei Ebenen (ausbauen)
1. **Nahfeld** (scharf, klein, 250–500 Stück): driften langsam entlang und
   um die Helix (leichte Spiralbewegung, Lebensdauer mit Fade-in/-out),
   Farbe aus dem nächsten Segment bzw. Band, `sizeAttenuation` an.
2. **Fernfeld / Bokeh** (groß, weich, 40–80 Stück): hinter der Helix, große
   Sprite-Größe, sehr niedrige Opacity, **weichgezeichnete Sprite-Textur**
   (breiter Gauß-Falloff), extrem langsame Drift — das ist die unscharfe
   Hintergrund-Bestückung. Farben: Akzent/Violett mit dem Hintergrund-Token
   gemischt, damit sie im Light-Theme nicht ausbrennen.
3. **Auflösung & Wachstum:** unbeantwortete Sprossen verlieren ständig
   einzelne Partikel, die nach außen/unten wegdriften (Referenz B links
   unten). Beim Wachstums-Moment (`grownQuestionIds`) fliegen Partikel aus
   dem Fernfeld ein, verdichten sich zur Sprosse, Halo-Puls beim Einrasten —
   mit ≈ 40 Partikeln pro Sprosse und ≈ 1,2 s pro Sprosse, gestaffelt.
- Höchstens zwei `Points`-Objekte (Nah + Fern) mit Vertex-Attributen für
  Größe/Alpha/Phase; Animation im Shader oder per Attribut-Update, keine
  Einzel-Meshes.
- **Szenen-Nebel** (`<fog>` in Hintergrund-Token-Farbe): Fernfeld und
  Strang-Enden verlaufen in den Hintergrund; Tiefe entsteht.

### 4.4 Hintergrund gehört zur Helix
- Canvas mit `gl={{ alpha: true }}`, transparenter Clear. Die Fläche
  dahinter liefert `FightDnaHelix` selbst: Ambient-Schicht aus
  `--ambient-fight` + weiche Vignette zum Rand, im Dark- und Light-Theme
  jeweils passend. Keine harte Kante zwischen Helix-Fläche und Seite — der
  Schimmer läuft sanft aus.
- Die Bokeh-Ebene liegt IM Canvas (dreht/driftet mit, wird vom Nebel erfasst).
- Light-Theme: Stränge dunkler (Grundfarbe Richtung `--text-1`, Rim in
  Akzent), Halos und Bokeh weniger opak, Bodenplatte sehr zurückhaltend.
  Light darf nicht wie „Dark auf Weiß" aussehen — separat abstimmen und
  screenshotten.

### 4.5 HUD-Callout & Split-Legende (Referenz B)
- Callout als HUD-Karte: abgeschrägte Ecken (`clip-path: polygon(...)`),
  1-px-Rahmen aus `--line-strong` mit leichtem Akzent-Glow, Fläche aus
  `--bg-1` mit Transparenz (`color-mix`). Inhalt: Kategorie-Titel
  (Versalien, `--font-display`), Hint (normale Schreibung, `--text-2`),
  große Zeile **„n / gesamt"** (n in `--accent-2`, Rest `--text-3`, Mono),
  Trennlinie mit Raute, darunter Label + Prozent aus `completeness`.
  Label als neues Prop `completenessLabel` (Default „Profilstärke"; Tidal
  zeigt in Zusammenfassungen „DNA n %" — wird bei der Integration entschieden).
- Leader-Linie: dünn, `--line-strong`, ein Knick (erst horizontal, dann
  schräg zur Karte), Raute am Helix-Ende, kleiner Punkt am Karten-Ende;
  Anker weiterhin jedes Frame projiziert. Unter 640 px Breite sitzt die
  Karte UNTER dem Canvas, die Linie läuft nach unten.
- **Split-Legende** als neues Prop `showLegend`: fünf Balken proportional zu
  `dnaSplit`, Farben aus `DNA_SPLIT_META[key].color` (`--cat-*`, **NICHT**
  die Rot/Gelb/Blau-Farben des Referenzbildes), Label „FIGHT DNA" in
  Versalien mit dünnen Linien links/rechts; bei `dnaSplit == null` nicht
  rendern.

### 4.6 SVG-Glyph angleichen
- `HelixGlyph.tsx` übernimmt die neuen Proportionen (Windungen, Ganghöhe,
  dicke Stränge mit Verlauf statt Linien, Sprossen mit Kern + weichem Halo —
  SVG-Filter sparsam einsetzen), damit Hero und Glyph dieselbe Helix zeigen.

## 5. Performance-Budget
- ≤ 10 Draw Calls, ≤ 80k Dreiecke, ≤ 600 Partikel gesamt, `dpr={[1, 2]}`.
- Idle weiterhin `frameloop="demand"` mit niedrigem Takt; Partikel-Drift
  darf im Idle auf ≈ 24 fps laufen. Volle Framerate nur bei Fokus-Fahrt und
  Wachstum.
- Intersection-/Visibility-Stop, Kontextverlust → Glyph, reduced-motion →
  Glyph bleiben erhalten und werden erneut geprüft.
- `dispose()` für alle neuen Geometrien, Materialien, Texturen.

## 6. Dev-Seite (`app/page.tsx`) ergänzen
- Regler für `tilt`, Toggle `showLegend`, Slider für Partikeldichte
  (Nah/Fern) und Glow-Intensität, damit die Stimmung live abgestimmt werden
  kann. Die gewählten Werte werden als Defaults in die Komponente übernommen
  (im Bericht nennen).
- Referenz-Ansichten: `lg` geneigt im Hero-Format (16:9 und 9:16) und `sm`
  Glyph daneben.

## 7. Abnahme & Bericht
- `npm run typecheck` und `npm run build` fehlerfrei; `three` nur in
  dynamischen Chunks.
- Farb-Scan (siehe §0) leer; Import-Scan: nur erlaubte Module.
- Screenshots in `report/`: Dark + Light, Desktop + Mobile, Fokus-Zustand mit
  HUD-Karte, Wachstums-Moment (Bildfolge oder kurzes WebM), Light-Bokeh-Detail.
- Messwerte: Draw Calls, Dreiecke, Partikel, FPS Idle/Animation.
- `REPORT.md` aktualisieren: was gegenüber dem vorherigen Stand geändert
  wurde und warum; welche Referenz-Elemente bewusst NICHT übernommen wurden
  (z. B. Legendenfarben) und weshalb. `HANDOFF.md` um neue Props ergänzen.
- Spiegel-Dateien byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- Danach STOPPEN und Ergebnis melden — keine Integration nach Tidal.
