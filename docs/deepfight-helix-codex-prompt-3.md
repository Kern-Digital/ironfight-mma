# Auftrag: DeepFight-Helix — Feedback-Runde 2 (organischer, lebendiger, Light-Fix)

Du überarbeitest den bestehenden Prototyp in `D:\DeepFight-Helix` nach
Nutzer-Feedback. Dieser Text + zwei zu lesende Dateien sind alles — du
brauchst keinen früheren Chat.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— dort gelten **§0 (Arbeitsregeln) und §0b (Skills) unverändert und absolut**:
`D:\Tidal-Athletics\` ist nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben (kein Hex/rgb in Übergabe-Dateien),
Spiegel-Dateien byte-identisch, Props nur ergänzen, Mobile-/Fallback-
Mechanismen erhalten, Skills `$r3f-shaders`/`$r3f-materials`/`$r3f-lighting`/
`$r3f-animation` nutzen (bei Widerspruch gewinnt §0). Danach `REPORT.md` und
den aktuellen Code lesen (`components/deepfight/*`, `app/page.tsx`,
`app/globals.css`).

## 1. Nutzer-Feedback zum aktuellen Stand (das ist zu fixen)

1. **Hintergrund ist statisch.** Die grünen/violetten Lichtflächen (oben
   rechts, unten links) sollen sich **wie Flüssigkeit in einer Lavalampe**
   bewegen — sehr langsam, organisch, ineinanderfließend.
2. **Die Helix ist immer noch zu stark gedreht** — im Bild sind ~5 Windungen
   sichtbar, es wirkt weiter wie ein gedrehter Turm.
3. **Die Sprossen wirken nicht organisch mit den Strängen verbunden** — sie
   sehen aus wie lose eingesteckte Stäbe.
4. **Die Stränge selbst treffen den gewünschten Look nicht** — Referenz sind
   organisch-kristalline, körnig glitzernde Oberflächen, keine glatten
   Plastikröhren.
5. **Light-Theme: Farben passen nicht** — verwaschene, schmutzige Töne auf
   hellem Grund.
6. **Segmentfokus-Callout sieht nicht gut aus** — Ziel ist exakt die
   Referenz-HUD-Karte („DEFENSIVE REACTIONS · 5 / 6").
7. **Die DNA soll leben:** (a) hin und wieder sollen **Lichter/Blitze durch
   die Helix schießen**; (b) die gesamte Oberfläche soll permanent subtil
   **flimmern/glitzern, „als würden 1000 Ameisen darunter krabbeln"**.

## 2. Referenzbilder (angehängt; falls nicht sichtbar, hier beschrieben)

- **HUD-Karte:** dunkle, halbtransparente Karte mit abgeschrägten Ecken und
  feinen Eck-Winkeln („Brackets"), Titel Versalien, Untertitel normal, große
  Zeile „5 / 6" (5 in Akzent-Violett), Trennlinie mit Raute in der Mitte,
  darunter „PROFILSTÄRKE **68 %**"; Leader-Linie mit Knick und Raute.
- **Blaue Makro-DNA:** Strang und Sprossen bestehen aus tausenden feinen,
  glitzernden Kristallkörnern; Kanten funkeln; unscharfe Helix im Hintergrund.
- **Violette Neon-DNA:** kräftiges Violett/Pink, Sprossen als Leuchtstäbe,
  Partikel lösen sich vom Strang, dunstiger farbiger Hintergrund.
- **Rosa organische DNA:** weiche, fast biologische Oberfläche mit
  Körnung/Noppen, kräftiger Lens-Glow an einer Stelle, violetter Nebel.

Gemeinsamer Nenner: **körnig-kristalline, lebendige Oberfläche + farbiger,
weicher, bewegter Hintergrund** — keine glatten CAD-Röhren.

## 3. Änderungen

### 3.1 Windungen reduzieren (Fix 2)
- Sichtbar im Frame: **maximal ~1,5–2 Windungen**. `HELIX_TURNS` auf ≈ 2 über
  die Gesamtlänge, Ganghöhe entsprechend strecken; Kamera so rahmen, dass die
  Helix oben/unten beschnitten ist. Die 60 Sprossen bleiben — sie dürfen
  dichter stehen (Referenzbilder zeigen viele Sprossen pro Windung).

### 3.2 Organische Verbindungen (Fix 3)
- Sprossen-Enden **in den Strang hineinlaufen lassen** (Überlappung bis zur
  Strang-Mittellinie) und am Übergang eine kleine **Gelenk-Kugel** (~1,3 ×
  Sprossenradius) setzen, gleiche Materialfamilie wie der Strang — der
  Übergang muss wie gewachsen aussehen, nicht wie gesteckt.
- Sprossen leicht ballig (in der Mitte minimal dicker oder Kapselform),
  minimale zufällige Winkelabweichung (±2–3°) pro Sprosse gegen den
  „Leiter-aus-dem-Baumarkt"-Eindruck.

### 3.3 Kristallin-organische Stränge (Fix 4) + „Ameisen-Flimmern" (Fix 7b)
- **Oberflächen-Funkelhaut:** zusätzliche `Points`-Ebene, deren Partikel AUF
  der Strang- und Sprossen-Oberfläche sitzen (Positionen aus der Geometrie
  gesampelt, ~1200–2000 Stück, sehr klein, additiv). Im Shader: jedes Korn
  twinkelt individuell (Hash aus Index + Zeit → Alpha 0,1–1,0) und jittert
  minimal (< 0,01 Einheiten) über die Oberfläche. Das ergibt zusammen das
  Kristall-Glitzern der Referenz UND das permanente „Ameisen-Flimmern".
- Dazu **sehr subtiles Vertex-Noise-Wobbeln** der Strang-Röhre selbst
  (Shader-Displacement < 3 % des Strangradius, langsam) — die Silhouette
  darf leicht „atmen", nie deutlich wabern.
- Materialbasis bleibt metallisch-glasig mit Fresnel-Rim; `roughness` etwas
  erhöhen und die Funkelhaut liefert die Körnung. Keine Bilddatei-Texturen —
  alles prozedural.
- Das Flimmern läuft im Idle-Takt (~24 fps) mit; bei `forceRenderer="svg"`,
  reduced-motion und Hintergrund-Tab entfällt es (bestehende Mechanik).

### 3.4 Energie-Blitze (Fix 7a)
- Alle **3–8 s (zufällig)** schießt ein **Lichtimpuls** einen Strang entlang:
  heller Kopf-Sprite + kurzer Schweif (4–6 additive Sprites entlang der
  Kurve, Lebensdauer ~0,8 s), Farbe `--accent` bzw. `--accent-2` im Wechsel;
  beim Passieren leuchten die berührten Sprossen-Halos kurz auf.
- Selten (ca. jeder 4. Impuls) zusätzlich ein **Quer-Blitz** über eine
  zufällige beantwortete Sprosse (kurzes grelles Aufleuchten + Mini-Flare).
- Impulse pausieren außerhalb des Viewports/bei reduced-motion; Frequenz als
  Konstante, über die Dev-Seite regelbar.

### 3.5 Lavalampen-Hintergrund (Fix 1)
- Die Ambient-Glows hinter dem Canvas (aus `--ambient-fight`-Farben) werden
  **2–3 einzelne, stark geblurte Blobs** (eigene absolut positionierte
  Elemente): sehr langsame, organische Bewegung — Position driftet (20–40 s
  pro Zyklus), Form morpht (`border-radius`-Keyframes), Blobs fließen
  ineinander. **Nur `transform`/`opacity`/`border-radius` animieren** (GPU,
  akku-schonend), `prefers-reduced-motion` stoppt die Animation (Tidal-Regel).
- Farben: Gym-Akzent und `--accent-2` mit Hintergrund-Token gemischt; im
  Light-Theme deutlich zurückhaltender (siehe 3.6).
- Zusätzlich dürfen die Fernfeld-Bokeh-Partikel im Canvas farblich mit den
  Blobs korrespondieren, damit Vorder- und Hintergrund eine Welt sind.

### 3.6 Light-Theme-Farben reparieren (Fix 5)
- Grundsatz: Light ist eine **eigene Abstimmung**, kein heruntergedimmtes
  Dark. Konkret: Stränge in Richtung `--text-1` abgedunkelt mit klarem
  Akzent-Rim; Split-Bänder nutzen die Light-Werte der `--cat-*`-Tokens
  unverfälscht (kein Weiß-Mix, der sie schmutzig macht); Funkelhaut und
  Halos stark reduziert (sonst unsichtbar/milchig); Nebel und Vignette aus
  den hellen `--bg`-Tokens — KEIN grünlicher Schleier auf Weiß; Lavalampen-
  Blobs pastellig-dezent. Vor dem Screenshot beide Themes nebeneinander
  vergleichen: kein Farbstich, keine „verwesten" Mischtöne.

### 3.7 HUD-Callout nach Referenz (Fix 6)
- Karte neu bauen, exakt nach Referenzbild: Fläche `--bg-1` mit Transparenz
  (`color-mix`) + leichtem Blur (`backdrop-filter`, mit Fallback ohne),
  abgeschrägte Ecke oben-links und unten-rechts (`clip-path`), 1-px-Rahmen
  `--line-strong`, zusätzlich **feine Eck-Brackets** in `--accent-2` an zwei
  Ecken; innen: Titel (Versalien, `--font-display`), Hint (`--text-2`,
  normale Schreibung), große Zeile „n / gesamt" (n in `--accent-2`, „/ gesamt"
  in `--text-3`, Mono), **Trennlinie mit Raute in der Mitte**, Fußzeile
  Label (Versalien, `--text-3`) + Prozent (Mono, `--accent-2`).
- Einblendung: Karte klappt mit kurzem Clip-Reveal auf (~200 ms), die
  Leader-Linie **zeichnet sich** vom Helix-Anker zur Karte (~250 ms,
  stroke-dashoffset), Raute am Anker pulst einmal. reduced-motion: alles
  sofort sichtbar.
- Light-Theme: helle Karte (`--bg-1` Light) mit denselben Strukturen —
  nicht die dunkle Karte auf hellem Grund erzwingen.

## 4. Budget-Anpassung
- Wegen Funkelhaut: **≤ 12 Draw Calls, ≤ 100k Dreiecke, ≤ 2500 Punkte gesamt
  (max. 3 `Points`-Objekte)**, `dpr={[1, 2]}` bleibt.
- Idle bleibt Demand-Loop ~24 fps; Blitz-Impulse und Fokus-Fahrt dürfen kurz
  volle Framerate anfordern. FPS-/Draw-Call-Anzeige beibehalten.
- Alles Neue `dispose()`-en; Kontextverlust-, Visibility-, Intersection- und
  reduced-motion-Pfade erneut testen.

## 5. Dev-Seite ergänzen
- Neue Regler: Blitz-Frequenz, Funkel-Intensität (Twinkle-Alpha), Wobbel-
  Stärke, Lavalampen-Tempo. Final gewählte Werte werden Komponenten-Defaults
  (im Bericht nennen).

## 6. Abnahme & Bericht
- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan leer
  bzw. nur erlaubte Module; Spiegel-Dateien byte-identisch; `package.json`
  unverändert; `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short`
  leer.
- Screenshots in `report/`: Dark + Light (beide MIT sichtbarem Lavalampen-
  Hintergrund), Fokus mit neuer HUD-Karte (Dark + Light), Nahaufnahme der
  Funkelhaut, Blitz-Moment (Bildfolge oder kurzes WebM).
- `REPORT.md`: pro Feedback-Punkt 1–7 kurz, was geändert wurde; Messwerte
  (Draw Calls, Dreiecke, Punkte, FPS Idle/Blitz). `HANDOFF.md` um neue
  Props/Konstanten ergänzen.
- Danach STOPPEN und melden — keine Integration nach Tidal.
