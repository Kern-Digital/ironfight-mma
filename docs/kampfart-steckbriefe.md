# Kampfart-Steckbriefe für DeepFight — ENTWURF zum Absegnen

> Stand 17.09.2026, Fable-Fenster. **Kein Code geändert.** Grundlage: sieben
> Recherchen (MMA, Boxen, Kickboxen/K-1/Muay Thai, Ringen, Sambo/Judo,
> BJJ/Grappling, Querschnitt Leistungsanalyse und Videosichtbarkeit) mit
> Primärquellen (Regelwerke als PDF gelesen, Studien mit Reliabilitätswerten),
> abgeglichen mit dem Code-Stand von `lib/gegner-dna.ts`, `lib/fight-stats.ts`,
> `lib/profile-evidence.ts` (Etappe-3-Stand vom 17.09.), `lib/server/gemini.ts`,
> `lib/server/claude.ts` und Versuch 1 (Ereignisliste, `tmp/versuch-ereignisliste-2026-09-17`).
> Abgestimmt mit den Fenstern „Etappe 3" und „Daten sauber" (Abschnitt 9).
>
> Leons Grundentscheidung (17.09.2026) gilt und wird hier nicht diskutiert:
> **EINE gemeinsame Fragenliste** (gleiche ID = gleiche Frage in allen
> Kampfarten) **plus je Kampfart ein Steckbrief** aus drei Teilen — welche
> Fragen gelten, welche Techniken gezählt werden, welche Begriffe passen.

---

## 0. Das Wichtigste in zehn Zeilen

1. **Von 60 Fragen bleiben 59**, eine geht in einer anderen auf (`entry-patterns_jab` → `entry-patterns_start`). 18 Fragen bekommen einen neutraleren oder breiteren Wortlaut, die ID bleibt. Keine Frage fliegt aus inhaltlichen Gründen — jede ist in mindestens zwei Kampfarten sinnvoll.
2. **Acht Zusatzfragen** schließen die Lücken, die heute alle Grappling-Sportarten haben: Boden oben / Boden unten, Griff/Bindung, Clinch-Waffen, Aufgabegriffe, Guard, Wurfrichtung, Verhalten nach einem Wackler. Jede davon ist auf Video sichtbar und bedient mindestens zwei Kampfarten.
3. **Der Steckbrief je Kampfart ist nur eine Sperrliste** (welche Fragen gelten NICHT) plus eine Erlaubnisliste (welche Techniken gezählt werden) plus Begriffe. Alles andere bleibt die gemeinsame Liste. Boxen sperrt 7 Fragen, Kickboxen 5, Ringen 7, Sambo/Judo 7, BJJ 11, MMA 0.
4. **Technikliste von 20 auf 37 Einträge**, zwei neue Gruppen: `clinch` (Knie, Schläge, Fegen im stehenden Griffkontakt) und `submission` (Würger, Armhebel, Beinhebel). Der Sammeleintrag „Wurf (Judo)" wird zu vier Wurfgruppen nach sichtbaren Merkmalen (Hüfte, Schulter/Hand, Bein, Opferwurf); `throw` und `submission` bleiben als Rückfall-IDs.
5. **Jede Technik hat eine sichtbare Definition** für „versucht" und „gelungen" — Endzustände, keine Kraft-, Wertungs- oder Absichtsurteile. Beispiel: Takedown gelungen = Gegner mit Rumpf am Boden UND Angreifer oben oder hinter ihm über mindestens drei Bilder (≈ 2–3 s).
6. **Zonen und Split bleiben** (gleiche Schlüssel, gleiche Bedeutung); `cage` heißt je Kampfart Käfig, Seile oder Mattenrand, und jede Kampfart hat feste Nullen im Split (Boxen: kicking/wrestling/ground = 0).
7. **Regelgrenzen wirken NACH der Beobachtung** (Server-Filter, Muster `SIGNAL_JE_FRAGE`) und in Claudes Bewertung („Cheftrainer für Kickboxen"), nicht als Verbot im Gemini-Prompt — so hat es das Fenster „Daten sauber" gemessen und empfohlen.
8. **Varianten innerhalb einer Gruppe** lösen sich fast alle über „nur was vorkam". Einziger Fall, der einen Chip braucht: Kickboxen ↔ Muay Thai (Ellbogen, Clinch-Serien, Fegen sind dort Kern, in K-1/GLORY Fouls). Kampf-Sambo gehört ins MMA-Profil.
9. **Zahlen erst ab genug Versuchen**: Die Statistik (Wilson-Intervall) sagt, dass 1/1 = „100 %" ein Intervall von 21–100 % hat. Etappe 3 hat bereits „5 Versuche" gesetzt; hier steht die Rechnung dazu.
10. **Aufwand**: eine neue Datei `lib/kampfart-steckbrief.ts`, kleine Änderungen in sieben bestehenden Dateien, ein Fenster für Rechnung + Prompts, ein zweites für Begriffe in der Oberfläche.

---

## 1. Grundsätze aus der Recherche (gelten für alle Steckbriefe)

Diese Regeln folgen aus den Quellen in Abschnitt 11 und erklären jede
Einzelentscheidung weiter unten.

**G1 — Zählen ist verlässlich, Bewerten nicht.** Zwei Experten zählen
Fäuste und Tritte mit ICC 0,88–0,99 gleich; ob ein Treffer „signifikant" war,
nur mit ICC 0,16–0,44 (Rohner et al. 2024, WAKO-WM). Chokes erreichen ICC
0,83, Schläge 0,97–1,00 (MMA-Protokoll, PMC9473287). Folge: Die Zähltabelle
enthält nur Ereignisse mit sichtbarem Endzustand; „Wirkung", „Kraft",
„signifikant", „Wertung des Kampfrichters" stehen nie als Zahl im Profil.

**G2 — Endzustände sind sichtbar, Momente nicht.** Ein Jab dauert rund
0,3–0,4 s; bei 1 Bild/s fällt er zwischen zwei Bilder, bei 5 Bildern/s
erwischt man 1–2 Bilder, den Kontakt fast nie. Ein Takedown, ein Wurf, ein
Sweep, ein Pass, ein Knockdown, ein Abklopfen erzeugen dagegen einen Zustand,
der Sekunden überdauert. Deshalb definiert jeder Eintrag „gelungen" über
den Zustand DANACH (am Boden, oben, hinten, Tap), nie über den Kontaktmoment.

**G3 — Ein Video-LLM ist ein „Bag of Events".** Auf Zählbenchmarks liegt
Gemini bei 12 % (VideoZeroBench 2026), Zeitstempel treffen nur in etwa jedem
vierten Fall (Temporal Grounding R@0,5 ≈ 25). Phantom-Ereignisse entstehen
aus Sprach-Priors („in MMA-Videos gibt es Takedowns"). Folge: Der
Beobachtungs-Prompt darf keine Kampfart-Vorbelegung tragen; die Kampfart
wirkt als Filter danach und in der Bewertung. Genau das hat Versuch 1
gezeigt: Video 1 wurde ohne Vorgabe 3/3 als Kickboxen erkannt, die erfundenen
Takedowns kamen aus dem MMA-lastigen Schema und dem „MMA-Cheftrainer"-Prompt.

**G4 — Kleinstmengen sagen nichts.** 95-%-Wilson-Intervall einer Quote:
1/1 → 21–100 %, 3/3 → 44–100 %, 3/5 → 23–88 %, 6/10 → 31–83 %, 12/20 → 39–78 %,
30/50 → 46–72 %. Folge: unter 5 Versuchen keine Aussage, 5–9 nur „3 von 5",
Prozent ab 10, Bandbreite ab 20, Profilwert ab 50. Etappe 3 hat
`ZAHLEN_MINDESTVERSUCHE = 5` gesetzt — das passt zur ersten Stufe.

**G5 — Muster brauchen mehrere Videos.** Leistungskennzahlen schwanken von
Kampf zu Kampf; die Normprofil-Methode (Hughes/Evans/Wells 2001) verlangt
kumulative Mittelwerte bis zur Stabilität. Faustregel aus der Literatur:
3–5 Videos, bevor ein Muster eine Eigenschaft ist. Das deckt sich mit Leons
Wiederholungs-Regel (zwei Videos) und der Profilstärke (3,0 = drei ganze Kämpfe).

**G6 — Sieg-Indikatoren sind sportartspezifisch, die Verhaltensfragen nicht.**
MMA: Takedown-QUOTE, gelandete Bodenschläge, Positionsverbesserungen,
Trefferquote statt Volumen (James 2016, Kirk 2015/2018). Boxen: Trefferquote,
Führhand-Geraden, Körperarbeit, dynamische Beinarbeit-Abwehr; reine Schlagzahl
und reine Abwehrzahl trennen nicht (Davis 2013/2018, Dunn 2017, Martusciello
2025). Ringen: Punkte je Minute, Single-Leg-Quote (Sieger 73 % vs. 25 %),
Stand-Anteil der Punkte (Fujiyama 2019, Tünnemann). Judo: Angriff auf der
Griffseite (Wertungschance × 1,65), direkte Angriffe 83 %, Kenka-yotsu 67 %
(Courel 2014, Mayo 2019). BJJ: Pass korreliert 99,6 % mit dem Sieg, Sweep
64 %; Rücken = beste Finish-Position (BJJ Heroes, 1 089 Matches). Kickboxen:
Sieger nutzen mehr Haken, Beinarbeit-Abwehr und Clinch (Ouergui 2013).
Muay Thai: Balance nach der Technik (Thais 94,7 % vs. UK 62 %, Myers 2013).
Die Fragen „Wie reagiert er auf Druck?", „Was macht er, wenn er müde wird?",
„Welche Muster wiederholt er?" sind in ALLEN Studien Verhaltensvariablen
mit hoher Beobachterübereinstimmung — deshalb bleiben sie die gemeinsame Mitte.

**G7 — Was auf Video nie sichtbar ist, gehört nicht in den Katalog:**
Griffdetails unter der Jacke, Würgedruck, Hebel kurz vor dem Abklopfen, Kraft,
Absicht/Finte, Kampfrichterwertungen, Shido-/Passivitätsstand, Aktivitätszeit,
Ton (Kommandos, Ecke). Deshalb verliert `weaknesses_conditioning-mental` das
Wort „mental" (nur sichtbares Verhalten zählt), und keine Zusatzfrage fragt
nach Punkten, Wertungen oder Strafen.

---

## 2. Die Form des Steckbriefs (Vorschlag für `lib/kampfart-steckbrief.ts`)

Ein Steckbrief ist eine Datenstruktur, keine zweite Fragenliste:

```
Steckbrief[sport] = {
  begriffe:   { flaeche, mitte, rand, phaseStand, phaseKontakt, phaseBoden, runde, wertung, kategorieRaum },
  gesperrt:   Set<questionId>,        // alle anderen Fragen gelten (+ „nur was vorkam")
  techniken:  Set<actionId>,          // erlaubte Zähl-IDs; alles andere → verworfen[]
  splitNull:  DnaSplitKey[],          // feste Nullen, z. B. Boxen: kicking/wrestling/ground
  zonen:      boolean,                // false = keine Zone (BJJ)
  varianten?: { feld, werte, wirkt: Record<wert, { sperrtTechniken, oeffnetTechniken }> },
  anker:      { ... Plausibilitätswerte für die Bewertung ... },
  rolle:      "Cheftrainer für …"     // Satz für Claudes System-Prompt
}
```

Zwei Funktionen darauf: `frageGiltFuer(questionId, sport)` und
`technikErlaubt(actionId, sport, variante?)`. Der Andockpunkt in der
Rechnung ist `collectPulls()` in `lib/profile-evidence.ts` — dort prüft heute
jede Analyse je Frage `frageOffen(q, signale)`; der Steckbrief ist die zweite
Bedingung daneben (so hat es das Etappe-3-Fenster vorgeschlagen). Die
Kampfart einer Analyse ist `a.sport`, vom Trainer bestätigt.

**Reihenfolge der Filter** (wichtig, damit Signale nicht aus verworfenen
Aktionen entstehen):

1. Beobachtung (Gemini) läuft OHNE Kampfart-Vorgabe und liefert alles, was
   sie sieht — mit allen 37 IDs im Katalogtext.
2. `commit` filtert `actionStats` gegen `techniken[sport]`, setzt
   `splitNull` auf 0 und normiert neu, nullt `defense.takedowns*`, wo
   Takedowns nicht erlaubt sind, und legt die Reste als `verworfen[]` an
   die Analyse (Bericht, „Details anzeigen": „2 Aktionen passten nicht zur
   Kampfart Boxen: 1 Low Kick, 1 Takedown").
3. `beobachteteSignale()` rechnet aus der GEFILTERTEN Beobachtung.
4. `collectPulls()` nimmt einen Befund nur, wenn `frageGiltFuer` UND
   `frageOffen` — für Befunde, Bestätigungen und die Zählung `gelegenheiten`
   (eine gesperrte Frage ist keine Gelegenheit).
5. Claudes Bewertung bekommt Kampfart, Rolle, Begriffe, NUR die offenen
   Fragen im Katalogtext und die gefilterte Beobachtung.

Das Gesamtprofil (`stelleZusammen`, Etappe 3) bleibt unberührt: gleiche
Frage-ID über Kampfarten, gleicher `sideKey` → ein Satz, sonst beide mit
Kampfart-Label.

---

## 3. Gemeinsame Kernfragen — alle 60 im Einzelnen

### 3.1 Zwei Fassungen je Frage (Vorschlag)

Die Fragen sind heute über „den Gegner" formuliert. Sie müssen für Gegner
UND eigene Athleten passen, und Etappe 3 schreibt die Antworten für Athleten
in der Du-Form („Im Stand suchst du die Außendistanz …"). Vorschlag:
**zwei Label-Felder je Frage** — `label` (Gegner-Profil, dritte Person,
wie heute nur ohne „der Gegner") und `labelDu` (Athleten-Profil, Du-Form,
für Athlet UND Trainer sichtbar, passend zu den Antwortsätzen). Beispiel:

> **Stand 17.09.2026 nachmittags:** Leon wollte die Du-Fragen kürzer („Wo bist du
> angreifbar?"). Der Wortlaut in `lib/gegner-dna.ts` ist maßgeblich; die Aufzählung
> steht nur noch in `label`. Außerdem hängen Käfig/Ring/Matte seit dem Beweislauf an
> der FLÄCHE des Videos (Vorlauf), nicht an der Kampfart — siehe CLAUDE.md
> „FLÄCHE UND NUR WAS VORKAM".

| ID | `label` (Gegner) | `labelDu` (Athlet) |
|---|---|---|
| defensive-reactions_pressure | Wie reagiert er auf Druck – Clinch suchen, kontern oder ausweichen? | Wie reagierst du auf Druck – Clinch suchen, kontern oder ausweichen? |

Das vermeidet „er/sie"-Konstruktionen, passt zur Sprachregel („du") und
zur Du-Form der Etappe-3-Sätze. Aufwand: 67 × 2 kurze Texte, einmalig.
Unten steht je Frage nur die Gegner-Fassung; die Du-Fassung ist die
1:1-Umformung.

### 3.2 Die Signal-Gruppen (Sperrlogik)

Jede kampfartspezifische Frage hängt an genau einem Signal; die Steckbriefe
sperren ganze Gruppen:

| Kürzel | Signal | Fragen | Gesperrt in |
|---|---|---|---|
| **S** | Schläge | real-habits_after-hit · real-habits_after-miss · preferred-weapons_punch · defensive-reactions_jabs · defensive-reactions_parry-shell | Ringen · Sambo/Judo · BJJ |
| **K** | Tritte | preferred-weapons_kick · defensive-reactions_low-kicks | Boxen · Ringen · Sambo/Judo · BJJ |
| **T** | Takedowns/Würfe | real-habits_after-td-attempt · entry-patterns_takedown · preferred-weapons_takedown · defensive-reactions_takedowns · drills_takedown-sequences | Boxen · Kickboxen |
| **C** | Clinch/Bindung | entry-patterns_clinch | — (überall offen, „nur was vorkam" entscheidet) |
| **R** | Rand | entry-patterns_center-or-cage · cage-space_at-cage · cage-space_pushes-cage · cage-space_escapes-cage · drills_cage-situations | BJJ (bis auf `at-cage`) |
| **B** | Boden | (neu) real-habits_ground-top · real-habits_ground-bottom · preferred-weapons_guard | Boxen · Kickboxen |
| **N** | neutral | die übrigen 41 | — |

Mit 59 Basisfragen ergibt das: **MMA 59 offen · Boxen 52 · Kickboxen 54 ·
Ringen 52 · Sambo/Judo 52 · BJJ 48** — plus die jeweils passenden Zusatzfragen
(3.5): MMA 66 · Boxen 54 · Kickboxen 56 · Ringen 56 · Sambo/Judo 57 · BJJ 53.

### 3.3 Alle 60 Fragen: Status, Wortlaut, Signal, Geltung

Legende: **✓** gilt unverändert · **✓°** gilt, Wortlaut angepasst (ID bleibt) ·
**–** gesperrt · **✗** entfällt. Wortlaut = neue Gegner-Fassung; ohne Angabe bleibt der heutige.

**real-habits — „Real Habits" (Wiederkehrende Muster)**

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| repeats | Welche Muster wiederholt er immer wieder – was fällt besonders auf? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| after-hit | Was macht er nach einem eigenen Treffer? | S | ✓° | ✓° | ✓° | – | – | – |
| after-miss | Was macht er nach einem verfehlten Schlag? | S | ✓ | ✓ | ✓ | – | – | – |
| when-tired | Was macht er, wenn er müde wird? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| after-td-attempt | Was macht er nach einem Takedown- oder Wurfversuch – folgt er zu Boden, bleibt er dran oder löst er sich? | T | ✓° | – | – | ✓° | ✓° | ✓° |
| plan-fails | Was macht er, wenn sein erster Plan nicht funktioniert? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Begründung `after-td-attempt`: Die Judo-Recherche zeigt, dass „folgt er dem
Wurf in den Boden?" die wichtigste Übergangsfrage ist (IJF Art. 10,
Sambo-Kombination Wurf→Haltegriff); im MMA ist es „nach dem Takedown: G&P,
Pass, nur halten?". Dieselbe Frage, dieselbe ID.

**entry-patterns — „Entry Patterns" (Wie Angriffe beginnen)**

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| start | Wie leitet er Angriffe ein – Jab, Finte, Kick, Level-Change, Griff? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| jab | *(entfällt – geht in `start` auf; heute ein Duplikat: „Womit leitet er ein – Jab, Feints, Kicks oder Level-Change?")* | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| clinch | Wie kommt er in den Clinch oder in die Bindung? | C | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| takedown | Wie kommt er in den Takedown oder Wurf – oder zieht er Guard? | T | ✓° | – | – | ✓° | ✓° | ✓° |
| center-or-cage | Greift er eher in der Mitte oder am Rand an? | R | ✓° | ✓° | ✓° | ✓° | ✓° | – |
| after-entry | Welche Aktion folgt auf seinen Entry? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| counter | Wie lässt sich dieser Entry kontern? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Begriffe je Kampfart für `clinch`: MMA „Clinch", Boxen „Clinch/Halten",
Kickboxen „Clinch (Plum, Nackengriff)", Ringen „Bindung/Fassung", Judo
„Griffkampf (Kumi-kata)", BJJ „Griffkampf im Stand". Für `takedown` in BJJ
ist „oder zieht er Guard?" die entscheidende Ergänzung (Gi-Worlds 2022:
201 Guard-Pulls gegen 28 Takedowns).

**preferred-weapons — „Preferred Weapons" (Bevorzugte Techniken)**

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| most-common | Was ist seine häufigste Waffe? *(Zählfrage – folgt den Zahlen)* | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| most-dangerous | Was ist seine gefährlichste Technik? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| combo | Welche Kombination oder Angriffskette nutzt er oft? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| kick | Welchen Kick nutzt er am meisten? | K | ✓ | – | ✓ | – | – | – |
| punch | Welchen Schlag nutzt er am meisten? | S | ✓ | ✓ | ✓ | – | – | – |
| takedown | Welchen Takedown oder Wurf nutzt er am meisten? | T | ✓° | – | – | ✓° | ✓° | ✓° |
| finish | Welche Technik nutzt er zum Finishen? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| under-pressure | Welche Technik nutzt er unter Druck? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Hinweis zu `combo`: Kombinationen sind bei 1–5 Bildern/s die schwächste
Beobachtung (ein Dreier dauert < 1 s). Belastbar nur bei Ketten mit ≥ 1 s
Abstand (Griff → Wurf, Level-Change → Takedown, Sweep → Submission). Die
Frage bleibt, die Konfidenz trägt die Bewertung.

**defensive-reactions — „Defensive Reactions"**

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| jabs | Wie reagiert er auf Jabs? | S | ✓ | ✓ | ✓ | – | – | – |
| pressure | Wie reagiert er auf Druck – Clinch suchen, kontern oder ausweichen? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| low-kicks | Wie reagiert er auf Tritte – checken, blocken, fangen, ausweichen, kontern? | K | ✓° | – | ✓° | – | – | – |
| takedowns | Wie reagiert er auf Takedown- oder Wurfversuche? | T | ✓° | – | – | ✓° | ✓° | ✓° |
| parry-shell | Verteidigt er mit Deckung und Parade oder mit Kopf- und Beinarbeit (Slip, Roll, Pivot)? | S | ✓° | ✓° | ✓° | – | – | – |
| shoots | Womit antwortet er auf einen Angriff – Konter, Takedown/Wurf oder Abstand? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |

Begründung `parry-shell`: Die einzige Studie, die Abwehrtypen gegen den Sieg
testet (Martusciello 2025, Frauen-WM 2023), findet Pivot und Zurückverlagern
bei Siegerinnen, Parade bei Verliererinnen; World Boxing 7.2.3.1 wertet
„blocking, slipping, weaving, parrying, or footwork" ausdrücklich. Die Frage
fragt deshalb nach dem TYP (Deckung vs. Kopf-/Beinarbeit), nicht nach der
Zahl. Begründung `low-kicks`: Beinfang und Check sind die Kernreaktionen im
Muay Thai (Myers 2013: Thais fangen signifikant häufiger) — dieselbe ID
deckt Low Kick, Body Kick und Beinfang. Begründung `shoots`: „Konter oder
Shot?" ist eine MMA-Formulierung für eine Frage, die überall gilt (Boxen:
Konter oder Abstand/Clinch; Judo: Kaeshi-waza oder Block; Ringen: Re-Shot).

**cage-space — Kategorie heißt künftig „Raum & Rand"** (Käfig · Ring · Matte)

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| center-movement | Wie bewegt er sich im freien Raum / in der Mitte? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| at-cage | Wie verhält er sich am Rand – am Käfig, an den Seilen, am Mattenrand? | R | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| pushes-cage | Drückt er selbst zum Rand oder lässt er sich drücken? | R | ✓° | ✓° | ✓° | ✓° | ✓° | – |
| escapes-cage | Wie löst er sich vom Rand? | R | ✓° | ✓° | ✓° | ✓° | ✓° | – |
| space-under-pressure | Wie nutzt er den Raum, wenn er unter Druck steht? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dangerous-positions | Welche Positionen im Raum sind für ihn gefährlich oder unangenehm? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |

Begründung Rand: Der Rand ist in jeder Kampfart ein echtes Muster mit eigener
Regel — Käfig (Wall-Wrestling, „Cage Control"), Seile („pressure position"
wird von Boxrichtern messbar honoriert, Jabbr-Paper), Mattenrand (Step-out =
1 Punkt UWW, Shido bei absichtlichem Verlassen IJF, Sambo: beide Füße raus).
Für BJJ ist der Rand nur Neustart, daher dort bis auf `at-cage` („nutzt er
Neustarts?") gesperrt.

**weaknesses — Schwächen**

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| technical | Wo ist er technisch anfällig? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| problem-situations | Welche Situationen bereiten ihm sichtbar Probleme? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| repeated-mistakes | Welche Fehler wiederholt er? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| loses-control | Wann verliert er die Kontrolle – in welchem Übergang? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| bad-distance | Welche Distanz liegt ihm nicht? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| gets-hit-by | Welche Angriffe kommen bei ihm besonders oft durch? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |
| conditioning-mental | Welche konditionellen Schwächen zeigen sich über die Runden – Tempo, Deckung, Beinarbeit? | N | ✓° | ✓° | ✓° | ✓° | ✓° | ✓° |

„Distanz" trägt in den Grappling-Sportarten die Bedeutung Griffdistanz,
Innen-/Außenposition, Bodenposition — genau Leons Beispiel „im MMA die
Außendistanz, im Sambo die Griffdistanz". `conditioning-mental` verliert
„mental": Absichten und Nerven sind auf Video nicht beobachtbar (G7);
Ermüdung ist als Verlauf über Runden beschreibbar (Guard-Drop, weniger
Beinarbeit, mehr Clinch), aber Vorsicht: sie trennt Sieger nicht von
Verlierern (Dunn 2017).

**exploits — Exploit-Möglichkeiten** (alle sechs unverändert, überall offen;
Plan-Fragen: KI schlägt vor, Trainer bearbeitet)

`target-weakness` · `technique-vs-pattern` · `provoke-reaction` · `trap` ·
`seek-position` · `avoid-situations` — Signal N, ✓ in allen sechs Kampfarten.
Beim eigenen Athleten bleibt die Umkehrung aus dem Prompt („was Gegner bei
ihm ausnutzen könnten").

**gameplan — Gameplan** (acht, überall offen; Plan-Fragen)

`base-plan` · `seek-distance` · `avoid-distance` · `priority-techniques` ·
`round-1` (Wortlaut: „Welche Taktik passt für den Kampfbeginn / Runde 1?" —
Judo hat keine Runden, ADCC beginnt ohne Punkte) · `if-pressure` ·
`if-passive` · `key-to-win` — Signal N, ✓ in allen sechs.

**drills — Drills**

| ID | Wortlaut (neu) | Signal | MMA | Box | Kick | Ring | Sambo | BJJ |
|---|---|---|---|---|---|---|---|---|
| preparation | Welche Drills passen zur Vorbereitung? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| defensive-reaction | Welche defensive Reaktion soll trainiert werden? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| automate-counters | Welche Konter sollen automatisiert werden? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cage-situations | Welche Rand-Situationen (Käfig, Seile, Mattenrand) sollen geübt werden? | R | ✓° | ✓° | ✓° | ✓° | ✓° | – |
| takedown-sequences | Welche Takedown-, Wurf- oder Anti-Takedown-Sequenzen sind wichtig? | T | ✓° | – | – | ✓° | ✓° | ✓° |
| sparring-tasks | Welche Sparring-Aufgaben passen zum Gameplan? | N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 3.4 Was in der Spezifikation als „+ neu" steht und was daraus wird

`docs/gegner-dna-video-analyse-fragenkatalog.md` führt fünf ungebaute
Zusatz-IDs. Abgleich:

| Spec-ID | Vorschlag |
|---|---|
| real-habits_after-rocked | **übernehmen** (3.5, Nr. 8) — Verhalten nach Wackler/Anzählen ist sichtbar und in Boxen, Kickboxen, MMA wertungsrelevant (10-8/10-7) |
| real-habits_in-exchanges | nicht als eigene Frage — geht in `real-habits_after-hit`/`after-miss` und `defensive-reactions_pressure` auf |
| defensive-reactions_predictable | nicht — ist die Trainer-Ableitung `exploits_trap` |
| weaknesses_vs-southpaw | nicht jetzt — Auslage steht in `movement.stance`; Etappe 3 stellt Selbstauskunft und Video-Auslage nebeneinander |
| gameplan_round-2-3 | nicht — `gameplan_round-1` + `when-tired` decken es |

### 3.5 Acht Zusatzfragen (Hicksches Gesetz: jede bedient ≥ 2 Kampfarten und ist sichtbar)

Aus rund 45 Vorschlägen der sechs Recherchen bleiben nach Zusammenlegen
acht. Alles andere geht in bestehende IDs auf (siehe 3.6).

| # | ID | Kategorie | Wortlaut (Gegner) | Woran im Video erkennbar | Signal öffnet bei | Gilt in |
|---|---|---|---|---|---|---|
| 1 | `real-habits_ground-top` | real-habits | Was macht er oben am Boden – Druck und Kontrolle, Passen, Schlagen, Aufgabegriff suchen, Ausheben oder Durchdrehen? | erste Aktion nach Takedown/Wurf/Pass; Positionswechsel; Zeit in Kontrolle | `controlTime.topSeconds > 0` | MMA · Ringen · Sambo/Judo · BJJ |
| 2 | `real-habits_ground-bottom` | real-habits | Was macht er unten – Guard spielen, sweepen, aufstehen, Bauchlage und Basis halten, Aufgabegriff von unten? | Körperlage nach eigenem Sturz; Escape-/Sweep-/Stand-up-Ereignisse | `controlTime.bottomSeconds > 0` | MMA · Ringen · Sambo/Judo · BJJ |
| 3 | `preferred-weapons_grip` | preferred-weapons | Welchen Griff oder welche Bindung sucht er zuerst – Ärmel/Revers, Unterhaken, Nackengriff, Body Lock, links oder rechts? | Handposition in den ersten Kontaktsekunden; Jacke macht Griffart sichtbar | `clinchSeconds > 0` | MMA · Ringen · Sambo/Judo · BJJ |
| 4 | `preferred-weapons_clinch` | preferred-weapons | Womit arbeitet er im Clinch – Knie, Ellbogen, kurze Schläge, Fegen oder Umwerfen, oder hält er nur? | Zähler der Gruppe `clinch`; Break durch den Ringrichter | `clinchSeconds > 0` | MMA · Boxen · Kickboxen |
| 5 | `preferred-weapons_submission` | preferred-weapons | Welche Aufgabegriffe sucht er – Würger, Armhebel, Beinhebel – und aus welcher Position? | Zähler der Gruppe `submission`; Position vor dem Versuch | ≥ 1 Eintrag Gruppe `submission` | MMA · Sambo/Judo · BJJ |
| 6 | `preferred-weapons_guard` | preferred-weapons | Welche Guard spielt er – geschlossen, Half Guard, offen mit Beinkontrolle, Beinverwicklung? | Beinstellung, Sitz vs. Rückenlage; Detailguards nur bei freier Sicht | `bottomSeconds > 0` | BJJ · MMA |
| 7 | `entry-patterns_throw-direction` | entry-patterns | In welche Richtung und auf welche Seite greift er an – vorwärts (Eindrehen) oder rückwärts (Sichel, Fegen), links oder rechts? | Rotation des Angreifers, Fallrichtung, Griffseite | ≥ 1 Eintrag Gruppe `takedown` | Ringen · Sambo/Judo |
| 8 | `real-habits_after-rocked` | real-habits | Was macht er nach einem Wackler oder Anzählen – klammern, zurückfeuern, laufen, Takedown suchen? | `rockedMoments`/`knockdownsReceived` + die 30 s danach | ≥ 1 Wackler/Knockdown gegen ihn | MMA · Boxen · Kickboxen |

Belege: Nr. 1–2 fehlen heute komplett (der Katalog hat keine einzige
Bodenfrage), obwohl gelandete Bodenschläge und Positionsverbesserungen die
stärksten MMA-Sieg-Indikatoren sind (James 2016) und im Ringen 44–82 % der
Punkte aus der Bodenlage kommen (UWW-Analysen). Nr. 3: Angriff auf der
Griffseite erhöht die Wertungschance im Judo × 1,65 (Courel 2014);
Griffkampf ist 40 % der Judo-Kampfzeit (Barreto 2019); Bindung bereitet
jeden Ringer-Angriff vor. Nr. 4: Muay-Thai-Clinch ist eine eigene
Wertungszone (IFMA, Stadion); K-1/GLORY erlauben genau ein Knie. Nr. 5:
Submission-Anteile 35–46 % (IBJJF Worlds), 65 % Würger / 22 % Beinhebel
(ADCC 2024). Nr. 6: Gi-Worlds 2022: 252 Sweeps, 60 % aus Beinkontrolle.
Nr. 7: Judo-WM 2013: vorwärts 57,5 %, rückwärts 42,4 %, Kenka-yotsu 67 %
(Mayo 2019); Kamera-Spiegelung macht links/rechts nur „mittel" sicher.
Nr. 8: bereits in der Spezifikation.

Eine neunte Frage wäre sinnvoll, braucht aber ein neues Beobachtungsfeld
(Unterbrechungen/Neustarts) und steht deshalb zurück:
`real-habits_after-restart` — „Was macht er direkt nach einer Unterbrechung
– sofort angreifen, abwarten, Griff suchen?" (Ringen, Judo, Kickboxen nach
dem Break, MMA nach dem Stand-up).

### 3.6 Was aus den Recherchen NICHT zur Frage wird — und wo es hingeht

| Vorschlag (Recherche) | Geht auf in |
|---|---|
| Boxen: Kopfbewegung vs. Deckung | `defensive-reactions_parry-shell` (neuer Wortlaut) |
| Boxen: Ringmitte halten · Arbeit an den Seilen | `cage-space_center-movement` · `cage-space_at-cage` |
| Boxen: Körperarbeit · Auslagenwechsel | Zähler mit Ziel Körper (4.2) · `movement.stance` |
| Kickboxen: Beinfang · Kick-Setup · Tempo je Runde · Balance nach dem Tritt | `defensive-reactions_low-kicks` · `entry-patterns_start` · `when-tired` + Rundenkurve · `weaknesses_technical` |
| MMA: Wall-Wrestling · Level-Change · Übergänge · Phase erzwingen · Scrambles | `cage-space_at-cage` · `entry-patterns_start` · `weaknesses_loses-control` · `gameplan_base-plan` · `drills_defensive-reaction` |
| Ringen: Verteidigung am Rand · nach Unterbrechung · Amplitude · Finish-Tempo | `cage-space_at-cage` · (zurückgestellt) · Zähler `throw-*` mit `damage` = Landungsgrad · Zähler |
| Judo: Griff lösen · Passivitätsdruck · Angriffsrhythmus · Beingreifer | `defensive-reactions_takedowns` · nicht sichtbar (G7) · Rundenkurve/Output · Zähler `single-leg` |
| BJJ: Guard-Pull oder Takedown · Pass-Stil · Finish-Position · Escapes · Beinverwicklung · Scramble | `entry-patterns_takedown` · Nr. 1 · Nr. 5 · Nr. 2 · Nr. 6 · Nr. 2 |

---

## 4. Techniken — EINE Liste, 37 Einträge, sechs Gruppen

### 4.1 Warum zwei neue Gruppen

- **`clinch`** — Knie, kurze Schläge und Fegen im stehenden Griffkontakt.
  Heute zählt ein Clinch-Knie als `knee` (Gruppe `kick`) und ein Dump aus dem
  Muay-Thai-Clinch als `trip` (Gruppe `takedown`) — im Stresstest wurde daraus
  ein „Takedown" im MMA-Sparring mit viel Kickboxen (Leon 17.09.: die
  Stresstest-Videos sind MMA, niemand geht zu Boden). UFC Stats führt Clinch als eigene
  Position mit eigener Zählung; im Muay Thai ist der Clinch eine
  Wertungszone; K-1/GLORY erlauben genau ein Knie. Signal: `clinch`.
- **`submission`** — Würger, Armhebel, Beinhebel statt eines Sammeleintrags
  „Submission-Versuch". Die drei Familien haben verschiedene Sichtbarkeit
  (Armhebel-Geometrie sichtbar, Würger verdeckt), verschiedene Regelgrenzen
  (Judo: keine Beinhebel; Sport-Sambo: keine Würger; IBJJF: Heel Hook nur
  No-Gi Braun/Schwarz) und verschiedene Häufigkeit (ADCC 2024: 65 % Würger,
  20 % Armhebel, 22 % Beinhebel). Signal: `submissions` (neu) und `ground`.

Die Gruppe `takedown` heißt in der Anzeige „Takedowns & Würfe" und bedeutet
überall: **Stand → Boden**. `ground` bleibt Bodenkampf. Zwei Grundsätze aus
dem Fenster „Daten sauber", die für ALLE Einträge gelten:

- **Eine Umklammerung im Stand ist eine Phase, kein Versuch** — `body-lock`
  zählt nur mit sichtbarer Hebe-, Kipp- oder Drehbewegung.
- **Eine Abwehrbewegung ist nie eine Angriffsaktion.** Ducken, Abtauchen,
  Slip, Roll, Sprawl, Beinblock, Bein hochnehmen gehören als `abwehr` zum
  Ereignis des Angreifers und erzeugen keinen eigenen Zähler. Gemessen
  (17.09., Versuch Ereignisliste): Das Ducken von Rot unter einem Schlag bei
  31 s liest Gemini in 4 von 4 Läufen bei jeder Bildrate als „Kick von Rot" —
  ein Satz im Katalogtext muss das ausschließen, und die Definition
  „versucht" verlangt bei Tritten das gestreckte Bein Richtung Ziel, nicht
  nur ein angehobenes Knie.

### 4.2 Ziel je Ereignis statt Körper-IDs

Boxen bräuchte Körperhaken und Körpergeraden getrennt (El-Ashker 2011:
Führhand-Körperhaken und Körperuppercuts trennen Sieger). Statt neuer IDs
trägt jedes Ereignis das Ziel `kopf | koerper | beine` — so steht es schon im
Ereignis-Schema aus Versuch 1 (`ziel`). Das Profil zeigt dann „Haken: 14, davon
6 zum Körper". Dasselbe gilt für Knie und Tritte (Trittebene).

### 4.3 Die Liste — mit sichtbaren Definitionen

Sichtbarkeit aus einer Handykamera bei 1–5 Bildern/s: **hoch** = Endzustand
überdauert Sekunden · **mittel** = meist erkennbar, Typ kann verwechselt werden ·
**niedrig** = nur mit Konfidenz-Flag. Die Schwelle „≥ 3 Bilder" (bei 1 fps ≈ 3 s,
bei 5 fps ≈ 0,6 s → Vorschlag: mindestens 2 s ODER 3 Bilder, was länger ist)
ist eine Produktentscheidung; die IBJJF verlangt 3 s Stabilisierung, UWW und
FightMetric nennen keine Sekundenzahl.

**Gruppe `strike` — Schläge aus der Distanz** (Signal `strikes`)

| ID | Label | versucht (sichtbar) | gelungen (sichtbar) | Sicht | Neu |
|---|---|---|---|---|---|
| jab | Jab | Führhand streckt sich gerade zum Ziel | Kontakt an Kopf/Rumpf, Kopf oder Rumpf bewegt sich | mittel | |
| cross | Cross | Schlaghand gerade, Hüfte dreht ein | wie oben | mittel | |
| hook | Haken | gebogener Arm, seitliche Bogenbahn | Kontakt, Kopf dreht | mittel | |
| uppercut | Aufwärtshaken | Bahn von unten | Kontakt, Kopf hebt sich | niedrig–mittel | |
| overhand | Overhand | Bogen über die Deckung | Kontakt | niedrig (kaum von Haken trennbar, sparsam nutzen) | |
| elbow | Ellbogen | angewinkelter Arm auf kurzer Distanz | Kontakt, Kopf knickt, Cut | mittel | |
| spinning-strike | Drehschlag (Backfist, Spinning Elbow) | sichtbare Drehung ≥ 180° mit Faust/Ellbogen | Kontakt | hoch (Drehung ist träge) | ✚ |

**Gruppe `kick` — Tritte und Knie aus der Distanz** (Signal `kicks`, zählt auch als `strikes`)

| ID | Label | versucht | gelungen | Sicht | Neu |
|---|---|---|---|---|---|
| low-kick | Low Kick | Schienbein/Rist zum Oberschenkel | Kontakt, Bein knickt oder wandert; „gecheckt" = Abwehr | hoch | |
| body-kick | Body Kick | Bein auf Rumpfhöhe | Kontakt, Rumpf/Arme klappen | hoch/mittel | |
| high-kick | High Kick | Bein auf Kopfhöhe | Kontakt, Kopf weicht | hoch/mittel | |
| front-kick | Front Kick / Teep | gerader Stoß | Gegner wird weggeschoben oder geht zurück | hoch (Teep vs. Snap NICHT trennen) | |
| knee | Knie (Distanz, Sprung) | Knie hebt OHNE Griff | Kontakt, Rumpf klappt | mittel | |
| spinning-kick | Drehkick (Back, Hook, Wheel, Axe) | Rotation über ≥ 2 Bilder | Kontakt | mittel | ✚ |

**Gruppe `clinch` — im stehenden Griffkontakt** (Signal `clinch`) ✚ neue Gruppe

| ID | Label | versucht | gelungen | Sicht | Neu |
|---|---|---|---|---|---|
| clinch-knee | Knie im Clinch | Griff an Nacken/Arm/Körper + Knie hebt | Kontakt, Rumpf/Kopf bewegt sich | hoch (Rumpf), Serienzahl unsicher | ✚ |
| clinch-strike | Schlag/Ellbogen im Clinch (Dirty Boxing) | Faust oder Ellbogen bei Griffkontakt | Kontakt | niedrig (kurze Wege) | ✚ |
| sweep-dump | Fegen / Umwerfen aus dem Clinch oder nach Beinfang | Fußfeger, Zug oder Drehung aus dem Griff; Wurf nach gefangenem Bein | Gegner berührt mit mehr als den Füßen den Boden, Ausführender bleibt stehen (WAKO Kap. 7 Art. 8) | Sturz hoch, Ursache mittel | ✚ |

`sweep-dump` gibt es nur in Kampfarten, in denen der Kampf am Boden stoppt
(Kickboxen/Muay Thai). Dieselbe Bewegung im MMA oder Ringen ist ein Takedown
(`trip`/`body-lock`), weil der Kampf weitergeht — das löst die body-lock-Falle
aus Versuch 1 sauber über die Kampfart. Beinfang ohne Folgeaktion ist kein
Ereignis; ein Beinfang mit Konterschlag ist der Schlag mit `setup: "Beinfang"`.

**Gruppe `takedown` — „Takedowns & Würfe", Stand → Boden** (Signal `takedowns`)

| ID | Label | versucht | gelungen | Sicht | Neu |
|---|---|---|---|---|---|
| single-leg | Single Leg (inkl. High Crotch, Ankle Pick, Low Single) | Niveauwechsel, Hände/Arme an EINEM Bein unterhalb der Hüfte | Gegner mit Rumpf/Gesäß oder ≥ 3 Kontaktpunkten (Hände/Knie/Kopf) am Boden UND Angreifer oben oder hinter ihm ≥ 3 Bilder | hoch / mittel | |
| double-leg | Double Leg | Arme um BEIDE Beine, Kopf seitlich an der Hüfte | wie oben | hoch / mittel | |
| body-lock | Body-Lock-Takedown | Arme um den Rumpf geschlossen UND Hebe-, Kipp- oder Drehbewegung — bloßes Umklammern ist Clinch-Phase | wie oben | mittel | |
| trip | Bein-/Fußtechnik (Trip, Fußfeger, Sichel, Uchi-mata, Ashi-waza) | Angreiferbein blockiert, fegt oder hebt das Gegnerbein, Gegner verliert das Gleichgewicht | wie oben; Judo/Sambo: Landungsgrad (4.4) | mittel (Beine verwischen bei 1 fps) | Label |
| throw-hip | Hüftwurf (Koshi-waza, Hüftschwung, Kopfhüftzug) | Eindrehen mit Hüftkontakt, Gegner hebt ab | Landung auf Seite/Rücken unter Griffkontrolle | hoch | ✚ |
| throw-shoulder | Schulter-/Handwurf (Seoi-nage, Tai-otoshi, Kata-guruma, Achselwurf, Armwurf) | Eindrehen ohne Hüftblock oder Arm fixiert, Angreifer dreht unter den Arm | wie oben | hoch / mittel | ✚ |
| throw-sacrifice | Opferwurf (Sutemi-waza, Tomoe-nage, Sumi-gaeshi, Tani-otoshi, Suplex/Überwurf, Ura-nage) | Angreifer fällt selbst mit (Rücken/Seite) und hält den Griff | Gegner landet Seite/Rücken | hoch (Angreifer am Boden = eindeutiges Bild) | ✚ |
| throw | Wurf, Gruppe nicht erkennbar | Gegner verliert beide Füße vom Boden | wie oben | — | Rückfall |
| go-behind | Hinter den Gegner (Armzug, Duck-under, Nackenzug → Go-behind) | Richtungswechsel hinter den Gegner aus der Bindung | Kontrolle von hinten, Gegner ≥ 3 Kontaktpunkte am Boden | mittel | ✚ |
| guard-pull | Guard-Pull | Hinsetzen oder Springen MIT Griff | Guard etabliert, Gegner oben ≥ 3 Bilder | hoch | ✚ |

Vier Wurfgruppen statt Einzelwürfen (Hicksches Gesetz): Die einzige
Video-Wurfklassifikation per Pose liegt auf Zufallsniveau (AUC 0,49–0,56,
thorwhalen/kodokan); die Gruppen unterscheiden sich aber über träge,
sichtbare Merkmale — Hüftkontakt, Eindrehen unter den Arm, Beinkontakt,
Angreifer fällt mit. Konter (Kaeshi-waza, Re-Shot) sind kein eigener
Eintrag, sondern `setup: "Konter"` am Wurf (wie Mayo 2019 direkt/Konter
kodiert; Ringen-Analysen führen „counter" ebenso als Attribut).

**Gruppe `ground` — Bodenkampf** (Signal `ground`)

| ID | Label | versucht | gelungen | Sicht | Neu |
|---|---|---|---|---|---|
| pass | Guard Pass | Oberlage greift die Beinlinie an | Side Control, North-South, Knee-on-Belly oder Mount ≥ 3 Bilder | hoch (Endzustand) | |
| sweep | Sweep / Umdrehen von unten (Reversal) | Untenliegender kippt oder hebt die Oberlage | Rollentausch, neue Oberlage ≥ 3 Bilder | hoch | Label |
| back-take | Rücken nehmen | Hüfte hinter den Gegner, Hooks/Body-Triangle | Position ≥ 3 Bilder | hoch | ✚ |
| escape | Escape / Aufstehen | Unterer verlässt Side/Mount/Back oder steht auf (Wall-Walk, technischer Stand) | Guard zurück, Turtle oder beide Füße frei ≥ 3 Bilder | hoch | ✚ |
| turn | Drehen am Boden (Durchdreher, Beinschraube, Halbnelson, Umdrehen aus Bauchlage/Turtle) | Obermann dreht den Untermann um die Längsachse | Untermann rollt über den Rücken oder landet auf dem Rücken; je Umdrehung ein Ereignis | hoch (ab 3 fps zählbar) | ✚ |
| hold-down | Haltegriff (Osaekomi, Pin, Schulterlage) | Tori oben/quer, Ukes Rücken am Boden, Rumpf auf Rumpf | ≥ 5 s gehalten (Judo Yuko-Schwelle); Dauer aus Zeitstempeln | hoch | ✚ |
| ground-strikes | Ground & Pound | Schlagserie aus der Oberlage | Kontakt, Kopf des Unteren bewegt sich | niedrig je Schlag, mittel als Serie | |
| submission | Aufgabegriff, Art nicht erkennbar | Griff geschlossen, Abwehrreaktion | Tap/Stopp | — | Rückfall |

**Gruppe `submission` — Aufgabegriffe** (Signal `submissions` + `ground`) ✚ neue Gruppe

| ID | Label | versucht | gelungen | Sicht | Neu |
|---|---|---|---|---|---|
| choke | Würger (RNC, Guillotine, Triangle, Arm-Triangle/D'Arce, Ezekiel, Revers-/Bow-and-Arrow, Hadaka-jime) | Arm, Revers oder Beine am Hals UND sichtbare Abwehrreaktion | Tap, Stopp, bewusstlos | mittel (Hände verdeckt) | ✚ |
| armlock | Armhebel (Armbar/Juji-gatame, Kimura/Ude-garami, Americana, Omoplata, Wristlock) | Arm isoliert + Streck- oder Drehbewegung | Tap, Stopp | mittel | ✚ |
| leglock | Beinhebel (Straight Ankle/Achilles, Kneebar, Toe Hold, Heel Hook, Slicer) | Bein isoliert + Streckung oder Drehung | Tap, Stopp | niedrig–mittel | ✚ |

FightMetric zählt einen Submission-Versuch nur „applied" (Griff geschlossen
und Druck), Setups zählen nicht — dieselbe Regel hier: „versucht" verlangt
die sichtbare Abwehrreaktion des Gegners.

### 4.4 Felder, die keine Technik sind (Beobachtung, nicht Zähltabelle)

| Feld | Zweck | Für |
|---|---|---|
| `ziel` je Ereignis (kopf/koerper/beine) | Körperarbeit, Trittebene | alle Schlagsportarten |
| `damage` für Würfe = **Landungsgrad** 1 Bauch/Knie/Gesäß · 2 Seite · 3 Rücken/Rollen | statt Ippon/Waza-ari/Yuko bzw. 4/2/1 — die Wertung selbst ist nicht sichtbar (IJF nutzt CARE-Video), die Landung schon | Ringen · Sambo/Judo (auch MMA-Würfe) |
| `defense.methods` (arm / rumpf / beinarbeit; tritte gecheckt / gefangen) | Typ der Abwehr, NICHT Zählung (G1) | Boxen · Kickboxen · MMA |
| `defense.takedownMethod` (sprawl / whizzer / griff brechen / scramble) | Wie er Takedowns/Würfe abwehrt | MMA · Ringen · Sambo · BJJ |
| `positions` in Sekunden (guard, half, side, mount, back, turtle, leg-entanglement, standing) | Spec B5, Positionszeiten oben/unten | MMA · BJJ · Sambo · Ringen |
| `edge.stepOuts` (erzwungen / kassiert) | Mattenrand-Verhalten, 1 Punkt UWW | Ringen (Sambo) |
| `grips.dominant` + `grips.side` | Griff/Bindung für Frage 3.5 Nr. 3 | Ringen · Sambo/Judo · BJJ · MMA |
| `restarts` (Anzahl Unterbrechungen) | Vorbedingung für die zurückgestellte Frage `after-restart` | alle |

Diese Felder gehören in das Ereignis-Schema, das das Fenster „Daten sauber"
gerade prüft (Versuch 1 hat bereits `ziel`, `ergebnis`, `abwehr`, `phasen` mit
`kontrolle`). Sie werden hier nur benannt, nicht entworfen.

### 4.5 Was mit alten IDs passiert

- `throw` und `submission` bleiben als Rückfall („Gruppe nicht erkennbar");
  neue Analysen bekommen die feinen IDs. `cleanActionStats()` wirft
  unbekannte IDs still weg — jede neue ID MUSS in `ACTION_CATALOG` stehen.
- `sideKey`: Claude nimmt für Technik-Antworten die Katalog-ID als
  Seitenschlüssel. Alte „throw"-Seiten ziehen nicht mit neuen
  „throw-hip"-Seiten zusammen. Bestand ist Demo (Leon 14.09.), also kein
  Backfill; im Entwurf festgehalten, weil das Etappe-3-Fenster darauf hinwies.
- Labels ändern sich für `trip` („Bein-/Fußtechnik …") und `sweep`
  („Sweep / Umdrehen von unten"); `ACTION_GROUP_META` bekommt `clinch`
  (Farbe `FIGHT_FAMILY_COLOR.clinch`) und `submission` (Farbe `ground`, oder
  eigener Token — Design-Frage).

---

## 5. Zonen und Split — gleiche Schlüssel, gleiche Bedeutung

### 5.1 Zonen

Schlüssel bleiben `center | open | cage`. Bedeutung wird kampfartneutral:
**center** = Mitte der Kampffläche · **open** = freier Raum dazwischen ·
**cage** = am Rand der Kampffläche mit Kontakt oder Druck (Käfig, Seile/Ecke,
Passivitätszone/Mattenrand). Anzeige je Kampfart:

| | MMA (Käfig) | MMA (Ring, z. B. Rizin) | Boxen · Kickboxen | Ringen · Sambo/Judo | BJJ |
|---|---|---|---|---|---|
| center | Käfigmitte | Ringmitte | Ringmitte | Mattenmitte | — |
| open | offener Raum | offener Raum | Halbdistanz frei | offener Raum (Einbau 17.09.: „Kampffläche" las sich neben „Mattenmitte" wie die ganze Matte) | — |
| cage | am Käfig | an den Seilen | an den Seilen / in der Ecke | am Mattenrand / in der Zone | — (keine Zone; Rand = Neustart) |

`controlTime.cagePressureSeconds` / `pressedSeconds` gelten überall, wo es
eine Wand oder Seile gibt; im Seilring ohne Wand ist „Druck" das Drängen an
die Seile (Boxrichter honorieren „pressure position" messbar, Jabbr-Paper).
Für BJJ ist die Zone `null`.

### 5.2 Split — fünf Schlüssel, definiert über Phasen

Die fünf Anteile bleiben, weil Etappe 3 sie mittelt und die Helix sie in
Bänder übersetzt. Neu ist eine **kampfartübergreifende Definition über die
Phasen** (so, wie Versuch 1 sie schon liefert: distanz / clinch / boden) —
und die Empfehlung, dass der **Code** den Split aus den Phasen rechnet,
nicht das Modell schätzt (Sache des Fensters „Daten sauber"):

| Schlüssel | Bedeutung (alle Kampfarten) | Sichtbare Regel |
|---|---|---|
| **boxing** | Distanzphase, Hände | Distanzzeit × Anteil Handtechniken an allen Distanztechniken |
| **kicking** | Distanzphase, Beine | Distanzzeit × Anteil Tritte/Knie |
| **clinch** | stehender Griffkontakt ohne laufenden Wurfansatz | beide stehen, Griff an Nacken/Arm/Körper/Jacke ≥ 1 s (Miarka: Griffphase ≥ 1 s); Muay-Thai-Clinch, Bindung, Kumi-kata, Wall-Clinch |
| **wrestling** | Takedown-/Wurfaktionen und Scrambles am Übergang Stand→Boden; in reinen Grappling-Sportarten auch der Stand ohne Kontakt | ab sichtbarem Ansatz (Niveauwechsel, Eindrehen, Hebe-/Kippbewegung, Sprawl) bis Boden, Distanz oder Clinch; Wall-Wrestling mit gehaltenem Bein |
| **ground** | mindestens einer ist am Boden und der andere im Kontakt | Regelanker: MMA „grounded" = alles außer Händen/Füßen (ABC 2024); Ringen: ein Knie = Bodenlage (UWW Art. 34); Judo: beide Knie oder einer liegt (IJF Art. 10); bis beide Füße frei stehen |

Unterbrechungen (Break, Mate, Rundenpause, Stand-up durch den Referee) zählen
nicht; die 100 % beziehen sich auf Kampfzeit. Drei-Bilder-Hysterese gegen
Flackern. Damit gilt strukturell: **ohne Bodenphase kein `takedown.landed`**
(die Regel `takedownOhneBoden` aus Versuch 1).

**Feste Nullen je Kampfart** (der Steckbrief setzt sie nach der Beobachtung):

| Kampfart | boxing | kicking | clinch | wrestling | ground | Plausibilitätsanker (Literatur) |
|---|---|---|---|---|---|---|
| MMA | frei | frei | frei | frei | frei | Stand ≈ 50 %, Boden ≈ 36 %, Clinch ≈ 13 %, Käfigzeit ≈ 21 % (Roy & Murphy 2026) |
| Boxen | frei | **0** | frei | **0** | **0** | 20–25 Schläge/min; Clinch-Zeit steigt mit Ermüdung (Dunn 2017) |
| Kickboxen | frei | frei | frei | **0** | **0** | Arm 63 % / Bein 37 % der Techniken (Slimani 2017); Clinch im K-1 wenige %, im Muay Thai ohne Limit |
| Ringen | **0** | **0** | frei | frei | frei | Freistil Stand 74–79 % / Boden 21–26 % (PLOS ONE 2023); GR 44–47 % der Punkte aus dem Boden |
| Sambo/Judo | **0** | **0** | frei | frei | frei | Griffkampf ≈ 40 % der Kampfzeit, Wurf 1,0–1,4 s (Barreto 2019, Franchini 2013) |
| BJJ | **0** | **0** | frei | frei | frei | Boden 79–87 % (Del Vecchio 2007, Spanias 2022) |

Ein Profil, das die Anker deutlich verfehlt (Freistil mit ground > 40 %,
Boxen mit clinch > 30 %), ist ein Prüfsignal für die Bewertung — kein
Automatismus, aber ein Satz im Prompt.

**BJJ-Untersplit** (später, additiv): Unter `ground` fünf Unterschlüssel
top-passing / top-control / bottom-guard / bottom-pinned / neutral, Summe =
ground. Das entspricht den Studienkategorien (Andreato 2015, Santos 2023)
und braucht nur die Positionszeiten aus 4.4 — kein neuer Split-Schlüssel.

---

## 6. Signale — was eine Frage „offen" macht

`SIGNAL_JE_FRAGE` wächst um die Zusatzfragen und zwei neue Signale;
`beobachteteSignale()` bekommt die neuen Gruppen zugeordnet (Hinweis des
Etappe-3-Fensters: sonst sperrt „nur was vorkam" falsch).

| Signal | kommt aus | neu? |
|---|---|---|
| strikes | Gruppe `strike`, Split boxing > 0, `defense.strikes*` | — |
| kicks (impliziert strikes) | Gruppe `kick`, Split kicking > 0 | — |
| clinch | Gruppe `clinch`, Split clinch > 0, `controlTime.clinchSeconds` | Gruppe neu |
| takedowns | Gruppe `takedown`, Split wrestling > 0, `defense.takedowns*` | — |
| ground | Gruppe `ground`, Gruppe `submission`, Split ground > 0, top/bottom-Sekunden | — |
| **ground-top** | `controlTime.topSeconds > 0` oder `positions` oben | ✚ |
| **ground-bottom** | `controlTime.bottomSeconds > 0` oder `positions` unten | ✚ |
| **submissions** | ≥ 1 Eintrag Gruppe `submission` (attempted > 0) | ✚ |
| cage | Zone `cage` an Aktionen/Combos, `cagePressure`/`pressed` | — |
| **rocked** | `rockedMoments.length > 0` oder `knockdownsReceived > 0` | ✚ |
| **attacked** | `strikesAgainst + takedownsAgainst > 0` | ✚ |

Neue und geänderte Einträge in `SIGNAL_JE_FRAGE`:

| Frage | Signal | Bemerkung |
|---|---|---|
| real-habits_ground-top | ground-top | neu |
| real-habits_ground-bottom | ground-bottom | neu |
| preferred-weapons_guard | ground-bottom | neu |
| preferred-weapons_grip | clinch | neu |
| preferred-weapons_clinch | clinch | neu |
| preferred-weapons_submission | submissions | neu |
| entry-patterns_throw-direction | takedowns | neu |
| real-habits_after-rocked | rocked | neu |
| defensive-reactions_shoots | attacked | war `takedowns` — Wortlaut jetzt neutral |
| weaknesses_gets-hit-by | attacked | war `strikes` — Wortlaut jetzt neutral |
| defensive-reactions_low-kicks | kicks | unverändert, deckt jetzt alle Tritte |
| entry-patterns_jab | — | entfällt |

Alle anderen 21 bestehenden Einträge bleiben. Reihenfolge im Code: Signale
aus der GEFILTERTEN Beobachtung (Abschnitt 2), sonst öffnet ein verworfener
Phantom-Takedown die Takedown-Fragen.

---

## 7. Die sechs Steckbriefe

Jeder Steckbrief: Regelrahmen (nur, was die Analyse betrifft, mit Quelle) ·
Begriffe · gesperrte Fragen · erlaubte Techniken · feste Nullen · Varianten ·
was auf Video sicher/unsicher ist · Prüfsätze für die Bewertung.

### 7.1 MMA

**Regelrahmen.** Unified Rules (ABC, rev. Juli 2024, wirksam 01.11.2024):
5-min-Runden, „grounded" = jeder Körperteil außer Händen und Füßen am Boden
(eine Hand reicht nicht mehr), 12-6-Ellbogen erlaubt; Wertung Effective
Striking/Grappling → Aggressiveness → Fighting Area Control; ein Takedown
zählt erst mit „establishment of an attack", Positionskontrolle ohne Schaden
reicht nicht für 10-8 (ABC Clarification 7/2025). Amateur (IMMAF 10/2022,
GEMMAF Ü18 01.01.2025): 3 × 3 min, Schienbeinschoner, **keine Ellbogen, keine
Knie zum Kopf (auch stehend), kein Heel Hook**. Ring statt Käfig (Rizin):
kein Wall-Wrestling, `cagePressure` ≈ 0.

**Begriffe.** Käfig/Cage/Oktagon, Zaun, „an der Wand", Wall-Wrestling,
Cage Control; im Ring: Seile, Ecke. Phasen Stand/Clinch/Boden; Shot, Sprawl,
Scramble, Stand-up; Guard, Half Guard, Side Control, Mount, Back Control,
Turtle; Underhook, Overhook, Collar Tie, Body Lock, Whizzer; G&P, Submission/
Aufgabegriff (GEMMAF-Wort), Level-Change, Knockdown. Rolle für Claude:
„erfahrener MMA-Cheftrainer" (heute schon). Kategorie-Label „Käfig & Raum".

**Fragen.** Keine gesperrt — MMA ist die Obermenge; „nur was vorkam"
entscheidet je Video. Zusatzfragen 1–6 und 8 gelten (nicht 7).

**Techniken.** Alle 37. Amateur-Variante: `elbow`, `clinch-strike` (Ellbogen),
`clinch-knee` zum Kopf, `leglock` (Heel Hook) dürfen nicht als Waffe oder
Schwäche erscheinen — Regelverstoß oder Erkennungsfehler.

**Split.** Keine festen Nullen. Anker: Stand ≈ 50 %, Boden ≈ 36 %, Clinch ≈
13 %, Käfigzeit ≈ 21 % (Roy & Murphy 2026, 91 UFC-Kämpfe, ohne
Reliabilitätsangabe — Richtwerte).

**Varianten.** `profi | amateur` (Ellbogen/Knie/Heel Hook) — vom Vorlauf
vorbelegbar (Schienbeinschoner, Handschuhgröße). Empfehlung: **nicht jetzt**;
Fouls kommen in echten Amateurkämpfen kaum vor, „nur was vorkam" reicht.

**Auf Video.** Sicher: Phase (κ 0,98–1,00), oben/unten, Rücken, Zaunkontakt,
Takedown-Ergebnis über Sekunden, Aufstehen, Knockdown mit Bodenkontakt.
Unsicher: gelandet vs. geblockt, Jab vs. Cross, Takedown „gelandet" beim
Wall-Wrestling, Submission-Versuch vs. Kontrolle, G&P-Treffer, Reversal vs.
Scramble, Zuordnung bei Verdeckung. Nicht: Damage ohne Reaktion, Kraft,
Griffe unter dem Körper, Absicht, Foul-Details.

**Prüfsätze (Bewertung).** Takedown-Quote nur ab 5 Versuchen; „> 0,85 sig.
Bodenschläge/min" ist der stärkste Sieg-Indikator (James 2016) — Bodenzeit
allein sagt nichts; ein Takedown ohne Bodenphase ist ein Versuch.

### 7.2 Boxen

**Regelrahmen.** World Boxing (Nov 2024, IOC-anerkannt seit 02/2025) und
DBV-WKB (ab 01.11.2026, fast wörtlich World Boxing): Wertungstreffer = sauber
auf der Trefferfläche (Vorder-/Seitenpartie Kopf und Rumpf oberhalb der
Gürtellinie), mit Gewicht dahinter, mit der Knöchelpartie; Kriterien Anzahl
Treffer → technisch-taktische Überlegenheit (inkl. „Avoiding blows through
effective defence") → Aktivität; 3 × 3 min Elite; Kopfschutz U17/U19 und
Elite-Frauen (WB, DBV), IBA ohne. Profi (ABC): 4–12 × 3 min, 8/10 oz,
Kriterien Clean Punching → Effective Aggressiveness → Ring Generalship →
Defense; kein Standing Eight, keine Drei-Niederschlag-Regel. Clinch = Halten
bis „Break", absichtlich = Foul; „Holding and hitting" Foul.

**Begriffe.** Ring, Seile, Ecke (rote/blaue, neutrale), Eckpolster,
Ringmitte, „an den Seilen", „in die Seile gedrängt", „aus der Ecke
rausdrehen"; Distanzen lang / halb / nah (Infight); Auslage Links-/
Rechtsauslage, Führhand/Schlaghand; Gerade, Haken, Aufwärtshaken,
Körperhaken, Leberhaken; Deckung, Blocken, Parade, Pendeln, Abducken,
Abrollen, Meiden, Ausdrehen (Pivot); Clinch/Halten, Break, Konter,
Niederschlag, Anzählen, Wirkungstreffer. Rolle: „erfahrener Boxtrainer".
Kategorie-Label „Ring & Raum".

**Fragen gesperrt (7):** K + T — preferred-weapons_kick,
defensive-reactions_low-kicks, real-habits_after-td-attempt,
entry-patterns_takedown, preferred-weapons_takedown,
defensive-reactions_takedowns, drills_takedown-sequences. Zusatzfragen 4
(Clinch: hält er, arbeitet er innen, dreht er raus?) und 8 (nach Anzählen).
`entry-patterns_clinch` bleibt offen — Clinch ist Halten, aber ein Muster.

**Techniken (5 + Clinch-Phase):** jab, cross, hook, uppercut, overhand mit
Ziel je Ereignis (Körperhaken = hook + koerper). `elbow`, alle `kick`,
`clinch`, `takedown`, `ground`, `submission` gesperrt. `clinch-strike` gesperrt
(Schlagen im Halten ist Foul). Clinch-Zeit läuft über `controlTime.clinchSeconds`.
`defense.methods` (Arm / Rumpf / Beinarbeit) als Typ-Beobachtung.

**Split.** kicking, wrestling, ground = 0; boxing + clinch = 100. Anker: 20–25
Schläge/min Amateur (Davis 2015/2018), Trefferquote Sieger 33 % vs. 23 % (Dunn
2017). Optional später: Distanzprofil lang/halb/nah/clinch (wie Jabbr).

**Varianten.** Amateur/Profi ändert Rundenzahl und Handschuhe, keine
Techniklisten — kein Chip. Kopfschutz senkt die Erkennbarkeit von
Kopftreffern (Poon 2024: κ 0,27–0,54 mit, 0,52–0,55 ohne) → Konfidenz senken,
wenn der Vorlauf Kopfschutz sieht.

**Auf Video.** Sicher: Clinch ja/nein und Dauer, Auslage, Bewegungsrichtung,
Seile/Ecke (wenn im Bild), wer drängt, Niederschlag, Break. Unsicher:
getroffen vs. geblockt (Kernunsicherheit selbst für Profis, FACTS: Kopftreffer
F1 62–65 % mit vier Kameras), Jab vs. Cross bei Auslagenwechsel, Haken vs.
Overhand, Uppercut innen, Körpertreffer hinter der Deckung, Kombinationslänge
(systematisch untererfasst), Slip vs. Roll vs. Duck (→ nur „Rumpfabwehr").
Nicht: Kraft, Knöchel vs. Innenhand, Finten, Kommandos.

**Prüfsätze.** Drei verschiedene „landed"-Definitionen existieren (Regelwerk
sauber · CompuBox Operator-Urteil · DeepStrike „teilgeblockt zählt"); DeepFight
nimmt die Regelwerksnähe: gelungen = Kontakt auf der Trefferfläche UND
sichtbare Reaktion. Schlagzahl allein trennt nicht — Trefferquote,
Führhand-Geraden, Körperarbeit, Beinarbeit-Abwehr schon.

### 7.3 Kickboxen, K-1 und Muay Thai

**Regelrahmen.** WAKO (v.2 04.05.2022, Kapitel 2025 neu veröffentlicht):
3 × 2 min, jede legale Technik 1 Punkt, geblockte zählen nicht; Fußfeger
zählt nur, wenn der Gegner mit mehr als den Füßen den Boden berührt; Full
Contact/Low Kick ohne Knie und Clinch, K1 Style mit Knie, Clinch max. 5 s,
mit zwei Händen nur EIN Knie, kein Beinfang, keine Würfe. GLORY (16.03.2026
v2): 3 × 3 min, Clinch nur für ein Knie, dann sofort lösen; **Würfe, Beinfeger,
Fußfeger, Schieben jeder Art verboten**; Beinfang für einen Schlag mit einem
Schritt; Wertung Niederschlag → Schaden → saubere Treffer → Aggressivität.
IFMA Muaythai (v3.057, 11.05.2026): 3 × 3 min Elite, Kopf-, Schienbein- UND
Ellbogenschutz Pflicht, alle vier Waffen gleich („one score"), geblockte
zählen nicht, „Throwing the opponent without striking" zählt nicht;
Clinch ohne Zeitlimit; Fouls: Hüftwurf, Tackling, Bein einhaken, Bein halten
> 2 Schritte ohne Schlag. Stadion (Rajadamnern/Lumpinee, nur Sekundärquellen):
Gesamteindruck, Runde 3–4 entscheiden, Sweep/Umwerfen höchster Wert nach dem
Niederschlag, Körper-Roundkick und gerades Knie über Fäusten, Balance nach
der Technik entscheidend.

**Begriffe.** Ring, Seile, Ecke, Ringmitte; Lowkick/Tiefkick, Middlekick/
Körperkick, Highkick, Halbkreistritt, Teep/Stoßtritt, Kniestoß, Ellbogen
(horizontal, vertikal, diagonal, Spinning); checken/blocken („Bein
hochnehmen"), Bein fangen; Clinch/Nackenclinch, Plum (Double Collar Tie),
Single Collar Tie, Over-Under, Innenposition; Fegen/Fußfeger/Sweep, Dump/
Umwerfen; Distanzen Kick-, Box-, Ellbogen-/Kniedistanz, Clinch; Vollkontakt,
Low Kick, K-1-Regeln, Thairegeln. Rolle: „erfahrener Kickbox- und
Thaibox-Trainer". Kategorie-Label „Ring & Raum".

**Fragen gesperrt (5):** T — real-habits_after-td-attempt,
entry-patterns_takedown, preferred-weapons_takedown,
defensive-reactions_takedowns, drills_takedown-sequences. Zusatzfragen 4
(Clinch-Waffen) und 8 (nach Wackler).

**Techniken (16):** strike jab, cross, hook, uppercut, overhand,
spinning-strike, **elbow (nur Muay Thai)**; kick low-kick, body-kick,
high-kick, front-kick, knee, spinning-kick; clinch clinch-knee (K-1/GLORY:
eins je Clinch), **clinch-strike (nur Muay Thai, Ellbogen)**, **sweep-dump
(Muay Thai; WAKO nur Fußfeger; GLORY/ONE-Kickboxen nie)**. Gesperrt: alle
`takedown`, `ground`, `submission`. Erscheint ein Takedown, ist es ein
Erkennungsfehler oder Foul → `verworfen[]`. `defense.methods` ergänzt um
Tritte gecheckt / gefangen.

**Split.** wrestling, ground = 0; boxing + kicking + clinch = 100 (Kämpfe
stoppen bei Bodenkontakt: WAKO Kap. 9 Art. 5, GLORY 5.07.B.1, IFMA 31.2.13).
Zeit vom Sturz bis „Box" ist Pause. Anker: Arm 63 % / Bein 37 % (Slimani
2017, Low Kick); Clinch im K-1 wenige Prozent, im Muay Thai ohne Limit;
Belastung:Pause ≈ 1:1 Elite (Ouergui 2014).

**Varianten — der einzige Fall, der einen Chip braucht.** `kickboxen |
muay-thai`, zweiwertig, vom Vorlauf vorbelegt (Ellbogenschützer, Mongkon/
Pra Jiad, Wai Kru) und antippbar. Wirkt: Muay Thai öffnet `elbow`,
`clinch-strike`, `sweep-dump` und Serien von `clinch-knee`; Kickboxen sperrt
sie (Fouls). Ohne Chip mittelt das Profil einen Thaiboxer mit Ellbogen und
Clinch-Serien mit einem GLORY-Kickboxer, für den beides verboten ist. Die
sechs Gruppen bleiben — es ist ein Flag am Video, keine siebte Kampfart.

**Auf Video.** Sicher: Clinch-Phase (beide Hände am Nacken ≥ 1 s), Sturz und
wer steht, Break, Niederschlag, Trittebene, Ringposition, Output je Runde.
Unsicher: Kniezahl in Serien, Kick gefangen vs. geblockt, Low Kick gecheckt vs.
absorbiert (nur 3–5 fps und frontal), Sweep vs. Ausrutscher (Regel: nur Sturz
mit sichtbarem Fuß-/Wadenkontakt oder Zug/Drehung), Beinfang-Folge,
Jab/Cross vs. Haken. Nicht: Teep vs. Snap-Front-Kick, Ellbogen-Treffer vs.
Streifer, wer den Clinch „dominiert" ohne Knie oder Sturz, Trefferkraft
(inter-ICC 0,16–0,44 selbst für Experten).

**Prüfsätze.** Roundhouse dauert 1,0 s inkl. Rückzug (Gavagan & Sayers 2017)
— bei 1 fps liegt der Treffer meist zwischen zwei Bildern; Serienzahlen sind
Tendenzen. Sieger nutzen mehr Haken, Beinarbeit-Abwehr und Clinch (Ouergui
2013); Thais bleiben nach 94,7 % der Techniken in Balance, UK-Kämpfer 62 %
(Myers 2013) — Balance nach dem Tritt ist ein sichtbares Schwächemerkmal.

### 7.4 Ringen (Freistil und Griechisch-Römisch)

**Regelrahmen.** UWW International Wrestling Rules, Januar 2026 (seit
01.01.2026): 2 × 3 min; Matte Kreis 9 m, orange Passivitätszone 1 m,
Schutzzone 1,5 m; 1 Punkt Step-out (ganzer Fuß auf der Schutzzone, 2026 auch
auf den Knien), Reversal, Passivität (GR), Aktivitätszeit ohne Punkt (FS);
2 Punkte Takedown (Gegner zu Boden UND von hinten kontrolliert, 3 von 7
Kontaktpunkten Hände/Knie/Kopf/Ellbogen), Wurf in Bauch-/Seitenlage,
Gefahrenlage (Rücken < 90°), Durchdreher/Beinschraube je Umdrehung; 4/5 Punkte
Großamplitude; GR: alles unter der Gürtellinie und jede Beinarbeit verboten;
technische Überlegenheit 8 (GR) / 10 (FS); Schultersieg. Deutsche Fassung DRB
hinkt (Stand 01.01.2023); Begriffe aus dem DRB-Kampfrichter-Fragenkatalog 2025.

**Begriffe.** Matte, Mattenmitte, zentrale Kampffläche, Passivitätszone/
„Zone" (orange), Schutzzone/Mattenrand („hinaustreten"); Standkampf,
Bodenkampf/Bodenlage/Parterre, angeordnete Bodenlage, Obermann/Untermann,
Bank, Brücke, gefährliche Lage, Schultersieg; Fassung/Bindung („Fassung
suchen"), Griff (= Technik), Beinangriff (Einbein-, Zweibeinangriff,
Knöchelgriff), Takedown (eingedeutscht), Konter, Übertragen/Wende (Reversal),
Ausheber, Durchdreher, Beinschraube, Nackenhebel/Halbnelson, Überwurf,
Hüftschwung/Kopfhüftzug, Schulterwurf/Armwurf, Achselwurf, Armzug, Nackenzug
(Snap-down), Unterhaken/Übergriff, Abtauchen, Abspreizen/Sprawl. Rolle:
„erfahrener Ringertrainer". Kategorie-Label „Matte & Raum". „Runde 1" =
„erste Periode".

**Fragen gesperrt (7):** S + K — real-habits_after-hit, real-habits_after-miss,
preferred-weapons_punch, defensive-reactions_jabs,
defensive-reactions_parry-shell, preferred-weapons_kick,
defensive-reactions_low-kicks. Zusatzfragen 1, 2, 3, 7. Wortlaut-Begriffe:
„Bindung" für Clinch, „Angriff/Wurf" für Takedown, „Mattenrand" für Rand,
`weaknesses_gets-hit-by` = „womit wird er gepunktet".

**Techniken (13):** takedown single-leg, double-leg, body-lock, trip (nur FS),
throw-hip, throw-shoulder, throw-sacrifice (Überwurf/Suplex), throw,
go-behind; ground sweep (= Übertragen/Reversal), turn (Durchdreher,
Beinschraube nur FS, Halbnelson), hold-down (Schulterlage), escape
(Aufstehen). Gesperrt: alle `strike`, `kick`, `clinch`-Gruppe (Bindung ist
Phase, kein Ereignis), `pass`, `back-take` (im Ringen = go-behind),
`ground-strikes`, `submission`-Gruppe. Griechisch-Römisch zusätzlich:
single-leg, double-leg, trip, Beinschraube = Fouls, nicht zählbar.
`edge.stepOuts` und `defense.takedownMethod` als Beobachtungsfelder;
`damage` = Landungsgrad.

**Split.** boxing, kicking = 0; clinch = Bindung ohne laufenden Angriff;
wrestling = Angriffsaktion + Stand ohne Kontakt; ground = ab Knie/Hand am
Boden unter Kontrolle inkl. angeordneter Bodenlage. Anker: FS Stand 74–79 % /
Boden 21–26 % (Gutiérrez-Santiago 2023); GR 44–47 % der Punkte aus dem Boden
(Tropin 2026). FS mit ground > 40 % oder GR mit clinch < 20 % = verdächtig.

**Varianten.** `freistil | greco` — Empfehlung: **kein Chip**. Beinangriffe
kommen in echten GR-Kämpfen nicht vor (Foul), „nur was vorkam" trägt; ein
Chip brächte nur die Sperre von fünf IDs.

**Auf Video.** Sicher: Stand vs. Boden, oben/hinten, Bein- vs.
Oberkörperangriff, Takedown mit klarer Kontrolle (≥ 2 s), Bauchlage/Brücke,
Großamplitude, Unterbrechungen, angeordnete Bodenlage (unverwechselbare
Startpose), Durchdreher-Umdrehungen ab 3 fps. Unsicher: Single-Leg-Varianten,
Snap-down vs. Armzug vs. Duck-under, Beinschraube vs. Durchdreher, Reversal vs.
Scramble, Wurfgruppe ohne sichtbare Rotationsachse, Step-out bei schräger
Kamera, Gefahrenlage < 90° von hinten, Angriffsseite (Spiegelung). Nicht:
Kampfrichterwertung ohne Tafel, Ermahnungen, Aktivitätszeit, Handfighting-
Details, Griffdruck, Fouls (Beinkontakt GR). **Zählen, nicht werten**:
„gelungen" nur über Körperlage.

**Prüfsätze.** Single-Leg-Quote Sieger 73 % vs. Verlierer 25 % (Fujiyama
2019); Sieger holen 74–78 % ihrer Punkte im Stand; Punkte je Minute
(„Wrestling Quality") ist die Kernkennzahl der UWW-Analysen.

### 7.5 Sambo und Judo

**Regelrahmen.** IJF Sport and Organisation Rules, Version 24.07.2026 (Regeln
bis LA 2028 „in Stein gemeißelt"): 4 min + Golden Score; Ippon (Rücken, Kraft,
Geschwindigkeit, Kontrolle), Waza-ari (> 90° Schulterachse), **Yuko wieder
eingeführt**; Osaekomi Yuko 5 s / Waza-ari 10 s / Ippon 20 s; 3. Shido =
Hansoku-make; Nicht-Angriff nach 45 s ab Kumi-kata; **Beinfassen nur noch
Shido** (nicht mehr Hansoku-make); keine Beinhebel (Ashi-garami verboten);
Kampffläche 8×8 bis 10×10 m. FIAS Sport-Sambo 2026 (31.03.2026): 5 min,
Kampfkreis Ø 8 m, Wurfwertung Total/4/2/1 nach Landung (Rücken/Seite/Rest)
und ob der Werfende steht oder mitfällt; Haltegriff 10 s = 2, 20 s = 4 (max.
4 je Kampf); **Arm- UND Beinhebel erlaubt, Würgen verboten**; Beingreifen
erlaubt; 8 Punkte Vorsprung = Sieg. Kampf-Sambo: zusätzlich Schläge, Tritte,
Knockdown = 4 Punkte, Würger im Stand und am Boden — regeltechnisch näher an
MMA als an Judo.

**Begriffe.** Kampffläche + Sicherheitsfläche, Mattenrand („Raustreten",
„Flucht"); Sambo: Kampfkreis, Kurtka; Griffkampf = Kumi-kata, Zughand
(Hikite, Ärmel), Hebehand (Tsurite, Revers), Ai-yotsu/Kenka-yotsu (gleiche/
gegengleiche Auslage); Standkampf Tachi-waza, Bodenkampf Ne-waza; Kuzushi,
Tsukuri, Kake; Wurfrichtungen vorwärts/Eindrehen vs. rückwärts/Sichel/Fegen;
Konter = Kaeshi-waza, Kombination = Renraku-waza; Große Außensichel,
Innensichel, Innenschenkelwurf, Schulterwurf, Körpersturz, Hüftfeger,
Fußfegen, Kopfwurf, Schulterrad; Haltegriff (Kesa, Shiho), Kreuzhebel,
Armschlüssel, Würger (Hadaka-jime); Sambo: Haltegriff, Hebel (Achilles-,
Kniehebel), Fixierung, sauberer Wurf, Beingreifer. Rolle: „erfahrener
Judo- und Sambo-Trainer". Kategorie-Label „Matte & Raum". „Runde 1" =
„Kampfbeginn / erste Minute".

**Fragen gesperrt (7):** S + K (wie Ringen). Zusatzfragen 1, 2, 3, 5, 7.
Begriffe: „Griffkampf" für Clinch, „Wurf" für Takedown, „Mattenrand".

**Techniken (16):** takedown single-leg, double-leg (Beingreifer; Judo:
Shido-Zähler), body-lock (Bear Hug: Ura-nage, Ushiro-goshi), trip
(Ashi-waza), throw-hip, throw-shoulder, throw-sacrifice, throw; ground
hold-down, turn (Umdrehen aus Bauchlage/Turtle), sweep, escape, pass (selten,
für Sambo-Boden); submission choke (**Judo, nicht Sport-Sambo**), armlock
(Judo nur Ellbogen), leglock (**Sambo, nicht Judo**). Gesperrt: alle
`strike`, `kick`, `clinch`-Gruppe, `ground-strikes`, `back-take`, `go-behind`.
`grips.dominant/side` als Beobachtung; `damage` = Landungsgrad (1 Bauch/Knie/
Gesäß · 2 Seite · 3 Rücken/Rollen) ersetzt Ippon/Waza-ari/Yuko und 4/2/1 —
die Wertung ist nicht sichtbar, die Landung schon.

**Split.** boxing, kicking = 0; clinch = Griffkampf inkl. Griffsuche (Miarkas
Approach + Gripping, ≈ 77 % der Weltcup-Kampfzeit); wrestling = Wurfhandlung
von Kuzushi bis Landung inkl. Abwehr/Konter (Einzelwurf 1,0–1,4 s, typisch
5–15 %); ground = Ne-waza ab beide Knie am Boden oder einer liegt. Pausen
(Mate–Hajime) nicht verteilt.

**Varianten.** `judo | sport-sambo | kampf-sambo`. Judo vs. Sport-Sambo
unterscheiden sich in genau drei Technik-Flags (Beingreifen, Beinhebel,
Würgen) — „nur was vorkam" trägt das, **kein Chip**. **Kampf-Sambo: Empfehlung
→ Kampfart MMA** wählen (Schläge, Knockdown, Würger im Stand, Helm/
Handschuhe verschieben Split und Fragen Richtung MMA; die MMA-Liste hat mit
den vier Wurfgruppen und `hold-down` jetzt alles, was Kampf-Sambo braucht).
Alternative: dritte Variante in der Sambo-Gruppe mit geöffneten S-/K-Fragen —
mehr Optionen, kein Erkenntnisgewinn.

**Auf Video.** Sicher: Stand vs. Boden, Wurf gelungen (Gegner liegt),
Angreifer fällt mit oder bleibt stehen (Sambo-Kriterium), Fallrichtung und
Seite, Griffseite und Ärmel/Revers (Jackenstoff kontrastiert — bei 1 fps als
Zustand, nicht als Wechsel), Haltegriffposition, Abklopfen, Folgen in den
Boden, Mattenrandnähe (Kreis Ø 8 m sichtbar), Angriffszahl je Minute,
Beingreifer. Unsicher: Ippon/Waza-ari/Yuko bzw. 4/2/1 (Landungswinkel oft ein
Bild), Haltegriffdauer ± 1–2 s, Würger unter der Jacke, Hebel kurz vor dem
Abklopfen, Randgültigkeit, Scheinangriff vs. echt (Kuzushi-Wirkung),
Rückengriff vs. Kragen von hinten; Experten erreichen beim Griff-/
Angriffs-Coding nur κ ≈ 0,45 (Frontiers 2020). Nicht: Kraft/Geschwindigkeit
als Ippon-Kriterium, Würgewirkung, Shido-Stand ohne Tafel, Kumi-kata-Uhr.

**Prüfsätze.** Direkte Angriffe 82,6 %, Konter 17,4 %; vorwärts 57,5 %,
rückwärts 42,4 %; Konter fallen 5,8× häufiger nach hinten (Mayo 2019);
Angriff auf der Griffseite: Wertungschance × 1,65 (Courel 2014); Handblock
nur 14 % wirksam, Bauchdrehen 34 %, Konter 29 % (Boguszewski 2009);
Gewichtsklassen unterscheiden sich stark (Griffzeit 60 vs. 165 s) — die
Gewichtsklasse gehört als Kontext ins Profil.

### 7.6 BJJ und Grappling

**Regelrahmen.** IBJJF Rule Book v6.1 (Juni 2024): jede Position 3 s
stabilisiert; Takedown 2, Sweep 2 (nur aus der Guard), Knee on Belly 2, Pass 3,
Mount 4, Back Control 4 (Hooks nicht gekreuzt; Body-Triangle = Advantage);
Advantages; Strafleiter bis DQ; Stalling 20 s; Guard-Pull ohne Griff = schweres
Foul; Kampfzeiten 5–10 min nach Gurt, keine Runden; Matte 36–64 m² + Sicherheitszone,
Rand = Neustart in gleicher Position; Verbotsmatrix je Gurt (Heel Hook und
Reaping nur Adult Braun/Schwarz No-Gi seit 01.01.2021). ADCC: 10×10 m, erste
Hälfte nur Minuspunkte (Guard-Pull −1, Passivität −1), Pass 3, Mount 2, Back 3,
Takedown 2 / clean 4, Sweep 2 / clean 4 (Umkehr aus dem Pin zählt als Sweep),
alle Beinhebel erlaubt. Submission-only (EBI, WNO, CJI): ohne Punkte,
Kampfrichter- oder Overtime-Entscheid.

**Begriffe.** Deutsches JJIF/DJJV-Regelwerk behält die englischen Wörter:
Kampffläche + Sicherheitsfläche, Takedown, Sweep, Knee Ride, Guard Pass, Full
Mount, Back Mount, Back Control, Aufgabegriffe (Submissions), Vorteil
(Advantage), Passivität (stalling), obere/untere Position, Guard-Spieler;
Trainer: Würger/Blutwürger, Armbar, Beinhebel, Mount, Side Control, Knee on
Belly, Back, Turtle, „passen", Guard-Pull, Escape, Top/Bottom, Wrestle-up.
UI: „Matte / Mattenmitte / Mattenrand", „oben/unten", „Guard passen", „Rücken
nehmen", „Submission". Rolle: „erfahrener BJJ- und Grappling-Trainer".
Kategorie-Label „Matte & Raum". „Runde 1" = „erste Phase" (ADCC: ohne Punkte).

**Fragen gesperrt (11):** S + K + entry-patterns_center-or-cage,
cage-space_pushes-cage, cage-space_escapes-cage, drills_cage-situations (Rand
ist Neustart, kein Druckmittel). `cage-space_at-cage` bleibt („nutzt er den
Rand für Neustarts?"). Zusatzfragen 1, 2, 3, 5, 6.

**Techniken (16):** takedown single-leg, double-leg, body-lock, trip,
throw-hip, throw-shoulder, throw-sacrifice, throw, guard-pull; ground pass,
sweep, back-take, escape; submission choke, armlock, leglock. Gesperrt: alle
`strike`, `kick`, `clinch`-Gruppe, `ground-strikes`, `turn`, `hold-down`,
`go-behind`. `positions` in Sekunden (inkl. turtle, leg-entanglement) für den
späteren Untersplit; `pass` mit optionalem `setup` (pressure / knee-cut /
toreando / leg-drag / body-lock).

**Split.** boxing, kicking = 0; clinch = Griffkampf im Stand (IBJJF-Schwelle
„beide 3 s auf den Füßen"); wrestling = Takedown-/Guard-Pull-Aktion bis
Bodenkontakt; ground = Rest. Anker: Boden 79–87 % (Del Vecchio 2007 Gi,
Spanias 2022 No-Gi). Der 5er-Split trägt für BJJ nur den Vergleich zu MMA —
die Aussage liegt im späteren Untersplit (5.2).

**Varianten.** `gi | no-gi` — die Recherche empfiehlt einen Tag, weil die
Technikverteilung kippt (Gi-Worlds 2022: Guard-Pull:Takedown 201:28, 252
Sweeps, 75 % Rückenwürger; ADCC 2024: 62 Takedowns, 22 % Beinhebel; No-Gi
Worlds 2025: Heel Hook + Ankle Lock 34 von 118 Subs; Heel Hooks nur No-Gi/ADCC
legal). Empfehlung: **jetzt kein Chip** (Hicksches Gesetz; „nur was vorkam"
trägt Beinhebel vs. Revers-Würger), aber das Feld `variante` so anlegen, dass
`gi | no-gi` später additiv kommt. Der Vorlauf sieht den Gi ohnehin.

**Auf Video.** Sicher: Stand vs. Boden (F1 0,87 Einzelkamera), oben/unten,
grobe Pins (Side, Mount, Back, Turtle, Closed/Half/Open Guard, 50/50;
ViCoS-Datensatz: eine Handy-Ansicht 0,80), Takedown-Vollzug, Guard-Pull vs.
Shot, Sweep, Pass-Vollzug, Tap + Stopp, Neustart. Unsicher: Guard-Art bei
verdeckten Beinen (DLR/RDLR/X/K), Passing-Stil, Hooks vs. Body-Triangle, KOB
vs. Side, Submission-Versuch vs. Griff (Kimura-Kontrolle, Guillotine im
Scramble), Würger-Typ, Inside/Outside Heel Hook, 3-s-Stabilisierung bei 1 fps,
ein 2-s-Back-Take kann bei 1–5 fps fehlen. Nicht: Gi-Griffdetails, Intensität
(inter-ICC 0,08 selbst bei Menschen), verbale Aufgabe, Wertungen/Advantages,
Stalling-Zählung, Reaping-Legalität.

**Prüfsätze.** Pass korreliert 99,6 % mit dem Sieg, Sweep 64 %; 0,2 Passes
und 1,4 Sweeps je Match (BJJ Heroes, 1 089 Matches); Sub-Versuch → Finish nur
17,6 %, RNC 36,6 % (ADCC 2022); Heel-Hook-Sieger hatten vorher null
Positionskontrolle (Spanias 2022) — Bodenzeit oben ist nicht gleich
Überlegenheit.

---

## 8. Regelgrenzen — für die KI und für den Server

### 8.1 Gemini (Beobachtung): keine Kampfart, aber besseres Schema

Gemessen (Versuch 1, „Daten sauber"): Ohne Kampfart-Vorgabe erkannte Gemini
Video 1 dreimal als Kickboxen; die erfundenen Takedowns kamen aus dem
MMA-lastigen Beobachtungsschema und Claudes festem „MMA-Cheftrainer"-Prompt.
Eine Einschränkung im Beobachtungs-Prompt ist NICHT gemessen und riskant: Ist
die Kampfart falsch gewählt (Video 2 mit MMA-Handschuhen wurde 3/3 als MMA
gelesen), unterdrückt sie echte Aktionen; nach der Beobachtung lässt sich das
korrigieren, im Prompt nicht. Deshalb:

- Der Katalogtext im Beobachtungs-Prompt führt ALLE 37 IDs mit den
  Gruppen-Definitionen aus 4.3 (besonders: „Umklammerung im Stand ist eine
  Phase, kein Takedown"; „gelungen nur, wenn der Gegner danach WIRKLICH am
  Boden liegt"; „Fegen ohne Bodenkampf danach = sweep-dump"; „Ducken,
  Abtauchen, Sprawl, Beinblock sind Abwehr des Angegriffenen, nie eine
  Aktion — ein Tritt braucht das gestreckte Bein Richtung Ziel").
- Kein Satz „das Video ist Kickboxen". Nur der neutrale Hinweis, dass
  Aktionen außerhalb des Sichtbaren nie geschätzt werden.
- Ereignis-Schema aus Versuch 1 (Sichtbarkeit, Phasen mit Kontrolle, ein
  Akteur je Ereignis, Ziel, Ergebnis, Sicherheit) — Entscheidung dort.

### 8.2 Claude (Bewertung): Kampfart, Rolle, Begriffe, offene Fragen

Heute steht fest „Du bist ein erfahrener MMA-Cheftrainer" (lib/server/claude.ts).
Neu, je Steckbrief:

- **Rolle**: „Du bist ein erfahrener {rolle} und Kampfanalyst."
- **Kampfart-Absatz**: „Dieses Video ist {Kampfart}{, Variante}. Es gelten die
  Begriffe {Fläche/Rand/Phasen}. Techniken außerhalb der folgenden Liste sind
  in dieser Kampfart nicht erlaubt oder Erkennungsfehler — nenne sie nie als
  Waffe, Schwäche oder Muster: {gesperrte Gruppen}. Verworfene Aktionen aus
  Stufe 1: {verworfen[]}."
- **Fragenkatalog**: nur die offenen Fragen (gesperrte fehlen im Text).
  Wortlaut in der Fassung `label` (Gegner) oder `labelDu` (Athlet).
- **Zahlenregel**: „Unter 5 Versuchen keine Quote, unter 10 nur ‚3 von 5',
  ab 20 mit Bandbreite" (Wilson, G4) und die Plausibilitätsanker der Kampfart
  als Prüfsatz („Freistil mit über 40 % Bodenzeit ist ungewöhnlich — prüfe die
  Phasen").
- **Split**: nur Schlüssel ohne feste Null.

### 8.3 Server (commit + Rechnung): die harte Grenze

Das Muster ist `SIGNAL_JE_FRAGE`, nur je Kampfart (Abschnitt 2, Reihenfolge
der Filter). Konkret:

| Schritt | Ort | Regel |
|---|---|---|
| Techniken filtern | `POST /api/video-analysis/commit` | `actionStats` gegen `Steckbrief.techniken` (+ Variante); Rest → `verworfen[]` am Analyse-Dokument mit Zahl je ID |
| Split | commit | `splitNull` → 0, `cleanDnaSplit` normiert neu; Split aus Phasen (Daten sauber) statt Modellschätzung |
| Abwehrzähler | commit | `defense.takedowns*` = null, wo `takedown` gesperrt; `defense.strikes*` = null, wo `strike` gesperrt |
| Fragen | `collectPulls()` in `lib/profile-evidence.ts` | `frageGiltFuer(q, a.sport) && frageOffen(q, signale)` für Befunde, Bestätigungen, `gelegenheiten` |
| Signale | `beobachteteSignale()` | aus der gefilterten Beobachtung; neue Gruppen `clinch`, `submission` und Signale `ground-top`, `ground-bottom`, `submissions`, `rocked`, `attacked` |
| Profil je Kampfart | `lib/server/profile-recompute.ts` | unverändert — `fightProfile/{sport}` aus den Analysen dieser Kampfart, `main` per `stelleZusammen` |
| Bericht | `VideoAnalysisResult` (Etappe 3 Kurzinfo) | „Details anzeigen": verworfene Aktionen mit Grund („passt nicht zur Kampfart Boxen") |

Bestand: kein Backfill (Demo). Da das Profil bei jeder Änderung aus ALLEN
Analysen neu gerechnet wird, greift der Steckbrief beim nächsten Recompute
automatisch auch für alte Analysen.

### 8.4 Varianten — die Entscheidungsgrundlage in einer Tabelle

| Gruppe | Varianten | Unterschiede, die die Analyse betreffen | Trägt „nur was vorkam"? | Empfehlung |
|---|---|---|---|---|
| MMA | Profi / Amateur / Ring | Ellbogen, Knie zum Kopf, Heel Hook; Ring ohne Wand | ja (Fouls kommen nicht vor) | kein Chip; Ring → Zonenlabel aus dem Vorlauf |
| Boxen | Amateur / Profi | Runden, Handschuhe, Kopfschutz | ja | kein Chip; Kopfschutz senkt Konfidenz |
| Kickboxen | **Kickboxen / Muay Thai** | Ellbogen, Clinch-Serien, Fegen/Dump, Beinfang — Kern vs. Foul | **nein** — ein Thaiboxer und ein GLORY-Kämpfer würden gemittelt | **EIN Chip, zweiwertig, vom Vorlauf vorbelegt** |
| Ringen | Freistil / Greco | Beinangriffe, Beinschraube | ja | kein Chip |
| Sambo/Judo | Judo / Sport-Sambo / Kampf-Sambo | Beingreifen, Beinhebel, Würgen; Kampf-Sambo: Schläge | Judo/Sport-Sambo ja; Kampf-Sambo nein | kein Chip; **Kampf-Sambo → MMA** |
| BJJ | Gi / No-Gi | Beinhebel-Legalität, Revers-Würger, Guard-Typen | ja, aber Verteilung kippt | jetzt kein Chip; Feld so anlegen, dass Gi/No-Gi später additiv kommt |

Das Feld heißt `variante` (optional, am Analyse-Dokument neben `sport`),
Werte nur je Kampfart gültig; die Oberfläche zeigt den Chip nur, wo der
Steckbrief Varianten definiert — heute also nur bei Kickboxen.

---

## 9. Was der Entwurf für die Parallel-Fenster bedeutet

Abgestimmt am 17.09.2026 per Nachricht; beide Fenster haben ihren Stand gemeldet.

**Etappe 3 (Rechnung, Sätze, Kurzinfo, Umschalter, Einwilligung)** — fasst
`lib/profile-evidence.ts`, `lib/server/profile-recompute.ts`, commit/flag,
`lib/video-analysis.ts` (nur `wirkung`), Tests, `lib/server/satzschreiber.ts`,
UI an; NICHT `gegner-dna.ts`, `fight-stats.ts`, `gemini.ts`, `claude.ts`.

- Andockpunkt bestätigt: `collectPulls()` bekommt `frageGiltFuer(q, a.sport)`
  als zweite Bedingung neben `frageOffen` (Befunde, Bestätigungen,
  `gelegenheiten`).
- Frage-IDs bleiben stabil (`stelleZusammen` legt über die ID zusammen);
  die eine gestrichene ID (`entry-patterns_jab`) verschwindet nur aus
  `DNA_CATEGORIES`, alte Antworten darunter bleiben als Bestand liegen und
  fallen beim nächsten `pruneAnswers` weg — Demo.
- Kein fester Nenner 60: Profilstärke und `gelegenheiten` zählen über
  `DNA_CATEGORIES` — neue Fragen sind automatisch drin; gesperrte Fragen
  dürfen keine Gelegenheit zählen (sonst sinkt die Profilstärke eines Boxers
  für nie gestellte Takedown-Fragen).
- `beobachteteSignale()` braucht die neuen Gruppen und Signale (Abschnitt 6).
- Fünf Split-Schlüssel bleiben; Helix-Bänder unverändert.
- `sideKey`-Folge der Wurf-Teilung (4.5) ist bekannt und akzeptiert (Demo).
- Zwei Label-Fassungen je Frage (3.1) passen zur Du-Form der Etappe-3-Sätze;
  `satzschreiber.ts` sollte die Kampfart-Begriffe (Käfig/Seile/Matte) aus dem
  Steckbrief bekommen, damit „am Cage" nie in einem Boxer-Satz steht.
- Die Wilson-Rechnung (G4) stützt `ZAHLEN_MINDESTVERSUCHE = 5`; eine
  zweite Stufe (Prozent erst ab 10) ist optional.

**„Daten sauber" (Stresstest-Fehler, Ereignisliste)** — fasst bei Freigabe
`lib/server/gemini.ts`, `app/api/video-analysis/analyze/route.ts`,
`lib/server/claude.ts` (Bewertungs-Prompt: Kampfart statt fest MMA) an;
`lib/video-analysis.ts` und `VideoUploadFlow` Schritt 4 nur nach Absprache.

- Präferenz übernommen: Filter NACH der Beobachtung, Kampfart an Claudes
  Bewertung, keine Einschränkung im Beobachtungs-Prompt (8.1).
- body-lock-Falle gelöst über die Gruppen: Umklammerung = Phase; `body-lock`
  nur mit Hebe-/Kipp-/Drehbewegung; `sweep-dump` in Kampfarten ohne
  Bodenkampf; `takedown.landed` nur mit Bodenphase danach (ihre Regel
  `takedownOhneBoden`).
- Die Technikliste (4.3) passt in ihr Ereignis-Schema: `aktion` = ID,
  `ergebnis` treffer/geblockt/verfehlt = gelungen/abgewehrt/versucht,
  `ziel` = Körper-/Trittebene, `phasen` = Split-Quelle; zusätzlich gebraucht:
  `positions`, `defense.methods`, `edge.stepOuts`, `grips`, `restarts` (4.4).
- Der Split sollte im Code aus den Phasen kommen (5.2) — Vorschlag an sie,
  keine Vorgabe.
- Neue Gruppen-Definitionen für den Katalogtext im Beobachtungs-Prompt (8.1),
  inklusive der Abwehrregel (4.1).
- Messstand von dort (17.09., Rohdaten `tmp/versuch-ereignisliste-2026-09-17`):
  Bildrate kostet 1 fps ≈ 91 · 5 fps ≈ 354 · 10 fps ≈ 685 Token je
  Videosekunde; 1 fps ist klar schlechter; 10 fps ist auf vier Ausschnitten
  (je 2×) NICHT besser als 5 fps, eher mehr Rauschen — aber das Sparring ist
  langsam, ein Test mit einem schnellen Video steht aus (Leon besorgt eins).
  Idee dort: 5 fps überall, 10 fps nur für dichte Abschnitte nachfragen.
  Zeiten mit `startOffset`/`endOffset` relativ zum Ausschnitt anfordern und
  im Code addieren klappt zuverlässig. Für die Sichtbarkeitsspalten in 4.3
  und 7 heißt das: „mittel" gilt bei 5 fps; bei 1 fps rutschen Tritt- und
  Schlagtypen auf „niedrig".

**Reihenfolge des Einbaus** (mein Vorschlag, mit beiden abzustimmen):
(1) `lib/kampfart-steckbrief.ts` + `gegner-dna.ts` + `fight-stats.ts` als
reine Daten (kein Verhalten) → (2) Etappe 3 hängt `frageGiltFuer` und die
Signale ein, sobald ihre Rechnung steht → (3) Daten sauber setzt Filter in
commit und Kampfart in claude.ts, wenn Leon das Ereignis-Schema freigibt →
(4) Begriffe in der Oberfläche.

---

## 10. Aufwand für den Einbau (grob)

| Datei | Änderung | Umfang |
|---|---|---|
| **NEU `lib/kampfart-steckbrief.ts`** | Sechs Steckbriefe als Daten (Begriffe, gesperrt, techniken, splitNull, zonen, varianten, anker, rolle); `frageGiltFuer`, `technikErlaubt`, `begriffe(sport)`, `zonenLabel(sport)` | 1 Datei, ~250 Zeilen |
| `lib/gegner-dna.ts` | 18 Wortlaute, `labelDu` je Frage, 8 neue Fragen, `entry-patterns_jab` raus, Kategorie-Label „Raum & Rand" | ~120 Zeilen Text |
| `lib/fight-stats.ts` | Gruppen `clinch`, `submission` in `ActionGroup`/`ACTION_GROUP_META`, 17 neue IDs, 2 Labels, `statsByGroup` um zwei Gruppen | ~60 Zeilen |
| `lib/profile-evidence.ts` (Etappe 3) | `SIGNAL_JE_FRAGE` +8/−1/2 geändert, `Signal` +5, `beobachteteSignale` neue Gruppen, `collectPulls` zweite Bedingung, `gelegenheiten` nur offene Fragen | ~40 Zeilen |
| `lib/video-analysis.ts` | optionales Feld `variante` am Analyse-Dokument + Decoder; `verworfen[]` | ~20 Zeilen |
| `app/api/video-analysis/commit/route.ts` | Technik-/Split-/Abwehr-Filter, `verworfen[]` | ~40 Zeilen |
| `lib/server/claude.ts` (Daten sauber) | Rolle, Kampfart-Absatz, gefilterter Katalog, Zahlenregel, Anker | ~40 Zeilen |
| `lib/server/gemini.ts` (Daten sauber) | Katalogtext mit Gruppen-Definitionen; Vorlauf: `variante`-Vorschlag (Ellbogenschützer) | ~20 Zeilen |
| UI: `DnaCategoryGrid`, `FightProfileView`, `FightStatsBlock`, `FightInsights`, `OpponentProfileView`, `VideoAnalysisResult`, `VideoUploadFlow` | Kategorie-Label und Zonen-Label je Kampfart (heute 39 „Cage/Käfig"-Stellen in 14 Dateien, davon 10 in `FightInsights.tsx`), Gruppen-Anzeige `clinch`/`submission`, Varianten-Chip nur bei Kickboxen, „verworfen" in Details | ~150 Zeilen |
| Demo/Seeds: `lib/demo-fight-profile.ts`, `lib/demo-seed.ts`, `scripts/seed-demo-analysen.mjs` | `entry-patterns_jab` ersetzen | klein |
| Tests: `scripts/test-profil-rechnung.mjs` (+ Steckbrief-Fälle: Boxen sperrt Takedown-Frage; Kickboxen verwirft Takedown; Signale aus gefilterter Beobachtung; Gelegenheiten) | ~8 neue Prüfungen | ~80 Zeilen |
| Doku: `docs/gegner-dna-video-analyse-fragenkatalog.md`, `CLAUDE.md` | Verweis auf Steckbriefe, „+ neu"-Abgleich (3.4) | klein |

Schätzung: **ein Fenster** für Daten + Rechnung + Prompts + Tests (Schritte
1–3), **ein zweites** für Begriffe/Chip/Details in der Oberfläche mit
Screenshot-Messung in beiden Themes. Kein Rules-Deploy nötig (kein neues
Feld mit eigener Regel; `variante` und `verworfen` liegen im Analyse-Dokument,
das der Server schreibt).

---

## 11. Quellen je Kernaussage

**MMA.** ABC Unified Rules rev. 07/2024: https://www.abcboxing.com/wp-content/uploads/2024/07/unified-mma-rules-rev-july-2024.pdf · ABC Judging Criteria 2016/17: https://www.abcboxing.com/wp-content/uploads/2017/10/2017-Official-MMA-Judging-Criteria.pdf · ABC Scoring Clarification 07/2025: https://www.abcboxing.com/wp-content/uploads/2025/08/ABC-MMA-Scoring-Criteira-Clarification-7.2025.pdf · IMMAF Rules 10/2022: https://immaf.org/wp-content/uploads/2022/10/IMMAF-Rules-Document-as-of-Oct-2022.pdf · GEMMAF Ü18 Amateur 2025: https://gemmaf.de/download/51497/ · UFC-Stats-Definitionen (Sekundär, FightMetric-Glossar nicht mehr öffentlich): https://agentmma.com/mma-lab/ufc-significant-strikes-explained · James et al. 2016 JSAMS: https://vuir.vu.edu.au/31281/1/James%20et%20al%20(2016).pdf · Miarka 2016 JSCR: https://pubmed.ncbi.nlm.nih.gov/26670995/ · Miarka 2020 Frontiers (κ): https://pmc.ncbi.nlm.nih.gov/articles/PMC7879976/ · Kirk 2015: https://ideas.repec.org/a/taf/rpanxx/v15y2015i1p359-370.html · LJMU-Review (Kirk 2018): https://researchonline.ljmu.ac.uk/id/eprint/13541/ · Roy & Murphy 2026: https://www.cambridgepublish.com/css/article/download/243/250/797 · MMA-Protokoll ICC: https://pmc.ncbi.nlm.nih.gov/articles/PMC9473287/

**Boxen.** World Boxing Competition Rules 11/2024: https://worldboxing.org/wp-content/uploads/2025/09/World-Boxing-Competition-Rules-Nov-2024-Approved-4.pdf · IBA Rules 15.04.2026: https://www.iba.sport/wp-content/uploads/2026/06/20260415-IBA-Technical-Competition-Rules.pdf · DBV WKB ab 01.11.2026: https://www.boxverband.de/wp-content/uploads/2026/09/DBV-WKB-Wettkampfbestimmungen.pdf · DBV 2025: https://www.boxverband.de/wp-content/uploads/2024/12/Wettkampfbestimmungen-des-DBV-2025-01.pdf · ABC Unified Rules of Boxing: https://www.abcboxing.com/unified-rules-boxing/ · BDB: https://www.bund-deutscher-berufsboxer.de/sportliche-regeln/ · CompuBox: https://en.wikipedia.org/wiki/CompuBox und https://www.boxinginsider.com/columns/the-troubles-with-compubox/ · Jabbr-Judging-Paper (1 003 Profikämpfe): https://cdn.prod.website-files.com/68d6be744d7efccc2207f571/699f0f4c7359f338bf538829_Interpretable%20Prediction%20and%20Large-Scale%20Analysis%20of%20Judging%20in%20Professional%20Boxing.pdf · El-Ashker 2011: https://www.tandfonline.com/doi/abs/10.1080/24748668.2011.11868555 · Thomson & Lamb 2016: https://www.tandfonline.com/doi/abs/10.1080/24748668.2016.11868881 · Davis 2015: https://pubmed.ncbi.nlm.nih.gov/24912199/ · Davis 2018: https://pubmed.ncbi.nlm.nih.gov/30480653/ · Dunn/Thomson & Lamb 2017 PLOS ONE: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0188675 · Martusciello 2025: https://pmc.ncbi.nlm.nih.gov/articles/PMC12452553/ · Poon 2024 (Kopfschutz, Einzelkamera): https://ro.ecu.edu.au/theses/2860/ · FACTS (Kopftreffer F1): https://arxiv.org/html/2412.16454v1

**Kickboxen / Muay Thai.** WAKO Kap. 7/8/9/10: https://wakousa.org/wp-content/uploads/2025/05/Ring-General-Rules.pdf · https://wakousa.org/wp-content/uploads/2025/05/K1-Rules.pdf · GLORY Rules 16.03.2026 v2: https://glory.pinkyellow.network/assets/rules/glory-rules-2026-v2.pdf · IFMA v3.057 (11.05.2026): https://muaythai.sport/wp-content/uploads/2026/05/IFMA-Rules-and-Regulations-v3.057_110526.pdf · ISKA 2025: https://www.iskaworldhq.com/wp-content/uploads/2025/02/AMA-Ringsports-Rules-and-AMA-Mat-Sport-Rules_V02.pdf · Rajadamnern Scoring 2026: https://rajadamnern.com/blog/muay-thai-rules-and-scoring-system/ · Stadion-Wertung (Myers): https://8limbsus.com/blog/scoring-muay-thai-fights · Ouergui 2014 JSCR: https://paulogentil.com/pdf/Time-Motion%20Analysis%20of%20Elite%20Male%20Kickboxing%20Competition.pdf · Ouergui 2013: https://www.tandfonline.com/doi/abs/10.1080/24748668.2013.11868649 · Slimani 2017: https://pubmed.ncbi.nlm.nih.gov/27197115/ · Rohner 2024 (ICC): https://universaar.uni-saarland.de/bitstream/20.500.11880/39084/1/1-s2.0-S076515972400131X-main.pdf · Myers 2013: https://www.scirp.org/pdf/APE_2013111910352073.pdf und https://www.redalyc.org/pdf/3010/301030568001.pdf · Bhumipol 2023: https://rua.ua.es/entities/publication/e6819afa-bbe8-407c-84c6-cc5db10d66f4 · Roundhouse-Dauer Gavagan & Sayers 2017: https://pmc.ncbi.nlm.nih.gov/articles/PMC5571909/

**Ringen.** UWW Rules 01/2026: https://cdn.uww.org/2026-01/wrestling_rules.pdf · DRB 2023: https://www.ringen.de/wp-content/uploads/2023/11/Internationales-Regelwerk_Januar-2023.pdf · DRB-Kampfrichter-Fragenkatalog 2025: https://ringen-kampfrichter.info/wp-content/uploads/2025/03/drb-kampfrichter-fragenkatalog-2025-teil-a-stand-11.01.25.pdf · UWW-Analysen Tünnemann/Curby: http://inwr-wrestling.com/wp-content/uploads/2018/03/Scoring-Analysis-of-the-Wrestling-from-the-2016-Rio-Olympic-Games.pdf und https://academy.uww.org/app/uploads/2019/06/Scoring-Analysis-of-the-2015-World-Wrestling-Championships-2.pdf · Tropin 2026: https://www.hrpub.org/download/20260430/SAJ10-19943219.pdf · Korobeynikov 2025: https://www.hsr-journal.com/index.php/journal/article/view/1230 · Fujiyama 2019: https://academy.uww.org/app/uploads/2019/10/TECHNICAL-ACTICAL-ANALYSIS-OF-MEN%E2%80%99S-WRESTLING-A-CASE-STUDY-OF-THE-72ND-NATIONAL-ATHLETIC-MEET-OF-2017-IN-JAPAN.pdf · Gutiérrez-Santiago 2023 PLOS ONE (κ): https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0282952 · Atici 2025: https://www.mdpi.com/2076-3417/15/14/7673 · Ringer-CV-Datensatz 2026: https://www.nature.com/articles/s41598-026-44782-0

**Sambo / Judo.** IJF SOR 24.07.2026: https://78884ca60822a34fb0e6-082b8fd5551e97bc65e327988b444396.ssl.cf3.rackcdn.com/up/2026/07/IJF_Sport_and_Organisation_Rul-1784897879.pdf · IJF „Rules confirmed" 06.01.2026: https://www.ijf.org/news/show/rules-confirmed-ahead-of-a-new-season · JA-Regeländerungen 02/2026: https://www.ausjudo.com.au/wp-content/uploads/2026/02/2026-JA-Refereeing-IJF-Rules-Changes-Explanation-Feb-26-V1.0.pdf · DJB-Kampfregeln 2025: https://www.judobund.de/fileadmin/user_upload/judobund.de/Downloads/Regeln_und_Ordnungen/2025_DJB-Kampfregeln.pdf · FIAS Sport-Sambo 2026: https://sambo.sport/upload/iblock/308/mde30cgd2q2eindhxj5t5ha3kdmzvsut.pdf · FIAS Kampf-Sambo 2026: https://sambo.sport/upload/iblock/35f/wouhrperur7c43lyh1wz4z2uc4drw6tr.pdf · Miarka Phasen (κ): https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01389/full · Barreto/Miarka 2019 (Griffzeit): https://www.efsupit.ro/images/stories/februarie2019/Art61.pdf · Mayo 2019 (Richtungen): https://www.mdpi.com/2075-4663/7/2/42 · Courel 2014 (Griffseite): https://ideas.repec.org/a/taf/rpanxx/v14y2014i1p138-147.html · Sterkowicz 2013 (London 2012): https://arxiv.org/pdf/1308.0716 · Boguszewski 2009 (Abwehr): https://www.balticsportscience.com/journal/vol1/iss2/3/ · Judo-Einzelkamera (F1): https://arxiv.org/abs/2412.07155 · Wurfklassifikation Zufallsniveau: https://github.com/thorwhalen/kodokan

**BJJ.** IBJJF Rule Book v6.1 (06/2024): https://www.ufaf.org/tournament/2024JUN_IBJJF_Rules_EN.pdf (Liste: https://ibjjf.com/books-videos) · IBJJF No-Gi-Update 2021: https://ibjjf.com/news/new-rules-updates · ADCC Rules: https://adcombat.com/adcc-rules-regulations/ · JJIF/DJJV-Regelwerk (deutsch): https://njjv.de/wp-content/uploads/2025/01/JJIF_and_DJJV_Jiu_Jitsu_Regelwerk.pdf · BJJ Heroes Worlds 2022: https://www.bjjheroes.com/editorial/crunching-numbers-4-0-ibjjf-world-championships-2022-stats · Guard Passing by the Numbers: https://www.bjjheroes.com/editorial/modern-day-guard-passing-by-the-numbers · ADCC 2024: https://www.bjjheroes.com/editorial/adcc-2024-after-math-data-compilation-and-analysis · No-Gi Worlds 2025: https://digitsu.com/events/2025-ibjjf-world-no-gi-championship · Spanias/Kirk/Øvretveit 2022: https://shura.shu.ac.uk/31193/1/Spanias%20et%20al%202022%20BJJ%20Time%20Motion%20Analysis.pdf · Lamas 2024 (κ 0,92–0,97): https://labesporte.org/wp-content/uploads/2023/11/2-No-gi-Brazilian-jiu-jitsu.pdf · Santos/Miarka 2023: https://pmc.ncbi.nlm.nih.gov/articles/PMC9969123/ · Andreato 2015: https://pubmed.ncbi.nlm.nih.gov/25559902/ · Coswig 2018: https://peerj.com/articles/4851/ · ViCoS-BJJ-Datensatz: https://www.vicos.si/resources/jiujitsu/

**Querschnitt.** Hughes/Evans/Wells 2001 (Normprofile): https://www.researchgate.net/publication/233662597_Establishing_normative_profiles_in_performance_analysis · O'Donoghue 2005: https://www.tandfonline.com/doi/abs/10.1080/24748668.2005.11868319 · Koo & Li 2016 (ICC-Bänder): https://pmc.ncbi.nlm.nih.gov/articles/PMC4913118/ · Wilson-Intervall: https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval · JUTACTIC (Judo, Fleiss-κ): https://pmc.ncbi.nlm.nih.gov/articles/PMC11104618/ · Punch-Tracker (Haken 0,50): https://pmc.ncbi.nlm.nih.gov/articles/PMC8123076/ · Punch-Detection 50 fps F1 0,49: https://www.mdpi.com/1099-4300/26/8/617 · BoxingVI: https://arxiv.org/html/2511.16524 · Harmony4D (Verdeckung): https://arxiv.org/abs/2410.20294 · PhysPose (Mehrkamera): https://arxiv.org/html/2504.08175 · MotionBench: https://arxiv.org/html/2501.02955 · TemporalBench: https://arxiv.org/html/2410.10818 · TOMATO: https://arxiv.org/abs/2410.23266 · VideoZeroBench 2026 (Zählen 12 %): https://arxiv.org/html/2604.01569v1 · CountLLM: https://arxiv.org/html/2503.17690v2 · EventHallusion: https://arxiv.org/html/2409.16597 · VidHalluc: https://pmc.ncbi.nlm.nih.gov/articles/PMC12408113/ · Gemini Video (1 fps Standard): https://ai.google.dev/gemini-api/docs/video-understanding

Die extrahierten Regeltexte liegen im Scratchpad dieses Fensters
(`uww_rules_2026.txt`, `ijf_sor_2026_07.txt`, `fias_sport_sambo.txt`,
`abc-2024.txt`, `immaf-2022.txt`, `worldboxing.txt`, `dbv2026.txt` u. a.) —
temporär; die Links oben sind die dauerhafte Referenz.

---

## 12. Was unsicher bleibt

1. **Keine einzige Reliabilitätsmessung für Handy-Hochformat, Schwenks oder
   1–5 Bilder/s.** Alle Studien nutzen Broadcast- oder Ringkameras bei 25–50 fps,
   oft Zeitlupe. Die Sichtbarkeitsspalten sind Ableitungen aus Physik und
   Verdeckungsstudien, keine Messung. Die Schwellen „≥ 3 Bilder", „≥ 2 s",
   „≥ 5 s Haltegriff" sind Produktentscheidungen.
2. **FightMetric/UFC Stats** haben kein öffentliches Zählhandbuch mehr; die
   Takedown-Definition stammt aus Sekundärquellen, eine Sekundenschwelle ist
   nirgends belegt. CompuBox nennt keine Fehlerquote; Jabbr-Zahlen sind
   Herstellerangaben (98–99 %) gegen ~95 % im unabhängigen Paper.
3. **Regelfassungen in Bewegung:** UWW 2026 ohne deutsche Fassung (DRB 2023);
   DBV-WKB gilt erst ab 01.11.2026 und widerspricht 2025 beim foul-bedingten
   Anzählen; World Boxing hat den Kopfschutz-Artikel an Kommissionen
   zurückverwiesen; IBJJF nennt „v6.0", das PDF „6.1", angebliche
   2026-Änderungen sind unbestätigt; ADCC-Seite undatiert; IJF-Kumi-kata-Frist
   30 s (2025) vs. 45 s (SOR 07/2026) — hier gilt der Primärtext 2026.
4. **Sekundärquellen widersprechen Primärtexten:** Sportaran zur Schere im
   Freistil; Blogs zu IBJJF-Gurtregeln („Kneebar ab Lila", „3 Strafen = DQ")
   und ADCC (Mount 2 vs. 4); Stadion-Muay-Thai existiert nicht als Regelbuch,
   die Hierarchie Kick > Faust steht gegen den Rajadamnern-Blog (alle gleich)
   und RWS/ONE (Schaden). Was legal „Sweep" ist, weicht zwischen 2002er
   Foul-Liste und Trainerdarstellungen ab. K-1-Originalregeln waren nicht
   abrufbar.
5. **Studien widersprechen sich:** MMA Volumen (Miarka 2016) vs. Genauigkeit
   (James 2016) vs. nur Takedowns (Kirk 2015); Indikatoren wirken je
   Gewichtsklasse anders (Kirk 2018). BJJ-Heroes zählt nur gewertete
   Ereignisse; „45 % RNC 2023" stammt aus einem Blog. Für Sambo gibt es keine
   öffentliche Statistik und kein validiertes Phasenmodell.
6. **Griff- und Angriffs-Coding** erreicht selbst bei Judo-Experten nur
   κ ≈ 0,45; „signifikant/Wirkung" inter-ICC 0,16–0,44; Intensität am Boden
   ICC 0,08. Alles, was daran hängt, ist im Profil Tendenz, nie Zahl.
7. **Kein Video-LLM-Benchmark für Kampfsport** — die Zählwerte (12 %) stammen
   aus Alltags- und Fitnessvideos, wo Ereignisse langsamer und unverdeckt
   sind; Kampfsport liegt vermutlich darunter.
8. **Kampf-Sambo → MMA** und **Gi/No-Gi ohne Chip** sind Empfehlungen mit
   Gegenargumenten (Abschnitt 8.4); beides ist rein additiv umkehrbar.

---

## 13. Offene Entscheidungen für Leon (mit Empfehlung)

1. **Eine Frage streichen?** `entry-patterns_jab` („Womit leitet er ein – Jab,
   Feints, Kicks, Level-Change?") ist ein Duplikat von `entry-patterns_start`.
   Empfehlung: **streichen**, Wortlaut von `start` erweitert (3.3).
2. **Acht Zusatzfragen** (3.5): Boden oben, Boden unten, Griff/Bindung,
   Clinch-Waffen, Aufgabegriffe, Guard, Wurfrichtung, nach Wackler.
   Empfehlung: **alle acht**; `after-restart` zurückstellen.
3. **Zwei Fassungen je Frage** — Gegner-Form („er") und Athleten-Form („du"),
   passend zu den Du-Sätzen aus Etappe 3 (3.1). Empfehlung: **ja**.
4. **Technikliste 20 → 37 mit zwei neuen Gruppen** (Clinch, Aufgabegriffe),
   vier Wurfgruppen statt „Wurf (Judo)", `throw`/`submission` als Rückfall
   (Abschnitt 4). Empfehlung: **ja**.
5. **Varianten-Chip nur bei Kickboxen** (Kickboxen / Muay Thai, vom Vorlauf
   vorbelegt); kein Chip für Ringen, Boxen, MMA, BJJ, Sambo/Judo (8.4).
   Empfehlung: **ja, genau ein Chip**; Gi/No-Gi später additiv.
6. **Kampf-Sambo-Videos → Kampfart MMA** statt Sambo-Profil (7.5).
   Empfehlung: **ja**.

Zonen (`cage` = Rand, Label je Kampfart) und Split (fünf Schlüssel, feste
Nullen je Kampfart, Rechnung aus Phasen) sind keine Entscheidungen, sondern
Folgen der Grundentscheidung — sie stehen hier nur zur Kenntnis (Abschnitt 5).
