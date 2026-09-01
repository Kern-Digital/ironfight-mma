/**
 * POST /api/invites/create — Einladung ausstellen (Verwaltung).
 *
 * Body:    { role?, maxUses?, days?, note?, gymId? }
 * Antwort: { code, gymId, role, expiresAt, maxUses }
 *
 * Schutzregeln (Konzept §4 „Rechte vergeben darf nur, wer sie selbst hat"):
 *   • EINLADEN DARF NUR DIE VERWALTUNG (Leon 31.08.) — geprüft über
 *     `canManageGym`: Plattform-Admin oder Verwaltungs-Claim im eigenen Gym.
 *     Bis Checkpoint 2 stand hier stellvertretend `isAdmin(user)`, weil es
 *     die Rolle `verwaltung` noch nicht gab; seit dem Verwaltungs-Claim ist
 *     die Prüfung echt. Ein Trainer MIT Verwaltungsrecht darf einladen, ein
 *     Trainer ohne nicht. Dieselbe Kante steht in /revoke, /note, in
 *     /api/members/role und in den Rules (Lesen der Einladungen) — wer die
 *     Codes sieht, kann einladen.
 *   • Verwaltung/Admin lädt nur ins EIGENE Gym ein.
 *   • role="admin" ist gar nicht erst vorgesehen — Plattform-Rechte werden
 *     niemals über einen Link vergeben.
 */

import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  AdminUnavailableError,
  adminDb,
} from "@/lib/server/firebase-admin";
import {
  displayNameFor,
  reserveInviteCode,
  writeAudit,
} from "@/lib/server/invites";
import {
  bearerToken,
  canManageGym,
  isAdmin,
  userGymId,
  verifyUser,
} from "@/lib/server/verify-user";
import {
  INVITE_DEFAULT_DAYS,
  INVITE_MAX_DAYS,
  INVITE_MAX_USES,
  type InviteRole,
} from "@/lib/invites";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!canManageGym(user)) {
    return NextResponse.json(
      { error: "Nur die Gym-Verwaltung kann einladen." },
      { status: 403 },
    );
  }

  let body: {
    role?: string;
    maxUses?: number;
    days?: number;
    note?: string;
    gymId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const role: InviteRole = body.role === "trainer" ? "trainer" : "user";
  // Redundant zur Prüfung oben und trotzdem stehengeblieben: Sie hält die
  // Antwort auf die Frage fest, WER Trainer-Rechte per Link vergeben darf —
  // dieselben, die sie in der Mitgliederliste vergeben dürfen (Konzept §4,
  // „Rechte vergeben darf nur, wer sie selbst hat"). Lockert sich die
  // Prüfung oben je, bleibt diese Kante bestehen.
  if (role === "trainer" && !canManageGym(user)) {
    return NextResponse.json(
      { error: "Trainer-Einladungen darf nur die Verwaltung ausstellen." },
      { status: 403 },
    );
  }

  // Nur der Plattform-Admin darf ein fremdes Gym adressieren (spätere
  // Selbstbedienungs-Provisionierung); Trainer immer ihr eigenes.
  const gymId =
    isAdmin(user) && body.gymId?.trim() ? body.gymId.trim() : userGymId(user);

  const maxUses = Math.min(
    Math.max(Math.floor(Number(body.maxUses) || 1), 1),
    INVITE_MAX_USES,
  );
  const days = Math.min(
    Math.max(Math.floor(Number(body.days) || INVITE_DEFAULT_DAYS), 1),
    INVITE_MAX_DAYS,
  );
  const note = (body.note ?? "").toString().slice(0, 120).trim();

  try {
    const db = adminDb();

    const gym = await db.collection("gyms").doc(gymId).get();
    if (!gym.exists) {
      return NextResponse.json(
        { error: "Gym nicht gefunden." },
        { status: 404 },
      );
    }

    const code = await reserveInviteCode(db);
    const expiresAt = Timestamp.fromMillis(Date.now() + days * 86_400_000);
    const createdByName = await displayNameFor(db, user.uid);

    await db
      .collection("gyms")
      .doc(gymId)
      .collection("invites")
      .doc(code)
      .set({
        code,
        gymId,
        role,
        createdBy: user.uid,
        createdByName,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
        maxUses,
        usedCount: 0,
        usedBy: [],
        revokedAt: null,
        note,
      });

    await writeAudit(db, gymId, {
      type: "invite.create",
      actorUid: user.uid,
      actorName: createdByName,
      code,
      details: { role, maxUses, days },
    });

    return NextResponse.json({
      code,
      gymId,
      role,
      maxUses,
      expiresAt: expiresAt.toDate().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Einladungen sind serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] invite/create:", msg);
    return NextResponse.json(
      { error: "Einladung konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
