"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Blendet die alte Top-Navigation und den Footer auf Seiten aus, die bereits
 * im neuen Athleten-Layout mit Bottom-Tab-Bar laufen (Redesign-Rollout).
 * Trainer/Admin behalten überall die Desktop-Navigation.
 * Die Routen-Liste wächst mit dem Rollout; am Ende wird daraus die
 * endgültige App-Shell-Weiche.
 */
const ATHLETE_SHELL_ROUTES = ["/dashboard"];

export default function AthleteChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";
  const athleteShell = ATHLETE_SHELL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  if (athleteShell && !isTrainer) return null;
  return <>{children}</>;
}
