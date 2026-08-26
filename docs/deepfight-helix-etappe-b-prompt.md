# Auftrag: DeepFight-Helix — Etappe B (Trainer-Athletendetail mit Wachstums-Moment)

> Dieser Text ist der Start-Prompt für eine **neue Claude-Code-Session** im
> Projekt `d:\Tidal-Athletics`. Er enthält alles Nötige — kein früherer Chat
> erforderlich.

## 1. Kontext & Stand

- Die 3D-DNA-Helix („DeepFight-Helix") ist seit **Etappe A** in der App:
  `components/deepfight/{FightDnaHelix,HelixScene,HelixGlyph}.tsx`,
  `components/deepfight/use-resolved-tokens.ts`, `lib/fight-dna-helix.ts`.
  **Die App ist jetzt die Quelle der Wahrheit — NICHT erneut aus
  `D:\DeepFight-Helix` kopieren.** Die App-Fassung enthält autorisierte
  Mobil-Änderungen, die der Prototyp nicht hat (Partikel-Deckel 18/110 unter
  620 px Containerbreite, eingefrorenes Lava-`border-radius`-Morphing via
  `deepfight-helix--compact`).
- **Master-Dokument zuerst lesen:**
  `Tidal-Athletics-App/docs/deepfight-helix-integration-prompt.md` —
  besonders §3 (harte Regeln), §7 (Abnahme), §8 (Verbote), §10
  (Mobil-Performance). Etappe A ist umgesetzt und von Leon am 2026-08-26 auf
  echtem Handy abgenommen (Hero auf `/kampfprofil`, Desktop zweispaltig).
- Die Split-Legende („FIGHT DNA"-Band mit fünf Farbbalken) wurde **restlos
  entfernt** — Prop `showLegend` existiert nicht mehr und darf **nie** wieder
  auftauchen, auch nicht als abgeschaltete Option.
- Design-Feinheiten (z. B. „DNA wirkt zu dunkel") sind **bewusst** auf eine
  spätere Gestaltungs-Etappe verschoben — auffallende Punkte sammeln und im
  Abschlussbericht nennen, NICHT jetzt fixen. Die Zielseite dieser Etappe ist
  eine Alt-Token-Umgebung (`--fg-*`, `font-display-ta`, `font-mono-ta`) —
  erwarteter Zwischenzustand: Die Helix bleibt beim neuen OKLCH-Token-Set,
  nichts an der Umgebung mitredesignen.

## 2. Auftrag

**Datei:** `app/trainer/deepfight/athletes/[uid]/page.tsx` (254 Zeilen,
Stand 2026-08-26):

- `loadFightProfile` steht in Z. 48–54. Es läuft beim Initial-Load (Z. 63)
  **und** nach jedem „Übernehmen" aus der Video-Analyse
  (`onFightProfileUpdated={loadFightProfile}`, Z. 214).
- Sektion „Kampfprofil" Z. 217–240, gated auf
  `fightProfile && !isFightProfileEmpty(fightProfile)`; die
  `FightProfileView`-Karte sitzt in einem `div.mt-4` (Z. 232–238).

**Einbau:**

1. `FightDnaHelix` mit `size="md"`, `variant="athlete"`,
   `profile={fightProfile}` in die Kampfprofil-Sektion, **über** der
   `FightProfileView`-Karte. Kein Zweispalten-Layout — das gilt nur auf
   `/kampfprofil`. Das Sektions-Gate (nur bei nicht-leerem Profil) unverändert
   lassen; wer den Bauplan-Leerzustand auch hier will, fragt erst Leon.
2. **Wachstums-Moment:** Vorherigen Profilstand merken (Ref/State). Liefert
   `loadFightProfile` nach einem Übernehmen einen neuen Stand, dann
   `diffHelixModels(buildHelixModel(alt), buildHelixModel(neu)).grown` als
   `grownQuestionIds` an die Helix geben — neu beantwortete Sprossen wachsen
   dann sichtbar ein. Beim Initial-Load leeres Array (Guard: alter Stand
   `null` ⇒ kein Wachstum beim ersten Rendern). Die IDs bleiben bis zum
   nächsten Übernehmen stehen; nicht künstlich zurücksetzen.
3. **Ein Canvas pro Seite:** Diese Seite hat keinen weiteren Canvas
   (geprüft) — `size="md"` rendert WebGL, das ist hier in Ordnung.

## 3. Abnahme

- `npm run typecheck` und `npm run build` fehlerfrei.
  **`npm run build` NIE bei laufendem Dev-Server** — beide teilen sich
  `.next`, der Dev-Server liefert danach 500er und muss neu gestartet werden.
- `npm run smoke` bestanden (Dev-Server auf Port 3000 muss laufen; Ziel ist
  die dev-only Route `/dev/helix`, in Produktion 404). Das Skript treibt die
  Frames per `Page.startScreencast` an und wartet den kalt kompilierenden
  Three.js-Chunk ab — die drei Messfallen stehen im Skript-Kopf
  (`scripts/smoke.mjs`). Referenzwerte Desktop: 4 Draw Calls, 37.664 Punkte,
  0 reinweiße Pixel.
- Farbscan: keine Hex-/`rgb(`-Literale in geänderten Dateien.
- Beide Themes + Mobil (390 px) auf der Zielseite prüfen.
- **Wachstums-Moment nachweisen:** entweder real (Analyse-Befund übernehmen)
  oder über eine dev-only Simulation — `/dev/helix` existiert bereits mit
  `?renderer=` und `?size=`; bei Bedarf um einen Grow-Test erweitern (z. B.
  Button/Param, der Antworten ergänzt und die Frage-IDs als
  `grownQuestionIds` durchreicht).
- **Danach anhalten und Leon zeigen.** Etappen C–E folgen einzeln; Etappe C
  enthält eine Entscheidung für Leon (DnaCompletenessRing behalten vs. durch
  `sm`-Glyph ersetzen — niemals zwei Canvas).

## 4. Verbote (Kurzfassung — Details in §3/§8/§10 des Master-Dokuments)

- Keine neuen Dependencies, kein Postprocessing, kein Upgrade von
  R3F (v8) / three (v9-drei) / React (18).
- Die fünf Spiegeldateien nicht verändern (`lib/gegner-dna.ts`,
  `lib/fight-stats.ts`, `lib/discipline-colors.ts`, `lib/types.ts`,
  `components/ui/Icon.tsx`).
- Abgenommene Default-Werte nicht ändern; Mobil-Deckel 18/110 nicht anheben.
- `lib/fight-dna-helix.ts` nur ergänzen, nie Felder entfernen.
- `dnaCompleteness()` bleibt die einzige Prozentquelle.
- Nur Token-Farben; jeder neu verwendete Token muss in beide Theme-Blöcke von
  `globals.css` UND in die Token-Liste des Renderers (fehlender Token =
  Szene rendert stumm gar nicht).
