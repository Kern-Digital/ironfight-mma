# DESIGN-BRIEF — Redesign Tidal Athletics

> Verbindlicher Rahmen für das anstehende Redesign. Jede Design-Session liest
> diese Datei ZUERST und arbeitet strikt nach dem Arbeitsmodus in §4.
> Zeitpunkt laut Roadmap (`docs/MULTI-GYM-KONZEPT.md` §10): nach Phase 0+1,
> vor den neuen Verwaltungs-Oberflächen.

## 1. Harte Regeln (NICHT verhandelbar)

1. **Token-only-Branding.** Alles Markenspezifische — Akzentfarbe(n), Logo,
   Gym-Name — läuft AUSSCHLIESSLICH über CSS-Variablen/Tokens in
   `app/globals.css`. Es ist VERBOTEN, eine Markenfarbe oder ein Logo hart in
   eine Komponente zu schreiben. Abnahme-Test: EINE Variable ändern → die
   gesamte App folgt. Grund: Gyms bekommen später eigenes Branding
   (Branding-Kit, Konzept §8) — das muss ein Datenbankfeld werden können,
   kein zweites Redesign.
2. **Ableitbare Palette.** Das Token-System muss die KOMPLETTE Gym-Palette
   (alle Schattierungen, Dark + Light, Textfarben) per Formel aus 1–2
   Eingabefarben ableiten können. Mehr Freiheitsgrade braucht das
   Branding-Kit nicht — und mehr darf es nicht geben.
3. **Dark ist Default, Light ist gleichwertig.** Jede umgebaute Seite wird in
   BEIDEN Themes geprüft (`lib/theme-context.tsx` existiert).
4. **Keine Emojis.** Icons nur über die Icon-Registry.
5. **Versalien nur für Überschriften/Labels.**
6. **DeepFight-Wordmark ist untrennbar** (Funkeln-Symbol + Schriftzug,
   `components/DeepFightWordmark.tsx`) und wird ohne ausdrückliche
   Entscheidung von Leon nicht neu gestaltet.
7. **Tech-Grenzen:** Tailwind CSS 3.4, React 18 (KEIN Upgrade), R3F bleibt
   v8, Tokens leben in `app/globals.css`, Tailwind-Farbwelt in
   `tailwind.config`.
8. **Mobile-First / Native-Ready** (die App soll später via Capacitor o. ä.
   in die App-Stores): Touch-Ziele ≥ 44 px; KEINE Hover-only-Funktionen
   (Hover nur als Verstärkung); Safe-Area-Insets einplanen
   (`env(safe-area-inset-*)`, Notch/Home-Indicator); Schüler-Kernbereiche
   für Bottom-Navigation ausgelegt, Trainer-Werkzeuge zusätzlich in
   Desktop-Breite entworfen; Tokens als plattformneutrale WERTE (Farben,
   Typo-Skala, Radien) — keine CSS-Spezialeffekte als tragendes
   Gestaltungselement.

## 2. Verhandelbar (steht zur Disposition)

- Die bisherige Farbwelt (cyan/pink + violet/amber/mint) darf ersetzt werden.
- Layout, Navigation, Seitenstruktur, Typografie, Radien, Schatten,
  Kartenstil (`card-glass`) — alles offen für Neues.

## 3. Ausdrücklich erwünscht

- Ein frischer, eigenständiger Look für die gesamte App.
- Die Gym-Akzentfarbe als EIN austauschbarer Token von Anfang an
  (Secure-by-Design-Denkweise für die Optik: Variabilität in die Struktur
  legen, nicht nachrüsten).

## 4. Arbeitsmodus (Reihenfolge ist Pflicht)

1. **Schritt 1 — nur das Token-System entwerfen:** Farbwelt, Typo, Radien,
   Schatten, Ebenen (`--ink-*`-Nachfolger). NOCH KEINE Seite anfassen.
   Vorschlag Leon zeigen.
2. **Schritt 2 — EINE Referenzseite** (Dashboard) im neuen Look umsetzen,
   dann STOPPEN und Leon zeigen. Keine weitere Seite ohne Freigabe.
3. **Schritt 3 — Rollout auf alle Seiten:** als Token-Änderung, nicht als
   Seite-für-Seite-Neustyling. Keine inline erfundenen Farben.

## 5. Abnahme-Checkliste (vor „fertig" selbst ausführen)

- [ ] Akzentfarben-Variable ändern → gesamte App folgt, keine Ausreißer
- [ ] Dark UND Light auf jeder umgebauten Seite geprüft
- [ ] Kein hartkodiertes Hex in Komponenten — per Suche verifiziert:
      `grep -riE '#[0-9a-f]{3,8}' components/ app/ --include='*.tsx'`
      (Treffer nur in Token-Definitionen/globals.css zulässig)
- [ ] Keine Emojis, Icons nur aus der Registry
- [ ] `npm run build` läuft durch

## 6. Start-Prompt für die Design-Session

> Lies `docs/DESIGN-BRIEF.md` und `docs/MULTI-GYM-KONZEPT.md` §8. Beginne mit
> Schritt 1 des Arbeitsmodus: Entwirf NUR das Token-System und zeig es mir —
> fass noch keine Seite an.
