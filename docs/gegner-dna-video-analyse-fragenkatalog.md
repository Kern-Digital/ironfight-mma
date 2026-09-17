# Gegner-Kampf-DNA — Fragenkatalog für die KI-Video-Analyse (API-Spezifikation)

> Grundlage für die spätere Video-Analyse-API (Konzept §6, noch nicht gebaut).
> Definiert, **welche Fragen die KI pro Video beantworten** und **in welcher Struktur
> sie Ergebnisse zurückgeben** muss, damit daraus eine wachsende Gegner-DNA entsteht.
>
> Mappt bewusst auf das bestehende Datenmodell:
> - Qualitative DNA: `lib/gegner-dna.ts` (9 Kategorien, stabile Frage-IDs)
> - Quantitative Ebene: `lib/fight-stats.ts` (DnaSplit, ActionStat, CageZone)
>
> **SEIT 17.09.2026 GILT JE KAMPFART EIN STECKBRIEF** (`lib/kampfart-steckbrief.ts`,
> Spezifikation mit Quellen `docs/kampfart-steckbriefe.md`, Leons sechs Antworten:
> alle wie empfohlen). Stand heute: **67 Fragen** (59 bisherige mit neutralerem
> Wortlaut für Käfig, Ring und Matte, `entry-patterns_jab` gestrichen, acht
> Zusatzfragen), je Frage `label` (Gegner „er") und `labelDu` (Athlet „du");
> **37 Techniken** in sechs Gruppen (neu `clinch` und `submission`, vier
> Wurfgruppen, `throw`/`submission` als Rückfall), jede mit sichtbarer Definition
> „versucht"/„gelungen"; je Kampfart eine Sperrliste der Fragen, eine
> Erlaubnisliste der Techniken, feste Split-Nullen und Begriffe; EIN
> Varianten-Umschalter (Kickboxen/Muay Thai); Kampf-Sambo läuft als MMA. Die
> Listen unten in B1 und C beschreiben den URSPRUNG — gültig ist der Code.

---

## 0. Grundprinzipien

1. **Ein Video pro Analyse.** Das Ergebnis eines Analysevorgangs ist ein
   **Analyse-Beitrag** (`VideoAnalysis`), nie eine fertige DNA. Die DNA des Gegners
   entsteht durch das **Mergen** aller Beiträge (siehe Abschnitt E).
2. **Zählen statt fragen.** Fragen wie „Nutzt er Low Kicks?" oder „Nutzt er Hooks?"
   werden **nicht** als Einzelfragen beantwortet — sie ergeben sich aus der
   Technik-Zähltabelle (Abschnitt B). Das eliminiert ~60 redundante Fragen aus dem
   Roh-Katalog.
3. **Drei Antwort-Ebenen:**
   - **Zahlen** (B) — gezählte, messbare Fakten
   - **Befunde** (C) — qualitative Antworten auf die DNA-Fragen, mit Evidenz
   - **Ableitungen** (D) — Scores, Top-Listen, Gameplan- und Drill-Empfehlungen
4. **Jeder Befund trägt Metadaten:** `confidence` (0–1), `evidence`
   (Video-Timestamps), `source` (`video` | `manual` | `web`), `videoIds`.
5. **Kein Raten.** Was im Video nicht beobachtbar ist, bleibt unbeantwortet
   (`null`) — passt zum bestehenden Prinzip „leere Antworten werden nicht angezeigt".
6. **Stabile IDs.** Qualitative Befunde nutzen die bestehenden Frage-IDs aus
   `DNA_CATEGORIES`, quantitative die `ACTION_CATALOG`-IDs. Neue IDs (mit `+`
   markiert) werden additiv ergänzt, nie umbenannt.

---

## A. Video-Metadaten & Kontext (pro Video, vor der inhaltlichen Analyse)

Diese Fragen bestimmen, **wie stark** das Video die DNA gewichten darf.

| # | Frage | Output |
|---|---|---|
| A1 | Wer im Video ist der Zielgegner (Ecke, Hose/Rashguard-Farbe, Identifikationssicherheit)? | `targetFighter` + `idConfidence` |
| A2 | Wann fand der Kampf statt bzw. wie alt ist das Material? | `fightDate` / `estimatedAge` → Basis für `recencyWeight` |
| A3 | Unter welchem Regelwerk wurde gekämpft (MMA, K1, Boxen, Grappling, Amateur/Profi)? | `ruleset` |
| A4 | Rundenzahl, Rundenlänge, Gewichtsklasse? | `rounds`, `roundLength`, `weightClass` |
| A5 | Wie ging der Kampf aus (Sieg/Niederlage, KO/Sub/Decision, Runde, Zeit)? | `result` |
| A6 | Wie stark war der damalige Gegner (Niveau-Einschätzung)? | `opponentLevel` — relativiert alle Befunde |
| A7 | Welcher Anteil des Kampfes ist analysierbar (Schnitt, Kameraperspektive, Qualität, Highlight-Clip vs. Vollkampf)? | `coverage` + `videoQuality` |
| A8 | Wie repräsentativ ist dieser Kampf für den heutigen Gegner insgesamt? | `representativeness` (0–1) |

---

## B. Quantitative Ebene — zählen statt fragen

### B1 — Technik-Zähler (`ActionStat[]`, bestehender Katalog)

Pro Technik aus `ACTION_CATALOG` (Stand 17.09.2026: 37 Einträge, sechs Gruppen —
Liste, Definitionen und Geltung je Kampfart in `lib/fight-stats.ts` und
`lib/kampfart-steckbrief.ts`; ursprünglich 20: jab, cross, hook, uppercut,
overhand, elbow, low-kick, body-kick, high-kick, front-kick, knee, single-leg,
double-leg, body-lock, trip, throw, pass, sweep, submission, ground-strikes):

| Feld | Bedeutung | Status |
|---|---|---|
| `attempted` / `landed` | Versuche / Treffer | bestehend |
| `zone` | überwiegende Käfig-Zone (`center` / `open` / `cage`) | bestehend |
| `setup` | womit vorbereitet (Freitext, z. B. „linker Jab") | bestehend |
| `byRound` + | Versuche/Treffer pro Runde | **neu** |
| `damage` + | Wirkungs-Rating 0–3 (0 = wirkungslos, 3 = Wackler/Cut/Knockdown) | **neu** |
| `timestamps` + | Belegstellen im Video | **neu** |

Techniken außerhalb des Katalogs (z. B. Spinning Back Kick) → `other` mit
Freitext-Beschreibung; tauchen sie wiederholt auf, wird der Katalog erweitert.

### B2 — Fight-DNA-Split (`DnaSplit`, bestehend)

Prozentuale Verteilung **dieses Kampfes**: `boxing / kicking / wrestling /
ground / clinch` (Summe ~100). Wird beim Merge mit den Splits der anderen
Videos zeitgewichtet gemittelt.

### B3 — Kombinations-Sequenzen + (**neu**)

Antwortet auf den gesamten Frageblock „Kombinationen":

```
combos: [{ sequence: ["jab","cross","low-kick"], count, landedFully, zone, openingAfter }]
```

- Welche Sequenzen wiederholen sich (≥2×)?
- Welche Sequenz ist am erfolgreichsten / wirkungsvollsten?
- Welche Lücke entsteht **nach** der Sequenz (`openingAfter`, Freitext)?

### B4 — Defensiv-Quoten + (**neu** — fehlte im Roh-Katalog komplett als Messwert)

| Metrik | Frage dahinter |
|---|---|
| `takedownDefense` (abgewehrt / gegen ihn versucht) | Wie gut verteidigt er Takedowns? |
| `strikeDefense` (vermieden + geblockt / auf ihn geworfen) | Wie viel kassiert er? |
| `hitLocations` (Kopf / Körper / Beine, kassierte Treffer) | **Wo** trifft man ihn am leichtesten? |
| `knockdownsReceived`, `rockedMoments` (mit Timestamps) | Nehmerfähigkeit, Wackler |

### B5 — Kontroll- & Positionszeiten + (**neu**)

```
controlTime: { clinchSeconds, topSeconds, bottomSeconds, cagePressureSeconds (er drückt), pressedSeconds (er wird gedrückt) }
positions:   { guard, halfGuard, sideControl, mount, backControl }  // Sekunden oben/unten je Position
```

Beantwortet messbar: „Ist er am Boden lieber oben oder unten?", „Wie lange kann
er Positionen halten?", „Wird er oft an den Cage gedrückt?".

### B6 — Stance & Bewegung + (**neu**)

- `stance`: orthodox / southpaw / switch — Anteil in % + Wechsel-Anlässe
- `direction`: Anteil Vorwärtsdruck vs. Rückwärts vs. lateral
- `centerControl`: Anteil der Zeit, in der er das Center hält

### B7 — Runden-Kurve (Cardio-Messung) + (**neu**)

Pro Runde: Output (Aktionen/min), Trefferquote, dominante Strategie, sichtbare
Ermüdungszeichen (offener Mund, sinkende Hände, weniger Beinarbeit).
→ beantwortet den gesamten Block „Rundenverhalten und Cardio" mit Daten statt
Einzelfragen.

### B8 — Zonen-Verteilung (`zoneDistribution`, bestehend)

Aktivität je Käfig-Zone (`center` / `open` / `cage`) → Heatmap-Daten.

---

## C. Qualitative Befunde — gemappt auf die 9 bestehenden DNA-Kategorien

> **Abgleich der „+ neu"-IDs mit den Steckbriefen (17.09.2026, Entwurf 3.4):**
> `real-habits_after-rocked` **gebaut** (gilt in MMA, Boxen, Kickboxen) ·
> `real-habits_in-exchanges` **nicht** — geht in `after-hit`/`after-miss` und
> `defensive-reactions_pressure` auf · `defensive-reactions_predictable` **nicht** —
> ist die Trainer-Ableitung `exploits_trap` · `weaknesses_vs-southpaw` **nicht
> jetzt** — Auslage steht in `movement.stance` · `gameplan_round-2-3` **nicht** —
> `gameplan_round-1` + `real-habits_when-tired` decken es. Dazu sieben weitere
> Zusatzfragen aus der Steckbrief-Recherche: `real-habits_ground-top`,
> `real-habits_ground-bottom`, `preferred-weapons_grip`, `preferred-weapons_clinch`,
> `preferred-weapons_submission`, `preferred-weapons_guard`,
> `entry-patterns_throw-direction`. Zurückgestellt: `real-habits_after-restart`
> (braucht ein Beobachtungsfeld für Unterbrechungen).

Die KI beantwortet die bestehenden Fragen aus `DNA_CATEGORIES` als Freitext
**mit Evidenz** (Timestamps + Konfidenz). Antworten werden beim Merge nicht
überschrieben, sondern fortgeschrieben (siehe E). Nur was beobachtbar war, wird
beantwortet.

### C1 — Real Habits (`real-habits_*`)
- Welche Muster wiederholt er immer wieder — was ist besonders auffällig?
- Was macht er nach einem Treffer / nach einem verfehlten Schlag?
- Was macht er, wenn er müde wird?
- Was macht er nach einem (eigenen) Takedown-Versuch?
- Was macht er, wenn sein erster Gameplan nicht funktioniert?
- **+ neu** `real-habits_after-rocked`: Was macht er, nachdem er gewackelt wurde — klammern, schießen, zurückfeuern, laufen?
- **+ neu** `real-habits_in-exchanges`: Bleibt er in Feuergefechten stehen oder bricht er ab?

### C2 — Entry Patterns (`entry-patterns_*`)
- Wie leitet er Angriffe ein — welches Setup nutzt er (Jab, Feints, Kicks, Level-Change, Druck)?
- Wie kommt er in den Clinch? Wie kommt er in den Takedown?
- Greift er eher im Center oder am Cage an?
- Welche Aktion folgt direkt auf seinen Entry?
- Welche Entries sind vorhersehbar — und wie kontert man sie?

### C3 — Preferred Weapons (`preferred-weapons_*`)
*(Die „häufigste/erfolgreichste"-Anteile kommen aus B1 — hier nur die Interpretation:)*
- Was ist seine gefährlichste Technik (Wirkung, nicht nur Quote)?
- Welche Technik nutzt er zum Finishen? Welche unter Druck?
- Welche Kombination ist seine Standard-Antwort (Querverweis B3)?

### C4 — Defensive Reactions (`defensive-reactions_*`)
- Wie reagiert er auf Jabs / Low Kicks / Druck / Takedown-Versuche?
- Nutzt er Parry, Shell, Slip oder Block? Kontert er oder schießt er?
- **+ neu** `defensive-reactions_predictable`: Welche defensive Reaktion ist so konstant, dass man sie als Falle nutzen kann?

### C5 — Cage- und Raumverhalten (`cage-space_*`)
- Wie bewegt er sich im Center? Wie verhält er sich am Cage?
- Drückt er selbst zum Cage oder lässt er sich drücken? Wie befreit er sich?
- Wie nutzt er den Raum unter Druck? Welche Raumpositionen sind für ihn unangenehm?

### C6 — Schwächen (`weaknesses_*`)
- Wo ist er technisch anfällig? Welche Situationen bereiten ihm sichtbar Probleme?
- Welche Fehler wiederholt er? Wann verliert er die Kontrolle?
- Welche Distanz liegt ihm nicht? Welche Angriffe treffen ihn besonders häufig (Querverweis B4)?
- Welche konditionellen oder mentalen Schwächen sind erkennbar (Querverweis B7)?
- **+ neu** `weaknesses_vs-southpaw`: Zeigt er Probleme gegen die Gegen-Auslage?

### C7 — Exploit-Möglichkeiten (`exploits_*`)
- Welche Schwäche kann gezielt ausgenutzt werden? Welche Technik schlägt sein Muster?
- Welche Reaktion kann provoziert werden? Welche Falle kann man stellen?
- Welche Position sollte aktiv gesucht, welche Situation vermieden werden?

### C8 — Gameplan (`gameplan_*`)
- Empfohlener Grundplan; zu suchende / zu vermeidende Distanz; Prioritäts-Techniken
- Taktik Runde 1; Anpassung wenn er Druck macht / passiv wird
- Der wichtigste Schlüssel zum Sieg
- **+ neu** `gameplan_round-2-3`: Taktik für die späteren Runden (auf Basis der Cardio-Kurve B7)

### C9 — Drills (`drills_*`)
- Passende Vorbereitungs-Drills; zu trainierende Defensiv-Reaktion; zu automatisierende Konter
- Cage-Situationen; Takedown-/Anti-Takedown-Sequenzen; Sparring-Aufgaben

---

## D. Strukturierte Scores & Top-Listen (das „DNA-Cockpit")

Kompakte, aggregierte Sicht für den Trainer — alles aus B + C abgeleitet,
jeweils mit Konfidenz:

### D1 — Stil-Klassifikation
- `primaryStyle`: striker / wrestler / grappler / allrounder
- `approach`: pressure / counter / ausgewogen — offensiv vs. defensiv
- `baseDiscipline` (sofern erkennbar/recherchierbar): z. B. Ringer-Basis, Muay-Thai-Basis

### D2 — Scores (0–100)
| Score | Quelle |
|---|---|
| Aggressivität / Druck | B6 Richtung + Output |
| Cage-Control | B5/B8 |
| Cardio | B7 Runden-Kurve |
| Schlagwirkung (Damage) | B1 `damage` |
| Nehmerfähigkeit (Durability) | B4 `rockedMoments` |
| Anpassungsfähigkeit (Fight IQ) | C1 `plan-fails` über mehrere Videos |
| Vorhersehbarkeit | Wiederholungsgrad der Muster (B3/C2) |

### D3 — Top-5-Listen (je Eintrag: Begründung + Konfidenz + Beleg-Videos)
- Top 5 Waffen · Top 5 Muster · Top 5 Schwächen · Top 5 gefährliche Situationen

### D4 — Gefahren- & Finish-Profil
- Wann ist er am gefährlichsten (Situation + Zone + Runde)?
- Womit finisht er? Womit wurde er selbst gefinisht/besiegt?
- Sieg-/Niederlagen-Verteilung (KO/Sub/Decision) — aus Videos + Web-Daten (G)

---

## E. Multi-Video-Aggregation — Update-Logik der DNA

Damit jede neue Analyse die DNA **präzisiert statt ersetzt**, muss die API pro
Analyse zusätzlich liefern:

| # | Frage an die API | Output |
|---|---|---|
| E1 | Welche bestehenden Befunde **bestätigt** dieses Video? | `confirms: [findingId]` → Konfidenz ↑, `evidenceCount` ↑ |
| E2 | Welchen bestehenden Befunden **widerspricht** es? | `contradicts: [{findingId, observation}]` → **Flag für Trainer-Review**, kein stilles Überschreiben |
| E3 | Welche **neuen** Befunde kommen hinzu? | `newFindings[]` mit Start-Konfidenz |
| E4 | Was hat sich zwischen den Kämpfen **entwickelt** (neue Waffen, bessere TD-Defense, Stance-Wechsel)? | `trends[]` — nur bei ≥2 zeitlich einordbaren Videos |
| E5 | Wie ist dieses Video zu **gewichten**? | `weight` aus A2 (Aktualität) × A6 (Gegner-Niveau) × A7 (Abdeckung) × A3 (Regelwerk-Nähe) |

**Merge-Regeln (App-seitig, von der API vorbereitet):**
- Quantitativ: `ActionStat`s werden gewichtet aufsummiert; `DnaSplit` zeitgewichtet gemittelt; `byRound`-Daten bleiben pro Video erhalten.
- Qualitativ: Befunde tragen `evidenceCount` + `videoIds`; ab Schwellwerten (analog `deriveTendencies`: ≥3 Versuche bzw. ≥2 Videos) gelten sie als „belastbar".
- Konflikte: neuere Videos schlagen ältere **nur** bei klarer Evidenz; sonst Trainer-Entscheidung.
- `source=manual` (Trainer) hat immer Vorrang vor `video` und `web`.
- Jede Analyse erzeugt eine neue DNA-Version; eingefrorene Snapshots in bestehenden Wettkämpfen (`fightCamps`) bleiben unberührt (bestehendes Konzept).

---

## F. Manuelle Trainer-Eingaben

Eingaben, die die KI **nicht** aus dem Video holen kann und die als
`source=manual` in die DNA einfließen:

1. **Identität & Kontext:** Name, Team/Gym, Coach, Kampfsport-Hintergrund (Basis-Disziplin, Graduierungen), Erfahrung (Amateur-/Profi-Kämpfe).
2. **Physis:** Größe, Reichweite, Auslage, Alter, übliche Gewichtsklasse.
3. **Eigene Beobachtungen** (Live-Scouting, gemeinsames Sparring, Hörensagen) — als eigene Befunde mit `source=manual`.
4. **Korrektur/Bestätigung:** Jeder KI-Befund ist editier-, bestätig- und löschbar; Bestätigung erhöht die Konfidenz dauerhaft.
5. **Matchup-Kontext:** Profil des **eigenen** Athleten (Auslage, Stärken, Verletzungen) — damit Gameplan/Drills (C8/C9) matchup-spezifisch statt generisch ausfallen.
6. **Kampf-Metadaten** ergänzen, wo das Video sie nicht hergibt (A2–A6).

---

## G. Internet-Anreicherung (optional, immer mit Quellenangabe)

Alles `source=web`, vom Trainer bestätigbar/verwerfbar:

- Kampfrekord (W-L-D), Finish-Verteilung, letzte Ergebnisse, anstehende Kämpfe (Tapology/Sherdog/Verbandsseiten)
- Qualität der bisherigen Gegner (Strength of Schedule)
- Team/Gym → typischer Camp-Stil, bekannte Trainingspartner
- Gewichtsklassen-Historie, bekannte Verletzungen, Karriere-Pausen
- Öffentliche Kampf-Videos als Vorschlag für weitere Analysen

---

## H. Gap-Analyse — was im Roh-Katalog fehlte (und hier ergänzt wurde)

| Lücke | Ergänzt in |
|---|---|
| Identifikation des Zielgegners im Video | A1 |
| Aktualität/Repräsentativität des Materials, Niveau des damaligen Gegners | A2, A6, A8 |
| Takedown-**Defense** und Striking-**Defense** als Messwert (nicht nur als „Schwäche") | B4 |
| Wo man ihn trifft (Treffer-Zonen am eigenen Körper) | B4 `hitLocations` |
| Nehmerfähigkeit / Verhalten nach Wackler | B4, C1 `after-rocked` |
| Verhalten in offenen Schlagabtauschen | C1 `in-exchanges` |
| Kontroll-/Positions-**Zeiten** statt nur Ja/Nein-Positionsfragen | B5 |
| Kombinationen als strukturierte Sequenzen mit Folge-Lücke | B3 |
| Erholung zwischen den Runden | B7 |
| Auslage-Matchup relativ zum **eigenen** Athleten | F5 |
| Unsauberkeiten/Fouls (Fence Grabs, Eye Pokes) als taktischer Hinweis | C6 (Freitext) |
| Reagiert er auf Corner-Anweisungen (coachbar mitten im Kampf)? | C1 (Freitext) |
| Entwicklung über mehrere Kämpfe (Trends) | E4 |
| Konfidenz, Evidenz & Quellen-Kennzeichnung jedes Befunds | 0.4, E |

---

## Anhang: Redundanz-Auflösung des Roh-Katalogs

Der ursprüngliche 17-Block-Katalog (~200 Fragen) kollabiert wie folgt:

| Roh-Blöcke | Aufgelöst in |
|---|---|
| 1 Allgemein, 16 DNA-Prozente | D1 + B2 + D2/D3 |
| 2 Stance/Bewegung, 10 Cage/Raum | B6 + B8 + C5 |
| 3 Striking, 6 Wrestling (Technik-Ja/Nein) | B1 (Zähltabelle) |
| 4 Kombinationen | B3 |
| 5 Setups/Entries | C2 + `ActionStat.setup` |
| 7 Clinch, 8 Grappling/Boden | B1 + B5 + C-Freitext |
| 9 Defensive Reactions | C4 + B4 |
| 11 Real Habits | C1 |
| 12 Runden/Cardio | B7 |
| 13 Schwächen, 14 Gefahren | C6 + D3 + D4 |
| 15 Exploits, 17 Gameplan | C7 + C8 + C9 |
