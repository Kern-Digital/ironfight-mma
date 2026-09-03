# SIDEBAR-SPEC — Desktop-Hülle für Trainer, Verwaltung und Admin

> Leons Vorgabe vom 01.09.2026: Die Desktop-Hülle der Stab-Rollen ist eine
> **Sidebar links**. **Header (Navbar) und Footer fallen ersatzlos weg.**
> Als Muster hat er eine fertige React-Sidebar geliefert; **das Aussehen soll
> bis ins Detail übernommen werden** (Radien, Abstände, Schriftgrößen) —
> „nur inhaltlich und strukturiert an uns angepasst".
>
> Diese Datei hält die MASSE der Vorlage fest, damit sie nicht noch einmal
> durch ein Chatfenster geschleppt werden muss, und die Übersetzung in unser
> Token-System. Sie ist die Bauvorlage, nicht das Ergebnis.

## 1. Warum nicht die Original-Komponente

Die Vorlage ist eine **shadcn-Komponente mit `lucide-react`**. Das Projekt hat
weder shadcn noch Radix noch lucide (geprüft in `package.json`), sondern ein
eigenes Token-System (`--surface-*`, `--text-*`, `--line`, `--accent`) und eine
eigene Icon-Registry (`components/ui/Icon.tsx`).

Ein zweites Icon-Set und ein zweites Farbsystem würden **DESIGN-BRIEF §1.1**
(Token-only-Branding: EINE Variable ändern → App folgt) und die Icon-Regel
brechen — und der Akzent-Test der Abnahme-Checkliste §5 fiele durch. Deshalb:
**Maße und Verhalten 1:1, Farben und Icons aus unserem System.**

Damit die Maße trotzdem token-geführt bleiben (und nicht als 40 verstreute
Literale enden), kommen die Zahlen als EIGENE Tokens nach `app/globals.css` —
siehe §3.

## 2. Maßblatt der Vorlage (Originalwerte, Tailwind → px)

### Rahmen
| Element | Vorlage | px / Wert |
|---|---|---|
| Breite | `w-[260px]` | **260 px** |
| Innenabstand | `p-3` | **12 px** |
| Fläche | `bg-card/50` | Karte, 50 % gegen den Seitengrund |
| Trennkante rechts | `border-r border-border/50` | 1 px |
| Einklappen | `w-[260px] → w-0`, `opacity 1 → 0` | **300 ms ease-in-out** |

### Gym-Block oben (Vorlage: WorkspaceSwitcher)
| Element | Vorlage | px / Wert |
|---|---|---|
| Zeile | `px-2 py-2 mb-4 rounded-lg` | 8 px innen, 16 px Abstand nach unten, **Radius 8 px** |
| Zeichen | `w-8 h-8 rounded-[6px]` | **32×32, Radius 6 px**, Fläche = Akzent, Text = on-accent |
| Zeichen-Text | `font-semibold text-[13px]` | 13 px / 600 |
| Abstand Zeichen→Text | `gap-3` | 12 px |
| Name | `text-[13px] font-medium leading-none mb-1 truncate max-w-[120px]` | **13 px / 500**, 4 px Abstand, max. 120 px |
| Unterzeile | `text-[11px] text-muted-foreground leading-none` | **11 px** |
| Chevron | `w-4 h-4` `strokeWidth 1.5` | **16 px** |
| Aufklapp-Panel | `top-[52px] w-full rounded-lg shadow-xl py-1 gap-0.5` | 52 px unter der Zeile, Radius 8 px, 4 px innen, 2 px Reihenabstand |
| Panel-Zeile | `px-3 py-2 mx-1 text-[13px] rounded-md` | 12/8 px, Radius **6 px** |
| Panel-Trenner | `h-px my-1 mx-2` | 1 px, 4 px/8 px |
| Panel-Animation | `fade-in zoom-in-95` | **100 ms** |

### Menüpunkt
| Element | Vorlage | px / Wert |
|---|---|---|
| Zeile | `px-2.5 py-[7px] rounded-[6px]` | 10 px / **7 px**, **Radius 6 px** |
| Einrückung je Ebene | `paddingLeft: level*12 + 10` | **12 px pro Ebene**, Basis 10 px |
| Übergang | `transition-all duration-200` | **200 ms** |
| Symbol | `w-[16px] h-[16px]` `strokeWidth 1.5` | **16 px, Strichstärke 1.5** |
| Abstand Symbol→Text | `gap-2.5` | 10 px |
| Text | `text-[13px] tracking-wide truncate` | **13 px, +0.025 em** |
| Aktiv | `bg-black/5 dark:bg-white/10` + `font-medium` | eine Ebene heller, **500** |
| Ruhend | `text-muted-foreground` | gedimmt |
| Hover | `bg-black/5 dark:bg-white/5` + `text-foreground/90` | schwächer als aktiv |
| Rechter Block | `gap-2` | 8 px |
| Tastenkürzel | `h-5 px-1.5 text-[10px] font-mono rounded-[4px]`, `hidden group-hover:inline-flex` | 20 px hoch, **10 px Mono, Radius 4 px**, nur bei Hover |
| Zähler-Badge | `min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full` | 20 px, **10 px / 500**, Pille, Fläche Akzent 10 % |
| Aufklapp-Pfeil | `w-3.5 h-3.5` `strokeWidth 2`, `rotate-90` | **14 px**, Drehung **200 ms** |

### Unterpunkte
| Element | Vorlage | px / Wert |
|---|---|---|
| Aufklappen | `grid-rows-[0fr] → [1fr]` + opacity | **300 ms ease-in-out** (kein height-Sprung) |
| Reihenabstand | `gap-0.5 mt-0.5` | 2 px / 2 px |
| Führungslinie | `border-l`, `left: level*12 + 17.5` | 1 px senkrecht, sehr schwach |

### Gruppen und Fuß
| Element | Vorlage | px / Wert |
|---|---|---|
| Abstand zwischen Gruppen | `gap-4` | **16 px** |
| Abstand innerhalb | `gap-0.5` | 2 px |
| Zwischenüberschrift | `px-2.5 mb-1 text-[11px] font-semibold tracking-wider uppercase` | **11 px / 600, +0.05 em, Versalien** |
| Liste | `flex-1 overflow-y-auto`, Scrollbalken versteckt | `.no-scrollbar` existiert |
| Fußgruppe | `mt-auto pt-4 border-t` | 16 px über der Linie |

## 3. Übersetzung in unser System

### Neue Tokens (nach `app/globals.css`, damit die Maße nicht als Literale verstreut liegen)
```
--sb-w: 260px;          /* offene Sidebar */
--sb-w-rail: 56px;      /* eingeklappt — siehe §5, NICHT 0 */
--sb-pad: 12px;
--r-nav: 6px;           /* Menüpunkt, Panel-Zeile, Gym-Zeichen */
--r-nav-lg: 8px;        /* Gym-Zeile, Aufklapp-Panel */
--r-kbd: 4px;           /* Tastenkürzel */
--type-nav: 400 13px/1.2 var(--font-body);
--type-nav-heading: 600 11px/1.2 var(--font-body);
--type-nav-meta: 500 10px/1 var(--font-body);
--ls-nav: 0.025em;
--ls-nav-heading: 0.05em;
```
**Achtung:** Unsere Typo-Skala geht mobil eine Stufe HOCH (`max-width: 640px`,
Leon 26.08.). Die Sidebar-Tokens dürfen dort NICHT mitwachsen — die Schublade
auf dem Handy soll dieselben 13 px tragen.

### Farbzuordnung
| Vorlage (shadcn) | Bei uns |
|---|---|
| `bg-card` | `var(--surface-card)` |
| `bg-card/50` | `color-mix(in oklab, var(--surface-card) 50%, var(--surface-page))` |
| `border-border/50` | `var(--line)` |
| `text-foreground` | `var(--text-body)` |
| `text-foreground/90` (Hover) | `var(--text-2)` |
| `text-muted-foreground` (ruhend) | `var(--text-2)` |
| `text-muted-foreground/70` (Symbol ruhend) | `var(--text-3)` |
| `text-muted-foreground/50` (Zwischenüberschrift) | `var(--text-label)` — unsere Regel: Label nie derselbe Token wie der Text darunter |
| `bg-black/5 dark:bg-white/10` (aktiv) | `var(--surface-raised)` |
| `hover:bg-black/5 dark:bg-white/5` | `color-mix(in oklab, var(--surface-raised) 55%, transparent)` |
| `bg-primary` / `text-primary-foreground` | `var(--accent)` / `var(--on-accent)` |
| `bg-primary/10` / `text-primary` | `color-mix(in oklab, var(--accent) 12%, transparent)` / `var(--accent-text)` |
| `shadow-xl` (Panel) | neuer Token `--shadow-pop` |

### Icons — fünf fehlen in der Registry
`components/ui/Icon.tsx` muss ergänzt werden (gleicher Stil, 24er-Box,
Strichstärke 1.5–2): **`layout`** (Übersicht), **`panel-left`** (Einklappen),
**`logout`**, **`settings`** (Zahnrad), **`hash`** (Unterpunkt-Marke).
Vorhanden und wiederverwendbar: `users`, `target`, `trophy`, `clipboard`,
`calendar`, `timer`, `book`, `chart`, `shield`, `bell`, `plus`, `search`,
`info`, `user`, `sun`, `moon`, `chevron-down`, `arrow-right`.

## 4. Inhalt je Recht (VOLLSTÄNDIG — nichts darf beim Wegfall von Kopf und Fuß verloren gehen)

Rechte kommen aus `useRights()`; ein Konto mit mehreren Häkchen sieht die
Gruppen untereinander (Admin hat trainer + verwaltung eingerechnet).

**Gruppe „Trainerbereich" (`rights.trainer`)**
- Übersicht → `/trainer` · Schüler → `/trainer/students`
- DeepFight (aufklappbar): Gegner-Scouting → `/trainer/opponents` · Schüler-Analysen → `/trainer/deepfight/athletes` · Meine Analyse → `/trainer/deepfight/me`
- Wettkampf → `/trainer/competitions` · Workout-Pläne → `/trainer/plans` · Stundenplan → `/schedule`

**Gruppe „Gym führen" (`rights.verwaltung`)**
- Mitglieder → `/verwaltung/mitglieder` · Einladungen → `/verwaltung/einladungen` · Neuigkeiten → `/verwaltung/neuigkeiten`
- Badge-Kandidat: Zahl offener Einladungen (die Vorlage hat Zähler-Badges)

**Gruppe „Plattform" (`rights.admin`)**
- Nutzer → `/admin/users` · Demo-Daten → `/admin/seed`

**Gruppe „Mein Training" (immer — Trainer sind auch Athleten)**
- Dashboard → `/dashboard` · Workouts → `/workout/generator` (aktiv bei `^/workout`) · Timer → `/timer` · Kursplan → `/schedule`

**Gruppe „Lernen" (immer)**
- Techniken → `/techniques` · Regeln → `/regeln` · Quiz → `/quiz` · Sammlung → `/library`

**Fußgruppe**
- Kampfprofil → `/kampfprofil` · Account → `/profile` · Hilfe → `/help`
- **Theme-Umschalter** (sitzt heute in der Navbar und hat sonst keinen Platz mehr)
- Abmelden (`logOut()`)
- **Rechtszeile** — siehe §5, offener Punkt

## 5. Vier Stellen, an denen die Vorlage angepasst werden MUSS

1. **Eingeklappt darf nicht 0 px sein.** In der Vorlage sitzt der
   Einklapp-Knopf im Header — den gibt es bei uns nicht mehr. Bei Breite 0
   gäbe es keinen Weg zurück. Deshalb: eingeklappt = **Schiene von 56 px**
   (nur Symbole, Beschriftung als Tooltip), Knopf oben rechts IN der Sidebar.
2. **Kein Gym-Wechsler, sondern eine Gym-Zeile.** Ein Konto gehört genau EINEM
   Gym (Konzept §1) — die Aufklapp-Liste der Vorlage hat noch keinen Inhalt.
   Aufbau der Zeile bleibt (Zeichen + Name + Unterzeile), Unterzeile trägt die
   Rechte (`rightsLabel()`), Aufklappen entfällt vorerst. Die Struktur bleibt
   stehen, weil die Admin-Konsole (Phase 3) daraus einen echten Gym-Wechsler
   macht.
3. **Das Tastenkürzel-Feld braucht eine Funktion oder muss weg.** Eine
   app-weite Suche (⌘K) gibt es nicht. Entweder als eigener Vorgang bauen oder
   die `shortcut`-Anzeige zunächst ungenutzt lassen (Aufbau steht dann schon).
4. **Impressum/Datenschutz brauchen einen neuen Platz.** Sie hängen heute am
   Footer. Ein Impressum muss nach §5 TMG „leicht erkennbar und unmittelbar
   erreichbar" sein — wenn der Footer verschwindet, MUSS die Rechtszeile in
   die Fußgruppe der Sidebar (und im Athleten-Bereich an eine gleichwertige
   Stelle). Hängt am Paket „vor der ersten Zahlung fällig" (AGB, AVV,
   Impressum) aus der Kostenkarte.

## 6. Offen, beim Entwurf mit Leon zu klären

- **Mobil**: Vorschlag Schublade von links (gleiche Punkte) + die Bottom-Bar
  des Athleten-Bereichs. Leon: „entsprechend angepasst".
- **Gilt die Sidebar auch auf `/dashboard`, `/timer`, `/techniques`?** Dafür
  spricht: eine Hülle pro Mensch, kein Wechsel beim Bereichswechsel.
  `components/AthleteChromeGate.tsx` wird damit zur endgültigen
  App-Shell-Weiche (steht als Absicht schon in seinem Kommentar).
- **Athleten ohne Stab-Recht** bleiben unangetastet (Bottom-Bar).
- **Inhaltsbreite** der Seiten neben der Sidebar: heute `max-w-2xl` /
  `lg:max-w-5xl` mittig. Neben 260 px Menü braucht das eine eigene Festlegung —
  deshalb kommt die Hülle VOR dem Rollout der restlichen Seiten.
