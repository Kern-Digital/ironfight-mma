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
- **DeepFight-Navigation & Rollen** (seit 2026-08-19): eigener Top-Level-
  Menüpunkt (nur Trainer/Admin) mit drei Richtungen — „Gegner-Scouting"
  (`/trainer/opponents`), „Schüler-Analysen" (`/trainer/deepfight/athletes`)
  und „Meine Analyse" (`/trainer/deepfight/me` → Redirect auf
  `/trainer/deepfight/athletes/{eigene uid}`; Trainer analysieren sich selbst
  exakt wie einen Schüler). Schüler haben KEINEN Zugriff auf das Werkzeug;
  sie sehen in ihrem **Kampfprofil** nur explizit Freigegebenes plus ihr
  gemergtes Profil (siehe nächster Punkt). Timer ist kein Top-Level-Punkt
  mehr: er hängt unter „Training" (alle) und „Trainer".
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
  `/trainer/deepfight/athletes`; **`listAllStudents()`** (= Members ohne
  Trainer/Admin, via `isStaffEntry`) bleibt für die reine Schülerverwaltung
  (`/trainer/students`, Admin-Seed, Freigabe-Panel im Gegnerprofil) und für die
  „Schüler"-Kachel auf dem Dashboard. UI-Gruppierung in beiden Kampfkontexten
  identisch: „Ich selbst"/„Meine Analyse" (cyan) · „Trainer & Coaches"
  (violet) · „Schüler" (neutral). Firestore brauchte dafür KEINE Änderung —
  `users/{uid}/fightCamps` erlaubt Trainer/Admin ohnehin jede uid.
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
  Gym-Trennung: `gymId` liegt als **Custom Claim** neben `role`
  (auth-context spiegelt ihn ins Profil); die Rules prüfen `data.gymId`
  **STRIKT** gegen den Token-Claim (fehlender CLAIM = Default-Gym, fehlendes
  DOKUMENT-Feld = Zugriff verweigert — deshalb Migration nötig,
  `scripts/migrate-multi-gym.mjs`, Cutover-Reihenfolge im Script-Kopf!).
  Trainer-Listen-Queries filtern deshalb zwingend nach gymId:
  `listAllMembers(gymId)`, `listAllStudents(gymId)`,
  `listAllFightCamps(gymId)`, `listOpponentsForGym(gymId)`;
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
- Rollen (`user` | `trainer` | `admin`) UND `gymId` liegen **autoritativ in
  Firebase Auth Custom Claims**, NICHT im Firestore-Dokument (dort nur
  Anzeige-/Query-Spiegel).
- Client liest beides via `getIdTokenResult()` (`claims.role`, `claims.gymId`)
  — siehe `auth-context.tsx` (`refreshRole()` erzwingt Token-Refresh nach
  Claim-Änderung).
- Claims werden **ausschließlich serverseitig** per Admin-SDK gesetzt:
  `node scripts/set-role.mjs <uid> <role>` (mergt, gymId bleibt erhalten)
  bzw. `node scripts/migrate-multi-gym.mjs` (gymId-Backfill; braucht
  `GOOGLE_APPLICATION_CREDENTIALS`). **Kein In-App-Pfad** schreibt `role`
  oder `gymId`.
- `firestore.rules` liest `request.auth.token.role`/`.gymId`; Clients dürfen
  `role`/`gymId` im users-Dokument nie schreiben (Privilege-Escalation und
  Gym-Wechsel geschlossen).

### Route-Schutz (zweischichtig)
- **Server:** `middleware.ts` (Edge) verifiziert das `__session`-Cookie
  **kryptografisch** (jose/RS256 gegen Googles Firebase-Zertifikate, Issuer +
  Audience = Projekt) und gated per Claim: `/admin/*` nur role=admin (sonst
  404, Existenz verbergen), `/trainer/*` nur trainer/admin (sonst Redirect
  `/dashboard`), übrige geschützte Bereiche → Redirect `/login`. Bewusster
  Fail-Open NUR wenn Googles Zertifikat-Endpoint nicht erreichbar ist
  (unverifizierter exp-Check statt Aussperrung — Datensicherheit liegt bei
  den Firestore-Regeln); ungültige Signaturen werden IMMER abgewiesen.
  Not-Aus via `MIDDLEWARE_AUTH=off`.
- **Client:** `<ProtectedRoute>` als zusätzlicher UI-Guard.

## Design-System
- Dark als Default, **zusätzlich Light-Theme** über `lib/theme-context.tsx`.
- Tokens als CSS-Variablen in `app/globals.css`:
  `--ink-0..6` (Hintergrund-Ebenen) · `--fg`, `--fg-2..4` (Text) · Pink-Akzent.
- Tailwind-Farben in `tailwind.config`: `pink` (Akzent), `ink`, `blood`, `carbon`.
- Utility-Klassen u.a.: `card-glass`, `font-mono-ta` (Mono via `var(--font-mono)`).

## Firestore (Collections — Top-Level)
```
gyms/{gymId}                      — Gym-Stammdaten (Multi-Gym; Mitglieder lesen ihr
                                    eigenes Gym, Schreiben nur Admin/serverseitig)
users/{uid}                       — Profil (role+gymId NUR via Custom Claims, nie
                                    Client-Write; fightProfile nur Trainer/Admin-Write)
users/{uid}/workouts              — geloggte Workouts
users/{uid}/fightCamps/{campId}   — Wettkampf + Gegner-Snapshot (Anzeige = Snapshot
                                    + Lücken aus opponents/{opponentId}, s.o.)
                                    (Trainer/Admin lesen+schreiben JEDE uid;
                                    zentrale Liste via collectionGroup)
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
(Gegner-Tab „Videos" + Schüler-Detailseite). DNA-Übernahme per Trainer-Review
(„Alle übernehmen" = konfliktfreie Befunde + Stats; Konflikte nur einzeln per
„Ersetzen", nie still überschreiben). Datenmodell: `lib/video-analysis.ts`.

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

### Gewichtung & Merge (seit 2026-08-20 — WICHTIG)
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
  einer Analyse reduziert bewusst nicht). Anzeige: orangener Guthaben-Ring
  (`AiBudgetGauge.tsx`, Budget per Klick änderbar, Start 5 €). Preise in
  `claude.ts → priceFor()` (EUR≈USD, Schätzung — Anthropic hat keine Saldo-API).

## Konventionen
- Deutsch in UI-Texten, Englisch im Code.
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

## Backlog (offen)
- [ ] **Multi-Gym-Cutover ausführen** (Code ist fertig, Deploy steht aus):
      1. `node scripts/migrate-multi-gym.mjs` · 2. `npx firebase-tools deploy
      --only firestore:indexes` · 3. Client deployen (git push → Vercel) ·
      4. `npx firebase-tools deploy --only firestore:rules`. Reihenfolge ist
      PFLICHT (Rules prüfen data.gymId strikt; Client braucht die Indizes).
- [ ] Multi-Gym Phase 2: Rollen-Set-Claims (verwaltung/trainer), Rollen-API,
      Einladungssystem, Mitgliederbereich (siehe docs/MULTI-GYM-KONZEPT.md)
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
- [ ] Video-Analyse: Herkunft der DNA-Antworten wird nicht gespeichert — die
      Konflikt-Anzeige kann daher nicht sagen, aus welchem (wie gewichteten)
      Video die bisherige Antwort stammt
- [ ] Optional: Google-Billing aktivieren → Detail-Analyse (Gemini Pro) nutzbar
