/**
 * Bremse gegen das Durchprobieren von Einladungscodes
 * (Multi-Gym Phase 2, Checkpoint 1C).
 *
 * WOGEGEN SIE SCHÜTZT — und wogegen NICHT:
 * Zutritt zu erraten ist praktisch ausgeschlossen: 31 Zeichen ^ 8 Stellen
 * ≈ 853 Milliarden Möglichkeiten, und sowohl /api/invites/preview als auch
 * /redeem verlangen ein gültiges ID-Token — Raten setzt also ein Konto voraus
 * und ist protokollierbar. Was bleibt, sind KOSTEN: jeder Versuch ist eine
 * collectionGroup-Abfrage über alle Gyms. Genau die deckelt diese Bremse,
 * und deshalb steht sie VOR der Abfrage, nicht danach.
 *
 * Gezählt wird ausschließlich „diesen Code gibt es nicht". Abgelaufen,
 * zurückgezogen oder aufgebraucht heißt: der Code war echt — das ist kein
 * Raten, sondern ein Mensch mit einem alten Link. Ein Treffer löscht den
 * Zähler wieder.
 *
 * Der Zähler liegt in `inviteAttempts/{uid}` und wird NUR vom Admin-SDK
 * angefasst; in den Firestore-Regeln steht die Collection auf
 * `read, write: if false`. Läge er am users-Dokument, könnte der Betroffene
 * ihn selbst zurücksetzen.
 *
 * FÄLLT DIE BREMSE AUS, LÄSST SIE DURCH. Sie ist eine Kostenbremse, kein
 * Sicherheitstor — ein Firestore-Fehler im Zähler darf keinen Beitritt
 * verhindern.
 */

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";

/** Fehlversuche, bis gesperrt wird. */
export const INVITE_ATTEMPT_LIMIT = 10;
/** Zeitfenster, in dem Fehlversuche zusammenzählen. */
export const INVITE_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
/** Sperrdauer nach Erreichen des Limits. */
export const INVITE_BLOCK_MS = 60 * 60 * 1000;

const COLLECTION = "inviteAttempts";

export interface InviteGate {
  blocked: boolean;
  /** Sekunden bis zum nächsten erlaubten Versuch (für Retry-After). */
  retryAfterSeconds: number;
}

const OPEN: InviteGate = { blocked: false, retryAfterSeconds: 0 };

/**
 * Darf dieser Nutzer noch einen Code prüfen lassen? Ein Lesevorgang —
 * bewusst weniger als die Abfrage, die er verhindert.
 */
export async function inviteAttemptGate(
  db: Firestore,
  uid: string,
): Promise<InviteGate> {
  try {
    const snap = await db.collection(COLLECTION).doc(uid).get();
    if (!snap.exists) return OPEN;
    const until = (snap.get("blockedUntil") as Timestamp | undefined)?.toMillis();
    if (!until || until <= Date.now()) return OPEN;
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((until - Date.now()) / 1000),
    };
  } catch (err) {
    console.warn("[TidalAthletics] Einladungs-Bremse nicht lesbar:", err);
    return OPEN;
  }
}

/**
 * Zählt einen Fehlgriff. Liegt der erste Versuch länger als das Zeitfenster
 * zurück, beginnt die Zählung von vorn — sonst würde ein Tippfehler von
 * gestern zum Sperrgrund von heute beitragen.
 */
export async function recordInviteMiss(
  db: Firestore,
  uid: string,
): Promise<void> {
  const ref = db.collection(COLLECTION).doc(uid);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const firstAt = (snap.get("firstAt") as Timestamp | undefined)?.toMillis();
      const stale = !firstAt || now - firstAt > INVITE_ATTEMPT_WINDOW_MS;
      const count = stale ? 1 : ((snap.get("count") as number) ?? 0) + 1;
      tx.set(
        ref,
        {
          count,
          firstAt: stale ? Timestamp.fromMillis(now) : Timestamp.fromMillis(firstAt),
          blockedUntil:
            count >= INVITE_ATTEMPT_LIMIT
              ? Timestamp.fromMillis(now + INVITE_BLOCK_MS)
              : null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.warn("[TidalAthletics] Einladungs-Bremse nicht schreibbar:", err);
  }
}

/** Treffer — der Zähler war offenbar kein Raten. */
export async function clearInviteMisses(
  db: Firestore,
  uid: string,
): Promise<void> {
  try {
    await db.collection(COLLECTION).doc(uid).delete();
  } catch (err) {
    console.warn("[TidalAthletics] Einladungs-Bremse nicht löschbar:", err);
  }
}

/** Einheitliche Meldung, wenn die Bremse greift. */
export function inviteBlockedMessage(): string {
  return "Zu viele Versuche mit ungültigen Codes. Bitte probier es in einer Stunde noch einmal.";
}
