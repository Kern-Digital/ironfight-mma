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
- **⚠ Sicherheitsmodell der Analyse-Freigabe (bewusste Schuld, 2026-08-19):**
  Die Sichtbarkeit der eigenen Auswertungen (`sharedWithAthlete`) wird NUR
  clientseitig gefiltert — die generische users-Subcollection-Regel
  (`match /users/{uid}/{subcollection}/{document=**}`) erlaubt einem Nutzer
  ohnehin Owner-Read (und -Write!) auf ALLE eigenen Subcollections, also auch
  auf nicht freigegebene `videoAnalyses`. Für das aktuelle gym-interne
  Vertrauensniveau okay; eine harte serverseitige Trennung erfordert einen
  Umbau der generischen users-Regel (videoAnalyses aus dem Wildcard
  herauslösen: Owner-Read nur bei `resource.data.sharedWithAthlete == true`,
  Owner-Write entziehen, Trainer/Admin voll). **Spätestens beim Ausbau auf
  mehrere Gyms PFLICHT** — dann Trainer-Zugriff zusätzlich per gymId scopen
  (siehe `lib/gym.ts` / `belongsToGym`).

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
- Rollen (`user` | `trainer` | `admin`) liegen **autoritativ in Firebase Auth
  Custom Claims**, NICHT im Firestore-Dokument.
- Client liest die Rolle via `getIdTokenResult()` (`claims.role`) — siehe
  `auth-context.tsx` (`refreshRole()` erzwingt Token-Refresh nach Claim-Änderung).
- Rollen werden **ausschließlich serverseitig** per Admin-SDK gesetzt:
  `node scripts/set-role.mjs <uid> <role>` oder `--backfill`
  (braucht `GOOGLE_APPLICATION_CREDENTIALS`). **Kein In-App-Pfad** schreibt `role`.
- `firestore.rules` liest `request.auth.token.role`; Clients dürfen das `role`-Feld
  nie schreiben (Privilege-Escalation geschlossen).

### Route-Schutz (zweischichtig)
- **Server:** `middleware.ts` (Edge) gated über das `__session`-Cookie:
  `/admin/*` → 404 (Existenz verbergen), übrige geschützte Bereiche → Redirect
  `/login`. Not-Aus via `MIDDLEWARE_AUTH=off`. (Noch keine Signaturprüfung —
  echte Datensicherheit liegt bei den Firestore-Regeln.)
- **Client:** `<ProtectedRoute>` als zusätzlicher UI-Guard.

## Design-System
- Dark als Default, **zusätzlich Light-Theme** über `lib/theme-context.tsx`.
- Tokens als CSS-Variablen in `app/globals.css`:
  `--ink-0..6` (Hintergrund-Ebenen) · `--fg`, `--fg-2..4` (Text) · Pink-Akzent.
- Tailwind-Farben in `tailwind.config`: `pink` (Akzent), `ink`, `blood`, `carbon`.
- Utility-Klassen u.a.: `card-glass`, `font-mono-ta` (Mono via `var(--font-mono)`).

## Firestore (Collections — Top-Level)
```
users/{uid}                       — Profil (role NUR via Custom Claims, nie Client-Write;
                                    fightProfile = Kampfprofil, nur Trainer/Admin-Write)
users/{uid}/workouts              — geloggte Workouts
users/{uid}/videoAnalyses/{id}    — KI-Video-Analysen des eigenen Athleten
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
- **`actionStats` werden weiterhin nur summiert**, nie gewichtet — es sind
  Zählungen; „3,7 Versuche" wäre nicht interpretierbar.
- **DNA-Freitext bleibt manuell**: harter Ersatz pro Frage-ID, Konflikte nur
  per „Ersetzen". Das Gewicht erscheint dort nur als Anzeige (aufgeschlüsselt
  im Ergebniskopf).
- Das Feld `recency` wird auf der Analyse gespeichert und geht additiv in den
  Claude-Prompt: bei „unknown" ist der Prompt **zeichengleich** zu vor der
  Einführung (verifiziert) — Regression-Schutz beim Ändern von `userPrompt`.

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

## Backlog (offen)
- [ ] Analyse-Freigabe serverseitig erzwingen: users-Regel umbauen, sodass
      `videoAnalyses` nicht mehr unter das Owner-Wildcard fällt (Details siehe
      Sicherheits-Hinweis oben) — Pflicht vor Multi-Gym
- [ ] Stripe Pro-Membership (Checkout, Webhook, Premium-Gate)
- [ ] Middleware: serverseitige Token-Signaturprüfung (Service-Account)
- [ ] Video-Analyse: Web-Anreicherung (Fragenkatalog Abschnitt G, source=web)
- [ ] Video-Analyse: Trends über mehrere Videos (Fragenkatalog E4, ab ≥2 Videos)
- [ ] Video-Analyse: Gemini auf `:streamGenerateContent` umstellen — würde die
      heute rein zeitgeschätzte Gemini-Phase der Fortschrittsanzeige durch ein
      echtes Signal ersetzen. Modell-Output ändert sich dadurch NICHT, wohl aber
      die Fehlerfläche (Chunk-Zusammenbau + Retry-/Modellketten-Logik) →
      blockierenden Aufruf als Fallback behalten
- [ ] Video-Analyse: Löschen einer Analyse korrigiert `dnaSplitWeight` nicht
      (gelöschtes Video wirkt im Split weiter). Sauber nur per Neuberechnung
      aus allen Analysen mit `appliedStats`
- [ ] Video-Analyse: Herkunft der DNA-Antworten wird nicht gespeichert — die
      Konflikt-Anzeige kann daher nicht sagen, aus welchem (wie gewichteten)
      Video die bisherige Antwort stammt
- [ ] Optional: Google-Billing aktivieren → Detail-Analyse (Gemini Pro) nutzbar
