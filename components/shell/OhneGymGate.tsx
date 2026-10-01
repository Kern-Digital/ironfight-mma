"use client";

/**
 * DIE SPERRE FÜR KONTEN OHNE GYM (Leon 30.09.2026: „konten ohne gym [sehen]
 * nur ihr profil + ihr bis dato gemachtes kampfprofil. kursplan etc. sehen
 * sie nicht stattdessen soll ihnen hier stehen: Du gehörst grade keinem Gym
 * an, finde jetzt das passende Gym für dich").
 *
 * Wer zu keinem Gym gehört (`useOhneGym`), bekommt auf JEDER Seite außer
 * den drei erlaubten diesen Hinweis statt des Inhalts. Die Sperre sitzt in
 * der Athleten-Hülle (`AppShell`), nicht in den Seiten: Dann kann keine
 * Seite sie vergessen — auch keine, die es heute noch nicht gibt.
 *
 * Die Daten sind dabei längst zu: Seit demselben Tag fällt ein Konto ohne
 * gymId-Claim in den Regeln auf KEIN Gym mehr zurück (userGymId in
 * firestore.rules). Diese Hülle ist nur die Oberfläche dazu — sie ersetzt
 * keine Regel, und Kursplan-Abfragen liefen ohnehin ins Leere.
 *
 * Erlaubt bleiben: /profile (Name, Bild, Einstellungen), /kampfprofil (das
 * bis dahin gemachte Kampfprofil, liest nur der Inhaber) und /gym-finden
 * (der Weg in ein Gym). /beitreten und /gym-anmelden tragen gar keine Hülle
 * (OHNE_HUELLE in AppShell) und laufen hier nie durch.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import { useOhneGym } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ERLAUBT = ["/profile", "/kampfprofil", "/gym-finden"];

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Der Hinweis selbst — eine Karte, zwei Wege hinein, die Leiste darunter. */
export function OhneGymHinweis() {
  return (
    <div
      className="min-h-screen pb-32"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-10 lg:px-6 lg:pt-16">
        <div className="t-card flex flex-col gap-5 p-6">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}
          >
            <Icon name="users" size={22} strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 style={{ font: "var(--type-h2)", color: "var(--text-1)" }}>
              Du gehörst gerade keinem Gym an.
            </h1>
            <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
              Finde jetzt das passende Gym für dich. Dein Profil und dein
              Kampfprofil bleiben dir, Kursplan und Training kommen mit dem Gym.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              data-press
              href="/gym-finden"
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
                textDecoration: "none",
              }}
            >
              <Icon name="search" size={16} strokeWidth={2.2} />
              Gym finden
            </Link>
            <Link
              data-press
              href="/beitreten"
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
                textDecoration: "none",
              }}
            >
              Einladungscode eingeben
            </Link>
          </div>
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Du führst selbst ein Gym?{" "}
            <Link href="/gym-anmelden" style={{ color: "var(--accent-text)" }}>
              Gym anmelden
            </Link>
          </p>
        </div>
      </div>
      <AthleteTabBar />
    </div>
  );
}

export default function OhneGymGate({ children }: { children: React.ReactNode }) {
  const ohneGym = useOhneGym();
  const pathname = usePathname();
  if (!ohneGym) return <>{children}</>;
  const erlaubt = ERLAUBT.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (erlaubt) return <>{children}</>;
  return <OhneGymHinweis />;
}
