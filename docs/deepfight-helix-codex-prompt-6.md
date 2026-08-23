# Auftrag: DeepFight-Helix — Runde 6: Verschmelzen, Verlaufen, Beruhigen

Du überarbeitest den Prototyp in `D:\DeepFight-Helix`. Dieser Text + zwei zu
lesende Dateien sind alles — kein früherer Chat nötig.

## 0. Regeln

**Lies ZUERST** `D:\Tidal-Athletics\Tidal-Athletics-App\docs\deepfight-helix-codex-prompt-2.md`
— **§0 (Arbeitsregeln) und §0b (Skills) gelten unverändert und absolut**
(`D:\Tidal-Athletics\` nur-lesen, keine neuen Dependencies, kein
Postprocessing, Token-only-Farben, Spiegel-Dateien byte-identisch, Props nur
ergänzen, Mobile-/Fallback-Mechanik erhalten). Danach `REPORT.md` und den
aktuellen Code lesen.

**Achtung — `app/page.tsx` und `app/globals.css` wurden nach deinem letzten
Lauf von außen geändert** (Dev-Panel umgebaut: klappbare `<details>`-Sektionen
`ControlSection`, sticky Panel mit eigenem Scrollbereich, kompaktes
`.tuning-grid`, gekürzte Regler-Labels). **Diesen Umbau erhalten** — neue
Regler in die bestehenden Sektionen einsortieren, das Panel NICHT wieder zu
einer langen Liste machen. Labels kurz halten (ein Wort, ≤ 14 Zeichen), sonst
überlappen sie in der zweispaltigen Ansicht.

## 1. Lage

Runde 5 hat die Stützröhren entfernt, das Blitz-System und die
Sprossen-Verteilung gebracht — das ist angekommen. Runde 6 ist erneut reiner
Feinschliff am Look, kein Umbau. Die Prioritäten stehen unten in der
Reihenfolge, in der der Nutzer sie genannt hat. Modell
(`lib/fight-dna-helix.ts`) und Props-API bleiben unangetastet (nur ergänzen).

**Referenzbilder liegen dieser Nachricht bei.** Sie zeigen die Zielwirkung:
feine, aus Körnern gebaute Stränge auf sehr dunklem Grund; Sprossen, die als
Punktreihen nahtlos in die Strangwolke übergehen; weiches, farbiges Bokeh im
Hintergrund ohne weiße Überstrahlung.

## 2. Sprossen-Enden mit den Strang-Partikeln verschmelzen

Wo eine Sprosse seitlich in den Strang läuft, ist der Übergang noch als
eigenes Element erkennbar. Ziel: **Das Sprossen-Ende geht farblich UND in der
Dichte im Strang auf.**

- Über die letzten ~15 % der Sprossenlänge blendet die Sprossenfarbe in die
  **lokale Farbe der Strang-Partikel an genau dieser Kurvenposition** über
  (im Split-Modus also in die dort geltende `--cat-*`-Farbe, im
  Vollständigkeits-Modus in den `--accent`/`--accent-2`-Verlauf).
- Gleichzeitig streuen die Endkörner stärker in die Schale des Strangs hinein
  (Übernahme der Strang-Schalenverteilung), sodass keine Kante, kein
  „Steckpunkt" und kein Dichtesprung sichtbar bleibt.
- Gilt für beantwortete Sprossen, Geister und Teil-Sprossen gleichermaßen.

## 3. Wanderblitze: schneller, dünner, AUF dem Strang

Die kleinen Blitze aus Runde 5 wirken zäh und laufen sichtbar durch das
Volumen der Helix hindurch.

- **Deutlich schneller:** grob 2,5–4× die aktuelle Laufgeschwindigkeit — ein
  Zucken, kein Wandern.
- **Deutlich dünner:** Der leuchtende Bereich ist ein schmales Band um die
  **Strang-Mittellinie**. Körner werden nur erfasst, wenn sie nahe an der
  Mittellinie liegen (radialer Abstand in der Schale klein) — die äußeren
  Staubkörner bleiben dunkel. Dadurch blitzt es entlang der Oberfläche/Kante
  des Strangs statt quer durch die Wolke.
- Der große Puls über die volle Länge behält seine jetzige Breite und
  Geschwindigkeit — der Kontrast zwischen beiden Effekten ist gewollt.
- Der seitliche Austritt bleibt selten und wird ebenfalls dünner/schneller.

## 4. Fight-Split: sanfter einfügen statt knallen

Die `--cat-*`-Farben sind zu kräftig und wirken als monotone Blöcke; der
Wechsel von „Vollständigkeit" zu „Fight-Split" ist ein harter Bruch.

- Die Segmentfarben werden **gedämpft in die Grundstimmung eingebettet**:
  Sättigung und Helligkeit spürbar zurücknehmen und Richtung des
  Vollständigkeits-Looks mischen (ca. 55–70 % Kategorie-Ton auf dem
  Basis-Verlauf), statt den Vollton flächig zu setzen.
- Innerhalb eines Segments darf die Farbe **nicht monoton** stehen: leichte
  Helligkeits-/Sättigungs-Modulation entlang der Kurve und pro Korn, damit die
  Fläche lebt (dieselbe Varianz-Logik wie im Vollständigkeits-Modus).
- Der Moduswechsel soll wie ein Einfärben derselben Helix wirken, nicht wie
  eine andere Helix.
- Light-Theme separat prüfen: gedämpft heißt dort NICHT milchig.

## 5. Farbübergänge an den Segmentgrenzen: länger und unregelmäßig

Die Übergangszone aus Runde 5 gefällt, ist aber zu kurz und zu symmetrisch.

- **Länger:** Die Mischzone reicht deutlich weiter in beide Nachbarsegmente
  hinein — Richtwert ca. 4–6 Sprossen je Seite statt 2, sodass ein Segment nur
  in seiner Mitte reinen Ton zeigt.
- **Unregelmäßig:** Die Zonenlänge variiert pro Grenze und pro Seite
  (deterministisch aus der Segment-ID gehasht, damit sie stabil bleibt): mal
  greift Farbe A weit nach unten, während auf der anderen Seite derselben
  Grenze Farbe B weiter nach oben zieht. Keine gespiegelten, gleich langen
  Zonen.
- **Fließend:** weiche Übergangskurve (smoothstep o. ä.) plus leichtes
  Rauschen entlang der Kurve, damit die Grenze ausfranst statt als sauberer
  Farbverlauf-Balken zu erscheinen. Der Eindruck soll „ineinander verlaufen"
  sein, nicht „Gradient zwischen zwei Feldern".
- Auch die beiden Stränge dürfen an derselben Grenze unterschiedlich weit
  mischen.

## 6. Lavalampen-Hintergrund: Muster statt Leuchten

Der Effekt ist weiterhin abgelehnt. Zwei konkrete Fehler:

- **Kein weißes Leuchten/Strahlen mehr.** Die Blobs dürfen keinen hellen Kern
  und keine weiße Überstrahlung haben — das überstrahlt die Helix und zerstört
  das Gesamtbild. Reine, gedämpfte Farbflächen aus den Tokens, sehr dunkel
  gehalten; im Zweifel Deckkraft runter statt Helligkeit hoch.
- **3–5 Blobs, die als Lava-MUSTER erkennbar sind:** ausgeprägt organische,
  ungleichmäßige Formen (asymmetrische `border-radius`-Morphs, unterschiedliche
  Größen, sich überlappend), die beim Wandern ihre Form sichtbar verändern und
  ineinanderlaufen — nicht drei gleich große weiche Kreise.
- Bahnen und Tempo aus Runde 5 (lange Wege über die ganze Fläche) bleiben.
- Technik unverändert: nur `transform`/`opacity`/`border-radius`,
  reduced-motion stoppt.

## 7. Hintergrund-Partikel über die ganze Fläche

Das Bokeh sitzt aktuell zu eng am Motiv.

- Die Fernpartikel füllen die **gesamte Anzeigefläche** (auch Ecken und
  Ränder), mit einer **zur Bildmitte hin ansteigenden Dichte** — Rand dünn
  besetzt, Mitte deutlich dichter, weicher Verlauf dazwischen.
- Größen- und Helligkeitsvarianz beibehalten; hinten weiter unscharf/weich.
  Auch hier kein weißer Kern — farbige, gedämpfte Punkte (siehe Referenzbild
  mit dem farbigen Bokeh).

## 8. Budget

- Unverändert: **≤ 8 Draw Calls, ≤ 45.000 Punkte gesamt, max. 4
  `Points`-Objekte**, keine Mesh-Draws. `dpr={[1, 2]}`.
- Idle-Demand-Takt ~24 fps; Mobile-Emulation testen.
- Alle Schutzpfade (Viewport, Visibility, Kontextverlust → Glyph,
  reduced-motion → Glyph) erhalten und erneut testen; alles `dispose()`-en.

## 9. Dev-Seite

- Neue Regler in die **bestehenden** `ControlSection`-Gruppen einsortieren
  (§0): Wanderblitz-Tempo und -Breite → „Energie & Blitze"; Split-Dämpfung und
  Übergangslänge → neue Sektion „Fight-Split"; Bokeh-Mittendichte → sektion
  „Hintergrund". Kurze Labels.
- Final gewählte Werte werden Defaults (im Bericht nennen).

## 10. Abnahme & Bericht

- `npm run typecheck` + `npm run build` fehlerfrei; Farb-/Import-Scan sauber;
  Spiegel-Dateien byte-identisch; `package.json` unverändert;
  `git -C D:\Tidal-Athletics\Tidal-Athletics-App status --short` leer.
- Screenshots/Aufnahmen in `report/`: Nahaufnahme eines Sprossen-Endes am
  Strang (Verschmelzung); Wanderblitz-Bildfolge/WebM; Fight-Split gesamt
  (Dark + Light) und eine Grenzzone in Nahaufnahme; direkter Vergleich
  Vollständigkeit ↔ Fight-Split aus identischer Kamera; Lava-Bildfolge über
  ~15 s; Gesamtansicht mit der neuen Bokeh-Verteilung.
- `REPORT.md`: was geändert wurde, Messwerte (Punkte, Draw Calls, FPS
  Idle/Puls, Desktop + Mobile-Emulation), neue Defaults. `HANDOFF.md`
  aktualisieren. Danach STOPPEN — keine Integration nach Tidal.
