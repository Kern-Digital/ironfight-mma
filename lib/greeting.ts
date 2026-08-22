/**
 * Tageszeit-abhängige Begrüßungen — zwei Stimmen (Entscheidung 2026-08-22):
 *
 *   • `greetingFor` (Account-Seite /profile): schlichte Tageszeit-Begrüßung.
 *   • `dashboardGreetingFor` (Athleten-Dashboard): pro Tagesphase ein Pool
 *     aus 3 energischen Sprüchen, aus dem per Seed zufällig gezogen wird —
 *     der Seed kommt vom Aufrufer (einmal pro Seitenaufruf würfeln, z. B.
 *     useRef(Math.random())), damit die Zeile bei Re-Renders stabil bleibt.
 *   • `trainerGreetingFor` (Trainer-Dashboard): unverändert.
 *
 * Zeitraster (greetingKind):
 *   05:00 – 11:59 → morning
 *   12:00 – 17:59 → day
 *   18:00 – 21:59 → evening
 *   22:00 – 04:59 → night
 */

export type GreetingKind = "morning" | "day" | "evening" | "night";

export function greetingKind(date: Date = new Date()): GreetingKind {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "day";
  if (h >= 18 && h < 22) return "evening";
  return "night";
}

/**
 * Schlichte Begrüßung inklusive Anzeigename (Account-Seite).
 * Nachts bewusst „Guten Abend" — „Gute Nacht" wäre eine Verabschiedung;
 * die hippe Nacht-Zeile lebt jetzt im Dashboard-Pool.
 * @param name vom Nutzer gewählter Anzeigename ODER null/undefined für "Flex"
 */
export function greetingFor(
  name: string | null | undefined,
  date: Date = new Date(),
): string {
  const fighter = (name && name.trim()) || "Flex";
  switch (greetingKind(date)) {
    case "morning":
      return `Guten Morgen, ${fighter}`;
    case "day":
      return `Guten Tag, ${fighter}`;
    case "evening":
    case "night":
      return `Guten Abend, ${fighter}`;
  }
}

/**
 * Dashboard-Begrüßung: 3 Sprüche pro Tagesphase, per Seed zufällig gemischt.
 * Ton: kurz, energisch, leichter Denglish-Einschlag (wie die klassische
 * Night-Workout-Zeile) — hier ist Hype erwünscht, nicht Höflichkeit.
 */
const DASHBOARD_GREETINGS: Record<GreetingKind, ((f: string) => string)[]> = {
  morning: [
    (f) => `Erst aufwachen, dann aufwärmen, ${f}`,
    (f) => `Rise and grind, ${f}`,
    (f) => `Der Tag gehört dir, ${f}`,
  ],
  day: [
    (f) => `Zeit, was zu bewegen, ${f}`,
    (f) => `Ready when you are, ${f}`,
    (f) => `Dein Move, ${f}`,
  ],
  evening: [
    (f) => `Prime Time, ${f}`,
    (f) => `Abendschicht im Gym, ${f}`,
    (f) => `Beende den Tag stark, ${f}`,
  ],
  night: [
    (f) => `Ready for ur Night Workout, ${f}?`,
    (f) => `Die Nacht ist jung, ${f}`,
    (f) => `Nachtschicht, ${f}?`,
  ],
};

/**
 * @param seed Zufallswert 0..1 — vom Aufrufer EINMAL pro Seitenaufruf
 *             gewürfelt (z. B. useRef(Math.random())), damit die Zeile
 *             bei Re-Renders nicht springt.
 */
export function dashboardGreetingFor(
  name: string | null | undefined,
  seed: number,
  date: Date = new Date(),
): string {
  const fighter = (name && name.trim()) || "Flex";
  const pool = DASHBOARD_GREETINGS[greetingKind(date)];
  const clamped = Math.min(0.999, Math.max(0, seed));
  return pool[Math.floor(clamped * pool.length)](fighter);
}

/**
 * Trainer-spezifische Begrüßung — professioneller, leadership-orientiert.
 * @param name Trainername ODER null/undefined für "Coach"
 */
export function trainerGreetingFor(
  name: string | null | undefined,
  date: Date = new Date(),
): string {
  const coach = (name && name.trim()) || "Coach";
  switch (greetingKind(date)) {
    case "morning":
      return `Guten Morgen, ${coach} — der Tag gehört dir.`;
    case "day":
      return `${coach} — forme dein Team.`;
    case "evening":
      return `${coach} — was hast du heute bewegt?`;
    case "night":
      return `${coach} — auch die Besten schlafen.`;
  }
}
