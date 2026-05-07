"use client";

import PageHeader from "@/components/PageHeader";
import { useState } from "react";
import { SPORT_QUIZZES } from "@/lib/quiz-data";
import { Quiz } from "@/components/Quiz";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface RulesSection {
  title: string;
  items: string[];
}

interface Sport {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  color: string;
  sections: RulesSection[];
}

// ─── Inhalte ──────────────────────────────────────────────────────────────────

const SPORTS: Sport[] = [
  {
    id: "mma",
    name: "MMA",
    icon: "🥊",
    tagline: "Mixed Martial Arts",
    color: "text-blood border-blood/60 bg-blood/10",
    sections: [
      {
        title: "Grundregeln",
        items: [
          "Kämpfe finden in einem Oktagon oder Käfig statt.",
          "Reguläre Kämpfe: 3 Runden à 5 Minuten (Profi) oder 3 × 3 Minuten (Amateur).",
          "Titelkämpfe gehen über 5 Runden à 5 Minuten.",
          "Zwischen jeder Runde gibt es 1 Minute Pause.",
          "Ein Schiedsrichter im Käfig überwacht den Kampf und kann ihn jederzeit stoppen.",
          "Drei Ringrichter am Rand bewerten den Kampf nach Punkten.",
        ],
      },
      {
        title: "Erlaubte Techniken",
        items: [
          "Schläge mit der Faust auf Kopf und Körper.",
          "Tritte auf Kopf, Körper und Beine.",
          "Kniestöße auf Kopf und Körper (je nach Regelwerk).",
          "Ellbogenschläge auf Kopf und Körper.",
          "Würgetechniken (Chokes): z. B. Rear Naked Choke, Triangle Choke.",
          "Gelenkhebelungen: z. B. Armbar, Kimura, Shoulder Lock.",
          "Takedowns und Würfe.",
          "Bodenkampf (Ground & Pound) — Schläge auf den am Boden liegenden Gegner.",
        ],
      },
      {
        title: "Verbotene Aktionen",
        items: [
          "Kopfstöße.",
          "Schläge auf den Hinterkopf oder die Wirbelsäule.",
          "Augenstiche oder Druck auf die Augen.",
          "Beißen oder Kratzen.",
          "Tritte oder Kniestöße auf den Kopf eines am Boden liegenden Gegners (je nach Regelwerk).",
          "Griff an Shorts, Handschuhe oder Käfig.",
          "Leistentritte (Tiefschläge).",
          "Kleine Gelenke greifen (Finger, Zehen).",
          "Schläge in den Nacken.",
        ],
      },
      {
        title: "Siegbedingungen",
        items: [
          "KO (Knockout): Gegner wird bewusstlos.",
          "TKO (Technischer Knockout): Schiedsrichter stoppt den Kampf, weil ein Kämpfer sich nicht mehr verteidigen kann.",
          "Submission: Gegner gibt auf (Tap-out) oder verliert das Bewusstsein durch einen Würger/Hebel.",
          "Punktentscheidung: Nach allen Runden gewinnt der Kämpfer mit mehr Punkten.",
          "Disqualifikation: Ein Kämpfer verletzt wiederholt die Regeln.",
          "Technische Entscheidung: Nach einem unbeabsichtigten Foul, wenn der Kampf nicht weitergeführt werden kann.",
        ],
      },
      {
        title: "Punktewertung",
        items: [
          "10-Punkt-Must-System: Der Rundensieger erhält 10 Punkte, der Verlierer 9 oder weniger.",
          "Bewertet werden: effektives Schlagen/Treten, Takedowns, Bodenkontrolle und Aggressivität.",
          "Ein Knockdown kann zu einer 10-8-Runde führen.",
          "Drei Ringrichter bewerten unabhängig voneinander.",
          "Majority Decision: Zwei Richter sehen denselben Sieger, einer wertet unentschieden.",
          "Split Decision: Zwei Richter für einen Kämpfer, einer für den anderen.",
        ],
      },
    ],
  },
  {
    id: "bjj",
    name: "BJJ",
    icon: "🥋",
    tagline: "Brazilian Jiu-Jitsu",
    color: "text-blue-400 border-blue-400/60 bg-blue-400/10",
    sections: [
      {
        title: "Grundregeln",
        items: [
          "Wettkämpfe finden auf einer Matte statt, im Gi (Kimono) oder No-Gi (Rashguard/Shorts).",
          "Kämpfe dauern je nach Gürtelgrad und Turnier 5–10 Minuten.",
          "Ziel ist es, eine Submission (Aufgabe) zu erzwingen oder mehr Punkte zu sammeln.",
          "Ein Schiedsrichter überwacht das Geschehen und gibt Punkte und Advantages.",
          "Wenn beide Kämpfer die gleiche Punktzahl haben, entscheiden Advantages.",
        ],
      },
      {
        title: "Punktewertung",
        items: [
          "Takedown: 2 Punkte — Den Gegner kontrolliert zu Boden bringen.",
          "Sweep: 2 Punkte — Den Gegner aus der Guard heraus umwerfen.",
          "Guard Pass: 3 Punkte — Die Beine des Gegners umgehen und Seitkontrolle erlangen.",
          "Knee on Belly: 2 Punkte — Knie auf dem Bauch des Gegners mit stabilem Halt.",
          "Mount: 4 Punkte — Auf dem Gegner sitzen, Hüfte über Hüfte.",
          "Back Control (Rear Mount): 4 Punkte — Hinter dem Gegner mit Hooks (Beinen) kontrolle.",
          "Advantage: Nahezu abgeschlossene Aktionen, z. B. near-Submission, near-Sweep.",
        ],
      },
      {
        title: "Erlaubte Submissions",
        items: [
          "Würgetechniken (Chokes): Rear Naked Choke, Triangle, Guillotine, Bow & Arrow.",
          "Arm-Hebelungen: Armbar, Kimura, Americana.",
          "Beinhebelungen (je nach Gürtelgrad): Straight Footlock, Kneebar (ab Braun), Heel Hook (No-Gi, je nach Regelwerk).",
          "Shoulder Locks: Omoplata, Wristlock.",
        ],
      },
      {
        title: "Verbotene Aktionen",
        items: [
          "Schläge, Tritte oder Ellbogen jeglicher Art.",
          "Slamming (Hochheben und auf die Matte werfen).",
          "Kleine Gelenke manipulieren (Finger, Zehen).",
          "Verbotene Hebelungen je nach Gürtelgrad (z. B. Heel Hooks für Weißgürtel).",
          "Stalling (absichtliches Hinauszögern ohne Aktionen).",
          "Greifverbote an Kragen und Ärmeln je nach Regelwerk.",
        ],
      },
      {
        title: "Siegbedingungen",
        items: [
          "Submission: Der Gegner gibt auf (Tap) oder der Schiedsrichter stoppt den Kampf.",
          "Punktentscheidung: Nach der Zeit gewinnt der Kämpfer mit mehr Punkten.",
          "Advantage-Entscheidung: Bei gleicher Punktzahl entscheiden Advantages.",
          "Referee Decision: Bei Gleichstand ohne Advantages entscheidet der Schiedsrichter.",
          "Disqualifikation: Regelverstoß oder wiederholtes Stalling.",
        ],
      },
    ],
  },
  {
    id: "boxing",
    name: "Boxen",
    icon: "🥊",
    tagline: "Das klassische Faustkampf-Regelwerk",
    color: "text-yellow-400 border-yellow-400/60 bg-yellow-400/10",
    sections: [
      {
        title: "Grundregeln",
        items: [
          "Nur Faustschläge sind erlaubt — keine Tritte, Knie oder Würger.",
          "Treffer zählen auf Kopf und Oberkörper (oberhalb der Gürtellinie).",
          "Kämpfe bestehen aus 1 bis 12 Runden à 3 Minuten.",
          "Zwischen jeder Runde gibt es 1 Minute Pause.",
          "Drei Ringrichter bewerten den Kampf, ein Schiedsrichter leitet ihn.",
          "Kämpfer müssen Handschuhe (8–12 oz) und Mundschutz tragen.",
          "Eine neutrale Ecke ist nach einem Knockdown Pflicht.",
        ],
      },
      {
        title: "Erlaubte Schläge",
        items: [
          "Jab: Führhandgerade.",
          "Cross: Schlaggerade von hinten.",
          "Hook: Seitlicher Schwunghaken.",
          "Uppercut: Aufwärtshaken.",
          "Alle Schläge müssen mit den Knöcheln (Frontteil des Handschuhs) landen.",
          "Nur Treffer auf Kopf oder Oberkörper (vorne und seitlich) sind gültig.",
        ],
      },
      {
        title: "Verbotene Aktionen",
        items: [
          "Schläge unter die Gürtellinie.",
          "Schläge auf den Hinterkopf oder Nacken (Rabbit Punch).",
          "Kopfstöße.",
          "Beißen oder Kratzen.",
          "Ellbogen einsetzen.",
          "Halten oder Clinchen ohne Schlagen.",
          "Boxen mit dem Handschuhrücken (Backhander).",
          "Kämpfen während der Pause (nach dem Stopp-Ruf des Schiedsrichters).",
          "Treten oder Knien.",
        ],
      },
      {
        title: "Punktewertung",
        items: [
          "10-Punkt-Must-System: Der Rundensieger erhält 10 Punkte, der Verlierer in der Regel 9.",
          "Bei einem Knockdown: 10-8-Runde möglich.",
          "Bei zwei Knockdowns: 10-7-Runde.",
          "Fouls können Punktabzüge (Warnings) nach sich ziehen.",
          "Bewertet werden: effektive Treffer, Aggressivität, Verteidigung und Ring-Control.",
          "Drei unabhängige Ringrichter geben ihre Scorecards ab.",
        ],
      },
      {
        title: "Siegbedingungen",
        items: [
          "KO (Knockout): Der Gegner geht zu Boden und kann nicht bis 10 aufstehen.",
          "TKO (Technischer Knockout): Schiedsrichter stoppt den Kampf.",
          "Punktentscheidung (Decision): Nach allen Runden gewinnt der Kämpfer mit mehr Punkten.",
          "Unanimous Decision: Alle drei Richter sehen denselben Sieger.",
          "Split Decision: Zwei Richter für einen Kämpfer, einer für den anderen.",
          "Majority Decision: Zwei Richter für einen Sieger, einer für Unentschieden.",
          "Draw (Unentschieden): Gleiche Punktzahl bei allen oder zwei Richtern.",
          "Disqualifikation: Wiederholte oder schwere Regelverstöße.",
          "Technical Decision: Nach einem unbeabsichtigten Foul nach Runde 4.",
          "No Contest: Nach einem unbeabsichtigten Foul vor Runde 4.",
        ],
      },
    ],
  },
];

// ─── Haupt-Seite ──────────────────────────────────────────────────────────────

export default function RegelnPage() {
  const [activeTab, setActiveTab] = useState("mma");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);

  const sport = SPORTS.find((s) => s.id === activeTab)!;

  function toggleSection(title: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  // Beim Tab-Wechsel: Sections und Quiz zurücksetzen
  function switchTab(id: string) {
    setActiveTab(id);
    setExpandedSections(new Set());
    setShowQuiz(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Regelwerk"
        title="Regeln"
        description="Die Regeln für MMA, Brazilian Jiu-Jitsu und Boxen — verständlich erklärt. Teste dein Wissen mit dem Quiz."
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6">

        {/* ── Tab-Auswahl ── */}
        <div className="mb-8 flex gap-2 flex-wrap">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => switchTab(s.id)}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
                activeTab === s.id
                  ? s.color
                  : "border-carbon-400 bg-carbon-700/40 text-foreground/70 hover:border-blood/60 hover:text-foreground"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        {/* ── Disziplin-Header ── */}
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-foreground/50">
            {sport.tagline}
          </div>
          <h2 className="heading-display mt-1 text-4xl font-black">{sport.name} Regeln</h2>
        </div>

        {/* ── Regelwerk-Accordion ── */}
        <div className="space-y-3">
          {sport.sections.map((section) => {
            const open = expandedSections.has(section.title);
            return (
              <div
                key={section.title}
                className="overflow-hidden rounded-xl border border-carbon-500 bg-carbon-700/60"
              >
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-carbon-600/40"
                >
                  <h3 className="font-bold uppercase tracking-wider">{section.title}</h3>
                  <span
                    className={`text-foreground/60 transition-transform duration-200 ${
                      open ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>
                {open && (
                  <div className="border-t border-carbon-500/60 px-6 py-4">
                    <ul className="space-y-2">
                      {section.items.map((item, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-foreground/85">
                          <span className="mt-0.5 text-blood">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Alle aufklappen ── */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() =>
              setExpandedSections(new Set(sport.sections.map((s) => s.title)))
            }
            className="text-xs font-bold uppercase tracking-widest text-foreground/50 hover:text-foreground"
          >
            Alle aufklappen
          </button>
          <span className="text-foreground/20">|</span>
          <button
            onClick={() => setExpandedSections(new Set())}
            className="text-xs font-bold uppercase tracking-widest text-foreground/50 hover:text-foreground"
          >
            Alle einklappen
          </button>
        </div>

        {/* ── Quiz ── */}
        <div className="mt-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="heading-display text-2xl font-black">Quiz</h2>
              <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">
                {SPORT_QUIZZES.find((sq) => sq.id === activeTab)?.quiz.length ?? 0} Fragen · Teste dein Regelwerk-Wissen
              </p>
            </div>
            <button
              onClick={() => setShowQuiz((v) => !v)}
              className={`btn-secondary px-5 py-2 text-sm ${showQuiz ? "border-blood text-blood" : ""}`}
            >
              {showQuiz ? "Quiz ausblenden" : "Quiz starten"}
            </button>
          </div>

          {showQuiz && (
            <div className="mt-6">
              <Quiz questions={SPORT_QUIZZES.find((sq) => sq.id === activeTab)?.quiz ?? []} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
