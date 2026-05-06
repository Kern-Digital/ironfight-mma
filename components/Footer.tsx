import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-carbon-500/60 bg-carbon-900/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blood text-xs font-black text-white">
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
            <li>
              <Link href="/training/boxing" className="hover:text-blood">
                Boxing
              </Link>
            </li>
            <li>
              <Link href="/training/wrestling" className="hover:text-blood">
                Wrestling
              </Link>
            </li>
            <li>
              <Link href="/training/bjj" className="hover:text-blood">
                Brazilian Jiu-Jitsu
              </Link>
            </li>
            <li>
              <Link href="/training/muay-thai" className="hover:text-blood">
                Muay Thai
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
            Navigation
          </h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li>
              <Link href="/workout/generator" className="hover:text-blood">
                Workout
              </Link>
            </li>
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
              <Link href="/timer" className="hover:text-blood">
                Workout Timer
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-blood">
                Mein Training
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
