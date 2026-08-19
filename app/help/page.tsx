"use client";

import Link from "next/link";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth-context";

// ─── Inhalts-Definitionen ──────────────────────────────────────────────────

type HelpItem = {
  id: string;
  title: string;
  body: React.ReactNode;
  href?: string;
};

const TRAINER_HELP: HelpItem[] = [
  {
    id: "schedule",
    title: "Stundenplan",
    href: "/schedule",
    body: (
      <>
        Der Stundenplan zeigt alle Trainings der Woche. Klicke auf einen Kurs,
        um Details zu öffnen — dort weist du Techniken für diese Woche zu.
      </>
    ),
  },
  {
    id: "courses",
    title: "Kurse öffnen",
    body: (
      <>
        Beim Öffnen eines Kurses siehst du Uhrzeit, Level und welche Techniken
        bereits hinterlegt sind. Eine kurze Beschreibung erklärt, was du in
        diesem Kurs als Trainer tun kannst.
      </>
    ),
  },
  {
    id: "techniques",
    title: "Techniken zuweisen",
    body: (
      <>
        Im Kurs-Modal klickst du auf{" "}
        <strong>„Techniken bearbeiten“</strong>. Du kannst nach Disziplin
        filtern, suchen und mehrere Techniken auswählen. Speichern überträgt
        die Techniken in alle Bibliotheken der Schüler, die diesen Kurs
        abonniert haben.
      </>
    ),
  },
  {
    id: "students",
    title: "Schülerprofile",
    href: "/trainer/students",
    body: (
      <>
        Im Bereich <strong>Schüler</strong> findest du alle Mitglieder mit
        Profil-Basics, abonnierten Kursen und Trainings-Daten. Klick einen
        Eintrag an, um Fortschritt und Aktivität zu sehen.
      </>
    ),
  },
  {
    id: "progress",
    title: "Fortschritt ansehen",
    body: (
      <>
        Pro Schüler werden Workouts, Streak, Bibliotheks-Größe und letzte
        Aktivität angezeigt. Fehlt eine Information, wird ein Platzhalter
        angezeigt — kein Fehler.
      </>
    ),
  },
  {
    id: "library",
    title: "Bibliothek der Schüler",
    body: (
      <>
        Die Bibliothek ist die persönliche Sammlung jedes Schülers. Alles, was
        du als Trainer einem Kurs zuweist, landet automatisch dort — wenn der
        Schüler den Kurs abonniert hat oder bei „Ich nehme teil“ klickt.
      </>
    ),
  },
];

const STUDENT_HELP: HelpItem[] = [
  {
    id: "schedule",
    title: "Stundenplan",
    href: "/schedule",
    body: (
      <>
        Tippe auf einen Kurs, um Details zu sehen. Mit{" "}
        <strong>„Ich nehme teil“</strong> übernimmst du die Techniken der Woche
        in deine Bibliothek. Mit <strong>„Kurs abonnieren“</strong> passiert
        das automatisch jede Woche.
      </>
    ),
  },
  {
    id: "library",
    title: "Bibliothek",
    href: "/library",
    body: (
      <>
        Deine persönliche Sammlung aus allen Kursen, an denen du teilgenommen
        hast — plus Techniken, die du selbst gespeichert hast.
      </>
    ),
  },
  {
    id: "techniques",
    title: "Techniken-Datenbank",
    href: "/techniques",
    body: (
      <>
        Über 200 Techniken aus allen Disziplinen mit Anleitungen, häufigen
        Fehlern und Coaching-Cues.
      </>
    ),
  },
  {
    id: "workouts",
    title: "Workouts & Timer",
    href: "/workout/generator",
    body: (
      <>
        Erstelle individuelle Trainings oder nutze den Timer mit Runden,
        Pausen und Audio-Cues. Abgeschlossene Workouts erscheinen in deinem
        Dashboard.
      </>
    ),
  },
  {
    id: "profile",
    title: "Profil & Achievements",
    href: "/profile",
    body: (
      <>
        Halte dein Athleten-Profil aktuell — Disziplin, Level, Gewicht. Im
        Profil siehst du auch deine Achievements und Streak.
      </>
    ),
  },
];

// ─── Render ────────────────────────────────────────────────────────────────

function HelpItemCard({ item }: { item: HelpItem }) {
  const Inner = (
    <div
      className={item.href ? "card h-full" : "h-full"}
      style={{
        cursor: item.href ? "pointer" : "default",
      }}
    >
      <div
        className="font-mono-ta text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.18em", color: "var(--ta-cyan)" }}
      >
        {item.title}
      </div>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: "var(--fg-2)" }}
      >
        {item.body}
      </p>
      {item.href && (
        <div
          className="mt-3 text-xs uppercase tracking-widest"
          style={{ color: "var(--ta-cyan)" }}
        >
          Öffnen →
        </div>
      )}
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block" style={{ textDecoration: "none" }}>
        {Inner}
      </Link>
    );
  }
  return Inner;
}

export default function HelpPage() {
  const { profile, profileLoading } = useAuth();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  // Trainer sehen ihre Sektion zuerst, können aber auch die Schüler-Sicht ansehen.
  const [tab, setTab] = useState<"trainer" | "student">(
    isTrainer ? "trainer" : "student",
  );

  const items = tab === "trainer" ? TRAINER_HELP : STUDENT_HELP;

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Hilfe"
        description={
          isTrainer
            ? "Kurzanleitung für deine Trainer-Funktionen — und wie es für deine Schüler aussieht."
            : "Kurze Erklärungen zu allen Bereichen der App."
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Rollen-Tabs nur für Trainer */}
        {isTrainer && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setTab("trainer")}
              className="rounded-xl px-4 py-2 text-xs font-bold uppercase transition-colors"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                background:
                  tab === "trainer"
                    ? "rgba(35,196,206,0.12)"
                    : "var(--ink-3)",
                border: `1px solid ${
                  tab === "trainer" ? "rgba(35,196,206,0.4)" : "var(--ink-5)"
                }`,
                color: tab === "trainer" ? "var(--ta-cyan)" : "var(--fg-3)",
              }}
            >
              Für Trainer
            </button>
            <button
              onClick={() => setTab("student")}
              className="rounded-xl px-4 py-2 text-xs font-bold uppercase transition-colors"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                background:
                  tab === "student"
                    ? "rgba(35,196,206,0.12)"
                    : "var(--ink-3)",
                border: `1px solid ${
                  tab === "student" ? "rgba(35,196,206,0.4)" : "var(--ink-5)"
                }`,
                color: tab === "student" ? "var(--ta-cyan)" : "var(--fg-3)",
              }}
            >
              Für Schüler
            </button>
          </div>
        )}

        {profileLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-32 animate-pulse rounded-xl"
                style={{ background: "var(--ink-3)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <HelpItemCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Kontakt-Box */}
        <div className="mt-8">
          <div
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Du brauchst mehr?
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--fg-2)" }}>
            Frag deinen Coach im Gym oder schreib uns eine kurze Nachricht.
            Wir bauen die App weiter — Feedback ist immer willkommen.
          </p>
        </div>
      </div>
    </>
  );
}
