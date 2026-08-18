# IronFight MMA — Projekt-Kontext

> Quelle der Wahrheit ist der Code. Diese Datei hält nur **stabile** Konventionen
> und Architektur-Entscheidungen fest — KEINE vollständige Datei-Liste (driftet
> sonst sofort). Für die aktuelle Struktur: `app/`, `lib/`, `components/` ansehen.

## Identität
- **App:** IronFight MMA / Tidal Athletics — MMA-Trainings- & Coaching-App
- **Firebase-Projekt:** ironfight-mma (ironfight-mma.firebaseapp.com)
- **Repo:** github.com/Kern-Digital/ironfight-mma

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
users/{uid}                       — Profil (role NUR via Custom Claims, nie Client-Write)
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
  `main` (github.com/Kern-Digital/ironfight-mma). Verwaltet von Leon.
- **Umgebungsvariablen im Vercel-Dashboard** (Project → Settings →
  Environment Variables) — nach Änderungen Redeploy nötig:
  - `NEXT_PUBLIC_FIREBASE_*` (6 Stück, siehe `.env.local.example`)
  - `GEMINI_API_KEY` — Video-Beobachtung (Stufe 1), **nur serverseitig**
  - `ANTHROPIC_API_KEY` — Claude-Bewertung (Stufe 2), **nur serverseitig**;
    fehlt er, läuft automatisch der Gratis-Fallback über Gemini Flash
- Firestore-Rules werden NICHT von Vercel deployt:
  `npx firebase-tools deploy --only firestore:rules`.

## KI-Video-Analyse (Konzept §6)
- Spezifikation/Fragenkatalog: `docs/gegner-dna-video-analyse-fragenkatalog.md`.
- Zweistufig: **Gemini** (`lib/server/gemini.ts`, Video → Beobachtung A+B, Modelle
  `gemini-flash-latest`/`gemini-pro-latest`; Pro braucht Google-Bezahltarif) →
  **Claude** (`lib/server/claude.ts`, `claude-opus-5`, Structured Outputs → C+D+E).
- API-Routen `app/api/video-analysis/{upload,analyze}` — nur Trainer/Admin
  (Rolle aus Custom Claims via `lib/server/verify-user.ts`, kein Admin-SDK).
- UI: `components/trainer/VideoAnalysisSection.tsx` (Gegner-Tab „Videos" +
  Schüler-Detailseite). Übernahme in die DNA per Trainer-Review; Konflikte
  werden geflaggt, nie still überschrieben.
- Kosten-Tracking: Token je Analyse → `aiUsage/summary`; Anzeige als
  Guthaben-Ring (`AiBudgetGauge.tsx`), Budget dort per Klick anpassbar.

## Konventionen
- Deutsch in UI-Texten, Englisch im Code.
- Komponenten: Default-Export · Utilities: benannte Exports.
- Env-Vars: ohne Anführungszeichen in `.env.local` (Vorlage: `.env.local.example`).
- R3F: NIEMALS @react-three/fiber v9+ ohne React 19 — bleibt auf v8!

## Backlog (offen)
- [ ] Stripe Pro-Membership (Checkout, Webhook, Premium-Gate)
- [ ] Middleware: serverseitige Token-Signaturprüfung (Service-Account)
