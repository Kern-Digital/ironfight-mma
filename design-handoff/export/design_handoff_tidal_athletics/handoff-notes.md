# Handoff-Notes — Tidal Athletics

## Was die Dateien sind
Die HTML-Dateien in diesem Paket sind **Design-Referenzen** (High-Fidelity-
Mockups, in HTML gebaut) — kein Produktionscode. Aufgabe: die Designs in der
Ziel-Codebase (React/Vue/SwiftUI/…) mit deren Patterns **nachbauen**, nicht
die HTML-Dateien direkt shippen. Farben, Typo, Abstände und Radien sind
final und pixelgenau umzusetzen (siehe `tokens.md`).

## Bewusst NICHT umgesetzt / offen
- Nur die zwei Dashboard-Screens (Mobile Athlet:in + Desktop Trainer) sind
  final; Kursplan-, Wettkampf- und DeepFight-Detailscreens existieren nur
  als Referenzen im Projektordner `ui_kits/app/`.
- Keine echten Daten, kein Backend — alle Inhalte sind realistische
  Beispieldaten (Namen, Zeiten, Prozentwerte).
- Navigation: Mobile-Tab-Bar wechselt im Mockup nur den Aktiv-Zustand,
  keine echten Screenwechsel. Desktop-Sidebar-Items sind statisch.
- Hover-/Fokus-/Press-Zustände sind als Regeln definiert (tokens.md,
  readme), aber nicht auf jedem Element im Mockup ausmodelliert:
  Hover = `--accent-hover` bzw. neutrale Fläche 1 Ebene heller;
  Press = `--accent-press` + `scale(0.98)`; Motion 120/220 ms `--ease-out`.
- Leere/Fehler-/Ladezustände sind nicht designt.
- Kein eigenes Icon-Set: Lucide (Stroke 2 px) via CDN als Substitution —
  bei eigenem Icon-Font ersetzen.

## Änderungen nach Handoff (bei der Code-Umsetzung entschieden)
- 2026-08-21, Freigabe Leon: `--glass-bg`-Alpha von 0.55 (Dark) / 0.6 (Light)
  auf **0.42 / 0.45** gesenkt — mehr Liquid-Glass-Durchblick auf die
  Ambient-Schicht. tokens.md und tokens/colors.css sind entsprechend
  aktualisiert; die Werte hier sind der neue Standard.
- 2026-08-21, Freigabe Leon: Ambient kräftiger und sichtbarer. Glow-Alphas:
  Dark 0.34/0.22 → **0.46/0.32** (Fight-Violett 0.28 → **0.38**), Light
  0.42/0.30 → **0.55/0.42** (Fight-Violett 0.34 → **0.46**). Drift der
  Fläche: 32 s → **20 s**, Delay **−7 s** (startet mitten in der Bewegung),
  Amplitude ±15 %/±10 %, Scale bis 1.35, Opacity 0.45–1; `inset` dafür auf
  **−22 %** (größer als die maximale Auslenkung). Neu: Flächen-Ambient läuft
  unten per Maske weich aus (nur die Fläche — Karten-Glows sind ausgenommen),
  und der Clip-Container umschließt NUR die Ambient-Ebene, nie die ganze
  Sektion (sonst werden Glass-Schatten hart abgeschnitten). tokens.md und
  tokens/ambient.css entsprechend aktualisiert.

## Abweichungen von ursprünglichen Vorgaben
- Ambient-Schicht wurde überarbeitet: ursprünglich eine Flächenfüllung mit
  `mask-image`-Fade; jetzt auf Karten 1–2 diskrete Glow-Formen
  (`[data-glow]`, blur 72 px) hinter dem Inhalt, DeepFight-Karte
  violett-dominant. Die Maske wurde entfernt (sie verschluckte das
  Brand-Violett am unteren Kartenrand).
- `--grad-bg` ist Alt-Token (Legacy) — in neuem Code NICHT verwenden,
  Ambient-Schicht nutzen.
- Logo-Pink wird bewusst NICHT ins UI übernommen; Brand-Violett ist
  Jazz-Lila H 305.

## Hinweise für die Code-Umsetzung
- **Mockup-Vereinfachung Geräterahmen:** In `dashboard-mobile.html` ist der
  iPhone-Rahmen (Bezel, Statusbar, Dynamic Island, Home-Indicator) reines
  Deko-CSS für die Präsentation — im echten Produkt entfällt er; die
  Statusbar kommt vom OS. Der Screen-Inhalt beginnt bei `padding-top: 60px`
  (Safe-Area) — im echten Code `env(safe-area-inset-top)` verwenden.
- **Inline-Styles:** Die Mockups nutzen durchgehend Inline-Styles. Im
  echten Code in Komponenten + Token-Variablen (CSS Custom Properties
  1:1 übernehmbar) übersetzen.
- **Icons:** werden im Mockup per `lucide.createIcons()` zur Laufzeit
  ersetzt — im echten Code Icon-Komponenten (Tree-Shaking) verwenden,
  Einfärbung über `currentColor`, Größen 16/20/24.
- **Gym-Theming:** nur `--accent-h`/`--accent-c` überschreiben (siehe
  drittes Mobile-Frame „Gym-Rot H 25" als Beleg, dass alles nachrechnet).
  Bei Override auf einem Unter-Element zusätzlich `data-theme` setzen.
- **Listen:** immer EINE Karte mit Haarlinien-Trennern (`--line`),
  nie Karten-Stapel. Status in Listen als Punkt + Versalien-Text,
  nicht als farbige Pill.
- **Ambient:** nie hinter Listen/Tabellen; `filter: blur()` nie animieren
  (nur transform/opacity); `prefers-reduced-motion` muss alles stoppen.
- **Verläufe:** `--grad-fight` ausschließlich DeepFight; `--grad-progress`
  für alle generischen Balken; nie als Flächen- oder Text-Füllung.
- **Barrierefreiheit:** Kontrastziele text-1 ≥ 12:1, text-2 ≥ 4.5:1,
  text-3 (nur Labels) ≥ 3:1; Touchziele min. 44 px; `tabular-nums` für
  Messwerte.

## Dateien in diesem Paket
- `tokens.md` — vollständige Token-Referenz (Dark + Light, Formeln)
- `trainer-dashboard.html` — Desktop-Mockup, standalone (Dark + Light)
- `dashboard-mobile.html` — Mobile-Mockup, standalone (Dark, Light, Gym-Rot)
- `source/` — Original-Arbeitsdateien aus dem Designprojekt (inkl.
  `tokens/*.css` zum direkten Übernehmen)
