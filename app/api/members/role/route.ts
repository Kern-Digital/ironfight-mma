/**
 * POST /api/members/role — Rechte eines Mitglieds setzen (Verwaltung).
 *
 * Body:    { uid, trainer: boolean, verwaltung: boolean }
 * Antwort: { ok: true, uid, trainer, verwaltung }
 *
 * Das ist die Rollen-API aus Konzept §4 — die Ablösung des Hand-Scripts
 * `scripts/set-role.mjs` für alles, was ein Gym selbst entscheiden darf.
 *
 * WAS DER BODY NICHT KANN, IST DER HALBE SCHUTZ: Er trägt genau zwei
 * Wahrheitswerte und eine uid. Es gibt kein Feld für den Plattform-Rang
 * (`admin`) und keins für `gymId`. Beides ist damit nicht bloß verboten,
 * sondern nicht ausdrückbar. Der Rest sind die harten Prüfungen unten.
 *
 * Reihenfolge und ihre Begründung:
 *   1. ALLE Prüfungen zuerst — Aufrufer, Gym, Ziel, Aussperr-Schutz. Nichts
 *      wird geschrieben, solange eine davon offen ist.
 *   2. CLAIMS setzen (gemerged). Sie sind autoritativ: firestore.rules und
 *      die Middleware lesen ausschließlich sie.
 *   3. users-Dokument spiegeln. Der Spiegel existiert nur, weil Custom Claims
 *      nicht abfragbar sind — ohne ihn ließe sich „hat dieses Gym noch eine
 *      Verwaltung?" gar nicht beantworten. Schlägt er fehl, werden die Claims
 *      ZURÜCKGENOMMEN: ein Recht, das niemand mehr zählen kann, ist schlimmer
 *      als ein Klick, der sichtbar fehlgeschlagen ist.
 *   4. WETTKÄMPFE nachziehen (Schritt 2b, 04.09.2026). Jedes Camp trägt
 *      `ownerIsStaff` als Kopie mit — genau die Antwort, die dieser Klick
 *      gerade ändert. Schlägt es fehl, werden Spiegel UND Claims
 *      zurückgenommen; die Begründung steht an `syncFightCampOwnerFlag`.
 *
 * Wer sich selbst geändert hat, muss danach `refreshRole()` rufen — der neue
 * Claim steckt im ID-Token, und das holt der Client nicht von allein.
 */

import { NextResponse } from "next/server";
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
import {
  claimsWithRights,
  readRoleSet,
  rightsMirror,
  type RoleSet,
} from "@/lib/roles";
import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * Wie viele Menschen könnten dieses Gym noch verwalten, wenn `excludeUid`
 * das Recht verliert?
 *
 * Gezählt wird über den users-Spiegel (Claims sind nicht abfragbar) und in
 * EINER Abfrage über alle Mitglieder des Gyms — statt zweier Abfragen mit
 * Gleichheitsfiltern, die je nach Index-Lage zusammengeführt werden müssten.
 * Ein Gym hat Hunderte Mitglieder, keine Hunderttausende; der Vorgang läuft
 * selten.
 *
 * Der Plattform-Admin zählt MIT. Er ist heute die Verwaltung jedes Gyms
 * (der Verwaltungs-Claim entsteht erst durch genau diese Route), und ohne
 * ihn wäre die allererste Vergabe nicht mehr rückgängig zu machen.
 */
async function countRemainingManagers(
  db: Firestore,
  gymId: string,
  excludeUid: string,
): Promise<number> {
  const snap = await db.collection("users").where("gymId", "==", gymId).get();
  let count = 0;
  for (const doc of snap.docs) {
    if (doc.id === excludeUid) continue;
    // Der Spiegel traegt seit Checkpoint 3 `verwaltung` und `admin` als
    // eigene Felder; `role === "admin"` ist der Rueckfall fuer Dokumente,
    // die die Migration noch nicht gesehen haben.
    if (
      doc.get("verwaltung") === true ||
      doc.get("admin") === true ||
      doc.get("role") === "admin"
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Zieht `ownerIsStaff` an allen Wettkämpfen des Mitglieds nach und meldet,
 * wie viele Camps sich geändert haben.
 *
 * WARUM DAS HIER STEHEN MUSS: Das Feld am Camp ist die Kopie einer Antwort,
 * die dieser Klick gerade ändert (Begründung in lib/fight-camp.ts). Ohne das
 * Nachziehen bliebe ein frisch ernannter Trainer mit `ownerIsStaff: false` in
 * der gym-weiten Liste stehen — seine Wettkämpfe wären für alle Kollegen
 * sichtbar, obwohl er ab sofort selbst entscheiden darf, wer sie sieht. Und
 * umgekehrt verschwänden die Camps eines zurückgestuften Trainers aus der
 * Liste, ohne dass jemand wüsste, warum.
 *
 * Das Admin-SDK umgeht die Firestore-Regeln — der `ownerIsStaffStimmt`-
 * Vergleich aus firestore.rules greift hier also nicht. Deshalb steht der
 * Aufruf unten hinter dem Spiegel und trägt dieselbe Rücknahme wie er.
 */
async function syncFightCampOwnerFlag(
  db: Firestore,
  uid: string,
  ownerIsStaff: boolean,
): Promise<number> {
  const camps = await db.collection("users").doc(uid).collection("fightCamps").get();
  const zuAendern = camps.docs.filter((c) => c.get("ownerIsStaff") !== ownerIsStaff);
  if (zuAendern.length === 0) return 0;
  const batch = db.batch();
  for (const c of zuAendern) batch.update(c.ref, { ownerIsStaff });
  await batch.commit();
  return zuAendern.length;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!canManageGym(user)) {
    return NextResponse.json(
      { error: "Nur die Gym-Verwaltung kann Rechte vergeben." },
      { status: 403 },
    );
  }

  let body: { uid?: string; trainer?: boolean; verwaltung?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const uid = (body.uid ?? "").toString().trim();
  if (!uid) {
    return NextResponse.json({ error: "Kein Mitglied angegeben." }, { status: 400 });
  }
  // Strikt auf `true` prüfen: ein fehlendes Feld ist „Recht weg", kein
  // „unverändert" — die Oberfläche schickt immer beide Häkchen.
  const wantTrainer = body.trainer === true;
  const wantVerwaltung = body.verwaltung === true;

  try {
    const db = adminDb();

    // ─── Ziel bestimmen (autoritativ aus den Claims, nicht aus Firestore) ──
    let targetClaims: Record<string, unknown>;
    let targetDisabled = false;
    try {
      const target = await adminAuth().getUser(uid);
      targetClaims = (target.customClaims ?? {}) as Record<string, unknown>;
      targetDisabled = target.disabled;
    } catch {
      return NextResponse.json(
        { error: "Dieses Mitglied gibt es nicht." },
        { status: 404 },
      );
    }
    if (targetDisabled) {
      return NextResponse.json(
        { error: "Dieses Konto ist gesperrt. Rechte lassen sich nicht ändern." },
        { status: 409 },
      );
    }

    // Roh gelesen (ohne eingerechneten Plattform-Rang): Diese Route
    // entscheidet, was GESCHRIEBEN wird — sie braucht die tatsaechlich
    // gesetzten Haekchen, nicht die abgeleiteten.
    const targetRights = readRoleSet(targetClaims);
    const targetGymId =
      (typeof targetClaims.gymId === "string" && targetClaims.gymId.trim()) ||
      DEFAULT_GYM_ID;

    // Fremdes Gym: Die Verwaltung entscheidet über IHR Gym. Der
    // Plattform-Admin darf gym-übergreifend handeln (Konzept §1); er wirkt
    // dann im Gym des Ziels — ein WECHSEL des Gyms findet nirgends statt.
    if (!isAdmin(user) && targetGymId !== userGymId(user)) {
      return NextResponse.json(
        { error: "Dieses Mitglied gehört nicht zu deinem Gym." },
        { status: 403 },
      );
    }

    // Plattform-Rechte werden nie über eine Gym-Oberfläche verändert — weder
    // vergeben (der Body kann es nicht) noch entzogen (hier).
    if (targetRights.admin) {
      return NextResponse.json(
        { error: "Plattform-Rechte werden hier nicht verändert." },
        { status: 403 },
      );
    }

    // `admin: false` ist hier keine Entscheidung, sondern eine Feststellung:
    // Die Zeile darüber hat gerade ausgeschlossen, dass das Ziel den
    // Plattform-Rang trägt. Vergeben kann ihn diese Route ohnehin nicht — er
    // steht nicht im Body.
    const nextRights: RoleSet = {
      trainer: wantTrainer,
      verwaltung: wantVerwaltung,
      admin: false,
    };
    const unchanged =
      nextRights.trainer === targetRights.trainer &&
      nextRights.verwaltung === targetRights.verwaltung;
    if (unchanged) {
      // Kein Schreibvorgang, kein Protokolleintrag — sonst füllt jeder
      // versehentlich geöffnete und wieder gespeicherte Dialog die Neuigkeiten.
      return NextResponse.json({
        ok: true,
        uid,
        trainer: nextRights.trainer,
        verwaltung: nextRights.verwaltung,
        unchanged: true,
      });
    }

    // ─── Aussperr-Schutz (Konzept §4) ───────────────────────────────────
    // Gilt bewusst auch, wenn jemand einem ANDEREN das letzte
    // Verwaltungsrecht entzieht: ein Gym ohne Verwaltung kann niemanden
    // mehr einladen und sich selbst nicht mehr helfen — wer den Klick
    // gemacht hat, ändert daran nichts.
    if (targetRights.verwaltung && !wantVerwaltung) {
      const remaining = await countRemainingManagers(db, targetGymId, uid);
      if (remaining < 1) {
        return NextResponse.json(
          {
            error:
              "Dein Gym braucht mindestens eine Verwaltung. Gib das Recht erst jemand anderem, dann kannst du es hier abgeben.",
          },
          { status: 409 },
        );
      }
    }

    // ─── Claims setzen (MERGEN!) ────────────────────────────────────────
    // `claimsWithRights` reicht alle fremden Claims durch — insbesondere
    // `gymId`: setCustomUserClaims ERSETZT alles, und ohne Merge verlöre das
    // Mitglied hier seine Gym-Zugehörigkeit (gleiche Lektion wie in
    // /api/invites/redeem und scripts/set-role.mjs). Entzogene Häkchen
    // löscht dieselbe Funktion — auch das gehört zum Merge.
    await adminAuth().setCustomUserClaims(
      uid,
      claimsWithRights(targetClaims, nextRights),
    );

    // ─── Spiegel im users-Dokument ──────────────────────────────────────
    try {
      await db
        .collection("users")
        .doc(uid)
        .set(rightsMirror(nextRights), { merge: true });
    } catch (mirrorErr) {
      await adminAuth()
        .setCustomUserClaims(uid, claimsWithRights(targetClaims, targetRights))
        .catch(() => {});
      throw mirrorErr;
    }

    // ─── Wettkämpfe nachziehen (Schritt 2b) ─────────────────────────────
    // Dieselbe Rücknahme wie beim Spiegel, aus demselben Grund: Ein Recht,
    // dessen Folgen nur zur Hälfte gelten, ist schlimmer als ein Klick, der
    // sichtbar fehlgeschlagen ist. Die riskante Richtung ist das Ernennen —
    // dort blieben die Camps sonst gym-weit sichtbar.
    let campsNachgezogen = 0;
    try {
      campsNachgezogen = await syncFightCampOwnerFlag(
        db,
        uid,
        nextRights.trainer || nextRights.verwaltung || nextRights.admin,
      );
    } catch (campErr) {
      await db
        .collection("users")
        .doc(uid)
        .set(rightsMirror(targetRights), { merge: true })
        .catch(() => {});
      await adminAuth()
        .setCustomUserClaims(uid, claimsWithRights(targetClaims, targetRights))
        .catch(() => {});
      throw campErr;
    }

    const [actorName, targetName] = await Promise.all([
      displayNameFor(db, user.uid),
      displayNameFor(db, uid, "Ein Mitglied"),
    ]);

    await writeAudit(db, targetGymId, {
      type: "member.role",
      actorUid: user.uid,
      actorName,
      targetUid: uid,
      targetName,
      details: {
        trainer: nextRights.trainer,
        verwaltung: nextRights.verwaltung,
        trainerBefore: targetRights.trainer,
        verwaltungBefore: targetRights.verwaltung,
        // Wie viele Wettkämpfe die Rechteänderung mitgenommen hat. Steht im
        // Protokoll, weil sich damit die Sichtbarkeit fremder Daten ändert.
        fightCampsUpdated: campsNachgezogen,
      },
    });

    return NextResponse.json({
      ok: true,
      uid,
      trainer: nextRights.trainer,
      verwaltung: nextRights.verwaltung,
    });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Die Rechteverwaltung ist serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] members/role:", msg);
    return NextResponse.json(
      { error: "Die Rechte konnten nicht geändert werden." },
      { status: 500 },
    );
  }
}
