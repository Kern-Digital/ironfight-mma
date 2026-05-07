import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-carbon-500/60 bg-carbon-900/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blood text-[10px] font-black text-white">
              TA
            </span>
            Tidal<span className="text-blood">Athletics</span>
          </div>
          <p className="mt-3 text-sm text-foreground/60">
            Train hard. Fight smart. Become unbreakable.
          </p>
        </div>

        {/* Training */}
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
            Training
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/workout/generator" className="hover:text-blood">
                Workouts
              </Link>
            </li>
            <li>
              <Link href="/schedule" className="hover:text-blood">
                Kursplan
              </Link>
            </li>
            <li>
              <Link href="/workout/plans/boxing" className="hover:text-blood">
                Boxing Plan
              </Link>
            </li>
            <li>
              <Link href="/workout/plans/wrestling" className="hover:text-blood">
                Wrestling Plan
              </Link>
            </li>
            <li>
              <Link href="/workout/plans/bjj" className="hover:text-blood">
                BJJ Plan
              </Link>
            </li>
            <li>
              <Link href="/workout/plans/muay-thai" className="hover:text-blood">
                Muay Thai Plan
              </Link>
            </li>
          </ul>
        </div>

        {/* Lernen */}
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
            Lernen
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/techniques" className="hover:text-blood">
                Techniken
              </Link>
            </li>
            <li>
              <Link href="/regeln" className="hover:text-blood">
                Regeln
              </Link>
            </li>
            <li>
              <Link href="/quiz" className="hover:text-blood">
                Quiz
              </Link>
            </li>
          </ul>
          <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest text-foreground/40">
            Timer
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/timer" className="hover:text-blood">
                Workout-Timer
              </Link>
            </li>
          </ul>
        </div>

        {/* Profil */}
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
            Profil
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/library" className="hover:text-blood">
                Sammlung
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-blood">
                Verlauf
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-blood">
                Account
              </Link>
            </li>
          </ul>
          <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest text-foreground/40">
            Account
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/login" className="hover:text-blood">
                Login
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-blood">
                Registrieren
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-carbon-500/60 px-4 py-4 text-center text-xs text-foreground/50 sm:px-6">
        © {new Date().getFullYear()} Tidal Athletics. All rights reserved.
      </div>
    </footer>
  );
}
