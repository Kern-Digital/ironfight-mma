# Multi-Gym-Konzept — Zielbild & Roadmap

> Beschlossenes Zielbild aus der Konzeptphase (2026-08-20). Quelle der Wahrheit
> für den Multi-Gym-Ausbau. Bei Umsetzung: CLAUDE.md aktualisieren, sobald
> Entscheidungen hier in Code gegossen sind.

## 1. Zielbild & Rollenmodell

Die App wird mandantenfähig (Multi-Tenant): mehrere Gyms, strikt voneinander
getrennt, keine gegenseitige Sichtbarkeit.

```
Plattform-Admin (admin) — wenige Personen, gym-übergreifend, verwaltet die App
   └── Gym-Verwaltung (verwaltung) — pro Gym, über Trainern & Schülern
          └── Trainer (trainer) — Werkzeuge: DeepFight, Wettkämpfe, Curriculum
                 └── Athlet — Grundzustand JEDES Mitglieds
```

**Kernentscheidungen:**
- „Schüler/Athlet" ist KEINE Rolle, sondern der Grundzustand jedes Mitglieds
  (konsistent mit „Trainer sind auch Athleten", CLAUDE.md). Rollen sind
  Zusatzrechte obendrauf: `trainer`, `verwaltung`. Der Cheftrainer ist einfach
  beides.
- Claims werden vom einzelnen Rollenwert auf ein Set umgestellt, z. B.
  `{ gymId, trainer: true, verwaltung: true }` — Kombinationen müssen sauber
  abbildbar sein.
- **Ein User gehört genau EINEM Gym** (bewusste Vereinfachung für den Start).
- `gymId` gehört in die **Custom Claims** (wie `role` heute), nicht nur ins
  Profil-Dokument — nur so ist die Trennung serverseitig hart.

## 2. Tenant-Modell & Datenstruktur

Flacher Ansatz (`gymId`-Feld auf Dokumenten) — bereits in `lib/gym.ts`
festgelegt; Gegner-DNA und Wettkämpfe schreiben `gymId` schon heute. Neu:

```
gyms/{gymId}                       — Stammdaten: Name, Logo, Branding-Tokens,
                                     Status (aktiv/gesperrt), Abo, activePlanId
gyms/{gymId}/invites               — Einladungscodes (Rolle vorbelegt, Ablauf)
gyms/{gymId}/schedulePlans/{id}    — Wochenpläne (Sessions darunter)
aiUsage/{gymId}                    — KI-Kontingent & Kosten PRO Gym
                                     (ersetzt das globale aiUsage/summary)
```

Umstellungen im Bestand:
- `resolveGymId` auf `profile.gymId` umstellen (Fallback Default bleibt).
- `listAllMembers()` / `listAllStudents()` (`lib/admin.ts`) nach `gymId`
  filtern (+ Firestore-Index auf `users.gymId`).
- `trainingSessions` bekommen `gymId` (kleine Migration nötig — einziger Ort).
- Firestore-Regeln: jede „Trainer/Admin darf alles"-Stelle bekommt
  `resource.data.gymId == request.auth.token.gymId`; `opponents` werden pro
  Gym; collectionGroup `fightCamps` zusätzlich gym-gescoped (Feld existiert).

## 3. Secure by Design — die vier Grundregeln

Gelten für JEDES neue Feature dieses Ausbaus:

1. **Der Client zeigt an, der Server entscheidet.** Checkboxen, Guthaben-Ring,
   Freigabe-Toggles sind nur Anzeige. Durchgesetzt wird in Firestore-Regeln
   und Server-APIs (Admin-SDK).
2. **Identität nur aus signierten Tokens** (Custom Claims mit gymId +
   Rollen-Set), nie aus client-schreibbaren Feldern.
3. **Deny by default:** verboten ist alles, was nicht ausdrücklich fürs eigene
   Gym und die eigene Rolle erlaubt ist.
4. **Rechte vergeben darf nur, wer sie selbst hat** — plus Audit-Log für
   Rollenänderungen und Aussperr-Schutz (letzte Verwaltung kann sich das Recht
   nicht selbst entziehen).

## 4. Rollenvergabe & Mitgliederbereich

- UI: Mitgliederliste (nur Verwaltung), pro Mitglied zwei Häkchen:
  `[ ] Trainer  [ ] Verwaltung`. Athlet ist implizit immer.
- Der Klick ruft eine Server-API (z. B. `POST /api/members/role`), die HART
  prüft: gültiges signaturgeprüftes Token; Aufrufer ist Verwaltung DESSELBEN
  Gyms (oder Plattform-Admin); Verwaltung vergibt nur trainer/verwaltung im
  eigenen Gym — niemals admin, niemals gymId-Wechsel; Aussperr-Schutz;
  Audit-Log-Eintrag. Claims-Änderung greift via Token-Refresh
  (`refreshRole()` existiert).
- Trainer-Dropdowns (z. B. Wochenplan) speisen sich automatisch aus
  Mitgliedern mit Trainer-Häkchen.
- Branchen-Standard (Spond, Glofox, Slack/Google-Workspace-Muster): Einladung
  mit vorbelegter Rolle + Mitgliederliste mit Umschalter + „Rechte vergeben
  darf nur, wer sie hat". Bei uns 1:1 anwendbar.

## 5. Onboarding & Einladungen

Kein freier Signup in ein Gym: Beitritt NUR über Einladungslink/-code des Gyms
(Rolle vorbelegt). Einlösen setzt serverseitig den `gymId`-Claim. Das ist der
Mechanismus, der die Trennung überhaupt herstellt.

## 6. Abrechnung & KI-Kontingent (DeepFight-Kosten)

Beschlossenes Modell: **Fixbetrag + Kontingent + Nachkauf.**
- Monatsbeitrag pro Gym enthält Kontingent von X Analysen. X aus echten
  `aiUsage`-Daten kalkulieren: (Beitrag − Marge) ÷ Ø-Kosten pro Analyse, mit
  Puffer für Ausreißer. Fixbetrag fließt VOR Verbrauch → nie Minus.
- Kontingent leer → Verwaltung kauft aktiv Nachkauf-Pakete (prepaid). Keine
  stille Verbrauchsrechnung am Monatsende (kein Rechnungsschock).
- **Abrechnungseinheit ist die ANALYSE, nicht Tokens** (verständlich für
  Kunden; intern weiter Token/Cent-Tracking).
- **Gemeinsamer Gym-Pool**, keine Pro-Kopf-Budgets zum Start (nur Trainer
  analysieren). Verwaltung bekommt Verbrauchs-Dashboard (Kontingent-Stand,
  Nutzung je Trainer). Pro-Kopf später nachrüstbar.
- Kontingent-Prüfung passiert SERVERSEITIG in der Analyse-API, bevor
  Gemini/Claude starten. Der Guthaben-Ring im Client ist nur Anzeige.
- Verworfen: unbegrenzte Nutzung mit reiner Verbrauchsabrechnung
  (Vorschussrisiko für Tidal, Rechnungsschock fürs Gym, Missbrauchsfläche).

## 7. Wochenplan (Mehrplan-Modell)

- Verwaltung kann MEHRERE benannte Wochenpläne halten („Normalbetrieb",
  „Sommerferien 2026", …) — **genau EINER ist aktiv**, serverseitig atomar
  erzwungen (Aktivieren von B deaktiviert A im selben Schreibvorgang; nie 0
  oder 2 aktive).
- **Duplizieren ist der Standardweg** (übernimmt Kurse samt
  Trainer-Zuweisungen), Neuanlage die Ausnahme. Umbenennen jederzeit.
- **Aktiver Plan ist nicht löschbar** (erst anderen aktivieren).
- Optional (Datenstruktur von Anfang an vorsehen): **„aktiv ab (Datum)"** für
  automatischen Wechsel; manuelles Umschalten bleibt immer möglich.
- **Tages-Ausnahmen bleiben eigene Ebene** über dem aktiven Plan. Faustregel:
  Wochen → eigener Plan; ein Tag → Ausnahme.
- Rechte: Lesen alle Gym-Mitglieder (nur aktiver Plan), Inhalte pflegen
  Verwaltung + Trainer, **Aktivieren nur Verwaltung**.

## 8. Branding (Stufenmodell + Branding-Kit)

| Stufe | Gym bekommt | Tidal behält |
|---|---|---|
| Basis | Gym-Name in der App | kompletter Tidal-Look |
| **Branding-Kit** (Aufpreis) | Logo + Akzentfarbe | Layout, Typo, Struktur, „powered by Tidal Athletics", DeepFight-Wordmark unangetastet |
| White-Label (nur falls je strategisch gewollt, deutlich teurer) | alles | — |

**Branding-Kit-Flow (KI-gestützt):**
1. Upload-Bereich (nur Verwaltung, nur mit gekauftem Kit): Logo (Pflicht),
   optional Website-Screenshots, Klamotten-Fotos. Logo ist Hauptquelle, Rest
   nur Bestätigung.
2. Vision-Analyse serverseitig (bestehender Gemini-Pfad, Key bleibt
   serverseitig) extrahiert 1–2 Kernmarkenfarben + Charakter.
3. **Palette baut deterministischer CODE, nicht die KI** (gleiche Lektion wie
   dnaSplit-Normierung: Modell-Output nie roh übernehmen): alle Abstufungen
   für Dark + Light per Formel, WCAG-Kontrastprüfung erzwungen — unlesbare
   Palette mathematisch unmöglich.
4. Live-Vorschau der echten App (Dark + Light nebeneinander), 2–3 Vorschläge,
   Feinjustierung nur innerhalb Leitplanken. Kontrastprüfung läuft beim
   Speichern SERVERSEITIG erneut.
5. Gespeichert werden nur die Token-Werte am `gyms/{gymId}`-Dokument;
   Quellbilder danach löschen (Muster Video-Pipeline).
- Kosten: Cent-Bereich, einmalig; Limit z. B. 10 Vorschlagsrunden pro Kit;
  läuft über `aiUsage`-Tracking.
- Marketing-Formulierung: „Vorschlag in deinen Farben, den du bestätigst" —
  nicht „KI trifft deine Marke perfekt".
- Verkaufsargument: Branding ist DER Upsell + Wow-Moment im
  Verkaufsgespräch; „powered by Tidal" + DeepFight-Wordmark sichern die
  eigene Markenpräsenz.

## 9. Phase 0 — Schulden tilgen (Pflicht VOR allem anderen)

1. **Analyse-Freigabe serverseitig erzwingen:** `videoAnalyses` aus dem
   users-Owner-Wildcard lösen — Owner-Read nur bei
   `sharedWithAthlete == true`, Owner-Write NIE, Trainer/Verwaltung voll.
   (Heute kann ein Schüler an der UI vorbei alle rohen Analysen über sich
   lesen UND schreiben.)
2. **Middleware-Signaturprüfung:** Token kryptografisch verifizieren
   (Admin-SDK) statt nur Cookie-Existenz — Voraussetzung für jede
   Verwaltungs-API.
3. **Rollen-API statt Hand-Script:** erledigt sich mit der Claims-API aus §4.

## 10. Roadmap (beschlossene Reihenfolge)

1. **Phase 0 — UMGESETZT 2026-08-20** (bis auf Rollen-API → Phase 2):
   videoAnalyses-Härtung + Middleware-Signaturprüfung sind im Code.
2. **Phase 1 — LIVE seit 2026-08-21**: `gyms/`-Collection, gymId in Claims,
   Regeln gym-gescoped, Queries gefiltert. Cutover (Migration → Indizes →
   Client → Rules) ist komplett durchgelaufen; künftige Gym-Backfills:
   `scripts/migrate-multi-gym.mjs`.
3. **REDESIGN** (siehe `docs/DESIGN-BRIEF.md`) — bewusst HIER: nach dem
   Unterbau, VOR den neuen Oberflächen, damit jeder neue Screen nur einmal
   gebaut wird. Architektur- und Optik-Umbau nie vermischen.
4. **Phase 2** — Verwaltungsebene: Rollen-Set-Claims + Rollen-API,
   Einladungssystem, Mitgliederbereich, Verwaltungs-Dashboard.
5. **Phase 3** — Betrieb: Wochenplan-Mehrplan-Modell, Pro-Gym-KI-Kontingent,
   Admin-Konsole (Gyms anlegen/sperren, gym-übergreifende Kennzahlen).
6. **Phase 4** — Monetarisierung: Stripe pro Gym (Fixbetrag + Nachkauf),
   Branding-Kit (§8).
