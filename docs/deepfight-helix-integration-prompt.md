# Auftrag: DeepFight-Helix in die Tidal-App integrieren

> Dieser Text ist der Start-Prompt für eine **neue Claude-Code-Session** im
> Projekt `d:\Tidal-Athletics`. Er enthält alles Nötige — kein früherer Chat
> erforderlich.

## 1. Was ist passiert

Die 3D-DNA-Helix („DeepFight-Helix") wurde über elf Runden in einem
**Standalone-Prototyp** unter `D:\DeepFight-Helix` entwickelt (Next 14, React 18,
react-three-fiber v8, alles aus Partikeln, kein Postprocessing). Leon hat den
Look am 2026-08-26 **abgenommen**. Jetzt geht es um den Einbau in die echte App
unter `D:\Tidal-Athletics\Tidal-Athletics-App`.

**Lies zuerst diese drei Dateien im Prototyp:**
- `D:\DeepFight-Helix\ABGENOMMENE-WERTE.md` — die 41 freigegebenen Reglerwerte
  (stehen bereits als Defaults in den Komponenten)
- `D:\DeepFight-Helix\REPORT.md` — was die Szene kann und wie sie gebaut ist
- `D:\DeepFight-Helix\MIRROR.md` — welche Dateien Kopien aus Tidal sind

## 2. Was übernommen wird

Aus `D:\DeepFight-Helix` nach `Tidal-Athletics-App`, Pfade bleiben gleich:

| Datei | Rolle |
|---|---|
| `components/deepfight/FightDnaHelix.tsx` | öffentliche Komponente (Props-API, HUD, Lava, Fallback-Logik) |
| `components/deepfight/HelixScene.tsx` | WebGL-Renderer (lazy geladen, `ssr: false`) |
| `components/deepfight/HelixGlyph.tsx` | SVG-Zwilling (reduced-motion, kein WebGL, `size="sm"`, Kontextverlust) |
| `components/deepfight/use-resolved-tokens.ts` | löst CSS-Tokens zur Laufzeit in `THREE.Color` auf (three parst kein oklch) |
| `lib/fight-dna-helix.ts` | reines Modell: `buildHelixModel`, `diffHelixModels`, Segmente, Bänder |

**Nicht übernehmen:** `app/page.tsx` (Dev-Labor), `scripts/*`, `mock/*`,
`report/*`, `package.json`, `globals.css` des Prototyps.

**Die fünf Spiegeldateien sind geprüft zeichengleich** (`lib/gegner-dna.ts`,
`lib/fight-stats.ts`, `lib/discipline-colors.ts`, `lib/types.ts`,
`components/ui/Icon.tsx`) — es gibt keinen Konflikt, nichts davon anfassen.

**Aus dem Dev-Labor mit übernehmen, aber angepasst:** Die CSS-Regeln, die die
Helix wirklich braucht (`.settings-dump` und die Panel-Klassen gehören NICHT
dazu). Prüfe, was `FightDnaHelix.tsx` an globalen Klassen erwartet — der
Lava-Block bringt sein `<style>` selbst mit.

## 3. Harte Regeln

- **Die Split-Legende gibt es nicht mehr.** Das Band „FIGHT DNA" mit den fünf
  Farbbalken (früher unten rechts im Canvas) wurde auf Nutzerwunsch **restlos
  entfernt** — Prop `showLegend`, Rendering und Dev-Toggle. Sie darf **nie**
  wieder auftauchen, auch nicht als Option. Die Farbaufschlüsselung leistet
  `FightDnaSplit` an anderer Stelle.

- **R3F bleibt auf v8, drei auf v9, React auf 18.** Kein Upgrade (steht so in
  `CLAUDE.md`). Alle drei Pakete sind in Tidal bereits installiert und bisher
  ungenutzt.
- **Genau ein `<Canvas>` pro Seite.** Auf `/kampfprofil` und
  `/trainer/opponents/[id]` gibt es je zwei Kandidaten — dort entscheidet man
  sich für einen und nimmt für den zweiten den SVG-Glyph (`size="sm"`).
- **Nur Token-Farben**, keine Hex-/rgb-Literale. Die Helix nutzt das neue
  OKLCH-Set (`--accent`, `--accent-2`, `--bg-0/1`, `--text-1/2/3`, `--line`,
  `--line-strong`, `--cat-1..5`, `--cat-mixed`, `--cat-neutral`) — alle in
  **beiden** Theme-Blöcken vorhanden.
- **`dnaCompleteness()` bleibt die einzige Prozentquelle.**
- **Alle Schutzpfade erhalten:** reduced-motion → Glyph, kein WebGL → Glyph,
  Kontextverlust → Glyph + Remount, Viewport-/Visibility-Stop, `frameloop="demand"`,
  `dpr={[1,2]}`, `dispose()`.
- **Ein Token, das fehlt, lässt die Szene stumm gar nicht rendern** — jeder neu
  verwendete Token muss in die Token-Liste des Renderers **und** in beide
  Theme-Blöcke von `globals.css`.
- **GLSL-Fehler sind für `tsc` und `next build` unsichtbar.** Der Prototyp hat
  dafür `scripts/smoke.mjs` (`npm run smoke`) — **portiere dieses Skript mit**
  und lass es nach jeder Änderung an der Szene laufen. Zwei Messfallen darin
  sind dokumentiert (kein `drawImage` auf WebGL-Canvas; Stats über mehrere
  Samples maximieren).

## 4. Datenquellen — passt ohne Umbau

**Athlet** (`lib/fight-profile.ts`): `getFightProfile(uid)` liefert
`{ dna, dnaSplit, dnaSplitWeight, actionStats, updatedBy, updatedAt }`.
Alle drei von der Helix benötigten Felder sind fertig da; `dnaSplitWeight` ist
immer eine Zahl (0 = nichts).

**Gegner** (`lib/opponents.ts`): `Opponent` hat `dna`, `dnaSplit?`,
`dnaSplitWeight?`, `actionStats?`. Beim Durchreichen `dnaSplit ?? null`.

Die Prop `profile: { dna; dnaSplit: DnaSplit | null; dnaSplitWeight?: number }`
passt exakt auf beide Seiten.

## 5. Einbau in Etappen — nicht alles auf einmal

### Etappe A — Fundament + der eine Hero-Platz
1. Die fünf Dateien aus §2 übernehmen, `npm run typecheck` und `npm run build`
   grün bekommen.
2. **`/kampfprofil`** (`app/kampfprofil/page.tsx`), DeepFight-Sektion,
   `variant="athlete"` — das ist der Hero-Platz der App.

   **Layout (Vorgabe des Nutzers):**
   - **Desktop:** Die Helix steht **links neben der kompletten Fight-DNA-Box**
     (der `FightProfileView`-Karte), also zweispaltig — nicht darüber. Die
     Spalten stehen nebeneinander, die Helix links, die Karte rechts.
   - **Darunter geht es auf voller Breite weiter:** „Deine Auswertungen",
     „Gegnerprofile", „Athleten-Daten" bleiben einspaltig über die ganze
     Containerbreite. Die Zweispaltigkeit gilt **nur** für die DeepFight-Sektion.
   - **Mobil:** wie gehabt untereinander — Helix oben, Karte darunter.
   - Der Container ist `max-w-2xl` / `lg:max-w-5xl`. Prüfe, ob die Helix in der
     halben Breite mit `size="lg"` (620 px hoch) noch stimmig wirkt oder ob
     `size="md"` besser passt; die Karte daneben ist ein Akkordeon mit
     wechselnder Höhe. Wenn die Karte deutlich höher wird als die Helix, ist
     eine oben ausgerichtete Spalte (`items-start`) das richtige Verhalten,
     keine gestreckte Helix.

   **Wichtig:** Der `profileEmpty`-Zweig (Z. 247–266) rendert statt der Karte
   einen Leerzustand. Die Helix gehört **außerhalb** dieses Ternärs — ein leeres
   Profil zeigt dank der Bauplan-Sprossen gerade dann etwas Sinnvolles.
3. Smoke-Test + beide Themes + Mobil prüfen. **Danach anhalten und Leon zeigen.**

### Etappe B — Trainer-Athletendetail mit Wachstums-Moment
`app/trainer/deepfight/athletes/[uid]/page.tsx`, Sektion „Kampfprofil"
(um Z. 231/232), `size="md"`. Hier lohnt sich die Wachstums-Choreografie:
`loadFightProfile` (Z. 48–54) läuft nach jedem Übernehmen erneut — vorher/
nachher durch `diffHelixModels` schicken und die neuen Frage-IDs als
`grownQuestionIds` übergeben. Neu beantwortete Sprossen wachsen dann sichtbar
ein.

### Etappe C — Gegnerprofile
- `app/trainer/opponents/[id]/page.tsx`, Tab „Übersicht" über `GlanceCard`
  (Z. 594), `size="md"`, `variant="opponent"`.
  **Konflikt:** Im sticky Kopf sitzt bereits ein `DnaCompletenessRing` (Z. 403).
  Entweder Ring behalten und nur unten die Szene, oder Ring durch einen
  `sm`-Glyph ersetzen — **niemals zwei Canvas**.
- `app/deepfight/opponents/[id]/page.tsx` (Schüler-Sicht), vor
  `OpponentProfileView` (um Z. 55), `size="md"`, `variant="opponent"`.

### Etappe D — Glyphen in Listen
Überall `size="sm"` (reiner SVG, kein WebGL, kein Canvas):
- Trainer-Athleten-Grid (`app/trainer/deepfight/athletes/page.tsx`, Initialen-
  Quadrat Z. 180–189, 44 px). **Achtung:** Die Liste kommt aus
  `listAllMembers(gymId)`; ob `fightProfile` dort mitkommt, ist offen — sonst
  `lib/admin.ts` erweitern oder je Karte nachladen. Wenn das zu teuer wird,
  diese Stelle bewusst auslassen.
- Gegner-Bibliothek (`app/trainer/opponents/page.tsx`, 40 px)
- Gegnerprofil-Karten auf `/kampfprofil` (Z. 353–380, 32–40 px)

### Etappe E — Matchup und Loader (optional)
- `components/trainer/MatchupBlock.tsx`, VS-Zeile (Z. 163–185, Grid
  `1fr auto 1fr` ist schon da): zwei gespiegelte `sm`-Glyphen. **Dafür muss
  `app/trainer/students/[uid]/page.tsx:662` zusätzlich `getFightProfile(uid)`
  laden** — der Athlet hat dort bisher nur Maße, kein Kampfprofil.
- Video-Analyse-Ladezustand (`.ai-loader-*`): Glyph als Ladeanimation.

## 6. Bekannte Stolpersteine

1. **`FightProfileView` kennt `dnaSplitWeight` nicht** (Props Z. 70–78). Wer es
   braucht, erweitert die Props und zieht **alle drei Aufrufer** nach. Dasselbe
   gilt für das `OpponentView`-Interface in `OpponentProfileView.tsx` (Z. 60–74).
2. **`DnaCategoryGrid` ist unkontrolliert** (eigener `selectedId`-State, Z. 29).
   Für die Kopplung „Klick im Grid fokussiert das Helix-Segment" braucht es dort
   einen kontrollierten Modus (`selectedId` + `onSelectedIdChange`); Aufrufer
   sind `FightProfileView.tsx:142` und `OpponentProfileView.tsx:210`.
   **Das ist Kür, nicht Pflicht** — die Helix funktioniert auch ohne.
3. **Zwei Token-Systeme parallel:** Alle DeepFight-Bestandskomponenten außer
   `FightProfileView`/`.t-card-fight` laufen noch auf den Alt-Tokens
   (`--ink-*`, `--ta-*`). Die Helix nutzt ausschließlich das neue OKLCH-Set und
   wirkt in Alt-Umgebungen sichtbar anders — `OpponentProfileView` am stärksten.
   **Die Helix bleibt trotzdem beim neuen Token-Set.** Sie nicht an die
   Alt-Farben angleichen, keine `--ta-*`/`--ink-*`-Tokens einbauen und keine
   Sonderfälle für Alt-Umgebungen bauen: Leon überarbeitet diese Bereiche
   ohnehin noch, danach passt es von selbst zusammen (siehe §9).
4. **Toter 3D-Code:** `components/HeroScene.tsx` und `components/Hero3D.tsx`
   werden nirgends importiert. `Hero3D.tsx` ist ein brauchbares Muster für das
   `dynamic(..., { ssr: false })`-Wrapping; danach dürfen beide gelöscht werden
   (vorher Leon fragen).
5. **Die Helix ersetzt nichts.** `FightDnaSplit` bleibt die exakte Zahlenlesart,
   die Helix zeigt dasselbe qualitativ. Einziger echter Ersatzkandidat ist der
   `DnaCompletenessRing` (gleiche Aussage: Füllgrad).

## 7. Abnahme je Etappe

- `npm run typecheck` und `npm run build` fehlerfrei
- `npm run smoke` (portiertes Skript) bestanden — Canvas da, keine
  Shader-Meldungen, Draw Calls ≤ 8, Punkte ≤ 45.000, Bild nicht leer,
  0 reinweiße Pixel
- Farbscan: keine Hex-/`rgb(`-Literale in den neuen Dateien
- Beide Themes, Mobil (390 px), 16:9 und 9:16 geprüft
- Auf einem **echten Handy** (nicht im schmalen Desktop-Fenster) die Seite
  öffnen: Scrollen bleibt flüssig, das Gerät wird nicht spürbar warm.
  Hakt es doch, Reihenfolge zum Gegensteuern: erst Lava, dann
  Partikeldichte, erst zuletzt die Helix selbst (§10).
- Fallbacks getestet: reduced-motion, `forceRenderer="svg"`, Kontextverlust
- **Kein Regressionsschaden:** Die Seiten funktionieren ohne WebGL genauso wie
  vorher

## 8. Was NICHT zu tun ist

- Keine neuen Dependencies, kein Postprocessing, kein Upgrade von R3F/drei/React
- Die fünf Spiegeldateien nicht verändern
- `lib/fight-dna-helix.ts` nur ergänzen, nie Felder entfernen
- Die abgenommenen Default-Werte nicht „verbessern" — sie sind das Ergebnis von
  elf Abstimmungsrunden
- Nicht alle Etappen in einem Rutsch durchziehen. Nach Etappe A anhalten und
  zeigen.

## 9. Reihenfolge im Projekt — bewusst so entschieden

Ursprünglich sollte die Integration erst **nach** Redesign-Etappe 6 kommen,
damit nichts doppelt gestylt wird. Leon zieht sie vor. Die Überarbeitung der
Altbereiche (Redesign-Etappe „DeepFight-Seiten") bleibt danach als eigene
Etappe bestehen — die Reihenfolge dreht sich also nur um.

Daraus folgt für diesen Auftrag:

- Die Helix ist der **neue Standard**, nicht der Gast. Die Umgebung zieht
  später nach, nicht umgekehrt.
- Wenn eine Seite mit Alt-Tokens neben der Helix unstimmig aussieht, ist das
  ein **erwarteter Zwischenzustand** — kein Fehler und kein Grund, an der Helix
  zu drehen.
- Die umliegenden Alt-Komponenten in diesem Auftrag **nicht** mitredesignen.
  Das ist eine eigene Etappe und Leons Aufgabe.
- Nur wenn eine Stelle so schlecht wirkt, dass sie den Eindruck der Helix
  beschädigt, ist „diese Stelle später einbauen" die richtige Entscheidung —
  dann im Bericht benennen, damit sie beim Redesign mitgedacht wird.

## 10. Mobil-Performance (Nachtrag Leon, 2026-08-26 — in Etappe A umgesetzt)

Die Szene wurde nie auf echter Mobilhardware gemessen — alle FPS-Werte
stammen aus Desktop-Browsern oder Software-Rendering. Zwei vorbeugende
Maßnahmen sind seit Etappe A eingebaut und dürfen von Folge-Etappen NICHT
zurückgedreht werden:

1. **Wirksame Mobil-Deckel:** Unter 620 px Breite drosselt
   `FightDnaHelix.tsx` auf `strandParticleDensity` max. **18** und
   `rungParticleDensity` max. **110** (vorher 30/150 — bei den abgenommenen
   Defaults 28/160 faktisch wirkungslos). Die Desktop-Defaults bleiben
   unangetastet. Gemessen: 26.264 statt 37.664 Punkte bei 390 px.
2. **Lava ohne Formanimation auf schmalen Viewports:** `border-radius`-
   Morphing erzwingt Repaint + Blur pro Frame und ist teurer als die
   Partikel. Unter 620 px bekommt die Sektion die Klasse
   `deepfight-helix--compact`; die vier Blobs laufen dann auf
   `deepfight-lava-*-compact`-Keyframes (nur Drift + Deckkraft, Form friert
   auf dem 0%-Keyframe ein).

Falls es auf einem echten Gerät trotzdem hakt, Reihenfolge zum
Gegensteuern: erst Lava (ganz abschalten), dann Partikeldichte weiter
senken, erst zuletzt an der Helix selbst drehen.
