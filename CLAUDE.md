# IronFight MMA — Projekt-Kontext

> Quelle der Wahrheit ist der Code. Diese Datei hält nur **stabile** Konventionen
> und Architektur-Entscheidungen fest — KEINE vollständige Datei-Liste (driftet
> sonst sofort). Für die aktuelle Struktur: `app/`, `lib/`, `components/` ansehen.

## Identität
- **App:** IronFight MMA / Tidal Athletics — MMA-Trainings- & Coaching-App
- **Firebase-Projekt:** ironfight-mma (ironfight-mma.firebaseapp.com)
- **Repo:** github.com/Kern-Digital/ironfight-mma
- **DeepFight** = UI-Markenname der Gegner-Scouting-/KI-Analyse (ehem.
  „Gegner-DNA", umbenannt 2026-08-19). In sichtbaren Texten IMMER „DeepFight";
  prominente Stellen nutzen `components/DeepFightWordmark.tsx` (Funkeln-Symbol
  `public/deepfight-icon.png` + Schriftzug, untrennbar). Code/Datenmodell
  behält bewusst die alten Namen (`lib/gegner-dna.ts`, `opponents/…`, Feld
  `dna` — Firestore-Migration unnötig).
- **DeepFight-Navigation & Rollen — NEUAUFBAU (Leon 05.09.2026, Teilschritt
  2 gebaut 07.09.):** EIN Menüpunkt „DeepFight" (nur Trainer/Admin) auf
  `/trainer/deepfight`, die **Werkbank**. Wen du analysierst, ist ein
  PARAMETER, kein Ort: Die Landung fragt „Wen analysierst du?" — **zwei
  Modi**, „Unsere Leute" (Athleten + Trainer + ich selbst, Merge-Ziel
  Kampfprofil) gegen „Gegner" (Bibliothek, Merge-Ziel `opponents/{id}`).
  Der Modus liegt als `data-modus` am Bereichs-Layout
  (`app/trainer/deepfight/layout.tsx`, Context in
  `components/deepfight/deepfight-modus.tsx`) und färbt den ganzen Bereich:
  bewegte Schicht `components/ui/Synthesis.tsx` (Tidal-Blau gegen Silber,
  folgt dem Branding-Kit BEWUSST NICHT, Tokens `--df-*`), im Gegner-Modus
  wird die Akzent-Familie NEUTRAL (eine Zeile in globals.css), alle
  `.t-card` im Bereich sind Glas (eine Bereichsregel). Drei Segmente IM
  Inhalt auf einer Glas-Leiste (`DeepFightLeiste`): Analysieren ·
  Gegner (`/trainer/deepfight/gegner`, ehem. `/trainer/opponents`) ·
  Athleten (`/trainer/deepfight/athleten`, ehem. `/trainer/deepfight/athletes`);
  alte Adressen laufen über `next.config.mjs` um. Die Ziel-Auswahl ist die
  EINE Stelle für die Rechte: Kollegen nur mit Freigabe `deepfight`
  (`darfSehen`), Ghost-Konten raus. „Meine Analysen" oben ist Leons Wahl
  (07.09.): die eigene Liste quer über Gegner und Athleten — heute per
  Fächer (eine Abfrage je Ziel, erst beim Öffnen), der collectionGroup-Weg
  steht im Backlog. `/trainer/deepfight/me` leitet auf die Landung mit
  eigener uid als Ziel. Regel für den Bereich: Text sitzt IMMER auf einer
  Karte, nie direkt auf der Schicht. Prüfseite: `/dev/deepfight-farbe`
  (misst die echten Regeln, Regler für `--df-deckkraft`).
  **TEILSCHRITT 3 (die zwei Bibliotheken) ist seit 07.09. gebaut:** Beide
  Seiten haben die Form der Werkbank — Leiste → TrainerHint →
  Werkzeugzeile auf Glas → Rost aus Glaskarten. **Sie tragen KEINEN
  `PageHead` mehr** (Leons Entscheidung 07.09.): Die Leiste sagt bereits,
  wo man steht, ein Titel darüber saß direkt auf der Schicht und wiederholte
  nur das aktive Segment; es bleibt eine `sr-only`-Überschrift. Wer eine
  weitere Seite unter die Segmente hängt, bringt ebenfalls keinen Kopf mit.
  Die Athletenliste filtert jetzt mit `darfSehen(…, "deepfight", …)` UND
  `isGhostAccount`; bleibt die Kollegen-Gruppe dadurch leer, sagt sie WARUM
  (eine verschwundene Gruppe hätte die Sackgasse nur unsichtbar gemacht).
  Jede Karte hat zwei Wege: aufs Profil (die ganze Karte, Muster
  `.t-row-card`/`.t-row-target`) und in die Werkbank (`?modus=…&ziel=…`).
  Dazu eine neue Token-Regel — `[data-area="deepfight"] { --text-3:
  var(--text-2) }`: Die dritte, gedämpfte Textstufe hält auf Glas über der
  bewegten Schicht kein AA (gemessen: dunkel 3,69:1, hell 2,66:1), und im
  hellen Theme gibt es unter `--text-2` keinen Platz mehr (L 0,50 → 3,50;
  erst L 0,44 = `--text-2` erreicht 5,14). Im Bereich gibt es deshalb ZWEI
  Textstufen statt drei. **Nachtrag 08.09. (Teilschritt 4): Auch die ZWEITE
  Stufe reißt im HELLEN Theme** — `--text-label` 4,15:1, `--text-2` 4,41:1 an
  den schwächsten Stellen. Eine Helligkeitsreihe über 19 Stellen: L 0,44
  (heute) 4,44 · L 0,42 4,80 · **L 0,40 5,27 — gewählt**, weil die Schicht
  schwankt und 4,80 keine Luft hätte. Als Bereichsregel
  `[data-theme="light"] [data-area="deepfight"]`; `--text-label` und
  `--text-muted` sind ausdrücklich mitgeschrieben (Falle 37: `color-mix`-
  Aliase werden am `:root` einmal ausgerechnet). Im Dunkeln kein Eingriff,
  dort hält alles ≥ 6,8:1. Dazu **zwei neue feste Tokens** für die
  Ecken-Auswahl im Analyse-Formular (Leon 08.09.: rot und blau sind
  Kampfsport-Konvention, keine Dekoration): `--corner-red`/`--corner-blue` auf
  L 0,50 plus `--on-corner` — theme-unabhängig wie `--accent2` und die
  `--cat-*`, gemessen 7,02:1 bzw. 6,37:1 für die Schrift darauf.
  **TEILSCHRITT 4 (die Ablage) ist seit 08.09. gebaut:**
  `VideoAnalysisSection` steht im Token-Look, **an der Pipeline hat sich
  nichts geändert** (Zwei-Phasen-Betrieb, die Wortmarken „überlastet"/„kein
  Ergebnis", `readTarget` frisch aus Firestore, `isConflict` gegen den
  frischen Stand, Schätzer, Speicher-Key, Direkt-Upload). Vier Dinge sind neu:
  (1) **Die Ablage steht sofort da** — der Zwischenklick auf „Neue Analyse"
  ist weg, sobald ein Ziel gewählt ist (Leons „ich habe dort direkt mein
  Upload-Fenster"); sie nimmt gezogene Dateien und Eingefügtes aus der
  Zwischenablage (Videodatei ODER YouTube-Link, der Link schaltet die Quelle
  selbst um) und bleibt ein normaler Knopf, weil es auf Touch kein Ziehen
  gibt. (2) **Angefangenes ist sichtbar** — eine Zeile oben nennt das
  wartende Video, was schon geschafft ist, die Restzeit und zwei Wege
  (fortsetzen / verwerfen); dafür kam EIN Feld in den gespeicherten Zustand
  (`pendingSavedAt`), die Pipeline-Objekte selbst blieben unangetastet.
  (3) **Der Guthaben-Ring ist weg** (Leon 08.09.: „der Ring und die Anzeige,
  was es verbraucht hat, soll für alle entfernt werden") — `AiBudgetGauge`
  ist gelöscht, damit auch der letzte native Dialog der App; was eine Analyse
  gekostet hat, sieht nur noch, wer Plattform-Admin ist. `recordAiUsage`
  schreibt weiter, siehe Backlog „KI-Kosten je Gym". (4) **Die Detailseiten
  tragen keine zweite Ablage mehr**: `gegner/[id]` hat den Tab „Videos"
  verloren, `athleten/[uid]` ihre eingebettete Sektion; beide führen mit
  einem Knopf in die Werkbank. Zwei Ablagen für dasselbe Ziel hatten je einen
  eigenen Zwischenstand-Speicher — wer hier hochlud und dort nachsah, fand
  nichts.
  **DIE LANDUNG IST SEIT 08.09. NEU GESTALTET — und das ist eine bewusste
  UMKEHR gegenüber Teilschritt 2** (Leons Entwurf am selben Abend): Die
  Werkbank („alles auf einer Seite, wen du analysierst ist ein Parameter")
  wurde mit der Ablage darunter zu voll. **Der Weg ist jetzt ein FLUSS über
  drei Seiten**, die Landung ist ruhig:

  ```
  /trainer/deepfight                        Landung
  /trainer/deepfight/athleten               Auswahl = Athletenliste
  /trainer/deepfight/gegner                 Auswahl = Gegner-Bibliothek
  /trainer/deepfight/analyse?modus=&ziel=   Konfiguration (NEU)
  ```

  Der Parameter-Gedanke stirbt nicht, er wird zur ADRESSE. **Kein neuer
  Redirect:** Die sechs Einstiege zeigen jetzt direkt auf `/analyse`, und die
  Landung reicht ein ankommendes `?modus=&ziel=` selbst weiter (Lesezeichen).
  `ta-deepfight-ziel` ist ersatzlos weg — eine ruhige Landung springt nicht in
  eine Konfiguration, die niemand angefordert hat.
  **DIE AUSWAHLSEITEN SIND DIE BIBLIOTHEKEN** (Leons eigene Frage: „macht das
  im Endeffekt das gleiche?"). Die Segmente fallen deshalb aus der Glas-Leiste;
  sie trägt nur noch Wortmarke (Weg zurück) und Ortsangabe. Kommt man über
  „Analyse starten" (`?fuer=analyse`), TAUSCHEN die zwei Wege je Karte — die
  ganze Karte führt in die Konfiguration, der kleine Knopf aufs Profil — und
  der Hinweis oben sagt etwas anderes. **Die Rechte-Prüfung ist mitgewandert**
  (`darfSehen(…,"deepfight",…)` + `isGhostAccount` auf den Auswahlseiten, dazu
  der „noch nicht freigegeben"-Fall auf `/analyse`, weil eine Adresse niemanden
  um Erlaubnis fragt).
  Auf der Landung: links der große DNA-Strang mit **echten Daten eines
  fiktiven Nutzers als CODE-KONSTANTE** (`lib/demo-fight-profile.ts`, 55 von 60
  Antworten = 92 %, alle neun Kategorien) — ein echtes Konto hätte aus jeder
  Liste gefiltert werden müssen und wäre in Phase 4 ein beitragspflichtiger
  Phantom-Athlet. **Stand nach Leons METALL-ENTWURF 12.09.2026** (kam als eigenständige
  Vorschau in `D:\Tidal-Athletics\GPT\deepfight-entry`, Auftrag: „nimm
  diese und passe sie an, was die zwei Felder rechts angeht — die Rundung der
  Ecken etc.; DNA-Feld, Start und Überschrift bleiben"): Kopfzeile =
  Wortmarke ohne Rahmen links, Suche als reine Lupe rechts (unverändert).
  Darunter `FightDnaHeading` — „Entschlüssle die Fight-DNA" in SILBER
  (Barlow Condensed 900 kursiv, Verlauf IN der Schrift, Lichtlauf und
  Glanzpunkt beim Laden, `5.6cqi` gegen `.df-kopfspalte`, auf dem
  Schreibtisch einzeilig). **Der Strang IST der Knopf** (`FightDnaEntry`,
  `components/deepfight/`): Helix `inert`, Klickziel als Geschwister
  darüber; unter dem Zeiger wächst der Strang (1,035) und sättigt sich, in
  seiner Mitte erscheint „Start" in Silber mit zwei türkisen Pfeilen (auf
  Touch immer, §3.3); ein Tipp verwandelt es am selben Ort in zwei Platten
  „Athleten" (Silber) / „Gegner" (Türkis, Radius 10 px, CSS-Keyframe statt
  MorphSwap), Escape oder ein Klick daneben nimmt sie zurück, der Fokus geht
  auf den Strang zurück. **Die Farben des Einstiegs sind FEST** (Material wie
  beim VS-Banner, Ausnahme von §1.1) und gelten in beiden Themes — im hellen
  Theme trägt die Schrift über ihre dunklen Schlagschatten. Die Höhe des
  Strangs ist Leons Maß aus der Vorschau je Fensterbreite (550 / 610 ab 1550
  / 530 unter 1150 / 510 unter 860 / 410 unter 680 px, `!important` gegen den
  Inline-Stil der Helix; `size="lg"` immer). Alles in globals.css unter „DER
  METALL-EINSTIEG DER DEEPFIGHT-LANDUNG".
  **Rechts ZWEI FELDER** (`components/deepfight/AnalysenFelder.tsx`), an die
  App angepasst: beide `.t-card` (im Bereich Glas, `--r-lg`), Zeilen
  `--r-md`, Farben aus den Tokens, Symbole aus der Registry, nur die Titel in
  der Display-Schrift des Einstiegs (Kursive braucht `padding-right`, sonst
  schneidet `background-clip: text` den letzten Buchstaben an — gesehen).
  **Leons zweite Runde (12.09., „lass die ganzen kleinen unnötigen Dinge
  weg"):** keine Pfeile an den Zeilen, keine Zähler in den Köpfen, kein
  „Bereit fürs Profil", keine Filter auf der Seite; das Symbol ist IMMER die
  Person — eigene Athleten in der Gym-Farbe (`--accent-text`), Gegner grau
  (`--text-2`), die Rolle trägt die Farbe, nicht die Form. „Analysen in
  Arbeit" = nur die Zwischenstände (Tipp = weitermachen), „Analyse-Archiv" =
  die letzten SIEBEN eigenen Analysen, als ACHTE Zeile immer „Alle anzeigen".
  Ein Tipp auf eine Archiv-Zeile öffnet das zentrierte Sheet mit ALLEN
  Analysen, diese vorgewählt (die Vorwahl kommt direkt aus dem Zustand —
  `useLetzterWert` hielte beim Öffnen über „Alle anzeigen" die alte
  Markierung fest, gemessen); die Filter Alle / Athleten / Gegner sitzen IM
  Sheet (`.df-filter`). Damit sind „Bereit fürs Profil", die Kartei „Meine
  Analysen" (`AnalysenKartei` gelöscht, `.df-kartei` raus) und „Mach weiter,
  wo du aufgehört hast" in den zwei Feldern aufgegangen; `.df-strang*` ist
  raus, `.df-start` bleibt (Wettkampf-Plus).
  **Dritte Runde (12.09., nach dem Screenshot):** das Archiv steht OHNE
  Rahmen (nur „In Arbeit" ist die Glas-Karte), die Trenner zwischen den
  Zeilen sind gerade Striche als `::before` (ein `border-top` folgte der
  Rundung und sah aus wie halbe Rahmen), und „Analysen in Arbeit"
  VERSCHWINDET ganz, wenn nichts offen ist — kein „Nichts wartet auf dich".
  Für Zwischenstände gibt es `scripts/tmp-df-blick.mjs` (EIN Screenshot,
  1440, `THEME=light` möglich); der Volllauf nur am Etappenende.
  **DER LICHTREFLEX HÄNGT AN EINEM ENTPRELLTEN ZÄHLER** (Leon: „der
  Lichtreflex fehlt sowohl bei der Überschrift als auch beim Start"): Die
  Vorschau startete ihn mit dem Style-Apply bzw. dem ersten `pointerenter`.
  In der App lief er messbar durch — nur BEVOR Schrift, Hydration und
  WebGL-Schicht standen, und Chrome feuert `pointerenter` auch für einen
  ruhenden Zeiger, sobald das Element auftaucht: der eine Lauf verpuffte beim
  Laden. Jetzt (`useGlanz` in FightDnaEntry.tsx): einmal nach
  `document.fonts.ready` + zwei Bildern (`data-shone`, auch auf Touch), dann
  bei jedem Zeiger-Eintritt neu, der `key` am Schriftzug hängt das
  Pseudo-Element neu ein. ENTPRELLT auf 1,8 s, Falle gemessen: ohne
  Entprellung feuerte das Neu-Einhängen unter dem ruhenden Zeiger 27 neue
  `pointerenter` je Überfahren, die Animation startete endlos neu und kam nie
  aus ihrer Verzögerung (Spitze 0,00).
  Gemessen mit `scripts/mess-df-metall.mjs` (dunkel/hell × 1440/390, Login
  per Prüfkonto mit neun markierten Mess-Analysen, `BASE=` wenn der
  Dev-Server nicht auf 3000 liegt; 116 Punkte grün): Reflex-Spitze 1,00 nach
  dem Malen und beim zweiten Überfahren (Überschrift und Start),
  Einzeiligkeit, kein Überlauf, Platten/Escape/Klick daneben, Navigation +
  `data-modus`, Glas-Radien, 7 + „Alle anzeigen", Sheet mit Vorwahl und
  Filter. Zwei Dev-Server-Fallen dabei: nach einer Neukompilierung liefert
  `/login` einmal 404 (das Skript versucht dreimal), und eine Datei-Änderung
  WÄHREND eines Laufs meldet 404-Ressourcen in genau dem offenen Kontext.
  Die älteren Skripte `mess-df-landung.mjs`, `mess-df-rahmenlos.mjs` und
  `mess-demo-analysen-ui.mjs` messen noch die ALTE Struktur (`.df-strang`,
  `.df-kartei`) und laufen so nicht mehr durch.
  **DIE SUCHE GEHT ÜBER ALLES — und lädt GENAU EINMAL je Sitzung**
  (`lib/deepfight-analysen.ts`, Leons Entscheidung 08.09.): Gegner und Athleten
  kosten nichts (Listen sind geladen, gefiltert wird lokal) und erscheinen
  sofort; die Analysen liegen verstreut und kommen per Fächer (~38 Abfragen),
  **einmal**, danach aus dem Speicher. Gemessen: **Tippen löst 0
  Firestore-Anfragen aus.** „Meine Analysen" teilt sich denselben Lauf — sonst
  wäre der Fächer je Landungsbesuch eine Verschlechterung gegenüber der alten
  Werkbank gewesen. Gecacht wird das PROMISE (gleichzeitige Aufrufer teilen
  sich den Lauf), Schlüssel ist `gymId:uid`, ein Fehlschlag räumt den Eintrag.
  Schuld bleibt: Es skaliert mit der Mitgliederzahl — Teilschritt 6 legt beide
  Stellen auf eine collectionGroup-Query zusammen.
  **Der Zwischenstand wird auf der Landung NUR GELESEN**
  (`lib/deepfight-zwischenstand.ts`): `VideoAnalysisSection` zu mounten hieße,
  ihre Abfragen zu starten. Das Feld bietet deshalb nur „Weitermachen";
  Verwerfen bleibt dort, wo der Stand zu Hause ist.
  **DREI STELLEN, DIE GEMESSEN WERDEN MUSSTEN** (Falle 45, vier bzw. sechs
  Zeitpunkte): Rahmenlos über der bewegten Schicht trägt nur `--text-1`.
  `--accent-text` fiel im HELLEN Theme auf **2,28:1** („Analyse starten") →
  `[data-area="deepfight"] .df-einstieg { color: var(--text-1) }`, und zwar
  VOR der Hover-Regel, weil beide auf Spezifität (0,2,0) kommen und bei
  Gleichstand der spätere gewinnt. Kleiner, gedämpfter Text trägt frei gar
  nicht (3,55:1 / 3,69:1) — „Meine Analysen" und das Weitermachen-Feld stehen
  deshalb auf Glas. Und `FightDnaHelix` malt auf einen DECKENDEN
  `--bg-0`-Kasten mit 22 px Radius: im Bereich per `!important` überstimmt
  (Inline-Stil schlägt jede Klasse), sonst löschte eine 620 px hohe Platte die
  Schicht genau dort aus, wo sie am meisten zu sehen sein soll.
  **„Start" MITTEN AUF DEM STRANG — die offene Kontrastfrage vom 11.09. ist
  mit dem Metall-Entwurf anders beantwortet:** Das Wort steht seit 12.09. in
  Silber mit dreifachem dunklem Schlagschatten (`drop-shadow` 2/5/8 px), nicht
  mehr als dünner Regenbogen. Die Kante trägt es über die Partikel der Helix
  in beiden Themes (Screenshots dunkel/hell, 1440/390 gesichtet); eine
  Zahl nach WCAG gibt es für Schrift mit Schlagschatten nicht, der Knopf heißt
  weiterhin „Analyse starten" und das Wort bleibt `aria-hidden`.
  **LEONS DRITTE RUNDE (12.09.2026) — vier Korrekturen am Einstieg:**
  (a) **Die zwei Platten sind jetzt BLAU („Athleten") und GRAU („Gegner")**
  statt Silber/Türkis. Türkis ist app-weit die Akzentfarbe und stand hier
  ausgerechnet für die fremde Seite; Silber trug in derselben Fläche schon
  Überschrift und „Start". Beide bleiben WERKSTOFF (feste Farben, Ausnahme
  von §1.1), dasselbe Relief, nur ein anderes Metall.
  **UND ZWAR DIE ZWEI METALLE, DIE DER BEREICH SCHON FÜHRT** (Leons
  Nachfrage: „warum ist das Blau des Athleten nicht im Tidal-Blau?"). Ein
  erster Anlauf erfand ein Stahlblau bei Farbton 250 — daneben stand die
  Entscheidung vom 06.09., die dieselbe Frage längst beantwortet:
  „Tidal-Blau für unsere Leute, Silber für den Gegner" (`--df-ton-leute`
  Farbton 197, `--df-ton-gegner` Farbton 235). Genau die stehen jetzt als
  `--df-blau` / `--df-grau` im Token-Kopf des Einstiegs — als FESTE Werte
  und nicht als `var()` auf die Tokens, weil die im hellen Theme ihre
  Helligkeit drehen (0.74 → 0.62, und `-tief` wird HELLER als der Grundton);
  eine Platte ist Werkstoff und sieht in beiden Themes gleich aus. Jede
  Platte kennt nur EINE Farbe (`--platte`), Verlauf, Kante, Fuß und Schrift
  leiten sich per `color-mix` daraus ab — die beiden können sich dadurch
  nicht auseinanderentwickeln, und ein Wechsel ist eine Zeile.
  (b) **Der Glanzpunkt gehört nach vorn:** Er lag mit `z-index: auto` in
  derselben Ebene wie der Lichtlauf `::after`, der ihn in der
  Baumreihenfolge überholt (`.df-metal` ist durch seinen `drop-shadow`
  ohnehin ein eigener Stapelkontext, dort entscheidet allein die
  Reihenfolge). Jetzt Lauf auf 1, Stern auf 2, dazu ein eigener Schein
  `--df-glint-schein` — sonst verschwindet die weiße Spitze im weißen
  Scheitel des Laufs.
  (c) **Die Überschrift glänzt genau EINMAL** (Leon: „wird jedes Mal
  ausgelöst, wenn ich mit der Maus drüberziehe"). Der Zeiger-Anstoß war ein
  Behelf aus der Zeit, als der Lauf beim Laden verpuffte; seit der Zähler auf
  `document.fonts.ready` plus zwei Bilder wartet, kommt der eine Lauf
  verlässlich. Eine Überschrift ist kein Bedienelement — am DNA-Feld bleibt
  der Anstoß, DORT ist er die Einladung.
  (d) **Das Metall wechselt mit dem Licht** (Leon: „finde für die helle
  Ansicht eine angepasste Version"). Im hellen Theme ist es GEBÜRSTETER
  STAHL statt poliertem Silber — dieselbe Verlaufsform, an der
  Helligkeitsachse gespiegelt, `--df-silver-dark` wird von der dunklen
  Fußkante zur hellen Lippe, der Türkis geht zwei Stufen tiefer, der Stern
  wird türkis. Alles über die Tokens in
  `[data-theme="light"] .df-entry-heading, .df-entry`; keine Regel darunter
  fasst eine Farbe direkt an. Die Trennlinie unter der Überschrift mischt
  jetzt aus der Metallkante, statt auf festem Hellgrau zu stehen (im hellen
  Theme war sie unsichtbar).
  **ETAPPE 3b IST NACHGEZOGEN (13.09.2026, Leons Befund: „wenn ich auf neuen
  Gegner anlegen gehe, kommt das Popup mit altem Fenster").** Der letzte große
  Rest des alten Looks im Bereich lag in zwei Dateien —
  `components/trainer/OpponentEditor.tsx` (377 Zeilen) und
  `GegnerDnaAccordion.tsx` (222) —, die fünf übrigen Blöcke sind seit 3a
  sauber. Aufgefallen ist es dort, wo diese zwei in einer fertigen Umgebung
  stehen: im Popup „Neuer Gegner" der Wettkampf-Anlage, zwischen Feldern, die
  seit Etappe 2b im Token-Look sind. Raus sind `--ink-2…5`, `--fg-1…4`,
  `--ta-pink`, `font-mono-ta`, `font-display-ta`, die festen Pixelgrößen und
  `rounded-2xl`; die Maße sind jetzt die der Formulare in „Neuer Wettkampf"
  (`min-h-hit rounded-field px-3` auf `--surface-raised`/`--line`,
  Beschriftungen als `.t-label`, Knöpfe wie am Fuß der Anlage).
  **`--fg-1` gab es dabei nie** — dieselbe Beobachtung wie in Etappe 3a; die
  Eingaben standen die ganze Zeit auf der geerbten Farbe.
  **UND DIE KATEGORIE TRÄGT KEINE FARBE MEHR.** `category.accent` — vier
  Farben, die sich über neun Kategorien im Kreis wiederholten und im Popup als
  violette Ränder auffielen — ist aus dem Akkordeon raus, genau wie in
  `DnaCategoryGrid` (3a): Die Farbe behauptete eine Ordnung, die es nicht
  gibt, und beantwortete nicht die eine Frage an diese Liste — WAS IST SCHON
  GESCOUTET? Jetzt trägt der ZUSTAND sie: leer = `--text-3`/`--line` und
  gedämpft, gescoutet = Akzent in Symbol, Zähler und Kante.
  (e) **Der türkise Balken unter der Überschrift ist weg** (Leon: „den
  blauen Balken dann entfernen"). Der 64-px-Anstrich links vor der
  Trennlinie kam aus der Vorschau mit, bedeutete nichts und war die einzige
  Stelle des Einstiegs mit einem FESTEN Türkis statt der Gym-Farbe. Die
  feine Linie selbst bleibt.
  Dazu: **das Klemmbrett-Zeichen an „Analyse-Archiv" ist weg** — es sagte
  nichts, was die Überschrift nicht schon sagt, und war rahmenlos das
  Einzige, was die Zeile noch nach Kasten aussehen ließ.
  **TEILSCHRITT 5 (der Ergebnis-Bericht) ist seit 14.09. gebaut — zugleich
  Redesign-Etappe 3c.** `VideoAnalysisResult` steht im Token-Look;
  **an der Merge-Logik keine Zeile** (`mergeDnaSplit`, `cleanActionStats`,
  `computeVideoWeight`, `isConflict` gegen den frisch gelesenen Stand,
  `markAnalysisApplied` liegen im Aufrufer und in lib/fight-stats.ts). Raus
  sind 65 Alt-Token, 22 × `font-mono-ta`/`font-display-ta`, zwölf rohe
  `rgba()` und `cat.accent`. Vier Dinge:
  (1) **Keine eigene `.t-card`**, aus demselben Grund wie in Teilschritt 4 —
  der Bericht sitzt in der Werkbank-Karte, und im Bereich ist jede `.t-card`
  Glas. Gemessen: `.t-card` mit `.t-card`-Vorfahr = 0.
  (2) **`--fg-4` wurde `--text-3`, nicht `--text-2`.** Im Bereich fällt die
  dritte Stufe ohnehin auf die zweite; auf `/kampfprofil` — dem ZWEITEN
  Aufrufer, ohne `data-area` — steht der Bericht dagegen auf einer DECKENDEN
  Karte, und dort ist die dritte Stufe genau richtig. Ein festes `--text-2`
  hätte die Abstufung dort eingeebnet.
  (3) **Der Konflikt ist kein Fehler, sondern eine Entscheidung.** `--ta-pink`
  stand für dreierlei und fällt deshalb NICHT pauschal auf `--negative`:
  unsichere Identifikation, Wackler und Konflikt laufen auf `--warning`. Statt
  der Miniaturzeile steht jetzt ein beschrifteter Vergleich „Bisher im Profil"
  gegen den Befund; die Fläche trägt den Ton, der Text `--text-body`
  (Falle 33), ein `warn`-Zeichen daneben. **Was die Anzeige nicht kann,
  behauptet sie nicht:** aus welchem Video die bisherige Antwort stammt, ist
  nirgends gespeichert (Backlog) — deshalb „Bisher im Profil", ohne Quelle.
  Die Regel selbst bleibt: nie still überschreiben, nur einzeln „Ersetzen".
  (4) **Der Weg hat ein sichtbares Ende** (UX-Punkt 6 „Das Ende ist die
  Übernahme, nicht das Ergebnis"): Am Fuß steht ein Block mit drei Gesichtern
  über EINEN `MorphSwap` — *fertig* nennt, was jetzt im Profil steht, und
  führt hin (`/trainer/deepfight/gegner/<id>` bzw. `…/athleten/<uid>`, gebaut
  aus `analysis.targetId`/`targetName`, kein neues Prop); *nur noch Konflikte*
  nennt beides, das Erledigte und die offenen Entscheidungen; sonst nichts —
  dann trägt der Knopf oben den Zustand. Der Block hängt an `canApply` und
  erscheint auf `/kampfprofil` gar nicht: Der Athlet übernimmt nichts und
  hätte für `/trainer/…` keinen Zugriff (gemessen: 0 solche Links im Bericht).
  Gemessen mit `scripts/mess-t5-bericht.mjs` (eigenes Prüfkonto **und eigenes
  Prüf-Gegnerprofil** — der Konflikt-Zustand braucht eine widersprechende
  DNA-Antwort, und Leons „Paul the Fighter" wird dafür nicht angefasst):
  dunkel + hell × beide Modi × 1440/390, drei Fuß-Zustände, Glas-in-Glas 0,
  Überlauf 0, `main` transparent, 22 Kontraststellen je Lauf, 0 Konsolenfehler,
  beide Aufrufer. Schwächster Kontrast 5,06:1.
  **DIE SIGNALFARBEN REISSEN IM HELLEN THEME — derselbe Befund wie 08.09.,
  eine Familie weiter.** Die Reihe von Teilschritt 4 rettete `--text-2`,
  `--text-muted` und `--text-label` und übersah die Signalfamilien. Gemessen
  am Bericht: `--warning` als Schrift 2,39–3,31 · `--positive` 3,59–3,83 ·
  `--accent-text` 3,31–4,44 (AA 4,5; dieselben Stellen dunkel 5,2–13,8). Neu
  im Block `[data-theme="light"] [data-area="deepfight"]`: `--warning`,
  `--positive`, **`--negative` (neu, daran hängen `.t-danger`/-`strong`)** und
  `--accent-text` auf **L 0,36**. Nicht 0,40 wie bei den Textstufen — das gab
  4,46 ohne Reserve, weil diese Schrift auf einer 10–18 % GETÖNTEN Fläche
  steht und die Tönung rund einen Punkt Kontrast frisst. Reihe: 0,60/0,55/0,46
  → 2,39 · 0,40 → 4,46 · **0,36 → 5,35 gewählt**. Dunkel unangetastet. Die
  Tönungen kippen dabei nicht: Die Tokens stehen nirgends deckend unter Text,
  die Schrift dunkelt um den vollen Betrag, die Tönung nur um 12–18 % davon.
  Damit ist `DnaCategory.accent` in `lib/gegner-dna.ts` **ohne jeden Leser** —
  das Feld kann bei nächster Gelegenheit fallen.
  **Auf `/kampfprofil` bleibt eine Lücke, die NICHT dieser Datei gehört:** Dort
  steht der Bericht auf einer deckenden Karte mit den `:root`-Werten, und die
  Signalfarben halten dort als Schrift kein AA (`--warning` 3,91 gegen
  `--surface-card`, rein aus den Token-Definitionen). Das trifft die halbe App
  und liegt als eigener Backlog-Punkt bereit.
  **ZWEI FALLEN AUS DER MESSUNG** (beide haben je einen Lauf gekostet):
  `page.screenshot({clip})` liegt in einem ANDEREN Koordinatenraum als
  `boundingBox()` und schneidet aus dem SICHTFENSTER — ein Element weiter unten
  liefert „Clipped area is either empty or outside" und sieht aus wie „Stelle
  gibt es nicht"; `locator.screenshot()` nimmt einem beides ab. Und
  **Playwright liefert PNG-Farbtyp 2 (RGB), nicht RGBA** — wer vier Bytes je
  Pixel annimmt, verrechnet die Zeilenlänge, entfiltert Müll und bekommt
  Schwarz zurück. Im DUNKLEN sah das mit 18,75:1 sogar gesund aus; erst das
  helle Theme entlarvte es mit 1,19:1. **Eine Zahl, die in einem Theme
  plausibel ist, belegt die Methode nicht.**
  Athleten haben KEINEN Zugriff auf das Werkzeug; sie sehen in ihrem
  **Kampfprofil** nur explizit Freigegebenes plus ihr gemergtes Profil
  (siehe nächster Punkt). Timer ist kein Top-Level-Punkt mehr: er hängt
  unter „Training" (alle) und „Trainer".
- **Kampfprofil vs. Account** (seit 2026-08-19): Das Profil ist zweigeteilt.
  `/kampfprofil` (alle Rollen, Profil-Menü) = „Wer bin ich als Kämpfer":
  gemergtes DeepFight-Profil (`users/{uid}.fightProfile`, siehe
  `lib/fight-profile.ts` — gleiche Form wie beim Gegner: dna + dnaSplit +
  actionStats), freigegebene eigene Auswertungen (`sharedWithAthlete`),
  freigegebene Gegnerprofile (`opponents.sharedWith`), editierbare
  Athleten-Daten (`components/AthleteProfileForm.tsx`). `/profile` (Account) =
  Fighter-Name, App-Einstellungen (Theme + Timer-Settings), Kurs-Abos,
  Account-Infos. Die alte Seite „Mein DeepFight" (`/deepfight`) leitet auf
  `/kampfprofil` um; `/deepfight/opponents/[id]` bleibt.
  **Entscheidung:** Der Schüler sieht sein VOLLES gemergtes Kampfprofil
  (read-only, entwicklungsorientiert) — nur rohe, nicht freigegebene Analysen
  bleiben verborgen. Kuratiert wird ausschließlich vom Trainer:
  `fightProfile` ist das Merge-Ziel der Athleten-Video-Analysen
  (`VideoAnalysisSection` mode="athlete", „Alle übernehmen" funktioniert dort
  seit 2026-08-19 genauso wie beim Gegner). Firestore-Regel: Owner darf
  `fightProfile` NICHT schreiben (analog `role`), Trainer/Admin-Update
  ausschließlich auf dieses Feld.
- **Trainer sind auch Athleten** (seit 2026-08-20): Die Rolle entscheidet über
  Werkzeug-Zugriff, NICHT darüber, wer Athlet sein darf. Zwei Leser in
  `lib/admin.ts`: **`listAllMembers()`** (alle User, kein Rollenfilter) für
  Kampfkontexte — „Neuer Wettkampf" (Schritt 1), Wettkampf-Übersicht +
  Trainer-Dashboard (Namensauflösung) und das DeepFight-Grid
  `/trainer/deepfight/athleten` und die Werkbank; **`listAllStudents()`** (= Members ohne
  Trainer/Admin, via `isStaffEntry`) bleibt für die reine Schülerverwaltung
  (`/trainer/students`, Admin-Seed, Freigabe-Panel im Gegnerprofil) und für die
  „Schüler"-Kachel auf dem Dashboard. UI-Gruppierung in beiden Kampfkontexten
  identisch: „Ich selbst"/„Meine Analyse" (cyan) · „Trainer & Coaches"
  (violet) · „Schüler" (neutral). ACHTUNG, seit 2026-09-04 eingeschränkt: Bei
  einem KOLLEGEN braucht es dessen Freigabe (siehe „Privates Athletenprofil").
  „Neuer Wettkampf" listet deshalb seit 2026-09-04 nur noch Kollegen mit dem
  Bereich `wettkampf`, die Werkbank auf `/trainer/deepfight` seit 07.09. nach
  `deepfight` — und die Athletenliste `/trainer/deepfight/athleten` seit
  Teilschritt 3 (07.09.) ebenso, samt Ghost-Filter. Der DeepFight-Bereich ist
  damit vollständig gefiltert; die Sackgasse „anklicken → noch nicht
  freigegeben" gibt es dort nicht mehr.
- **Wettkampfseite NEU (Leon 11.09.2026, `app/trainer/competitions/[uid]/
  [campId]`):** Kopf = Name links, rechts `CampNotizen` (Notizen MEHRERER
  Leute am Camp: `fightCamps.notizen[]` mit `authorUid`/`authorName`
  denormalisiert, `createdAt` als ms-ZAHL, weil `arrayRemove` das gleiche
  Objekt braucht; anlegen/löschen per `arrayUnion`/`arrayRemove` in
  `lib/fight-camp.ts`, löschen nur die eigene — Touch: wischen links/rechts
  via `SwipeAction`, Zeiger: Klick auf die Zeile zeigt den Mülleimer).
  Darunter Zustand + Knopf „Trainingsplan" = ANKER auf die LAUFENDE Phase
  (`phaseAnchorId()` aus `FightCampPlanView`, Rückfall `#trainingsplan`) +
  „Geteiltes Profil"/„Archivieren" als Nebenwege. Dann das **Vs.**: zwei
  Kacheln (Athlet / Gegner), die gewählte trägt den Akzent und entscheidet,
  wessen DeepFight darunter steht (Start: Gegner). Der DeepFight-Bereich ist
  RAHMENLOS: Name groß (`--type-display` OHNE Versalien — Inhalt), rechts
  „+ Analyse" und das Funkeln allein mit der Analysen-Zahl (Leons Ausnahme
  von DESIGN-BRIEF §1.6 für genau diese Stelle; die Wortmarke über dem
  Namen ist weg). „+ Analyse" klappt die `VideoAnalysisSection` der Werkbank
  HIER auf (gleiche Props, gleicher Speicher-Schlüssel wie `/analyse`), nach
  einer Übernahme lädt die Seite still nach (Gegner: verknüpftes Profil →
  `resolveCampOpponent`; Athlet: Kampfprofil). Kampfprofil/Analysen des
  Athleten hängen am Bereich `deepfight` — ein `permission-denied` wird als
  Satz gezeigt, nicht als Fehler. Die PageHead-Spur `detail` ist gefallen,
  der Rumpf steht auf `standard`. **Zweite Runde am selben Abend (Leon):**
  (1) **Gegner bearbeiten heißt IMMER für alle** — kein Snapshot-Editor mehr
  auf der Seite, der Stift führt zum geteilten Profil, die Anzeige nimmt das
  LEBENDE Profil (`opponentToSnapshot`), der Snapshot ist nur Rückfall;
  `resolveCampOpponent` (Snapshot gewinnt) gilt nur noch für die Karten.
  (2) „Geteiltes Profil" und „Archivieren" GESTRICHEN („Archiviert braucht
  man nicht wirklich"); die Gruppe „Archiviert" in der Übersicht bleibt für
  Altbestand. (3) Vs. ist `components/trainer/VersusBanner.tsx` — seit dem Abend
  **Leons eigenes Paket** (D:\claude-projects\tidal-versus, „alles so
  übernehmen"): silberne + türkise Platten mit Lichtkante, metallisches
  VS-Emblem (`public/vs-emblem.svg`), **Match-Intro bei JEDEM Öffnen**
  (Seite abgedunkelt, Platten gleiten in die Mitte, Impact, zurück; lokal
  synthetisierter Sound via Web Audio in `components/trainer/versus-intro.js`
  + `.d.ts`, Schlüssel = campId + Nonce je Einhängen, Escape/„Überspringen"
  beendet, `prefers-reduced-motion` lässt es aus). Stile in globals.css
  („DAS VS-BANNER DER WETTKAMPFSEITE"), Farben BEWUSST FEST (Material, wie das
  Emblem — Ausnahme von §1.1). Ergänzt gegenüber dem Paket: die Platten sind
  Knöpfe (`data-motion`, eigene :active-Transformation, weil die Grundhaptik
  sonst das translateY der rechten Platte überschriebe), die GEWÄHLTE Platte trägt das
  Türkis des Pakets und steht `scale(1.06)`, ihr Name zusätzlich
  `scale(1.12)`; die andere ist Silber (Leon 12.09., zweite Fassung — vorher
  war der Name blau, jetzt hängt die Farbe an der Wahl, nicht an der Seite:
  beim eigenen Athleten wird der Gegnerblock grau). **Zwei Abweichungen vom Paket (Leon, gleicher Abend):** das Intro
  wächst AN ORT UND STELLE auf dem Banner auf (dx/dy = 0), nicht in der
  Bildschirmmitte; und das Zeitfenster für den Ton ist 1200 ms statt 180 ms —
  nach einer Klick-Navigation war der Context „running", der Status trotzdem
  „blocked", weil Klonen + Animieren auf der noch bauenden Seite länger als
  180 ms dauerten (sichtbares Chromium, 11.09.). Danach „playing" per Klick
  UND nach frischem Laden. Was bleibt: Ohne jede Nutzergeste im Tab sperrt
  der Browser den Ton, dann läuft das Intro stumm. **Kein Aufblitzen (Leon
  12.09.):** Eine Hülle hält das Banner ab dem Server-HTML unsichtbar, bis das
  Skript `tidal-versus:intro-start` meldet; Rückfall nach 2 s, bei
  reduzierter Bewegung sofort sichtbar. Gemessen alle 30 ms: Banner vor dem
  Overlay an 0 Messpunkten sichtbar, per Klick und nach frischem Laden.
  **Die Seite wartet mit (Leon 12.09.):** `onIntroAusklang` am Banner —
  Kopf UND Rest stehen auf `visibility: hidden` + `opacity: 0` (nicht
  ungerendert — ein Sprung der Seitenhöhe könnte ein Scroll-Ereignis
  auslösen, und das bricht das Intro ab) und blenden in 900 ms ein, sobald das
  Intro in den Ausklang geht (`tidal-versus:intro-settle` bei 62 % der Dauer,
  spätestens `intro-end`); ohne Intro sofort, Rückfall 2 s. **Kein
  „Überspringen"-Knopf mehr:** das Overlay trägt `pointer-events: auto`, ein
  Klick oder Tipp irgendwohin beendet das Intro, ohne die Seite zu treffen;
  Escape bleibt.
  (4) „+ Analyse" ist `.df-start.df-plus`: nur ein großes Regenbogen-Plus,
  unter dem Zeiger wächst „Analyse" heraus (max-width), auf Touch bleibt das
  Plus allein (aria-label). **Seit Leons dritter Runde (12.09.) MEHR
  Regenbogen:** `--df-start-mix` hängt am Thema — 70 % im dunklen, 26 % im
  hellen. Die 26 % waren am hellen Theme gemessen, wo jeder Prozent mehr die
  dunkle Schrift AUFHELLT und Kontrast frisst; im dunklen ist es umgekehrt
  (`--text-1` L 0.96 gegen Regenbogen L 0.52–0.65, also dunkelt mehr Anteil
  ab), 70 % landen bei L 0.71 und über 6:1. Dazu das Zeichen eine Stufe
  kräftiger (600/48 px — mehr Fläche = mehr sichtbarer Verlauf) und ein
  weicher farbiger Schein `--df-start-glow`, den `:hover` mit der Sättigung
  zusammen trägt; im hellen Theme ist der Schein aus (dort wäre er ein
  grauer Schmutzrand).
  **Neben dem Plus steht seit 12.09. eine Pille „Bearbeiten"** statt des
  nackten 16-px-Stifts (Leon: „schlecht zu sehen, zu klein, gefällt mir
  nicht"). Kein anderes Symbol hätte das gelöst — die Frage war, ob ein
  Zeichen allein reicht, und es reicht nicht: Der Weg führt auf eine andere
  Seite und ändert das Profil FÜR ALLE. Jetzt Rahmen (`--line`), Wort in der
  Sprache der Statuszeile darüber, Stift auf 18 px.
  **Der Widerspruch „DNA 0 %" neben der Zahl „2"** (Leon 12.09.: „macht ja
  keinen Sinn") ist keiner: Die Zahl zählt die ANALYSEN am Profil, die DNA
  wächst erst mit der ÜBERNAHME der Befunde (`appliedFindingIds` /
  `appliedStats`). Gesagt hatte es nur niemand — der Leertext nennt jetzt die
  Zahl und was fehlt, der Titel am Funkeln ebenso.
  (5) `CampNotizen` ist nur noch die dunkle Karte
  mit Überschrift: Klick auf die Fläche setzt den Cursor in eine unsichtbare
  Textfläche (OBEN unter der Überschrift), Blur oder Enter speichert, Escape
  verwirft, Klick auf die eigene Notiz zeigt das nackte Mülleimer-Icon.
  **ZWEI MASSE, DER FOKUS ENTSCHEIDET (Leon 12.09., dritte Runde — löst die
  Fassung „wächst bis ans Banner" ab):** ruhig `--notiz-h-klein` 116 px, weit
  `min(44vh, 350px)`; berührt man die Karte (`pointerdown`/Fokus), geht sie
  auf, ein Zeiger daneben oder Escape klappt sie zu. Sie beginnt tiefer
  (`lg:top-14` statt `top-7`) und hat KEIN `bottom` mehr. Zwei gemessene
  Fallen: (a) `max-height` STRECKT nichts — bei leerer Liste blieb die Karte
  auf 85 px; das große Maß braucht `min-height`. (b) Ein `z-index` an der
  Karte ist wirkungslos, sie steht statisch — er gehört an den absolut
  gesetzten Behälter (`lg:z-30`), sonst legt sich das Vs.-Banner darüber.
  Die Fläche ist durchlässiger als eine normale `.t-card` (58 % ruhig, 82 %
  weit, plus Weichzeichner). Innen Popup-Regel: genau EIN Scrollbereich
  (`min-h-0 flex-1 overflow-y-auto`). Gemessen 11.09.: beide Themes, 1440
  und 390 px; Plus-Hover, Blur-Speichern, Löschen, Anker per Playwright.
- **Wettkampf-Gegner: Snapshot + verknüpftes Profil** (seit 2026-08-20):
  Der Snapshot in `fightCamps/{id}.opponent` bleibt gespeichert wie bisher,
  ist aber **nicht mehr das, was angezeigt wird**. Anzeige und Editor-Vorbelegung
  laufen über `resolveCampOpponent(snapshot, live)` (`lib/opponents.ts`): das
  verknüpfte `opponents/{opponentId}` füllt **nur Lücken** — DNA-Antworten, die
  der Snapshot nicht hat, dazu `dnaSplit`/`actionStats`, falls der Snapshot
  keine hat. **Vorhandene Snapshot-Werte gewinnen immer** (es gibt keine
  Zeitstempel pro Antwort → „neuer" ist nicht entscheidbar; die bewusste
  Wettkampf-Notiz wiegt schwerer). Dadurch zählt die `DNA n`-Zahl auf den
  Wettkampfkarten später ergänztes Scouting mit; ein violettes `+n NEU`-Badge
  bzw. ein Hinweis auf der Detailseite macht die Ergänzung sichtbar.
  Geschrieben wird weiter nur beim Speichern im Wettkampf-Editor — dann friert
  der angezeigte (gemergte) Stand ein. Ist das Profil gelöscht/nicht lesbar,
  greift automatisch der reine Snapshot. Verknüpfungs-ID immer über
  `campOpponentId(camp)` lesen (liegt historisch am Camp UND am Snapshot).
- **Multi-Gym Phase 0+1 implementiert (2026-08-20, siehe
  `docs/MULTI-GYM-KONZEPT.md`):** Die früheren Schulden sind getilgt —
  `videoAnalyses` ist aus dem users-Owner-Wildcard herausgelöst (Owner-Read
  nur bei `sharedWithAthlete == true`, Owner-Write NIE; Athleten-Queries
  MÜSSEN `where("sharedWithAthlete","==",true)` filtern →
  `listVideoAnalyses(..., { sharedOnly: true })`), die Middleware prüft
  Token-SIGNATUREN (jose gegen Googles Zertifikate) und gated `/admin`
  (role=admin, sonst 404) und `/trainer` (trainer/admin, sonst Redirect).
  **Cutover ist LIVE seit 2026-08-21** (Migration + Indizes + Client + Rules
  deployed; Migration lief als REST-Variante über die eingeloggten
  firebase-tools-Credentials, da kein Service-Account-Key auf dem PC liegt).
  Gym-Trennung: `gymId` liegt als **Custom Claim** neben `role`
  (auth-context spiegelt ihn ins Profil); die Rules prüfen `data.gymId`
  **STRIKT** gegen den Token-Claim (fehlender CLAIM = Default-Gym, fehlendes
  DOKUMENT-Feld = Zugriff verweigert — deshalb Migration nötig,
  `scripts/migrate-multi-gym.mjs`, Cutover-Reihenfolge im Script-Kopf!).
  Trainer-Listen-Queries filtern deshalb zwingend nach gymId:
  `listAllMembers(gymId)`, `listAllStudents(gymId)`,
  `listAllFightCamps(gymId, zugriff)`, `listOpponentsForGym(gymId)`;
  `belongsToGym` ist jetzt strikt. `set-role.mjs` MERGT Claims (gymId bleibt
  erhalten). Noch bewusst OHNE Gym-Scope (Phase 2/3): `trainingSessions`,
  `aiUsage`, `techniqueStats`, Rollen-API/Einladungen.

## Tech-Stack
| Layer | Technologie | Version |
|---|---|---|
| Framework | Next.js App Router | 14.2.35 |
| Sprache | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS | 3.4 |
| Auth + DB | Firebase Web SDK (Auth + Firestore) | 12.x |
| Admin | firebase-admin (nur Scripts/serverseitig) | 14.x |
| 3D | @react-three/fiber v8 + drei v9 | **React 18 — NICHT auf v9/v10 heben!** |
| Animation | Framer Motion | 12.x |
| State | Zustand (installiert) | 5.x |
| Payments | Stripe (installiert, noch nicht gebaut) | — |
| React | React | **18** (nicht 19!) |

## Architektur & Patterns (wichtig)
- **Firebase IMMER lazy** über `lib/firebase.ts`: `getFirebaseApp()` /
  `getFirebaseAuth()` / `getFirestoreDb()` — nie module-level `initializeApp()`.
- **`"use client"`** auf alle Komponenten mit `useAuth`/`useState`/`useEffect`.
- **`@/` Alias** für alle Imports.
- **Auth-Context:** `lib/auth-context.tsx` → `AuthProvider` + `useAuth()`.
  Spiegelt das ID-Token in ein `__session`-Cookie (für die Middleware).

### Rollen & Berechtigungen (Sicherheits-kritisch)
- **Das Rollen-SET (seit 2026-09-01, Checkpoint 3, `lib/roles.ts`):** Rechte
  sind DREI unabhängige Häkchen in den Custom Claims — `trainer` (Werkzeuge),
  `verwaltung` (Gym führen), `admin` (Plattform-Rang) — plus `gymId`. Alles
  autoritativ in Firebase Auth Custom Claims, NICHT im Firestore-Dokument
  (dort nur Abfrage-Spiegel). Athlet ist KEIN Häkchen, sondern der
  Grundzustand; der Cheftrainer hat `trainer` + `verwaltung`.
- **Warum kein `role`-Wert mehr:** `role` konnte immer nur EINES ausdrücken.
  Deshalb musste `verwaltung` 2026-08-31 schon daneben entstehen (ein
  Häkchen, das `role="admin"` gesetzt hätte, gäbe Zugriff auf FREMDE Gyms —
  `isAdmin()` überspringt in den Regeln jeden Gym-Vergleich), und `trainer`
  konkurrierte mit `admin` um denselben Platz.
- **EINE Datei baut und liest die Claims: `lib/roles.ts`.** `readRoleSet`
  (gespeicherte Häkchen), `effectiveRights` (Plattform-Rang eingerechnet),
  `claimsWithRights` (Claims bauen — reicht `gymId` durch, LÖSCHT entzogene
  Häkchen), `rightsMirror` (users-Dokument). Node-Scripts haben eine
  Zwillingsfassung in `scripts/lib/role-claims.mjs` (sie können kein TS
  importieren) — Änderungen IMMER in beiden.
- **Geschrieben wird nur, was wahr ist:** fehlender Claim = kein Recht. Am
  users-Dokument stehen dagegen ALLE vier Felder ausdrücklich, sonst ließe
  ein `set(merge:true)` ein entzogenes Häkchen stehen.
- **ÜBERGANGS-SPIEGEL `role` (fällt wieder weg):** Claims und Dokument tragen
  weiter ein abgeleitetes `role` (`admin ? "admin" : trainer ? "trainer" :
  "user"`), und alle Leser haben einen Rückfall darauf. Grund ist die
  Stunde, die ausgestellte ID-Tokens leben, UND die Rücknahme: Ein Rollback
  der Firestore-Regeln auf den Stand vor Checkpoint 3 wäre ohne Spiegel eine
  Aussperrung aller Trainer. Backlog-Punkt zum Entfernen steht unten.
- Client liest alles via `getIdTokenResult()` — siehe `auth-context.tsx`
  (`claimsToProfile` an EINER Stelle; `refreshRole()` erzwingt Token-Refresh
  nach Claim-Änderung, nach `/api/members/role` PFLICHT, wenn man die eigenen
  Rechte geändert hat). **In Komponenten IMMER `useRights()`** aus dem
  Auth-Context statt eigener Vergleiche — der Hook löste rund zwanzig Kopien
  von `profile?.role === "trainer" || profile?.role === "admin"` ab, von denen
  jede eine Stelle war, an der ein neues Recht vergessen werden konnte.
- Claims werden **ausschließlich serverseitig** per Admin-SDK gesetzt — seit
  2026-08-31 gibt es dafür eine echte API statt nur Hand-Scripts:
  - `POST /api/members/role` (Rollen-API, Konzept §4): Body trägt NUR
    `{ uid, trainer, verwaltung }`, also weder den Plattform-Rang `admin`
    noch `gymId` — beides ist nicht ausdrückbar, nicht bloß verboten. Prüft hart: Aufrufer
    ist Verwaltung DESSELBEN Gyms (`canManageGym`), Ziel existiert, Ziel im
    eigenen Gym, Ziel ist kein Plattform-Admin, **Aussperr-Schutz** (das
    letzte Verwaltungsrecht eines Gyms lässt sich nicht entziehen; gezählt
    wird über den users-Spiegel, Plattform-Admins zählen mit), Audit-Eintrag.
    Claims werden GEMERGT, das users-Dokument gespiegelt — schlägt der
    Spiegel fehl, werden die Claims zurückgenommen (ein Recht, das niemand
    zählen kann, wäre schlimmer als ein sichtbar fehlgeschlagener Klick).
  - `POST /api/members/remove` (Mitgliedschaft beenden): dreht `/redeem`
    zurück — nimmt Freigaben (`opponents.sharedWith`,
    `trainerPlans.audienceUids`) zurück, setzt `gymId` im Claim auf **null**
    (bewusst null statt „Claim weg": ohne Claim fiele `userGymId()` in den
    Regeln aufs Default-Gym zurück, und der Ausgetretene wäre wieder Mitglied
    genau dort) und LÖSCHT `gymId` am users-Dokument (Dokument-Seite ist
    strikt → das Gym verliert damit den Lesezugriff auf Kampfprofil,
    Analysen und Wettkämpfe). **Diese Route löscht KEIN Konto** — siehe
    „Konto vs. Mitgliedschaft" unten.
  - `node scripts/set-role.mjs <uid> <user|trainer|admin>
    [--verwaltung|--keine-verwaltung]` — das Hand-Werkzeug für den
    PLATTFORM-Rang, den die API bewusst nicht kann. Mergt; `gymId` und (ohne
    Schalter) das Verwaltungsrecht bleiben unangetastet. Credentials kommen
    aus `.env.local` (`scripts/lib/admin-app.mjs`), kein
    `GOOGLE_APPLICATION_CREDENTIALS` mehr nötig.
  - `node scripts/migrate-role-set.mjs [--dry-run]` — Cutover auf das
    Rollen-Set (Claims + users-Spiegel, idempotent; Reihenfolge im
    Script-Kopf). `scripts/migrate-multi-gym.mjs` bleibt für gymId-Backfills.
- `firestore.rules` liest das Set aus dem Token (`isTrainerOrAdmin()`,
  `isVerwaltung()`, `isAdmin()`, `canManageGymId(gymId)`, Rückfall
  `legacyRole()`); Clients dürfen `role`, `trainer`, `verwaltung`, `admin`
  und `gymId` im users-Dokument nie schreiben (Privilege-Escalation und
  Gym-Wechsel geschlossen). Der Spiegel am Dokument existiert NUR, weil
  Custom Claims nicht abfragbar sind — ohne ihn ließe sich „hat dieses Gym
  noch eine Verwaltung?" nicht beantworten.

### Privates Athletenprofil (Entscheidung 2026-09-03, LIVE)
Ein Trainer sieht das Persönliche eines **Kollegen** nur mit dessen Freigabe:
Athletenprofil, Kampfprofil, Workouts, Wettkämpfe, KI-Analysen **samt
Auswertung**. Bei **Athleten** bleibt es wie bisher — alle Trainer ihres Gyms.
**Standard ist privat**, ohne Backfill: eine fehlende Freigabeliste IST die
Sperre (Deny-by-Default, Konzept §3).
- **Warum die Daten umzogen:** Firestore-Regeln verbergen keine einzelnen
  Felder, nur ganze Dokumente. Das users-Dokument muss lesbar bleiben, sonst
  fehlt in jeder Liste der Name. Also wanderten `athlete` und `fightProfile`
  vom Dokument in Unter-Sammlungen (`scripts/migrate-private-profile.mjs`,
  gelaufen 2026-09-03).
- **Die Regel:** `canAccessMemberData(uid, bereich)` in `firestore.rules`
  (ersetzt `isStaffForUser`) — Admin immer · **sich selbst immer** (ein Trainer
  analysiert sich „exakt wie einen Schüler"; ohne diese Klausel sperrt ihn sein
  eigenes Gate aus) · sonst eigenes Gym UND (kein Stab-Konto ODER in
  `users/{uid}.profileShares[bereich]`).
- **GETRENNT JE BEREICH (Leons Revision 03.09. abends, LIVE):** Die Freigabe
  ist kein einzelner Schalter, sondern eine Map je Bereich. Schlüssel,
  Beschriftungen und Erklärtexte stehen an EINER Stelle —
  `lib/profile-sharing.ts`; die Regeln schlagen exakt diese Schlüssel nach.
  Eine Freigabe auf einen unbekannten Schlüssel wirkt einfach nicht, deshalb
  dürfen sie nie auseinander laufen (Muster `lib/roles.ts`).

  | Bereich | umfasst | Regelstelle |
  |---|---|---|
  | `athlet` | athleteProfile, workouts, participations, workoutPlans | users-Wildcard |
  | `deepfight` | fightProfile **+** videoAnalyses (das eine IST die Auswertung des anderen) | zwei eigene Blöcke |
  | `wettkampf` | fightCamps | eigener Block + materialisiertes `ownerIsStaff` am Camp |

  **Der users-Wildcard nimmt jetzt `videoAnalyses`, `fightProfile` UND
  `fightCamps` aus.** Solange EINE Freigabe für alles galt, war das egal — die
  Bedingung war überall dieselbe. Ohne die Ausnahme öffnete das Häkchen
  „Athletenprofil & Training" stillschweigend auch das Kampfprofil.
- **DIE WETTKAMPF-LÜCKE — GESCHLOSSEN am 2026-09-04 (Schritt 2b, LIVE):**
  `match /{path=**}/fightCamps/{campId}` matchte **nicht nur**
  collectionGroup-Queries, sondern auch den direkten Pfad
  `users/{uid}/fightCamps/{campId}` — und prüfte dort nur `sameGym`. Weil
  Firestore-Regeln ODER-verknüpft sind, gewann die großzügigere: Trainer A las
  das Camp von Trainer B mit **200**, ohne jede Freigabe, und eine erteilte
  Freigabe änderte daran **nichts**.
  Geschlossen mit einem materialisierten **`ownerIsStaff`** am Camp-Dokument
  (Muster `trainerPlans.audienceUids` — eine Query kann keinen `get()` aufs
  Eltern-Dokument machen, die Regel muss allein aus dem Camp beweisbar sein).
  Seither liefert die collectionGroup-Regel nur noch **Athleten-Camps**; die
  Camps von Stab-Konten laufen ausschließlich über
  `canAccessMemberData(uid, "wettkampf")`. Gebaut wurde:
  Pflichtfeld am Typ `FightCamp` (TypeScript erzwingt es an jeder
  Anlegestelle), beide Schreibstellen in `lib/fight-camp.ts`, Nachziehen in
  `/api/members/role` (mit Rücknahme wie beim Spiegel), Backfill
  (`scripts/backfill-fight-camp-owner.mjs`, Cutover-Reihenfolge im
  Script-Kopf), Umbau von `listAllFightCamps(gymId, zugriff)` auf „gym-weit
  nur Athleten-Camps **plus** Direktabfrage für die eigenen und die
  freigegebenen Kollegen" und ein neuer Index
  (`gymId + ownerIsStaff + competitionDate DESC`, COLLECTION_GROUP).
- **DAS FELD IST AUCH BEIM SCHREIBEN GEPRÜFT** (über den Bauplan hinaus, Leons
  Entscheidung 04.09.): `ownerIsStaffStimmt(uid)` vergleicht den geschriebenen
  Wert gegen `istStabKonto(get(users/{uid}))`. Ohne diesen Vergleich könnte
  jemand mit Wettkampf-Freigabe das Camp eines Kollegen auf `false` setzen und
  gym-weit sichtbar machen — aus „einer darf" würde „alle dürfen". Der `get()`
  fällt nur beim Schreiben an, nie in einer Query. Dafür ist `fightCamps` aus
  dem OWNER-Schreibzweig und aus dem Admin-Zweig des users-Wildcards
  herausgenommen: Alle Camp-Schreibvorgänge laufen jetzt durch diese eine
  Regel. Owner-LESEN bleibt (Athleten-Dashboard).
- **REGEL-FALLE, TEUER GEMESSEN (04.09.2026):** Die Query-Analyse der
  Rules-Engine versteht **`resource.data.get("feld", default)` NICHT** als
  Einschränkung. Ein erster Anlauf schrieb
  `resource.data.get("ownerIsStaff", false) == false` — die Regel sah richtig
  aus, kompilierte, und eine Query mit nur `gymId` + `orderBy` kam trotzdem mit
  **200 durch und lieferte das Stab-Camp mit**. Erst der DIREKTE Feldzugriff
  `resource.data.ownerIsStaff == false` zwingt die Query, den passenden Filter
  mitzubringen (danach: ohne Filter 403, mit Filter 200 und nur die
  Athleten-Camps). Preis: Ein Dokument OHNE das Feld ist ein
  Auswertungsfehler und damit verboten — deshalb muss der Backfill VOR dem
  Rules-Deploy laufen. **Bei jeder rules-seitigen Query-Einschränkung das Feld
  direkt lesen, nie mit Default.**
- **Die Oberfläche vergibt den Bereich `wettkampf` jetzt** (`SHARE_AREAS`).
  „Neuer Wettkampf" bietet Kollegen nur noch an, wenn sie den Bereich
  freigegeben haben — ein Name, der beim Speichern an den Regeln scheitert,
  wäre schlechter als kein Name; Ghost-Konten fehlen dort ebenfalls. Die
  Camp-Detailseite liest den Namen über `getMemberEntry()` statt
  `getStudentEntry()`: Wer seinen Wettkampf freigibt, muss dafür nicht auch
  sein Athletenprofil hergeben.
- **`node scripts/check-privacy-gate.mjs` ist der Regressionstest** — REST mit
  echten ID-Tokens, **24 Fälle** (Gate, Bereichstrennung, Schreibrecht am
  eigenen Dokument, Wettkämpfe einzeln UND als echte collectionGroup-Query
  per `documents:runQuery`). Nach JEDER Regeländerung laufen lassen; das Admin-SDK
  umgeht Regeln und beweist nichts. **Achtung beim Erweitern:**
  `affectedKeys()` enthält nur Felder, die sich TATSÄCHLICH ändern — ein
  Schreibvorgang mit dem bereits gespeicherten Wert ist ein No-Op, und dann
  liefert `hasAny([...])` false und `hasOnly([...])` sogar true. Ein erster
  Anlauf des Tests meldete dadurch 200, wo er 403 erwartete.
- **Der Freigabe-Knopf (Schritt 2, LIVE; Form von Leon am 04.09. festgelegt):**
  `components/ProfileShareButton` — ein Knopf **„Profil teilen"** (Icon
  `share`, 20 px, Rahmen in `--accent`) im Kopf von `/kampfprofil`, direkt
  ÜBER „Meine Analyse starten". Der Rahmen nimmt bewusst den Akzent-Token
  statt eines blauen Hex (DESIGN-BRIEF §1.1): Das Blau IST der Gym-Akzent und
  folgt später dem Branding-Kit. Bis dahin war es eine ganze Karte („Sichtbarkeit") weiter unten;
  das war viel Fläche für eine selten angefasste Einstellung, und sie stand
  dort, wo niemand sie suchte. Der Zähler am Knopf hält den Zustand sichtbar —
  eine Freigabe, an die man sich nicht erinnert, ist genau das, was der
  Bereich verhindern soll.
  Dahinter das Sheet **„Sichtbarkeit bearbeiten"** (`ProfileShareSheet`,
  Muster `MemberRoleSheet`), gruppiert nach MENSCH statt nach Bereich: Erklärung
  je Bereich einmal oben, darunter je Kollege eine Zeile.
  **Die Schalter sind ein AKKORDEON** (Leon 04.09.): Sie erscheinen erst beim
  Antippen der Person, und immer nur bei einer — bei vier Kollegen standen
  sonst zwölf Schalter untereinander. Zugeklappt trägt der Satz unter dem Namen
  die ganze Auskunft; Klickziel ist die ganze Zeile, nicht der Pfeil (auf dem
  Handy wären 16 px zu wenig). Im aufgeklappten Zustand liegen die drei
  Schalter UNTEREINANDER — nebeneinander ließen sie „Athletenprofil & Training"
  auf 141 px mitten im Namen umbrechen. Sichtbar nur für Stab-Konten (bei
  Athleten bewirkt das Feld nichts). Plattform-Admins stehen NICHT in der Liste (`isGhostAccount`
  in `lib/admin.ts`, Leons Entscheidung 03.09. — siehe Backlog „Ghost-Konten
  app-weit durchziehen").
  Die Gegenrichtung („Mit dir geteilt") steht seit dem 04.09. am FUSS DES
  SHEETS statt in der Karte, kostet keine zweite Abfrage (`listAllMembers`
  trägt `profileShares` an jedem Eintrag) und erscheint nur für Trainer, weil
  `canAccessMemberData` `isTrainerOrAdmin()` verlangt.
- **Der Satz unter einem Namen wird aus GLIEDERN gefügt, nicht aus Teilsätzen**
  (`satzFuerPerson` + `GLIEDER` in `lib/profile-sharing.ts`): Solange jeder
  Bereich ein fertiges Stück mit eigenem „und" lieferte, entstand bei zwei
  Bereichen eine Kette — „… dein Athletenprofil und dein Training und dein
  Kampfprofil und deine Analysen." Als Glieder gefügt steht dort
  „… dein Athletenprofil, dein Training, dein Kampfprofil und deine Analysen."
  Wer einen Bereich ergänzt, ergänzt seine Glieder, keinen Satz.
- **Dual-Read als Übergang** (`lib/user-profile.ts`, `lib/fight-profile.ts`):
  erst Unter-Sammlung, dann altes Feld — aber NUR bei „Dokument fehlt", nie bei
  „Zugriff verweigert". Sonst unterliefe der Rückfall genau das Gate.
- **Listen tragen kein Athletenprofil mehr.** `StudentEntry.athlete` füllt nur
  `getStudentEntry()`; `getMemberEntry()` liefert die reine Identität und
  bleibt auch bei gesperrtem Profil lesbar.
- **Noch offen:** Schritt 3 Anfrage +
  Benachrichtigung (es gibt heute KEINEN Benachrichtigungsweg — `auditLog` ist
  das Gym-Protokoll, nur die Verwaltung liest, kein Postfach) · Schritt 4
  Trainer mit „Trainer"-Vermerk in der Athletenliste (bewusst zuletzt).

### TRAINER-AUSWAHL IM FREIGABE-SHEET (30.09.2026, Leon: „ja dann bau es so. und documentiere alles")
**Die Rechte, die NICHT angefasst werden (Leon 30.09.: „dies sollte auch
nicht geändert werden"):** Ein Athlet liest nur sein eigenes users-Dokument,
NICHT die Mitgliederliste seines Gyms (`match /users/{uid}` → `allow read`
nur für sich, Admin, Trainer/Verwaltung desselben Gyms). Athletenprofil und
Wettkämpfe eines Athleten sehen die Trainer seines Gyms immer; freigeben muss
ein Athlet nur **DeepFight** (Kampfprofil + Analysen) — ohne Freigabe kann ihn
niemand analysieren. `bereicheFuerKonto` zeigt ihm deshalb nur diesen Bereich.

**Der Fehler bis 30.09.:** `ProfileShareButton` lud die Namen für JEDEN über
`listAllMembers(gymId)`. Beim Athleten scheiterte die Abfrage an den Regeln,
das `.catch` setzte eine leere Liste, und das Sheet schrieb „In deinem Gym
gibt es gerade keinen Trainer" — Tidal Athletics hatte drei. „Alle Trainer
deines Gyms" funktionierte, aber einzelne Trainer konnte kein Athlet wählen.

**Die Lösung — eine Route, die Regeln bleiben gleich:**
`POST /api/gym/trainer-auswahl` (`app/api/gym/trainer-auswahl/route.ts`,
Client `lib/trainer-auswahl.ts`). Antwort
`{ gyms: [{ gymId, name, trainer: [{ uid, name, avatar }] }] }`.
Stab-Konten laden weiter über `listAllMembers` (sie brauchen die Liste auch
für „Mit dir geteilt"), Athleten über die Route. Das ausführliche
Sicherheitsmodell steht im Kopf der Route; hier die Punkte, die man beim
Ändern NIE verlieren darf:

| Szenario | Schutz |
|---|---|
| nicht angemeldet / kaputtes Token | 401 (`verifyUser`) |
| fremdes Gym abfragen | Route liest KEINE Eingabe; Gym nur aus dem Token-Claim (setzt nur das Admin-SDK). Ein Body mit `gymId` wird ignoriert (gemessen). |
| Selbstanmeldung ohne Einladung | `userGymId()` fällt ohne Claim aufs Default-Gym zurück — hier NICHT: `mitgliedsGyms()` (lib/server/verify-user.ts) kennt keinen Rückfall, und Claim UND `users/{uid}.gymId` müssen übereinstimmen. Sonst `{ gyms: [] }`. Produktion 30.09.: genau ein solches Konto. |
| E-Mail-Leck | eigene Namensregel `displayName → authProviderName → „Trainer"`. NIE `memberName()` — die fällt auf die E-Mail zurück. Antwort trägt je Trainer genau `uid`, `name`, `avatar`. |
| Liste zeigt Leute, die gar nicht lesen dürfen | Vorauswahl über den Spiegel (`gymId` + `trainer` am Dokument, Claims sind nicht abfragbar), dann Prüfung gegen die CLAIMS per `getUsers`: Trainer-Recht, KEIN Admin, `claims.gymId` = Gym, Konto nicht gesperrt. Genau die Bedingung von `canAccessMemberData`. Reine Verwaltung, Ghost-Admins, Demo-Dokumente ohne Login, gesperrte Konten und nachhinkende Spiegel fallen raus. |
| Namen zu beliebigen uids erfragen | Die Route schlägt NIE Namen zu uids aus den eigenen `profileShares` nach — sonst schriebe jemand eine fremde uid in sein Dokument und erführe den Namen jedes Kontos der Plattform. Altlasten stehen im Sheet deshalb nur als Anzahl. |
| CDN-Zwischenspeicher | POST + `Cache-Control: no-store` |
| Ladefehler = „keine Trainer" | `AuswahlStatus` `laedt / ok / ohne-gym / fehler` im Button; das Sheet hat für jeden Zustand einen eigenen Satz. Eine leere Liste gilt nur bei `ok` als leer. |

**ALTLASTEN** (`altlasten()` / `ohneAltlasten()` in lib/profile-sharing.ts):
Namentliche Freigaben an jemanden, der nicht mehr als Trainer zur Auswahl
steht, und „alle Trainer" eines Gyms, zu dem man nicht mehr gehört. Sie
wirken nicht (Regeln verlangen Gym + Trainer-Recht), WACHEN ABER WIEDER AUF,
wenn die Person zurückkommt — und standen vorher unsichtbar im Dokument. Das
Sheet zeigt ihre Anzahl mit „Entfernen"; berechnet NUR aus einer erfolgreich
geladenen Liste (sonst wäre bei einem Ladefehler jede Freigabe eine Altlast).

**ATHLET IN MEHREREN GYMS** (heute gesperrt, Konzept §1; Gedächtnis
`athlet-mehrere-gyms`): Die Antwort ist schon nach Gym gruppiert, die Gyms
kommen aus `mitgliedsGyms()` — die EINE Stelle, die später die
Mitgliedschaften liest (keine weitere Kopie der Ein-Gym-Annahme anlegen). Der
Button legt heute alle Trainer in eine Liste; die Freigabe gilt je Person
(Leons Festlegung: Gyms nur als Gruppierung in der Anzeige). **Pflicht beim
Umbau:** Das Trainer-Recht muss dann JE GYM geprüft werden — heute prüft die
Route den kontoweiten Claim. Sonst stünde jemand, der im MMA-Gym Trainer und
im Sambo-Gym nur Athlet ist, in der Sambo-Liste als Trainer. „Alle Trainer
deines Gyms" braucht dann eine Karte je Gym (`shares.gyms` ist schon eine
Liste). Und: Altlasten zählen Gyms gegen die EIGENEN Gyms — das Sheet
bekommt dann die ganze Liste statt `[gymId]`.

**Messung:** `scripts/mess-trainer-auswahl.mjs` (eigene Prüf-Gyms A/B, zehn
Prüfkonten inkl. Verwaltung, Admin, Spiegel-ohne-Claim, gesperrt, ohne Gym,
Claim≠Dokument, dazu ein Demo-Dokument; räumt alles weg). 39/39 hell und
dunkel am 30.09.2026 (dreimal hintereinander) — inklusive des echten
Regel-Beweises: nach der Namens-Freigabe liest Anna das Kampfprofil per REST
(200), der andere Trainer nicht (403) — und des Stab-Wegs (Trainersicht mit
„Mit dir geteilt"). `NUR_API=1` ohne Browser. Ein Absturz im Skript zählt als
FEHLER (Exit-Code 1), nie als bestanden. Bilder in `../abnahme-trainer-auswahl/`.
**Messfalle:** Auf /kampfprofil geht ein Klick in der ersten Sekunde nach dem
Laden verloren bzw. das Sheet schließt sich wieder (die Seite baut sich nach
dem Laden einmal neu auf) — das Skript wartet deshalb `networkidle` + 1,5 s.

**Beobachtet am Stab-Weg (Bestand, bewusst NICHT geändert):** Die
Kollegenliste der Trainer filtert über den Spiegel am Dokument
(`isStaffEntry` = `rights.trainer`), nicht über die Claims — ein Konto mit
nachhinkendem Spiegel oder ein gesperrtes Konto steht dort. Ohne Namen zeigt
sie die E-Mail (`memberName`); Trainer dürfen die E-Mail ohnehin lesen.

~~**Offen:** Der Default-Gym-Rückfall …~~ **ERLEDIGT 30.09.2026 abends**: Der
Rückfall ist überall weg, siehe „KONTEN OHNE GYM" direkt unten.

### KONTEN OHNE GYM (30.09.2026, Etappe 1 der Gym-Suche; Leon: „konten ohne gym [sehen] nur ihr profil + ihr bis dato gemachtes kampfprofil. kursplan etc. sehen sie nicht")
**Der Rückfall aufs Default-Gym ist WEG** — an allen drei Stellen, die
Zugehörigkeit entscheiden, und sie müssen gleich bleiben:
- `firestore.rules` `userGymId()`: Claim nur, wenn `gymId` ein nicht-leerer
  String ist, sonst `"__kein-gym__"`. Fängt auch den `gymId: null`-Claim aus
  `/api/members/remove` (vorher: `"gymId" in token` war mit null wahr, Server
  und Client sahen aber „kein Claim" → Default-Gym; die drei Stellen liefen
  auseinander). **Deployt 30.09.2026 abends** (Leon: „ja deploy").
- `lib/server/verify-user.ts` `userGymId()`: ohne Claim `KEIN_GYM`.
- `lib/gym.ts` `resolveGymId()`: ohne Claim `KEIN_GYM` (vorher nur für Admins).
- Dazu die Ziel-Seite: `lib/server/member-access.ts` `readMember` und
  `/api/members/{role,remove}` schieben ein Ziel ohne gymId nicht mehr ins
  Default-Gym (`KEIN_GYM`) — die Verwaltung von Tidal Athletics konnte sonst
  die Rechte eines Kontos ändern, das nie beigetreten war (gemessen: jetzt 403).
- `belongsToGym()` (Datensätze ohne gymId = Default-Gym) bleibt: Das ist ein
  Rückfall für ALTE DATENSÄTZE, keine Mitgliedschaft.

**Wen es trifft:** Selbstanmeldung ohne Einladung (kein Claim), entferntes
Mitglied (Claim null). Produktion 30.09.: genau ein solches Konto; alle
echten Mitglieder tragen ihr Gym im Claim. Ein Admin war schon vorher
`KEIN_GYM`. Vor dem Deploy las so ein Konto Leons Gym-Dokument und den aktiven
Wochenplan (gemessen 200), seit dem Deploy 403.

**Was ein Konto ohne Gym sieht — die Oberfläche:**
- `useOhneGym()` (lib/auth-context.tsx): angemeldet, Profil geladen, KEIN
  Recht, `resolveGymId === KEIN_GYM`. Während des Ladens FALSCH (die Sperre
  darf nicht aufblitzen).
- `components/shell/OhneGymGate.tsx`: sitzt in der Athleten-Hülle
  (`AppShell`), nicht in den Seiten — keine Seite kann die Sperre vergessen.
  Erlaubt: `/profile`, `/kampfprofil`, `/gym-finden`. Alles andere zeigt
  `OhneGymHinweis` („Du gehörst gerade keinem Gym an." · „Gym finden" →
  /gym-finden · „Einladungscode eingeben" → /beitreten · „Gym anmelden").
  Ohne Gym gibt es keine Navbar, keinen Footer, keinen Gesperrt-Streifen.
- `AthleteTabBar`: ohne Gym die Plätze Gym finden / Kampfprofil / Profil,
  keine App-Suche (sie durchsucht Gym-Inhalte).
- `/profile` ohne „Meine Kurse"; `ProfileShareSheet` ohne die Karte „Alle
  Trainer deines Gyms" (Status `ohne-gym` aus der Trainer-Auswahl).
- Die Dashboard-Karte „Du gehörst gerade zu keinem Gym" ist weg — die Seite
  wird ohne Gym gar nicht mehr erreicht.
- `/gym-finden` ist in Etappe 1 ein GRUNDGERÜST (Kopf, Einladungscode, Gym
  anmelden) und steht in `ATHLETE_SHELL_ROUTES`. Die Liste aller Tidal-Gyms
  mit PLZ/Ort-Suche, Standort-Freigabe, Radius und Karte ist Etappe 3.
- Alte Workouts und der Verlauf bleiben gespeichert und erscheinen nach einem
  Beitritt wieder (Leons Vorgabe geht vor dem früheren Text „Deine Workouts …
  bleiben dir erhalten").

**Messung:** `scripts/mess-ohne-gym.mjs` (Prüf-Gym mit aktivem Wochenplan,
Konten fremd/entfernt/Mitglied/Verwaltung; liest Leons Gym nur als Beweis;
räumt alles weg). Vor dem Rules-Deploy 28/30 (die zwei Regel-Zeilen zeigten
das Loch), nach dem Deploy 17/17 im API-Teil (`NUR_API=1`); der Browser-Teil
war vor dem Deploy grün (hell + dunkel). Fallen: Knöpfe und Leiste stehen in
VERSALIEN (CSS) — Prüfsätze mit `/…/i`; der Hinweis nennt selbst das Wort
„Kursplan".

**Der Plan dahinter (Leon 30.09., Antworten auf drei Fragen):** Gym-Suche nur
mit Tidal-Gyms (Google Places irgendwann → Roadmap) · Beitritt NICHT direkt:
Kontaktdaten des Gyms (eigener Bereich in der Verwaltung) + Knopf
„Probetraining vereinbaren / Anfrage stellen" · Gym erscheint, wenn die
Verwaltung es freischaltet, Schalter standardmäßig AN, greift erst mit
eingetragener Adresse (Datenschutz: Eintragen im klar als öffentlich
beschrifteten Bereich; Satz für AGB/Datenschutzerklärung nötig). Etappen:
1 ohne Gym = ohne Gym-Inhalte (ERLEDIGT) · 2 Kontakt & Standort in der
Verwaltung (Adresse, Telefon, E-Mail, Website, Pin auf der Karte, Schalter) ·
3 /gym-finden mit Liste + Karte (MapLibre + OpenFreeMap, kein Schlüssel),
PLZ/Ort über eingebaute PLZ-Tabelle (keine externe Anfrage),
Standort-Freigabe nur im Browser, Radius · 4 Anfrage „Probetraining
vereinbaren" (gyms/{gymId}/anfragen, eine offene je Konto und Gym,
Löschfrist, Verwaltung sieht Zahl auf der Mitglieder-Seite; kein Mailweg).

### Konto vs. Mitgliedschaft (Entscheidung 2026-09-01)
Zwei verschiedene Verhältnisse, die nie vermischt werden dürfen:
- **Das Konto gehört dem Menschen.** Darin liegen seine Workouts, sein
  Verlauf, sein Kampfprofil und der Weg in ein künftiges Gym. Ein Gym darf es
  weder löschen noch sperren: DSGVO Art. 17 (Löschung) ist ein RECHT der
  betroffenen Person, keine Befugnis Dritter, und eine Sperre schnitte sie von
  ihren eigenen Rechten nach Art. 15/17/20 ab.
- **Die Mitgliedschaft gehört dem Gym.** Es darf sie jederzeit beenden
  (`/api/members/remove`). Der Mensch behält alles, das GYM verliert den
  Zugriff.
- **Ein ausgetretenes Mitglied darf NICHT als Gegner weitergeführt werden.**
  Die Idee, das Kampfprofil eines Ehemaligen für späteres Scouting zu behalten,
  ist Zweckentfremdung (Art. 5 Abs. 1 lit. b) ohne Rechtsgrundlage nach Ende
  des Vertrags (Art. 6) — und technisch ausgeschlossen, weil das Profil an
  `users/{uid}` hängt und die Gym-Prüfung der Regeln nach dem Entfernen nicht
  mehr greift. Wer jemanden scouten will, legt ein normales
  `opponents/{id}`-Profil aus beobachtbarem Material an.
- **Zustand „kein Gym"**: `gymId`-Claim null → Athleten-Dashboard zeigt
  „Du gehörst gerade zu keinem Gym" plus Weg zu `/beitreten`. Denselben
  Zustand hat, wer sich ohne Einladung registriert.

### Gym meldet sich selbst an — Schritt 1a des Geschäftsplans (21.09.2026, Fenster tidal-athletics-f1)
Leons Antworten (wörtlich, 21.09.): Anmeldung „Eigene Seite ohne Login
(Empfohlen)" · Wartezustand: **„ich will das es automatisch erstellt wird
sobald der gym betreiber sich dafür anmeldet. dann soll er nach abschluss der
regestrierung die kostenlose version direkt nutzen können"** — damit ist die
Antwort vom 20.09. „Selbstanmeldung mit deiner Freigabe" überholt: KEINE
Freigabe, keine Warteliste · USt-IdNr. „Erst beim Kauf (Empfohlen)" ·
Stilllegen (20.09.) „lesen ja ändern nein".
- **`app/gym-anmelden/page.tsx` (öffentlich, JoinLayout, ohne Hülle):** ein
  Formular, zwei Wege — ohne Konto (Gym-Name, eigener Name, E-Mail,
  Passwort → `signUp` wie /register, dann die Route), mit Konto ohne
  gymId-Claim (nur der Gym-Name). Mit Konto UND Gym: kein Formular, nur der
  Weg zurück. Nach dem Anlegen `refreshRole()` (Token-Refresh, die Claims
  kommen vom Admin-SDK) → `/verwaltung`. Link „Du führst ein Gym?" auf
  /register. `/gym-anmelden` steht NICHT im Middleware-Matcher (öffentlich)
  und in `OHNE_HUELLE` (AppShell).
- **`POST /api/gyms/anmelden`** (Bearer): 401 ohne Token · **409, wenn das
  Konto schon einen gymId-Claim trägt** (ein Konto = ein Gym; wer keinen
  Claim hat, ist heute Default-Gym-Mitglied und verlässt es damit) · Name
  2–60 Zeichen · Kürzel `slugifyGym(name)`, vergeben (auch `tidal-athletics`)
  → `-2` … `-9`. Reihenfolge mit Rücknahme: (1) Gym-Dokument in einer
  Transaktion (`tx.create`, nur wenn frei) — `name, status: "active",
  createdAt, createdBy, branding: null, subscription: { status: "active",
  plan: "free", analysisQuota: FREIE_ANALYSEN (3), analysisUsed: 0,
  currentPeriodEnd: null }`; (2) Claims: `gymId` + `trainer` + `verwaltung`,
  bestehende gemergt (`claimsWithRights`) — scheitert das, wird das Gym
  gelöscht; (3) users-Spiegel (`gymId, gymJoinedAt, rightsMirror`);
  (4) Protokoll `gym.create` (neuer `AuditType`). `FREIE_ANALYSEN` und
  `GYM_GESPERRT_TEXT` wohnen in `lib/gym.ts` (Client UND Server lesen sie).
- **Stilllegen = lesen ja, ändern nein — SERVERSEITIG (1a):**
  `lib/server/gym-status.ts` — `antwortWennGesperrt(adminDb, gymId)` liest
  das Gym-Dokument (fail-open: Lesefehler = aktiv) und antwortet **423
  Locked** `{ error, gesperrt: true }`. Steht in analyze, preview, rahmen,
  commit, flag, wettkampf/gameplan, gameplan/scouting — direkt hinter der
  Rollenprüfung, VOR der Body-Prüfung
  (darum lässt es sich ohne Body und ohne Token-Kosten messen). Der Streifen
  `components/shell/GymGesperrtStreifen.tsx` steht in BEIDEN Hüllen
  (StaffShell unter dem Kopf, AppShell über dem Inhalt); `getGymInfo` in
  lib/gym.ts liefert Name + Zustand mit **5-Minuten-Cache** (vorher: Name
  für immer gecacht). `/admin`: Wort „Stilllegen"/„Wieder öffnen" je Zeile,
  Rückfrage als `role="alertdialog"`-Streifen, Client-`updateDoc` auf
  `gyms/{id}` (Regel erlaubt es dem Plattform-Admin), `statusChangedAt`.
  Pille sagt „Stillgelegt", nicht „Gesperrt".
- **STILLLEGEN TRIFFT NUR DEEPFIGHT (Leon 21.09.2026, wörtlich):** „ich
  denke erstmal lassen da man ja ein gym hauptsäschlich stilllegt wenn es
  seine beiträge nicht zahlt und die kostenlose version soll erstmal
  weiterhin frei verfügbar sein. wie es dann genau mit den deepfight themen
  aussieht und wie weit sie diese noch einsehen dürfen legen wir später
  fest." Daraus folgte am selben Tag: **`invites/create` und `members/role`
  sperren NICHT mehr** (Einladen und Rechte vergeben gehören zur kostenlosen
  Version), und **Schritt 1b ist zurückgestellt** — die Firestore-Regeln
  bleiben, wie sie sind. Offen und bewusst später: Wie viel seiner
  DeepFight-Daten ein stillgelegtes Gym noch sehen darf.
- **Gemessen:** tsc 0, eslint 0 (19 Dateien). Live
  `scripts/tmp-mess-gym-anmelden.mjs` (Wegwerf-Konto per Firebase-REST,
  Gym „Mess Gym F1" → `mess-gym-f1`, danach ALLES gelöscht): **19/19** —
  401/400/200, Gym-Felder, Claims, Spiegel, Protokoll, zweites Gym 409,
  stillgelegt → sechs Routen 423, wieder aktiv → 400 (Body fehlt) und
  Einladung 200. KEIN Screenshot (Dev-Server mit CSS 404, Falle 42).
- **Falle 44:** Ein Konto OHNE `gymId`-Claim gilt überall als Mitglied des
  Default-Gyms (`tidal-athletics`) — wer auf /register ohne Einladung ein
  Konto anlegt, landet in Leons Gym. `/api/gyms/anmelden` nimmt genau diese
  Konten und zieht sie in ihr eigenes Gym. **„Kein Claim“ ist NICHT „kein
  Gym“**; wer Guthaben oder Rechnungen je Gym rechnet, muss das wissen.
  **AUFGEHOBEN 30.09.2026:** Seit „KONTEN OHNE GYM" ist kein Claim = KEIN Gym,
  an allen drei Stellen; `/api/gyms/anmelden` prüft weiter nur den rohen Claim.
- **Falle 43:** `VerifiedUser.stored` IST schon ein `RoleSet` —
  `readRoleSet(user.stored)` scheitert am Typ (`ClaimLike` verlangt eine
  Index-Signatur). Einfach spreaden.

### DeepFight-Guthaben — Schritt 2 des Geschäftsplans (21.09.2026, Fenster tidal-athletics-45)
Leons Antworten (wörtlich, 21.09.): Vorlauf **„frei tagesbremse 60 stk. aber
das muss nicht extra irg. wo stehen es soll im hintergrund passieren"** ·
Tagesdeckel auf Analysen **„Kein Deckel für zahlende Gyms"** · leeres
Guthaben „egal es benutzt sowieso keiner die app grade" (Entscheidung damit
bei mir: Knopf „Analysen kaufen", der ab Schritt 3 auf die Werbeseite zeigt).
- **DAS GUTHABEN LIEGT ALS POSTEN, NICHT ALS ZAHL** —
  `gyms/{gymId}/guthaben/{postenId}`: `menge`, `verbraucht`, `grund`
  (gratis|paket|gutschrift), `erstelltAm`, `verfaelltAm` (**null** bei den
  drei geschenkten, sonst Kauf + 24 Monate). Grund: Leons Verfall vom 20.09.
  braucht ein Datum JE KAUF; eine einzelne Zahl kann nicht sagen, welche
  Analysen wann ablaufen. Verbraucht wird aus dem Posten, der ZUERST
  verfällt (`naechsterPosten`) — sonst liefe ein Paket ab, während das
  Geschenk unberührt danebenliegt. `subscription.analysisQuota/analysisUsed`
  sind DAFÜR GELÖSCHT worden (waren nie beschrieben).
- **Die drei geschenkten entstehen beim ersten Mal.** Solange am Gym kein
  `guthabenStart` steht, gilt das Geschenk als offen und wird in
  `standAusPosten(posten, gratisOffen)` mitgerechnet — Client und Server an
  derselben Stelle. Der Server legt den Posten in DERSELBEN Transaktion an,
  in der er die erste Analyse abzieht. Damit braucht kein Bestands-Gym eine
  Wanderung, und doppelt schenken kann sich niemand. `/api/gyms/anmelden`
  legt ihn für neue Gyms gleich mit an.
- **Die Schranke sitzt in `analyze` VOR Gemini** (Konzept §6, Zählung beim
  Start): `nimmEineAnalyse` in einer Transaktion, sonst **402** mit
  `guthabenLeer: true`. **Gezählt wird nur der Aufruf, der das VIDEO ansieht**
  — der Zwei-Phasen-Betrieb schickt zwei Requests, und der zweite bringt
  `body.observation` mit; würde er auch zählen, kostete jede Analyse zwei.
  Ein Fehler im Stream gibt sie zurück (`gibAnalyseZurueck`), auch wenn
  Gemini schon geantwortet hat.
- **FAIL-CLOSED**, anders als beim Stilllegen: Lässt sich das Guthaben nicht
  lesen, startet keine Analyse. Ein Lesefehler darf hier nicht Geld kosten.
  Die Vorlauf-Bremse dagegen ist fail-open — sie ist eine Bequemlichkeit,
  kein Kassenhäuschen.
- **Vorlauf-Bremse:** 60 je Gym und Tag (deutsche Zeit, `tagSchluessel`),
  gezählt am Gym-Dokument in `vorlaufTag: { tag, anzahl }`, greift in
  `preview` UND `rahmen` → **429**. KEINE Anzeige in der Oberfläche (Leons
  Auflage). 60 Vorläufe ≈ 60 Cent.
- **Oberfläche:** `components/deepfight/Guthaben.tsx` (`useGuthaben` +
  `GuthabenZeile`) steht im Upload-Fluss über dem Analysieren-Knopf — „Noch 3
  von 3 Analysen", bei 0 der Streifen mit dem Knopf „Analysen kaufen" (heute
  ein Hinweis, ab Schritt 3 die Werbeseite). `handleAnalysieren` bremst
  schon vor dem Weg zum Server, wenn weniger übrig ist als Personen
  ausgewählt sind. Die Verwaltung bekam die Karte „DeepFight-Analysen"
  (Stand + Nutzung je Trainer aus `guthabenNutzung/{uid}`).
- **Regeln (NEU, Deploy nötig):** `gyms/{gymId}/guthaben/{postenId}` —
  lesen Trainer/Verwaltung des Gyms, **`allow write: if false`** (dasselbe
  Muster wie bei den Einladungen: Wer sein Guthaben selbst schreiben darf,
  schreibt sich tausend Analysen). `guthabenNutzung/{uid}` — lesen nur die
  Verwaltung. Ohne Deploy zeigt die Oberfläche die Zahl NICHT (der Lesefehler
  wird geschluckt), der Server rechnet trotzdem richtig.
- **Gemessen:** tsc 0, eslint 0 (eigene Dateien).
  `scripts/tmp-mess-guthaben.mjs` **23/24** — der eine Fehlschlag ist die
  Regel, die noch nicht deployt ist (Trainer liest → 403 statt 200). Sonst
  alles grün: Anmeldung schenkt drei, Trainer schreibt sich 9999 → 403,
  Athlet liest → 403, vierte Analyse abgelehnt, 402 ohne einen Gemini-Token,
  Fortsetzung mit Beobachtung zählt nicht, toter `fileUri` → genommen UND
  zurückgegeben, Vorlauf 61 → 429, Verfall 21.09.2028, Paket vor Geschenk.
  Die Messung kostet fast nichts, weil jeder Weg vor dem Modell endet.
  `scripts/tmp-mess-gym-anmelden.mjs` (Schritt 1a) auf den neuen Stand
  gezogen: **20/20**.
- **Falle 46 — EINE ANALYSE SIND ZWEI REQUESTS.** Der Zwei-Phasen-Betrieb
  ruft `/analyze` erst mit `observeOnly` (Gemini sieht das Video), dann noch
  einmal mit `body.observation` (Claude bewertet). Wer beim Zählen nicht auf
  `!body.observation` prüft, zieht jedem Gym doppelt ab.
- **Falle 47:** Firestore-Transaktionen verlangen **alle Lesevorgänge vor dem
  ersten Schreiben**. `gibAnalyseZurueck` liest Posten UND Nutzungs-Dokument
  in einem `Promise.all`, bevor es irgendetwas anfasst; `nimmEineAnalyse`
  liest Gym-Dokument und Posten-Sammlung gemeinsam.
- **Falle 45:** `mess-gameplan.mjs` wartet nach `goto(/library)` nur 2000 ms.
  Auf dem Dev-Server reicht das manchmal nicht — dann meldet die letzte
  Prüfung „← null, 0 px hoch“. Mit 6 s steht der Rückweg in beiden Themes
  (44 px, „Techniken“), nachgemessen 21.09. Kein Produktfehler.
- **Falle 48:** Ein Python-Heredoc über die Bash mit deutschen
  Anführungszeichen im Quelltext wird als cp1252 gelesen — aus einem
  schließenden „“ wird ein echtes `"`, und die Zeichenkette bricht ab.
  Solche Skripte mit dem Write-Werkzeug als UTF-8-Datei schreiben.

### ADMIN-KONTEN SIND REIN ADMIN (Leon 21.09.2026, Fenster tidal-athletics-45)
Leon wörtlich: **„beachte das ein admin konto nur admin sachen machen soll.
also ein admin konto soll kein gym angehören, ich richte wenn nötig einen
zweiten zugang ein aber alle admins sollen rein admin sein. der aktuelle admin
acc soll entsprechend umgebaut werden."** Damit ist die Ghost-Regel vom
03.09. („Admins sind Ghosts") vom Anzeigefilter zur ECHTEN Trennung geworden:
`isGhostAccount()` versteckte den Admin in Listen, während er technisch
weiter ein vollwertiger Trainer des Gyms war.
- **`effectiveRights` rechnet den Rang NICHT MEHR EIN** (lib/roles.ts). Bis
  zum 21.09. galt `trainer: stored.trainer || stored.admin` — ein Admin war
  damit überall Trainer UND Verwaltung, ohne ein einziges Häkchen. Jetzt ist
  die Funktion die Identität. EINE Zeile, die 28 `isTrainerOrAdmin`-Aufrufe,
  die Middleware und jede Navigationsleiste mitzieht.
- **`canManageGym` hat den `isAdmin`-Kurzschluss verloren** — einladen und
  Rechte vergeben sind Gym-Sachen. Folge: `/api/invites/create` nimmt kein
  fremdes `body.gymId` mehr an (die Abzweigung war danach tot).
- **KEIN_GYM statt Default-Gym** (lib/gym.ts): Ein Konto mit Plattform-Rang
  und ohne `gymId`-Claim gehört zu KEINEM Gym und bekommt `"__kein-gym__"`.
  Ohne diese Zeile wäre jeder Admin nach dem Umbau stillschweigend wieder
  Mitglied von Tidal Athletics (**Falle 44**). Dieselbe Zeichenkette steht in
  `firestore.rules` (`userGymId()`) und in `lib/server/verify-user.ts`.
  **Warum ein Kürzel und nicht `null`:** über siebzig Lesestellen, fast alle
  als Abfrage-Filter — ein `null` hätte jede davon zu einer Fallunter-
  scheidung gemacht; ein Kürzel, auf das kein Gym passt, beantwortet dieselbe
  Frage von selbst. `getGymInfo(KEIN_GYM)` gibt ohne Lesevorgang
  „Plattform" zurück — das steht in der Hülle, wo sonst der Gym-Name stünde.
- **DER BLICK BLEIBT.** Leon am 21.09. gefragt („Rollen weg, Blick bleibt"
  oder „auch der Blick weg") und entschieden: **„Rollen weg, Blick bleibt"**.
  `isAdmin()` steht in `firestore.rules` weiter an 26 Stellen vor jeder
  Gym-Prüfung. Der Betreiber-Zugriff gehört deshalb in die
  Datenschutzhinweise und in den AVV — dort steht er richtig, in einer
  Kollegen-Liste stünde er falsch (Backlog „vor der ersten Zahlung fällig").
- **DAS GYM BRAUCHTE ERST EINE VERWALTUNG.** Nachgemessen am 21.09.: In
  `tidal-athletics` hatte **NIEMAND** den `verwaltung`-Claim — der Admin
  deckte das ab, weil der Rang es mitbrachte. Ohne Gegenmaßnahme hätte nach
  dem Umbau niemand mehr einladen oder Rechte vergeben können, auch kein
  Admin. Leons Wahl: **noelreichle@gmail.com** (sein zweites Konto „Leon",
  bisher Trainer) bekommt `verwaltung`.
- **Die Wanderung: `scripts/migrate-admin-ohne-gym.mjs`** (committet, kein
  Wegwerf-Skript). Ohne `SCHREIBEN=1` zeigt sie nur, was sie täte. Sie
  nimmt jedem Admin `gymId`, `trainer` und `verwaltung` aus den Claims und
  die Gym-Felder aus dem users-Dokument, setzt die Verwaltung auf das
  benannte Konto, zieht BEIDEN die Tokens zurück (sonst gilt die Änderung
  erst nach bis zu einer Stunde — beide müssen sich neu anmelden) und
  prüft am Ende, ob jedes Gym noch eine Verwaltung hat. `role: "admin"`
  bleibt stehen: Die Regeln lesen ihn als Migrationspfad.
- **Gemessen** (`scripts/tmp-mess-admin-ohne-gym.mjs`, Wegwerf-Konten, ohne
  einen KI-Token): Admin lädt ein → 403 · vergibt Rechte → 403 · startet
  Vorlauf → 403 · startet Analyse → 403 · /trainer → /dashboard ·
  /verwaltung → /dashboard · /admin offen · die Hülle sagt „Plattform".

### STILLLEGEN: BEZAHLT IST BEZAHLT (Leon 21.09.2026)
Auf die Frage, was mit dem Restguthaben eines stillgelegten Gyms passiert,
das 60 Analysen gekauft und 10 verbraucht hat: **„Sie dürfen sie
aufbrauchen."** Damit ist Stilllegen kein Schalter mehr, sondern eine
Rechnung.
- **`deepfightZustand(db, gymId)`** (lib/server/gym-status.ts) liefert
  `{ gesperrt, bezahltRest, zu }`. **Zu** ist DeepFight nur, wenn das Gym
  stillgelegt ist UND kein bezahltes Guthaben mehr hat. `bezahlt` heißt
  `grund === "paket"` — das Geschenk und eine Gutschrift zählen NICHT: Wer
  nie gezahlt hat, hat auch nichts gut.
- **Ein Lesevorgang im Alltag.** Die Guthaben-Sammlung wird nur gelesen, wenn
  das Gym wirklich stillgelegt ist. `analyze` holt den Zustand EINMAL und
  gibt ihn als `nurBezahlt` an `nimmEineAnalyse` weiter — kein zweiter Griff.
- **`nimmEineAnalyse(…, nurBezahlt)`**: Im stillgelegten Zustand kommen nur
  gekaufte Posten in Frage, und das Geschenk entsteht auch nicht mehr.
  Gemessen: stillgelegt → die Analyse geht aus dem Paket (1/5), das Geschenk
  bleibt bei 0/3; Paket leer → wieder zu, auch über die Hintertür kein
  Zugriff aufs Geschenk; wieder geöffnet → die nächste geht aus dem Geschenk.
- **`antwortWennGesperrt` heißt jetzt `antwortWennDeepFightZu`** (sieben
  Routen). Der alte Name wurde mit der Bedeutung falsch: stillgelegt ist
  nicht mehr dasselbe wie zu.
- **Der Streifen sagt zwei Sätze.** `GYM_GESPERRT_TEXT` war nach dem
  21.09. schlicht falsch („Ihr könnt nichts ändern") — Kursplan, Mitglieder
  und Pläne laufen längst weiter. Neu: ohne bezahlten Rest der schlichte
  Satz, mit Rest `GYM_GESPERRT_MIT_GUTHABEN(n)` samt Zahl. Ein ATHLET darf
  die Guthaben-Sammlung nicht lesen (Regel: nur Trainer und Verwaltung) —
  er bekommt den schlichten Satz. Richtig so: Er startet ohnehin keine
  Analyse.
- **Falle 49:** In `lib/server/gym-status.ts` darf **kein `next/server`**
  stehen. Der Ladeweg der Messskripte (`scripts/lib/ts-loader.mjs`) kann es
  nicht auflösen — mit dem Import lässt sich diese Logik nicht mehr direkt
  prüfen. `Response.json` aus dem Web-Standard tut dasselbe, und eine Route
  darf sie genauso zurückgeben.

### SCHRITT 3: DAS DEEPFIGHT-ABO (21.09.2026, Fenster tidal-athletics-dd)
Leon hat am 21.09. spät im Fenster f1 das Modell umgestellt: **„wie kann man
das geschäftsmodel auf eine monatlich wiederkehrende summe umbauen ich finde
das als die beste optoin"** — Stufen, Sammeln und Laufzeit stehen im Konzept
§6. Die Pakete vom 20.09. leben nur als Nachkauf weiter. Leons Antworten in
DIESEM Fenster (wörtlich): Wer baut „Ja, hier als Abo bauen (Empfohlen)" ·
Ort „Eigene Seite (Empfohlen)" · Stufenwahl „Drei Karten nebeneinander
(Empfohlen)" · Preis „Netto groß, brutto klein (Empfohlen)" · Wer kauft „Nur
die Verwaltung (Empfohlen)" · Mit Guthaben „Stand oben, Nachkauf darunter
(Empfohlen)" · Frist „Nach 14 Tagen (Empfohlen)" · Nachkauf „10 Analysen für
35 € (Empfohlen)" · Stripe-Konto „Nein, noch keins" · Steuer „Noch kein
Gewerbe" · Rechnung „Stripe schreibt sie (Empfohlen)" · Push „Noch nicht".
- **EINE Rechenstelle: `lib/abo.ts`** — `ABO_STUFEN` (Team 15/49 €, Gym
  40/99 €, Saison 100/219 €; Jahr = zehn Monatspreise), `ABO_VORWAHL`,
  `NACHKAUF`, **`STEUERMODUS: "regel" | "klein"` — die EINE Zeile, die Leon
  umstellt, sobald das Gewerbe steht** ("klein" = § 19 UStG: keine USt., der
  Nettopreis ist der Endpreis, Fußzeile auf jeder Rechnung), `ZAHLUNGSFRIST_TAGE
  = 14`, `preisSchluessel()` (der Betrag steht im Stripe-`lookup_key` — ein
  neuer Preis in dieser Datei legt in Stripe einen neuen Preis an, laufende
  Abos behalten ihren), `aboLage()` (keins / aktiv / zahlung-offen /
  gekuendigt), `decodeGymAbo()`.
- **NIEMAND LEGT IN STRIPE VON HAND PRODUKTE AN.** `lib/server/stripe.ts`
  legt Produkte (feste IDs `tidal_deepfight_{stufe}`), Preise (per
  `lookup_key`), den Steuersatz 19 % (Metadaten `tidal: "ust19"`) und die
  Portal-Konfiguration (Marke mit den Preisen darin) beim ersten Bedarf an
  und merkt sich die IDs im Modul. EIN Stripe-Kunde je Gym
  (`subscription.stripeCustomerId`), nicht je Person.
- **Routen** (alle nur Verwaltung des eigenen Gyms, `verwaltungDesGyms` in
  `lib/server/abo.ts`; 401/403; ein Admin ohne Gym fällt durch):
  `POST /api/abo/kaufen` (`art: "abo"` mit Stufe + Intervall, oder
  `"nachkauf"`; 423 stillgelegt, 409 schon ein Abo / Nachkauf ohne Abo /
  Zahlung offen, 400 `feld: "ustId"`, 503 Prüfstelle stumm oder Stripe nicht
  eingerichtet) → `{ url }` der Stripe-Kasse · `POST /api/abo/portal` →
  Kundenportal (Karte, Rechnungen, Stufenwechsel OHNE Anteil — gilt ab der
  nächsten Abrechnung, Kündigung zum Ende) · `GET /api/abo/rechnungen` (holt
  die PDF-Links bei JEDEM Aufruf frisch, Falle 56).
- **`POST /api/stripe/webhook` IST DIE EINZIGE STELLE, AN DER GEKAUFTE
  ANALYSEN ENTSTEHEN.** Unterschrift zuerst (400 ohne/mit falscher), roher
  Body. `invoice.paid` → je Abo-Zeile ein Posten `grund: "abo"` über die
  Analysen der Stufe, im Jahresabo ZWÖLF, jeder mit `abAm` = sein Monat
  (Leon: „Analysen kommen trotzdem monatlich"); anteilige Zeilen bringen
  nichts. `checkout.session.completed` (bezahlt, `art: "nachkauf"`) → ein
  Posten `grund: "paket"` über 10. **Posten-IDs aus Stripe**
  (`abo_{rechnung}_{zeile}_{monat}`, `kauf_{sitzung}`) — eine doppelte
  Lieferung scheitert am vorhandenen Dokument (`schreibeGutschriften`, Batch
  mit `create`, ALREADY_EXISTS = schon erledigt). `customer.subscription.*`
  spiegelt Stufe, Intervall, Zustand, `currentPeriodEnd`, `kuendigtZum` ans
  Gym; beendet → `plan: "free"`, der Kunde bleibt.
- **Die Frist (14 Tage):** `invoice.payment_failed` merkt sich den ersten Tag
  (`zahlungOffenSeit`); kommt nach 14 Tagen noch eine geplatzte Zahlung,
  beendet der Webhook das Abo selbst (`subscriptions.cancel`). Eine neue
  Gutschrift gibt es ohnehin nur mit bezahlter Rechnung, und alles schon
  Bezahlte bleibt nutzbar — `istBezahlt` zählt `abo` UND `paket`.
- **`lib/guthaben.ts`:** neuer Grund `abo`, neues Feld `abAm` (ein Posten
  zählt erst ab diesem Tag), `naechsteGutschrift` im Stand. Verfall = `abAm`
  + 24 Monate — jeder Monat läuft seine eigene Frist.
- **USt-IdNr. (`lib/server/ust-id.ts`)**, erst beim Kauf, optional: DE nur
  Format (prüft keiner für uns), EU-Ausland per **BZSt** (`EIGENE_UST_ID`
  gesetzt) oder **VIES** (sonst) → Reverse Charge: keine Steuersätze,
  `tax_exempt: "reverse"`, Fußzeile. Der Beleg (Nummer, Quelle, Kennung,
  Zeitpunkt) liegt am Gym unter `rechnung`. Kleinunternehmer-Modus: nur
  Format.
- **Seite `/trainer/deepfight/abo`** (im DeepFight-Layout, Segment
  „DeepFight" mit Rückpfeil): ohne Abo Stand → Werbung (Fight-DNA-Titel,
  drei Punkte, Helix mit Beispieldaten) → Umschalter monatlich/jährlich →
  drei Karten (`<label>` um ein verstecktes Radio, Gym vorgewählt) → Kasse;
  mit Abo Stand + „Abo verwalten" → Nachkauf → Rechnungen. Wer nicht
  Verwaltung ist, sieht den Satz, wer bucht. Nach `?kauf=ok` fragt die Seite
  bis zu 40 s nach, bis der Webhook geschrieben hat. **Middleware-Ausnahme:**
  eine reine Verwaltung ohne Trainer-Häkchen darf GENAU diese Seite öffnen.
- **Einstiege:** „Analysen holen" im leeren Guthaben-Streifen des
  Upload-Flusses (vorher ein Hinweis), die ruhige Zeile „Noch N Analysen ·
  DeepFight-Abo →" über dem Archiv der Landung (`GuthabenEinstieg`), „Abo und
  Rechnungen" in der Verwaltungs-Karte. Protokoll: `abo.start`, `abo.ende`,
  `guthaben.kauf` (lib/audit.ts kennt jetzt auch `gym.create` — stand vorher
  als „Notiz einer Einladung geändert" in der Liste).
- **WAS LEON IN STRIPE EINRICHTEN MUSS, bevor jemand kaufen kann:** Konto
  anlegen · `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Vercel (und
  lokal in `.env.local`) · Webhook-Endpunkt
  `https://tidal-athletics.vercel.app/api/stripe/webhook` mit
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`,
  `.updated`, `.deleted` · Firmendaten + eigene USt-IdNr. für die Rechnung ·
  Mahnwesen: Wiederholungen über 2 Wochen, danach Abo kündigen, Mails an
  den Kunden an · `EIGENE_UST_ID` in Vercel, sobald es sie gibt ·
  `STEUERMODUS` in lib/abo.ts. **Rechtlich vor dem ersten Verkauf:** AGB
  (inkl. 24-Monats-Frist mit sachlichem Grund, § 307 BGB), Impressum,
  Datenschutzhinweise + AVV (samt Betreiber-Zugriff „Blick bleibt").
- **Gemessen OHNE Stripe-Konto** (`scripts/tmp-mess-abo.mjs`, Wegwerf, mit
  einer Stripe-ATTRAPPE auf Port 12111 und selbst unterschriebenen Webhooks,
  0 € KI): **62/62** in sechs Läufen (dunkel und hell mit Bildern), dazu
  `mess-gameplan.mjs` **117/117 dunkel, 117/117 hell**, tsc 0 — Türen
  zu, Trainer 403, reine Verwaltung sieht nur die Abo-Seite, Kasse im
  Abo-Modus mit 99 € + 19 %, Kunde je Gym, USt-IdNr. normalisiert, IE-Nummer
  per VIES → Reverse Charge, alte Nummer ersetzt, erste Rechnung → 40,
  doppelt → 1 Posten, Verfall 21.09.2028, Nachkauf 10 (doppelt → 1),
  unbezahlt → nichts, Jahr → 12 Posten, heute zählt nur der erste,
  anteilig → nichts, Portal einmal angelegt, Rechnungen, offene Zahlung →
  Frist → nach 15 Tagen gekündigt, beendet → `free`, bezahlt bleibt 150,
  stillgelegt → 423. Querüberlauf 0 px auf 1440 und 390, keine
  Konsolenfehler. Umschalten auf echte Testschlüssel: die drei
  STRIPE-Zeilen in `.env.local` ersetzen, `STRIPE_API_HOST` WEGLASSEN.
- **Falle 52:** Der Dev-Server merkt sich Stripe-IDs im MODUL. Eine
  Attrappe, die bei jedem Lauf leer startet, kennt die IDs des vorigen
  Laufs nicht → der zweite Lauf scheitert an sich selbst. Die Attrappe
  sichert ihren Stand deshalb im Temp-Ordner (`tidal-stripe-attrappe.json`);
  wer ihn löscht, stößt vorher eine Neukompilierung an (`touch
  lib/server/stripe.ts`).
- **Falle 53:** `inert` als JSX-Attribut warnt unter React 18 in der
  Konsole („non-boolean attribute"). Per Ref setzen, wie in FightDnaEntry.
- **Falle 54:** Seit der Stripe-API-Fassung 2025 trägt eine Rechnungszeile
  nur die Preis-ID (`pricing.price_details.price`), das Abo-Kennzeichen steht
  unter `invoice.parent.subscription_details` (samt Metadaten des Abos) —
  ältere Anleitungen mit `line.price` und `invoice.subscription` greifen ins
  Leere.
- **Falle 55:** Die BZSt-Prüfung verlangt die EIGENE deutsche USt-IdNr.
  (`evatr-0002` ohne); die alte XML-RPC-Schnittstelle ist seit dem
  30.11.2025 abgeschaltet. VIES meldet Fehler mit HTTP **200** und
  `actionSucceed: false`; Griechenland heißt **EL**.
- **Falle 56:** Stripes `invoice_pdf`-Links laufen nach spätestens 120 Tagen
  ab — nie speichern, immer frisch holen.
- **Falle 57:** `npx eslint .` läuft auch durch `backup/` (dort liegen die
  alten Fehler ein zweites Mal). Für die Zählung `--ignore-pattern
  "backup/**"`: außerhalb sind es SECHS Alt-Fehler (CourseLoadChart 2×,
  lib/beep.ts 3×, lib/extensions/technique-progress.ts 1×) — am 24.09.
  SIEBEN, weil ein Parallelfenster `updateDoc` in `technique-progress.ts`
  ungenutzt stehen ließ.

### DIE ABO-SEITE ALS VERKAUFSSEITE — UND DIE STIMME (22.–24.09.2026, Fenster tidal-athletics-3f, committet 49c6fc1 · 14bf146 · f7891c3)
Leon: „baue die Abo anzeige so ca" (Vorlage pricing-section-3, shadcn) ·
„lösche anzeigen wie was eine analyse kostet je paket" · „die ganze seite
sollte mehr nach verkauf und anreiz schaffen ausgelegt sein … eins zwei
bilder … ein handy das zwei kämpfer aufnimmt … die deepfight DNA und die
passende auswertung". Seine Antworten: Abzeichen „„Empfohlen" (Empfohlen)"
(NIE „Beliebt" — niemand hat gekauft) · Werbung „Behalten, Karten darunter"
· Knöpfe „In jeder Karte (Empfohlen)".
- **`components/deepfight/AboWerbung.tsx`**: Handy im Querformat
  (`public/library-stack/coach-pads.jpg`, CSS-Gehäuse `.abo-phone`, Rahmen
  „Dein Athlet"), drei Schritte, Helix neben drei Befunden WÖRTLICH aus
  `DEMO_FIGHT_PROFILE`, Block „Gegner-Scouting". Kein `next/image` (wie
  JoinBackdrop). **`AboKarten.tsx`**: drei Karten auf einer Bühne, Gym
  größer (nur ab md — sonst läuft sie auf 390 über den Rand) mit Akzentrahmen
  UND Wort „Empfohlen", Kaufknopf je Karte, Laufzeit-Schalter mit gleitender
  Kapsel (misst `offsetLeft`/`offsetWidth`, Übergang erst nach dem ersten
  Messen), Preise rollen über `components/motion/RollZahl`
  (`@number-flow/react`, prüft Reduced Motion) und `WortReveal` — beide in
  der Bewegungs-Schicht, die Seite fasst keine Bibliothek an. `IMMER_DABEI`
  / `EXTRAS`: die Staffel aus Konzept §6 (Branding, 10/15/15, Nachkauf
  35/30/25) war bis zum 24.09. NICHT gebaut → `EXTRAS` leer. Seit dem
  24.09. greifen Videolänge, Branding und Nachkaufpreis — die Punkte stehen
  jetzt drin (siehe nächster Abschnitt). Die Hilfe-Leiter bleibt draußen:
  Sie ist ein Versprechen, kein Code.
- **Die Texte sind Leons.** „Überzeug dich selbst mit 3 gratis Analysen." ·
  „Designt für maximale Performance." (Adidas-Partizip) · Scouting-Absatz mit
  **748** charakteristischen Parametern (2 × 374 Analysepunkte je Video,
  Zählung eines Parallelfensters 24.09.; Leon schrieb „über 750", die Quelle
  gezeigt — bei Katalogänderung neu zählen). **„Athlet", nie „Fighter"** für
  die eigenen Leute (Leon 23.09.). „du", nie „ihr" — außer in Leons eigenen
  Sätzen („eurem Gegner", „ihr erhaltet"). 67 Fragen (nicht 60:
  `DNA_CATEGORIES`).
- **Der Skill `.claude/skills/tidal-stimme/` ist die Quelle der Stimme** —
  vor jedem sichtbaren Satz laden. Darin: zwölf abgelehnte Vorschlagsrunden
  wörtlich mit Leons Grund („zu künstlich, holt mich als Kunden nicht ab",
  „gewollt aber nicht gekonnt"), seine angenommenen Sätze, die belegten
  Muster aus McFit, Snocks, N26, Nike, Adidas (`references/vorbilder.md`,
  vier Agenten-Läufe). Kern: Slogan-Poesie und Zweitakt-Formeln mit Dreh sind
  bei Leon IMMER falsch; der Mangel gehört nie dem Leser; echte Inhalte
  schlagen jeden Spruch; Bilder der Seite statt Vorschlagslisten. `.gitignore`
  nimmt `.claude/skills/` deshalb von `/.claude/*` aus.
- **lib/guthaben.ts `ersterTag()`:** Abo-Posten und Nachkauf vom selben Tag
  laufen am selben Tag ab — der Hinweis nannte nur den ersten („40 laufen
  ab", wo es 50 sind). Jetzt Summe aller Posten des frühesten Tages.
- **Falle 58:** `items-start` auf der Hero-Spalte lässt `FightDnaHeading` auf
  Minimalbreite schrumpfen — auf 390 px steht der Titel Buchstabe für
  Buchstabe untereinander. **Falle 59:** `npm install <paket>` entfernt
  Playwright (`--no-save`) — danach `npm install --no-save playwright@1.62.1`.
  **Falle 60:** `page.screenshot({ fullPage })` hängt feste Leisten und den
  Hintergrund mitten ins Bild; `tmp-mess-abo.mjs` setzt das Fenster jetzt auf
  Seitenhöhe. **Falle 61:** ein offenes Bild in der Windows-Fotoanzeige
  sperrt die Datei — Kopien unter neuem Namen (`final3-*`).
- Gemessen: 62/62 dunkel und hell (acht Läufe), tsc 0, eslint 0, Querüberlauf
  0 px auf 1440 und 390. KI-Kosten 0 € (Agenten-Recherche ohne Modellaufrufe
  der App). Bilder `D:\Tidal-Athletics\abnahme-schritt3\final3-*.png`.

### DIE ABO-SEITE ALS KONZERN-VERKAUFSSEITE (24.09.2026, Fenster tidal-athletics-9f)
Leon: „die seite http://localhost:3001/trainer/deepfight/abo muss viel
schöner gestaltett werden … schau auf den seiten [McFit, N26, Nike, Adidas,
Snocks] nach wie die es machen, texte bilder aufbau … dass wir uns wie ein
großer konzern präsentieren." Ein Agent las die fünf Seiten (HTML + CSS,
Adidas nur als Archivkopie) und lieferte das Rezept; die Seite folgt ihm.
- **Das Rezept:** Poster-Hero (Foto, Text drauf, EIN dominanter Knopf) →
  Beweisband mit vier Kennzahlen → Dreier-Kacheln „So läuft's" → Karten
  (Preis 48 px wie McFit, eine hervorgehoben) → Feature-Matrix (N26) →
  dunkles Statement-Band → FAQ-Akkordeon → Schluss-Band mit DEMSELBEN
  Knopf-Wortlaut wie im Hero („Jetzt durchstarten"). Sektionsabstand
  96–128 px (`gap-12 md:gap-16`, nur ohne Abo).
- **Bausteine:** `AboWerbung.tsx` (Hero `.abo-hero` mit Metall-Überschrift,
  Leons Zeile, Nutzensatz, Handy rechts, Kennzahlen-`<dl>`: 748 / 67 / 3 /
  24 — jede aus dem Code: `2 × 374`, `DNA_TOTAL_QUESTIONS`, Gratis-Start,
  Verfall; Schritte 01–03 mit Ziffern-Outline; Ergebnis-Band mit Helix und
  drei Befunden; Scouting als `.abo-band--dunkel` mit `.abo-foto` und der
  748 auf dem Foto) · `AboVergleich.tsx` (Zeilen aus `ABO_STUFEN.leistungen`,
  Gym-Spalte `data-empfohlen`, mobil waagerecht scrollbar, erste Spalte
  sticky) · `AboFragen.tsx` (sieben Fragen, `Collapse`, jede Antwort eine
  Tatsache aus diesem Abschnitt und „SCHRITT 3") · `AboSchluss.tsx` („Lad
  dein erstes Sparring hoch.") · `Etage` (Label + Kernzeile + Nutzensatz,
  exportiert aus AboWerbung, auch über den Karten: „Wähl deine Stufe.").
  Der Stand-Satz („Überzeug dich selbst mit 3 gratis Analysen.") steht jetzt
  IM Hero; `data-abo-stand` bleibt für die Messung.
- **Poster-Farben sind FEST** (`--poster-cyan: #00c7ce`, `--poster-ink`):
  Das helle Theme dreht `--accent` auf dunkles Teal — auf einem dunklen Foto
  unsichtbar. Gleiches für die Metall-Töne im Hero (dunkle Fassung erzwungen)
  und den Handy-Rahmen. Ein Poster sieht in beiden Themes gleich aus.
- **Falle 65:** `.df-entry-heading` ist ein eigener Container; `cqi` misst
  seine SPALTE, nicht die Seite — in der Hero-Spalte landete die Überschrift
  am Minimum. `container-type: normal` im Hero, dann darf sie umbrechen.
- **Falle 66:** ALLE 52 Fotos in `public/join-stack` sind 320×427 px
  (Pexels-Thumbnails, keine IDs in `docs/join-stack-herkunft.md`) — auf
  1000 px gezogen unscharf. Poster-Fotos liegen in `public/abo/` mit
  Herkunft in `docs/abo-bilder-herkunft.md`; `library-stack` hat 800–1200 px.
- **Falle 67:** `DNA_CATEGORIES.length` ist 9 (Kategorien), die Fragen zählt
  `DNA_TOTAL_QUESTIONS` (67). Stand kurz mit „9" auf der Seite.
- **Falle 68:** Zwei 6-KB-Heredocs in EINEM Bash-Aufruf brechen mit
  „unexpected EOF" — getrennt in den Scratchpad schreiben, per node einfügen.
- **VOLLBILD (Leon 25.09.2026: „es sieht immer so aus als wäre alles in
  Rahmen mit runden Ecken … die Verkaufsseite soll eine Vollbild-Seite
  werden"):** Kein Abschnitt trägt mehr Rahmen, Rundung oder Schatten. Jeder
  Abschnitt ist ein Band über die volle Breite der Inhaltsspalte (`<main>` der
  Stab-Hülle hat keinen Seitenabstand, nur der Kopf), der Inhalt steht in
  `.abo-spalte` (72 rem, zentriert, 16/24 px Rand). Bänder wechseln den Grund
  wie McFit: Foto → durchsichtig (Synthesis scheint durch) → `--flaeche`
  (surface-card) → `--dunkel` → durchsichtig → Fläche → durchsichtig → Foto.
  Hero `min-height: min(82vh, 860px)`, Bandhöhe `clamp(56px, 7vw, 112px)`.
  Karten stehen ohne Bühne direkt auf dem Band (`.abo-karte` mit eigener
  Fläche), Tabelle und Fragen nur mit Linien, USt-Block mit Linie oben
  (`.abo-recht`). Die Regeln stehen als eigener Block „VOLLBILD" NACH den
  Karten-Regeln und überschreiben sie. **Falle 69:** `.abo-band__inhalt` und
  `.abo-hero__inhalt` setzen `padding` — das schlug den Seitenrand der
  `.abo-spalte` (Hero und Scouting standen 24 px weiter links); deshalb
  `.abo-spalte.abo-…` mit eigenem `padding-inline`. Bilder
  `abnahme-abo-neu/final2-vollbild-*.png`.
- **Leons Runde 26.09.2026:** Der Hero beginnt DIREKT unter dem Kopfbalken
  — der Kopf hält nach unten `--shell-gap × 4`, genau das holt
  `.abo-vollbild > div:first-child > .abo-hero:first-child` ab `lg` mit
  negativem Rand zurück; nur bei `header + .staff-content` (kein
  Stillgelegt-Streifen) und ohne Kassen-Streifen davor, sonst schöbe sich
  der Hero darüber. Schritt 1 ohne Minutenzahl („Handyvideo vom Mattenrand,
  direkt aus der App." — Team hat 10, die Längen stehen in Karten, Tabelle
  und FAQ). Nachkaufpreise NUR noch in Karten und Tabelle; die FAQ sagt
  „Dann kaufst du 10 Analysen nach." (Leons Einwand „lädt zum Rechnen ein").
  `public/abo/gegner.jpg` ist jetzt Pexels 2216610 (Blick in die Kamera) —
  das Nike-Logo auf der Hose liegt bei ~72 % der Bildhöhe, der Ausschnitt
  endet bei 42 %: Es ist nicht in der Datei, nicht nur verdeckt. Das
  Messskript erwartet den Nachkauf der Stufe Gym (3000).
- Bilder `D:\Tidal-Athletics\abnahme-abo-neu\`, Hilfsskript
  `scripts/tmp-blick-abo.mjs` (Wegwerf: `auf` legt Gym `blick-abo-gym` an,
  `bild <name> [breite] [theme] [jahr] [selector]`, `zu` räumt auf).

### DIE STUFEN-STAFFEL GEBAUT — WAS AUSSER DER MENGE TRENNT (24.09.2026, Fenster tidal-athletics-7a)
Leon am 22.09.: Branding „Gym + Saison" · Videolänge „10 / 15 / 15 min" ·
Nachkauf 35 / 30 / 25 €. Bis zum 24.09. prüfte **keine einzige Zeile**
`subscription.plan` — er war reine Anzeige. Jetzt entscheidet er.
- **`lib/abo.ts` ist die eine Quelle**: `AboLeistungen` (`videoMinuten`,
  `branding`, `nachkaufNetto`) hängt an jeder Stufe; `leistungenFuer(plan)`,
  `videoSekunden(plan)`, `nachkaufNetto(plan)`, `VIDEO_SEKUNDEN_MAX`.
  **Der Gratis-Tarif erbt Team** — wer nichts zahlt, bekommt nie mehr als die
  Stufe für 49 €. `NACHKAUF` trägt nur noch die MENGE; der Preis kommt aus
  `leistungen`, und `nachkaufSchluessel(stufe)` gibt jeder Stufe einen eigenen
  Stripe-Preis (der Betrag steht im Schlüssel, die drei Beträge trennen sie).
- **`lib/server/gym-status.ts`**: `stufeDesGyms()` (`null` = nicht lesbar,
  NICHT „gratis") und `videoSekundenFuerGym()`. **FAIL-OPEN wie beim
  Stilllegen**: Lesefehler → Obergrenze. Ein zahlendes Gym wegen eines
  Lesefehlers auf zehn Minuten zu kürzen wäre die teurere Falschaussage.
- **Die Länge prüft nur der Aufruf MIT Video** (Falle 46: eine Analyse sind
  zwei Requests). In `analyze/route.ts` steht deshalb
  `body.observation ? null : await videoSekundenFuerGym(…)` — die zweite
  Runde kostet keinen zusätzlichen Lesevorgang. `MAX_VIDEO_SECONDS` in
  `lib/video-analysis.ts` ist ab jetzt NUR die Obergrenze aller Stufen.
- **Das Branding-Kit**: `/verwaltung/branding` (Menüpunkt „Marke", steht für
  JEDE Verwaltung da — ohne die Stufe erklärt die Seite, was das Kit bringt;
  ein Punkt, der je nach Tarif verschwindet, verkauft nichts). Geschrieben
  wird über **`POST /api/gym/branding`** mit Admin-SDK und Stufenprüfung
  (402 `stufeFehlt`). Der Browser versteckt den Schreiber nur zusätzlich.
- **Die Farbe sind ZWEI ZAHLEN** (`branding.akzentH`, `akzentC`, OKLCH) —
  `components/GymBrandingTokens.tsx` setzt sie als `--accent-h`/`--accent-c`
  ans `<html>`, alles Weitere rechnet das Token-System ab (globals.css Kopf).
  Die Bereichsfarben bleiben: `[data-area="verwaltung"]` deklariert auf einem
  TIEFEREN Element und gewinnt für seinen Teilbaum. `lib/farbe.ts` rechnet
  zwischen Hex (Farbwähler) und OKLCH um (Ottosson-Matrizen, Hin- und
  Rückweg auf dem Byte genau geprüft). Die **Helligkeit gehört dem Theme**
  (dunkel 0,78, hell 0,50), deshalb speichert das Gym seinen FARBTON, nie
  einen Farbwert.
- **DIE STUFE ENTSCHEIDET BEI JEDEM LESEN, nicht das Gespeicherte.** Wechselt
  ein Gym von Gym auf Team, trägt die App wieder den Tidal-Look — sonst wäre
  das Kit ein Schalter, den man einmal für einen Monat kauft und für immer
  behalt. Gelöscht wird nichts; beim Aufstieg steht die Farbe wieder da. Das
  gilt an BEIDEN Lesewegen: `GymBrandingTokens` und
  `/api/invites/preview` (dort sieht sie ein Gast ohne Konto).
- **Das Logo steht als Data-URL im Gym-Dokument**, nicht in einem Speicher.
  Der Browser rechnet es vor dem Senden auf 320 × 96 px und WebP herunter —
  5–20 KB statt Megabyte. Dafür: kein zweiter Dienst, keine CORS-Regeln,
  keine verwaisten Dateien, keine tote Adresse. Grenze **96 KB**, geprüft auf
  BEIDEN Seiten; erlaubt sind `data:image/png|jpeg|webp|svg+xml` und
  `https:`. Wird es einmal größer gebraucht (Druck, eigene App), wandert es
  in einen Speicher — das Feld bleibt eine Adresse, der Leseweg `<img src>`
  unverändert.
- **Messung `scripts/mess-stufen.mjs`** — 36/36 dunkel und hell, **0 €
  KI-Kosten**. Eigenes Prüf-Gym `mess-stufen-gym` (am echten Gym wäre das ein
  Eingriff in Leons Daten), am Ende gelöscht.
- **Falle 62 — EIN GYM OHNE GUTHABEN GIBT ES NICHT VON SELBST.**
  `nimmEineAnalyse` legt die drei Gratis-Analysen an, sobald `guthabenStart`
  am Gym fehlt. Eine Messung, die auf 402 „kein Guthaben" baut, bekommt sonst
  **200** — und der Stream ruft Gemini. Also `guthabenStart` setzen UND den
  Unterordner `guthaben/` leeren: **Unterordner überleben das Löschen ihres
  Dokuments**, ein Posten aus einem früheren Lauf reicht.
- **Falle 63:** Die Abo-Karten stehen NUR vor dem ersten Abo (`lage ===
  "keins"`). Wer für den Schirm eine Stufe setzt, sieht sie nicht mehr.
- **Falle 64:** Die Karten blenden beim Scrollen ein. Ein `fullPage`-Bild
  fängt sie ungesehen und damit LEER (verwandt mit Falle 60) —
  `scrollIntoViewIfNeeded()`, warten, dann den sichtbaren Ausschnitt nehmen
  und mit `isVisible()` gegenprüfen.

### KURSPLAN JE GYM — KURS BEKOMMT TRAINER (26.09.2026, Fenster nach 26-09)
Leon: „wir sollten uns mal an die verwaltungsebene machen", Wahl aus der
Bestandsaufnahme: „Kurs bekommt Trainer". **Befund vorher:** Die Kurse waren
`TRAINING_BLOCKS` in `lib/schedule.ts`, EINE Woche für ALLE Gyms. Jedes
selbst angemeldete Gym sah Leons Wing-Tsung-Plan als seinen eigenen. Leons
Entscheidungen: **Weg 2** (Kursplan je Gym statt Trainer-Feld an der
Konstante), **mindestens ein Trainer, mehrere erlaubt**, **nur Verwaltung**
legt an — „ein trainer der auch in der verwaltung ist darf natürlich über
die verwaltungsebene kurse bearbeiten" (geprüft wird das Häkchen).
- **Daten:** `gyms/{gymId}/schedulePlans/{planId}` = `{ name, aktiv: true,
  kurse: TrainingBlock[], geaendertAm, geaendertVon }`. EIN Dokument mit
  Liste (ein Lesevorgang für die ganze Woche); gelesen wird der Plan mit
  `aktiv == true` — so kommt das Mehrplan-Modell (Konzept §7, „später")
  nur dazu. `TrainingBlock.trainerUids` ist neu. Rubrik folgt aus der
  Kampfart (`rubrikAusKampfart`, lib/kursplan.ts).
- **Lesen:** `useKursplan()` aus `lib/kursplan-context.tsx` (Provider im
  Root-Layout, EIN onSnapshot für die App). Alle Helfer in `lib/schedule.ts`
  bekommen die Kurse als erstes Argument. `TRAINING_BLOCKS` gibt es nicht
  mehr — die alte Woche heißt `KURSPLAN_VORLAGE_TIDAL`
  (`lib/kursplan-vorlage.ts`) und ist NUR für die Übernahme und den
  Demo-Seeder da. **Nie wieder eine gym-übergreifende Kursliste im Code.**
- **Schreiben:** nur `POST /api/gym/kurse` (`anlegen` / `aendern` /
  `loeschen`), Admin-SDK, `verwaltungDesGyms`, Transaktion (zwei
  Verwaltungen überschreiben sich nicht). Jede Trainer-uid muss
  `gymId == gymId` UND `readRoleSet(...).trainer` tragen. Neue Kurse bekommen
  ZUFÄLLIGE IDs — `trainingSessions` und Kurs-Abos tragen die ID ohne gymId.
  Regel: `schedulePlans` lesen Mitglieder des Gyms, `write: if false`.
- **Oberfläche:** `/verwaltung/wochenplan` („Wochenplan" in der Verwaltung,
  Leon 27.09.: statt „Kursplan"; Raster aus `components/schedule/WochenRaster`
  wie der Kursplan, je Tag „+ Kurs"; die Liste `/verwaltung/kurse` vom
  26.09. ist darin aufgegangen), Sheet
  `components/KursSheet.tsx`. Kurse ohne gültigen Trainer (leer, ausgetreten,
  Häkchen weg) zählt ein Hinweis oben, jede Zeile sagt „Trainer zuweisen".
  Der Kursplan (`/schedule`) zeigt bei leerem Plan „Leg deinen ersten Kurs
  an." (Verwaltung, mit Knopf) bzw. „Hier steht bald deine Trainingswoche."
- **Übernahme:** `scripts/kursplan-uebernehmen.mjs` (Probe ohne,
  `--schreiben` mit) — am 26.09. ausgeführt: `gyms/tidal-athletics/
  schedulePlans/FXcyG9LIh82uW1hxsTIg`, 24 Kurse, DIESELBEN IDs, noch ohne
  Trainer. Regeln am 26.09. deployt (Leon: „Ja, beides").
- **Nebenbefund:** `trainingSessions` sind weiter nicht gym-gescopet;
  Abdeckung und Dashboards zählen jetzt nur IDs aus dem eigenen Plan
  (`getSessionBlockIdsForWeek`).
- **Falle 70:** Git Bash schreibt `/verwaltung/kurse` als Argument in
  `C:/Program Files/Git/verwaltung/kurse` um → `MSYS_NO_PATHCONV=1`.
  **Falle 71:** Ein per REST angelegtes Testkonto hat kein `createdAt`;
  `listAllMembers` sortiert danach und lässt es AUS (Firestore-orderBy).
  Echte Registrierungen setzen es (lib/user-profile.ts).
- Gemessen: `scripts/tmp-mess-kurse.mjs` 23/23 (Route + deployte Regeln),
  `scripts/tmp-blick-kurse.mjs ablauf` 9/9 (Anlegen per UI, live in Liste
  und Kursplan, Löschen mit Rückfrage), tsc 0, eslint 0 in allen berührten
  Dateien, Querüberlauf 0 px auf 1440 und 390. Bilder
  `D:\Tidal-Athletics\abnahme-kurse\`. `mess-gameplan.mjs` (27.09.): hell
  117/117, dunkel 116/117 — der eine Befund ist „← Techniken" auf /library
  bei 390 px: Die Prüfung wartet fest 2 s, der Link braucht auf dem
  Dev-Server 1,1–2,1 s (nachgemessen, 44 px, steht korrekt). Gegenprobe auf
  dem committeten Stand per `git stash`: 117/117.
- **Falle 72:** `mess-gameplan.mjs` spricht ohne `BASE` mit Port 3000 — dort
  lief am 26./27.09. ein zweiter, hängender Next-Prozess (`fetch failed`,
  Timeouts). Immer `BASE=http://localhost:3001`. Ohne `OUT` landen ~50
  `mess-*.png` im App-Ordner → `OUT=../abnahme-…`.
- **RÄUME (Leon 27.09.2026: „bedenke das es gyms gibt die verschiedene räume
  haben"):** `raeume: { id, name }[]` am Plan-Dokument, `TrainingBlock.raumId`
  am Kurs. Leons Antworten: Räume pflegt man IM WOCHENPLAN (Knopf „Räume",
  `components/RaeumeSheet.tsx`) · gleicher Raum zur selben Zeit = **NUR
  WARNEN** (Speichern geht, z. B. geteilte Matte) · den Raum sehen ALLE, auch
  Athleten im Kursplan. Ab ZWEI Räumen: Raumwahl im Kurs-Sheet, Raum an jedem
  Kurs (Wochenplan und /schedule), Filter „Alle Räume · … · Ohne Raum" im
  Wochenplan; mit einem Raum gibt es nichts zu wählen. `ueberschneidungen()`
  (lib/kursplan.ts) warnt bei Raum UND bei Trainer, der zur selben Zeit
  schon einen Kurs gibt. Route: `raum-anlegen` / `raum-umbenennen` /
  `raum-loeschen` (Namen eindeutig ohne Groß/klein, höchstens 20 Räume);
  gelöschter Raum → Kurse bleiben, nur ohne Raum. Das Wochenraster teilen
  Kursplan und Wochenplan über `components/schedule/WochenRaster.tsx`
  (`DayColumn` mit `zusatz` und `fuss`).
- Gemessen nach Wochenplan und Räumen (27.09.): `tmp-mess-kurse.mjs` 35/35,
  `tmp-blick-kurse.mjs ablauf` 16/16 (Filter, Warnung, Raum im Kursplan,
  Räume-Sheet), `mess-gameplan.mjs` **117/117 hell und dunkel**, tsc 0,
  eslint 0. **Fund 27.09.:** noelreichle@ hat im ECHTEN Plan von Tidal
  Athletics einen Kurs „TEST" angelegt (Mi 17:01–19:30) — nicht angefasst.
- **EIN KURS, MEHRERE TERMINE (Leon 27.09.2026: „bedenke auch das ein kurs
  an mehreren Tagen passieren kann … für mehrere tage und dann noch für
  unterschiedliche zeiten. finde eine user freundliche lösung die nicht
  verwirrend ist"):** Gespeichert bleibt die Woche als TERMINE (ein
  `TrainingBlock` je Tag + Uhrzeit — Abos, Rückmeldungen, Freigaben hängen
  an deren IDs). Ein KURS ist die Gruppe aller Termine mit demselben NAMEN
  (die Regel galt schon seit 03.09. für Filter und Plan-Zuordnung):
  `kurseGruppieren`, `kursMitTerminenPruefen`, `termineKurz` in
  lib/kursplan.ts. Im Sheet oben Name, Kampfart, Gruppe, Trainer (gelten für
  den ganzen Kurs), darunter „Termine" — je Zeile Tag, Beginn, Ende, ab zwei
  Räumen der Raum; „+ Termin" übernimmt Uhrzeit und Raum des letzten, am
  nächsten Tag. Ein Tipp auf IRGENDEINEN Termin im Wochenplan öffnet den
  ganzen Kurs. Route: `kurs-speichern` ({ alterTitel, kurs }) ersetzt alle
  Termine des Kurses in einer Transaktion, mitgeschickte `id` bleibt
  erhalten, neue Termine bekommen zufällige IDs; `kurs-loeschen` ({ titel })
  nimmt alle Termine. Ein Name, den schon ein ANDERER Kurs trägt, wird
  abgelehnt („Öffne ihn und füg dort einen Termin hinzu.") — Sheet prüft
  vorab, Server noch einmal. Die alten Einzel-Aktionen
  `anlegen`/`aendern`/`loeschen` gibt es nicht mehr. Der Hinweis oben zählt
  KURSE ohne Trainer (Leons Gym: 18 Kurse · 24 Termine). Gemessen:
  `tmp-mess-kurse.mjs` 42/42, `tmp-blick-kurse.mjs ablauf` 18/18 (zweimal
  frisch hintereinander; ein Lauf davor scheiterte am 2,5-s-Warten nach
  dem Löschen), `mess-gameplan.mjs` hell 117/117, dunkel 116/117 (die
  bekannte /library-Zeitfrage, s. o.).
- **TAGE ANTIPPEN, UHRZEIT JE TAG (Leon 27.09.2026, zweite Runde):** „wenn
  ich auf tag klicke möchte ich mehrere auswählen und wenn ich dann auf dem
  kurs an jeweiligen tag bin ändere ich für dort die uhrzeit". Im Sheet
  heißen die Blöcke jetzt „Tage" (Mo–So als Knöpfe, mehrere auf einmal; ein
  neuer Tag übernimmt Uhrzeit und Raum des zuletzt gewählten) und „Uhrzeit"
  (je Tag eine Zeile, ab zwei Räumen darunter der Raum; „+ Uhrzeit" gibt
  einem Tag eine zweite Stunde, z. B. MMA Teens Mi 16:00 + 17:15).
  **Uhrzeit = `components/ui/TimePicker.tsx`**: EIN Feld „18:30", das ein
  Fenster mit zwei Spalten öffnet (Std | Min), die gewählten Werte
  HINTERLEGT, kein Haken (Leon: „nur einen bereich zum klicken … std und min
  zsm … hinterlegt und nicht ein haken"); 24 h, Minuten in 5er-Schritten
  (gespeicherte andere Minute bleibt wählbar), Minute schließt das Fenster,
  Escape schließt nur das Fenster. Leons Vorlage war ein shadcn-„time-picker"
  (Radix, cva, motion/react, `--hu-*`) — NICHT installiert: kein shadcn,
  Tailwind 3, Select-Standard und MOTION-BRIEF; nachgebaut mit `Pop`.
  `Select` hat seither `ariaLabel`. Raumfilter im Wochenplan: Knöpfe 44 px
  hoch, 14 px Schrift, gewählter mit Akzent-Rand (Leon: „mach den
  ausgewählten raum größer … das ganze feld dazu"). Fehlertexte nennen den
  Tag („Freitag: Der Kurs endet nach seinem Beginn."), ohne Tag „Wähl
  mindestens einen Tag.", doppelter Name „… Öffne ihn und tipp dort den Tag
  dazu." Gemessen: `tmp-mess-kurse.mjs` 42/42, `tmp-blick-kurse.mjs ablauf`
  22/22, 0 Konsolenfehler. **Die große Regression (`mess-gameplan.mjs`) lief
  nach TimePicker und Raumknöpfen NICHT mehr** — Leon hat den Lauf
  abgebrochen; vor dem Commit nachholen.
- **MEHRERE WOCHENPLÄNE, GENAU EINER AKTIV (Leon 27.09.2026 abends):** „in
  der verwaltungsebene mehrere wochenpläne für ferien etc. bauen kann aber
  immer nur einen aktiviere. den aktivierten sehen dann trainer und athleten
  … es muss aber immer ein plan aktiv sein also soll ich nicht pausieren
  jedoch bei allen plänen aktivieren klicken können so das ich pro plan nur
  einen button habe". Leons Antworten: **Duplikat behält die Termin-IDs**
  (Abos, Rückmeldungen, Freigaben laufen weiter; IDs sind je PLAN eindeutig,
  nicht je Gym) · **„aktiv ab (Datum)" gleich mitbauen**.
  - **Oberfläche** `/verwaltung/wochenplan`: Leiste „Wochenpläne", je Plan
    Name + Unterzeile (Kurse, „Aktiv ab 14. Juli") und GENAU EIN Knopf
    „Aktivieren" bzw. „Aktiv" (gefüllt, `disabled`). Tipp auf den Namen
    zeigt den Plan im Raster (Rahmen = gewählt, getrennt von aktiv).
    Darunter Name des gewählten Plans + „Bearbeiten" (`components/
    PlanSheet.tsx`: Name, „Automatisch aktivieren" als `<input
    type="date">`, Löschen; beim aktiven Plan gesperrt mit Satz). „Neuer
    Plan" = PlanSheet mit Vorlage (Standard: gewählter Plan, „Leer starten"
    als Ausnahme). Nicht aktiver Plan gewählt → Hinweis „Deine Trainer und
    Athleten sehen gerade „…"".
  - **Lesen:** Trainer/Athleten weiter `useKursplan` (aktiv == true). Die
    Verwaltung: `useWochenplaene(gymId, an)` in `lib/wochenplaene.ts` (alle
    Pläne, live). KursSheet und RaeumeSheet lesen NICHT mehr useKursplan,
    sondern bekommen den gewählten Plan als Props.
  - **Route** `/api/gym/kurse`: `kurs-speichern`/`kurs-loeschen` brauchen
    `planId` (nur ein Gym OHNE Plan darf sie weglassen → erster Plan,
    aktiv). Neu: `plan-anlegen` ({name, vorlagePlanId, aktivAb}),
    `plan-aendern` ({planId, name, aktivAb}), `plan-loeschen` (aktiver → 400),
    `plan-aktivieren` (alle anderen `aktiv:false` in DERSELBEN Transaktion).
    Jede Aktion liest ALLE Pläne des Gyms in der Transaktion
    (`lib/server/wochenplan.ts`: `plaeneLesenTx` · `wechselAnwenden` ·
    `plaeneSchreibenTx`). **Räume gehören dem Gym:** `raum-*` ändern alle
    Pläne zugleich. Höchstens `PLAENE_MAX` = 12.
  - **GRUNDPLAN UND ZEITRAUM (Leon 27.09. abends: „pläne auch für einen
    gewissen zeitraum auswählen … nichts passieren kann das einen fehler im
    ablauf hervor ruft"; ersetzt das einmalige `aktivAb` vom Nachmittag):**
    Felder `grundplan`, `zeitraumVon`, `zeitraumBis` (deutsche Kalendertage,
    beide eingeschlossen, `tagSchluessel()` aus lib/guthaben.ts). GENAU EIN
    Grundplan = der zuletzt aktivierte; er gilt, wenn kein Zeitraum läuft,
    trägt nie einen Zeitraum, ist nicht löschbar. Ein anderer Plan mit
    Von–Bis gilt nur darin; nur Von = „ab dann dauerhaft", er wird an dem
    Tag Grundplan. **Aktiv ist eine RECHNUNG, kein Ereignis:**
    `planStandRechnen(plaene, heute)` (lib/kursplan.ts) — 1. abgelaufene
    Zeiträume weg, 2. erreichter Start ohne Ende → Grundplan (jüngster),
    3. sonst Grundplan-Feld, Altbestand: aktiver ohne laufenden Zeitraum,
    sonst erster, 4. aktiv = laufender Zeitraum, sonst Grundplan.
    Idempotent: zweimal rechnen ändert nichts, ein verpasster Tag wird beim
    nächsten Rechnen richtig. `zeitraumPruefen` lehnt ab: Überschneidung
    (beide Tage zählen), zwei Starts ohne Ende am selben Tag, Beginn vor
    heute (außer ein LAUFENDER Zeitraum behält seinen Beginn), Ende vor
    Beginn/vor heute, länger als 365 Tage, mehr als 2 Jahre voraus,
    Zeitraum am Grundplan. „Aktivieren" = Plan wird Grundplan, ein LAUFENDER
    Zeitraum eines anderen endet, künftige bleiben. `plan-loeschen` lehnt
    aktiv UND Grundplan ab. Die Route rechnet am Anfang (nachholen) und am
    Ende (Zeitraum ab heute gilt sofort). Oberfläche: Karte „Grundplan" /
    „Grundplan, wieder ab …" / „7. Oktober – 17. Oktober" / „bis 17.
    Oktober" / „ab …"; PlanSheet „Zeitraum" mit Von + „Bis (optional)",
    beim Grundplan statt Feldern ein Satz; beim laufenden ist Von gesperrt.
  - **NACHFOLGEPLAN + KALENDER (Leon 27.09. spät: „wenn ich ein enddatum
    setze soll ein neues feld auftauchen mit nachfolge plan. auserdem nutze
    für einen zeitraum diesen kalender version, überprüe aber ob sich da
    etwas eigeschlichen hat"):** Feld `nachfolgerId` (null = zurück zum
    Grundplan, nur mit `zeitraumBis`). Am Tag nach dem Ende wird der
    Nachfolger GRUNDPLAN (Schritt 1 in `planStandRechnen`, jüngster Wechsel
    gewinnt). Regeln (`zeitraumPruefen`): nie der Plan selbst, nur ein Plan
    OHNE eigenen Zeitraum, Grundplan-Wahl = null, ein Plan, der Nachfolger
    ist, bekommt keinen Zeitraum, an keinem Tag zwei Grundplan-Wechsel;
    `plan-loeschen` lehnt einen Nachfolger ab; ein fehlender/kaputter
    Nachfolger fällt still auf den Grundplan zurück. PlanSheet „Zeitraum":
    drei Knöpfe „Kein Zeitraum · Ab einem Tag · Von – Bis", darunter der
    Kalender; erst MIT Ende erscheint „Danach gilt" (Select: „X
    (Grundplan)" + Pläne ohne Zeitraum). Tage anderer Zeiträume sind im
    Kalender GESPERRT (durchgestrichen), eine Überschneidung lässt sich gar
    nicht antippen; beim laufenden Zeitraum nur „Letzter Tag". Karten:
    „7. Oktober – 17. Oktober, danach „Y“" / „ab 18. Oktober nach „X“".
    **Kalender = `components/ui/Kalender.tsx`** (`Kalender`,
    `ZeitraumKalender`) auf `react-aria-components` 1.21.1 +
    `@internationalized/date` 3.12.4 (exakt gepinnt, Adobe, Registry
    geprüft; „heute geändert" war nur der nightly-Tag). Aus Leons Vorlage
    `calendar-rac.tsx` (Origin UI) entfernt, was sich eingeschlichen hatte:
    shadcn-Farbklassen (`bg-primary`, `bg-accent` = hier Volltürkis,
    `text-muted-foreground` … — existieren hier nicht, Tailwind lässt sie
    STILL weg), `bg-red-100` fest, `ChevronLeftIcon size strokeWidth` aus
    @radix-ui/react-icons (Props gibt es dort nicht → Typfehler; Paket NICHT
    installiert, stattdessen Icon-Registry `chevron-left/-right` neu), `cn`
    aus `@/lib/utils` (fehlt, kein shadcn), „heute" in Geräte-Zeitzone
    (jetzt `Europe/Berlin`), Sprache des Browsers (jetzt `I18nProvider
    de-DE`), 36-px-Zellen (jetzt 44), Demo mit Außenlink. Kein Schadcode.
    Aussehen per CSS in globals.css, Abschnitt KALENDER (`.kal-*`, Zustände
    als data-Attribute von react-aria). Zellen tragen `data-datum`
    (Messskripte). **Falle 74:** `npm install` brach an ENOTEMPTY ab
    (Dateisperre) und hinterließ react-aria OHNE package.json — danach
    `npm install` erneut und Versionen aus `node_modules/*/package.json`
    prüfen. **Falle 75:** In `String.replace` ist `$\`` „alles vor der
    Fundstelle" — ein Template mit `${x}$\`` im Ersatztext verdoppelt die
    Datei. Ersatz als Funktion übergeben.
    Gemessen: `tmp-mess-zeitraum.mjs` **449/449** (Nachfolger Tag für Tag,
    Lauf alle 1/4/30 Tage), `tmp-mess-kurse.mjs` **101/101** (Abschnitt 5
    Nachfolger), `tmp-blick-kurse.mjs ablauf` **49/49** (1 Konsoleneintrag =
    die absichtliche 400 beim Nachfolger-Löschen).
  - **Drei Wege rechnen den Stand** (`standAbgleichen`, lib/server/
    wochenplan.ts, liest erst ohne Transaktion, schreibt nur bei
    Abweichung): (1) **Nacht-Job** `GET /api/cron/wochenplan`, `vercel.json`
    `15 23 * * *` UTC (= 00:xx Winter / 01:xx Sommer), nur mit
    `Authorization: Bearer $CRON_SECRET` — ohne CRON_SECRET 503. (2) **Täglicher
    Abgleich** `POST /api/gym/wochenplan-stand` (jedes Mitglied, eigener
    Gym): `KursplanProvider` ruft ihn einmal am Tag je Gerät
    (localStorage `ta-wochenplan-abgleich-{gymId}`, in try/catch) — das
    Sicherheitsnetz, falls der Job nicht läuft. (3) jede Verwaltungs-Aktion.
    Lokal steht ein `CRON_SECRET` in `.env.local` (27.09.); **in Vercel
    fehlt es noch**. Beweis der Rechnung: `scripts/tmp-mess-zeitraum.mjs`
    **432/432** (Tag für Tag über 4 Monate, täglich vs. nur jede 5. Nacht
    vs. Monate ohne Lauf — immer derselbe Plan, genau 1 aktiv, genau 1
    Grundplan).
  - **Regel (DEPLOYT 27.09., Leon „Ja, deployen"):** `schedulePlans` lesen
    `canManageGymId(gymId) || (userGymId() == gymId && resource.data.aktiv
    == true)`, `write: if false`.
  - Nach Grundplan/Zeitraum: `tmp-mess-kurse.mjs` **91/91** (Abschnitt 4:
    Zeitraum ab heute gilt sofort, Grundplan-Löschen 400, Zeitraum am
    Grundplan 400, Überschneidung 400, laufenden kürzen, abgelaufener
    Zeitraum → Abgleich durch einen ATHLETEN schaltet zurück, zweiter
    Abgleich ändert nichts, Aktivieren beendet laufenden Zeitraum und lässt
    künftigen stehen), `tmp-blick-kurse.mjs ablauf` **43/43**.
  - Gemessen vorher: `tmp-mess-kurse.mjs` **72/72** (Duplikat mit IDs, Kurs-Aktion
    trifft nur ihren Plan, Räume in allen Plänen, zwei Aktivierungen
    zugleich → genau einer aktiv, aktiven löschen → 400, aktiv ab heute →
    400, Nachholen bei der nächsten Aktion, Nacht-Job schaltet und lässt
    Tidal in Ruhe, Athlet liest inaktiven Plan 403 / listet alle 403,
    Verwaltung 200), `tmp-blick-kurse.mjs ablauf` **34/34** (duplizieren,
    im Ferienplan löschen, aktivieren, /schedule zeigt den neuen Plan,
    zurück, löschen), 0 Konsolenfehler, Querüberlauf 0 px auf 1440 und 390.
    Bilder `D:\Tidal-Athletics\abnahme-kurse\wp-*.png`.
  - **Falle 73:** `mess-gameplan.mjs` braucht `--experimental-transform-types
    --import ./scripts/lib/ts-loader-register.mjs`, sonst
    `ERR_MODULE_NOT_FOUND '@/lib'`.
- **RAUMFILTER ALS GOO-AUSWAHL (Leon 27.09.2026):** „die nichtausgewählten
  alle in einem rahmen … hoover … größer und markanter, klicke ich darauf
  animiert es schön ähnlich wie bei der suchleiste und der neue ausgewählte
  text steht in seiner separaten box". Baustein
  `components/motion/GooAuswahl.tsx` (Export aus components/motion): alle
  Optionen in EINER Reihe mit festem key, die gewählte vorn (17 px, 48 px,
  Akzent), die übrigen klein (13 px) auf einem gemessenen Rahmen, der mit
  derselben Feder gleitet; Goo-Filter der Suchleiste nur während des
  Wechsels; mobil steht die Wahl in eigener Zeile (sonst läge der
  umbrechende Rahmen hinter der Box). **Falle 73:** Ein `setState` im
  `useLayoutEffect` (Rahmen messen) rendert sofort ein zweites Mal —
  framer-motion misst die Knöpfe dann schon am Ziel, und die
  `layout`-Animation läuft von Ziel zu Ziel, also GAR NICHT (gemessen:
  transform blieb `none`). Rahmen und Filter laufen deshalb über
  `useMotionValue` + `animate()` und direkt am DOM-Element. **Falle 74:**
  Knöpfe in einen ANDEREN Eltern-Container umhängen (Box ↔ Rahmen) baut sie
  neu, `layoutId` fand die alte Lage nicht — die Wahl sprang. **Falle 75:**
  Animation per Screenshot messen täuscht (eine Aufnahme dauert 100–250 ms);
  `page.clock.install()` + `runFor(ms)` hält die Uhr an.
- **Offen danach:** Trainer-Auslastung im Verwaltungs-Dashboard (Backlog b,
  Kapazitätsplanung, kein Ranking) · „Kampfart über den Kurs" (Roadmap P3
  Schritt 14) · Trainer im Kursplan der Athleten anzeigen · Leons 22 Kurse
  ohne Trainer zuweisen (macht er selbst unter /verwaltung/wochenplan, sobald
  gepusht).

### WOCHENPLAN NEU GESTALTET (28.09.2026, Entwurf B)

Leon: „besser verständlich … organischer, intuitiver … alles gleich groß, die
Überschrift Wochenplan doppelt, zu viele einzelne Rahmen". Drei Entwürfe
gebaut, **Leon wählte B**; die Seite `app/verwaltung/wochenplan/page.tsx` ist
jetzt B, die Teile liegen in `components/wochenplan/`:
- `useWochenplanDaten.tsx` — ALLE Logik (Pläne, Trainer, Räume, offene Kurse,
  Aktivieren, Hinweis-Sätze, Sheets); die Seite ist nur Aussehen.
- Seite: Pläne links als Liste (Punkt = gilt jetzt, atmet), Planname groß als
  einziger Titel, **„Aktivieren" beim angesehenen Plan** (`components/ui/
  HakenKnopf` — Star-Button-Vorlage nachgebaut: heller Rand, Hover Haken ×15,
  Klick hellblau; „Gilt jetzt" in derselben Füllung). Umschalter **Kalender |
  Zeilen** (localStorage `ta-wochenplan-ansicht`). Kalender: Uhrzeit-Achse
  96 px/h, Stunden ohne Kurs ab zwei gefaltet; Überschneidung: Beginn ≤ 30 min
  auseinander = NEBENEINANDER, später hinein = 40 % eingerückt darüber.
  Zeilen: `WocheZeilen.tsx` (ein Tag je Zeile, Kapseln auf quer liegender
  Achse, Überschneidung = eigene Spur, Bahn 16 px hinter dem Tagesnamen).
- Fehlendes = **oranges Dreieck** (`--dreieck`, eigene Farbe — `--warning` ist
  gelb); „N Kurse ohne Trainer" ist ein Schalter, der den Rest dimmt.
- `PlusZeiger.tsx`: Plus in `--accent` NEBEN dem Zeiger über freien Stellen
  (nicht ersetzen — Leon), rAF, kein Filter (drop-shadow ruckelte).
- Heutiger Tag ohne Fläche (Leon), nur der Name in Akzentfarbe.
- **GooAuswahl** (Raumfilter, `components/motion`): Box + Hals + Rahmen als EIN
  SVG-Pfad mit EINEM Strich (vorher drei Teile → Doppelnähte, „unterschiedliche
  Strichstärken"), Kanten auf x,5; Hals = lange S-Kurven (ABSTAND 44), Blau voll
  bis zur Mitte der Engstelle; kein Goo-Filter mehr (fraß 1-px-Kanten); Namen
  kreuzen sich nicht (neuer gleitet von rechts, Breite nur vom neuen Namen);
  Hover = feine Akzentlinie statt Kasten. FALLE: framer 12.40 AnimatePresence
  liest `props.ref` → React-18-Warnung — Optionen per `data-goo-option` messen.
- Export PDF/PNG/JPG: Fenster 3e (`WochenplanExport`, `WochenplanDruck`,
  `lib/wochenplan-export.ts`, html-to-image 1.11.13 + jspdf 4.2.1), Knopf
  „Herunterladen" RECHTS UNTER der Woche (`data-export-knopf`).
- **Zweite Runde (Leon 28.09. abends):** „Planen" neben „Aktivieren"
  (`data-plan-planen`, nicht beim Grundplan) — `PlanSheet` hat drei Aufgaben:
  `neu` (Name + Vorlage, KEIN Zeitraum mehr), `plan` (Name, Löschen — Stift),
  `planen` (Zeitraum + Nachfolger). Räume-Knopf rechts weg → Schichten-Zeichen
  mit Plus am ENDE des Raumfilters (`GooAuswahl` Prop `ende`, `data-goo-zusatz`,
  am Handy ausgeblendet und als „Räume · n" darunter; ohne Filter allein mit
  Wort). „Kurs anlegen" (voll) neben Kalender | Zeilen. Leerer Plan: Achse faltet
  ohne Kurse nicht (volle leere Woche 16–21 Uhr). Test 50/50.
- Test: `BASE=http://localhost:3000 node --use-system-ca scripts/tmp-blick-kurse.mjs
  auf|ablauf|zu` — 49/49 (Plan-Liste auf B umgestellt, Zahlen aus der Kopie,
  weil Leons Plan sich ändert). Bilderserien von Animationen:
  `scripts/tmp-blick-entwurf.mjs` mit `FILM="Raum 2"`.

### Route-Schutz (zweischichtig)
- **Drei Bereiche, drei Rechte, GETRENNTE Adressen** (seit Checkpoint 3):
  `/admin/*` = Plattform-Rang · `/trainer/*` = Trainer-Werkzeuge ·
  `/verwaltung/*` = Gym-Verwaltung. Bis dahin lagen die Verwaltungs-Seiten
  UNTER `/trainer` und brauchten in jedem Türsteher eine Ausnahme — eine
  reine Verwaltung kam durch die Middleware und flog eine Zehntelsekunde
  später clientseitig auf `/dashboard`. Getrennte Adressen brauchen keine
  Ausnahme. **Neue Verwaltungs-Seiten gehören unter `/verwaltung`**, dann
  greifen Middleware und `VerwaltungRoute` automatisch.
- **Server:** `middleware.ts` (Edge) verifiziert das `__session`-Cookie
  **kryptografisch** (jose/RS256 gegen Googles Firebase-Zertifikate, Issuer +
  Audience = Projekt) und gated per Rollen-Set: `/admin/*` (sonst 404,
  Existenz verbergen), `/verwaltung/*` und `/trainer/*` (sonst Redirect
  `/dashboard`), übrige geschützte Bereiche → Redirect `/login`. Bewusster
  Fail-Open NUR wenn Googles Zertifikat-Endpoint nicht erreichbar ist
  (unverifizierter exp-Check statt Aussperrung — Datensicherheit liegt bei
  den Firestore-Regeln); ungültige Signaturen werden IMMER abgewiesen.
  Not-Aus via `MIDDLEWARE_AUTH=off`.
- **Client:** `<ProtectedRoute>` (allgemein), `<TrainerRoute>`,
  `<VerwaltungRoute>` (in den jeweiligen Bereichs-Layouts) als UI-Guards.
- **Umzüge von Adressen gehören in `next.config.mjs` → `redirects()`**, nicht
  in die Middleware und nicht in eine Seite. Nur dort laufen sie VOR der
  Middleware (sonst fängt ein Bereichs-Gate den Aufrufer ab, bevor er sein
  neues Ziel erreicht), vor jedem Rendern und auch bei gesetztem Not-Aus.
  **Ein `redirect()` in einer Seite unter einem Client-Layout greift NICHT**
  (nachgemessen 2026-09-01: 200 statt Weiterleitung, weil der Guard darüber
  während des Ladens einen Platzhalter rendert und die Seite gar nicht
  drankommt).

## Design-System
- Dark als Default, **zusätzlich Light-Theme** über `lib/theme-context.tsx`.
- Tokens als CSS-Variablen in `app/globals.css`:
  `--ink-0..6` (Hintergrund-Ebenen) · `--fg`, `--fg-2..4` (Text) · Pink-Akzent.
- Tailwind-Farben in `tailwind.config`: `pink` (Akzent), `ink`, `blood`, `carbon`.
- Utility-Klassen u.a.: `card-glass`, `font-mono-ta` (Mono via `var(--font-mono)`).

### Suchfelder (Leons Vorgabe 2026-09-04)
Jedes Suchfeld der App ist `components/ui/GooeySearch` — die eingeklappte
Pille, die sich per Feder zum Feld öffnet, während die Lupe als Tropfen
heraustritt (Vorbild: /trainer/athleten). Kein natives `<input type="search">`
mehr, auch nicht in Sheets und Pickern. Gesteuert über `value`/`onChange`,
`placeholder`, `label`. Steht Text im Feld, bleibt es bei einem Klick daneben
offen (sonst verlöre der Tipp auf einen Treffer die Suche); Escape leert und
schließt. Zwei Maße (`breiteZu`/`breiteAuf`) und `nurSymbol` machen die
größere Pille der DeepFight-Landung möglich, ohne die zehn anderen Stellen
anzufassen.

**DER GOO-FILTER LIEGT NUR WÄHREND DER BEWEGUNG AN** (Leon 12.09.2026: „die
Suche soll nicht so hell leuchten bei den Buchstaben und Icons, es schimmert
so komisch"). Das war kein Farbfehler, sondern der Filter selbst:
`feComposite atop` legt zwar das scharfe Original obenauf, aber die
weichgezeichnete und geschwellte Fassung bleibt sichtbar, wo das Original
durchlässig ist — also rings um jeden Buchstaben. Aus heller Schrift auf
dunkler Pille wird so ein heller Hof, und ein Hof um Schrift schließt
DESIGN-BRIEF §1.4 aus. Der Filter hängt jetzt an `.goo-inner[data-goo]`,
gesetzt für 1100 ms ab jedem Wechsel von `open` (der längste Ablauf ist der
Tropfen: 0,1 s Verzögerung + 0,85 s). Das Verschmelzen bleibt sichtbar — es
lag ohnehin nur in der Bewegung —, die Schrift steht im Ruhezustand scharf.
Bei `reduced motion` läuft der Filter gar nicht.

### Bewegung & Haptik (Regelwerk: `docs/MOTION-BRIEF.md`, ab 2026-09-04)
Wie sich die App ANFÜHLT, ist ein eigenes System — nicht Beiwerk einzelner
Komponenten. Drei Schichten, klare Arbeitsteilung:
- **`lib/motion.ts`** — die Werte: drei Federn (`springSnappy/Soft/Gentle`),
  Skalierungen (`HOVER_LIFT` 1.02, `TAP_PRESS` .97, Flächen zurückhaltender),
  `STAGGER_STEP` 45 ms, `BLUR_IN` 4 px. Nie neu erfinden, hier nachschlagen.
- **`components/motion/`** — die Bausteine: `Pressable`/`PressableBox`
  (Haptik), `Stagger`/`StaggerList`/`StaggerFlow`/`FlowItem` (Auftritt und
  fließende Listen), `Collapse`/`Pop`/`MorphSwap` (Verwandlung),
  `useMotionCapability` (Zeiger-, Blur- und Reduced-Motion-Prüfung).
- **`app/globals.css`, Abschnitt GRUNDHAPTIK** — Drücken und Anheben für
  ALLE Knöpfe der App, plus `-webkit-tap-highlight-color: transparent` und
  `touch-action: manipulation` fürs WebView.

CSS macht die Haptik, Framer Motion macht Verwandlung, Layout-Fluss und
Ein-/**Austritt**. Grund: 240 Knöpfe einzeln in JS-Federn zu wickeln kostet
Bundle und Hauptthread für etwas, das der Compositor umsonst macht.

**Harte Regeln** (vollständig im MOTION-BRIEF): kein
`import { motion } from "framer-motion"` außerhalb `components/motion/`
(Ausnahme: Diagramme und die Helix — dort IST Bewegung der Inhalt); kein
`whileHover` ohne `useMotionCapability().canHover`, sonst bleibt der
Hover-Zustand auf iOS nach dem Tap hängen; animierter `filter: blur()` nie
auf Touch (in WKWebView pro Bild ein Repaint); Tap-Feedback dagegen auf
JEDEM Gerät. `future.hoverOnlyWhenSupported` in `tailwind.config.ts` deckt
alle `hover:`-Klassen ab — nicht wieder entfernen.

## Firestore (Collections — Top-Level)
```
gyms/{gymId}                      — Gym-Stammdaten (Multi-Gym; Mitglieder lesen ihr
                                    eigenes Gym, Schreiben nur Admin/serverseitig)
gyms/{gymId}/invites/{code}       — Einladungen (Code = Dokument-ID; write:false,
                                    nur /api/invites; Lesen nur die Verwaltung)
gyms/{gymId}/auditLog/{id}        — Protokoll rechteverändernder Vorgänge UND Quelle
                                    des Neuigkeiten-Bereichs (write:false, nur
                                    lib/server/audit.ts; Lesen nur die Verwaltung)
users/{uid}                       — IDENTITÄT (Name, E-Mail, Rollen-Set-Spiegel,
                                    gymId, profileShares). Rechte + gymId NUR
                                    via Custom Claims, nie Client-Write.
                                    Für Trainer des Gyms IMMER lesbar — alles
                                    Persönliche liegt darunter (s. u.)
users/{uid}/athleteProfile/main   — Athleten-Profil (Disziplin, Level, Gewicht …)
users/{uid}/fightProfile/main     — Kampfprofil = kuratierte DeepFight-Auswertung
                                    (Owner liest, schreibt NIE; Trainer schreiben)
users/{uid}/workouts              — geloggte Workouts
users/{uid}/fightCamps/{campId}   — Wettkampf + Gegner-Snapshot (Anzeige = Snapshot
                                    + Lücken aus opponents/{opponentId}, s.o.)
                                    Trägt PFLICHT `ownerIsStaff` — die gym-weite
                                    collectionGroup-Query filtert darauf und sieht
                                    nur Athleten-Camps; Stab-Camps nur mit Freigabe
                                    im Bereich „wettkampf“
users/{uid}/videoAnalyses/{id}    — KI-Video-Analysen des Athleten (Owner liest NUR
                                    sharedWithAthlete==true, schreibt NIE)
opponents/{id}                    — Gegner-DNA-Bibliothek (Trainer/Admin)
opponents/{id}/videoAnalyses/{id} — KI-Video-Analysen zum Gegner
aiUsage/summary                   — laufende KI-Kosten + Budget (Guthaben-Ring)
trainingSessions/**               — gym-weites Curriculum (alle lesen, Trainer/Admin schreiben)
techniqueStats/{id}               — anonyme Aufruf-Zähler (nur viewCount/lastViewed)
```
Regeln + Indizes: `firestore.rules`, `firestore.indexes.json`, `firebase.json`.

## Deployment (Vercel)
- **Produktion:** https://tidal-athletics.vercel.app — baut automatisch aus
  `main` (github.com/Kern-Digital/ironfight-mma). Verwaltet von Leon
  (Vercel-Account `l3on95`, Projekt `tidal-athletics`, **Hobby-Plan**:
  maxDuration ≤ 300 s, Request-Bodies ≤ 4,5 MB!).
- **CLI-Zugänge auf Leons PC vorhanden** (für Claude nutzbar):
  `npx -y vercel …` (eingeloggt; env vars, logs, redeploy) und
  `npx firebase-tools …` (eingeloggt; Projekt ironfight-mma via .firebaserc).
  Debugging: `npx -y vercel logs https://tidal-athletics.vercel.app`.
- **Umgebungsvariablen** (Production, alle gesetzt am 2026-08-18):
  - `NEXT_PUBLIC_FIREBASE_*` (6 Stück, siehe `.env.local.example`)
  - `GEMINI_API_KEY` — Video-Beobachtung (Stufe 1), **nur serverseitig**;
    Free-Tier-Key (Pro-Modelle gesperrt, Billing in AI Studio schaltet frei)
  - `ANTHROPIC_API_KEY` — Claude-Bewertung (Stufe 2), **nur serverseitig**;
    Prepaid-Guthaben (5 € am 2026-08-18); fehlt er, läuft automatisch der
    Gratis-Fallback über Gemini Flash
  - Env-Änderungen brauchen einen Redeploy (`npx -y vercel redeploy <url>`).
- Firestore-Rules werden NICHT von Vercel deployt:
  `npx firebase-tools deploy --only firestore:rules`.
- Rollen wurden am 2026-08-18 initial als Custom Claims gesetzt
  (leonreichle95=admin; noelreichle/romanapolonov/alechoffmann=trainer) —
  der Juni-Backfill war nie gelaufen, deshalb zeigte die App alle als Athlet.
  Neue Rollen: `node scripts/set-role.mjs <uid> <role>` (braucht
  Service-Account) oder Claims via identitytoolkit `accounts:update`.

## KI-Video-Analyse (Konzept §6) — Architektur & Betriebswissen
Spezifikation/Fragenkatalog: `docs/gegner-dna-video-analyse-fragenkatalog.md`.
UI: `components/trainer/VideoAnalysisSection.tsx` + `VideoAnalysisResult.tsx`
(Werkbank auf /trainer/deepfight). Seit Etappe 1 der Automatik (16.09.2026)
gibt es KEINE Übernahme mehr: Der Server speichert jede Analyse und rechnet
das Profil aus allen Analysen neu. Datenmodell: `lib/video-analysis.ts`,
Rechnung: `lib/profile-evidence.ts` (rein) + `lib/server/profile-recompute.ts`.

### BESCHLOSSENER UMBAU: AUTOMATIK STATT REVIEW (Leon, 14./15.09.2026)
Leon hat das Review-Modell abgeschafft: „Keiner wird jedes Mal den gesamten Text
durchlesen. Der User möchte über die wichtigsten Punkte kurz informiert
werden und darauf vertrauen, dass unsere App und die KI dahinter einen guten
Job macht. Ich möchte nicht, dass der User das selber entscheiden muss."
Vollständige Entscheidungsliste samt Zahlen und Beispielen:
`PROMPT-analyse-umbau.md` im Projektstamm (D:\Tidal-Athletics\) und das
Gedächtnis `analyse-automatik-entscheidung`. Kurzfassung:
- **Analyse fertig = Profil aktualisiert.** Keine Übernehmen-Knöpfe mehr.
  Zahlen addiert, Split gewichtet, Texte von Claude FORTGESCHRIEBEN (neue
  Gesamtantwort je Frage). Das Profil wird bei jeder Änderung aus ALLEN
  gespeicherten Analysen NEU GERECHNET (serverseitig) — Voraussetzung für
  Löschen, Umklassifizieren, Doppel-Upload, Altern. Nutzer sieht 3–5 Punkte
  (Bestätigt / Neu / Geändert), Befund-Texte, Zeitstempel, Rohzahlen hinter
  „Details anzeigen".
- **Kämpfer-Zuordnung NACH dem Upload per Standbild:** kurzer Gemini-Vorlauf
  (erste 1–2 Min, niedrige Auflösung) → Kämpfer + Sekunde je Kämpfer; der
  Browser zieht das Standbild aus der Datei; Trainer tippt je Karte
  Athlet/Gegner aus der Datenbank oder „egal". Beide zugeordnet → ZWEI
  Auswertungen aus einem Upload. Zeitraum und Art des Videos werden auf
  demselben Schirm VOR der Analyse bestätigt, von der KI vorbelegt; die ART
  legt die KI fest, nicht der Nutzer. YouTube: kein Standbild, Beschreibung
  + Sprung ins Video. Beschreibungsfeld bleibt zugeklappter Rückfall.
- **Gewichte** (Gegenprobe 10 Agenten): Zeitraum letzte 6 Monate 1,0 · 6–18
  Monate 0,9 · 1–3 Jahre 0,6 · älter 0,4 · unbekannt 0,6 (heute 0,8 > 0,65
  bestraft ehrliches Datieren). Art: ganzer Kampf 1,0 · Ausschnitt 0,7 ·
  Sparring 0,6 · Highlight-Clip 0,3. Highlight liefert NUR Text (Waffen,
  Entries, Auslage, Finish), nie Zahlen, nie Split, alle Clips je Antwort
  ≤ 0,6; Sparring kein Split, beim Gegner keine Zahlen; Zahlen nur aus
  ganzem Kampf/Ausschnitt ≤ 3 Jahre. w = Zeitraum × Art ohne Klemme.
  Kämpfer-Sicherheit ist ein TOR (≥ 0,75 voll, darunter nichts, neu
  zuordnen). Split = Fenster der 5 jüngsten Kämpfe. `deriveTendencies`
  erst ab 5 Versuchen aus 2 Videos.
- **Kipp-Regel für Texte:** jede Antwort = Tauziehen zwischen Seiten mit
  Gewichtssumme; die jüngsten Videos entscheiden, sobald sie zusammen ≥ 1,0
  wiegen; Ausschnitt/Sparring allein nie, zwei ja; Clips nie; ohne Datum
  Mehrheit; „beides" im Text, sobald die zweite Seite ≥ halbes Gewicht hat.
  Bestätigung zählt nur mit Timestamp-Beleg (Modelle bestätigen Vorgaben).
- **„Trainer-Kommentar"** (ersetzt Tippen in einzelne Antworten UND das
  frühere „Handnotiz schlägt immer"): EIN Freitextfeld im DeepFight-Profil,
  KI zerlegt in Aussagen, Gewicht nach BELEG (regelmäßig gesehen 0,8 ·
  einmal gesehen 0,6 · Meinung 0,5 · gehört 0,3), nie nach Wortwahl, max
  0,8 = immer unter einem ganzen aktuellen Kampf, füllt die Kipp-Schwelle
  NIE. Zwei Zeilen je Antwort: „Im Kampf" (Videos) / „Im Training laut
  Trainer". Zahlen und Split: Trainer-Anteil 0. Zählfragen (häufigste Waffe)
  folgen den Zahlen. Gameplan/Drills: KI schlägt vor, Trainer bearbeitet
  oder verwirft. Rohtext nie in den Video-Prompt; Anweisungen („ignoriere")
  = 0; Ablage `gyms/{gymId}/trainerNotes/…`, NICHT unter users/{uid}
  (Owner-Wildcard!). Gegner-Notizen gym-privat.
- **Verletzungs-Box:** Athlet schreibt selbst (Trainer gibt frei) oder
  Trainer; verblasst statt abläuft (3 Monate voll, dann nach Schwere/Zeit,
  nie null: „früher: …"); nur Trainer sehen es, nie Athleten-Fassung, nie
  Snapshot; **beim Gegner vorerst GAR NICHT gespeichert** (Gesundheitsdaten
  Dritter). Vor Rollout in Datenschutzerklärung + AVV.
- **Abgelehnt:** „Kampf ohne Video" als Eingabe („die Benutzer sollen
  lernen, dass sie Videos machen"); Zahlen nie aus Freitext.
- **Athleten-Einreichung: JA** (Backlog-Idee wird gebaut). Teilschritt 6
  (gymId am Analyse-Dokument, collectionGroup, Kosten je Gym) wird in den
  Umbau GEFALTET, nicht getrennt gebaut. Bestand ist Demo — kein Backfill.
- **Für ein Update gemerkt:** Kämpfer-Sicherheit je Runde prüfen und nur
  unsichere Abschnitte neu laufen lassen; KI-Vermutungen zu alten
  Verletzungen erst ab 3 ganzen Kämpfen, als Vermutung gekennzeichnet.
- **Hicksches Gesetz gilt app-weit** (Leon 15.09.): je Schritt wenige
  Wahlmöglichkeiten, ein Standard vorbelegt. Wo eine Entscheidung die Zahl
  der Optionen betrifft, wird Leon gefragt, nicht entschieden.
- **Gemessen (15.09.):** `scripts/check-analyse-freigabe.mjs` 15/15 —
  `sharedWithAthlete` ist serverseitig und bewiesen, kein Client-Filter.
- **Leons Antworten 16.09. (Hicksches Gesetz):** a) Trainer-Kommentar VIER
  Chips · b) Zeitraum FÜNF Optionen · c) Stärke = FÜLLSTAND im
  DeepFight-Symbol + Prozent · d) EIN „Details anzeigen" · e) Karte:
  Rahmen-Feld „X Ignorieren" (grau, umkehrbar), Klick auf die Karte → Blur
  + zwei Felder „Athlet / Gegner" → Popup mit Liste; Einreicher steht oben;
  auf Karte 1 gewählte Person auf Karte 2 grau; mind. eine Zuordnung, Knopf
  erst dann voll gefärbt, sonst „Wähle mind. eine Person zur Auswertung
  aus" · f) Admin-SDK (liegt ohnehin in `lib/server/firebase-admin.ts`).

### ETAPPE 1 GEBAUT — WÄHRUNG UND NEUBERECHNUNG (16.09.2026, committet 97ca7cd, LIVE)
- **Analyse-Dokument** trägt `gymId`, `targetIsStaff`, `videoType`
  (full/excerpt/sparring/highlight), `recency`, `fightMonth`, `weight`
  (aufgeschlüsselt, vom Server gerechnet), `fileFingerprint`, `wrongFighter`;
  jeder Befund einen `sideKey` (Claude vergibt ihn; Altbestand bekommt ihn
  beim Decodieren aus dem Text). `merge.confirms` ist jetzt
  `{questionId, evidence[]}` — ohne Beleg zählt eine Bestätigung nichts.
  `appliedFindingIds`/`appliedStats` sind WEG. `decodeVideoAnalysis` liest
  Client- und Admin-Dokumente gleich und füllt Altbestand auf.
- **Gewichte im Code:** `FIGHT_RECENCY_WEIGHT` 1/0,9/0,6/0,4/unbekannt 0,6,
  `VIDEO_TYPE_WEIGHT` 1/0,7/0,6/0,3, `w = recency × type` OHNE Klemme;
  Kämpfer-Sicherheit ist ein TOR (`identified`, ≥ 0,75). `coverageWeight`
  ist gestrichen; bis Etappe 2 leitet `videoTypeFromObservation` die Art
  aus `meta.coverage`/`ruleset` ab (unklar → „Teil eines Kampfs", 0,7).
- **Rechnung `lib/profile-evidence.ts`** (rein, `computeProfile`): Tauziehen
  je Frage über `sideKey`-Seiten, Kipp-Regel (jüngste Quellen ≥ 1,0 → Menge
  entscheidet, sonst Mehrheit; Gleichstand Masse → jünger → Schlüssel),
  „beides" ab halbem Gewicht, Highlight nur in `preferred-weapons` und
  `entry-patterns` mit Deckel 0,6, Zahlen ungewichtet nur aus full/excerpt
  (Athlet auch sparring) und nicht `ancient`, Split-Fenster 5, Seite
  `manual` für Handtext ohne Analyse (bleibt, bis Evidenz gewinnt; belegte
  Bestätigung gibt ihm Gewicht). Ergebnis-Felder am Profil: `dna`,
  `dnaSplit`, `dnaSplitWeight`, `actionStats`, `evidence` (Seiten, Quellen,
  Split-Fenster, `evidenceTotal`; `evidenceStrengthPct` = /3,0 für den
  Füllstand). **39 Prüfungen** in `scripts/test-profil-rechnung.mjs`
  (Aufruf: `node --import ./scripts/lib/ts-loader-register.mjs
  scripts/test-profil-rechnung.mjs` — Node 24 streift Typen selbst, der
  Loader kennt nur `@/` und Endungen).
- **Server:** `POST /api/video-analysis/commit` (speichert, setzt gymId/
  targetIsStaff/Art/Gewicht aus dem ZIEL, bucht Kosten in `aiUsage/summary`
  UND `aiUsage/gym-{gymId}` mit `months.JJJJ-MM`, rechnet neu) und
  `POST /api/video-analysis/flag` (Marke „falscher Kämpfer", Admin-Löschen;
  rechnet neu). Beide prüfen das Tor SERVERSEITIG
  (`lib/server/member-access.ts` = `canAccessMemberData` der Rules — das
  Admin-SDK umgeht Regeln). Neuberechnung in einer Transaktion
  (`lib/server/profile-recompute.ts`). Der Client speichert und löscht
  Analysen NICHT mehr; `mergeDnaSplit` hat keinen Aufrufer mehr.
- **Regeln (DEPLOYT 16.09. mit Leons Freigabe, samt Index):** videoAnalyses für Clients nur
  lesen + `update hasOnly([sharedWithAthlete])` (Athleten-Modus); Gegner-
  Analysen nur lesen; Admin-Wildcard schließt videoAnalyses aus;
  fightProfile Trainer nur lesen (Admin schreibt für den Demo-Seeder);
  opponents: create/update ohne Änderung an `dnaSplit`, `dnaSplitWeight`,
  `actionStats`, `evidence` (`abgeleiteteFelderUnveraendert`, Falle 4 hilft:
  unverändertes Durchreichen ist keine Änderung); collectionGroup-Regel
  `{path=**}/videoAnalyses` mit `targetIsStaff == false` + `sameGym`
  (direkter Feldzugriff); aiUsage read nur Admin, write false. Index
  (gymId, targetIsStaff, createdAt desc, COLLECTION_GROUP) in
  firestore.indexes.json. **Messung `scripts/check-analyse-automatik.mjs`
  (39 Zeilen per REST): VOR dem Deploy 19 ✗ — genau die Löcher, die die
  neuen Regeln schließen; NACH dem Deploy 39/39 ✓ (der cg-Index brauchte
  rund drei Minuten zum Bauen, bis dahin 400 — ein 400 beweist nichts).
  `check-analyse-freigabe.mjs` weiter 15/15. Eine eigene Falle im Skript:
  `actionStats: []` auf ein leeres Array ist ein No-Op (Falle 4) und meldet
  200 — die Zeile setzt deshalb einen echten Eintrag.** Screenshot
  `scripts/mess-e1-automatik.mjs` 12/12 (eigenes Konto mess-e1@…).
- **UI (Übergang bis Etappe 3):** Bericht ohne Übernehmen-Knöpfe und ohne
  Konflikt-Vergleich (`existingDna={null}`, keine Rückrufe), Liste zeigt
  „Im Profil" / „Zählt nicht", je Analyse eine Zeile „zählt zu X Prozent:
  Art, Zeitraum" mit Knopf „Falscher Kämpfer" / „Zählt doch"; Löschen nur
  Admin. Landung liest per `listGymVideoAnalyses` (EINE cg-Abfrage) plus
  kleinem Fächer für Stab-Konten mit Freigabe (`lib/deepfight-analysen.ts`).
  /admin zeigt unter „KI-Kosten" den Verbrauch je Gym (dieser Monat /
  gesamt) aus `aiUsage/gym-*`.
- **Drei Fallen aus dem Bau:** (1) Der Edit-Werkzeug-Cache legt eine per
  Skript geänderte Datei wieder zurück — Skript-Ersetzungen NACH dem letzten
  Edit an der Datei machen. (2) tsconfig hat kein ES6-Ziel: kein `u`-Flag
  in Regex, keine `for…of` über Map/Set (Array.from). (3) Kombinierende
  Unicode-Zeichen im Quelltext werden vom Werkzeug „normalisiert" — nach
  `normalize("NFD")` stattdessen `[^\x00-\x7f]` streichen.

### ETAPPE 2 GEBAUT — VORLAUF, ZUORDNUNG, KAMPFART (16.09.2026, nicht committet)
Leons Entscheidungen vom 16.09. (Gedächtnis `analyse-automatik-entscheidung`,
Abschnitt „ETAPPE 2"): **erst Upload, dann Vorlauf, dann Zuordnung** — wen es
betrifft, fragt vor dem Video niemand mehr.
- **Der Fluss** ist `components/trainer/VideoUploadFlow.tsx` auf
  `/trainer/deepfight/analyse` OHNE `?ziel=` (mit `?upload=<id>` ein
  gemerkter Zwischenstand). `VideoAnalysisSection` zeigt nur noch Liste und
  Bericht eines Ziels (`?modus=&ziel=`); ihre Ablage, Pipeline und
  Formular-Persistenz sind in den Fluss gewandert, der Fortschritts-Haken
  nach `lib/use-analysis-progress.ts`. „Start" auf der Landung führt
  DIREKT zur Ablage — die zwei Platten Athleten/Gegner sind weg
  (`FightDnaEntry` hat nur noch `onStart`; die `.df-entry__choice*`-Stile
  in globals.css haben keinen Aufrufer mehr).
- **Vorlauf** `POST /api/video-analysis/preview` → `previewVideo()` in
  lib/server/gemini.ts: Flash-Kette über die ersten 120 s
  (`videoMetadata.endOffset`, bei YouTube ab Start), `mediaResolution:
  MEDIA_RESOLUTION_LOW`, Antwort `VideoPreview` (fighters mit corner/
  clothing/features/description/bestSecond, videoType, sport, fightMonth).
  Der Nutzer sieht davon NICHTS — die Kämpfer werden Karten, Art und
  Kampfart eine vorbelegte Zeile. **Zeitlimit 40 s je Modell** (504 → sofort
  nächstes Modell): Im Free Tier hing `gemini-flash-latest` bis 300 s.
  Gemessen: Free Tier 72–107 s, **Bezahltarif 10 s** (seit 16.09. Paid Tier 1,
  Gedächtnis `gemini-bezahltarif`).
- **Zuordnungs-Schirm** genau nach Leon (e): Karte = Standbild aus der
  lokalen Datei (Canvas an `bestSecond`; YouTube: Beschreibung + Sprung ins
  Video), am Rand „X Ignorieren" (Karte grau, Tipp auf die graue Karte holt
  sie zurück — kein Extra-Knopf), Tipp auf die aktive Karte → Blur (nur mit
  `canBlur`, MOTION-BRIEF §3.5) + Felder „Athlet / Gegner" → `SheetShell`
  mit `GooeySearch`; Person von Karte 1 ist auf Karte 2 grau. Darunter
  DREI Angaben zum VIDEO: Zeitraum (Pflicht, ohne Vorbelegung, „Weiß ich
  nicht" zählt als gewählt), Art und Kampfart in EINER Zeile, beide von der
  KI gesetzt und antippbar. „Analysieren" voll farbig erst bei ≥ 1 Zuordnung
  UND Zeitraum, sonst sagt der Klick, was fehlt (`data-bereit`, BEWUSST kein
  `aria-disabled` — der Knopf ist klickbar). Beschreibungsfelder als
  zugeklappter Rückfall. Analyse-Stufe (Flash/Pro) hat KEINEN Schalter mehr
  im Fluss — immer Flash; Detail-Analyse ist eine eigene Entscheidung.
- **KAMPFART GEHÖRT ZUM VIDEO, NICHT ZUR PERSON** (Leons Einwand: Athlet B
  mit Sambo-Profil kämpft im Video MMA → MMA-Analyse). `Sport` in
  lib/video-analysis.ts: sechs Einträge `mma · boxen · kickboxen · ringen ·
  sambo · bjj` (SPORT_ORDER/SPORT_LABEL/SPORT_KURZ), EINMAL je Upload, gilt
  für alle Karten, Feld `sport` am Analyse-Dokument (commit prüft
  `isSport`). Vorschlag = `vorschlagSport(gesehen, zuletzt)`: die zuletzt
  gewählte Kampfart des Trainers (`localStorage ta-deepfight-sport`) bleibt,
  solange das Gesehene hineinpasst (Boxen passt in MMA, Jacke nicht).
  Hauptdisziplin im Athletenprofil entscheidet NICHTS mehr über die Ablage.
- **Profil je Kampfart:** `recomputeProfile` schreibt beim Athleten neben
  `fightProfile/main` je Kampfart `fightProfile/{sport}` aus NUR den
  Analysen dieser Kampfart (dieselbe reine Rechnung, gefilterte Liste),
  löscht Kampfart-Dokumente ohne zählende Analyse. Gegner behalten EIN
  Profil. `getFightProfile(uid, sport?)`. Das Gesamtprofil `main` rechnet
  bis Etappe 3 über alle Kampfarten — die Gesamtansicht als
  ZUSAMMENSTELLUNG der Kampfart-Profile und der Umschalter sind Sache des
  Berichts (Etappe 3).
- **Regel „nur was vorkam"** (lib/profile-evidence.ts): Ein Video
  beantwortet nur Fragen zu dem, was in ihm passiert ist — `SIGNAL_JE_FRAGE`
  (21 Fragen → strikes/kicks/takedowns/ground/clinch/cage),
  `beobachteteSignale()` aus Split, Zählern, Verteidigungszahlen,
  Kontrollzeiten und Zonen; gilt für Befunde UND Bestätigungen; ohne jedes
  Signal (Bestand ohne Split/Zähler) bleibt alles offen. Kein zweites
  Regelwerk-Feld (zurückgenommen: eine Boxrunde im Käfig sieht für die KI
  wie MMA aus, „was erlaubt war" ist nicht beobachtbar).
  `scripts/test-profil-rechnung.mjs` 45/45.
- **Zwischenstand** `ta-video-analysis-form:upload:{uploadId}`
  (lib/deepfight-zwischenstand.ts): Upload, Vorlauf, Zuordnungen, Angaben,
  fertige Beobachtungen je Karte; die Adresse bekommt `?upload=` sobald
  etwas gerettet ist (ohne Neumounten — die ID lebt im State, sonst ginge
  die lokale Datei und mit ihr die Standbilder verloren). Landung „Analysen
  in Arbeit" listet ihn mit Dateiname und Zustand. Alte Ziel-Schlüssel
  werden ignoriert (Bestand ist Demo).
- **Messung:** `scripts/mess-e2-vorlauf.mjs` (Route live gegen Leons
  Testvideo, Konto mess-e2v@…), `scripts/mess-e2-schirm.mjs` (Schirme über
  gemerkten Stand, 20 Prüfungen, Konto mess-e2@…), `scripts/mess-e2-ablauf.mjs`
  (ganzer Weg mit echter KI gegen ZWEI Prüfkonten, Firestore-Nachweis).
  **Testvideo IMMER** `C:\Users\reich\Desktop\Trainingsvideo Leon , Alec.mp4`
  (Gedächtnis `testvideo-leon-alec`); das WhatsApp-Video im Repo ist ein
  Einzeltraining.
- **Fallen aus dem Bau:** (1) Playwright hält `aria-disabled="true"` für
  deaktiviert und klickt nicht — ein Knopf, der mit einem Hinweis antwortet,
  trägt das Attribut nicht. (2) `SheetShell` kennt kein Escape; im Test den
  Schleier oben links anklicken (`position: {x:12,y:12}`), mittig deckt ihn
  das Panel. (3) `hasText: "Athlet"` trifft auch die Karten-Knöpfe („Athlet ·
  tipp zum Ändern") — die Auswahl-Felder tragen `aria-label="Kämpfer N als
  Athlet zuordnen"`. (4) Der Vorlauf-Prompt muss Einzelpersonen ausdrücklich
  zulassen, sonst liefert ein Drill-Video null Kämpfer.
- **Markierte Analyse, bleibender Text — Befund aus Etappe 1, behoben
  16.09.:** `recomputeProfile` las den zuvor ERRECHNETEN Profiltext als
  Bestand (Seite `manual`) zurück; eine als „falscher Kämpfer" markierte
  Analyse fiel aus der Rechnung, ihr Text stand aber weiter im Profil.
  `manuellerBestand()` behält nur Fragen, deren Sieger in der gespeicherten
  Rechnung `manual` war (oder ohne Rechnung, vor der Automatik). Bewiesen
  mit `scripts/check-profil-je-kampfart.mjs` (8/8, echte Neuberechnung ohne
  KI: main/mma/sambo, Markieren löscht das Kampfart-Dokument und den Text).
- **Ganzer Weg mit echter KI bewiesen (16.09., Dev-Log):** Vorlauf 47 s,
  je Person Beobachtung 19–25 s + Bewertung 177–208 s + commit, danach
  delete-upload — zwei Auswertungen aus einem Upload in 7,5 min. Danach war
  das ANTHROPIC-GUTHABEN leer („credit balance is too low"); Leon lädt auf.
  Verbindungsabbrüche des SDK („Connection error.") gelten als „überlastet"
  → Auto-Neustart im Client (lib/server/claude.ts).
- **Zwei Auswertungen aus einem Upload — die Löschfalle (gemessen 16.09.):**
  /analyze löschte die Google-Datei nach der ersten Bewertung, die zweite
  Person bekam „Gemini HTTP 403: You do not have permission to access the
  File". Seither löscht /analyze nur ohne `keepFile`; der Fluss setzt
  `keepFile: true` und löscht nach der LETZTEN Person über
  `POST /api/video-analysis/delete-upload` (`deleteUploadedFile`).
- **DEEPFIGHT-FREIGABE FÜR ALLE (Leon 16.09., gebaut im selben Fenster):**
  Jeder Athlet entscheidet selbst, welche Trainer sein Kampfprofil und seine
  Analysen sehen; ohne Freigabe ist er nicht analysierbar (dasselbe Tor gilt
  für /commit). `profileShares.{bereich}` ist jetzt `{ uids, gyms }` —
  `gyms` = Leons LEBENDE Regel „alle Trainer dieses Gyms, auch künftige";
  die alte Listenform lesen `readShares` und `hatFreigabe()` weiter. Das
  Tor: `canAccessMemberData` (Rules) und `canAccessMember`
  (lib/server/member-access.ts) — `hatFreigabe ODER (Bereich ≠ deepfight UND
  kein Stab-Konto)`; `athlet`/`wettkampf` bleiben für Athleten offen. Die
  cg-Abfrage `{path=**}/videoAnalyses` trägt nur noch GEGNER (`mode ==
  "opponent"` + gymId, neuer Index gymId/mode/createdAt); Athleten und
  Kollegen kommen über den Fächer je sichtbarer Person
  (`sichtbareMitglieder(members, uid, gymId)`). Oberfläche: „Profil teilen"
  auf /kampfprofil für JEDEN (Athlet vergibt nur DeepFight,
  `bereicheFuerKonto`), im Sheet oben die Karte „Alle Trainer deines Gyms"
  mit Bereichs-Chips (`mitGym`), Namens-Chips sind gesperrt, wo „alle" schon
  deckt; Badge am Knopf „Alle" oder Zahl. Athleten-Bibliothek erklärt den
  leeren Fall („N Athleten haben dich noch nicht freigegeben").
  Messskripte angepasst: `check-analyse-freigabe.mjs` (Namen, Gym, alte
  Form), `check-analyse-automatik.mjs` (cg nur Gegner). **Rules + Index:
  Deploy einzeln bei Leon anfragen; bis dahin gilt live das alte Tor.**
- **OFFEN nach Etappe 2:** ~~`.df-entry__choice*` aus globals.css entfernen~~ (erledigt in 14972ff, 17.09. nachgeprüft).
  Etappe 3: Bericht als Kurzinfo + „Details anzeigen", Gesamtansicht als
  Zusammenstellung, Umschalter je Kampfart, Einwilligungs-Schritt beim
  ersten Start (Athlet bestätigt die Freigabe-Logik).

### ETAPPE 3, RUNDE 1 GEBAUT — DIE RECHNUNG (17.09.2026, Fenster tidal-athletics-e8)
Leons Entscheidungen im Planungsfenster (Gedächtnis `analyse-automatik-entscheidung`,
Abschnitt „ETAPPE 3 — Planungsrunde"). „Neu / Geändert" im Bericht hat Leon
ABGELEHNT („du hast 15 Analysen, er sagt Neu … dann wäre unsere Aussage
einfach falsch") — der Bericht beschreibt den BELEG, nie eine Tatsache.
- **Wiederholungs-Regel** (`resolveAnswer`, Leon JA): Eine Antwort aus ≥ 2
  Videos wechselt erst gegen eine Aussage aus ≥ 2 Videos. Vorher kippte EIN
  aktueller ganzer Kampf jede Antwort, auch gegen 14 ältere. Highlight-Clips
  zählen nicht als Wiederholung (`kampfVideos`), sonst kippten zwei Clips
  einen ganzen Kampf.
- **Wie oft gesehen:** `AnswerSide.videos` + `texte` (alle Fassungen, jüngste
  zuerst, Stoff für den Satzschreiber), `AnswerEvidence.gelegenheiten` (in
  wie vielen zählenden Videos die Frage beantwortbar war — Grundlage für
  „1 von 15 Videos").
- **Profilstärke** (Leon JA: „wie stark der Athlet ausgewertet wurde, 100 %
  fast eine Garantie"): je Frage mit Beleg `min(1, führend/3,0) ×
  führend/alle Seiten`, Durchschnitt → `evidence.staerke`. 3,0 = drei
  aktuelle ganze Kämpfe oder fünf Sparrings; Widerspruch senkt (Orthodox 3,
  Southpaw 2 → 60 %). Ersetzt `evidenceStrengthPct`; commit/flag antworten
  mit `strength: evidence.staerke`. Die Helix-Kennzahl zeigt noch
  `dnaCompleteness` („66 % Profilstärke") — Umstellung auf `evidence.staerke`
  ist Runde 3/4 (Leon: EINE Zahl überall).
- **Fight-DNA als Zusammenstellung** (`stelleZusammen`): `fightProfile/main`
  ist keine eigene Rechnung mehr. Gleicher Gewinner in allen Kampfarten →
  ein Satz, verschiedene → `AnswerEvidence.kampfarten[]` mit Label
  („MMA: … Sambo: …" bis Claude den Satz schreibt), eine Kampfart allein →
  ihre Antwort unverändert, Zähler je Technik addiert, Split gewichtet.
  Analysen ohne Kampfart (Bestand) bilden eine Gruppe ohne Namen.
  `evidence.kampfarten` (für den Umschalter), `evidence.flaeche` (häufigste
  Fläche der zählenden Analysen; in der Zusammenstellung nur bei gleicher
  Fläche aller Kampfarten).
- **Wirkung je Analyse** (`wirkungDerAnalyse`, Stoff der Kurzinfo): im Profil
  der Kampfart des Videos VOR und NACH ihm verglichen, Arten `angepasst` ·
  `abweichend` · `bestaetigt` (≥ 2 Videos) · `erstmals`; höchstens 3 Punkte
  mit dem Text DIESES Videos, Zahlen erst ab 5 Versuchen, Split-Bewegung ab
  3 Punkten, Stärke vorher → nachher. `recomputeProfile(…, { wirkungFuer })`
  schreibt sie in derselben Transaktion an die Analyse (`VideoAnalysis.wirkung`,
  nur der Server); Rückgabe jetzt `{ profil, wirkung }`.
- **Steckbrief-Filter in der Rechnung** (abgestimmt mit tidal-athletics-9f):
  Signale aus `filtereBeobachtung(obs, sport, variante)` über
  `SIGNALE_JE_GRUPPE` (+ ground-top, ground-bottom, rocked, attacked),
  `frageGiltFuer` für Befunde, Bestätigungen und Gelegenheiten, Zähler über
  `filtereTechnikStats`, Split-Fenster über `splitNachSteckbrief` —
  rückwirkend für den Bestand.
- **Messung:** `scripts/test-profil-rechnung.mjs` **86/86** (vorher 45),
  `scripts/check-profil-je-kampfart.mjs` **13/13** gegen Firestore
  (Zusammenstellung, Kampfarten, Stärke, Wirkung an der Analyse). Im
  Echtlauf des Fensters „Daten sauber" (17.09. 13:04): commit ohne Fehler,
  `wirkung` an allen 4 Analysen, `evidence.staerke` geschrieben.
- **RUNDE 4 GEBAUT (17.09., vor Runde 2 gezogen — Leon: „Etappe 3 baut
  ZUERST nur die Seiten … Dann EIN Push. Claude-Sätze und Kurzinfo kommen
  danach."):** `components/deepfight/KampfartUmschalter.tsx` (Leiste
  „Fight-DNA · MMA · Sambo" erst ab zwei Kampfarten, erster Eintrag heißt
  „Fight-DNA", nie „Gesamt"; Hook `useKampfartAnsicht(uid, main)` lädt
  `fightProfile/{sport}` nach und liefert `sportFuerKarte` — gewählte oder
  einzige Kampfart —, `flaeche` und `staerke`). `FightDnaHelix` nimmt
  `staerke` (Kennzahl und Fokus-Karte zeigen `evidence.staerke` statt der
  Vollständigkeit). /kampfprofil: Umschalter, Kopf-Chip „Profilstärke x %"
  statt „DNA x %", Karte mit `sport`/`flaeche`/`mode="athlete"`, Leer-Texte
  ohne „übernehmen". /trainer/deepfight/athleten/[uid]: dasselbe (auch dort
  `mode="athlete"` — der Trainer liest die Du-Fassung seines Athleten),
  Überschrift „Fight-DNA · Aus allen ausgewerteten Videos gerechnet", Hook VOR
  den frühen Returns, Wachstum nur in der Fight-DNA-Ansicht. Messung
  `scripts/mess-e3-umschalter.mjs` 11/11 (Athlet + Trainer, echte
  Neuberechnung ohne KI) und im vollen KI-Lauf von Fenster 95 (37/37, beide
  Themes: Matte rund, Helix = Profilstärke 20). Falle: In der Stab-Hülle gibt
  es ZWEI `main`-Elemente → `locator("main").last()`.
- **LÜCKEN ÜBER MEHRERE VIDEOS (Leon 17.09., für Runde 2/3):** „ja ab mehreren
  videos aber diese müssen natürlich in der gleichen kategorie sein … wenn ich
  5 Analysen mit der Kategorie MMA laufen lasse und in 4 sieht man keinen
  Takedown, dann steht das natürlich offen zu trainieren." Nur innerhalb
  eines Kampfart-Profils, nur vom Steckbrief erlaubte Phasen, eigene
  Aktionen; die Einzel-Bewertung bleibt „nur was vorkam". Schwelle liegt Leon
  vor (Vorschlag: ab 5 Videos der Kampfart ohne Clips, fehlt in ≥ 80 %).
- **OFFEN (Runden 2, 3, 5):** Satzschreiber mit Opus 5 (Satz-Cache je Frage,
  „Satz offen" + Nachholen, er/du glätten, Käfig-Wörter nur mit Fläche,
  Lücken-Sätze) · Kurzinfo im Bericht mit Füllstand + EIN „Details anzeigen"
  (inkl. `verworfen`-Zeile, Zonen über `zonenLabel(sport, flaeche)`) ·
  Auslage „laut dir / in deinen Videos" (Leon JA) · Einwilligung mit Leons
  Wortlaut + Knopf „Einzelne Trainer auswählen" · Offene Leon-Fragen: Soll
  auch „beides" 2 Videos brauchen? Schwelle der Lücken?

### KAMPFART-STECKBRIEFE GEBAUT (17.09.2026, committet de22189 mit Etappe 3, abgenommen und mit Runde 4 gepusht)

Spezifikation mit Quellen: `docs/kampfart-steckbriefe.md`. Leon hat alle
sechs Entscheidungen wie empfohlen beantwortet: `entry-patterns_jab`
gestrichen · acht Zusatzfragen · zwei Fassungen je Frage (`label` „er",
`labelDu` „du") · 37 Techniken mit Gruppen `clinch` und `submission` ·
EIN Varianten-Umschalter, nur Kickboxen/Muay Thai · Kampf-Sambo läuft als MMA.

- **`lib/kampfart-steckbrief.ts` (NEU, rein)** — sechs Steckbriefe
  (`STECKBRIEFE`: rolle, begriffe, gesperrt, techniken, splitNull, zonen,
  varianten, anker) und die Abfragen `frageGiltFuer`, `technikErlaubt`,
  `erlaubteTechniken`, `gesperrteGruppen`, `offeneFragen`, `begriffe`,
  `zonenLabel`/`zonenPhrase` (BJJ → null), `kategorieLabel`,
  `varianteFuer`. Dazu die EINE Signal-Tabelle der Rechnung (`Signal`,
  `SIGNAL_JE_FRAGE` 28 Einträge, `SIGNALE_JE_GRUPPE`) und die Filter
  `filtereBeobachtung` (Sicht, nie Überschreiben), `filtereTechnikStats`,
  `splitNachSteckbrief`. Offene Fragen: MMA 66 · Boxen 54 · Kickboxen 56 ·
  Ringen 56 · Sambo 57 · BJJ 53 (von 67).
- **REIHENFOLGE DER FILTER:** Gemini beobachtet OHNE Kampfart (Katalogtext
  mit allen 37 IDs, Gruppen-Regeln, „Abwehr ist keine Aktion") → die
  Bewertung (lib/server/claude.ts) filtert die Beobachtung, bekommt Rolle,
  Kampfart-Absatz (Begriffe, erlaubte Techniken, verworfen, Split-Nullen,
  Prüfsätze), nur offene Fragen in `label`/`labelDu`, Zahlenregel (unter 5
  keine Quote, 5–9 „3 von 5", ab 10 Prozent, ab 20 Bandbreite) → commit
  filtert Zähler und Split ein zweites Mal und speichert `variante` und
  `verworfen[]` → die Rechnung (Etappe 3) bildet Signale aus
  `filtereBeobachtung(a.observation, a.sport, a.variante)` und prüft
  `frageGiltFuer` in collectPulls. Weil das Profil immer aus ALLEN Analysen
  rechnet, wirkt der Steckbrief rückwirkend auf den Bestand.
- **Daten:** `lib/gegner-dna.ts` 67 Fragen (neue am Ende ihrer Kategorie,
  Kategorie `cage-space` heißt „Raum & Rand", je Kampfart „Käfig/Ring/Matte
  & Raum"), `frageLabel(id, mode)`, `dnaCompleteness(answers, fragen?)`.
  `lib/fight-stats.ts` `ACTION_GROUPS`, `ActionDef.versucht/gelungen`,
  `CAGE_ZONE_LABEL` neutral (Mitte / Offener Raum / Am Rand),
  `deriveTendencies(stats, zonenPhrase)`, `deriveSuggestions(split, stats,
  { zonenPhrase, mitTakedowns })`. `lib/video-analysis.ts` `variante`,
  `verworfen` (Server setzt), `AnalyzeRequest.sport/variante`,
  `VideoPreview.variante`, `sportFromText` erkennt Kampf-Sambo als MMA.
- **Oberfläche:** Umschalter „Kickboxen / Muay Thai" unter der Kampfart auf
  dem Zuordnungs-Schirm (VideoUploadFlow, nur bei Kickboxen, vom Vorlauf
  vorbelegt, Hilfstext folgt der Wahl; bei Sambo der Satz „Kampf-Sambo …
  wählst du als MMA"). FightProfileView/DnaCategoryGrid/FightInsights/
  FightStatsBlock nehmen `sport` (+ `mode`): Zonen-Wörter, Kartenform
  (Käfig Achteck · Ring Quadrat · Matte Kreis · BJJ keine Karte), nur
  gültige Fragen, Du-Fassung beim Athleten, kein Boden-Plan im Boxen.
- **Messung:** `scripts/test-kampfart-steckbrief.mjs` 65/65 (Daten, Filter,
  Begriffe), `scripts/test-profil-rechnung.mjs` 80/80 (Etappe 3, inkl.
  Steckbrief-Fälle), `scripts/mess-steckbrief-chip.mjs` (Umschalter, beide
  Themes grün), `scripts/mess-e2-schirm.mjs` 20/20 beide Themes. tsc/eslint 0.
  Mit echter KI bewiesen am 17.09. mittags (unten „Beweislauf").
  **Leons Testvideo ist MMA-Sparring** (viel Kickboxen, niemand geht zu
  Boden, bei ~0:20 ein ECHTER Takedown-Versuch) — nicht Kickbox-Sparring;
  das „Ducken bei 31 s" gehört zu `stresstest 1.mp4`.
- **Fallen aus dem Bau:** (1) Nach „ im JS-String mit doppelten
  Anführungszeichen beendet ein ASCII-" den String (TS1005 in claude.ts,
  SyntaxError im Testskript) — typografisches “ oder Template-Literal. (2)
  `fight-stats.ts` darf `kampfart-steckbrief.ts` NICHT importieren
  (Laufzeit-Kreis) — Wörter kommen als Parameter; `video-analysis.ts` ↔
  Steckbrief nur als Typ in die eine Richtung. (3) Die Rohbeobachtung wird
  nie gefiltert gespeichert — sonst wäre der Steckbrief nicht rückwirkend
  und eine falsch gewählte Kampfart unheilbar. (4) Feste Split-Nullen können
  einen Split leeren (Boxen nur mit Bodenzeit) → null, kein erfundener
  Split. (5) Rückfall-ID `submission` in Sambo und BJJ bewusst erlaubt
  (Entwurf 7.5/7.6 zählte nur die feinen IDs). (6) mess-e2-schirm: Der
  Sheet-Schleier ist durch die Tiefen-Animation größer als das Fenster
  (x −14, y −10) — Klick per `page.mouse.click(12, 12)`, nicht „position im
  Element".
- **Beweislauf mit echter KI (17.09. mittags, gefahren vom Fenster „Daten
  sauber", Rohdaten `D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\`):**
  Lauf 1 fälschlich als Kickboxen (Technikprobe), Lauf 2 als MMA, je ~8,5 min,
  Claude je Person ~0,56 €. Hart grün: 0 Takedown-/Boden-IDs in allen vier
  Beobachtungen (5 Bilder/s), `clinch-knee` statt `knee` im Clinch, keine
  gesperrte Frage, Split-Nullen, Profile ohne gesperrte Frage; Kickboxen
  verwarf 2 × `clinch-strike` („variante"). Der Vorlauf kippte zwischen den
  Läufen (mma → kickboxen) — der Trainer bestätigt ohnehin. BEFUNDE: 26–41 ×
  „Käfig" bei Gym-Sparring auf der Matte, Befunde aus Abwesenheit („0
  Takedowns → ein Gegner wird dein Grappling angehen"), summary beim
  Athleten in der 3. Person, rohe Feldnamen („cagePressureSeconds 0") im
  Text, Brüche unter 5 („2 von 3").
- **FLÄCHE UND „NUR WAS VORKAM" (Leon 17.09. nach dem Beweislauf, gebaut im
  Fenster tidal-athletics-3b):** Leons Antworten: „Käfig nur, wenn einer da
  ist" · „Nur was vorkam" · Szene 0:20 „Ja, Takedown-Versuch" · „Du-Fragen
  kürzer".
  - `Flaeche = "kaefig" | "ring" | "matte"` (lib/kampfart-steckbrief.ts,
    `isFlaeche`, `FLAECHE_LABEL`, `flaecheFromText`). Der Vorlauf
    (PREVIEW_PROMPT Regel 6) liefert `flaeche`; `VideoPreview`,
    `AnalyzeRequest`, `VideoAnalysis` tragen sie, commit speichert sie. KEIN
    Schalter auf dem Schirm (Leon: „der Vorlauf merkt sich").
  - Die Wörter für Fläche, Mitte, Rand, Zonen und die Kategorie „… & Raum"
    hängen an der FLÄCHE, nicht mehr an der Kampfart: `begriffe(sport,
    flaeche?)`, `zonenLabel/zonenPhrase(sport, flaeche?)`,
    `kategorieLabel(flaeche?)`. OHNE Fläche neutral („Mitte", „Am Rand",
    „Raum & Rand") — auch bei MMA und Boxen. Der Steckbrief trägt nur noch
    `hatZonen` (BJJ false) und `KampfartBegriffe` (Phasen, Takedown,
    Wertung, Fachwörter); Käfig-Fachwörter (Zaun, Wall-Wrestling, Cage
    Control) kommen nur mit Fläche Käfig. Kartenform folgt der Fläche (Käfig
    Achteck · Ring Quadrat · Matte Kreis · ohne Fläche Achteck).
    FightProfileView/FightInsights/FightStatsBlock/DnaCategoryGrid nehmen
    `flaeche`; die Profil-Fläche (`evidence.flaeche`, häufigste Fläche der
    zählenden Analysen) rechnet Etappe 3, die Seiten reichen sie durch.
  - Claude (lib/server/claude.ts): Grundregel NUR WAS VORKAM (kein Befund aus
    fehlenden Phasen, die summary nennt es einmal), Richtwerte sind nie
    selbst ein Befund, unter 5 Versuchen auch kein Bruch, keine JSON-
    Feldnamen; beim Athleten ALLE Texte in Du-Form; Kampfart-Absatz mit
    Flächen-Satz („Gekämpft wird auf der Matte. „Käfig" … schreibst du hier
    nie"). `labelDu` ist kurz („Wo bist du angreifbar?"); die Aufzählung der
    er-Fassung hängt die Bewertung in Klammern an — außer sie enthält „er"
    oder die Flächen-Aufzählung.
  - `deriveSuggestions(…, { grappling })`: Ringen/Sambo/BJJ ohne „Distanz
    halten gegen Takedowns" und ohne Ground & Pound.
  - `bewertungsPrompt(args)` + `scripts/zeige-bewertungs-prompt.mjs`: den
    fertigen Prompt an einer gespeicherten Analyse ansehen, OHNE KI-Kosten
    (`node --experimental-transform-types --import
    ./scripts/lib/ts-loader-register.mjs …` — gemini.ts nutzt Parameter-
    Properties, die der reine Strip-Modus nicht kann).
  - **Nachweis (Leon: „Günstig: 1 Person"):** Vorlauf live → `flaeche:
    "matte"`, sport mma, 7,2 s. Claude-Bewertung aus der gespeicherten
    Beobachtung Lauf 2 / Person A, vorher → nachher: Befunde 48 → 27, Käfig-
    Wörter 26 → 0, Abwesenheits-Sätze 9 → 1, Feldnamen 70 → 0, summary in
    Du-Form nein → ja, Brüche unter 5 2 → 0, **Claude 0,56 € → 0,32 €**
    (Ausgabe 20.294 → 10.915 Tokens). Der echte Takedown-Versuch (0:20)
    bleibt als Befund. Tests: test-kampfart-steckbrief 70/70,
    test-profil-rechnung 86/86, tsc/eslint 0.
  - **Fallen:** (7) netstat meldet auf deutschem Windows „ABHÖREN", nicht
    LISTENING — wer nach „LISTEN" greppt, übersieht einen laufenden
    Dev-Server und startet einen zweiten (weicht auf 3001 aus). (8) Heredocs
    im Bash-Werkzeug schlucken Backslashes (`\\b` → `\b` → `b`) —
    Ersetzungsskripte mit Regex per Write-Werkzeug in den Scratchpad. (9)
    claude.ts, gemini.ts, video-analysis.ts, VideoUploadFlow.tsx sind CRLF,
    `grep $'\r'` im Bash-Werkzeug erkennt das NICHT — mit Node prüfen.
- **ABNAHME (17.09.2026 nachmittags, Fenster tidal-athletics-95):**
  - Vorschau ohne Kosten, BEVOR Runde 4 stand: Profil per reiner Rechnung
    (`computeProfile` + `stelleZusammen`) aus 3bs Nachweis-Bewertung, auf
    einer temporären /dev-Seite (danach gelöscht). Matte: Karte rund,
    „Mattenmitte / Am Mattenrand", „Matte & Raum", kurze Du-Fragen, 0 × Käfig;
    ohne Fläche: Achteck, „Mitte / Am Rand", „Raum & Rand".
  - Leons Antworten (gewählte Optionen): Matte „Passt so" · Push „Runde 4
    vorziehen" · Auto-Insights „Im Athletenprofil weglassen" · voller Lauf
    „Ja, nach Runde 4" · Vorlauf kippt MMA/Kickboxen „So lassen" · weniger
    Befunde „klingt ok mit beleg", dazu die LÜCKEN-REGEL (Leon: Lücken erst
    über mehrere Videos DERSELBEN Kampfart, z. B. 4 von 5 MMA-Analysen ohne
    eigenen Takedown → offen zu trainieren; ein Stand-Video allein sagt
    nichts) → Bau in Etappe 3 · Commit + Push „Ja".
  - Gebaut: `FightInsights`/`FightProfileView` zeigen bei `mode="athlete"`
    keine Gameplan-/Drill-Vorschläge (sie waren aus Gegnersicht: „Defense &
    Konter gegen Jab" meinte im eigenen Profil den eigenen Jab; die Drills
    schreibt Claude in Du-Form unter „Drills"). Matte-Zone `open` heißt
    „Offener Raum" statt „Kampffläche" (las sich neben „Mattenmitte" wie die
    ganze Matte). Die Zeile „Kampf-DNA" zeigt eine ANZAHL („35 Antworten")
    statt `dnaCompleteness` in Prozent — neben der Helix steht die
    Profilstärke als EINZIGE Prozentzahl. Die Zonen-Legende zeigt absichtlich
    nur die zwei anderen Zonen (Hero-Zahl = dominante Zone), es fehlt keine.
  - **Voller Lauf mit echter KI nach Runde 4 (Leon/Alec, beide Personen):**
    37/37 — Vorlauf live mma + matte, Analyse 6 min 17 s, `flaeche` an beiden
    Analysen und `evidence.flaeche` in main + mma; athleten/[uid] und
    /kampfprofil dunkel + hell: Karte rund, Matten-Wörter, 0 × Käfig, Helix
    und Kopf-Chip = `evidence.staerke` (20 %), „Matte & Raum", Du-Fragen, keine
    Vorschläge, Konsole 0. Texte alt → neu (A / B): Befunde 48/48 → 33/36,
    Käfig-Wörter 26/36 → 0/0, Abwesenheits-Sätze 9/16 → 0/1, Feldnamen 70/79
    → 0/0, summary in Du-Form nein → ja, Brüche unter 5 2/3 → 0/0, **Claude
    0,56/0,58 € → 0,41/0,43 €** (Ausgabe 14–15 Tsd. Tokens; der Nachweis mit
    einer Person lag bei 0,32 €). Rest: zwei Kleinstmengen-Sätze ohne Prozent
    („Teep bei 2 Versuchen einmal gestoppt", „Body Kick 2 Versuche ohne
    Treffer"). Rohdaten + Prüfskripte:
    `D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\lauf3-abnahme\`.
  - **Fallen:** (10) Eine /dev-Seite mit statischem Profil-JSON erzeugt eine
    Hydration-Warnung der Helix (Kommazahlen im `polyline`) — nur weil der
    Server das Profil schon rendert; echte Seiten laden clientseitig. (11) Wer
    eine /dev-Seite löscht, lässt `.next/types/app/dev/<seite>` zurück → tsc
    meldet TS2307, bis dieser Ordner weg ist (Server unberührt). (12)
    Markdown-Links auf Bilder außerhalb der App öffnet Leon im Editor nicht
    („sehe nichts") → per `Start-Process <url|bild>` öffnen. (13)
    `scripts/mess-e3-umschalter.mjs` braucht `--import
    ./scripts/lib/ts-loader-register.mjs` (importiert profile-recompute.ts).
- **KAMPFART AM WETTKAMPF + GAMEPLAN (17.09.2026 abends, Fenster
  tidal-athletics-2d, abgestimmt mit Etappe 3 / e8):** Aus der Frage „welche
  Kampfart zeigt die Wettkampfseite?" wurde Leons Auftrag: „wenn ich einen
  Wettkampf anlege, muss ich auch sagen, was für eine Disziplin gekämpft wird,
  und anhand der Angabe wird der Gameplan zwischen mir und dem Gegner erstellt".
  Leons gewählte Optionen: Umfang „Alles zusammen jetzt" · Bestand „Kampfart
  einmal auf der Seite wählen" · Kleinstmengen „Ausführung ja, Trefferquote
  nein" · Nachweis Bewertung „Ja, 1 Person" · Gameplan „Claude, nur mit Beleg" ·
  „Nach jeder neuen Analyse automatisch" · „Drei Blöcke, Drills in den Plan" ·
  Abnahme „Belege kürzer" · Gegner „Name oder ‚dein Gegner'" · Markieren „Ja,
  auch beim Markieren" · zweiter KI-Lauf „Nein, so committen".
  - **Kampfart am Wettkampf:** `FightCamp.sport` (lib/fight-camp.ts; Bestand
    null). Anlegen: Pflichtfeld „Kampfart" (Select), vorbelegt, wenn der Athlet
    genau EINE Kampfart im Profil hat; der Hilfstext folgt der Wahl. Der
    Plan-Generator nimmt nur die Kategorien der Kampfart
    (`KATEGORIEN_JE_KAMPFART`: Boxen → boxing, Kickboxen → boxing + muay-thai,
    Ringen → wrestling, Sambo → wrestling + bjj, BJJ → bjj, MMA → alle vier).
    Vorher mischte JEDER Plan alle vier — ein Boxkampf bekam Takedowns.
    Bestand: Select „Kampfart wählen" im Kopf der Wettkampfseite, danach Chip;
    der Plan bleibt, wie er ist, der Gameplan startet.
  - **Wettkampfseite:** Athleten-Seite zeigt `fightProfile/{camp.sport}` (ohne
    Video in der Kampfart die Fight-DNA mit Satz dazu), `mode="athlete"` (keine
    Tipps aus Gegnersicht), `flaeche` aus dem Profil, Meta „Profilstärke x %"
    statt „DNA x %", Leer-Texte ohne „übernimm". Gegner-Seite: `sport` des
    Wettkampfs, `flaeche` aus `opponent.evidence` (lebendes Profil).
    OpponentProfileView/OpponentEditor nehmen `sport`/`flaeche` und filtern
    Zähler + Split nach dem Steckbrief (gespeichert wird ungefiltert).
    Gegnerprofil ohne Wettkampf: `ansichtDesProfils(evidence)` in
    lib/kampfart-steckbrief.ts (Kampfart nur bei genau EINER, Fläche aus den
    Videos). Gemessen: Gegner-Neuberechnung schreibt `evidence.flaeche` und
    `kampfarten`.
  - **Gameplan:** Ablage `users/{uid}/fightProfile/gameplan-{campId}` (NICHT am
    Camp: er besteht aus dem DeepFight-Profil; die fightProfile-Regel passt —
    Inhaber + DeepFight-Freigabe lesen, nur Server schreibt, kein Deploy).
    `lib/gameplan.ts` (Typen, `beobachteGameplan` per onSnapshot,
    `starteGameplan`, `drillsFuerPhase`, „hängt" nach 6 min),
    `lib/server/gameplan-prompt.ts` (rein: Voraussetzungen athlet/gegner,
    Prompt mit Beleg je Antwort „4 von 5 Videos"/„Trainer-Eintrag", Sicht je
    Profil, Schema, Normalisierung, Fingerabdruck), `lib/server/gameplan.ts`
    (`schreibeGameplan` mit laufId gegen überholte Läufe und ohne Aufruf bei
    gleicher Eingabe; `betroffeneWettkaempfe`: Athlet = seine anstehenden
    Camps DERSELBEN Kampfart, Gegner = collectionGroup über den vorhandenen
    Index gymId + competitionDate, im Speicher gefiltert;
    `gameplaeneNachAnalyse(db, { mode, targetId, sport, gymId, frist })`:
    höchstens 2 je Nachlauf, ≥ 150 s Restzeit je Aufruf, sonst „offen · zeit").
    Route `POST /api/wettkampf/gameplan` (Tor wettkampf + deepfight + Gegner-
    Gym, antwortet 202, Arbeit per `nachAntwortWeiter`). Nachlauf in commit UND
    flag (e8 setzte flag): `maxDuration = 300`, `frist = Date.now() + 280_000`,
    `nachAntwortWeiter(gameplaeneNachAnalyse(…))` nach der Neuberechnung.
    `lib/server/nachlauf.ts` reicht das Promise an `waitUntil` des Vercel-
    Anfragekontexts (`Symbol.for("@vercel/request-context")`), lokal läuft es
    einfach weiter — OHNE das Paket `@vercel/functions` (Falle 19).
    `components/trainer/GameplanBlock.tsx` (Deine Waffen · Die Gefahren · So
    kämpfst du, Beleg je Punkt, Zustände schreibt/offen/fehler/hängt, „Neu
    schreiben"); Drills „Aus dem Gameplan" in Phase 2/3 von FightCampPlanView.
  - **Gemeinsam mit Etappe 3:** `lib/server/claude-aufruf.ts` `rufeClaude`
    (Opus 5, Streaming, Beta server-side-fallback-2026-07-01 mit `fallbacks:
    "default"`, 5xx → Sonnet 5 außer `nurOpus`, Wortmarke „überlastet", Kosten
    nach `message.model`; Sonnet 5 = 2/10 $), claude.ts nutzt sie.
    `lib/server/ki-kosten.ts` `bucheKiKosten(db, gymId, usage, at, art)` mit
    art analyse|satz|gameplan, `analysisCount` nur bei analyse.
  - **Kleinstmengen (claude.ts Zahlenregel):** unter 5 Versuchen Zählung nur
    als Tatsache, KEIN Urteil aus Treffern („2 Versuche ohne Treffer, bringt
    wenig"), Ausführung mit Zeitstempel ja. Nachweis Person B: Urteile 4 → 0,
    30 Befunde, 0,38 € (vorher 0,43), 146 s — erster Lauf über rufeClaude.
  - **Gameplan-Nachweis mit echter KI** (Person A gegen B aus dem Leon/Alec-
    Video): 81 s, 0,23 € (13.123 ein / 6.589 aus), 4/4/4 Punkte mit Beleg,
    6 Drills in Phase 2/3, 0 Käfig-Wörter, lage nennt „erste Tendenz"; danach
    Leons Abnahme „Belege kürzer" (Kurzform < 70 Zeichen) und „dein Gegner"
    statt er/sein (6 Sätze) in den Prompt — NICHT mehr mit KI nachgemessen.
  - **Messung:** `scripts/test-gameplan.mjs` 42/42 (rein),
    `scripts/mess-gameplan.mjs` 22/22 dunkel + hell (Firestore ohne KI +
    Schirme; `GAMEPLAN_JSON=<nachweis>` zeigt einen gespeicherten echten
    Inhalt), `scripts/zeige-gameplan-prompt.mjs` (Prompt ohne Kosten, ~6.800
    Tokens), test-kampfart-steckbrief 70/70, test-profil-rechnung 86/86,
    tsc/eslint 0. Rohdaten + Bilder:
    `D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\nachweis-2d\`.
  - **Fallen:** (14) `set({ "months.2026-09.x": … }, { merge: true })` schreibt
    einen WÖRTLICHEN Feldnamen mit Punkten (Admin-Seite las 0 € im Monat) —
    Punkt-Pfade nur in `update`; derselbe Pfad darf in EINEM update nur einmal
    stehen (Altfeld + Buchung erst addieren). (15) `npm install <paket>` (mit
    Speichern) entfernt alle per `--no-save` installierten Pakete — Playwright
    war weg (etwa gleichzeitig lieferte der alte Waisen-Dev-Server auf jeder
    Seite 500 mit leerem Body; Neustart heilte ihn, Zusammenhang unbelegt),
    Playwright 1.62.1 (passt zu Chromium 1234) mit `--no-save` zurück. Nach
    jedem gespeicherten Install `Test-Path node_modules\playwright`. (16) Skripte, die lib/server/gameplan.ts
    oder claude.ts laden, brauchen `--experimental-transform-types` (gemini.ts).
    (17) In JSX zwischen Label-Span und Text ein ECHTES Leerzeichen (`{" "}`) —
    ein CSS-Abstand liefert innerText/Screenreader „BelegDu:". (18) Doppelte
    ASCII-Anführung nach „ in einem "…"-String beendet ihn (Falle 1) — auch in
    Konstanten-Objekten; Template-Literale nehmen. (19) PRODUKTION: Nach dem
    Push b770354 antworteten commit, flag, /api/wettkampf/gameplan UND das
    unberührte /api/invites/preview mit 500 — `vercel logs`: ERR_REQUIRE_ESM,
    `jwks-rsa/src/utils.js` ruft `require('jose')` auf jose 6 (nur ESM).
    firebase-admin 14 bringt seit Juni jwks-rsa 4.0.1 mit; Vercels Loader
    (`/opt/rust/nodejs.js`, Projekt steht schon auf Node 24.x) kann kein
    require(esm) — lokal unsichtbar, weil Node 24 es kann. JEDE Route, die
    `lib/server/firebase-admin.ts` lädt (importiert firebase-admin/auth),
    war betroffen, vermutlich seit Juni (Logs reichen nur einen Tag, vorher
    kein Aufruf). Lokal nachstellen: `node --no-experimental-require-module -e
    "require('firebase-admin/auth')"` bzw. Dev-Server mit `NODE_OPTIONS=
    --no-experimental-require-module`. Fix: package.json `"overrides": {
    "jwks-rsa": "^3.2.0" }` (3.2.2 + jose 4.15.9 CJS, Schnittstelle identisch)
    — später prüfen, ob Vercels Loader require(esm) kann, dann Override weg
    (v4-Sicherheitsupdates). `@vercel/functions` v3 brachte zusätzlich eine
    zweite jose 6 über `@vercel/oidc` — raus, `lib/server/nachlauf.ts`
    ersetzt `waitUntil`. Prüfen nach jedem Deploy: POST ohne Token an eine
    Admin-SDK-Route muss 403 liefern, nicht 500.
  - **Offen (Stand 2d, am selben Abend von 5b abgearbeitet — siehe unten):**
    Markieren-Nachlauf zur Laufzeit · Gameplan für den Athleten · Trainer mit
    DeepFight-, aber ohne Wettkampf-Freigabe liest das Gameplan-Dokument ·
    Gegnerprofil-Seite im Alt-Look · Fläche des Wettkampfs.
  - **RUNDE 2: FLÄCHE AM WETTKAMPF + GAMEPLAN FÜR DEN ATHLETEN (17.09.2026
    abends, Fenster tidal-athletics-5b, COMMITTET + GEPUSHT 8b55331, Vercel
    success, Produktion nachgemessen).** Leons Antworten (wörtlich): KI-Nachweis
    „Ja, ca. 0,20–0,25 € (Empfohlen)" · Athlet „Ja, sofort über seine
    Wettkampf-Karte (Empfohlen)" · Fläche (Freitext) „ja vorbelegt nachdem was
    eingetragen worden ist bei der wettkampferstellung" · Abnahme „Passt so
    (Empfohlen)" · dritter KI-Lauf „Nein, so committen (Empfohlen)" · Commit
    „Ja, committen (Empfohlen)" · Push „Ja, pushen (Empfohlen)".
    - **Fläche:** `FightCamp.flaeche?: Flaeche | null` (null/fehlend =
      Vorbelegung). `lib/kampfart-steckbrief.ts`: `FLAECHE_ORT`,
      `STANDARD_FLAECHE` (MMA Käfig · Boxen/Kickboxen Ring · Ringen/Sambo/BJJ
      Matte), `flaecheDesWettkampfs({ sport, flaeche })` (IMMER darüber lesen),
      `flaecheWaehlbar(sport)` (BJJ ohne Feld, `hatZonen`). Anlegen: Feld
      „Fläche" neben der Kampfart (Grid lg 4 statt 3), eine Wahl von Hand gilt
      nur für die Kampfart, zu der sie gewählt wurde, gespeichert wird, was der
      Trainer sah; Hilfstext „… und plant den Kampf im Käfig". Wettkampfseite:
      Select im Kopf (`data-feld="flaeche"`, `data-flaeche`), `handleFlaeche`
      speichert mit `ownerFlag()` und stößt den Gameplan an (die Fläche steckt
      im Fingerabdruck). GameplanBlock-Kopf „MMA · Käfig · A gegen B". Die
      Gegner-Seite behält die Fläche aus SEINEN Videos (`evidence.flaeche`).
    - **Prompt:** `GameplanEingabe.flaeche`, `flaechenSatz(e, flaeche)`: Mitte/
      Rand der Fläche, verbotene Wörter je Fläche (Käfig: „Seile"; Ring:
      Käfig/Cage/Zaun; Matte: alle), Käfig-Wortschatz (Zaun, Wall-Wrestling,
      Cage Control) über `begriffe(sport, flaeche)`. Profile, deren Videos auf
      ANDERER Fläche liefen (`evidence.flaeche`), werden benannt („Die Videos
      deines Athleten zeigen die Matte.") und still übertragen — „ohne diesen
      Satz zu zitieren". Ohne Fläche der neutrale Satz wie bisher. Bestehende
      Gameplans schreiben sich beim nächsten Anlass einmal neu (Prompt anders).
    - **Athlet:** `components/GameplanSheet.tsx` (SheetShell, XKnopf, EIN
      Scrollbereich `min-h-0 flex-1`, Lage + drei Blöcke untereinander +
      „Deine Drills" je Phase + Stand-Zeile, nur lesen, „Claude schreibt deinen
      Gameplan gerade neu" bei status schreibt). `GameplanBloecke` und
      `gameplanZeit` aus GameplanBlock geteilt. app/dashboard/page.tsx
      (`DashboardContent`, NICHT TrainerDashboardContent): `useGameplan` für
      `nextCamp`, Zeile „Dein Gameplan" (`data-aktion="gameplan-oeffnen"`) nur
      mit Inhalt. KEINE Regeländerung: Inhaber liest `fightProfile/*`, und das
      Camp-Dokument mit dem Gegner-Snapshot (Stärken, Notizen) las er schon
      vorher. Trainer mit DeepFight- ohne Wettkampf-Freigabe: bewusst so
      gelassen (Inhalt stammt aus Profilen, die er ohnehin liest; keine UI).
    - **KI-Nachweis** (A gegen B, MMA im Käfig, `LAUF=2 FLAECHE=kaefig`,
      `nachweis-2d/gameplan-A-gegen-B-2.json`): 107 s, **0,30 €** (13.594 ein /
      9.131 aus — über der Ansage 0,20–0,25, weil länger), 3/3/4 Punkte, 5
      Drills in Phase 2/3, Belege Ø 55 / max 63 Zeichen (Lauf 1: Ø 183, 12 von
      12 über 70), „er/sein/ihn" 0 Sätze (Lauf 1: 17), 6 Sätze nutzen den
      Käfig, 0 × Seile, 0 Kleinstmengen-Urteile. Befund: lage zitierte die
      Übertrags-Anweisung fast wörtlich → Satz geschärft (s. o.), NICHT mit KI
      nachgemessen (Leon: „so committen").
    - **Messung:** test-gameplan **53/53** · test-kampfart-steckbrief 70/70 ·
      test-profil-rechnung 86/86 · tsc/eslint 0 · `scripts/mess-gameplan.mjs`
      **38/38 dunkel + hell** (Konsole 0, aufgeräumt 7 Auth / 37 users): Fläche
      im Kopf vorbelegt, Bestand „MMA" → Käfig → Ring schreibt `flaeche` +
      Route „offen · gegner" ohne Claude, Anlegen folgt der Kampfart, Athlet
      öffnet das Sheet über die Karte, und der **Markieren-Nachlauf zur
      Laufzeit**: Prüf-Gegner mit einer Analyse, POST /api/video-analysis/flag
      mit echtem ID-Token → 200 in 790 ms, 1,6 s später Gameplan „offen ·
      gegner", Inhalt bleibt, kein Claude. Aufruf: `BROWSER=1 THEME=dark
      GAMEPLAN_JSON=<…-2.json> node --use-system-ca --experimental-transform-types
      --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gameplan.mjs`
      (nur Markieren: `FLAG=1`). Produktion nach 8b55331: /login 200, POST ohne
      Token an commit/flag/gameplan 403, GET 405, /, /dashboard,
      /trainer/competitions(/new) 307, Chunks 200, 0 × 500 in `vercel logs`.
    - **Fallen:** (20) **Kaspersky bricht HTTPS auf** (Stamm „Kaspersky
      Anti-Virus Personal Root Certificate"): `node` scheitert an
      api.anthropic.com mit SELF_SIGNED_CERT_IN_CHAIN — auch außerhalb des
      Sandkastens, und rufeClaude meldet es als „Verbindungsabbruch …
      überlastet" (sieht aus wie Überlastung!). PowerShell kommt durch
      (Windows-Speicher). Fix: `node --use-system-ca …` für jedes Skript mit
      KI, Identity-Toolkit oder anderem HTTPS. Der Dev-Server lief ohne das
      Flag — ein lokaler Claude-Aufruf aus einer Route würde dort genauso
      scheitern. (21) JS-`\b` kennt keine Umlaute: `\ber\b` trifft „eröffnet"
      und „3er-Handserie" → Pronomen-Prüfungen mit `(?<!\p{L})…(?!\p{L})` und
      Flag `u`. (22) Falle 18 zum dritten Mal — im Prompt-Code UND im
      Test-Label: nach „ nie ASCII-" in "…"-Strings. (23) In einem Grid mit
      optionalem viertem Feld die Spaltenzahl mitschalten (lg 4 ↔ 3), sonst
      eine Lücke bei BJJ.
    - **Roadmap** (Artifact Version 23): neue Station „DF · DeepFight &
      Wettkampf" (Läuft, „Du bist hier") zwischen MO und P3, P3/P4 Seiten
      gedreht, 11 Stationen; Becken 18 Ideen (+ „Genaue Analyse", Leons Wunsch
      16.09.), `--base` 16,8cqw; „Gameplan folgt dem Scouting" als offener
      Schritt der Station (kein Platz im Becken).
    - **Offen:** Gameplan neu, wenn der Trainer das Gegnerprofil von Hand
      ändert (mit Aufschub, damit fünf Änderungen einen Lauf kosten) ·
      /trainer/deepfight/gegner/[id] Alt-Look · Handy-Breite des Sheets nicht
      gemessen · geschärfter Übertrags-Satz ohne KI-Messung · jwks-rsa-Override
      entfernen, sobald Vercel require(esm) kann · Kostenbuchung „gameplan" in
      aiUsage erst beim nächsten echten Lauf über die Route prüfbar (der
      Nachweis lief als Skript ohne Firestore).
  - **RUNDE 3: GAMEPLAN FOLGT DEM SCOUTING + TRAININGSPLAN BEARBEITEN, STUFE 1
    (17.09.2026 abends, Fenster tidal-athletics-d5, abgestimmt mit e8,
    COMMITTET + GEPUSHT 8b55331..c45a410, Vercel success).** Produktion nach
    c45a410: /login 200, POST ohne Token an /api/wettkampf/gameplan/scouting,
    /api/wettkampf/gameplan, commit, flag → 403, GET commit 405, /, /dashboard,
    /trainer/competitions, /trainer/deepfight/gegner → 307, Chunks 200,
    `vercel logs … --status-code 500 --since 20m` leer. Kein Rules-/Index-Deploy
    (collectionGroup gymId + competitionDate besteht). Push: Leon „Ja, pushen
    (Empfohlen)".
    Leons Antworten (wörtlich): Scouting „Ja, mit Aufschub (Empfohlen)" · Plan
    „Ja, Stufe 1 jetzt (Empfohlen)" · KI-Lauf „Ja, ein Lauf ca. 0,30 €
    (Empfohlen)" · Abnahme der Schirme (inkl. Drills doppelt im Sheet) „Passt
    so (Empfohlen)" · Commit „Ja, committen (Empfohlen)".
    - **Scouting-Nachlauf:** `lib/server/gameplan.ts` `merkeScoutingAenderung`
      (betroffene Wettkämpfe gegen den Gegner, an JEDEM Gameplan-Dokument
      `aufschubId` + `aufschubBis` setzen — nichts am Gegner, dessen abgeleitete
      Felder gehören der Profilrechnung) und `gameplaeneNachScouting` (wartet
      `SCOUTING_AUFSCHUB_MS` = 90 s, nimmt die Marke in einer Transaktion ab,
      nur wer sie noch trägt, schreibt; sonst `ueberholt`). Die Schleife mit
      Frist und Höchstzahl ist jetzt `schreibeReihe` (auch für
      `gameplaeneNachAnalyse`, Signatur unverändert). 90 s + 150 s Claude passen
      ins 280-s-Budget. Route `POST /api/wettkampf/gameplan/scouting`
      `{ opponentId }` (Trainer desselben Gyms / Admin, antwortet 202
      `{ wettkaempfe }` NACH dem Markieren, 200 bei 0). Client
      `meldeScoutingAenderung` in lib/gameplan.ts, aufgerufen in `handleSave`
      der Gegnerseite (nach `updateOpponent`), dort Hinweis „Gespeichert. Claude
      schreibt den Gameplan … in 90 Sekunden neu" (`data-gameplan-nachzug`).
      GameplanBlock zeigt während des Aufschubs „Neues Scouting · Claude
      schreibt den Gameplan gleich neu" (`data-gameplan-aufschub`).
      `decodeGameplan` liefert `null` für ein Dokument ohne Status (nur Marke).
      Gleiche Eingabe (nur gespeichert) → `unveraendert`, kein Aufruf.
    - **Plan bearbeiten, Stufe 1:** `FightCampPhaseBlock.geaendert?:
      PlanAenderung` ({ uid, name, at }), `PhasenAenderung`, `PHASE_GRENZEN`
      (0–14 Einheiten, Fokus 400, Notiz 1000), `saeubereAenderung` (Sparring in
      5-%-Schritten, leerer Fokus → PHASE_FOCUS), `planZuletztGeaendert`,
      `updateFightCampPhase` (TRANSAKTION über das ganze phases-Array, sucht die
      Phase per `phase`, schreibt `ownerIsStaff` mit) und
      `beobachteFightCamp` (onSnapshot) in lib/fight-camp.ts. KEINE Regeländerung.
      `components/trainer/PhasenEditor.tsx` (Fokus, zwei Stepper, Notiz,
      Speichern/Abbrechen, Escape). FightCampPlanView: `onPhaseSpeichern` →
      Pille „Bearbeiten" je Phase, MorphSwap Ansicht↔Editor, immer nur EINE
      Phase offen, Stats-Kacheln im Editor ausgeblendet; Notiz-Kasten und
      „Geändert von … · heute" (`aenderungText`); `sicht="athlet"` (Notiz „von
      deinem Trainer", eigener Einordnungstext), `kopf={false}`.
      Wettkampfseite `handlePhase` + `autorName()`.
    - **Athlet:** `components/GameplanSheet.tsx` ist jetzt das Wettkampf-Sheet
      mit Reitern Trainingsplan · Gameplan (`tab: "plan" | "gameplan" | null`,
      Reiter nur mit Gameplan-Inhalt), das Camp kommt LIVE per
      `beobachteFightCamp`, solange das Sheet offen ist. Dashboard-Karte:
      „Dein Trainingsplan" (`data-aktion="plan-oeffnen"`, immer) + „Dein
      Gameplan" (mit Inhalt). Die Drills stehen im Plan-Reiter unter Phase 2/3
      UND im Gameplan-Reiter (abgenommene 5b-Fassung unverändert).
    - **Messung:** tsc/eslint 0 · test-gameplan **64/64** · test-kampfart-
      steckbrief 70/70 · test-profil-rechnung 86/86 · mess-gameplan **60/60
      dunkel + hell** (Konsole 0, aufgeräumt 7 Auth / 37 users): zwei
      Scouting-Änderungen am Stück (erste `ueberholt`, zweite schreibt „offen ·
      gegner"), Phase 2 bearbeiten (nur diese Phase im Dokument, Timestamps
      bleiben, Abbrechen speichert nichts), Gegnerprofil über die UI speichern →
      Hinweis, Marke fällig in 91 s, Zeile auf der Wettkampfseite, **zur
      Laufzeit 91/92 s** später „offen · gegner" ohne Claude; Athlet: Plan-Sheet
      mit Trainer-Änderung, Admin-Änderung erscheint LIVE, Reiterwechsel,
      **Handy 390 px ohne Quer-Überlauf**. Scouting-Route ohne Token → 403.
      Bilder `D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\nachweis-d5\`.
    - **KI-Nachweis** (Skript `nachweis-d5/nachweis-ki-kosten-d5.mjs`, Test-Gym
      `mess-d5-kosten`, danach gelöscht): Stärke „harter Low Kick" nachgetragen
      → Scouting-Nachlauf mit echtem Claude **54 s, 0,122 €** (4.102 ein /
      4.061 aus, Opus 5 — kleine synthetische Profile, darum unter der Ansage),
      Inhalt greift den Low Kick auf, lage zitiert die Übertrags-Anweisung
      NICHT (geschärfter Satz aus 5b damit bestätigt), Belege 37–61 Zeichen.
      `aiUsage/gym-…`: `anzahlJeArt.gameplan` 1, `spentEurJeArt.gameplan` =
      `months.2026-09.spentEur` = 0,122, keine analysisCount, keine Punkt-Felder;
      `aiUsage/summary` gameplan 0 → 1 (echter Betrag bleibt dort). Zweiter
      Lauf ohne Änderung → `unveraendert`, weiter 1 Buchung. Die Pronomen-
      Prüfung schlug einmal an: „check **ihn** früh" meint den Kick, nicht den
      Gegner.
    - **Fallen:** (24) Ein Pronomen-Treffer ist nicht automatisch der Gegner —
      „ihn" für den Kick; die Prüfung liefert Kandidaten, lesen muss man.
      (25) Wegwerf-Skripte mit KI laden `.env.local` NICHT von selbst —
      `hatClaudeSchluessel` ist dann false, der Lauf endet nach 3 s mit „fehler"
      und kostet nichts (Muster aus nachweis-gameplan.mjs übernehmen).
      (26) Screenshot direkt nach einer Hinweiszeile über einem MorphSwap zeigt
      die Layout-Feder mittendrin (Zeile und Knopf überlappen) — 1 s warten.
    - **Roadmap** (Artifact Version 24 gebaut, **Version 25 live** nach dem
      Push, Balken 84 %): Station DF Schritt 7 „Gameplan folgt dem Scouting"
      und NEU 8 „Trainingsplan bearbeiten, Stufe 1" = Fertig,
      9 „Stufen 2–4" + 10 „Kampfart über den Kurs" offen; „Wettkampf-Plan
      bearbeiten" aus dem Becken auf die Route (17 Ideen); die zwei alten
      Kreuzungen geheilt (rubriken 25,5/40, termine 69,5/59 am Hub, gesucht mit
      `tools/roadmap-karte/fit-d5.mjs`); Bau `build-2026-09-17-d5.mjs` (LIVE=1
      nach dem Push), `mess.mjs` verlangt jetzt 17 Ideen, 17 Linien und NULL
      Kreuzungen — alles grün über sechs Breiten.
    - **Offen:** Trainingsplan Stufen 2–4 (Datum verschieben mit Nachrücken,
      Techniken-/Übungs-Picker, Phasenlängen) · Gegnerseite im Alt-Look ·
      jwks-rsa-Override. Drills doppelt im Wettkampf-Sheet (Plan UND Gameplan)
      bleiben so (Leon: „Passt so").
  - **STUFE 2: KAMPF VERSCHOBEN (17.09.2026 nachts, Fenster
    tidal-athletics-12, abgestimmt mit e8).** Leons Antworten (wörtlich):
    „Stufe 2: Kampf verschoben (Empfohlen)" · Gameplan danach (FREITEXT) „nein
    aber eine option einfügen das man direkt einen neuen erstellen lassen
    kann" · Phasen „Wie beim Anlegen neu verteilen" (NICHT die Empfehlung
    „laufende Phase fängt es auf") · Abnahme „Passt so (Empfohlen)" ·
    KI-Nachweis „Nein, so committen (Empfohlen)" · „Ja, committen und pushen
    (Empfohlen)".
    - **EINE Zeitachse für beide Wege** (`phasenZeitachse(startedAt,
      competitionDate)` in lib/fight-camp.ts): Wochen je Phase aus
      `distributePhaseWeeks(planWochen(...))`, danach füllt der Plan die Spanne
      GENAU — eine angebrochene Woche kürzt den AUFBAU, Sparring und Taper
      behalten ihre Länge (sie hängen am Kampf); bliebe dem Aufbau weniger als
      eine Woche (Pläne bis vier Wochen), schrumpfen alle vier im selben
      Verhältnis. Der Generator (`generateFightCampPhases`) rechnet jetzt
      dieselbe Achse — ohne das hielte Leons „wie beim Anlegen" nicht. Damit
      sind zwei Altlasten weg: Der Generator kürzte den TAPER auf die Resttage,
      und bei Camps unter fünf Wochen lagen die letzten zwei Phasen übereinander
      (`weeksTotal` ist im Generator-Input nur noch Beiwerk).
    - **Verschieben:** `verschiebeKampf(uid, campId, neuesDatum, autor, extra)`
      — TRANSAKTION über `competitionDate`, `weeksTotal`, ALLE Phasen und die
      Marke `verschoben` ({ von, auf, uid, name, at }); `ownerIsStaff` muss mit
      (wie bei jedem Camp-Schreibvorgang). `phasenNachVerschiebung` ist rein und
      lässt Fokus, Einheiten, Sparring, Notiz, Techniken und `geaendert` in
      ihren Phasen stehen. Grenzen in `pruefeKampfdatum`: nicht in der
      Vergangenheit, mindestens `PLAN_MIN_TAGE` (4) nach dem Start, höchstens
      `PLAN_MAX_TAGE` (365) voraus, derselbe Termin ist kein Speichern; die
      Meldung nennt immer das erlaubte Datum. `fruehestesKampfdatum` rundet auf
      den nächsten Tag AUF (Start am Mittag). KEINE Regeländerung, kein Deploy.
    - **Oberfläche:** `components/trainer/KampfVerschieben.tsx` (neu) — Feld
      `<input type="date">` mit min/max, VORSCHAU aller vier Phasen mit „2
      Wochen → 6 Tage", Hinweis wenn die LAUFENDE Phase wechselt (bei „wie beim
      Anlegen" kann ein Kampf den Athleten aus dem Schwerpunkt zurück in den
      Aufbau schicken), Schalter „Gameplan gleich neu schreiben" (aus,
      Hilfstext folgt der Wahl) nur mit fertigem Gameplan. Sitzt im Kopf der
      Wettkampfseite, der Knopf „Verschieben" steht NEBEN dem Termin (die
      Chip-Reihe darunter trägt Eigenschaften, nicht Termine). Marke im Kopf
      (`data-verschoben`) und in der Plan-Kopfkarte (`data-plan-verschoben`);
      der Athlet liest im Plan-Sheet „Dein Kampf ist jetzt am … statt am … —
      Mess Trainer 2d hat ihn heute verschoben" (`data-athlet-verschoben`).
      Die Phasenzeile zeigt jetzt „Woche 4–5 · 2 Wochen" AUS DEN DATEN (vorher
      „Woche … · {weeks} Wochen"); unter einer Woche nur die Dauer.
    - **Gameplan:** `GameplanEingabe.wettkampf` ist nur noch `{ name }` — das
      Kampfdatum ist aus dem Prompt und damit aus dem Fingerabdruck
      (`gameplanSchluessel`) heraus. Verschieben kostet also nichts, und der
      nächste Anlass zahlt nicht für ein geändertes Datum. Folge: Jeder
      bestehende Gameplan schreibt sich beim nächsten Anlass EINMAL neu (Prompt
      anders) — dieselbe Lage wie nach der 5b-Schärfung. `starteGameplan(…,
      true)` läuft nur, wenn der Trainer den Schalter setzt.
    - **Messung:** tsc/eslint 0 · test-gameplan **82/82** (neuer Abschnitt
      „Kampf verschoben": 8 Wochen → 3/2/2/1, zwei Wochen später → 4/3/2/1,
      angebrochene Woche kürzt den Aufbau auf 17 Tage bei vollem Taper,
      Zwei-Wochen-Plan ohne Überlappung, Inhalte bleiben, Grenzen, Marke) ·
      test-kampfart-steckbrief 70/70 · test-profil-rechnung 86/86 ·
      `scripts/mess-gameplan.mjs` **74/74 dunkel + hell** (Konsole 0,
      aufgeräumt 7 Auth / 37 users): Vorschau, Vorziehen von 40 auf 25 Tage →
      weeksTotal 4, lückenlose Achse 6/6/6/6 Tage, letzte Phase endet auf dem
      Kampftag, Phase 2 behält Fokus/Notiz/3×/25 %/„Geändert von", Marke im
      Kopf und am Plan, **Gameplan-Dokument unberührt (kein Claude)**; Schalter
      AN auf einem Wettkampf gegen einen Gegner ohne Daten → Route läuft echt
      und landet ohne Claude bei „offen · gegner"; Athlet sieht die
      Verschiebung im Sheet. Bilder + Logs
      `D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\nachweis-12\`.
      Echter Claude-Lauf für den Schalter: Leon „Nein, so committen".
    - **Fallen:** (27) `Start-Process -FilePath npm -ArgumentList run,dev` hat
      den Dev-Server NICHT gestartet, sondern ein Notepad geöffnet (npm ist
      keine .exe; Windows suchte sich ein Programm für die Datei). Dev-Server
      über das Bash-Werkzeug im Hintergrund starten
      (`NODE_OPTIONS=--no-experimental-require-module npm run dev`) und danach
      mit einer Abfrage auf `/login` belegen, dass er wirklich läuft.
      (28) `toLocaleDateString("de-DE", { month: "short" })` liefert je
      ICU-Datenstand „Sep." ODER „Sept." — in Tests nie die Abkürzung
      festschreiben, sondern gegen dieselbe Intl-Ausgabe prüfen.
      (29) Das Datumsfeld rechnet UTC (`new Date("2026-11-11")`), die Seite
      zeigt örtlich — der Feldwert muss aus den ÖRTLICHEN Feldern kommen
      (`datumFeldWert`), sonst steht im Feld ein anderer Tag als im Kopf.
    - **Offen:** Stufe 3 (Techniken-/Übungs-Picker) · Stufe 4 (Phasenlängen von
      Hand) · Gegnerseite im Alt-Look · jwks-rsa-Override. Der Schalter
      „Gameplan gleich neu schreiben" ist noch nicht mit echtem Claude
      gemessen (derselbe Weg wie „Neu schreiben", das seit Runde 1 läuft).
  - **VERSUS-INTRO MIT LEONS TON (17.09.2026 nachts, Fenster 12).** Leon:
    „freesound_community-062864_ese-24142.mp3 liegt in Download, nimm den Sound
    für die Versus-Animation beim Wettkampf" · nach dem Hören: „einen Ticken
    vorne abschneiden vom Sound, ca. 0,7 Sekunden, dann passt".
    - Datei in `public/audio/` (Name behält die Herkunft wie die Timer-Töne),
      160 kbit/s, 24 kHz, ~7 s. Abgespielt in
      `components/trainer/versus-intro.js` (Abweichung 5) über DENSELBEN
      AudioContext wie der synthetische Ton — die Autoplay-Logik (Zeitfenster
      1200 ms, `data-sound` pending/playing/blocked, Stopper) bleibt
      unverändert, neu ist der Zustand `late` (Datei kam zu spät → stumm, statt
      nach dem Aufschlag zu tönen). `holeTon()` holt die Bytes EINMAL je
      Sitzung, schon beim Einhängen des Intros; `spieleTonDatei` startet bei
      `TON_START` 0,7 s, spielt mit `TON_PEGEL` 0,8 und BLENDET über 0,42 s
      aus, wenn das Intro endet (2,75 s) — die Datei ist länger als das Intro.
      Der synthetische `scheduleVersusSound` bleibt Rückfall (Datei lädt nicht
      oder zu langsam), damit das Intro nie stumm wirkt.
    - Messung: `scripts/mess-gameplan.mjs` **76/76 dunkel + hell** (zwei neue
      Zeilen: Intro läuft mit `data-sound="playing"`, Tondatei 200). Playwright
      braucht dafür `--autoplay-policy=no-user-gesture-required`, sonst sperrt
      Chromium den Ton und der Zustand ist immer „blocked".
  - **STUFE 3: TECHNIKEN TAUSCHEN (17.09.2026 nachts, Fenster
    tidal-athletics-a0, alleiniger Baum — e8 und b4 zu, b2 meldete „frei").**
    Leons Antworten (wörtlich): „Stufe 3: Techniken tauschen (Empfohlen)" ·
    Gameplan nach einem Tausch „Nein, Gameplan bleibt (Empfohlen)" · Deckel
    „Höchstens 12 (Empfohlen)".
    - **Was der Trainer darf:** `PhasenAenderung` trägt jetzt `techniqueIds`
      und `exerciseIds` — beide PFLICHT, nicht optional: Der Editor schickt
      immer den ganzen Stand der Phase, und ein Aufrufer, der das Feld
      vergisst, löschte sonst lautlos die Liste. `PHASE_GRENZEN.inhalteMax`
      = 12 gilt für BEIDE Listen. `saeubereAenderung` wirft unbekannte IDs
      weg, dedupliziert, kappt bei zwölf — und prüft die Kampfart NICHT:
      Die filtert das ANGEBOT der Suche, hier würde sie Inhalte wegwerfen,
      die schon in der Phase stehen (Plan von vor der Kampfart, oder Kampfart
      später gewechselt). `updateFightCampPhase` schreibt beide Listen in
      DERSELBEN Transaktion wie Fokus, Einheiten, Sparring und Notiz — die
      Phase trägt weiter EINE Marke `geaendert`.
    - **Das Angebot:** `waehlbareTechniken(sport)` / `waehlbareUebungen(sport)`
      in lib/fight-camp-generator.ts (dort, wo `KATEGORIEN_JE_KAMPFART` schon
      steht — fight-camp.ts darf den Generator nicht importieren, der
      importiert seinerseits `phasenZeitachse`). Sortiert nach den Kategorien
      der Kampfart, darin nach Namen; Übungen mit `category: "any"`
      (Seilspringen, Sprints) passen zu jeder Kampfart und stehen hinten.
      Zahlen: Boxkampf 26 Techniken, MMA 58 (die Kickbox- und MMA-Basics-
      Dateien tragen ebenfalls `category: "boxing"` — die Dateinamen sagen
      nichts über die Kategorie).
    - **Oberfläche:** `components/trainer/InhaltsWahl.tsx` (neu) — Kacheln der
      gewählten Einträge mit dem X der App (`XKnopf`, Wort „Raus"), Zähler
      „7 von 12", darunter `GooeySearch`. Die Trefferliste erscheint ERST mit
      einer Eingabe (eine offene Liste mit 58 Einträgen schöbe „Speichern" aus
      dem Bild), höchstens acht Treffer. Voll → Hinweis „Zwölf ist das Maximum
      — nimm erst eine raus." Die Suche vergleicht über `schlicht()`: nur
      Buchstaben und Ziffern, damit „double leg" das „Double-Leg Takedown"
      findet. `PhasenEditor` reicht `sport` durch und hängt beide Blöcke über
      die Notiz. `FightCampPlanView`: „Empfohlene Techniken" → **„Geplante
      Techniken"**, sobald `geaendert` steht (dasselbe für Übungen), Marken
      `data-plan-techniken` / `data-plan-uebungen`; im Editor bleiben beide
      Blöcke aus (wie die Stats-Kacheln), sonst stünde alles doppelt.
    - **Gameplan unberührt** (Leon: „Nein, Gameplan bleibt"): Der Prompt liest
      die beiden Kampfprofile, nicht die Technikliste der Phase — ein Tausch
      kostet nichts und ändert den Fingerabdruck nicht.
    - **Messung:** tsc/eslint 0 · test-gameplan **98/98** (+16: Reihenfolge,
      unbekannte IDs, Dopplung, Deckel 12 für beide Listen, „kein Array",
      Technik außerhalb der Kampfart überlebt, Angebot je Kampfart und
      Sortierung) · `scripts/mess-gameplan.mjs` erweitert um elf Zeilen:
      leere Phase „0 von 12", Suche ohne Treffer, „double leg" ohne
      Bindestrich findet das Takedown, zwei Techniken, X nimmt genau eine
      raus, Übung mit eigenem Zähler, nach dem Speichern „Geplante Techniken"
      mit Jab und „Geplante Übungen" mit Seilspringen, Phase 1 bleibt bei
      „Empfohlene", Dokument trägt genau die gewählten Listen, andere Phasen
      unberührt, Athlet sieht beides im Sheet.
    - **Fallen:** (30) Playwrights `innerText` liefert den GERENDERTEN Text —
      ein Element mit `text-transform: uppercase` kommt als „0 VON 12" zurück.
      In Messungen case-egal vergleichen. (31) Das tsconfig dieser App hat
      KEIN `target` (= ES5): `\p{L}` mit Flag `u` scheitert an TS1501 — in
      App-Code Zeichenklassen ausschreiben (`[^a-z0-9äöüß]`), Unicode-
      Eigenschaften gehen nur in den Skripten. (32) Technik-Namen tragen
      Bindestriche („Double-Leg Takedown"), die niemand mittippt — jede Suche
      über die Bibliothek normalisiert deshalb erst.
    - **Offen:** Stufe 4 (Phasenlängen von Hand) · Gegnerseite im Alt-Look ·
      jwks-rsa-Override. Der Deckel 12 greift nur beim Hinzufügen; ein
      Bestandsplan mit mehr Einträgen (gibt es heute nicht, der Generator
      schreibt höchstens 12) würde beim Speichern gekappt.
  - **GEGNERSEITE NEU + KOPFBALKEN MIT NAVIGATION (18./19.09.2026, Fenster
    tidal-athletics-e0, alleiniger Baum — a0/b2 meldeten „frei", e8/b4 zu,
    gepusht 23841a4).**
    Leons Antworten (wörtlich): „Gegnerseite neuer Look (Empfohlen)" · Stufe 4
    „Ist egal, kein Stufe 4" · Live-Blick „ich will ein paar dinge ändern" →
    zweite Runde (Freitext, siehe unten) · Athleten „Nur mit Analyse, beim
    Start alle (Empfohlen)" · Kopfbalken „Zurück-Knöpfe nach oben
    (Empfohlen)" · Löschen „Nur beim Bearbeiten, oben rechts (Empfohlen)".
    - **Gegnerseite im Token-Look** (`app/trainer/deepfight/gegner/[id]`,
      Rest von Etappe 3b): Kopf = Glas-Karte (kein PageHead — im Bereich sitzt
      Text immer auf einer Karte), Name `--type-display` OHNE Versalien, Zeile
      „Stil · Auslage · Maße" wie auf der Wettkampfseite, darunter „3 von 9
      Kategorien gescoutet · Profilstärke 67 %" (EINE Zahl, `evidence.staerke`,
      statt „DNA 6 %"). Ring ab sm links vom Namen (72 px), auf dem Handy klein
      (40 px) in der Standzeile — zwei Instanzen, weil der Ring seine Größe als
      Zahl bekommt. Wege: „Video analysieren" (Akzent) · Bearbeiten · Wettkampf
      anlegen · Freigabe (Zähler-Pille); Handy = Raster 2 Spalten. Reiter
      „Übersicht · Kampf-DNA · Statistik" (vorher „Übersicht · DeepFight ·
      Stats") im Muster der Sheet-Reiter (`aria-pressed`, `data-reiter`),
      KLEBEN per `.df-reiter` (globals.css: lg `top: calc(var(--shell-gap) * 2 +
      var(--hd-h))` = 12 px unter dem Kopf der Hülle, mobil 8 px + Notch).
      Übersicht und Statistik je EINE Glas-Karte, Kampf-DNA ohne Rahmen (Kacheln
      sind Flächen, Leerzustand eigene `.t-card` → sonst Glas in Glas).
      „Auf einen Blick" mit + / − / ★ in `--positive/--negative/--warning`
      (vorher Cyan/Pink/#9D7BFA). Freigabe-Text nennt das Kampfprofil (das alte
      „Mein DeepFight" gibt es nicht mehr). 0 Alt-Token, 0 rohe Farben.
    - **Leons zweite Runde (Freitext):** „den Balken oben … mehr nutzen. das
      trainer deepfight kann weg … die interaktion … soll sich je nach offener
      seite verändern und auffällige oder ‚große' navigation anbieten" ·
      „DeepFight / Gegner oben drinnen … klickbar" · beim Bearbeiten „erstmal
      nur das Gegnerprofil … Dinge wie die Fight-DNA sollen nicht beim
      bearbeiten stehen, jedoch wieder die Bereiche von DeepFight … die
      schreibfelder größer angepasster an den nötigen platz" · „das profil
      löschen button soll generell oben rechts stehen" · „der speicher &
      abbrechen button soll weg da automatisch gespeichert werden soll" ·
      Freigabe „eine suche … und die anzeige auf 20 schüler ca. und der rest
      scrollbar" · „wettkampf anlegen … oben in dem Balken … ein button mit
      Gegnerprofil" · „auf der DeepFight seite oben drei Buttons, Deepfight …
      athleten wo dann alle athleten die schon eine Deepfight analyse bekommen
      haben und gegner".
    - **Kopfbalken = Slot** (`components/shell/KopfNavigation.tsx`, NEU): der
      Pfad aus `shellBreadcrumb` ist raus (`lib/shell-nav.ts` exportiert ihn
      noch, ohne Leser). `KopfNavigationProvider` in StaffShell um Kopf +
      Inhalt, `KopfSlot` im StaffHeader (leer = `display:none`, gefüllt mit
      Trennstrich per `::before`), `<KopfNavigation rang>` legt Inhalt per
      PORTAL hinein (Meldung nur beim Einhängen: Kennung + Rang — JSX im
      Kontext-Zustand wäre eine Render-Schleife). Es zeigt GENAU EINE Meldung:
      höchster Rang, bei Gleichstand die jüngste. Rang 1 = Rückweg eines
      `PageHead` (`back` → `SeitenZurueck`: in der Seite `lg:hidden`, im Kopf
      `KopfZurueck` = 44-px-Knopf), Rang 2 = Bereich (DeepFight-Layout), Rang 3
      = Seite mit eigener Absicht. `useHatKopf()` sagt, ob es einen Kopf gibt
      (außerhalb der Stab-Hülle bleibt der Rückweg in der Seite). Ab `lg`; auf
      dem Handy gibt es keinen Kopf, dort bleibt alles in der Seite.
    - **DeepFight-Segmente** (app/trainer/deepfight/layout.tsx,
      `segmenteFuer`): „DeepFight (Wortmarke) · Athleten · Gegner" auf allen
      DeepFight-Seiten; auf Detailseiten trägt das gewählte Segment einen Pfeil
      und `aria-current="location"` — es IST der Weg zurück. `/analyse` hängt
      am Modus (gegner → Gegner, leute → Athleten). Die Glas-Leiste
      (`DeepFightLeiste`) steht nur noch unter `lg`.
      **FORM DER EINTRÄGE — drei Fassungen, Leon hat zweimal nachgesteuert:**
      (1) Segment-Leiste mit Fläche, Kante und Akzentfüllung → Leon: „sieht
      aus wie eine Leiste mit drei Buttons in die Navbar eingepresst … man soll
      sie gar nicht als Buttons wahrnehmen". (2) Reine Schrift
      (`--type-nav-active`, `.kopf-link`, `data-press="quiet"`, keine
      Hover-Fläche) mit gleitendem Akzent-Strich darunter → Leon: „der Strich
      gefällt mir noch nicht, etwas wie links in der Navbar, aber dezenter,
      nicht genau gleich". (3) HEUTE: Schrift + GLAS-KAPSEL `.kopf-lupe` hinter
      dem gewählten Eintrag — Material der Sidebar-Lupe (`.sb-loupe`), aber
      Kapsel statt Zeilen-Radius, kein Glühen, kein Zoom, kein eigener
      backdrop-filter; nach „noch dezenter" Ring 8 % Akzent (Sidebar 28 %),
      Fläche 18 %, Lichtkante gedämpft. Die Kapsel misst den gewählten LINK
      (ResizeObserver + `document.fonts.ready`), setzt sich beim ersten Mal
      ohne Übergang und GLEITET danach (transform/width/height 380 ms,
      reduzierte Bewegung ohne). Aktiver Eintrag: `--accent-text`.
      `KopfZurueck` (Rückweg eines PageHead) ist dieselbe Schrift mit Pfeil,
      der unter dem Zeiger 3 px nach links rückt — keine Kapsel.
    - **Athleten-Bibliothek nur mit Analyse** (`app/trainer/deepfight/
      athleten/page.tsx`): ohne `?fuer=analyse` nur Personen mit ≥ 1 Analyse
      (aus `ladeAlleAnalysen`, EIN Lauf je Sitzung, geteilt mit der Landung),
      Leerzustand mit Knopf „Athlet analysieren" → `?fuer=analyse`; über
      „Analyse starten" weiter ALLE, die man sehen darf. Die Freigabe-Hinweise
      der Gruppen erscheinen damit praktisch nur noch in der Auswahl.
    - **Bearbeiten speichert von selbst:** `OpponentEditor` hat zwei Arten —
      `onSubmit` (Anlegen, Knöpfe) oder `onChange` (Bearbeiten, KEINE Knöpfe,
      jede Änderung sofort, Name ungekürzt auch leer). Split, Statistik und
      Auto-Insights sind aus dem Editor RAUS (auch beim Anlegen — dort waren sie
      leer); `sport`/`flaeche`-Props gestrichen. Alle Textfelder sind
      `components/ui/WachsendesFeld.tsx` (NEU: Höhe = scrollHeight + 2 px Rand,
      nachgemessen bei neuem Wert UND neuer Breite per ResizeObserver; `resize`
      des Aufrufers wird überstimmt) — auch die Antworten im
      GegnerDnaAccordion (min. 2 Zeilen). Die Seite speichert 900 ms nach dem
      letzten Tastendruck (`speichernJetzt`: höchstens EIN Schreibvorgang,
      Versionszähler, wer währenddessen tippt, bekommt einen zweiten), beim
      Verlassen sofort („Fertig", Aushängen, Tab weg per visibilitychange).
      Leerer Name = alter Name bleibt, alles andere speichert („Ohne Namen
      bleibt der alte"). Die Meldung an den Gameplan (`meldeScoutingAenderung`)
      geht 5 s nach dem letzten Speichern bzw. sofort bei „Fertig" — nicht bei
      jedem Tastendruck. Statuszeile `data-speicherstand` (ruhig · wartet ·
      speichert · gespeichert · fehler mit „Nochmal"); bei Fehler bleibt der
      Editor auf. `updateOpponent` schreibt Split/Zähler ohnehin nicht (gehören
      der Profilrechnung) — das Autospeichern kann nichts aus den Analysen
      überschreiben. „Profil löschen" nur beim Bearbeiten, oben rechts in der
      Kopfkarte, Rückfrage als `role="alertdialog"`-Streifen; nach dem Löschen
      schreibt nichts mehr (`geloescht`).
    - **Freigabe:** GooeySearch (Name + E-Mail), Zähler „3 von 32
      freigegeben", Liste `max-h-[min(33rem,60vh)]` = ~20 Namen, Rest scrollt.
    - **Wettkampf anlegen** mit `?opponent=`: PageHead-Rückweg „Gegnerprofil"
      → im Kopf „← Gegnerprofil".
    - **DIE SUCHE DER GANZEN APP (Leon 19.09.2026: „ein permanentes
      Suchsymbol, das soweit die Berechtigung des Benutzers langt immer
      app-weit sucht"; Antwort „Gleich in dieser Runde").**
      `lib/app-suche.ts` (NEU) + `components/shell/AppSuche.tsx` (NEU).
      - Quellen je Rolle, JEDE mit dem Leser ihrer Seite (keine neue Abfrage,
        keine Regeländerung): alle — Seiten aus `shellNavGroups(rights)` +
        `SHELL_ACCOUNT_ITEMS`, Techniken (`ALL_TECHNIQUES` → `/techniques/{id}`),
        Kurse (`TRAINING_BLOCKS` → `/schedule`), Pläne des Gyms + eigene;
        Trainer/Admin — Athleten (`listAllStudents`, ohne Ghost →
        `/trainer/athleten/{uid}`), Gegner (`listOpponentsForGym`), Wettkämpfe
        (`listAllFightCamps` mit derselben `wettkampf`-Freigabe der Kollegen
        wie der Wettkampfbereich, Zusatz „Athlet gegen Gegner · Datum"),
        Analysen (`ladeAlleAnalysen`, derselbe Fächer/Cache wie die
        DeepFight-Landung, Link wie dort `/analyse?…&analyse=`), Trainer-Pläne;
        Athlet — eigene Wettkämpfe (`listFightCamps` → `/dashboard`, dort liest
        er sie im Sheet), freigegebene Gegner (`listOpponentsSharedWith` →
        `/deepfight/opponents/{id}`), für ihn freigegebene Trainer-Pläne; reine
        Verwaltung — Mitglieder → `/verwaltung/mitglieder`.
      - Laden: erst mit dem ERSTEN Buchstaben, je Quelle ein Promise, 5 min
        Speicher je Konto + Rechte (`suchQuellen`); jede Gruppe erscheint,
        sobald sie da ist, eine Zeile „kommen gleich dazu" solange eine lädt.
        Eine abgewiesene Quelle fällt still auf „nichts" zurück.
      - Treffer: `schlicht()` (nur a–z, 0–9, äöüß — Falle 31/32), alle
        Wörter müssen vorkommen (Titel, Zusatz oder `auch`), Rang Titelanfang >
        Wortanfang > irgendwo; höchstens 5 je Gruppe + „und N weitere — tipp
        genauer".
      - Orte: Desktop-Kopf der Stab-Hülle rechts (`GooeySearch nurSymbol`,
        44 px Lupe, Breite per matchMedia, siehe unten),
        Treffer als Karte darüber, Klick daneben/Escape/Seitenwechsel
        schließt. Der KURS BLEIBT SICHTBAR, auch bei offener Suche (Leon
        19.09.: „der Kurs rechts soll weiterhin sichtbar bleiben") — er ist
        das Einzige im Kopf, das schrumpft (Name mit „…"); der Slot ist
        `shrink-0`, das Feld geht ab 1440 px auf 300, darunter auf 220 px auf,
        und unter 1440 px steht vom Gym nur das Kürzel (sonst blieb bei 1280
        vom Kurs nur „M."). Unter xl fehlt der Kurs ganz. Handy (Stab): oben in
        der Schublade, Treffer im Fluss über dem Menü. Athleten: Platz
        „Suche" in der `AthleteTabBar` (nur ohne `onOpenMenu`) → SheetShell
        mit offenem, fokussiertem Feld (`GooeySearch offenStart`, NEU) und EINEM
        Scrollbereich; auf alten Seiten mit Navbar zusätzlich die Lupe dort
        (Desktop in den Kontrollen, Handy links vom Menü-Knopf; unter sm liegt
        die Trefferkarte fest am Fensterrand).
      - Gemessen im Blick-Skript: „kick" → Pläne 2 · Techniken 5 (13) · Kurse
        4; „mess gegner" → Gegner 1 · Analysen 2; „jab" → Techniken 4; 1440 und
        1100 px ohne Überlauf; Handy-Schublade.
    - **Messung:** tsc/eslint 0 · `scripts/mess-gameplan.mjs` erweitert
      (Gegnerseite neu: Alt-Token 0, Glas-Kopf, Name ohne Versalien, jeder Text
      der Übersicht/Statistik auf einer Karte, Reiter kleben 12 px unter dem
      Kopf, Kopf-Segmente + „Gegner" als Rückweg, „Wettkampf anlegen" → „←
      Gegnerprofil" → zurück, Athleten-Bibliothek nur mit Analyse / Auswahl
      mit allen, Freigabe ~20 + Scroll + Suche + Speichern, 390 px ohne
      Überlauf; Bearbeiten auf dem Prüf-Gegner OHNE Daten: keine Fight-DNA,
      kein Speichern/Abbrechen, Löschen oben rechts, speichert von selbst,
      „Fertig" → Scouting-Hinweis; Suche als Trainer: Gegner, Wettkämpfe, Analysen, „jab" → Techniken, Escape schließt; Suche als Athlet: Feld sofort fokussiert, eigene Wettkämpfe, KEINE Athleten/Analysen, der nicht freigegebene Gegner bleibt unsichtbar). **109/109 dunkel + hell** (Konsole 0, aufgeräumt 7 Auth / 37 users). Prüfkopie (git worktree auf HEAD + NUR diese Dateien, ohne die parallelen Workout-Plan-Änderungen von Fenster 04): tsc 0, `next build` grün (152 Seiten).
    - **Fallen:** (33) Die Bearbeiten-Prüfung MUSS auf einem Gegner ohne Daten
      laufen: Jede gespeicherte Änderung meldet das Scouting, und auf dem
      Käfig-Gegner (Gameplan mit Inhalt) schriebe der Nachlauf nach 90 s mit
      ECHTEM Claude neu (~0,12–0,30 €). (34) `GooeySearch` ist eingeklappt eine
      Pille (`role="button"`, `aria-label` = label) — Playwright muss sie erst
      antippen, bevor es ein `input` gibt. (35) Der Dev-Server läuft ohne
      `--use-system-ca`: Die Token-Prüfung einer Admin-SDK-Route holt Googles
      Zertifikate über HTTPS — Kaspersky kann das verzögern (gemessen 13,8 s
      und 403 beim ersten Aufruf nach dem Kaltstart, danach 202 in 1,7 s).
      Der zweite Lauf auf dem warmen Server war grün. (36) Heredocs im Bash-Werkzeug über ~8 KB brechen
      ab („unexpected EOF") — große Textblöcke per Write-Werkzeug; und in
      `node -e '…'` mit Template-Literalen werden `\\/` und `\\n` still
      verschluckt → Regex-Zeilen danach mit dem Edit-Werkzeug nachziehen.
      (37) ZWEI FENSTER IM SELBEN BAUM (19.09., Fenster 04 baute parallel die
      Kurs-Zuordnung der Workout-Pläne): Der Dev-Server schickt einen
      Kompilierfehler aus IRGENDEINER Datei an ALLE offenen Seiten — ein
      fremder Zwischenstand landet als Konsolenfehler im eigenen Messlauf
      (dann abstimmen und wiederholen). Ein Aufräum-Skript darf nur die
      EIGENEN Prüfkonten löschen (mess-kz@ von 04 fiel sonst mit). Vor dem
      Commit mit fremden Änderungen im Baum: git worktree auf HEAD, nur die
      eigenen Dateien hineinkopieren, node_modules als Junction, tsc +
      `next build` — so baut es auch Vercel.
    - **Offen:** `ErrorState` (15 Aufrufer) steht noch im alten Look
      (`blood`, `rounded-sm`) — Waise, nicht in diesem Fenster · Kopfbalken auf
      Seiten OHNE PageHead-Rückweg bleibt leer (nur Gym + Kurs) — weitere
      Seiten können `KopfNavigation` nutzen · `MatchupBlock` (Athletenprofil,
      33 Alt-Token) und `athleten/[uid]` (e8) im Alt-Look · der aktive
      Kopf-Knopf trägt den Gym-Akzent auch im Gegner-Modus (der Kopf liegt
      außerhalb von `[data-area]`).
  - **NAVIGATION IM KOPF AUF ALLEN SEITEN (19.09.2026, Fenster
    tidal-athletics-69, gepusht 1ef5726).** Leons Antworten (wörtlich): „Balken
    oben überall (Empfohlen)" · was hineinkommt: „Sprungmarken (Empfohlen),
    Umschalter der Seite (Empfohlen)" — Nachbarseiten und Hauptaktion
    ausdrücklich NICHT · Mitgliederliste „Gruppen weglassen (Empfohlen)" ·
    „Passt, weiter".
    - **Drei neue Bausteine** in `components/shell/KopfNavigation.tsx`:
      `KopfUmschalter` (Knöpfe mit `aria-pressed`, der Zustand bleibt in der
      SEITE — oben und unten zeigen denselben Wert), `KopfSprungmarken`
      (Abschnitte einer langen Seite) und `KopfZeile` (Rückweg + zweite
      Navigation nebeneinander, getrennt von `.kopf-trenner`). Die Glas-Kapsel
      liegt jetzt als `useLupe`/`LupenKapsel` unter ALLEN Leisten und misst
      `[data-kopf-gewaehlt]` statt `[aria-current]` — Knöpfe und Anker tragen
      kein `aria-current`.
    - **Sprungmarken:** Sie zeigen nur, was im Dokument steht (Abschnitte
      kommen mit den Daten), bei weniger als zwei Zielen gar nichts. Gemessen
      wird gegen die UNTERKANTE des Kopfs plus 16 px — derselbe Wert für den
      Sprung und für die Frage, welcher Abschnitt dran ist. Nach einem Klick
      schweigt der Spion 900 ms (Falle 41). Am Fuß der Seite gewinnt der letzte
      Abschnitt. Eingebaut: Wettkampfseite („Duell · Gameplan · Trainingsplan",
      `id="duell"` neu) und Wettkampfliste („Geplant · Vergangene ·
      Archiviert", `Section` bekam eine `id`).
    - **Umschalter:** /regeln + /quiz „MMA · BJJ · Boxen", /help „Für Trainer ·
      Für Athleten". Die alten Reiter in der Seite tragen `lg:hidden`, sobald
      `useHatKopf()` — auf dem Handy bleiben sie.
    - **Rückwege:** verwaltung/{mitglieder,einladungen,neuigkeiten} (zeigten
      FALSCH auf „Trainer" — wer nur Verwaltungsrechte hat, kommt auf /trainer
      nicht hinein), /timer, /techniques, /techniques/[id], /library nutzen
      jetzt `SeitenZurueck`; der Link in der Seite trägt `min-h-hit` (44 px)
      und `data-seiten-zurueck`.
    - **`.kopf-neben` (globals.css):** Wird es eng, tritt die ZWEITE Navigation
      zurück, nie der Rückweg — unter 1280 px und sobald die Lupe im Kopf
      aufgeht (`header:has([data-app-suche="kopf"] [data-open])`).
      `display: contents` hält Trenner und Leiste im Flex-Fluss des Slots.
      Ohne die Regel: Slot 535 px, Kopf 71 px über die Seite (Falle 40).
    - **Messung:** tsc/eslint 0 · `scripts/mess-gameplan.mjs` um `kopfUeberall`
      erweitert (Kopftext, Sprung 16 px unter dem Kopf, Kapsel folgt
      oben/unten, Suche auf → Marken weg + Rückweg bleibt + Überlauf 0,
      Regeln-Umschalter wechselt den Inhalt, Timer-Rückweg oben) plus zwei
      Handy-Prüfungen (kein Kopf, drei Reiter in der Seite, „← Techniken" 44 px)
      → **117/117 dunkel + hell**, Konsole 0. Prüfkopie: tsc 0, `next build`
      grün (152 Seiten).
    - **Neue Fallen:** (38) Ein ABGEBROCHENES Blick-Skript räumt nicht auf —
      vor jedem Blick auf Listen erst nachsehen, was schon in Firestore liegt
      (`scripts/tmp-aufraeumen-e0.mjs`). (39) `StaggerList` reicht bei
      reduzierter Bewegung NUR `className` durch — eine `id` für eine
      Sprungmarke geht dort verloren, den Rahmen drumherum auszeichnen.
      (40) Der Kopf-Slot schrumpft nicht (siehe `.kopf-neben`). (41) Beim
      weichen Blättern zieht das Fenster durch alle Abschnitte — ohne die
      900-ms-Sperre nach dem Klick flackert die Glas-Kapsel über die ganze
      Leiste, statt zum Ziel zu gleiten.
    - **Offen:** Seiten ohne Reiter und ohne Abschnitte (Dashboard, Kursplan,
      Athletenliste, Trainer-/Verwaltungs-Übersicht, /profile, /admin) haben
      oben weiter nur Gym und Kurs · /kampfprofil (KampfartUmschalter) gehört
      Fenster e8 · /regeln, /quiz, /help stehen komplett im Alt-Look.

### Pipeline (Zwei-Phasen-Betrieb — WICHTIG)
- **Phase 1 Gemini** (Beobachtung A+B) und **Phase 2 Claude** (Bewertung C+D+E)
  laufen als **getrennte Requests** an `POST /api/video-analysis/analyze`:
  Phase 1 mit `observeOnly:true`, Phase 2 mit `observation` (Gemini wird dann
  übersprungen). Grund: **Vercel Hobby kappt Requests hart nach 300 s**
  (`maxDuration` max. 300; in Produktion nachgewiesener Timeout, als beide
  Stufen in einem Request liefen). Richtwerte 8-Min-Video: Gemini 2–4 Min,
  Claude 1–4 Min.
- Der Client orchestriert (`VideoAnalysisSection.handleStart`): 3× Auto-Neustart
  mit 20-s-Countdown; retryfähig sind Fehlermeldungen mit **„überlastet"** oder
  **„kein Ergebnis"** (Timeout/Stream-Abriss) — diese Wortmarken nicht ändern!

### Gewichtung & Merge (2026-08-20 bis 16.09.2026 — HISTORIE)
**Dieser Abschnitt beschreibt das Klick-Modell VOR der Automatik.** Seit
Etappe 1 (oben) gibt es kein `applyAll`, kein `mergeDnaSplit` im Aufrufer,
keine Übernahme-Marken; Split, Zahlen und Texte rechnet
`lib/profile-evidence.ts` aus allen Analysen. Was hier steht, erklärt
Kommentare im Altbestand und warum die Regel `readTarget frisch lesen`
entstand (heute: Transaktion im Server).
- **Ein Video ≠ halbes Profil.** `dnaSplit` wird über einen echten gewichteten
  Mittelwert gemergt (`mergeDnaSplit` in `lib/fight-stats.ts`):
  `split_neu = (split_alt · W + split_video · w) / (W + w)`. Dafür trägt jedes
  Merge-Ziel die Gewichtssumme **`dnaSplitWeight`** (`fightProfile` bzw.
  `opponents/{id}`). Vorher lief das als `(alt + neu) / 2` — das gab JEDEM
  neuen Video pauschal 50 %, egal wie viele Kämpfe schon drin waren.
  `dnaSplitWeight = 0` (Bestandsprofile) → der neue Split wird voll übernommen.
- **`w` = Aktualität × Abdeckung × Identifikationssicherheit**, geklemmt auf
  0,2–1,0 (`computeVideoWeight` in `lib/video-analysis.ts`). Quellen:
  Trainer-Dropdown `recency` (`FIGHT_RECENCY_WEIGHT`, Standard „unknown" = 0,8
  — fehlendes Wissen ist KEIN Strafabzug), `meta.coverage` per Stichwort-Match
  (`coverageWeight`, unbekannt → 0,8) und `identification.idConfidence`.
- **Bewusst NICHT in der Gewichtung:** `meta.estimatedAge` und
  `meta.opponentLevel`. Beides sind reine Bildschätzungen des Modells — es gibt
  weder ein Kampfdatum noch Gegnerdaten im Input. Ebenso `evaluation.merge.weight`
  (Claudes Selbsteinschätzung): wird weder gerechnet noch angezeigt.
- **Split ist normiert & video-exklusiv** (seit 2026-08-20): `cleanDnaSplit`
  normiert jeden gespeicherten Split per Largest-Remainder auf Summe EXAKT
  100 (idempotent — normierte Werte bleiben beim erneuten Säubern gleich);
  `mergeDnaSplit` normiert BEIDE Seiten vor dem Mittel. Roh-Summen ≠ 100
  (Modell liefert 95/108, Feld-Rundung erzeugt 99/101) wirkten vorher als
  verstecktes Zusatzgewicht. Die manuelle Eingabe von Split UND
  Technik-Statistik wurde ENTFERNT: `FightDnaSplit` und `FightStatsBlock`
  sind reine Anzeige, `OpponentEditor` reicht beide Werte nur unverändert
  durch (damit Speichern anderer Felder sie nicht löscht) — einzige Quelle
  ist die Video-Analyse. Altbestände heilen ohne Migration beim nächsten
  Speichern/Merge; die Anzeige normalisiert ohnehin.
- **`actionStats` werden weiterhin nur summiert**, nie gewichtet — es sind
  Zählungen; „3,7 Versuche" wäre nicht interpretierbar.
- **Die Zahlen laufen je Analyse nur EINMAL ins Profil** (Leon 14.09.2026):
  `applyAll` liest die Übernahme-Marken der Analyse frisch aus Firestore
  (`getVideoAnalysis`) und überspringt Split und Stats, wenn `appliedStats`
  schon gesetzt ist. Vorher wurde die Marke gesetzt, aber nie gelesen —
  ein zweiter Klick (möglich, sobald sich ein Konflikt von außen auflöst)
  addierte Versuche und Treffer erneut und mischte den Split ein zweites
  Mal ins Gewicht. Die Befunde laufen unverändert weiter. Ein Klick in
  derselben Sekunde aus zwei Tabs bliebe nur mit einer Transaktion dicht.
- **DNA-Freitext bleibt manuell**: harter Ersatz pro Frage-ID, Konflikte nur
  per „Ersetzen". Das Gewicht erscheint dort nur als Anzeige (aufgeschlüsselt
  im Ergebniskopf).
- Das Feld `recency` wird auf der Analyse gespeichert und geht additiv in den
  Claude-Prompt: bei „unknown" ist der Prompt **zeichengleich** zu vor der
  Einführung (verifiziert) — Regression-Schutz beim Ändern von `userPrompt`.
- **`readTarget` liest IMMER frisch aus Firestore — in BEIDEN Modi. Nie wieder
  auf den React-Prop umstellen.** Der Gegner kam früher aus dem Prop; arbeiten
  mehrere Trainer am selben Profil, überschrieb ein veralteter Prop den Beitrag
  eines anderen komplett (Split, `dnaSplitWeight`, `actionStats`). Das Fenster
  war kein Millisekunden-Rennen, sondern die **Standzeit eines offenen Tabs**.
  Aus demselben Grund prüft `isConflict` beim Übernehmen gegen den frisch
  gelesenen Stand (3. Parameter), nicht gegen den Anzeigestand — sonst ginge
  eine inzwischen von anderer Seite gesetzte Antwort als konfliktfrei durch.
- Analysieren selbst ist unkritisch: jede Analyse ist ein eigenes Dokument in
  der Subcollection. Nur das Übernehmen schreibt ins gemeinsame Profil.

### Fortschrittsanzeige (0–100 %, seit 2026-08-20)
- `useAnalysisProgress` in `VideoAnalysisSection.tsx`. Zwei Schätzer parallel,
  angezeigt wird der höhere; der Wert **fällt nie** (auch nicht beim
  Auto-Neustart) und wird pro Tick nur zu 25 % nachgezogen.
  1. **Echtes Signal**: Upload-Bytes (XHR) und die Zeichenzahl der
     Claude-Antwort — NDJSON-Event `{"type":"progress","chars":N}`, gespeist aus
     `stream.on("text")` in `claude.ts`, gedrosselt alle 250 Zeichen, Nenner
     `EXPECTED_EVALUATION_CHARS`.
  2. **Zeitschätzer** `1 − e^(−t/τ)` (`PHASE_TAU`), gedeckelt bei 92 % — nur er
     überbrückt die Gemini-Phase, die **kein** Signal liefert
     (`:generateContent` ist blockierend; Streaming-Umbau bewusst offen).
- Bänder aus `PHASE_SHARE` (upload 30 / gemini 42 / claude 25 / save 3), auf die
  tatsächlich laufenden Phasen normiert (YouTube → kein Upload-Band).
- τ-Werte sind Schätzungen und dürfen an reale Laufzeiten angepasst werden.

### Resume & Wiederverwendung (Token-/Zeitersparnis)
- localStorage-Key `ta-video-analysis-form:{mode}:{targetId}` hält:
  Kämpferbeschreibung, `pendingUpload` (Gemini-Datei, 48 h gültig) und
  `pendingObservation` (fertige Gemini-Beobachtung mit **Fingerprint** über
  Video+Beschreibung+Stufe). Jede geschaffte Stufe bleibt geschafft: Retry
  überspringt Upload und/oder Gemini („Analyse fortsetzen"-Button).
- Erfolgreiche, gespeicherte Analyse räumt ALLES auf (Felder, localStorage,
  Video wird serverseitig bei Google gelöscht). Fehlversuche: Google-Auto-
  Expiry nach 48 h. In Firestore landet nie das Video, nur Ergebnisse.

### Upload (Vercel-4,5-MB-Limit umgangen)
- Browser lädt **direkt zu Google** (Resumable Session): `POST /upload` liefert
  nur die Upload-URL (Key wird beim Start per **Header** übergeben → URL
  enthält keinen Key, verifiziert). XHR mit Prozent-Fortschritt + Wake-Lock
  (`use-wake-lock.ts`), Vollbild-Loader-Overlay (`.ai-loader-*` in globals.css).
- **Googles finale Upload-Antwort ist CORS-blockiert** (kein
  Access-Control-Allow-Origin) → Client toleriert das; Server bestätigt den
  Upload via `POST /resolve-upload` über den einmaligen displayName
  (`va-<uuid>-…`). Status-Polling via `POST /file-status`.

### Modelle & Resilienz (lib/server/)
- **Gemini** (`gemini.ts`): Ketten `gemini-flash-latest→3.6→3.5` bzw.
  `pro-latest→3.1-pro-preview`. 503/5xx → Retry + nächstes Modell; **429 →
  direkt nächstes Modell (Free-Tier-Quotas gelten PRO Modell)**. Achtung:
  `gemini-2.5-*` ist für neue API-Keys abgeschaltet; Key ist Free Tier →
  **Pro-Modelle haben Limit 0** (Detail-Analyse braucht Google-Billing).
- **Claude** (`claude.ts`): `claude-opus-5` (Env `CLAUDE_MODEL`). **Structured
  Outputs sind für das VideoEvaluation-Schema UNMÖGLICH** („compiled grammar
  is too large", verifiziert) → Schema als Prompt-Text + `parseModelJson` +
  `normalizeEvaluation`. Bei 529/5xx: Fallback auf `claude-sonnet-5` — **NUR
  bei Standard-Analysen. FESTE VORGABE: Detail-Analyse (tier=pro) NIE unter
  Opus**; dort stattdessen „überlastet"-Meldung → Client-Auto-Neustart.
- Ohne `ANTHROPIC_API_KEY` läuft Stufe 2 gratis über Gemini Flash
  (`evaluateWithGeminiFallback`).

### Kosten-Tracking
- Claude-Token je Analyse → Firestore `aiUsage/summary` (increment; Löschen
  einer Analyse reduziert bewusst nicht). Preise in
  `claude.ts → priceFor()` (EUR≈USD, Schätzung — Anthropic hat keine Saldo-API).
- **DIE VERBRAUCHSANZEIGE IST SEIT 08.09.2026 BETREIBER-SACHE** (Leon:
  „der Ring und die Anzeige, was es verbraucht hat, soll für alle entfernt
  werden"): `AiBudgetGauge.tsx` ist gelöscht — mit ihr der orangene
  Guthaben-Ring in der Analyse-Sektion UND der letzte `window.prompt()` der
  App. Was eine einzelne Analyse gekostet hat, steht weiterhin an ihrer Zeile,
  aber nur für `rights.admin`. Die Karte „KI-Guthaben" auf `/admin` bleibt
  unberührt; sie liest `getAiUsageSummary()` direkt und hat ihre eigene
  Euro-Formatierung. `formatEur` wohnt seither in `lib/video-analysis.ts`.
  Was Leon im Admin-Bereich zusätzlich will — Monatskosten, welches Gym am
  meisten verursacht — steht im Backlog („KI-Kosten je Gym"); heute ist es
  nicht rechenbar.
- **GEMINI WIRD GEBUCHT — SCHRITT 0 DES GESCHÄFTSPLANS (20.09.2026, Fenster
  tidal-athletics-f1).** Bis dahin buchte die App NUR Claude: `preisJeMillion`
  in claude-aufruf.ts kannte keine Gemini-Modelle (→ `[0, 0]`), und
  `generateContentOnce` las `usageMetadata` gar nicht erst aus. Jede „Ø-Kosten
  je Analyse" war damit eine Untergrenze; seit dem Bezahltarif (16.09.) fehlte
  echtes Geld in jeder Auswertung. Die Routen `preview` und `rahmen` buchten
  nichts, abgebrochene Versuche auch nicht. Gefunden bei der Preisfindung für
  DeepFight (vier Agenten-Recherchen, Plan-Artifact „Das zweite Gym").
  - **`lib/server/gemini-kosten.ts` (NEU):** `preisJeMillionGemini` mit
    Listenpreisen Stand 16.09.2026 (3.8 Flash 0,75/3,75 → **datierte
    Umschaltung auf 1,50/7,50 am 01.01.2027 im Code**; 3.5 Flash 1,5/9;
    3.5 Flash-Lite 0,3/2,5; 3.1 Pro 2/12 bis 200 Tsd.). Unbekanntes Modell →
    teuerster Flash-Satz UND eine Warnung je Modell und Prozess — lieber zu
    hoch als still zu niedrig. `kostenAusGeminiUsage` liefert dieselbe Form
    wie Claude (`AnalysisUsage`); Denk-Tokens zählen als Ausgabe, Video als
    Eingabe, Audio NICHT gesondert (kein eigener Satz auf der Preisseite).
    `bucheGeminiKosten(adminDb, gymId, usage)` wirft nie und nimmt `adminDb`
    als FUNKTION, damit auch ein fehlendes Admin-SDK gefangen ist.
  - **`gemini.ts`:** `GeminiUsage` (promptTokens, outputTokens, thoughtTokens,
    `modelVersion` = das Modell, das WIRKLICH geantwortet hat — hinter
    `gemini-flash-latest` steckt ein konkreter Stand, und der ist der
    Preisschlüssel). `generateContentOnce`/`Resilient`/`observeVideo` geben
    `usage` mit; **`locateFighters` → `{ boxes, usage }`, `previewVideo` →
    `{ preview, usage }`** (Signaturen geändert, einzige Aufrufer sind die
    Routen). `ki-kosten.ts`: Art **`"gemini"`** — die wahren Kosten einer
    Analyse sind seither `analyse + gemini (+ gameplan)`.
  - **Routen `analyze`, `preview`, `rahmen`:** buchen SOFORT nach dem
    Gemini-Aufruf aufs Gym des AUFRUFERS (`userGymId(user)`), nicht erst beim
    Übernehmen — die Kosten sind da, sobald das Modell geantwortet hat. Der
    Rollen-Check heißt jetzt `if (!user || !isTrainerOrAdmin(user))`.
    `/admin` zeigt je Gym „· davon Google x €" (`AiUsageByGym.spentEurJeArt`).
  - **Gemessen:** tsc 0, eslint 0 (eigene Dateien). Offline-Probe
    `scripts/tmp-gemini-kosten-probe.mjs`: 5 min Video auf 3.8 Flash
    **0,10 € heute, 0,20 € ab 2027**; 15 min 0,26/0,52 €; Vorlauf 0,01 €.
    Live-Beweis `scripts/tmp-beweis-gemini-kosten.mjs` (Vorlauf am Testvideo
    Leon/Alec, eigenes Prüfkonto mess-f1k, danach gelöscht): 11.634 Token ein,
    918 aus, **0,0122 €**, 8/8 — Gym-Dokument, Monatsverlauf, Summe und je Art
    gestiegen, `analysisCount` unverändert. Rechengröße je Person damit eher
    **~0,80 €** statt 0,70 €.
  - **Restlücken (bekannt, nicht gebaut):** leere Antwort und abgebrochener
    Versuch buchen nichts (Token trotzdem verbraucht); Claude-Retries buchen
    nichts; `geminiGenerateJson`-Fallback ohne Claude-Key bucht nichts; die
    echte Google-Rechnung eines Monats gegen die Buchung halten.
  - **Falle 42:** `netstat | grep LISTENING` findet auf deutschem Windows
    NICHTS — dort steht „ABHÖREN". Der Dev-Server lief, mein `next build`
    überschrieb `.next` (CSS 404, Falle „Build überschreibt Dev-Server"). Port
    prüfen NUR mit `Get-NetTCPConnection -LocalPort 3000 -State Listen`.

### Der gespeicherte Formularzustand — eine Falle, teuer gemessen (08.09.2026)
`ta-video-analysis-form:{mode}:{targetId}` wird von zwei Effekten bedient:
einer liest beim Mounten, einer schreibt bei jeder Änderung. Die Marke
dazwischen war ein `useRef` — und ein Ref ist SOFORT wahr. Der Schreib-Effekt
lief deshalb noch im ersten Durchgang, mit den Werten aus dem Render VOR dem
Lesen, und legte die Vorgaben über den gerade geladenen Zwischenstand.

Sichtbar wurde es an einer Merkwürdigkeit: Kleidung und Merkmale kamen zurück,
**Ecke, Analyse-Stufe und Zeitpunkt nicht**. Der Grund ist die Vorgabe selbst —
`if (s.clothing)` überspringt einen leeren Text und lässt den geladenen Wert
stehen, `if (s.corner)` sieht in `"unknown"` einen gültigen Wert und schreibt
ihn drüber. Im Entwicklungs-Modus (React führt Effekte doppelt aus) traf es
JEDES Laden, in Produktion das Fenster zwischen zwei Rendern.

Die Marke ist jetzt ein **State und trägt den Schlüssel**, nicht nur ein Ja:
`hydriertFuer === storageKey`. Ein bloßes Ja zeigte beim Zielwechsel weiter auf
den alten Stand — und der Schreib-Effekt legte die Werte des vorigen Ziels in
den Speicher des neuen. **Merke: Eine „schon geladen"-Marke gehört in den
State, nicht in ein Ref — und wenn sie einen Schlüssel bewacht, merkt sie sich
den Schlüssel.**

## Konventionen
- Deutsch in UI-Texten, Englisch im Code.
- **„Athlet(en)" ist das UI-Wort, `student` bleibt der Code-Name** (Leons
  Entscheidung 2026-09-02). In sichtbaren Texten heißt niemand mehr „Schüler":
  Sidebar, Überschriften, Hinweise, Fehlermeldungen sagen Athlet/Athleten
  (Singular „Athlet", Plural und Genitiv „Athleten"). Der Code behält
  `StudentEntry`, `listAllStudents()` — dasselbe Muster
  wie bei DeepFight (UI-Name neu, Datenmodell unangetastet), und aus demselben
  Grund: eine Umbenennung von Route und Typen wäre eine Migration ohne
  Gegenwert. Wer neue Oberfläche baut, schreibt „Athlet"; wer Code liest,
  findet weiter „student".
- **Die ADRESSE heißt seit 2026-09-03 `/trainer/athleten`** (Leons Revision
  seiner eigenen Festlegung vom 02.09.). Weiterleitung von `/trainer/students`
  samt Unterseiten steht in `next.config.mjs`. Umgezogen ist NUR die Adresse —
  die Code-Namen bleiben, die Begründung oben gilt unverändert.
- **Sprache & Tonalität** (Leons Vorgabe 2026-09-02): modern, sportlich,
  selbstbewusst — der Ton eines guten Coaches, NICHT einer Behörde, eines
  Influencers oder eines „Bro-Coaches". Konsequent „du", kurze AKTIVE Sätze.
  Drei Formen sind verboten, weil sie den Behörden-Ton erzeugen:
  (1) **Passiv** („Änderungen werden gespeichert"), (2) **Verneinung als
  Erklärung** („wird NICHT automatisch gespeichert" → stattdessen sagen, was
  man tun KANN), (3) **System-Subjekt** („Die App zeigt dir…"). Fehlermeldungen
  und Regelwerk-Inhalte dürfen verneinen — dort beschreibt die Verneinung die
  Sache selbst. MMA-/Fitness-Anglizismen sind erwünscht (Sparring, Ground Game,
  Warm-up, Round, Skills), unnötiges Denglisch nicht.
- Komponenten: Default-Export · Utilities: benannte Exports.
- Env-Vars: ohne Anführungszeichen in `.env.local` (Vorlage: `.env.local.example`).
- R3F: NIEMALS @react-three/fiber v9+ ohne React 19 — bleibt auf v8!

## Konzept-Dokumente (verbindlich)
- **`docs/MULTI-GYM-KONZEPT.md`** — beschlossenes Zielbild Multi-Gym
  (2026-08-20): Rollenmodell (verwaltung/trainer als Zusatzrechte, Athlet =
  Grundzustand), gymId in Custom Claims, Abrechnungsmodell
  (Fixbetrag + Analysen-Kontingent + Nachkauf), Wochenplan-Mehrplan-Modell,
  Branding-Stufen + KI-Branding-Kit, Secure-by-Design-Grundregeln und die
  Roadmap Phase 0 → 1 → Redesign → 2 → 3 → 4. Bei Multi-Gym-Arbeit ZUERST
  dort nachlesen.
- **`docs/DESIGN-BRIEF.md`** — verbindlicher Rahmen fürs anstehende Redesign:
  Token-only-Branding (Palette aus 1–2 Eingabefarben ableitbar), harte vs.
  verhandelbare Regeln, Arbeitsmodus (Tokens → Referenzseite → Rollout),
  Abnahme-Checkliste. Jede Design-Session startet mit dieser Datei.
- **`docs/MOTION-BRIEF.md`** — verbindliches Regelwerk für Bewegung und
  Haptik (beschlossen von Leon 2026-09-04): die drei Prinzipien (verwandeln
  statt umschalten · alles Anfassbare antwortet · Auftreten in Wellen), die
  Schichten-Arbeitsteilung CSS ↔ Framer Motion, acht harte Regeln, die
  Wertetabelle und die Abnahme-Checkliste. Farben, Themes und
  Komponentengrößen bleiben davon UNBERÜHRT. Jede Session, die UI anfasst,
  liest diese Datei.

## Backlog (offen)
- [ ] **Workout-Pläne — eigene Etappe DIREKT NACH Redesign-Etappe 4, VOR
      /timer** (Entscheidung 2026-08-23): Die vier strukturierten Pläne
      (`lib/training-plans.ts`) sind reine Textlisten (Übung = name/format/
      notes, Timer nutzt nur das Preset) und werden ERSETZT, nicht migriert.
      Zielbild: (1) Datenmodell auf `WorkoutDefinition`-Basis (Übungs-IDs
      aus der Übungs-DB, Pause pro Block als Feld, Gesamtdauer berechnet)
      mit `gymId` + `discipline` + `difficulty`; Pläne werden Gym-Inhalt in
      Firestore (Trainer pflegen), nicht Code. (2) Drei Ebenen im
      Training-Tab: Disziplinen (Karten mit Bild `public/plans/*.webp`,
      Farbpunkt aus discipline-colors, später nur die Rubriken des Gyms) →
      Disziplin-Seite mit Planliste (Dauer, Übungszahl, Equipment) →
      Plan-Detail. (Das Level Anfänger/Fortgeschritten/Pro — Segment,
      Plan-Feld, Editor-Select, Log-Feld — hat Leon am 19.09. RESTLOS
      gestrichen; nur der Auto-Generator wählt weiter nach Schwierigkeit.) Jede Ebene
      mit „← Zurück"-Kopf; Training-Tab bleibt für `/workout/*` aktiv.
      (3) Persönliche Kopien: `users/{uid}/workoutPlans` + Firestore-Regel,
      Sektion „Eigene Workoutpläne" als ERSTER Block im Hub, Auto-Save-
      Muster. (4) App-weit standardisierte Listen-Gesten als Komponente:
      Links wischen = Löschen (Undo-Leiste statt Popup), langes Halten =
      Verschieben, „+ Übung hinzufügen" unter jeder Rubrik mit Übungs-Picker
      (ui/Select-Stil, Filter Disziplin/Equipment); danach auch im Runner und
      in der Bibliothek einsetzen. (5) Inhalt: Start-Pläne pro Disziplin
      (sechs, leicht → schwer) werden per KI ausgearbeitet, Trainer prüfen
      nur (Leons Vorgabe).
- [ ] **Workout-Pläne AUSBAU — nach den Teilschritten der Etappe (Leons
      Ansage 2026-08-27):** Drei aufeinander aufbauende Stufen.
      (1) **Trainer-Pläne mit Freigabe:** Trainer erstellen Pläne manuell
      (denselben Editor wiederverwenden wie für persönliche Kopien —
      Listen-Gesten + Übungs-Picker aus Spec-Punkt 4) und geben sie an
      ausgewählte Kurse ODER einzelne Schüler frei; sichtbar für die
      Athleten unter „Strukturierte Pläne" im Hub (eigene Sektion „Vom
      Trainer für dich") und in der Disziplin-Navigation. ACHTUNG
      Sicherheitsmodell: Sichtbarkeit MUSS serverseitig in den Firestore-
      Regeln liegen (NICHT Client-Filter wie sharedWithAthlete heute) —
      rules-tauglich ist eine beim Freigeben materialisierte
      audienceUids-Liste im Plan-Dokument (Kurs→Mitglieder auflösen);
      echte Kurs-Mitgliedschaft kommt erst mit Multi-Gym Phase 2
      (Einladungen/Mitglieder), bis dahin explizite Schüler-Auswahl.
      Persönliche Kopien bleiben Snapshots — ein Trainer-Edit synct nicht
      in bestehende Kopien. KURS-ZUORDNUNG (Leon 19.09.): `courseIds` am
      Trainer-Plan ordnet ihn Kursen zu (Editor-Chips, „+" je Kurs in der
      Ansicht „Nach Kursen") — reine Ordnung, sichtbar macht ihn allein die
      Freigabe (`audienceUids`/`audienceCourseIds`).
      (2) **KI-Plan individuell (Athlet):** ab ≥3 übernommenen Analysen in
      einer Rubrik erzeugt KI aus fightProfile + Zeit + Equipment
      (Generator-Eingaben existieren) einen persönlichen Plan → landet als
      persönliche Kopie in users/{uid}/workoutPlans und ist dort editierbar
      wie jede andere. Grenze beachten: das Profil beschreibt den KAMPFSTIL
      (Schwächen, DNA-Split), nicht Kondition/Kraft → Schwierigkeitsgrad
      bleibt User-/Trainer-Eingabe. Structured Output zwingend: nur
      Übungs-IDs aus der Übungs-DB + Schema-Validierung gegen
      WorkoutDefinition; Kosten-Limit pro Nutzer (z. B. 1 Neu-Generierung/
      Woche, aiUsage-Tracking).
      (3) **KI-Plan pro Kurs (Trainer):** wenn genug der GEWÄHLTEN Athleten
      ein belastbares Profil haben (Schwelle konfigurierbar, Default ~80 %;
      „belastbar" = ≥3 übernommene Analysen in der Rubrik + Recency),
      erzeugt KI einen Kursplan unter Berücksichtigung der individuellen
      Schwächen. Basis ist eine Athleten-AUSWAHL, nicht zwingend der ganze
      Kurs (Leons Beispiel: von 30 kommen 10 regelmäßig → Plan auf
      Gesamtkurs-Basis wäre unrealistisch). Dabei beachten:
      (a) Aggregation VOR dem Prompt in Code (Schwächen-Histogramm,
      DNA-Mittel, Level-Verteilung) statt 30 Rohprofile — spart Kosten und
      dämpft Ausreißer (Einzel-Schwäche ≠ Kurs-Fokus, nach Häufigkeit
      gewichten); (b) Privacy: der generierte Plan darf KEINE Namen oder
      Einzel-Schwächen nennen (Prompt-Regel + Review), Trainer-Review VOR
      der Freigabe an den Kurs ist Pflicht — der Inhalt geht an viele;
      (c) Level-Streuung im Kurs → Skalierungs-Option pro Übung
      (leichter/schwerer) statt Einheitsplan; (d) Coverage transparent
      machen: „12 von 15 Gewählten haben ein belastbares Profil" + wer
      fehlt (motiviert fehlende Analysen); (e) Gewichtung/Recency aus der
      bestehenden Merge-Logik (appliedStats) wiederverwenden, nicht neu
      erfinden. Reihenfolge: (1) → (2) → (3); (3) hängt zusätzlich an der
      Phase-2-Mitgliedschaft und an serverseitigen Regeln aus (1).
- [ ] Gewichtsklassen pro Disziplin/Verband: Die App-weite Klassenliste
      (`lib/types.ts`, `WEIGHT_CLASS_LABEL` + `weightClassForKg`) ist die
      vereinheitlichte MMA-Skala (UFC, kg-gerundet) für ALLE Sportarten.
      Real hat jede Disziplin ein eigenes Raster (Boxen 17 Profi-Klassen,
      K-1/WAKO eigene, IBJJF eigene inkl. Gi-Wiegen, Ringen olympisch) —
      teils gleiche Namen mit anderen Grenzen (Welterweight: Boxen ≈66,7 kg
      vs. MMA 77 kg). Bei der Wettkampf-/Multi-Gym-Arbeit: Klassensatz
      abhängig von Hauptdisziplin (ggf. Verband) wählen; betrifft
      AthleteProfileForm, MatchupBlock/Tale-of-the-Tape, FightCampForm.
      (Notiert 2026-08-21.) Dazu gehört das Geschlecht: `athlete.gender`
      existiert seit 2026-08-22 (User-Eingabe im Kampfprofil, optional mit
      Warnhinweis bei fehlender Angabe) — Frauen-Divisionen sind ein eigenes
      Raster, und das Feld soll als Kontext in die KI-Video-Analyse-Prompts
      und Gegner-Vergleiche (Regression-Regel wie beim recency-Feld: ohne
      Angabe zeichengleicher Prompt); Gegner brauchen das Feld dann auch.
- [ ] Käfig-Karte („Wo passiert die Aktion") disziplinabhängig darstellen:
      Zonen-IDs `center|open|cage` bleiben stabil (semantisch Mitte/freier
      Raum/Begrenzung, KEINE Migration) — nur Darstellung per Arena-Preset:
      cage=Octagon „Am Cage" (MMA, Default), ring=Quadrat „In den Seilen"
      (Boxen/Kickboxen/K-1/Muay Thai), matte=Kreis „Am Mattenrand"
      (BJJ/Ringen/Grappling). Betrifft: Preset-Registry + PHRASE-Sätze in
      lib/fight-stats.ts (deriveTendencies braucht Preset-Parameter),
      `arena`-Prop durch FightProfileView/FightInsights/OpponentProfileView,
      CageHeatmap-Geometrie, KI-Prompts textlich generalisieren („Begrenzung:
      Käfig/Ringseile/Mattenrand", Zone-Enum unverändert). Disziplin-Quelle:
      Athlet = athlete.primaryDiscipline; Gegner haben KEINE Disziplin →
      Feld im OpponentEditor oder Disziplin des verknüpften Wettkampfs.
      Zusammen mit dem Gewichtsklassen-Punkt oben lösen (gleiche
      „Hauptdisziplin bestimmt Raster"-Quelle). (Notiert 2026-08-22.)
      Dazu KI-Sportarten-Erkennung als KONTROLLE, nicht als Quelle
      (Entscheidung 2026-08-22): Disziplin wird VOR der Analyse als
      vorbelegtes Select im Analyse-Formular gesetzt (Athlet:
      athlete.primaryDiscipline, Gegner: Wettkampf/Feld, sonst leer) und geht
      additiv in beide Prompts — Regression-Regel wie beim recency-Feld:
      ohne Angabe zeichengleicher Prompt. Gemini gibt zusätzlich
      meta.detectedSport + meta.detectedArena (+ Konfidenz) in der
      Beobachtung aus (getrennt erkennen: Sportart ≠ Austragungsort, z. B.
      MMA im Ring, Sparring auf der Matte); bei Abweichung von der Vorgabe
      Warnung im Ergebnis-Review („falsches Video?") — KEIN blockierendes
      Popup mitten in der Pipeline (Analyse muss unbeaufsichtigt
      durchlaufen), KEIN Freitext für Korrekturen (immer Disziplin-Enum +
      ui/Select). Ohne Vorgabe fällt die Anzeige auf die Erkennung zurück,
      markiert als „automatisch erkannt". Achtung: Schema-Erweiterung der
      Beobachtung invalidiert einmalig gespeicherte
      pendingObservation-Fingerprints (Resume startet Gemini neu — ok).
- [ ] **Neue Signups sind für Trainer UNSICHTBAR** (Lücke bis Phase 2,
      gefunden 2026-08-31): Beim Anlegen des eigenen Profils verbieten die
      Rules `gymId` (Beitritt ist serverseitig) — die Trainer-Queries in
      `lib/admin.ts` filtern aber `where("gymId","==",…)`. Ein frisch
      registrierter Nutzer fehlt dadurch überall: Schülerliste,
      Freigabe-Dialog der Trainer-Pläne, DeepFight-Grid. Er selbst merkt
      nichts (Rules und Client fallen bei fehlendem Claim aufs Default-Gym
      zurück). Zwischenlösung: `node scripts/backfill-user-gym.mjs`
      (`--dry-run` / `--uid=<uid>`; REST über firebase-tools, KEIN
      Service-Account nötig — setzt nur das Feld, nicht den Claim).
      Endgültig löst das erst das Einladungssystem aus Phase 2, das
      `gymId` als Claim beim Einlösen setzt.
- [ ] **Rechts-Zeile der Beitritts-Karte verlinken** (notiert 2026-08-31,
      Checkpoint 1C): Am Fuß von `/beitreten` und `/beitreten/{code}` steht
      „Mit dem Beitritt stimmst du unseren Nutzungsbedingungen und
      Datenschutzhinweisen zu." — Platzierung von Leon abgenommen, aber die
      beiden Begriffe sind bewusst nur `<span>` im Link-Look: die Seiten
      existieren noch nicht. Sobald `/agb` und `/datenschutz` da sind, in
      `components/JoinLayout.tsx` (`JoinLegalNote`) die zwei `<span>` durch
      `<Link>` ersetzen — sonst nichts. Hängt am selben Paket wie Impressum
      und AVV (siehe Kostenkarte: „vor der ersten Zahlung fällig").
- [ ] **Gym-Logo + Gym-Farbe auf der Beitritts-Karte** (vorbereitet
      2026-08-31, Checkpoint 1C): Die Karte zeigt oben das Zeichen des
      einladenden Gyms. Der Weg steht schon: `/api/invites/preview` liefert
      `gymLogo` aus `gyms/{gymId}.branding.logoUrl`, `JoinLayout` nimmt es
      als `logo`-Prop, und `JoinMark` fällt auf `/logo.png` (Tidal) zurück,
      solange nichts hinterlegt ist — heute bei jedem Gym. Die FARBEN
      brauchen gar nichts: Verlauf, Glühen, Code-Felder und der Knopf leiten
      sich aus `--accent-h`/`--accent-c` ab, das Branding-Kit muss nur diese
      Tokens setzen. Zu tun bleibt: Feld im Branding-Kit befüllbar machen
      (Konzept §8) und prüfen, ob ein sehr helles Gym-Logo auf dem dunklen
      Panel eine neutrale Hinterlegung braucht.
- [ ] **Konto-Löschung durch die betroffene Person fehlt** (Lücke, benannt
      2026-09-01): `/api/members/remove` beendet die Mitgliedschaft, aber es
      gibt keinen Weg, ein Konto samt aller Daten zu löschen — weder für den
      Nutzer selbst noch überhaupt. Das ist DSGVO Art. 17 und gehört ins
      Paket „vor der ersten Zahlung fällig" (AVV, Impressum, AGB, siehe
      Kostenkarte). Zu bauen: „Konto löschen" in `/profile` mit Tippbestätigung
      → Server-Route, die per Admin-SDK rekursiv löscht (`users/{uid}` samt
      workouts/fightCamps/videoAnalyses/workoutPlans, uid aus allen
      `sharedWith`/`audienceUids`/`invites.usedBy`, danach der Auth-Account).
      Protokoll: KEIN auditLog-Eintrag mit Namen — sonst überlebt genau das
      die Löschung.
- [ ] **Mitgliedschaft pausieren** (Idee 2026-09-01, bewusst zurückgestellt):
      Leons „Account deaktivieren" ist als KONTO-Sperre nicht zulässig (siehe
      „Konto vs. Mitgliedschaft"), als MITGLIEDSCHAFTS-Status dagegen sinnvoll
      — Beitrag offen, Verletzungspause, Hausverbot. Als Feld am
      users-Dokument (`membershipPaused`) plus Filter in der Mitgliederliste;
      hängt an Phase 4, wo die Abrechnung aktive Mitglieder zählt.
- [ ] **Navigationsbalken läuft über** (gemessen 2026-08-31 mit einem
      Admin-Konto, Playwright): Ab 1024 px trägt `components/Navbar.tsx`
      1305 px Inhalt bei 1232 px Platz (`max-w-7xl` minus Padding) — Marke
      und erster Menüpunkt überlappen. Der Zustand ist ÄLTER als Checkpoint 2
      und betrifft nur Trainer/Admins (sieben Rubriken). Deshalb hängen die
      Verwaltungs-Seiten am vorhandenen Platz statt an einer achten Rubrik
      (siehe `verwaltungNavChildren`); mit einer achten wären es 1478 px
      gewesen und der Überlauf hätte bis 1600 px gereicht. Echte Lösung:
      Umbruch-Strategie (Burger bis ~1400 px, darüber so viele Punkte wie
      passen) — eigener Vorgang, nicht nebenbei.
- [ ] **Hülle für eine reine Verwaltung** (offen seit Checkpoint 2, GESTALTUNGS-
      frage für Leon): Wer Verwaltungsrecht ohne Trainer-Häkchen hat, hat kein
      Trainer-Recht und läuft damit in die Athleten-Hülle
      (`AthleteChromeGate` blendet auf `/dashboard` & Co. die Top-Navigation
      aus, `AthleteTabBar` übernimmt). Als Tür dient eine Kachel „Gym
      verwalten" im Athleten-Dashboard; unter `/verwaltung/*` bekommt sie die
      normale Top-Navigation mit der Rubrik „Verwaltung". Ob diese Person
      überall die Athleten- oder die Trainer-Hülle sehen soll, ist offen —
      technisch wären es `AthleteChromeGate` plus die `rights.trainer`-
      Bedingungen in fünf Seiten.
- [ ] **Übergang des privaten Athletenprofils ausbauen** (fällig, sobald die
      Produktion sicher auf dem Stand vom 2026-09-03 läuft): der Rückfall aufs
      alte Feld in `lib/user-profile.ts` (`readAthleteProfile`) und
      `lib/fight-profile.ts` (`getFightProfile`), dazu die als ÜBERGANG
      markierte `fightProfile`-Schreibregel am users-Dokument in
      `firestore.rules`. Die Migration ist durch (Gegenprobe: kein Dokument
      trägt die Felder mehr) — der Rückfall kann also weg. Danach mit
      `scripts/check-privacy-gate.mjs` gegenprüfen.
- [ ] **GHOST-KONTEN app-weit durchziehen** (Leons Entscheidung 2026-09-03:
      „Admins sind Ghosts, die operative Eingriffe in der App unternehmen, die
      sonst keiner mitbekommen soll"): Der Plattform-Rang ist die BETREIBER-
      Ebene und darf in KEINER Gym-Oberfläche als Mitglied erscheinen. Wer als
      Betreiber trainieren will, legt sich über eine Einladung ein eigenes
      Mitgliedskonto an — die beiden Konten bleiben getrennt.
      Der Helfer steht schon: `isGhostAccount()` in `lib/admin.ts`; angewandt
      ist er bisher NUR im Freigabe-Knopf (`ProfileShareButton`).
      Nachzuziehen: `/verwaltung/mitglieder` (zeigt Admins heute als
      „Trainer · Verwaltung"), `/trainer/athleten` und die Kennzahlen auf
      `/trainer` + `/verwaltung` (ein Ghost darf keine Mitgliederzahl
      erhöhen). ERLEDIGT: „Neuer Wettkampf" (Schritt 1, 04.09.), die
      Ziel-Auswahl der Werkbank (07.09.) und die Athletenliste
      `/trainer/deepfight/athleten` (07.09., Teilschritt 3) — der ganze
      DeepFight-Bereich ist durch. Das Freigabe-Panel im Gegnerprofil
      braucht den Filter NICHT: Es liest über `listAllStudents`, und
      `isStaffEntry` wirft einen Plattform-Admin schon heraus.
      **AUSDRÜCKLICH NICHT in `/admin/*`** — dort ist der Ort, an dem diese
      Konten sichtbar sein müssen (`listAllUsers`).
      ACHTUNG, zwei Fallen: (1) `effectiveRights` rechnet den Plattform-Rang in
      `trainer` und `verwaltung` ein — ohne Filter ist ein Admin überall ein
      vollwertiger Trainer. (2) Die NAMENSAUFLÖSUNG darf nicht mitgefiltert
      werden: Hat ein Admin-Konto einen Wettkampf oder eine Analyse, braucht
      die Anzeige weiter seinen Namen, sonst steht dort „Athlet".
      Dazugehörig: Der Betreiber-Zugriff (`isAdmin()` überspringt in
      `firestore.rules` jede Freigabe-Prüfung) verschwindet damit aus der
      Oberfläche und MUSS in den Datenschutzhinweisen und im AVV stehen —
      derselbe Punkt wie „vor der ersten Zahlung fällig".
      GLEICHER GRIFF, ANDERE FRAGE — ERLEDIGT am 2026-09-07 (Teilschritt 3):
      Die DeepFight-Athletenliste `/trainer/deepfight/athleten` listete
      Kollegen OHNE Rücksicht auf ihre `deepfight`-Freigabe; wer einen
      anklickte, landete auf der Detailseite im Hinweis „noch nicht
      freigegeben". Sie filtert jetzt wie „Neuer Wettkampf" mit einem Aufruf
      von `darfSehen`. **Lehre für die übrigen Stellen:** Der leere Fall
      braucht einen Satz. Verschwindet die Gruppe wortlos, ist die Sackgasse
      nur unsichtbar geworden — dort steht jetzt, wie viele Kollegen
      freigeben KÖNNTEN und wo sie das tun.
- [x] ~~**`AiBudgetGauge` benutzt `window.prompt()`**~~ — ERLEDIGT am
      08.09.2026, aber anders als geplant: Statt eines Sheets mit Zahlenfeld
      ist die ganze Komponente weg (Leons Entscheidung, siehe Kosten-Tracking
      oben). Damit ist der LETZTE native Dialog der App verschwunden;
      `confirm()` gab es seit dem 04.09. keinen mehr.
- [ ] **KI-KOSTEN JE GYM — Auswertung im Admin-Bereich** (SEIT 15.09.2026
      Teil des Analyse-Umbaus, siehe „BESCHLOSSENER UMBAU"; nicht mehr
      getrennt bauen) (Leons Wunsch
      08.09.2026, beim Entfernen des Guthaben-Rings: „als Admin sehen, wie
      viel jede Analyse gekostet hat, egal welches Gym … monatliche Kosten,
      welches Gym am meisten Kosten verursacht hat, sofern das trackbar ist").
      **Heute NICHT rechenbar, und zwar aus drei Gründen gleichzeitig:**
      (a) `aiUsage/summary` ist EIN Zähler für die ganze Plattform — kein Gym,
      kein Verlauf, nur eine laufende Summe (Multi-Gym Phase 3 stellt auf
      `aiUsage/{gymId}` um, siehe Verwaltungs-Dashboard-Ausbau (c));
      (b) die Kosten je Analyse liegen zwar am Analyse-Dokument (`usage`),
      aber verstreut in `users/{uid}/videoAnalyses` und
      `opponents/{id}/videoAnalyses` — gym-übergreifend gibt es dafür keinen
      Leser; (c) die Analyse-Dokumente tragen kein `gymId`.
      **Der Weg ist derselbe wie bei „Meine Analysen per collectionGroup"** —
      `gymId` (und für die Monatsansicht ein Datumsfeld, `createdAt` steht
      schon da) am Analyse-Dokument, Backfill, Regel mit DIREKTEM Feldzugriff
      (kein `get(feld,default)`, Falle 28), Composite-Index. Beide Punkte
      brauchen dieselbe Vorarbeit und gehören deshalb in EINEN Vorgang;
      der Betreiber-Leser darf dann `isAdmin()` nutzen und über alle Gyms
      lesen. Zeitraum-Aggregation in Code, nicht im Client-Loop.
      Bis dahin zeigt `/admin` weiter die eine Gesamtsumme.
- [ ] **Übergangs-Spiegel `role` entfernen** (fällig, sobald die Produktion
      länger als eine Stunde auf dem Checkpoint-3-Stand läuft): `legacyRole()`
      in `firestore.rules`, der `|| legacy === …`-Rückfall in `readRoleSet`
      (`lib/roles.ts` UND `scripts/lib/role-claims.mjs`), `next.role = …` in
      `claimsWithRights`, `role` in `rightsMirror`, das Feld in `ProfileDoc`
      und der Typ `UserRole` in `lib/types.ts`. Er steht nur, damit ein
      Rollback der Regeln keine Aussperrung ist und Tokens von vor der
      Migration ihre Stunde zu Ende leben können. Danach ist `role` weder in
      Claims noch im Dokument noch in den Regeln zu finden.
- [ ] **Verwaltungs-Dashboard-Ausbau** (Ideensammlung 2026-09-02, mit Leon
      besprochen, NOCH NICHT beschlossen — nichts davon umsetzen ohne Ansage):
      Zusatz-Kennzahlen für `/verwaltung`, sortiert nach Vorarbeit.
      (a) **Sofort machbar aus vorhandenen Daten:** Inaktivitäts-Frühwarnung
      „lange nichts gehört von…" (letzte Rückmeldung > X Wochen je Mitglied —
      wirtschaftlich wichtigste Zahl, Kündigungs-Vorbote; braucht nur die uid
      im `ParticipationPoint`, sie steckt schon im Dokumentpfad von
      `getParticipationsSince`, wird aber weggeworfen; Beschriftung streng als
      Selbstauskunft, „hat sich lange nicht zurückgemeldet" ≠ „war nicht da");
      Kurs-Trends (Pfeil steigend/fallend je Kurs, letzte 6 vs. vorige 6
      Wochen, aus denselben geladenen Punkten); Stoßzeiten-Heatmap (Wochentag
      × Uhrzeit der Rückmeldungen); Einladungs-Funnel (Einlöse-Quote +
      Zeit bis Einlösung aus usedCount/maxUses/expiresAt + auditLog);
      Betriebs-Warnungen-Karte, die NUR erscheint, wenn etwas ansteht (Kurse
      mit null Rückmeldungen im ganzen Zeitraum, ungepflegte Kurseinheiten via
      `weeklyCoverage`, nur noch eine Verwaltung im Gym, ablaufende
      Einladungen) — das Dashboard hat viel „so ist es", wenig „das solltest
      du tun".
      (b) **Kurs→Trainer-Zuordnung GEBAUT 26.09.2026** (Abschnitt „KURSPLAN JE
      GYM"; Weg 2 statt Mapping am Gym-Dokument) — die Auslastung selbst
      ist noch offen. Ursprünglicher Stand (Leons Wunsch Trainer-Auslastung):
      `TRAINING_BLOCKS` ist statischer Code OHNE Trainer-Bezug, auch
      Rückmeldungen tragen keinen Trainer — vorher ist keine Auslastung
      rechenbar. Die Zuordnung kommt sauber mit dem Wochenplan-Mehrplan-Modell
      (Konzept §7, Trainer-Zuweisungen sind dort vorgesehen; Phase 3);
      Zwischenlösung wäre ein Mapping am Gym-Dokument (`trainingBlockId →
      uid[]`), das die Verwaltung selbst pflegt — als eigenes Feature „Wer
      gibt welchen Kurs" auch allein sinnvoll. Danach: Wochenstunden aus
      Start-/Endzeiten + Kurszahl + Rückmeldungen in seinen Kursen je Trainer.
      ACHTUNG Darstellung: Kennzahl über Menschen im Team — als
      Kapazitätsplanung bauen (Balkenliste Stunden + Kurse), KEIN Ranking,
      keine Vergleichs-Prozente, und Rückmeldungen nie wie gemessene
      Teilnehmerzahlen aussehen lassen.
      (c) **Braucht aiUsage-Gym-Scoping** (Phase 3): KI-Kontingent-Karte
      (Ring „X von Y Analysen diesen Monat" + Warnung bei Knappheit, Phase 4
      dann Nachkauf-Knopf) — ist im Konzept §6 als „Verbrauchs-Dashboard
      (Kontingent-Stand, Nutzung je Trainer)" bereits BESCHLOSSEN, hängt aber
      zwingend am Umbau `aiUsage/summary` → `aiUsage/{gymId}`; vorher zeigte
      der Ring fremde Gyms mit. Empfohlene Reihenfolge: (a) → Zuordnung aus
      (b) → Auslastung → (c) mit Phase 3.
- [ ] **3D-Technik-Viewer** (Idee 2026-09-03, mit Leon besprochen, NICHT
      beschlossen — steht im Ideen-Becken der Roadmap): Zwei animierte
      Kämpfer (Benutzer im Gym-Akzent, Gegner neutral) führen einzelne
      Techniken im Loop vor — Pause, Zoom, freies Drehen (OrbitControls),
      Zeitlupe, Phasen-Marker auf der Zeitleiste. Drei Bausteine mit sehr
      ungleichem Aufwand: (a) **Viewer ist fast geschenkt** — R3F v8 + drei
      stecken im Stack (Helix), glTF + AnimationMixer + Scrubbing sind
      Standard, dockt an die Technik-Detailseiten; Charaktere/Clips als
      Draco-komprimierte .glb (Charaktere einmalig, pro Technik nur der
      Animationsclip). (b) **Charaktere einmalig**: stilisiert mit
      Toon-Shading (bewusst nicht realistisch — Qualität ohne Uncanny
      Valley, mobil flüssig), Quellen Mixamo (gratis, Auto-Rigging) oder
      Kaufmodell (Sketchfab/CGTrader). (c) **ENGPASS = Animationsdaten für
      Zwei-Personen-Techniken** — kaufbare Packs existieren praktisch nicht
      (nur Einzel-Striking); Text-zu-Animation-KI (Kinetix & Co.) liefert
      plausible, nicht KORREKTE Bewegung → für Unterricht unbrauchbar;
      Mocap aus fremden Internet-Videos scheitert an Verdeckung bei
      Körperkontakt. Realistischer Weg: EIGENE Trainer mit 2–3 Handykameras
      filmen → markerloser KI-Mocap (Move.ai / Rokoko Video / DeepMotion)
      → Cleanup in Blender oder Cascadeur (physik-gestützt, für
      Kampfbewegung gebaut, Gratis-Stufe) → Retargeting auf die zwei
      Standard-Charaktere → glTF; nach Pipeline-Aufbau ~1–3 h pro Technik.
      Diese Daten wären der Burggraben des Features. Staffelung: Stand-up
      zuerst (Clinch-Eintritt), Bodentechniken zuletzt (Verdeckung am
      härtesten). iOS/Android: KEINE Engine, kein React-Native-Neubau —
      three.js läuft im WebView; für Store-Präsenz die bestehende App in
      Capacitor wrappen (eigenes, größeres Thema: Push, Store-Abo-Regeln).
      (d) **ETAPPEN-PLAN Content-Produktion (2026-09-03):** E0 =
      Null-Kosten-Pilot VOR allen Gesprächen (ein Drehtag, 3–5 Techniken —
      davon Solo-Bewegungen wie Shrimping zuerst, einfachster Mocap-Fall;
      fertige Loops als Handy-Demo; Abbruchkriterium: reicht die Qualität
      nicht, stirbt die Idee hier für ~0 €). E1 = Gespräche MIT Demo, in
      dieser Reihenfolge: ZUERST Verwaltung des eigenen Gyms
      (Kooperationsvereinbarung: Gym stellt Matte + Trainerzeit, bekommt
      dauerhafte Gründer-Konditionen/Partner-Status — ausdrücklich KEINE
      Beteiligung an Tidal, keine Barzahlung), DANN Trainer einzeln (nicht
      als Gruppenansage; Gegenleistung: Namensnennung „vorgeführt von X" +
      DeepFight-Analysen-Guthaben; je Trainer 1-Seiten-Vereinbarung:
      Nutzungsrechte an Aufnahmen UND abgeleiteten Bewegungsdaten zeitlich
      unbegrenzt, auch nach Ausscheiden + DSGVO-Einwilligung — Rohvideo ist
      personenbezogen, die abstrahierte Animation nicht). E2 = Grundstock
      20–40 Fundamentals der eigenen Disziplinen in 2–3 GEBATCHTEN
      Drehtagen (Drehliste vorher, 15–25 Techniken pro 2–3-h-Session, nie
      einzeln über Wochen), läuft parallel zur Phase-3-Entwicklung; Budget
      gesamt < ein paar hundert € (Stative, ggf. Kaufcharakter,
      Mocap-Abo nur in Batch-Monaten). E3 = Markteintritt mit ehrlichem
      Framing „wachsende Bibliothek, monatlich neue Techniken" — NICHT auf
      Vollständigkeit warten; fehlende Disziplinen füllen Partner-Gyms über
      dieselbe Content-Kooperation (Gegenleistung Freimonate/Nennung) →
      dockt an den Rubriken-Ausbau in Phase 3 an. DREH-PRAXIS: 2–3
      Smartphones auf Stativen (Front + Seite + 45°), Querformat, 60 fps,
      Fokus/Belichtung gesperrt, Klatsch-Sync; enge kontrastierende
      Kleidung (Rashguard statt Gi — Gi verdeckt den Körper fürs Mocap),
      Technikname vor jedem Take in die Kamera sagen (Auto-Protokoll),
      pro Technik 3–5 langsame + 2 normale Wiederholungen aus definierter
      Startpose, Clips 10–20 s.
- [ ] **Rollen-Chat „Tidal Coach"** (Idee 2026-09-03, mit Leon besprochen,
      NICHT beschlossen — steht im Ideen-Becken der Roadmap): Chat-Eingabe
      je Rolle (Athlet/Trainer/Verwaltung), Antworten kennen die eigenen
      Daten. ARCHITEKTUR: neue Server-Route (z. B. `POST
      /api/assistant/chat`), Streaming an den Client (SSE; Vercel-Hobby-
      300-s-Grenze ist für Chat unkritisch), `ANTHROPIC_API_KEY` existiert.
      Der Server verifiziert das Token (Middleware-Muster), liest das
      Rollen-Set und baut den Kontext SERVERSEITIG pro Rolle aus GENAU den
      Daten, die die Rolle sehen darf — dieselben Leser wie die Dashboards,
      damit das Rechtemodell automatisch mitgeht (Athlet: eigenes Profil,
      eigene participations, NUR sharedWithAthlete-Analysen, Kursplan,
      eigene Pläne; Trainer: Kurs-Auslastung + Aggregate des eigenen Gyms;
      Verwaltung: Wachstum/Einladungen/Kurs-Aggregate, KEINE
      Einzel-Gesundheitsdaten). Aggregation VOR dem Prompt (Lektion aus
      KI-Kursplan-Backlog). MODELL/KOSTEN: Standard-Chat ist ein Fall für
      ein kleines Modell — Haiku 4.5 ($1/$5 je MTok) ≈ Zehntel-Cent pro
      Frage, Opus 5 ($5/$25) für Trainer-/Verwaltungs-Beratung erwägbar;
      Prompt-Caching auf System-Prompt + Gym-Kontext (statisch zuerst,
      volatile Nutzerfrage zuletzt) macht aktive Chats nochmal billiger.
      Kontingent: zählt auf aiUsage → sauber erst NACH Gym-Scoping
      (Phase 3), plus Tageslimit je Nutzer (z. B. 20 Nachrichten) und
      max_tokens-Deckel. RAHMEN/GUARDRAILS: System-Prompt begrenzt auf
      Training/Fitness/Ernährung/Gym-Betrieb, alles andere freundlich
      zurücklenken (kein Spaghetti-Rezept); KEINE medizinischen
      Einzelratschläge („geh zum Arzt"-Regel bei Verletzung/Schmerz);
      ACHTUNG Minderjährige (Kids-/Teens-Kurse!) — Ernährungs-/
      Trainingsberatung altersgerecht allgemein halten oder Chat auf
      Erwachsene gaten; Prompt-Injection ist niedrig-riskant, solange der
      Chat KEINE Tools hat (schlimmster Fall: Off-Topic-Antwort auf eigene
      Kosten). Verlauf: users/{uid}/assistantChats mit kurzem
      History-Fenster. RAG/Vektor-DB unnötig — Gym-Daten sind klein,
      Context-Stuffing reicht. BEISPIELFRAGEN Athlet: „Wie bereite ich
      mich auf meinen ersten Wettkampf vor?", „Was esse ich vor dem
      Training?", „Muskelkater — trainieren oder pausieren?"; Trainer:
      „Welche meiner Kurse verlieren gerade Rückmeldungen?", „Bau mir
      einen Aufwärmblock für Donnerstag", „Wer braucht gerade
      Aufmerksamkeit?"; Verwaltung: „Formuliere die Ankündigung für die
      Ferienzeiten", „Welcher Kurs trägt einen zweiten Termin?", „Wie
      gewinne ich neue Mitglieder?". AUSBAUSTUFE (v2): Tool Use — der
      Coach darf mit Nutzer-Bestätigung handeln („Trag mich Donnerstag
      ein" → recordParticipation; Verwaltung: Ankündigungs-Entwurf →
      vorbefüllter News-Post); erst nach stabilem v1.
- [ ] **Athleten-Einreichung für DeepFight-Analysen** (Idee 2026-09-06;
      **BESCHLOSSEN 15.09.2026: JA**, Teil des Analyse-Umbaus — der Trainer
      ordnet dann nur noch die Standbilder zu): Athlet lädt sein Analyse-Video selbst hoch und füllt die
      Felder vor, die heute der Trainer schreibt (Kämpferbeschreibung/
      Identifikation, recency, Disziplin); Trainer bekommt es als
      Warteschlange, prüft Video + Text, redigiert, bestätigt → ab da läuft
      die NORMALE Pipeline. SICHERHEITSMODELL BLEIBT: Athleten schreiben
      weiterhin NIE videoAnalyses — die Einreichung ist ein EIGENES Objekt
      (z. B. users/{uid}/videoSubmissions: create nur eigene uid + gymId,
      Lesen Trainer/Verwaltung desselben Gyms, Athlet darf eigene PENDING
      zurückziehen; Athleten-Text ist Nutzereingabe und geht NIE ungeprüft
      in den Prompt). ZWISCHENSPEICHER (Leons 3-Monats-Frage): Firebase
      Storage im selben Projekt — heute existiert KEIN Videospeicher
      (Browser lädt direkt zu Google, dort 48-h-Auto-Expiry). Upload direkt
      Browser→Storage (resumable, umgeht Vercel-4,5-MB wie der heutige
      Google-Pfad); Storage-Rules: nur eigener Pfad, Größenlimit
      (request.resource.size) + contentType video/*; **Objekt-Lifecycle-
      Regel am Bucket löscht nach 90 Tagen automatisch — null eigener
      Code**; nach erfolgreicher Analyse SOFORT löschen (Ergebnis liegt in
      Firestore, die 90 Tage sind nur das Netz für nie bestätigte);
      Status-Anzeige „abgelaufen" lazy über createdAt, kein Cron. ACHTUNG:
      Firebase Storage braucht ggf. Blaze-Plan (prüfen); Kosten
      ~2,6 Ct/GB/Monat, Handyvideo 8 min ≈ 0,5–1 GB → Limits: max. 2
      offene Einreichungen je Athlet, Längen-/Auflösungs-Hinweis. TRANSFER
      BEI BESTÄTIGUNG: Trainer-Browser lädt aus Storage und nutzt den
      VORHANDENEN Google-Upload-Pfad samt Fortschritts-UI weiter (Vercel
      transportiert nie Videobytes; Server-Kopie wäre 300-s-Risiko).
      VERWORFENE VARIANTE: Gemini-Phase-1 sofort bei Einreichung (nur
      Beobachtungs-JSON speichern, kein Storage nötig) — scheitert daran,
      dass der Trainer das Video nach 48 h nicht mehr ansehen kann und
      Müll-Einreichungen Tokens kosten. KONTINGENT: Einreichen kostet kein
      KI-Guthaben, erst die Trainer-Bestätigung. BENACHRICHTIGUNG v1:
      Badge/Karte im Trainer-Bereich (kein Push-System vorhanden; Push =
      Capacitor-Thema). RECHT: Einwilligungs-Hinweis beim Upload
      (Sparringspartner, ggf. Minderjährige im Bild!), feste 90-Tage-
      Löschfrist ist DSGVO-seitig ein Plus; gehört mit ins AGB-Paket.
      STRATEGIE: füttert direkt das Datengate von Workout-Pläne Stufe 2
      („3 übernommene Analysen je Athlet") — Motivation liegt beim
      Athleten.
- [ ] Multi-Gym Phase 3: trainingSessions/aiUsage/techniqueStats gym-scopen,
      Wochenplan-Mehrplan-Modell, Admin-Konsole
- [ ] Stripe Pro-Membership (Checkout, Webhook, Premium-Gate)
- [ ] Video-Analyse: Web-Anreicherung (Fragenkatalog Abschnitt G, source=web)
- [ ] Video-Analyse: Trends über mehrere Videos (Fragenkatalog E4, ab ≥2 Videos)
- [ ] Video-Analyse: Gemini auf `:streamGenerateContent` umstellen — würde die
      heute rein zeitgeschätzte Gemini-Phase der Fortschrittsanzeige durch ein
      echtes Signal ersetzen. Modell-Output ändert sich dadurch NICHT, wohl aber
      die Fehlerfläche (Chunk-Zusammenbau + Retry-/Modellketten-Logik) →
      blockierenden Aufruf als Fallback behalten
- [ ] Video-Analyse: `dnaSplit`/`dnaSplitWeight`/`actionStats` beim Übernehmen
      aus ALLEN Analysen mit `appliedStats` neu berechnen, statt sie
      fortzuschreiben. Der gewichtete Mittelwert ist reihenfolgeunabhängig →
      gleiches Ergebnis, aber selbstheilend. Löst zwei Dinge auf einmal:
      (a) Löschen einer Analyse korrigiert Gewicht und Zählungen automatisch —
      heute wirkt ein gelöschtes Video weiter; (b) das verbliebene
      Sekundenbruchteil-Fenster zwischen Lesen und Schreiben beim
      gleichzeitigen Übernehmen durch zwei Trainer. Seit Entfernung der
      manuellen Eingabe von Split und Technik-Statistik (2026-08-20) zudem
      der einzige Weg, einen falschen Split oder eine falsche Technik-Zählung
      zu korrigieren. Kosten: eine
      Collection-Query pro Übernahme
- [ ] **„Meine Analysen" per collectionGroup statt Fächer** (DeepFight-
      Neuaufbau, 07.09.2026): Die Liste auf `/trainer/deepfight` liest heute
      eine Abfrage je Ziel (Gegner der Bibliothek + jedes sichtbare
      Mitglied, ~30 Abfragen, nur beim Öffnen). Sauber wäre
      `collectionGroup("videoAnalyses")` mit `where("createdBy","==",uid)`
      — dafür braucht `firestore.rules` eine `{path=**}/videoAnalyses`-
      Regel, die ALLEIN aus dem Dokument beweisbar ist (Falle: `{path=**}`
      matcht auch direkte Pfade und Regeln sind ODER-verknüpft, siehe
      Wettkampf-Lücke). `createdBy == uid` allein reicht NICHT: Ein Trainer
      läse damit weiter seine Analysen über einen Kollegen, der die
      Freigabe inzwischen zurückgezogen hat, und nach einem Gym-Wechsel die
      Analysen des alten Gyms. Nötig: `gymId` am Analyse-Dokument (Backfill
      + beide Schreibstellen), Regel mit direktem Feldzugriff (kein
      `get(…, default)`), Composite-Index, `check-privacy-gate.mjs` erweitern.
- [ ] Video-Analyse: Herkunft der DNA-Antworten wird nicht gespeichert (SEIT
      15.09.2026 Teil des Analyse-Umbaus: Seiten mit Gewichtssumme je
      Antwort, siehe „BESCHLOSSENER UMBAU") — die
      Konflikt-Anzeige kann daher nicht sagen, aus welchem (wie gewichteten)
      Video die bisherige Antwort stammt. Seit Teilschritt 5 sagt sie deshalb
      ausdrücklich nur „Bisher im Profil" und behauptet keine Quelle; wer das
      Feld nachrüstet, kann dort den Satz schärfen.
- [ ] **Signalfarben als SCHRIFT halten im hellen Theme kein AA — app-weit**
      (gemessen 14.09. auf `/kampfprofil`, wo der Analyse-Bericht auf einer
      DECKENDEN Karte steht). Gegenprobe auf Token-Ebene, ohne jede
      Komponente (zwei Fenster unabhängig, Zahlen auf zwei Stellen
      deckungsgleich). AA verlangt 4,5:

          auf --surface-card     --warning 3,91 FEHL · --positive 4,52 ok ·
                                 --negative 5,24 ok · --accent-text 6,04 ok
          auf --surface-raised   --warning 3,33 FEHL · --positive 3,85 FEHL ·
                                 --negative 4,47 FEHL
          dunkel                 6,24 bis 10,55 — alles ok

      **`--surface-card` ist die HELLSTE Fläche der App** (252,254,254).
      Sobald eine Signalfarbe auf `--surface-raised` steht — Listenzeilen,
      Eingabefelder, Chips, die Gooey-Pille —, fallen ALLE DREI durch, auch
      die beiden, die auf der Karte noch tragen.
      Gerendert fielen im Bericht „Am gefährlichsten"
      und die Konfidenz-Marke auf 3,33. **Das ist keine Eigenheit des
      Berichts**, sondern der `:root`-Werte des hellen Themes (`--warning`
      L 0,60, `--positive` L 0,55); betroffen ist jede Stelle, die eine
      Signalfarbe als Text auf einer Karte zeigt — `AthleteProfileForm`,
      `InviteStatusChip`, `FightCampPlanView`, `OpponentProfileView`,
      `VideoAnalysisSection`. Im DeepFight-Bereich ist es seit Teilschritt 5
      geheilt (Bereichsregel auf L 0,36); die app-weite Entscheidung steht aus,
      weil ein dunkleres Amber/Grün überall sichtbar wird — das gehört Leon
      vorgelegt, nicht nebenbei geändert. Messweg steht in
      `scripts/mess-t5-bericht.mjs` („Gegenprobe auf Token-Ebene").
- [ ] Optional: Google-Billing aktivieren → Detail-Analyse (Gemini Pro) nutzbar
