/**
 * POST /api/gym/trainer-auswahl — die Trainer, denen ein Mitglied sein
 * Kampfprofil und seine DeepFight-Analysen namentlich freigeben kann.
 * Antwort: { gyms: [{ gymId, name, trainer: [{ uid, name, avatar }] }] }.
 *
 * WARUM ES DIESE ROUTE GIBT (Leon 30.09.2026): Ein Athlet gibt DeepFight
 * selbst frei — ohne Freigabe kann ihn niemand analysieren. Das Sheet bietet
 * „Alle Trainer deines Gyms" oder einzelne Trainer mit Namen. Die Namen kamen
 * aus `listAllMembers()`, und die Mitgliederliste darf ein Athlet nach
 * firestore.rules NICHT lesen (so gewollt, bleibt so). Die Abfrage scheiterte
 * still, das Sheet las „leer" als „keine Trainer" und schrieb „In deinem Gym
 * gibt es gerade keinen Trainer". Diese Route gibt genau das heraus, was die
 * Auswahl braucht, und sonst nichts. Die Regeln bleiben unverändert.
 *
 * WAS SIE HERAUSGIBT — UND WAS NIE:
 *   • je Trainer: uid, Name, Profilbild. KEINE E-Mail, auch nicht als
 *     Namens-Ersatz (`memberName()` fällt auf die E-Mail zurück — deshalb
 *     hier eine eigene Namensregel). Der Messlauf prüft die Schlüssel.
 *   • nur Trainer, die eine namentliche Freigabe TATSÄCHLICH lesen ließe:
 *     Trainer-Recht im CLAIM (nicht nur im Spiegel am Dokument, der
 *     nachhinken kann) UND gymId im Claim = dieses Gym. Genau das prüft
 *     `canAccessMemberData()` in den Regeln. Dadurch fallen reine Verwaltung,
 *     Plattform-Admins (Ghost-Konten, gehören keinem Gym), Demo-Dokumente ohne
 *     Login und gesperrte Konten heraus.
 *   • nie den Aufrufer selbst.
 *
 * WER FRAGEN DARF: jedes angemeldete Konto, aber die Liste bekommt nur, wer
 * ECHT Mitglied ist — Claim UND users-Dokument tragen dasselbe Gym
 * (`mitgliedsGyms`). Ohne diese Prüfung sähe jeder, der sich ohne Einladung
 * registriert, die Trainernamen des Default-Gyms (Rückfall in
 * `userGymId()`; in Produktion gab es am 30.09. genau ein solches Konto).
 *
 * KEINE EINGABE: Die Route liest keinen Body und keinen Parameter. Das Gym
 * kommt ausschließlich aus dem Token, dessen Claims nur das Admin-SDK
 * setzt. Ein fremdes Gym abzufragen ist damit nicht formulierbar.
 *
 * KEINE NAMEN FÜR BELIEBIGE UIDS: Freigaben an Trainer, die nicht mehr im
 * Gym sind, zeigt das Sheet nur als Anzahl. Würde die Route Namen zu den
 * uids in den eigenen `profileShares` nachschlagen, könnte jeder eine
 * beliebige uid in sein eigenes Dokument schreiben und so den Namen jedes
 * Kontos der Plattform erfragen.
 *
 * MEHRERE GYMS (heute gesperrt, Konzept §1): Die Antwort ist schon nach Gym
 * gruppiert, und die Gyms kommen aus `mitgliedsGyms()`. Wird daraus eine
 * Liste, läuft diese Route ohne Umbau. ACHTUNG DANN: Das Trainer-Recht muss
 * JE GYM geprüft werden (Mitgliedschaft im Zielgym), nicht am Konto — sonst
 * stünde jemand, der im MMA-Gym Trainer und im Sambo-Gym nur Athlet ist, in
 * der Sambo-Liste als Trainer.
 *
 * Nicht zwischenspeichern: POST und `Cache-Control: no-store`, die Liste
 * gehört genau einem Gym.
 */

import { NextResponse } from "next/server";
import {
  AdminUnavailableError,
  adminAuth,
  adminDb,
} from "@/lib/server/firebase-admin";
import { bearerToken, mitgliedsGyms, verifyUser } from "@/lib/server/verify-user";
import { readRoleSet } from "@/lib/roles";
import { readProfilbild } from "@/lib/profilbilder";
import type { AuswahlGym, AuswahlTrainer } from "@/lib/trainer-auswahl";

export const runtime = "nodejs";

const KEIN_CACHE = { "Cache-Control": "no-store" };

/** Deckel gegen ein entgleistes Gym — mehr Trainer hat kein echtes Gym. */
const MAX_KANDIDATEN = 200;

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Name ohne E-Mail-Rückfall: Profilname → Name aus dem Login → „Trainer". */
function trainerName(d: Record<string, unknown>): string {
  return text(d.displayName) || text(d.authProviderName) || "Trainer";
}

async function trainerDesGyms(
  gymId: string,
  eigeneUid: string,
): Promise<AuswahlTrainer[]> {
  const db = adminDb();
  // Vorauswahl über den Spiegel (Claims sind nicht abfragbar), nur die
  // Felder, die hinausgehen dürfen.
  const snap = await db
    .collection("users")
    .where("gymId", "==", gymId)
    .where("trainer", "==", true)
    .select("displayName", "authProviderName", "avatar")
    .limit(MAX_KANDIDATEN)
    .get();
  const kandidaten = snap.docs.filter((d) => d.id !== eigeneUid);
  if (kandidaten.length === 0) return [];

  // Die Wahrheit steht im Claim — dasselbe, was die Regeln lesen.
  const echt = new Set<string>();
  for (let i = 0; i < kandidaten.length; i += 100) {
    const teil = kandidaten.slice(i, i + 100).map((d) => ({ uid: d.id }));
    const { users } = await adminAuth().getUsers(teil);
    for (const u of users) {
      const claims = (u.customClaims ?? {}) as Record<string, unknown>;
      const rechte = readRoleSet(claims);
      if (u.disabled) continue;
      if (!rechte.trainer || rechte.admin) continue;
      if (text(claims.gymId) !== gymId) continue;
      echt.add(u.uid);
    }
  }

  return kandidaten
    .filter((d) => echt.has(d.id))
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        uid: d.id,
        name: trainerName(data),
        avatar: readProfilbild(data.avatar),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401, headers: KEIN_CACHE });
  }

  try {
    const db = adminDb();
    const eigen = await db.collection("users").doc(user.uid).get();
    const dokGym = text(eigen.get("gymId"));
    // Claim UND Dokument müssen dasselbe Gym tragen — sonst keine Namen.
    const gyms = mitgliedsGyms(user).filter((g) => g === dokGym);

    const ergebnis: AuswahlGym[] = [];
    for (const gymId of gyms) {
      const gymDok = await db.collection("gyms").doc(gymId).get();
      ergebnis.push({
        gymId,
        name: text(gymDok.get("name")) || gymId,
        trainer: await trainerDesGyms(gymId, user.uid),
      });
    }
    return NextResponse.json({ gyms: ergebnis }, { headers: KEIN_CACHE });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Server gerade nicht erreichbar." },
        { status: 503, headers: KEIN_CACHE },
      );
    }
    console.error("[gym/trainer-auswahl]", err);
    return NextResponse.json(
      { error: "Trainerliste gerade nicht ladbar." },
      { status: 500, headers: KEIN_CACHE },
    );
  }
}
