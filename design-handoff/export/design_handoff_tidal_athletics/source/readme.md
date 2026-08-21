# Tidal Athletics Design-System

MMA-Trainings- & Coaching-App: Dashboard, Kursplan, Wettkampfvorbereitung, KI-Video-Analyse **„DeepFight"**. Zielgruppe: Kampfsportler:innen und Coaches. Primär Smartphone, später native App.

Richtung: **„Riptide"** (vom Nutzer gewählt, Runde 1 in `Richtungen.dc.html`) — athletisch, präzise, hochwertig. Liquid-Glass-Oberflächen (Tesla/SpaceX-Reduktion) mit einem dosierten Nod an die 90er „Jazz"-Ära (Sweetheart-Cup): Teal→Lila-Verlauf an ausgewählten Stellen.

## Farbsystem — 2 Eingaben, alles Formel
Definiert in `tokens/colors.css`. Eingaben:
- `--accent-h` / `--accent-c` — **Gym-Akzent** (Default Teal: H 220, C 0.13). Gyms bekommen eigene Akzentfarbe, indem NUR diese zwei Werte überschrieben werden.
- `--accent2-h` / `--accent2-c` — Brand-Lila (H 305, C 0.15), fix; nur für `--accent-2` und den Jazz-Verlauf `--grad-fight`.

Alle Hintergrund-Ebenen (`--bg-0/1/2`), Linien, Textstufen (`--text-1/2/3`), Akzent-Ableitungen (hover/press/subtle/text/on-accent) und Glass-Werte sind `oklch(L calc(C×Faktor) H)`-Formeln. Dark ist Default (`:root`), Light gleichwertig via `[data-theme="light"]`.

Kontraste: text-1 ≥ 12:1, text-2 ≥ 4.5:1, text-3 nur für Labels ≥ 3:1; Akzent-L ist pro Modus so gewählt, dass Buttons/Text WCAG AA erfüllen.

## CONTENT FUNDAMENTALS
- **Du-Form, direkt**, knappe Sätze: „Session starten", „Dein Plan für heute", „+8 % ggü. Vorwoche".
- **Keine Emojis.** Keine Ausrufezeichen-Kaskaden, kein Motivations-Kitsch.
- **Versalien nur** für Überschriften und Labels (mit Letterspacing); Fließtext gemischt.
- Zahlen präzise mit Einheit: „14,2 h", „82/min", „Runde 3/5". Zeiten/Messwerte in Mono (`--type-num`).
- **Status in Listen** (Frei/Gebucht/Ausgebucht …) als Punkt + Versalien-Text (`Badge appearance="plain"`), NICHT als farbige Pill — Pills nur für Marken-Kontext.
- **DeepFight** trägt im Namen immer das KI-Symbol (Lucide `sparkles`, in `--accent-2`) — links vor dem Namen, auch im Tab-Menü.
- **Erkenntnis-Zeilen** (DeepFight): Icon-Slot links (36px, `--bg-2`, Icon in Semantikfarbe: crosshair/shield-check/repeat), kein Wort-Label (Wahl 3C; Fallback Typo-Kicker 3A).
- Deutsch, Dezimalkomma. Coach-Kontext sachlich: „Coach Amir · Matte 2".

## VISUAL FOUNDATIONS
- **Farbe:** eine Akzentfarbe pro Gym + fixes Brand-Lila. `--grad-fight` (Akzent→Violett) AUSSCHLIESSLICH für DeepFight-gebrandete Elemente; alle generischen Fortschrittsbalken (Camp, Wochenziel, Last) nutzen den tonalen `--grad-progress` (nur Gym-Akzent, Verlauf über Helligkeit) — nie großflächig.
- **Typo:** Archivo überall (Display 800 caps ls .04em, Body 400/600 15px min., Label 600 11px caps ls .12em); Mono für Zeiten/Messwerte, `tabular-nums`.
- **Hintergründe:** `--bg-0` flach. **Ambient-Schicht** (`--ambient`, nur Gym-Akzent; `--ambient-fight` + Brand-Violett nur in DeepFight-Bereichen): stark geblurte Glows als `<div data-ambient>` HINTER Hero-/Kopfbereichen und leeren Flächen — nie hinter Listen/Tabellen, niedrige Deckkraft, WCAG bleibt unberührt; Drift 32s nur transform/opacity, stoppt bei prefers-reduced-motion (`tokens/ambient.css`). `--grad-bg` ist Alt-Token, Neues nutzt `--ambient`. Keine Muster, keine Illustrationen.
- **Liquid Glass:** Karten über Verläufen/Bildern nutzen `--glass-bg` + `backdrop-filter: blur(var(--glass-blur))` + `--glass-border` (1px) + Inset-Highlight `--glass-highlight` + `--glass-shadow`. Flache Karten auf `--bg-0` nutzen schlicht `--bg-1`, ohne Blur.
- **Radien:** Karten 16px (`--r-lg`), Buttons/Inputs 12px, Chips pill, Modals 22px.
- **Rahmen sparsam:** Dark-Karten sind rahmenlos (`--card-border: transparent`) — die Ebene trennt; Light bekommt 1px `--line`. Listen nie als Karten-Stapel, sondern EINE Karte mit Haarlinien-Trennern. Sichtbare Rahmen nur: Secondary-Button, Inputs, Geräte-/Modal-Rand.
- **Schatten:** nur Glass-Schatten; `--accent-glow` sehr dosiert (nur Primär-Button/aktive Zustände, 16 % Alpha); sonst flach.
- **Motion:** kurz und präzise — 120/220ms, `--ease-out`; Fades + kleine Translate (4–8px). Kein Bounce.
- **Hover:** Akzent via `--accent-hover`; neutrale Flächen 1 Ebene heller. **Press:** `--accent-press` + scale(0.98).
- **Layout:** mobile-first 390px, 16px Außenabstand, 4px-Raster; Bottom-Tab-Bar als Glass-Leiste fix; Mindest-Touchziel 44px.
- **Imagery:** Trainings-/Kampffotos kühl gegradet, gern dunkel mit Teal-Licht; Platzhalter gestreift mit Mono-Beschriftung, keine gezeichneten SVG-Illustrationen.

## ICONOGRAPHY
Kein eigenes Icon-Set vorhanden → **Lucide** via CDN (Stroke 2px, passt zur präzisen Linie). Substitution — bei eigenem Icon-Font bitte liefern. Einfärbung `currentColor`; Größen 16/20/24. Keine Emojis, keine Unicode-Zeichen als Icons.

## Logo
`assets/logo.png` (TA-MMA-Hai-Wappen, 512px). Gym-Akzent daraus gesampelt: Cyan `#00f7ff` → `--accent-h: 197`. Das Logo-Pink wird NICHT ins UI übernommen (Wahl 2b: Jazz-Lila H 305). Wortmarke: „TIDAL ATHLETICS" Archivo 800 caps, „ATHLETICS" in Akzent. In den App-Screens selbst erscheint KEIN Logo (nur Login/Marketing).

## Index
- `styles.css` → `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`
- `guidelines/` — Specimen-Cards (Colors, Type, Spacing, Glass, Brand)
- `components/` — core (Button, IconButton, Badge, Tag), forms (Input, Switch, SegmentedControl), surfaces (Card, StatCard, ProgressBar), feedback (Dialog, Toast)
- `ui_kits/app/` — Screens: Dashboard, Kursplan, Wettkampf, DeepFight
- `Richtungen.dc.html` — Runde 1 (3 Richtungen), Entscheidung: 1A
- `SKILL.md` — Agent-Skill-Einstieg
