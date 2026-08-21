# Handoff: Tidal Athletics — Dashboards (Mobile + Trainer-Desktop)

MMA-Trainings- & Coaching-App („Riptide"-Richtung): athletisch, präzise,
Liquid-Glass auf dunklem Default, Gym-Akzent Teal (themebar), Brand-Violett
exklusiv für das KI-Feature **DeepFight**.

**Fidelity: High-Fidelity.** Die HTML-Dateien sind Design-Referenzen —
pixelgenau nachbauen, nicht direkt shippen.

## Lesereihenfolge
1. `tokens.md` — komplette Token-Referenz (Farben Dark/Light mit Formeln
   und aufgelösten Werten, Verläufe, Ambient-Schicht, Typo, Spacing).
2. `trainer-dashboard.html` — Desktop 1440×860, Dark + Light nebeneinander.
3. `dashboard-mobile.html` — Mobile 390×844, Dark + Light + Gym-Rot-Beleg.
4. `handoff-notes.md` — Offenes, Abweichungen, Umsetzungshinweise.

## Kernregeln (Kurzfassung)
- Alles leitet sich aus 2 Eingaben ab: `--accent-h/-c` (Gym) und
  `--accent2-h/-c` (Brand-Violett, fix).
- `--grad-fight` NUR DeepFight; `--grad-progress` für generische Balken;
  Verläufe nie als Flächen-/Text-Füllung.
- Ambient-Glows: separate Ebene hinter dem Inhalt, blur 72 px, Drift
  28–36 s nur transform/opacity, statisch bei reduced-motion.
- Archivo überall; Versalien nur Überschriften/Labels; Mono für Messwerte.
- Dark-Karten rahmenlos, Light 1 px; Listen als eine Karte mit Trennern;
  Touchziele ≥ 44 px.
