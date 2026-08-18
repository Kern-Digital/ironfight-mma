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

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export interface VerifiedUser {
  uid: string;
  role: string | null;
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
    if (user.customAttributes) {
      try {
        const claims = JSON.parse(user.customAttributes) as { role?: string };
        role = claims.role ?? null;
      } catch {
        role = null;
      }
    }
    return { uid: user.localId, role };
  } catch {
    return null;
  }
}

/** True, wenn der User Trainer oder Admin ist. */
export function isTrainerOrAdmin(user: VerifiedUser | null): boolean {
  return !!user && (user.role === "trainer" || user.role === "admin");
}
