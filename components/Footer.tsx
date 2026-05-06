import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-carbon-500/60 bg-carbon-900/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-blood text-xs font-black text-white">
              MMA
            </span>
            Iron<span className="text-blood">Fight</span>
          </div>
          <p className="mt-3 text-sm text-foreground/60">
            Train hard. Fight smart. Become unbreakable.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
            Disziplinen
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>Boxing</li>
            <li>Wrestling</li>
            <li>Brazilian Jiu-Jitsu</li>
            <li>Muay Thai</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
            Navigation
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/training" className="hover:text-blood">
                Trainingspläne
              </Link>
            </li>
            <li>
              <Link href="/timer" className="hover:text-blood">
                Workout Timer
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-blood">
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/workout" className="hover:text-blood">
                Workout Generator
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
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
        © {new Date().getFullYear()} IronFight MMA. All rights reserved.
      </div>
    </footer>
  );
}
