# Tidal Athletics — Design-Tokens (Handoff-Referenz)

Stand: 21.08.2026 · Quelle: `tokens/colors.css`, `tokens/typography.css`,
`tokens/spacing.css`, `tokens/ambient.css`

---

## 1. Eingabewerte (die EINZIGEN echten Inputs)

Das gesamte Farbsystem leitet sich per oklch-Formeln aus **2 Eingaben** ab:

| Input | Wert (Default) | Bedeutung |
|---|---|---|
| `--accent-h` | `197` | Gym-Akzent Hue (Riptide-Teal, gesampelt aus Logo-Cyan `#00f7ff`) |
| `--accent-c` | `0.14` | Gym-Akzent Chroma |
| `--accent2-h` | `305` | Brand-Violett Hue (Jazz-Lila) — **fix, keine Ableitung** |
| `--accent2-c` | `0.15` | Brand-Violett Chroma — **fix** |

**Gym-Theming:** Ein Gym bekommt seine eigene Akzentfarbe, indem NUR
`--accent-h`/`--accent-c` überschrieben werden — alle Ableitungen rechnen
automatisch nach. Wichtig: Wer die Eingaben auf einem Unter-Element
überschreibt, setzt dort zusätzlich `data-theme="dark"` bzw. `"light"`,
damit die abgeleiteten Tokens dort neu berechnet werden.

**Warum Violett kein Derivat ist:** Ein Hue-Shift vom Gym-Akzent würde z. B.
bei einem roten Gym ein grünes Verlaufsende erzeugen. Violett ist deshalb
feste Brand-Konstante; im Verlauf `--grad-fight` folgt nur der erste Stopp
dem Gym-Akzent, das violette Ende bleibt markenstabil.

**Ableitungslogik:** Jedes weitere Farbtoken ist
`oklch(L calc(var(--accent-c) * Faktor) var(--accent-h))` — feste Lightness
pro Token, Chroma als Faktor der Eingabe, Hue durchgereicht. Hintergründe
tragen minimale Akzent-Tönung (Faktor 0.06–0.08), Text 0.04–0.15,
Akzent-Ableitungen 0.85–1.0.

---

## 2. Farb-Tokens — DARK (Default, `:root` / `[data-theme="dark"]`)

Format: Token → Formel → aufgelöster Wert bei Default-Teal (H 197, C 0.14).

### Hintergrund-Ebenen / Surfaces
| Token | Formel (L / C-Faktor) | Aufgelöst |
|---|---|---|
| `--bg-0` | 0.15 / ×0.06 | `oklch(0.15 0.0084 197)` |
| `--bg-1` | 0.19 / ×0.07 | `oklch(0.19 0.0098 197)` |
| `--bg-2` | 0.235 / ×0.08 | `oklch(0.235 0.0112 197)` |
| `--line` | 0.30 / ×0.08 | `oklch(0.30 0.0112 197)` |
| `--line-strong` | 0.38 / ×0.08 | `oklch(0.38 0.0112 197)` |
| `--card-border` | — | `transparent` (Dark-Karten rahmenlos — die Ebene trennt) |

Aliases: `--surface-page: var(--bg-0)`, `--surface-card: var(--bg-1)`,
`--surface-raised: var(--bg-2)`.

### Textstufen
| Token | Formel | Aufgelöst | Kontrast-Ziel |
|---|---|---|---|
| `--text-1` | 0.96 / ×0.04 | `oklch(0.96 0.0056 197)` | ≥ 12:1 |
| `--text-2` | 0.76 / ×0.07 | `oklch(0.76 0.0098 197)` | ≥ 4.5:1 |
| `--text-3` | 0.60 / ×0.09 | `oklch(0.60 0.0126 197)` | nur Labels, ≥ 3:1 |

Aliases: `--text-body: var(--text-1)`, `--text-muted: var(--text-2)`,
`--text-label: var(--text-3)`.

### Gym-Akzent (Ableitungen)
| Token | Formel | Aufgelöst |
|---|---|---|
| `--accent` | 0.78 / ×1.0 | `oklch(0.78 0.14 197)` |
| `--accent-hover` | 0.84 / ×0.85 | `oklch(0.84 0.119 197)` |
| `--accent-press` | 0.72 / ×1.0 | `oklch(0.72 0.14 197)` |
| `--accent-subtle` | 0.26 / ×0.38 | `oklch(0.26 0.0532 197)` |
| `--accent-text` | 0.80 / ×0.85 | `oklch(0.80 0.119 197)` |
| `--on-accent` | 0.16 / ×0.3 | `oklch(0.16 0.042 197)` |

### Brand-Violett
| Token | Formel | Aufgelöst |
|---|---|---|
| `--accent-2` | 0.70 / ×1.0 (accent2) | `oklch(0.70 0.15 305)` |
| `--accent-2-subtle` | 0.27 / ×0.38 (accent2) | `oklch(0.27 0.057 305)` |

### Semantik (feste Hues, keine Gym-Ableitung)
| Token | Aufgelöst |
|---|---|
| `--positive` | `oklch(0.78 0.13 150)` |
| `--negative` | `oklch(0.72 0.16 25)` |
| `--warning` | `oklch(0.82 0.13 90)` |

### Liquid Glass + Schatten
| Token | Wert |
|---|---|
| `--glass-bg` | `oklch(0.22 0.0112 197 / 0.42)` |
| `--glass-border` | `oklch(1 0 0 / 0.12)` (1px) |
| `--glass-highlight` | `oklch(1 0 0 / 0.07)` (Inset-Highlight oben) |
| `--glass-blur` | `24px` (backdrop-filter) |
| `--glass-shadow` | `0 12px 40px oklch(0 0 0 / 0.35)` |
| `--accent-glow` | `0 0 14px oklch(0.78 0.14 197 / 0.16)` — NUR Primär-Button/aktive Zustände |

`color-scheme: dark`.

---

## 3. Farb-Tokens — LIGHT (`[data-theme="light"]`)

Gleiche Formellogik, eigene L-Werte/Faktoren:

| Token | Aufgelöst |
|---|---|
| `--bg-0` | `oklch(0.975 0.0042 197)` |
| `--bg-1` | `oklch(0.995 0.0021 197)` |
| `--bg-2` | `oklch(0.94 0.0084 197)` |
| `--line` | `oklch(0.88 0.0112 197)` |
| `--line-strong` | `oklch(0.80 0.0112 197)` |
| `--card-border` | `oklch(0.88 0.0112 197)` — Light-Karten bekommen 1px Rahmen |
| `--text-1` | `oklch(0.21 0.021 197)` |
| `--text-2` | `oklch(0.44 0.021 197)` |
| `--text-3` | `oklch(0.57 0.021 197)` |
| `--accent` | `oklch(0.50 0.14 197)` |
| `--accent-hover` | `oklch(0.44 0.14 197)` |
| `--accent-press` | `oklch(0.40 0.14 197)` |
| `--accent-subtle` | `oklch(0.93 0.035 197)` |
| `--accent-text` | `oklch(0.46 0.14 197)` |
| `--on-accent` | `oklch(0.99 0.0028 197)` |
| `--accent-2` | `oklch(0.50 0.15 305)` |
| `--accent-2-subtle` | `oklch(0.93 0.0375 305)` |
| `--positive` | `oklch(0.55 0.13 150)` |
| `--negative` | `oklch(0.55 0.18 25)` |
| `--warning` | `oklch(0.60 0.12 90)` |
| `--glass-bg` | `oklch(0.98 0.0042 197 / 0.45)` |
| `--glass-border` | `oklch(0.2 0.02 197 / 0.10)` |
| `--glass-highlight` | `oklch(1 0 0 / 0.65)` |
| `--glass-shadow` | `0 12px 40px oklch(0.3 0.03 197 / 0.16)` |
| `--accent-glow` | `0 0 14px oklch(0.50 0.14 197 / 0.12)` |

`color-scheme: light`. Akzent-L ist pro Modus so gewählt, dass
Buttons/Text WCAG AA erfüllen (Dark: helles Teal + dunkler `--on-accent`;
Light: dunkles Teal + heller `--on-accent`).

---

## 4. Verläufe

### `--grad-fight` — AUSSCHLIESSLICH DeepFight
```css
--grad-fight: linear-gradient(120deg, var(--accent), var(--accent-2));
```
- **Erlaubt:** ausschließlich DeepFight-gebrandete Elemente (KI-Feature),
  z. B. DeepFight-CTA, DeepFight-Fortschritt/Score.
- **Verboten:** generische Fortschrittsbalken, Flächenfüllungen von Karten,
  Text-Fills, alles ohne DeepFight-Kontext.
- DeepFight trägt im Namen immer das Lucide-`sparkles`-Icon in `--accent-2`.

### `--grad-progress` — alle generischen Fortschrittsbalken
```css
/* Dark */
--grad-progress: linear-gradient(90deg,
  oklch(0.62 calc(var(--accent-c)*0.95) var(--accent-h)),   /* = oklch(0.62 0.133 197) */
  oklch(0.82 calc(var(--accent-c)*0.9) var(--accent-h)));   /* = oklch(0.82 0.126 197) */
/* Light */
--grad-progress: linear-gradient(90deg,
  oklch(0.40 var(--accent-c) var(--accent-h)),              /* = oklch(0.40 0.14 197) */
  oklch(0.58 var(--accent-c) var(--accent-h)));             /* = oklch(0.58 0.14 197) */
```
- Tonaler Verlauf NUR aus dem Gym-Akzent (Verlauf über Helligkeit, ein Hue).
- **Erlaubt:** Camp-Fortschritt, Wochenziel, Trainingslast etc. — als
  schmaler Balken (6px, `border-radius: 3px`, Track `--bg-2`).
- **Verboten:** großflächig, als Karten-/Flächenfüllung, als Text-Fill.

**Generell:** Verläufe NIE als Flächenfüllung oder Text-Fill.
`--grad-bg` existiert als Alt-Token (Legacy); Neues nutzt die Ambient-Schicht.

---

## 5. Ambient-Schicht

Weiche, stark geblurte Glows als **separate Ebene HINTER dem Inhalt** —
nie Teil der Kartenfläche. Container: `position: relative` +
`overflow: hidden`; die Kartenfläche selbst bleibt normale Surface
(`--bg-1`). Nur hinter Hero-/Kopfbereichen und leeren Flächen —
**NIE hinter Listen/Tabellen**. WCAG der Texte bleibt unberührt
(niedrige Alpha, Glows sitzen an den Rändern).

`--ambient` = nur Gym-Akzent. `--ambient-fight` = Gym-Akzent + klar
erkennbares Brand-Violett, NUR in DeepFight-Bereichen.

### Nutzung a) Fläche (Hero-/Kopfbereiche)
```html
<div style="position:relative;overflow:hidden">
  <div data-ambient style="background:var(--ambient)"></div>
  <div style="position:relative">…Inhalt…</div>
</div>
```
Token-Definitionen (zwei radiale Glows, laufen in sich auf Alpha 0 aus):
```css
/* Dark */
--ambient:
  radial-gradient(70% 65% at 80% 4%,
    oklch(0.62 var(--accent-c) var(--accent-h) / 0.46),
    oklch(0.62 var(--accent-c) var(--accent-h) / 0) 68%),
  radial-gradient(55% 50% at 8% 42%,
    oklch(0.50 calc(var(--accent-c)*0.85) var(--accent-h) / 0.32),
    oklch(0.50 calc(var(--accent-c)*0.85) var(--accent-h) / 0) 62%);
--ambient-fight:
  radial-gradient(70% 65% at 80% 4%,
    oklch(0.62 var(--accent-c) var(--accent-h) / 0.46),
    oklch(0.62 var(--accent-c) var(--accent-h) / 0) 68%),
  radial-gradient(60% 55% at 2% 96%,
    oklch(0.55 calc(var(--accent2-c)*0.9) var(--accent2-h) / 0.38),
    oklch(0.55 calc(var(--accent2-c)*0.9) var(--accent2-h) / 0) 62%);
/* Light */
--ambient:
  radial-gradient(70% 65% at 80% 4%,
    oklch(0.78 var(--accent-c) var(--accent-h) / 0.55),
    oklch(0.78 var(--accent-c) var(--accent-h) / 0) 68%),
  radial-gradient(55% 50% at 8% 42%,
    oklch(0.84 calc(var(--accent-c)*0.8) var(--accent-h) / 0.42),
    oklch(0.84 calc(var(--accent-c)*0.8) var(--accent-h) / 0) 62%);
--ambient-fight:
  radial-gradient(70% 65% at 80% 4%,
    oklch(0.78 var(--accent-c) var(--accent-h) / 0.55),
    oklch(0.78 var(--accent-c) var(--accent-h) / 0) 68%),
  radial-gradient(60% 55% at 2% 96%,
    oklch(0.82 calc(var(--accent2-c)*0.75) var(--accent2-h) / 0.46),
    oklch(0.82 calc(var(--accent2-c)*0.75) var(--accent2-h) / 0) 62%);
```

### Nutzung b) Glow-Formen (Karten)
1–2 diskrete, organisch platzierte Glow-Formen als Kinder, die über die
Kartenkante hinausragen und vom Container geclippt werden:
```html
<div data-ambient>
  <span data-glow style="width:280px;height:200px;right:-70px;top:-100px;
    background:oklch(0.62 var(--accent-c) var(--accent-h) / 0.46)"></span>
  <span data-glow style="width:200px;height:160px;left:-80px;bottom:-80px;
    background:oklch(0.50 calc(var(--accent-c)*0.85) var(--accent-h) / 0.32);
    animation-duration:36s;animation-delay:-13s"></span>
</div>
```
- Form: Ellipse (`border-radius: 50%`) + `filter: blur(72px)` (statisch,
  wird NIE animiert), niedrige Alpha (0.32–0.55).
- Farben: exakt die oklch-Rezepte der Ambient-Tokens (Dark: Teal L 0.62 /
  0.50, Violett L 0.55; Light: Teal L 0.78 / 0.84, Violett L 0.82).
- DeepFight-Karte ist **violett-dominant**: großer Violett-Glow oben
  rechts, kleiner Teal-Glow unten links (auf einen Blick unterscheidbar
  von Teal-Karten).

### CSS-Mechanik + Drift (aus `tokens/ambient.css`)
```css
@keyframes ambient-drift {
  0%   { transform: translate3d(-15%,-9%,0) scale(1.05); opacity: 0.45; }
  50%  { transform: translate3d(6%,4%,0) scale(1.35); opacity: 1; }
  100% { transform: translate3d(15%,10%,0) scale(1.15); opacity: 0.5; }
}
[data-ambient] {
  /* inset größer als die maximale Drift-Auslenkung, sonst wandert die
     Elementkante ins Bild. Negativer Delay: startet mitten in der Bewegung. */
  position: absolute; inset: -22%; pointer-events: none;
  animation: ambient-drift 20s ease-in-out -7s infinite alternate;
}
/* Flächen-Ambient läuft unten weich aus (nicht für Karten-Glows — deren
   Violett am Kartenrand darf nicht verschluckt werden): */
[data-ambient]:not(:has([data-glow])) {
  -webkit-mask-image: linear-gradient(to bottom, black 55%, transparent 95%);
  mask-image: linear-gradient(to bottom, black 55%, transparent 95%);
}
[data-ambient]:has([data-glow]) { inset: 0; animation: none; }
[data-ambient] [data-glow] {
  position: absolute; border-radius: 50%; filter: blur(72px);
  animation: ambient-drift 28s ease-in-out infinite alternate;
}
@media (prefers-reduced-motion: reduce) {
  [data-ambient], [data-ambient] [data-glow] { animation: none; }
}
```
- Drift: 20–36 s Loop (Fläche 20 s, Delay −7 s; Glow 1: 28 s; Glow 2: 34–36 s mit
  negativem Delay −11/−13 s zur Phasenverschiebung), `ease-in-out`,
  `infinite alternate`.
- Animiert werden NUR `transform` und `opacity` — nie `filter`.
- `prefers-reduced-motion: reduce` → komplett statisch.

---

## 6. Typografie (`tokens/typography.css`)

Fonts: **Archivo** (Google Fonts, Gewichte 400/500/600/700/800) für Display
UND Body; Mono: `ui-monospace, 'SF Mono', Menlo, monospace`.

| Token | Wert | Regel |
|---|---|---|
| `--type-display` | `800 28px/1.15 Archivo` | caps + `--ls-display` (0.04em) |
| `--type-h2` | `700 20px/1.2 Archivo` | caps + 0.04em |
| `--type-h3` | `700 16px/1.3 Archivo` | gemischt |
| `--type-body` | `400 15px/1.5 Archivo` | min. 15px Fließtext (mobil) |
| `--type-body-strong` | `600 15px/1.5 Archivo` | |
| `--type-num-xl` | `700 30px/1.1 Archivo` | `font-variant-numeric: tabular-nums` |
| `--type-sub` | `400 13px/1.45 Archivo` | |
| `--type-num` | `600 13px/1.2 Mono` | Zeiten/Messwerte, tabular-nums |
| `--type-label` | `600 11px/1.2 Archivo` | caps + `--ls-label` (0.12em) |

**Versalien-Regel:** Uppercase NUR für Überschriften und Labels (immer mit
Letterspacing); Fließtext gemischt. Zahlen präzise mit Einheit („14,2 h",
„82/min"), Dezimalkomma, Mono für Messwerte/Zeiten. Keine Emojis.

---

## 7. Abstände, Radien, Motion (`tokens/spacing.css`)

| Gruppe | Tokens |
|---|---|
| Spacing (4px-Raster) | `--sp-1: 4px` · `--sp-2: 8px` · `--sp-3: 12px` · `--sp-4: 16px` · `--sp-5: 20px` · `--sp-6: 24px` · `--sp-8: 32px` · `--sp-10: 40px` |
| Radien | `--r-sm: 8px` · `--r-md: 12px` (Buttons/Inputs) · `--r-lg: 16px` (Karten) · `--r-xl: 22px` (Modals) · `--r-pill: 999px` (Chips) |
| Touchziel | `--hit-min: 44px` |
| Easing | `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Dauern | `--dur-fast: 120ms` · `--dur-med: 220ms` — Fades + kleine Translate (4–8px), kein Bounce |

**Schatten:** nur `--glass-shadow` auf Glass-Karten; `--accent-glow` sehr
dosiert (nur Primär-Button/aktive Zustände); sonst flach.
**Rahmen:** Dark-Karten rahmenlos; Light 1px `--line`/`--card-border`.
Sichtbare Rahmen nur: Secondary-Button, Inputs, Geräte-/Modal-Rand.
Listen nie als Karten-Stapel, sondern EINE Karte mit Haarlinien-Trennern
(`--line`). Layout mobile-first 390px, 16px Außenabstand.
