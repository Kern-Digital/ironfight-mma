/**
 * Serverseitige Verifikation des Firebase-ID-Tokens — ohne firebase-admin
 * im Request-Pfad.
 *
 * Token-Check über die Identity-Toolkit-API (accounts:lookup): bestätigt,
 * dass das Token gültig und nicht abgelaufen ist, und liefert uid + die
 * Custom Claims (customAttributes). Die Rolle kommt — wie in firestore.rules
 * und im Client — AUTORITATIV aus den Auth Custom Claims (`role`), die
 * ausschließlich per Admin-SDK gesetzt werden (scripts/set-role.mjs).
 *
 * Damit können nur eingeloggte Trainer/Admins die kostenpflichtigen
 * KI-Routen aufrufen.
 */

import { DEFAULT_GYM_ID } from "@/lib/gym";

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export interface VerifiedUser {
  uid: string;
  role: string | null;
  /**
   * Gym aus dem Claim. `null` = kein Claim gesetzt (Bestand vor der
   * Migration und Signups ohne Einladung). Fuer die Gym-Zuordnung gilt dann
   * das Default-Gym — genau wie in firestore.rules (userGymId()) und im
   * Client (resolveGymId).
   */
  gymId: string | null;
  /**
   * Gym-Verwaltungsrecht (Checkpoint 2) — additiver Claim NEBEN `role`.
   * Bewusst kein Wert von `role`: `admin` ist der PLATTFORM-Admin und
   * ueberspringt in den Regeln jeden Gym-Vergleich; ein Haekchen in der
   * Mitgliederliste darf niemals so weit reichen.
   */
  verwaltung: boolean;
}

/** Extrahiert das Bearer-Token aus dem Authorization-Header. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/** Prüft das ID-Token und liest die Rolle aus den Custom Claims. */
export async function verifyUser(idToken: string): Promise<VerifiedUser | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: { localId: string; customAttributes?: string }[];
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;

    let role: string | null = null;
    let gymId: string | null = null;
    let verwaltung = false;
    if (user.customAttributes) {
      try {
        const claims = JSON.parse(user.customAttributes) as {
          role?: string;
          gymId?: string;
          verwaltung?: boolean;
        };
        role = claims.role ?? null;
        gymId = claims.gymId ?? null;
        verwaltung = claims.verwaltung === true;
      } catch {
        role = null;
        gymId = null;
        verwaltung = false;
      }
    }
    return { uid: user.localId, role, gymId, verwaltung };
  } catch {
    return null;
  }
}

/** True, wenn der User Trainer oder Admin ist. */
export function isTrainerOrAdmin(user: VerifiedUser | null): boolean {
  return !!user && (user.role === "trainer" || user.role === "admin");
}

/** True, wenn der User Plattform-Admin ist (gym-uebergreifend). */
export function isAdmin(user: VerifiedUser | null): boolean {
  return user?.role === "admin";
}

/**
 * Gym des Aufrufers — fehlender Claim faellt aufs Default-Gym zurueck,
 * identisch zu userGymId() in firestore.rules und resolveGymId im Client.
 */
export function userGymId(user: VerifiedUser): string {
  return user.gymId?.trim() || DEFAULT_GYM_ID;
}

/**
 * Darf dieser Aufrufer das Gym verwalten — einladen, Einladungen stoppen,
 * Rechte vergeben, Mitglieder und Protokoll lesen?
 *
 * Das ist die EINE Stelle, an der die Frage beantwortet wird. Sie loest die
 * Platzhalter-Pruefung `isAdmin(user)` ab, die bis Checkpoint 2 in
 * /api/invites/create, /revoke und /note stand: Damals gab es die Rolle
 * `verwaltung` noch nicht, und `admin` war der einzige Rang ueber dem
 * Trainer. Seit dem Verwaltungs-Claim ist der Zielzustand echt.
 *
 * Zwei Wege hinein — und nur diese zwei:
 *   • Plattform-Admin (gym-uebergreifend, deshalb ohne Gym-Vergleich),
 *   • Verwaltungs-Claim IM EIGENEN Gym.
 * Ein Trainer ohne Verwaltungsrecht faellt durch; das ist Leons
 * Entscheidung vom 31.08.2026 („Einladen darf nur die Verwaltung").
 *
 * `gymId` weglassen heisst „irgendein Gym" — dann prueft nur, DASS ein
 * Verwaltungsrecht besteht; das betroffene Gym muss der Aufrufer danach
 * selbst vergleichen.
 */
export function canManageGym(
  user: VerifiedUser | null,
  gymId?: string,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!user.verwaltung) return false;
  return gymId === undefined || userGymId(user) === gymId;
}
