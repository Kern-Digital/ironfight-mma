"use client";

import { usePathname } from "next/navigation";
import { useRights } from "@/lib/auth-context";

/**
 * Blendet die alte Top-Navigation und den Footer auf Seiten aus, die bereits
 * im neuen Athleten-Layout mit Bottom-Tab-Bar laufen (Redesign-Rollout).
 * Die Routen-Liste wächst mit dem Rollout.
 *
 * ER IST NICHT MEHR DIE APP-SHELL-WEICHE — das ist seit dem 01.09.2026
 * `components/shell/AppShell.tsx`. Wer eines der drei Häkchen trägt, kommt
 * hier gar nicht mehr an: Für ihn gibt es keine Navbar und keinen Footer
 * mehr, sondern die Sidebar. Diese Datei entscheidet nur noch innerhalb der
 * ATHLETEN-Hülle. Die `isTrainer`-Prüfung unten ist damit historisch — sie
 * kann nicht mehr wahr werden und fällt weg, sobald der Rollout jede Seite
 * der Liste erfasst hat und der Gate ganz verschwindet.
 */
const ATHLETE_SHELL_ROUTES = [
  "/dashboard",
  "/schedule",
  "/kampfprofil",
  "/profile",
  "/workout",
  "/timer",
  "/techniques",
  "/library",
];

export default function AthleteChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTrainer = useRights().trainer;
  const athleteShell = ATHLETE_SHELL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  if (athleteShell && !isTrainer) return null;
  return <>{children}</>;
}
