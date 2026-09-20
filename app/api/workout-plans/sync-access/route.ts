/**
 * POST /api/workout-plans/sync-access — die Kurs-Freigaben der Trainer-Pläne
 * für den AUFRUFER nachführen (Leon 19.09.: „immer der ganze Kurs").
 *
 * Body:    keiner — die Route arbeitet ausschließlich für den Aufrufer.
 * Antwort: { ok: true, added, removed }
 *
 * WARUM ES DIE ROUTE GIBT: Wer einen Trainer-Plan lesen darf, steht als
 * `audienceUids` am Plan — nur diese Form können die Firestore-Regeln prüfen
 * (array-contains, Muster opponents.sharedWith). Eine Freigabe an einen KURS
 * soll aber auch für Mitglieder gelten, die den Kurs erst später buchen. Das
 * Buchen schreibt nur `users/{uid}/subscriptions/{kursId}`; an den Plan kommt
 * der Athlet selbst nicht heran (trainerPlans: schreiben nur Trainer). Die
 * Route trägt ihn deshalb mit dem Admin-SDK nach — und nimmt ihn wieder
 * heraus, wenn er den Kurs abbestellt hat.
 *
 * WAS SIE DARF — und nur das:
 *   • nur die uid des Aufrufers (aus dem verifizierten ID-Token, nie aus dem
 *     Body) in `audienceUids` ergänzen oder entfernen;
 *   • nur im Gym des Aufrufers (Claim, Rückfall Default-Gym — identisch zu
 *     userGymId() in firestore.rules);
 *   • ergänzen nur, wo einer SEINER Kurse in `audienceCourseIds` steht;
 *   • entfernen nur, wo die Freigabe ausdrücklich getrennt gespeichert ist
 *     (`audienceIndividualUids` vorhanden), er dort NICHT einzeln steht und
 *     keiner seiner Kurse mehr passt. Altbestand ohne das Feld fasst sie beim
 *     Entfernen nie an — dort ist nicht zu unterscheiden, wer einzeln drin ist.
 * Kurs-Abos sind in dieser App Selbstbedienung (jedes Mitglied bucht selbst).
 * Die Route gibt damit nichts frei, was ein Kurs-Mitglied nicht ohnehin sehen
 * soll.
 *
 * Aufgerufen wird sie vom Client beim Öffnen des Workout-Bereichs (höchstens
 * alle fünf Minuten, lib/plan-access.ts) und direkt nach dem Buchen oder
 * Abbestellen eines Kurses. Kosten: ein Abo-Read und zwei Abfragen.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminUnavailableError,
  adminDb,
} from "@/lib/server/firebase-admin";
import { bearerToken, userGymId, verifyUser } from "@/lib/server/verify-user";

export const runtime = "nodejs";

/** Firestore erlaubt höchstens 30 Werte in array-contains-any. */
const IN_GRENZE = 30;

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const uid = user.uid;
  const gymId = userGymId(user);

  try {
    const db = adminDb();
    const plaene = db.collection("gyms").doc(gymId).collection("trainerPlans");

    const aboSnap = await db
      .collection("users")
      .doc(uid)
      .collection("subscriptions")
      .get();
    // Die Dokument-ID IST die Kurs-ID (lib/training-sessions.ts)
    const abos = aboSnap.docs.map((d) => d.id);
    const aboSet = new Set(abos);

    let added = 0;
    let removed = 0;

    // ── Ergänzen: Pläne, die an einen meiner Kurse freigegeben sind ──
    for (let i = 0; i < abos.length; i += IN_GRENZE) {
      const teil = abos.slice(i, i + IN_GRENZE);
      const snap = await plaene
        .where("audienceCourseIds", "array-contains-any", teil)
        .get();
      for (const d of snap.docs) {
        const drin = (d.get("audienceUids") as string[] | undefined) ?? [];
        if (drin.includes(uid)) continue;
        await d.ref.update({ audienceUids: FieldValue.arrayUnion(uid) });
        added += 1;
      }
    }

    // ── Entfernen: Pläne, in denen ich über einen Kurs stand, den ich
    //    nicht mehr habe ──
    const meine = await plaene.where("audienceUids", "array-contains", uid).get();
    for (const d of meine.docs) {
      const einzeln = d.get("audienceIndividualUids") as string[] | undefined;
      if (!Array.isArray(einzeln)) continue; // Altbestand: nie entfernen
      if (einzeln.includes(uid)) continue;
      const kurse = (d.get("audienceCourseIds") as string[] | undefined) ?? [];
      if (kurse.some((k) => aboSet.has(k))) continue;
      await d.ref.update({ audienceUids: FieldValue.arrayRemove(uid) });
      removed += 1;
    }

    return NextResponse.json({ ok: true, added, removed });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Die Freigabe-Nachführung ist serverseitig nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
