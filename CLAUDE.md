# IronFight MMA — Projekt-Kontext

## Identität
- **App:** IronFight MMA Trainings-App
- **Pfad:** D:\Tidal-Athletics\App
- **Dev-Server:** http://localhost:3003 (Port kann variieren, immer +1 probieren)
- **Firebase-Projekt:** ironfight-mma (ironfight-mma.firebaseapp.com)

## Tech-Stack
| Layer | Technologie | Version |
|---|---|---|
| Framework | Next.js App Router | 14.2.35 |
| Sprache | TypeScript strict | 5.x |
| Styling | Tailwind CSS | 3.4 |
| Auth + DB | Firebase (Auth + Firestore) | 12.x |
| 3D | @react-three/fiber + drei | **v8 + v9** (React 18 — NICHT v9/v10 installieren!) |
| Payments | Stripe (installiert, noch nicht gebaut) | — |
| State | Zustand (installiert, noch nicht genutzt) | 5.x |
| Animation | Framer Motion (installiert) | 12.x |
| React | React | **18** (nicht 19!) |

## Design-System (Tailwind)
```
Farben:   blood (rot #dc2626) | carbon-900..400 (schwarz-grau)
Klassen:  btn-primary | btn-secondary | card | heading-display
Thema:    immer dark, background #050505, kein light mode
```
- `btn-primary`      → roter CTA-Button mit hover-glow
- `btn-secondary`    → transparenter Border-Button
- `card`             → `bg-carbon-700/60 border border-carbon-500 rounded-sm`
- `heading-display`  → `font-display uppercase tracking-tight`

## Datei-Map
```
app/
  layout.tsx               — Root: AuthProvider > Navbar > main > Footer
  page.tsx                 — Startseite: Hero3D + Disziplin-Cards + Features + CTA
  globals.css              — CSS-Variablen, @layer components (btn-*, card)
  training/page.tsx        — Disziplin-Liste (4 Cards → Slugs)
  training/[slug]/page.tsx — SSG-Detailseite + "Workout starten" → Timer mit Query-Params
  timer/page.tsx           — Workout-Timer (Client, Suspense für useSearchParams)
  login/page.tsx           — Firebase Email/Password Login
  register/page.tsx        — Firebase Register
  dashboard/page.tsx       — Protected: echte Firestore-Stats, Streak, Session-Liste

components/
  Navbar.tsx               — Sticky, auth-aware (Avatar/Logout wenn eingeloggt)
  Footer.tsx
  PageHeader.tsx           — eyebrow + title + description Pattern
  ProtectedRoute.tsx       — Client-Guard: redirect → /login wenn kein user
  HeroScene.tsx            — R3F Scene: Octagon-Cage + Glove + Sparkles
  Hero3D.tsx               — next/dynamic ssr:false Wrapper für HeroScene

lib/
  firebase.ts              — Lazy init: getFirebaseApp() | getFirebaseAuth() | getFirestoreDb()
  auth-context.tsx         — AuthProvider + useAuth() Hook
  use-workout-timer.ts     — Timer State-Machine: Phase idle→prep→work→rest→done
  beep.ts                  — Web Audio API Beeps (kein Audio-Asset nötig)
  workouts.ts              — Firestore CRUD: logWorkout | getRecentWorkouts | computeStats
  training-plans.ts        — Daten: 4 DisciplinePlan Objekte mit Exercises + Timer-Preset
```

## Firestore-Schema
```
users/{uid}/workouts/{auto-id}
  label: string | null       — z.B. "Boxing" oder null
  rounds: number
  workSeconds: number
  restSeconds: number
  completedAt: Timestamp
  totalWorkSeconds: number
```

## Wichtige Patterns
- Firebase IMMER lazy initialisieren (getFirebaseApp() etc.) — nie module-level initializeApp()
- "use client" auf alle Komponenten die useAuth/useState/useEffect nutzen
- Timer-URL: `/timer?rounds=5&work=300&rest=60&prep=10&label=MMA`
- Protected Route: `<ProtectedRoute>` wrappen, kein middleware
- R3F: NIEMALS @react-three/fiber v9+ ohne React 19 — bleibt auf v8!

## Was fertig ist
- [x] Layout, Navbar, Footer, Dark-Theme
- [x] Startseite mit 3D-Cage-Hero (Octagon + Boxhandschuh + Sparkles)
- [x] Training-Übersicht + 4 Disziplin-Detail-Seiten (SSG)
- [x] Workout-Timer: Runden/Pausen/Prep, Audio-Cues, Presets, Query-Params
- [x] Firebase Auth: Login, Register, Logout, useAuth-Hook
- [x] Dashboard: Protected, echte Firestore-Stats, Streak, Session-Liste

## Backlog (offen)
- [ ] Stripe Pro-Membership (Checkout, Webhook, Premium-Gate)
- [ ] Workout-History-Seite mit Filter + Kalender-Heatmap
- [ ] Live-Übungs-Tracker auf Trainingsplan-Seite
- [ ] User-Profil-Seite
- [ ] Toast-Notifications (Framer Motion)
- [ ] Zustand-Store für globalen App-State

## Konventionen
- Deutsch in UI-Texten, Englisch im Code
- Komponenten: Default-Export | Utilities: benannte Exports
- `@/` Alias für alle Imports
- Env-Vars: ohne Anführungszeichen in .env.local
