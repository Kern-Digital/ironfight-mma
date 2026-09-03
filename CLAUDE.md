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

## Firestore (Collections — Top-Level)
```
gyms/{gymId}                      — Gym-Stammdaten (Multi-Gym; Mitglieder lesen ihr
                                    eigenes Gym, Schreiben nur Admin/serverseitig)
gyms/{gymId}/invites/{code}       — Einladungen (Code = Dokument-ID; write:false,
                                    nur /api/invites; Lesen nur die Verwaltung)
gyms/{gymId}/auditLog/{id}        — Protokoll rechteverändernder Vorgänge UND Quelle
                                    des Neuigkeiten-Bereichs (write:false, nur
                                    lib/server/audit.ts; Lesen nur die Verwaltung)
users/{uid}                       — Profil (Rollen-Set trainer/verwaltung/admin
                                    + role-Spiegel + gymId NUR via Custom Claims,
                                    nie Client-Write; fightProfile nur
                                    Trainer/Admin-Write)
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
- **„Athlet(en)" ist das UI-Wort, `student` bleibt der Code-Name** (Leons
  Entscheidung 2026-09-02). In sichtbaren Texten heißt niemand mehr „Schüler":
  Sidebar, Überschriften, Hinweise, Fehlermeldungen sagen Athlet/Athleten
  (Singular „Athlet", Plural und Genitiv „Athleten"). Der Code behält
  `StudentEntry`, `listAllStudents()`, `/trainer/students` — dasselbe Muster
  wie bei DeepFight (UI-Name neu, Datenmodell unangetastet), und aus demselben
  Grund: eine Umbenennung von Route und Typen wäre eine Migration ohne
  Gegenwert. Wer neue Oberfläche baut, schreibt „Athlet"; wer Code liest,
  findet weiter „student".
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
