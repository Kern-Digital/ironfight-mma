/**
 * Das Rollen-Set (Multi-Gym Phase 2, Checkpoint 3; Konzept §1 und §4).
 *
 * DAS MODELL IN EINEM SATZ: Athlet ist kein Recht, sondern der Grundzustand
 * jedes Mitglieds — obendrauf liegen drei unabhängige Häkchen.
 *
 *   trainer     Werkzeuge: DeepFight, Wettkämpfe, Schülerliste, Curriculum
 *   verwaltung  das Gym führen: einladen, Rechte vergeben, Protokoll lesen
 *   admin       Plattform-Rang: gym-übergreifend, NIE über eine Gym-Oberfläche
 *
 * WARUM DREI BOOLEANS UND KEIN `role`-WERT MEHR: `role` kannte
 * `user | trainer | admin` und konnte deshalb immer nur EINES davon
 * ausdrücken. `verwaltung` musste 2026-08-31 aus genau diesem Grund als
 * eigener Claim daneben entstehen (ein Häkchen, das `role="admin"` gesetzt
 * hätte, gäbe Zugriff auf FREMDE Gyms — `isAdmin()` überspringt in den Regeln
 * jeden Gym-Vergleich). Derselbe Einwand trifft `trainer` gegen `admin`: Ein
 * Plattform-Admin wäre im alten Modell zwangsläufig auch Trainer, und ein
 * Trainer könnte nie Admin sein. Als drei Häkchen sind alle Kombinationen
 * abbildbar, und `role` verliert seine letzte Aufgabe.
 *
 * WIRKSAM vs. GESPEICHERT: `admin` schließt die beiden anderen Rechte
 * praktisch ein — in den Regeln, in der Navigation, in jeder Anzeige. Am Konto
 * steht deshalb trotzdem nur `admin: true`; das Einrechnen passiert beim Lesen
 * (`effectiveRights`). Wer die tatsächlich gesetzten Häkchen braucht — die
 * Rollen-API, die entscheidet, was sie schreibt —, nimmt `readRoleSet` roh.
 *
 * KEINE React-/Node-Abhängigkeiten hier: middleware.ts läuft auf der Edge und
 * importiert diese Datei (gleiche Regel wie in lib/verwaltung-routes.ts).
 */

export interface RoleSet {
  /** Trainer-Werkzeuge (DeepFight, Wettkämpfe, Schüler, Curriculum). */
  trainer: boolean;
  /** Gym-Verwaltung (einladen, Rechte vergeben, Mitglieder, Protokoll). */
  verwaltung: boolean;
  /** Plattform-Rang — gym-übergreifend. Nie über eine Gym-Oberfläche. */
  admin: boolean;
}

/** Der Grundzustand: Athlet, kein Häkchen. */
export const NO_RIGHTS: RoleSet = {
  trainer: false,
  verwaltung: false,
  admin: false,
};

/**
 * Die Claims kommen an vier Stellen an und sehen überall etwas anders aus:
 * als `ParsedToken` im Client, als JWT-Payload in der Middleware, als
 * `customClaims` im Admin-SDK und als Feld-Sammlung am users-Dokument. Für
 * das bisschen Lesen hier ist die gemeinsame Form eine Map von Unbekanntem.
 */
export type ClaimLike = Record<string, unknown> | null | undefined;

function flag(claims: ClaimLike, key: string): boolean {
  return claims?.[key] === true;
}

/**
 * Liest die GESPEICHERTEN Häkchen — inklusive Rückfall auf das alte `role`.
 *
 * DER RÜCKFALL IST KEIN SCHÖNHEITSFEHLER, SONDERN DER MIGRATIONSPFAD:
 * Ausgestellte ID-Tokens leben bis zu einer Stunde. In dieser Stunde laufen
 * Tokens mit dem alten `role` und solche mit dem Set gleichzeitig durch
 * dieselben Prüfungen. Fiele der Rückfall weg, verlöre jeder Trainer mit
 * einem noch gültigen Token schlagartig seine Werkzeuge — ohne dass er etwas
 * falsch gemacht hätte, und ohne dass ein Neuladen hülfe.
 *
 * Er verschwindet zusammen mit `legacyRole()`, sobald die Produktion länger
 * als eine Stunde auf dem neuen Stand läuft (Backlog-Punkt in CLAUDE.md).
 */
export function readRoleSet(claims: ClaimLike): RoleSet {
  const legacy = typeof claims?.role === "string" ? claims.role : null;
  return {
    trainer: flag(claims, "trainer") || legacy === "trainer",
    verwaltung: flag(claims, "verwaltung"),
    admin: flag(claims, "admin") || legacy === "admin",
  };
}

/**
 * Rechnet den Plattform-Rang ein: Ein Admin hat die Trainer-Werkzeuge und
 * verwaltet jedes Gym, auch ohne gesetzte Häkchen. Das ist die Form, die
 * JEDER Leser will — Navigation, Guards, Anzeige.
 */
export function effectiveRights(stored: RoleSet): RoleSet {
  return {
    trainer: stored.trainer || stored.admin,
    verwaltung: stored.verwaltung || stored.admin,
    admin: stored.admin,
  };
}

/** Kurzform für die häufigste Frage: Set lesen und Admin einrechnen. */
export function rightsFromClaims(claims: ClaimLike): RoleSet {
  return effectiveRights(readRoleSet(claims));
}

// ─── Schreiben ──────────────────────────────────────────────────────────────

/**
 * Der Übergangs-Spiegel: `role`, abgeleitet aus dem Set.
 *
 * Er wird weiter mitgeschrieben, obwohl ihn niemand mehr als Quelle liest.
 * Grund ist die Rücknahme: Wer die Firestore-Regeln auf den Stand vor
 * Checkpoint 3 zurückrollt, findet dort `userRole()` vor — und ohne diesen
 * Spiegel wäre dann jeder Trainer plötzlich Athlet. Ein Spiegel, der 15 Bytes
 * kostet, ist der Preis dafür, dass ein Rollback keine Aussperrung ist.
 *
 * Die Ableitung ist zeichengleich zum alten Verhalten: `verwaltung` hatte nie
 * einen eigenen `role`-Wert, eine reine Verwaltung war immer `role="user"`.
 */
export function legacyRole(rights: RoleSet): "user" | "trainer" | "admin" {
  if (rights.admin) return "admin";
  if (rights.trainer) return "trainer";
  return "user";
}

/** Die vier Schlüssel, die diese Datei verwaltet — und nur diese. */
const MANAGED_CLAIMS = ["role", "trainer", "verwaltung", "admin"] as const;

/**
 * Baut die Custom Claims für ein Konto.
 *
 * `setCustomUserClaims` ERSETZT alles — bestehende Claims (insbesondere
 * `gymId`) müssen deshalb durchgereicht werden. Genau deshalb geht das hier
 * durch EINE Funktion: Ein `{ ...alt, trainer: true }` an fünf Stellen
 * verstreut hätte irgendwann eine Stelle, die ein entzogenes Recht nicht
 * löscht — und ein Recht, das sich nicht entziehen lässt, fällt erst auf,
 * wenn es zu spät ist.
 *
 * Geschrieben wird nur, was WAHR ist: „Schlüssel fehlt" heißt „kein Recht"
 * (so war es bei `verwaltung` von Anfang an). Das hält das Token klein — es
 * reist bei jeder Anfrage im `__session`-Cookie mit.
 */
export function claimsWithRights(
  existing: ClaimLike,
  rights: RoleSet,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  for (const key of MANAGED_CLAIMS) delete next[key];

  if (rights.trainer) next.trainer = true;
  if (rights.verwaltung) next.verwaltung = true;
  if (rights.admin) next.admin = true;
  next.role = legacyRole(rights); // Übergangs-Spiegel, siehe legacyRole()
  return next;
}

/**
 * Die Spiegel-Felder am `users`-Dokument.
 *
 * Der Spiegel existiert NUR, weil Custom Claims nicht abfragbar sind: Ohne
 * ihn ließe sich „hat dieses Gym noch eine Verwaltung?" nicht beantworten und
 * die Mitgliederliste könnte keine Rechte anzeigen. Autoritativ ist immer der
 * Claim; die Firestore-Regeln verbieten dem Client alle vier Felder.
 *
 * Anders als bei den Claims stehen hier alle Werte AUSDRÜCKLICH — auch die
 * falschen. Ein `set(..., { merge: true })` würde fehlende Schlüssel sonst
 * einfach stehen lassen, und ein entzogenes Häkchen bliebe in der Liste
 * sichtbar.
 */
export function rightsMirror(rights: RoleSet): {
  trainer: boolean;
  verwaltung: boolean;
  admin: boolean;
  role: "user" | "trainer" | "admin";
} {
  return {
    trainer: rights.trainer,
    verwaltung: rights.verwaltung,
    admin: rights.admin,
    role: legacyRole(rights),
  };
}

// ─── Anzeige ────────────────────────────────────────────────────────────────

/**
 * Kurzform für Listenzeilen: „Athlet", „Trainer", „Trainer · Verwaltung".
 * Der Plattform-Rang taucht bewusst NICHT auf — er ist kein Gym-Recht und hat
 * in der Mitgliederliste eines Gyms nichts verloren. Ein Admin erscheint dort
 * als „Trainer · Verwaltung", weil `effectiveRights` beide einrechnet.
 */
export function rightsLabel(rights: Pick<RoleSet, "trainer" | "verwaltung">): string {
  const parts: string[] = [];
  if (rights.trainer) parts.push("Trainer");
  if (rights.verwaltung) parts.push("Verwaltung");
  return parts.length ? parts.join(" · ") : "Athlet";
}

/** Hat dieses Konto überhaupt ein Recht über den Grundzustand hinaus? */
export function hasAnyRight(rights: RoleSet): boolean {
  return rights.trainer || rights.verwaltung || rights.admin;
}
