/**
 * Serverseitige Verifikation des Firebase-ID-Tokens — ohne firebase-admin.
 *
 * Die App nutzt bewusst kein Admin-SDK (kein Service-Account). Stattdessen:
 *   1. Token-Check über die Identity-Toolkit-API (accounts:lookup) — bestätigt,
 *      dass das Token gültig und nicht abgelaufen ist, und liefert die uid.
 *   2. Rollen-Check über die Firestore-REST-API mit dem User-Token selbst —
 *      die Security-Rules erlauben dem User das Lesen des eigenen Profils,
 *      dort steht die Rolle (trainer/admin).
 *
 * Damit können nur eingeloggte Trainer/Admins die kostenpflichtigen
 * KI-Routen aufrufen.
 */

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

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

/** Prüft das ID-Token und liest die Rolle. Liefert null bei ungültigem Token. */
export async function verifyUser(idToken: string): Promise<VerifiedUser | null> {
  if (!API_KEY || !PROJECT_ID) return null;
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
    const data = (await res.json()) as { users?: { localId: string }[] };
    const uid = data.users?.[0]?.localId;
    if (!uid) return null;

    // Rolle aus dem eigenen User-Dokument (Firestore REST, User-Token).
    let role: string | null = null;
    try {
      const docRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
        { headers: { authorization: `Bearer ${idToken}` } },
      );
      if (docRes.ok) {
        const docData = (await docRes.json()) as {
          fields?: { role?: { stringValue?: string } };
        };
        role = docData.fields?.role?.stringValue ?? null;
      }
    } catch {
      role = null;
    }
    return { uid, role };
  } catch {
    return null;
  }
}

/** True, wenn der User Trainer oder Admin ist. */
export function isTrainerOrAdmin(user: VerifiedUser | null): boolean {
  return !!user && (user.role === "trainer" || user.role === "admin");
}
