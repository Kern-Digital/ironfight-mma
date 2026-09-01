/**
 * POST /api/members/remove — Mitgliedschaft beenden (Verwaltung).
 *
 * Body:    { uid }
 * Antwort: { ok: true, uid, revokedShares }
 *
 * DIESE ROUTE LÖSCHT KEIN KONTO — und das ist eine Entscheidung, keine
 * Auslassung. Das Konto gehört dem Menschen, nicht dem Gym: Darin liegen
 * seine Workouts, sein Kampfprofil und der Weg in ein künftiges Gym. Ein Gym
 * darf sagen „du gehörst nicht mehr zu uns"; es darf niemandem seine eigenen
 * Daten vernichten. Ein Konto löschen kann nur, wem es gehört (DSGVO Art. 17
 * ist ein Recht der betroffenen Person, keine Befugnis Dritter).
 *
 * WAS SIE STATTDESSEN TUT — sie dreht den Beitritt aus /redeem zurück:
 *   1. FREIGABEN ZURÜCKNEHMEN: uid aus `opponents.sharedWith` und aus
 *      `trainerPlans.audienceUids` entfernen. Diese beiden Regeln prüfen NUR
 *      die Liste, nicht das Gym — ohne diesen Schritt läse ein ehemaliges
 *      Mitglied die Gegnerprofile seines alten Gyms weiter.
 *   2. CLAIMS: `gymId: null` (bewusst null statt „Feld weg" — fehlt der
 *      Claim, fällt userGymId() in den Regeln aufs Default-Gym zurück, und
 *      der Ausgetretene wäre wieder Mitglied genau dort), `role: "user"`,
 *      `verwaltung: false`.
 *   3. SPIEGEL: `gymId` am users-Dokument LÖSCHEN. Damit greift die
 *      Dokument-Seite der Regeln, die bewusst strikt ist: fehlendes Feld =
 *      Zugriff verweigert. Ab hier sind Kampfprofil, Video-Analysen und
 *      Wettkämpfe dieser Person für das Gym unlesbar.
 *
 * Reihenfolge ist Absicht: Erst die Freigaben, dann die Zugehörigkeit.
 * Bricht Schritt 2 ab, hat jemand ein paar Freigaben verloren und ist noch
 * Mitglied — ärgerlich. Andersherum wäre er draußen und läse weiter mit.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminUnavailableError,
  adminAuth,
  adminDb,
} from "@/lib/server/firebase-admin";
import { displayNameFor, writeAudit } from "@/lib/server/audit";
import {
  bearerToken,
  canManageGym,
  isAdmin,
  userGymId,
  verifyUser,
} from "@/lib/server/verify-user";
import { DEFAULT_GYM_ID } from "@/lib/gym";
import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/** Siehe /api/members/role — identische Zählung, identische Begründung. */
async function countRemainingManagers(
  db: Firestore,
  gymId: string,
  excludeUid: string,
): Promise<number> {
  const snap = await db.collection("users").where("gymId", "==", gymId).get();
  let count = 0;
  for (const doc of snap.docs) {
    if (doc.id === excludeUid) continue;
    if (doc.get("verwaltung") === true || doc.get("role") === "admin") {
      count += 1;
    }
  }
  return count;
}

/**
 * Nimmt alle Einzelfreigaben zurück, die auf die uid lauten.
 *
 * Beide Abfragen laufen über `array-contains` auf EINEM Feld — dafür legt
 * Firestore den Index automatisch an. Das Gym muss nicht mitgefiltert werden:
 * Ein Mensch gehört genau einem Gym an, also können die Treffer aus keinem
 * anderen stammen; die zusätzliche Gleichheitsbedingung verlangte nur einen
 * zusammengesetzten Index.
 */
async function revokeShares(
  db: Firestore,
  gymId: string,
  uid: string,
): Promise<number> {
  let revoked = 0;

  const opponents = await db
    .collection("opponents")
    .where("sharedWith", "array-contains", uid)
    .get();
  for (const doc of opponents.docs) {
    await doc.ref.update({ sharedWith: FieldValue.arrayRemove(uid) });
    revoked += 1;
  }

  const plans = await db
    .collection("gyms")
    .doc(gymId)
    .collection("trainerPlans")
    .where("audienceUids", "array-contains", uid)
    .get();
  for (const doc of plans.docs) {
    await doc.ref.update({ audienceUids: FieldValue.arrayRemove(uid) });
    revoked += 1;
  }

  return revoked;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!canManageGym(user)) {
    return NextResponse.json(
      { error: "Nur die Gym-Verwaltung kann Mitglieder entfernen." },
      { status: 403 },
    );
  }

  let body: { uid?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const uid = (body.uid ?? "").toString().trim();
  if (!uid) {
    return NextResponse.json(
      { error: "Kein Mitglied angegeben." },
      { status: 400 },
    );
  }

  // Sich selbst hinauswerfen ist kein Verwaltungsvorgang, sondern ein
  // Versehen — und im schlimmsten Fall sperrt es das Gym aus. Wer wirklich
  // gehen will, gibt erst sein Verwaltungsrecht ab.
  if (uid === user.uid) {
    return NextResponse.json(
      {
        error:
          "Dich selbst kannst du hier nicht entfernen. Gib dein Verwaltungsrecht ab, wenn du gehen möchtest.",
      },
      { status: 403 },
    );
  }

  try {
    const db = adminDb();

    let targetClaims: Record<string, unknown>;
    try {
      const target = await adminAuth().getUser(uid);
      targetClaims = (target.customClaims ?? {}) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Dieses Mitglied gibt es nicht." },
        { status: 404 },
      );
    }

    const targetRole =
      typeof targetClaims.role === "string" ? targetClaims.role : "user";
    const targetGymId =
      (typeof targetClaims.gymId === "string" && targetClaims.gymId.trim()) ||
      DEFAULT_GYM_ID;
    const targetVerwaltung = targetClaims.verwaltung === true;

    if (!isAdmin(user) && targetGymId !== userGymId(user)) {
      return NextResponse.json(
        { error: "Dieses Mitglied gehört nicht zu deinem Gym." },
        { status: 403 },
      );
    }
    if (targetRole === "admin") {
      return NextResponse.json(
        { error: "Plattform-Konten werden hier nicht entfernt." },
        { status: 403 },
      );
    }

    // Aussperr-Schutz greift auch hier: Wer geht, nimmt sein
    // Verwaltungsrecht mit — das letzte darf nicht mitgehen.
    if (targetVerwaltung) {
      const remaining = await countRemainingManagers(db, targetGymId, uid);
      if (remaining < 1) {
        return NextResponse.json(
          {
            error:
              "Dein Gym braucht mindestens eine Verwaltung. Gib das Recht erst jemand anderem, dann kannst du dieses Mitglied entfernen.",
          },
          { status: 409 },
        );
      }
    }

    const targetName = await displayNameFor(db, uid, "Ein Mitglied");

    // ─── 1. Freigaben zurücknehmen ──────────────────────────────────────
    const revokedShares = await revokeShares(db, targetGymId, uid);

    // ─── 2. Claims: gehört zu keinem Gym mehr ───────────────────────────
    await adminAuth().setCustomUserClaims(uid, {
      ...targetClaims,
      gymId: null,
      role: "user",
      verwaltung: false,
    });

    // ─── 3. Spiegel: gymId LÖSCHEN (Dokument-Seite ist strikt) ──────────
    try {
      await db.collection("users").doc(uid).set(
        {
          gymId: FieldValue.delete(),
          gymJoinedAt: FieldValue.delete(),
          role: "user",
          verwaltung: false,
        },
        { merge: true },
      );
    } catch (mirrorErr) {
      await adminAuth()
        .setCustomUserClaims(uid, targetClaims)
        .catch(() => {});
      throw mirrorErr;
    }

    const actorName = await displayNameFor(db, user.uid);
    await writeAudit(db, targetGymId, {
      type: "member.remove",
      actorUid: user.uid,
      actorName,
      targetUid: uid,
      targetName,
      details: {
        trainerBefore: targetRole === "trainer",
        verwaltungBefore: targetVerwaltung,
        revokedShares,
      },
    });

    return NextResponse.json({ ok: true, uid, revokedShares });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        {
          error:
            "Die Mitgliederverwaltung ist serverseitig noch nicht eingerichtet.",
        },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] members/remove:", msg);
    return NextResponse.json(
      { error: "Das Mitglied konnte nicht entfernt werden." },
      { status: 500 },
    );
  }
}
