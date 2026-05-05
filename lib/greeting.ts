/**
 * Tageszeit-abhängige Begrüßung.
 *
 * Die spezielle Nacht-Variante "Ready for ur Night Workout?" ist gewollt
 * englisch + verkürzt. Sie wird zwischen 22:00 und 04:59 angezeigt.
 *
 * Zeitraster:
 *   05:00 – 11:59 → Guten Morgen
 *   12:00 – 17:59 → Guten Tag
 *   18:00 – 21:59 → Guten Abend
 *   22:00 – 04:59 → Ready for ur Night Workout?
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
 * Komplette Begrüßung inklusive Anzeigename.
 * @param name vom Nutzer gewählter Anzeigename ODER null/undefined für "Fighter"
 */
export function greetingFor(
  name: string | null | undefined,
  date: Date = new Date(),
): string {
  const fighter = (name && name.trim()) || "Fighter";
  switch (greetingKind(date)) {
    case "morning":
      return `Guten Morgen, ${fighter}`;
    case "day":
      return `Guten Tag, ${fighter}`;
    case "evening":
      return `Guten Abend, ${fighter}`;
    case "night":
      return `Ready for ur Night Workout, ${fighter}?`;
  }
}
