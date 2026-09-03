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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading } = useAuth();
  const staffShell = useHasStaffShell();

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
