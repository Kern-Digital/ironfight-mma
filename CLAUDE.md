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

### ETAPPE 1 GEBAUT — WÄHRUNG UND NEUBERECHNUNG (16.09.2026, nicht committet)
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
      Disziplin-Seite mit Level-Segment (Anfänger/Fortgeschritten/Pro) und
      Planliste (Dauer, Übungszahl, Equipment) → Plan-Detail. Jede Ebene
      mit „← Zurück"-Kopf; Training-Tab bleibt für `/workout/*` aktiv.
      (3) Persönliche Kopien: `users/{uid}/workoutPlans` + Firestore-Regel,
      Sektion „Eigene Workoutpläne" als ERSTER Block im Hub, Auto-Save-
      Muster. (4) App-weit standardisierte Listen-Gesten als Komponente:
      Links wischen = Löschen (Undo-Leiste statt Popup), langes Halten =
      Verschieben, „+ Übung hinzufügen" unter jeder Rubrik mit Übungs-Picker
      (ui/Select-Stil, Filter Disziplin/Equipment); danach auch im Runner und
      in der Bibliothek einsetzen. (5) Inhalt: Start-Pläne pro Disziplin ×
      Level werden per KI ausgearbeitet, Trainer prüfen nur (Leons Vorgabe).
- [ ] **Workout-Pläne AUSBAU — nach den Teilschritten der Etappe (Leons
      Ansage 2026-08-27):** Drei aufeinander aufbauende Stufen.
      (1) **Trainer-Pläne mit Freigabe:** Trainer erstellen Pläne manuell
      (denselben Editor wiederverwenden wie für persönliche Kopien —
      Listen-Gesten + Übungs-Picker aus Spec-Punkt 4) und geben sie an
      ausgewählte Kurse ODER einzelne Schüler frei; sichtbar für die
      Athleten unter „Strukturierte Pläne" im Hub (eigene Sektion „Vom
      Trainer für dich") und in der Disziplin→Level-Navigation. ACHTUNG
      Sicherheitsmodell: Sichtbarkeit MUSS serverseitig in den Firestore-
      Regeln liegen (NICHT Client-Filter wie sharedWithAthlete heute) —
      rules-tauglich ist eine beim Freigeben materialisierte
      audienceUids-Liste im Plan-Dokument (Kurs→Mitglieder auflösen);
      echte Kurs-Mitgliedschaft kommt erst mit Multi-Gym Phase 2
      (Einladungen/Mitglieder), bis dahin explizite Schüler-Auswahl.
      Persönliche Kopien bleiben Snapshots — ein Trainer-Edit synct nicht
      in bestehende Kopien.
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
      (b) **Braucht Kurs→Trainer-Zuordnung** (Leons Wunsch Trainer-Auslastung):
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
