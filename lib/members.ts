/**
 * Mitglieder & Rechtevergabe (Multi-Gym Phase 2, Checkpoint 2;
 * docs/MULTI-GYM-KONZEPT.md §4).
 *
 * DAS ROLLENMODELL IN EINEM SATZ: Athlet ist kein Recht, sondern der
 * Grundzustand jedes Mitglieds — „Trainer sind auch Athleten" (CLAUDE.md).
 * Obendrauf gibt es genau zwei Häkchen, `trainer` und `verwaltung`, und die
 * sind unabhängig voneinander: der Cheftrainer hat beide, eine Bürokraft nur
 * das zweite, ein Kursleiter nur das erste, alle anderen keins.
 *
 * WARUM `verwaltung` NICHT ÜBER `role` LÄUFT: `role` kennt heute
 * `user | trainer | admin`, und `admin` ist der PLATTFORM-Admin — in
 * firestore.rules überspringt er jeden Gym-Vergleich (`isAdmin()` ohne
 * sameGym). Würde das Verwaltungs-Häkchen `role="admin"` setzen, gäbe ein
 * Klick in der Mitgliederliste Zugriff auf FREMDE Gyms. Deshalb ist
 * `verwaltung` ein eigener, additiver Custom Claim. Checkpoint 3 löst `role`
 * ohnehin in ein Set auf; dieses Feld wandert dann unverändert mit.
 *
 * SICHERHEITSMODELL: Der Client zeigt Häkchen — entschieden wird
 * ausschließlich in `/api/members/role` (Admin-SDK): gültiges Token,
 * Aufrufer ist Verwaltung DESSELBEN Gyms, nie `admin`, nie ein gymId-Wechsel,
 * Aussperr-Schutz, Audit-Eintrag. Die Firestore-Regeln verbieten dem Client
 * `role` UND `verwaltung` am eigenen wie an fremden Dokumenten.
 */

import type { StudentEntry } from "./admin";
import type { UserRole } from "./types";

/** Die zwei Häkchen. Beide leer = Athlet (kein Recht, kein Häkchen). */
export interface MemberRights {
  trainer: boolean;
  verwaltung: boolean;
}

/** Rechte, wie sie heute an einem Mitglied stehen. */
export function rightsOf(entry: {
  role: UserRole | undefined;
  verwaltung: boolean;
}): MemberRights {
  return {
    // Der Plattform-Admin hat alle Werkzeuge — in der Anzeige zählt er
    // deshalb als Trainer UND Verwaltung, auch ohne gesetzte Häkchen.
    trainer: entry.role === "trainer" || entry.role === "admin",
    verwaltung: entry.verwaltung || entry.role === "admin",
  };
}

/** Plattform-Admin: seine Rechte werden hier nie verändert (Server: 403). */
export function isPlatformAdmin(entry: { role: UserRole | undefined }): boolean {
  return entry.role === "admin";
}

export function sameRights(a: MemberRights, b: MemberRights): boolean {
  return a.trainer === b.trainer && a.verwaltung === b.verwaltung;
}

/** Kurzform für Listenzeilen: „Athlet", „Trainer", „Trainer · Verwaltung". */
export function rightsLabel(rights: MemberRights): string {
  const parts: string[] = [];
  if (rights.trainer) parts.push("Trainer");
  if (rights.verwaltung) parts.push("Verwaltung");
  return parts.length ? parts.join(" · ") : "Athlet";
}

/**
 * Erklärung UNTER dem Häkchen — in ganzen Sätzen, und sie folgt dem Zustand
 * (Regel „Hilfstexte erklärend", Leon 31.08.): Steht das Häkchen auf aus,
 * darf darunter keine Beschreibung des eingeschalteten Zustands stehen.
 */
export const RIGHT_EXPLAIN: Record<
  keyof MemberRights,
  { on: string; off: string }
> = {
  trainer: {
    on: "Trainer sind dein Team — sie bekommen zusätzlich die Werkzeuge: DeepFight, Wettkämpfe und die Schülerliste.",
    off: "Ohne Häkchen trainiert diese Person einfach mit: Kurse, Workout-Pläne und das eigene Kampfprofil.",
  },
  verwaltung: {
    on: "Die Verwaltung führt dein Gym — sie lädt neue Leute ein, vergibt hier Rechte und sieht die Neuigkeiten.",
    off: "Ohne Häkchen bleibt alles Organisatorische bei dir: Einladungen, Rechte und die Mitgliederliste.",
  },
};

/** Anzeigename eines Mitglieds — FighterName vor Provider-Name vor E-Mail. */
export function memberName(entry: {
  displayName: string | null;
  authProviderName: string | null;
  email: string | null;
}): string {
  return (
    entry.displayName?.trim() ||
    entry.authProviderName?.trim() ||
    entry.email?.trim() ||
    "Mitglied"
  );
}

/**
 * Sortierung der Mitgliederliste: erst wer das Gym führt, dann das Team,
 * dann alle anderen — innerhalb jeder Gruppe alphabetisch. Wer sucht, sucht
 * nach Menschen, nicht nach Beitrittsdaten.
 */
export function memberGroupOf(entry: StudentEntry): "verwaltung" | "trainer" | "athlet" {
  const rights = rightsOf(entry);
  if (rights.verwaltung) return "verwaltung";
  if (rights.trainer) return "trainer";
  return "athlet";
}

export const MEMBER_GROUP_LABEL: Record<
  ReturnType<typeof memberGroupOf>,
  string
> = {
  verwaltung: "Verwaltung",
  trainer: "Trainer",
  athlet: "Athleten",
};

// ─── Wie lange ist jemand dabei? ──────────────────────────────────────────

/**
 * Beitrittsdatum eines Mitglieds.
 *
 * `gymJoinedAt` schreibt `/api/invites/redeem` beim Einlösen — das ist der
 * exakte Zeitpunkt, ab dem jemand zum Gym gehört. Für Bestandsmitglieder, die
 * es vor dem Einladungssystem schon gab, gibt es diesen Zeitpunkt nicht; dann
 * gilt das Registrierungsdatum. Das ist keine Schätzung, sondern die einzige
 * Wahrheit, die es über sie gibt — und bei einem Gym, das mit der App
 * gestartet ist, ohnehin derselbe Tag.
 */
export function memberSince(entry: {
  gymJoinedAt?: Date | null;
  createdAt: Date | undefined;
}): Date | null {
  return entry.gymJoinedAt ?? entry.createdAt ?? null;
}

/** Ganze Monate zwischen zwei Daten (Kalendermonate, nicht 30-Tage-Blöcke). */
function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * „Seit 3 Monaten" — die Kurzform für die Listenzeile.
 *
 * Bewusst grob und in Worten: In einer Mitgliederliste beantwortet die Zahl
 * die Frage „neu oder alteingesessen?", nicht „auf welchen Tag genau?". Das
 * genaue Datum steht im Sheet.
 */
export function membershipShort(
  since: Date | null,
  now: Date = new Date(),
): string {
  if (!since) return "Beitritt unbekannt";
  const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
  if (days <= 0) return "Heute dazugekommen";
  if (days === 1) return "Seit gestern";
  if (days < 7) return `Seit ${days} Tagen`;
  if (days < 31) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "Seit einer Woche" : `Seit ${weeks} Wochen`;
  }
  const months = monthsBetween(since, now);
  if (months < 12) {
    return months <= 1 ? "Seit einem Monat" : `Seit ${months} Monaten`;
  }
  const years = Math.floor(months / 12);
  return years === 1 ? "Seit einem Jahr" : `Seit ${years} Jahren`;
}

const JOIN_DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** „Dabei seit 14. August 2026 · seit 3 Monaten" — die Langform fürs Sheet. */
export function membershipLong(
  since: Date | null,
  now: Date = new Date(),
): string {
  if (!since) return "Beitrittsdatum unbekannt";
  // Nur den ERSTEN Buchstaben kleinschreiben: `toLowerCase()` auf den ganzen
  // Satz machte aus „Seit 3 Tagen" ein „seit 3 tagen" — im Deutschen falsch.
  const short = membershipShort(since, now);
  return `Dabei seit ${JOIN_DATE_FMT.format(since)} · ${short
    .charAt(0)
    .toLowerCase()}${short.slice(1)}`;
}

/**
 * Passt ein Mitglied zur Sucheingabe? Name und E-Mail, ohne Groß/Klein.
 *
 * DIE SUCHE KANN DAS GYM NICHT VERLASSEN — und zwar nicht, weil sie brav
 * filtert, sondern weil sie gar nichts nachlädt: Gesucht wird ausschließlich
 * in der Liste, die `listAllMembers(gymId)` schon geholt hat. Deren Abfrage
 * trägt `where("gymId","==",…)`, und die Firestore-Regeln lassen einen
 * Verwaltungs-Account ohnehin nur Dokumente des eigenen Gyms lesen
 * (`sameGym(resource.data)`). Eine Suche über fremde Gyms gäbe es also selbst
 * dann nicht, wenn hier ein Filter fehlte.
 */
export function memberMatches(entry: StudentEntry, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return (
    memberName(entry).toLowerCase().includes(q) ||
    (entry.email ?? "").toLowerCase().includes(q)
  );
}

// ─── Schreiben (ausschließlich über die Server-Route) ──────────────────────

export interface SetMemberRightsResult {
  ok: boolean;
  uid: string;
  role: UserRole;
  verwaltung: boolean;
}

/**
 * Setzt die Rechte eines Mitglieds. Der Body trägt NUR die zwei Häkchen und
 * die uid — `role: "admin"` ist damit gar nicht erst ausdrückbar, und ein
 * Gym steht nicht drin (der Server nimmt immer das des Aufrufers).
 *
 * Nach einer Änderung an sich SELBST muss der Aufrufer `refreshRole()` rufen:
 * der neue Claim steckt im ID-Token, und das holt der Client nicht von allein.
 */
export async function setMemberRightsRequest(
  idToken: string,
  uid: string,
  rights: MemberRights,
): Promise<SetMemberRightsResult> {
  const res = await fetch("/api/members/role", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      uid,
      trainer: rights.trainer,
      verwaltung: rights.verwaltung,
    }),
  });
  // Fehlerseiten (502/504) liefern kein JSON — dann bleibt die Standardmeldung
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<SetMemberRightsResult>;
  if (!res.ok) {
    throw new Error(data.error ?? "Die Rechte konnten nicht geändert werden.");
  }
  return data as SetMemberRightsResult;
}

// ─── Aus dem Gym entfernen ─────────────────────────────────────────────────

/**
 * Beendet die Mitgliedschaft — sie LÖSCHT KEIN KONTO.
 *
 * Das ist keine Bequemlichkeitsentscheidung, sondern die Grenze zwischen zwei
 * Verhältnissen: Das Konto gehört dem Menschen, nicht dem Gym. Ein Gym darf
 * sagen „du gehörst nicht mehr zu uns" — es darf niemandem seine Workouts,
 * sein Kampfprofil oder den Zugang zu einem künftigen Gym nehmen. Löschen
 * kann ein Konto nur, wem es gehört.
 *
 * Was das Entfernen bewirkt: Der Mensch behält alles, das GYM verliert den
 * Zugriff darauf — Kampfprofil, Video-Analysen und Wettkämpfe werden für die
 * Trainer unlesbar, freigegebene Gegnerprofile und Trainer-Pläne werden ihm
 * entzogen. Ein späterer Beitritt (auch ins selbe Gym) ist jederzeit möglich.
 */
export interface RemoveMemberResult {
  ok: boolean;
  uid: string;
  /** Wie viele Freigaben dabei zurückgenommen wurden (Anzeige/Protokoll). */
  revokedShares: number;
}

export async function removeMemberRequest(
  idToken: string,
  uid: string,
): Promise<RemoveMemberResult> {
  const res = await fetch("/api/members/remove", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ uid }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<RemoveMemberResult>;
  if (!res.ok) {
    throw new Error(data.error ?? "Das Mitglied konnte nicht entfernt werden.");
  }
  return data as RemoveMemberResult;
}
