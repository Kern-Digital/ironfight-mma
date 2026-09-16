"use client";

/**
 * Die WEICHE zwischen den beiden Hüllen der App.
 *
 * Es gibt seit dem 01.09.2026 genau zwei:
 *   • STAB-HÜLLE (`StaffShell`) — wer eines der drei Häkchen trägt (trainer,
 *     verwaltung, admin), bekommt am Desktop die Sidebar links und auf dem
 *     Handy Schublade + Bottom-Bar. Navbar und Footer fallen für ihn
 *     ERSATZLOS weg (Leons Vorgabe).
 *   • ATHLETEN-HÜLLE — unverändert: `AthleteChromeGate` blendet Navbar und
 *     Footer auf den bereits umgestellten Seiten aus, die ihre Bottom-Bar
 *     selbst mitbringen; überall sonst steht die alte Top-Navigation.
 *
 * EINE HÜLLE PRO MENSCH, NICHT PRO BEREICH (Leons Entscheidung 01.09.): Ein
 * Trainer behält die Sidebar auch auf /dashboard, /timer und /techniques. Erst
 * dadurch ergeben die Sidebar-Gruppen „Mein Training" und „Lernen" Sinn — und
 * die Navigation wechselt nicht unter der Hand, wenn jemand vom Coaching in
 * sein eigenes Training geht.
 *
 * WARUM SOLANGE GAR KEINE HÜLLE, WIE DIE RECHTE UNBEKANNT SIND: Die Rechte
 * stehen erst fest, wenn das ID-Token gelesen ist (`profileLoading`). Wer
 * vorher schon etwas rendert, muss sich für eine Hülle entscheiden — und
 * entscheidet sich zwangsläufig für die falsche, weil ein noch leeres Profil
 * wie ein Athlet aussieht. Ein Trainer sähe dann für einen Sekundenbruchteil
 * die alte Navbar, die anschließend wegspringt. Der Inhalt selbst wird die
 * ganze Zeit gerendert; es fehlt nur die Umrandung.
 */

import AthleteChromeGate from "@/components/AthleteChromeGate";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import StaffShell from "@/components/shell/StaffShell";
import { useAuth, useHasStaffShell } from "@/lib/auth-context";
import { usePathname } from "next/navigation";

/**
 * DER ANMELDE-STAPEL TRÄGT GAR KEINE HÜLLE (Leons Entscheidung 14.09.2026).
 *
 * Diese vier Seiten bringen ihre Gestalt selbst mit: `JoinLayout` füllt den
 * Bildschirm, hinter der Karte laufen die Bildbänder. Eine Navigationsleiste
 * darüber ist dort nicht nur überflüssig, sie ist FALSCH — sie bot einem
 * Ausgeloggten die Rubriken „Training", „Lernen" und „Profil" an, deren
 * Ziele seit demselben Tag alle ein Konto verlangen. Man hätte sich durch
 * ein Menü geklickt, um bei der Anmeldung zu landen, von der man kam.
 *
 * Warum eine Liste und kein Ausschluss über „ist ausgeloggt": `/beitreten`
 * öffnet man oft, WÄHREND man angemeldet ist (zweites Gym, geteilter Link) —
 * und auch dann soll die Einladung für sich stehen.
 *
 * `/dev/*` steht bewusst NICHT hier: Die Prüfseiten bilden Bausteine in ihrer
 * normalen Umgebung nach, und dazu gehört die Hülle.
 */
const OHNE_HUELLE = ["/login", "/register", "/beitreten", "/forgot-password"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading } = useAuth();
  const staffShell = useHasStaffShell();
  const pathname = usePathname();

  const nackt = OHNE_HUELLE.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  if (nackt) return <main className="flex-1">{children}</main>;

  const undecided = loading || (!!user && profileLoading);
  if (undecided) return <main className="flex-1">{children}</main>;

  if (staffShell) return <StaffShell>{children}</StaffShell>;

  return (
    <>
      <AthleteChromeGate>
        <Navbar />
      </AthleteChromeGate>
      <main className="flex-1">{children}</main>
      <AthleteChromeGate>
        <Footer />
      </AthleteChromeGate>
    </>
  );
}
