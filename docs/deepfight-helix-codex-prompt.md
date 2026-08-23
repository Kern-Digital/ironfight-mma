# Auftrag: DeepFight-Helix — 3D-DNA-Visualisierung für Tidal Athletics (Standalone-Prototyp)

## 0. Arbeitsregeln (ABSOLUT, vor allem anderen)

- **`D:\Tidal-Athletics\` ist NUR-LESEN.** Du darfst dort jede Datei lesen, aber
  NICHTS anlegen, ändern, umbenennen, löschen, formatieren oder per Script
  berühren — keine `npm install`, keine Build-Befehle, kein `git`, nichts, in
  diesem Ordner oder einem Unterordner. Auch keine „harmlosen" Korrekturen.
  Wenn du dort einen Fehler findest: im Abschlussbericht notieren, nicht fixen.
- **Dein Arbeitsordner ist `D:\DeepFight-Helix\`** (neu anlegen). Alles, was du
  erzeugst, liegt ausschließlich dort. Die spätere Übernahme in die Tidal-App
  macht ein anderer — deshalb musst du so bauen, dass die fertigen Dateien
  **ohne Änderung** in die Tidal-App kopiert werden können (siehe §2).
- Bevor du fertig meldest, prüfe mit `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short`,
  dass du dort NICHTS verändert hast, und nenne die Ausgabe im Bericht.

## 1. Worum es geht

Die Tidal-Athletics-App (`D:\Tidal-Athletics\Tidal-Athletics-App`, Next.js 14
App Router, React 18, TypeScript strict, Tailwind 3.4, Firebase) hat ein
Feature **DeepFight**: KI-gestützte Kampfanalyse. Jeder Athlet und jeder Gegner
hat ein Kampfprofil aus (a) 60 Freitext-Fragen in 9 Kategorien („Kampf-DNA"),
(b) einem prozentualen Fight-DNA-Split (Boxen/Kicks/Wrestling/Boden/Clinch),
(c) Technik-Zählungen. Du baust die **DeepFight-Helix**: eine DNA-Doppelhelix,
die dieses Profil visualisiert und sichtbar „mit dem Athleten wächst" — ein
zentrales Markenelement der App, im Stil von Videospiel-Interfaces (Zoom auf
ein Segment, Leader-Linie zum Titel, Segmente, die sich aus Partikeln
zusammensetzen).

### Zuerst lesen (nur lesen!), in dieser Reihenfolge
1. `Tidal-Athletics-App/CLAUDE.md` — Architektur, Konventionen, Tech-Grenzen.
2. `Tidal-Athletics-App/docs/DESIGN-BRIEF.md` — harte Design-Regeln.
3. `lib/gegner-dna.ts`, `lib/fight-profile.ts`, `lib/fight-stats.ts`,
   `lib/opponents.ts`, `lib/discipline-colors.ts`, `lib/types.ts` — Datenmodell.
4. `components/trainer/FightProfileView.tsx`, `DnaCategoryGrid.tsx`,
   `FightDnaSplit.tsx`, `DnaCompletenessRing.tsx` — wie DeepFight heute aussieht.
5. `app/globals.css` (Tokens: `--accent*`, `--accent-2`, `--grad-fight`,
   `--ambient-fight`, `--cat-1..5`, `--glow-sat`, `--bg-*`, `--fg*`, `--text-*`,
   `--line*`; Klassen `.t-card-fight`, `.t-ai-badge`), `lib/theme-context.tsx`
   (Theme = Attribut `data-theme="dark|light"` auf `<html>`),
   `app/layout.tsx` (Font-Variablen), `tailwind.config.ts`, `tsconfig.json`.
6. `components/ui/Icon.tsx` — die Icon-Registry (`IconName`).
7. `components/HeroScene.tsx` + `Hero3D.tsx` — vorhandener R3F-Code (toter
   Code, Alt-Branding; nur als Beispiel für das R3F-Setup, NICHT als Vorbild).

## 2. Projektaufbau in `D:\DeepFight-Helix\` (damit die Übernahme ein reines Kopieren ist)

Lege ein eigenständiges Next.js-14-Projekt an, das die Tidal-Umgebung spiegelt:

- **Exakt dieselben Versionen** wie in Tidals `package.json`: `next@14.2.35`,
  `react@18`, `react-dom@18`, `typescript@5`, `tailwindcss@3.4`, `three@0.184`,
  `@react-three/fiber@^8.18` (**v8 — NIEMALS v9/v10, React bleibt 18**),
  `@react-three/drei@^9.122`, `framer-motion@^12`. **Keine weiteren
  Laufzeit-Dependencies** (kein `@react-three/postprocessing`, kein Bloom).
- `tsconfig.json` mit `"paths": { "@/*": ["./*"] }` wie in Tidal, `strict: true`.
- **Zwei Arten von Dateien, strikt getrennt:**

  **(A) Übergabe-Dateien — das eigentliche Ergebnis.** Sie liegen unter
  genau dem Pfad, den sie später in Tidal haben werden, und importieren
  ausschließlich über `@/…`-Pfade, die es in Tidal gibt:
  ```
  lib/fight-dna-helix.ts                  — reines Modell (kein React, kein three)
  components/deepfight/FightDnaHelix.tsx  — Wrapper: wählt Renderer, rendert Callout
  components/deepfight/HelixScene.tsx     — R3F-Renderer (3D)
  components/deepfight/HelixGlyph.tsx     — SVG-Zwilling (2D, Fallback, Listen)
  components/deepfight/use-resolved-tokens.ts — CSS-Token → three.Color (siehe §5)
  components/deepfight/helix.css          — nur falls nötig; sonst Tailwind/Inline
  lib/__tests__/fight-dna-helix.test.ts   — Unit-Tests fürs Modell (optional)
  HANDOFF.md                              — Übernahme-Anleitung (siehe §8)
  ```
  Diese Dateien dürfen **nur** importieren aus: `@/lib/gegner-dna`,
  `@/lib/fight-stats`, `@/lib/discipline-colors`, `@/lib/types`,
  `@/components/ui/Icon`, untereinander, sowie `react`, `three`,
  `@react-three/fiber`, `@react-three/drei`, `framer-motion`, `next/dynamic`.
  **NICHT** importieren: `@/lib/firebase`, `@/lib/fight-profile`,
  `@/lib/opponents`, `@/lib/auth-context`, `@/lib/theme-context` — die Helix
  bekommt Daten nur als Props und liest das Theme über das
  `data-theme`-Attribut (MutationObserver), nicht über den Tidal-Hook.

  **(B) Spiegel- und Dev-Dateien — werden NICHT übernommen.**
  - `lib/gegner-dna.ts`, `lib/fight-stats.ts`, `lib/discipline-colors.ts`,
    `lib/types.ts`, `components/ui/Icon.tsx`: **byte-identische Kopien** aus
    Tidal (`copy`, nicht abtippen). Oben in jeder Kopie KEINEN Kommentar
    einfügen — sie müssen identisch bleiben, damit die Übergabe-Dateien gegen
    genau die echte API kompilieren. Stattdessen eine `MIRROR.md` im Root,
    die die Liste führt. Diese Kopien NIE bearbeiten; fehlt dir etwas,
    gehört es in (A), nicht in die Kopie.
  - `app/globals.css`: Kopie des Token-Teils aus Tidals `globals.css`
    (mindestens `:root`-Tokens Dark + Light, Font-Variablen, `--glow-sat`,
    `--ambient-fight`, `.t-card-fight`, reduced-motion-Blöcke). Fonts: Tidal
    lädt sie per `next/font` in `app/layout.tsx` — spiegle das (gleiche
    Variablennamen `--font-display`, `--font-sans`, `--font-mono`,
    `--font-archivo`, gleiche Google-Fonts).
  - `app/page.tsx` + `app/layout.tsx`: die Dev-Seite (§6) mit eigenem
    Theme-Toggle, der `data-theme` auf `<html>` setzt (genau wie Tidal).
  - `mock/profiles.ts`: Mock-Daten in der Form
    `{ dna: GegnerDnaAnswers; dnaSplit: DnaSplit | null; dnaSplitWeight: number }`.

- Abnahme-Logik: Wenn man die Dateien aus (A) unverändert in die Tidal-App
  kopiert, kompilieren sie dort ohne weitere Änderung. Das ist das Ziel.

## 3. Was die Helix zeigt — feste Lese-Grammatik

Jedes sichtbare Element muss auf ein Profilfeld zurückführbar sein. Eingabe
der Komponente (Prop `profile`): `{ dna, dnaSplit, dnaSplitWeight }` — das ist
die gemeinsame Teilmenge von `FightProfile` (Athlet) und `Opponent` (Gegner).
Eine Komponente für beide; Prop `variant: "athlete" | "opponent"`.

| Helix-Element | Quelle | Regel |
|---|---|---|
| **9 Segmente** entlang des Strangs | `DNA_CATEGORIES` (Reihenfolge beibehalten) | Segmentlänge = Anzahl Fragen der Kategorie (6–8). IDs stabil, nie umbenennen. |
| **Sprossen / Basenpaare** (gesamt `DNA_TOTAL_QUESTIONS` = 60) | eine Frage = eine Sprosse | **beantwortet** (`isAnswered(dna[q.id])`) = massiv, leuchtend; **unbeantwortet** = aufgelöst in Partikel / Ghost-Drahtgitter („zerfallender Strang"). |
| **Füllgrad** | `dnaCompleteness(dna)` aus `lib/gegner-dna.ts` | EINZIGER Rechner. Die Helix rechnet keinen eigenen Prozentwert. Zusammenfassungen zeigen immer Prozent, absolute Zahlen nur als „n / gesamt" im Detail-Callout. |
| **Rückgrat (beide Stränge)** | Athlet: Gym-Akzent → Brand-Violett (`--accent` → `--accent-2`, wie `--grad-fight`). Gegner: neutral (`--text-3` / `--line-strong`) | Branding-fest; der Gegner trägt nicht die Gym-Farbe. |
| **Farbband-Modus** (umschaltbar) | `dnaSplit` | Strang anteilig in den fünf Disziplinfarben `DNA_SPLIT_META[key].color` (= `var(--cat-1..5)`). Reihenfolge `DNA_SPLIT_KEYS`, Farben NUR aus `lib/fight-stats.ts`/`lib/discipline-colors.ts` — KEINE lokale Farbmap. `dnaSplit == null` → Modus deaktiviert. |
| **Dichte / Leuchtkraft** (optional) | `dnaSplitWeight` (Summe der Video-Gewichte, 0 = nichts) | Mehr Evidenz = dichtere, hellere Partikelwolke. Sanft, nie als Zahl behaupten. |

Modell in `lib/fight-dna-helix.ts`:
```ts
export interface HelixRung { questionId: string; categoryId: string; index: number; answered: boolean }
export interface HelixSegment { categoryId: string; label: string; hint: string; start: number; end: number; answered: number; total: number }
export interface HelixBand { key: DnaSplitKey; label: string; colorToken: string; share: number } // share 0..1, Summe 1
export interface HelixModel { rungs: HelixRung[]; segments: HelixSegment[]; bands: HelixBand[] | null; completeness: number; depth: number }
export function buildHelixModel(input: { dna: GegnerDnaAnswers; dnaSplit: DnaSplit | null; dnaSplitWeight?: number }): HelixModel
export function diffHelixModels(prev: HelixModel, next: HelixModel): { grown: string[] } // neu beantwortete questionIds
```
Farben im Modell sind **Token-Namen** (`"--cat-1"`, `"--accent"`), nie Hex,
nie aufgelöste Werte — auflösen tut erst der Renderer.

## 4. Interaktion

- **Ruhezustand:** langsame Rotation um die Längsachse (20–30 s/Umdrehung),
  leichtes Schweben. Neigung per horizontalem Drag (Touch + Maus); vertikales
  Wischen muss die SEITE scrollen (Canvas `touch-action: pan-y`).
- **Fokus auf ein Segment** (Prop `focusCategoryId`, von außen gesteuert —
  später vom `DnaCategoryGrid`): Kamera fährt weich (~600 ms, ease-out) auf
  das Segment, andere Segmente dimmen auf ~25 %, das fokussierte bekommt eine
  leuchtende Kontur. Vom Segment läuft eine **Leader-Linie mit kleiner Raute**
  zu einem **HTML-Callout** außerhalb des Canvas: Kategorie-Titel (Versalien,
  `var(--font-display)`), Hint in normaler Schreibung, „n / gesamt" in Mono.
  Callout ist echtes HTML/SVG-Overlay (drei `<Html>` oder 3D→2D-Projektion),
  NIE 3D-Text; Ankerpunkt wird jedes Frame nachgeführt.
- **Band-Modus** (Prop `mode: "completeness" | "split"`): weicher Morph (~800 ms).
- **Wachstums-Moment** (Prop `grownQuestionIds: string[]`): die Sprossen
  setzen sich aus Partikeln zusammen (einfliegen, verdichten, „einrasten" mit
  Glow-Puls), gestaffelt ~60 ms pro Sprosse. Hier darf es spektakulär sein.
- Tippen direkt auf 3D-Segmente (Raycast) ist Bonus. Primäre Bedienung bleibt
  HTML mit Touchzielen ≥ 44 px. **Keine Hover-only-Funktion.**

Props-Signatur (öffentliche API, in `FightDnaHelix.tsx` dokumentieren):
```ts
interface FightDnaHelixProps {
  profile: { dna: GegnerDnaAnswers; dnaSplit: DnaSplit | null; dnaSplitWeight?: number };
  variant?: "athlete" | "opponent";
  size?: "sm" | "md" | "lg";          // sm = immer SVG-Glyph
  mode?: "completeness" | "split";
  focusCategoryId?: string | null;
  grownQuestionIds?: string[];
  onFocusChange?: (categoryId: string | null) => void;
  forceRenderer?: "auto" | "svg" | "webgl"; // Dev/Test
  className?: string;
}
```

## 5. Technik — feststehende Entscheidungen

### Zwei Renderer, ein Modell
- **`HelixScene` (R3F)** für Hero-Flächen. Genau EIN Canvas pro Seite (Browser
  deckeln WebGL-Kontexte bei ~8–16). IMMER per `next/dynamic` mit `ssr: false`
  laden — `three` darf nie im Initial-Bundle landen.
- **`HelixGlyph` (SVG)**: parametrische Doppelhelix, 2D-projiziert, Tiefe über
  Opacity/Strichstärke, Rotation über Phasenwinkel (nur `transform`/`opacity`).
  Gleiche Grammatik (Segmente, Sprossen an/aus, Bänder), sparsam animiert.
  Einsatz: Listen, Kacheln, Badges, Ladezustand, Fallback.
- **`FightDnaHelix` wählt:** SVG bei `prefers-reduced-motion: reduce`, wenn kein
  WebGL-Kontext erzeugt werden kann, bei `size="sm"`, und solange das
  dynamische Bundle lädt.

### Token-only-Branding (Abnahme-Test: EINE Variable ändern → Helix folgt)
- Alle Farben aus CSS-Variablen. **Kein Hex, kein rgb, keine three-Farbkonstante
  in Übergabe-Dateien.** `grep -riE '#[0-9a-f]{3,8}|rgb\(' lib/fight-dna-helix.ts components/deepfight` muss leer sein.
- Tokens sind `oklch(...)` — three.js kann das nicht parsen. Auflösen zur
  Laufzeit: verstecktes Element, `el.style.color = "var(--cat-1)"`,
  `getComputedStyle(el).color` → `rgb(...)` → `new THREE.Color()`. Hook
  `useResolvedTokens(names)` liest bei Mount UND bei Theme-Wechsel neu
  (MutationObserver auf `data-theme` von `document.documentElement`).
- Glow-Intensität über `--glow-sat` (Light braucht mehr Sättigung).

### Dark UND Light gleichwertig
- Light ist das größte Risiko (Neon auf Hell verwäscht): dunkleres Rückgrat,
  Glow-Sprites mit `--glow-sat`, Helix auf `--ambient-fight` erden. Nicht
  „Dark-Helix auf Weiß" abliefern. Beide Themes auf der Dev-Seite prüfbar.

### Mobile / Native-Ready (die App läuft später via Capacitor in iOS-WKWebView und Android-WebView)
- `dpr={[1, 2]}`, `frameloop="demand"` im Ruhezustand mit eigenem
  niedrig getaktetem `invalidate()` (24–30 fps Idle), volle Framerate nur bei
  Kamerafahrt/Wachstum.
- Rendern stoppen außerhalb des Viewports (`IntersectionObserver`) und bei
  `visibilitychange` (Hintergrund).
- `webglcontextlost` / `webglcontextrestored` behandeln (iOS wirft Kontexte im
  Hintergrund weg): bei Verlust auf `HelixGlyph` umschalten, bei Rückkehr neu
  mounten. Kein Absturz, kein leeres Rechteck.
- Geometrie sparsam: `TubeGeometry` mit niedriger Segmentzahl oder
  `InstancedMesh` für 60 Sprossen, `Points` mit additivem Blending für
  Partikel. Ziel < 50k Dreiecke, ≤ 3 Draw Calls pro Zustand, keine Schatten,
  kein Postprocessing, keine Texturen außer einem kleinen generierten Sprite.
- Speicher: Geometrien/Materialien bei Unmount `dispose()`.
- Touch: Pointer Events, kein `preventDefault` auf vertikalem Wischen,
  `env(safe-area-inset-*)` beim Callout-Layout.
- Keine APIs, die in WebViews fehlen können: kein WebGPU, kein
  SharedArrayBuffer, kein OffscreenCanvas-Zwang.

### Code-Konventionen (aus CLAUDE.md, gelten für Übergabe-Dateien)
- `"use client"` auf allen Komponenten mit Hooks; Imports über `@/`.
- Komponenten = Default-Export, Utilities = benannte Exports.
- UI-Texte Deutsch, Code Englisch. **Keine Emojis** — Icons nur aus
  `@/components/ui/Icon` (`IconName`). Versalien nur für Überschriften/Labels/
  Buttons; Untertitel/Hints in normaler Schreibung.
- Typo: `--font-display` (Überschriften, max. Gewicht 700), `--font-sans`,
  `--font-mono`, `--font-archivo` (Labels/Buttons). Text `--fg`, `--fg-2..4`
  bzw. `--text-1..3`; Flächen `--bg-0..2`; Linien `--line`/`--line-strong`.
- Keine gerahmten Panel-Boxen um statischen Inhalt (Flach-Regel) — die Helix
  liegt flach auf dem Seitenhintergrund, ggf. auf `--ambient-fight`.
- Die DeepFight-Wordmark nicht nachbauen und die Helix nicht mit ihr verschmelzen.

## 6. Dev-Seite (`app/page.tsx` im Prototyp — wird nicht übernommen)

- Drei Mock-Profile (leer / ~30 % / ~90 %, mit und ohne `dnaSplit`) aus
  `mock/profiles.ts`, in der Form des echten Datenmodells (Frage-IDs aus
  `DNA_CATEGORIES`, plausible deutsche Antworten).
- Steuerung: Slider 0–100 % (füllt Sprossen in Katalogreihenfolge), 9 Buttons
  für `focusCategoryId`, Toggle Modus, Button „Wachstum abspielen" (+5
  zufällige Sprossen via `diffHelixModels`), Theme-Toggle (`data-theme`),
  Toggle Renderer auto/svg/webgl, Variant Athlet/Gegner, Anzeige FPS und
  Draw Calls (`gl.info.render`).
- `size`-Varianten nebeneinander: `lg` (Hero, 3D) und `sm` (Glyph, 64–96 px).

## 7. Abnahme (selbst ausführen, Ergebnisse im Bericht nennen)

- [ ] `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` zeigt
      keine von dir verursachte Änderung; es existiert keine neue Datei unter
      `D:\Tidal-Athletics\`.
- [ ] Spiegel-Dateien byte-identisch zu Tidal (z. B. `fc` / Hash-Vergleich),
      Liste in `MIRROR.md`.
- [ ] `npx tsc --noEmit` ohne Fehler; `npm run build` läuft; `three` nur im
      dynamischen Chunk, nicht im Initial-Bundle.
- [ ] Übergabe-Dateien importieren nur die in §2(A) erlaubten Module (grep).
- [ ] Kein Hex/rgb in Übergabe-Dateien (grep leer). `--accent`-Hue in der
      Spiegel-`globals.css` ändern → Rückgrat folgt in Dark und Light.
- [ ] Dark und Light geprüft (Screenshots im Bericht), Light nicht verwaschen.
- [ ] `prefers-reduced-motion` → SVG-Glyph ohne Animation; Kontextverlust
      (`WEBGL_lose_context`) → Glyph-Fallback ohne Fehler.
- [ ] Idle: außerhalb des Viewports / Hintergrund-Tab keine Draw Calls.
- [ ] Vertikales Wischen über dem Canvas scrollt die Seite (Mobile-Emulation).
- [ ] `dnaCompleteness()` und Sprossenzählung stimmen für alle Mocks überein
      (Test oder Assertion).
- [ ] Keine Emojis, kein Hover-only, Touchziele ≥ 44 px.
- [ ] `package.json` des Prototyps enthält keine Dependency, die Tidal nicht
      schon hat (außer Dev-Tooling für Tests).

## 8. Abschluss: `HANDOFF.md` + Bericht

`HANDOFF.md` im Prototyp-Root: exakte Liste der Übergabe-Dateien mit
Zielpfad in Tidal, die Props-API, welche Tidal-Module sie importieren, was
bei der Integration zu tun ist (z. B. `FightDnaHelix` in
`components/trainer/FightProfileView.tsx` oberhalb der Blöcke einhängen,
`focusCategoryId` an `DnaCategoryGrid` koppeln, Einsatz in
`OpponentProfileView`, `MatchupBlock`, Analyse-Loader `.ai-loader-*`,
Trainer-Grid mit Glyphen) — **aber nur beschreiben, nicht tun.**

Bericht: angelegte Dateien, Gestaltungsentscheidungen mit Begründung,
gemessene Performance (Dreiecke, Draw Calls, FPS Idle/Animation in
Desktop-Chrome und Mobile-Emulation), bekannte Schwächen, und die
`git status`-Ausgabe aus §0.
