# Auftrag: DeepFight-Helix — Neuaufbau des Looks: PARTIKEL-HELIX statt Röhren

Du überarbeitest den Prototyp in `D:\DeepFight-Helix`. Dieser Text + zwei zu
lesende Dateien sind alles — kein früherer Chat nötig.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— **§0 (Arbeitsregeln) und §0b (Skills) gelten unverändert und absolut**
(`D:\Tidal-Athletics\` nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben, Spiegel-Dateien byte-identisch, Props nur
ergänzen, Mobile-/Fallback-Mechanik erhalten). Danach `REPORT.md` und den
aktuellen Code lesen.

## 1. Warum dieser Auftrag ein Kurswechsel ist

Zwei Iterationen haben solide Röhren-Geometrie poliert — der Nutzer hat sie
abgelehnt: „hat nicht viel mit meiner Vorstellung zu tun". Der Kern des
Problems: In seinen Referenzbildern sind die Stränge **aus tausenden
glitzernden Körnern aufgebaut** (kristallin, volumetrisch, staubig-leuchtend).
Eine glatte Röhre mit aufgesetztem Funkeln kann das nicht treffen.

**Deshalb: Die sichtbare Helix wird komplett aus Partikeln GEBAUT.** Solide
Meshes bleiben höchstens als unsichtbare/sehr dunkle Stützkörper für Tiefe
und Verdeckung. Wirf den Röhren-Look weg — auch wenn es viel vom letzten
Umbau rückgängig macht. Das Modell (`lib/fight-dna-helix.ts`) und die
Props-API bleiben unangetastet.

## 2. Der Partikel-Aufbau

### 2.1 Stränge
- Helix-Kurve in ~400 Schritte sampeln; pro Schritt **30–60 Punkte** in einer
  gaußverteilten Schale um die Strang-Mittellinie streuen (Kern dicht, nach
  außen schnell ausdünnend, wenige Ausreißer als „Staub") → **pro Strang
  ~12.000–20.000 Punkte, beide Stränge in EINEM `Points`-Objekt** mit
  eigenem `ShaderMaterial`:
  - Punktgröße: klein, tiefenabhängig (`sizeAttenuation`-Verhalten im
    Shader), Kern-Punkte etwas größer als Staub.
  - Additives Blending, weiche runde Sprite-Form (im Fragment-Shader
    berechnet, keine Textur nötig).
  - Farbe: Verlauf entlang des Strangs (Athlet: `--accent` → `--accent-2`;
    Gegner neutral; im Split-Modus die `--cat-*`-Bänder) + leichte
    Helligkeits-Varianz pro Korn.
  - **Twinkle**: jedes Korn moduliert sein Alpha individuell (Hash aus
    Index + Zeit), plus Mikro-Jitter der Position (< 0,01) → das permanente
    „1000-Ameisen-Flimmern" ist damit eingebaut, nicht aufgesetzt.
- Optional UNTER den Partikeln: die alte Röhre als sehr dunkler, fast
  schwarzer Körper (`opacity` ≈ 0,25, keine Highlights) — nur damit die
  Rückseite der Helix verdeckt wird und das Volumen greifbar bleibt.

### 2.2 Sprossen
- Gleiche Technik: Punkte entlang der Sprossen-Linie gestreut (dicht am
  jeweiligen Strang-Ende, damit der Übergang verschmilzt — kein sichtbarer
  „Steckpunkt").
  - **Beantwortet:** dichte, helle Partikel-Stäbe (~200 Punkte je Sprosse)
    mit Kern-Glow.
  - **Unbeantwortet:** ~40 dünn gestreute, dunkle Geister-Punkte, von denen
    ständig einzelne abdriften (Auflösungs-Effekt).
- Sprossen-Punkte leben im selben `Points`-Objekt oder einem zweiten —
  **insgesamt maximal 3 `Points`-Draws** für die ganze Szene (Stränge +
  Sprossen + Fern-Bokeh).

### 2.3 Proportion & Kamera
- **Maximal ~1,5–2 Windungen im Bild**, Helix oben/unten beschnitten,
  Kamera näher dran als jetzt — die Helix soll das Format füllen und
  monumental wirken, nicht als ganzes Objekt „ausgestellt" sein.

### 2.4 Energie-Impulse
- Alle 3–8 s läuft eine **Helligkeitswelle** durch die Strang-Partikel:
  Shader-Uniform `pulseT` (Position entlang der Kurve); Körner nahe der
  Welle leuchten stark auf und ziehen einen kurzen Schweif. Kein extra
  Geometrie-Aufwand — nur Uniform + Shader. Selten zusätzlich ein greller
  Kurz-Blitz über eine zufällige beantwortete Sprosse.
- Pausiert außerhalb des Viewports und bei reduced-motion.

### 2.5 Wachstums-Moment
- Neu beantwortete Sprossen (`grownQuestionIds`): ihre Partikel starten weit
  gestreut (aus dem Bokeh-Raum), fliegen ein und verdichten sich zum
  Stab (~1,2 s, gestaffelt), Abschluss-Puls über die Welle aus 2.4.

## 3. Aus Runde 3 übernehmen (prüfe in `REPORT.md`, was schon umgesetzt ist)

Diese Anforderungen aus
`docs/deepfight-helix-codex-prompt-3.md` (§3.5–3.7) gelten weiter — falls
schon gebaut, erhalten; falls nicht, jetzt umsetzen:
1. **Lavalampen-Hintergrund** (§3.5): 2–3 geblurte Blobs, langsame organische
   Drift + Form-Morph, nur `transform`/`opacity`/`border-radius`,
   reduced-motion stoppt.
2. **Light-Theme als eigene Abstimmung** (§3.6): Partikel-Helix auf hellem
   Grund heißt: Körner dunkler und satter (Richtung Token-Vollton, kaum
   Weiß-Zumischung), additive Überstrahlung stark reduzieren (sonst milchig),
   `--cat-*`-Light-Werte unverfälscht, kein Farbschleier auf Weiß.
3. **HUD-Callout nach Referenz** (§3.7): abgeschrägte Karte mit Brackets,
   „n / gesamt", Rauten-Trennlinie, Prozent-Fußzeile, Clip-Reveal +
   gezeichnete Leader-Linie.

## 4. SVG-Glyph
- `HelixGlyph.tsx` deutet den neuen Look an: Stränge als Punkt-Ketten
  (gestrichelte/gepunktete Pfade, `stroke-dasharray`), Sprossen als Punktreihen
  — kein Filter-Feuerwerk, aber erkennbar dieselbe „aus Körnern gebaute" DNA.

## 5. Budget
- **≤ 8 Draw Calls, ≤ 45.000 Punkte gesamt (max. 3 `Points`-Objekte),
  Dreiecke jetzt nebensächlich** (< 20k, nur Stützkörper). `dpr={[1, 2]}`.
- Shader-Twinkle läuft im Idle-Demand-Takt (~24 fps); Mobile-Emulation
  testen — Punkte-Shader sind füllratenlastig: bei Bedarf Punktzahl per
  `size="sm|md|lg"` staffeln.
- Alle Schutzpfade (Viewport, Visibility, Kontextverlust → Glyph,
  reduced-motion → Glyph) erhalten und erneut testen; alles `dispose()`-en.

## 6. Dev-Seite
- Regler: Partikeldichte (Stränge/Sprossen getrennt), Schalen-Streuung
  (eng = definierter Strang, weit = staubig), Twinkle-Intensität,
  Puls-Frequenz. Final gewählte Werte werden Defaults (im Bericht nennen).

## 7. Abnahme & Bericht
- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber;
  Spiegel-Dateien byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- Screenshots in `report/`: Dark + Light, Nahaufnahme der Kornstruktur,
  Fokus mit HUD-Karte, Puls-Welle (Bildfolge/WebM), Wachstums-Moment.
- `REPORT.md`: was der Kurswechsel ersetzt hat, Messwerte (Punkte, Draw
  Calls, FPS Idle/Puls, Desktop + Mobile-Emulation). `HANDOFF.md`
  aktualisieren. Danach STOPPEN — keine Integration nach Tidal.
