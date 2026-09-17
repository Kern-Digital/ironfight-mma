/**
 * KAMPFART AM WETTKAMPF + GAMEPLAN — Messung OHNE KI (Fenster tidal-athletics-2d,
 * 17.09.2026).
 *
 *   node --experimental-transform-types --import ./scripts/lib/ts-loader-register.mjs scripts/mess-gameplan.mjs   # nur Firestore
 *   BROWSER=1 THEME=dark node --experimental-transform-types --import … scripts/mess-gameplan.mjs  # + Schirme
 *
 * Firestore (Admin-SDK, eigene Prüfkonten mess-2da@/mess-2dt@…invalid, danach gelöscht):
 *   • Gegner mit zwei Käfig-Analysen → echte Neuberechnung schreibt
 *     evidence.flaeche = kaefig und kampfarten = [mma] (Frage aus dem Prompt).
 *   • Athlet mit zwei MMA-Analysen auf der Matte → fightProfile/mma.
 *   • betroffeneWettkaempfe: Athlet (Kampfart) und Gegner (collectionGroup-Index
 *     gymId + competitionDate, Gegner im Speicher gefiltert).
 *   • schreibeGameplan ohne Claude-Kosten: Wettkampf ohne Kampfart → offen ·
 *     kampfart; Gegner ohne Daten → offen · gegner.
 *   • ein fertiger Gameplan (von Hand geschrieben) für die Schirme.
 * Browser (Trainer): Wettkampfseite mit Kampfart-Chip, Gameplan-Block, Drills in
 * Phase 2/3, Athletensicht (keine Vorschläge, Profilstärke), Gegner mit Käfig;
 * Bestand mit „Kampfart wählen"; Gegnerprofil; Anlegen mit vorbelegter Kampfart.
 *
 * Fenster 5b (17.09.2026 abends) — Fläche am Wettkampf + Gameplan für den Athleten:
 *   • Kopf der Wettkampfseite: Fläche vorbelegt aus der Kampfart (MMA → Käfig),
 *     Gameplan-Kopf „MMA · Käfig · …".
 *   • Bestand: Kampfart wählen → Fläche erscheint (Käfig) → Ring wählen →
 *     Camp trägt flaeche ring, die Route schreibt „offen · gegner" (leerer
 *     Gegner, KEIN Claude-Aufruf).
 *   • Anlegen: Fläche folgt der vorbelegten Kampfart.
 *   • Athlet (eigenes Konto): Dashboard-Karte „Dein Gameplan" → Sheet mit drei
 *     Blöcken und Drills — liest das Gameplan-Dokument mit dem Client-SDK
 *     (Regel: Inhaber liest fightProfile/*).
 *
 * Fenster d5 (17.09.2026 abends) — Gameplan folgt dem Scouting + Plan bearbeiten:
 *   • Firestore: zwei Scouting-Änderungen am Stück (Aufschub 1,5 s) → die
 *     erste tritt zurück, die zweite schreibt „offen · gegner" (kein Claude).
 *   • Browser Trainer: Phase 2 bearbeiten (Fokus, 4→3 Einheiten, 20→25 %
 *     Sparring, Notiz) → nur diese Phase im Dokument, „Geändert von … · heute";
 *     Abbrechen ändert nichts; Gegnerprofil speichern → Hinweis „schreibt in
 *     90 Sekunden neu", Marke am Gameplan, Zeile „Neues Scouting" auf der
 *     Wettkampfseite, nach ≥ 90 s „offen · gegner" (echte Route, kein Claude).
 *   • Browser Athlet: Karte mit „Dein Trainingsplan" + „Dein Gameplan", Plan-
 *     Sheet zeigt die Trainer-Änderung, eine Admin-Änderung erscheint LIVE,
 *     Reiter wechselt zum Gameplan; Handy-Breite 390 px ohne Quer-Überlauf.
 *
 * Fenster 12 (17.09.2026 nachts) — Kampf verschoben (Stufe 2):
 *   • Wettkampfseite: „Verschieben" öffnet den Editor, die Vorschau zeigt alle
 *     vier Phasen mit alter → neuer Länge; vorgezogen von 40 auf 25 Tage →
 *     Camp trägt Datum, weeksTotal und eine lückenlose Zeitachse, die letzte
 *     Phase endet auf dem Kampftag, Fokus/Notiz/Einheiten/„Geändert von" der
 *     bearbeiteten Phase 2 bleiben stehen, Marke im Kopf und am Plan.
 *   • OHNE Schalter bleibt der Gameplan unberührt (Leon: verschieben kostet
 *     nichts — das Datum steht nicht mehr im Auftrag an Claude).
 *   • MIT Schalter („direkt einen neuen erstellen lassen") läuft die Route
 *     wirklich — geprüft auf einem Wettkampf gegen einen Gegner ohne Daten,
 *     der ohne Claude bei „offen · gegner" landet.
 *   • Athlet: „Dein Kampf ist jetzt am … — Mess Trainer 2d hat ihn heute
 *     verschoben" im Plan-Sheet.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";
import { recomputeProfile } from "../lib/server/profile-recompute.ts";
import {
  betroffeneWettkaempfe,
  gameplaeneNachScouting,
  merkeScoutingAenderung,
  schreibeGameplan,
} from "../lib/server/gameplan.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const THEME = process.env.THEME ?? "dark";
const BROWSER = process.env.BROWSER === "1";
const GYM_ID = "tidal-athletics";
const ATHLET = "mess-2da@tidal-athletics.invalid";
const TRAINER = "mess-2dt@tidal-athletics.invalid";
const PASSWORD = `mess-2d-${Math.random().toString(36).slice(2)}A1!`;
const OUT = process.env.OUT ?? ".";

let fehler = 0;
let ok = 0;
const sagt = (bestanden, text) => {
  if (bestanden) ok += 1;
  else fehler += 1;
  console.log(`  ${bestanden ? "OK  " : "FEHL"} ${text}`);
};

const befund = (questionId, sideKey, answer) => ({
  questionId, categoryId: questionId.split("_")[0], answer, confidence: 0.8, evidence: ["01:00"], sideKey,
});

function analyse(mode, targetId, name, { sport, flaeche, findings, actionStats, dnaSplit, tageAlt }) {
  return {
    mode, targetId, targetName: name, gymId: GYM_ID, targetIsStaff: false,
    sourceLabel: `${sport}-${tageAlt}.mp4`, sourceKind: "upload", youtubeUrl: null, fileFingerprint: null,
    fighter: { name, corner: "unknown", clothing: "", features: "", startPosition: "" },
    tier: "flash", recency: "recent", videoType: "full", sport, variante: null, flaeche, verworfen: [], fightMonth: null,
    weight: { value: 1, recency: 1, type: 1, identification: 0.9, identified: true },
    models: { gemini: "mess", claude: "mess" }, usage: null,
    observation: {
      identification: { description: "", idConfidence: 0.9, evidence: [] }, meta: { coverage: null, ruleset: null },
      actions: [], dnaSplit: null, combos: [], defense: {}, controlTime: null, movement: null, rounds: [], notes: null,
    },
    evaluation: {
      summary: "", style: { primaryStyle: null, approach: null, baseDiscipline: null },
      findings, scores: {}, topWeapons: [], topPatterns: [], topWeaknesses: [], topDangers: [],
      dangerProfile: { mostDangerousWhen: null, finishes: null, vulnerableWhen: null },
      actionStats, dnaSplit, merge: { confirms: [], contradicts: [], weight: 0 },
    },
    wrongFighter: false, sharedWithAthlete: false, createdBy: "mess", createdByName: null,
    createdAt: Timestamp.fromDate(new Date(Date.now() - tageAlt * 86_400_000)),
  };
}

function camp(uid, trainerUid, { name, sport, opponentId, opponentName, tage }) {
  const start = new Date();
  const datum = new Date(Date.now() + tage * 86_400_000);
  const woche = 7 * 86_400_000;
  const phase = (p, i, focus) => ({
    phase: p, startsAt: Timestamp.fromDate(new Date(start.getTime() + i * 2 * woche)),
    endsAt: Timestamp.fromDate(new Date(start.getTime() + (i + 1) * 2 * woche)), weeks: 2, focus,
    techniqueIds: [], exerciseIds: [], trainingAreas: [], categories: ["boxing"], sessionsPerWeek: 4, sparringRatio: 0.2,
  });
  const doc = {
    studentUid: uid, gymId: GYM_ID, ownerIsStaff: false, createdBy: trainerUid, createdAt: Timestamp.now(),
    competitionDate: Timestamp.fromDate(datum), competitionName: name, weeksTotal: 8, startedAt: Timestamp.fromDate(start),
    opponent: { name: opponentName, style: "striker", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null, strengths: [], weaknesses: [], favoriteAttacks: [], opponentId },
    phases: [
      phase("foundation", 0, "Aufbau."), phase("specific-prep", 1, "Gegnerspezifisch."),
      phase("sparring-simulation", 2, "Sparring."), phase("taper", 3, "Taper."),
    ],
    status: "active", notizen: [], opponentId,
  };
  if (sport) doc.sport = sport;
  return doc;
}

async function konto(auth, db, email, name, rechte, extra = {}) {
  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    await auth.updateUser(uid, { password: PASSWORD });
  } catch {
    uid = (await auth.createUser({ email, password: PASSWORD, displayName: name, emailVerified: true })).uid;
  }
  await auth.setCustomUserClaims(uid, claimsWithRights({ gymId: GYM_ID }, rechte));
  await db.collection("users").doc(uid).set(
    { email, displayName: name, gymId: GYM_ID, onboarded: true, ...rightsMirror(rechte), createdAt: Timestamp.now(), ...extra },
    { merge: true },
  );
  return uid;
}

async function main() {
  const { projectId } = initAdmin();
  console.log(`Admin-SDK: ${projectId} · BROWSER ${BROWSER ? `an (${BASE}, ${THEME})` : "aus"}`);
  const auth = getAuth();
  const db = getFirestore();
  let athletUid = null;
  let trainerUid = null;
  const gegnerIds = [];

  try {
    const nichts = { trainer: false, verwaltung: false, admin: false };
    athletUid = await konto(auth, db, ATHLET, "Mess Athlet 2d", nichts, {
      profileShares: { athlet: { uids: [], gyms: [GYM_ID] }, deepfight: { uids: [], gyms: [GYM_ID] }, wettkampf: { uids: [], gyms: [GYM_ID] } },
    });
    trainerUid = await konto(auth, db, TRAINER, "Mess Trainer 2d", { trainer: true, verwaltung: false, admin: false }, { trainerOnboarded: true });

    // ── Gegner mit zwei Käfig-Analysen ────────────────────────────────────
    const gegner = db.collection("opponents").doc();
    gegnerIds.push(gegner.id);
    await gegner.set({
      gymId: GYM_ID, name: "Mess Gegner Käfig", style: "wrestler", stance: "southpaw", heightCm: 182, weightKg: 77, reachCm: 188,
      strengths: ["Double Leg am Rand"], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [],
      createdBy: trainerUid, createdByName: "Mess Trainer 2d", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    for (const [i, tage] of [[1, 3], [2, 1]]) {
      await gegner.collection("videoAnalyses").doc(`kaefig-${i}`).set(analyse("opponent", gegner.id, "Mess Gegner Käfig", {
        sport: "mma", flaeche: "kaefig", tageAlt: tage,
        findings: [
          befund("preferred-weapons_takedown", "double-leg", "Er schießt den Double Leg, sobald er am Rand steht."),
          befund("weaknesses_technical", "kopf-offen", "Nach dem Shot bleibt sein Kopf offen."),
        ],
        actionStats: [{ id: "double-leg", attempted: 6, landed: 4, zone: "cage" }, { id: "jab", attempted: 12, landed: 4, zone: "center" }],
        dnaSplit: { boxing: 35, kicking: 5, wrestling: 45, ground: 10, clinch: 5 },
      }));
    }
    const { profil: gp } = await recomputeProfile(db, "opponent", gegner.id, "mess");
    const gDoc = (await gegner.get()).data();
    sagt(gDoc.evidence?.flaeche === "kaefig", `Gegner-Neuberechnung schreibt evidence.flaeche = ${gDoc.evidence?.flaeche}`);
    sagt(JSON.stringify(gDoc.evidence?.kampfarten) === '["mma"]', `… und evidence.kampfarten = ${JSON.stringify(gDoc.evidence?.kampfarten)}`);
    sagt((gp.evidence.countedAnalyses ?? 0) === 2, `… aus 2 zählenden Analysen (${gp.evidence.countedAnalyses})`);

    // Leerer Gegner (keine Videos, kein Scouting) für den Bestand
    const leer = db.collection("opponents").doc();
    gegnerIds.push(leer.id);
    await leer.set({
      gymId: GYM_ID, name: "Mess Gegner Leer", style: "all-rounder", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null,
      strengths: [], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [],
      createdBy: trainerUid, createdByName: "Mess Trainer 2d", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });

    // ── Athlet mit zwei MMA-Analysen auf der Matte ─────────────────────────
    const col = db.collection("users").doc(athletUid).collection("videoAnalyses");
    for (const [i, tage] of [[1, 4], [2, 2]]) {
      await col.doc(`mma-${i}`).set(analyse("athlete", athletUid, "Mess Athlet 2d", {
        sport: "mma", flaeche: "matte", tageAlt: tage,
        findings: [
          befund("preferred-weapons_most-common", "cross", "Dein Cross ist deine häufigste Waffe."),
          befund("gameplan_seek-distance", "aussen", "Du suchst die Außendistanz."),
        ],
        actionStats: [{ id: "cross", attempted: 14, landed: 6, zone: "center" }, { id: "jab", attempted: 20, landed: 8, zone: "center" }],
        dnaSplit: { boxing: 70, kicking: 15, wrestling: 5, ground: 5, clinch: 5 },
      }));
    }
    const { profil: ap } = await recomputeProfile(db, "athlete", athletUid, "mess");
    const mma = (await db.collection("users").doc(athletUid).collection("fightProfile").doc("mma").get()).data();
    sagt(!!mma && mma.evidence?.flaeche === "matte", `Athlet: fightProfile/mma mit Fläche ${mma?.evidence?.flaeche}`);
    sagt(JSON.stringify(ap.evidence.kampfarten) === '["mma"]', `Athlet: Kampfarten ${JSON.stringify(ap.evidence.kampfarten)}`);

    // ── Wettkämpfe ─────────────────────────────────────────────────────────
    const camps = db.collection("users").doc(athletUid).collection("fightCamps");
    const neu = camps.doc();
    await neu.set(camp(athletUid, trainerUid, { name: "Mess Night 2d", sport: "mma", opponentId: gegner.id, opponentName: "Mess Gegner Käfig", tage: 40 }));
    const bestand = camps.doc();
    await bestand.set(camp(athletUid, trainerUid, { name: "Mess Bestand 2d", sport: null, opponentId: leer.id, opponentName: "Mess Gegner Leer", tage: 60 }));
    const vorbei = camps.doc();
    await vorbei.set(camp(athletUid, trainerUid, { name: "Mess Vorbei 2d", sport: "mma", opponentId: gegner.id, opponentName: "Mess Gegner Käfig", tage: -20 }));

    const athletBetroffen = await betroffeneWettkaempfe(db, { mode: "athlete", targetId: athletUid, sport: "mma", gymId: GYM_ID });
    sagt(athletBetroffen.map((b) => b.camp.id).join() === neu.id, `Athlet-Video MMA betrifft nur den anstehenden MMA-Wettkampf (${athletBetroffen.length})`);
    const samboBetroffen = await betroffeneWettkaempfe(db, { mode: "athlete", targetId: athletUid, sport: "sambo", gymId: GYM_ID });
    sagt(samboBetroffen.length === 0, "Sambo-Video betrifft den MMA-Wettkampf nicht");
    const gegnerBetroffen = await betroffeneWettkaempfe(db, { mode: "opponent", targetId: gegner.id, sport: "mma", gymId: GYM_ID });
    sagt(gegnerBetroffen.map((b) => b.camp.id).join() === neu.id, `Gegner-Video: collectionGroup über den vorhandenen Index findet den anstehenden Wettkampf (${gegnerBetroffen.length}, vergangener ausgelassen)`);

    // ── schreibeGameplan ohne Claude ───────────────────────────────────────
    const ergBestand = await schreibeGameplan(db, athletUid, bestand.id);
    const gBestand = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestand.id}`).get()).data();
    sagt(ergBestand === "offen" && gBestand?.offen === "kampfart", `Bestand ohne Kampfart → ${ergBestand} · ${gBestand?.offen}`);
    await bestand.update({ sport: "mma" });
    const ergLeer = await schreibeGameplan(db, athletUid, bestand.id);
    const gLeer = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestand.id}`).get()).data();
    sagt(ergLeer === "offen" && gLeer?.offen === "gegner", `Gegner ohne Daten → ${ergLeer} · ${gLeer?.offen} (kein Claude-Aufruf)`);
    await bestand.update({ sport: null });
    await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestand.id}`).delete();

    // Fertiger Gameplan von Hand (kein KI-Aufruf) — für die Schirme. Mit
    // GAMEPLAN_JSON=<nachweis.json> steht stattdessen ein gespeicherter echter
    // Claude-Inhalt da (Feld `inhalt`), ohne neuen Aufruf.
    const echterInhalt = process.env.GAMEPLAN_JSON
      ? JSON.parse((await import("node:fs")).readFileSync(process.env.GAMEPLAN_JSON, "utf8")).inhalt
      : null;
    await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${neu.id}`).set({
      campId: neu.id, sport: "mma", status: "fertig",
      inhalt: echterInhalt ?? {
        lage: "Erste Tendenz: Beide Profile stehen auf zwei Videos. Boden und Clinch kamen bei dir noch nicht vor.",
        waffen: [
          { titel: "Jab in den Shot-Moment", text: "Mess Gegner Käfig senkt vor dem Double Leg den Kopf. Dein Jab trifft genau dort.", beleg: "Du: Jab 20 Versuche, 8 gelungen · Gegner: 2 von 2 Videos" },
          { titel: "Cross aus der Außendistanz", text: "Du suchst die Außendistanz, dein Gegner will an den Rand. Setz den Cross, bevor er ankommt.", beleg: "Du: 2 von 2 Videos" },
        ],
        gefahren: [
          { titel: "Double Leg am Rand", text: "Dein Gegner schießt, sobald du mit dem Rücken zum Rand stehst.", beleg: "Double Leg 6 Versuche, 4 gelungen · Scouting-Notiz" },
        ],
        soKaempfstDu: [
          { titel: "Mitte halten, seitlich raus", text: "Bleib in der Mitte und löse nach jeder Serie seitlich, nie gerade zurück.", beleg: "Gegner: Double Leg meist am Rand" },
        ],
        drills: [
          { phase: "specific-prep", titel: "Sprawl nach Jab", text: "3 × 3 min: Partner schießt nach deinem Jab, du sprawlst und stehst in der Mitte auf.", wofuer: "Double Leg am Rand" },
          { phase: "sparring-simulation", titel: "Rand-Sparring", text: "Partner drückt dich an den Rand, du löst seitlich und kontrest mit dem Cross.", wofuer: "Mitte halten, seitlich raus" },
        ],
      },
      stand: { athletAnalysen: 2, gegnerAnalysen: 2, athletStaerke: ap.evidence.staerke ?? 0, gegnerStaerke: gp.evidence.staerke ?? 0, gegnerScouting: true },
      geschriebenAt: new Date().toISOString(), gestartetAt: null, offen: null, fehler: null, model: "mess", usage: null, laufId: null, eingabeSchluessel: "mess",
    });
    sagt(true, "fertiger Gameplan von Hand geschrieben (Schirm-Daten)");

    // ── Gameplan folgt dem Scouting — ohne Claude (Fenster d5) ─────────────
    // Leerer Gegner: Eine Änderung an den Maßen ist kein Scouting, die
    // Voraussetzung bleibt „gegner" — so läuft der ganze Weg ohne KI-Kosten.
    const scout = db.collection("opponents").doc();
    gegnerIds.push(scout.id);
    await scout.set({
      gymId: GYM_ID, name: "Mess Gegner Scouting", style: "all-rounder", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null,
      strengths: [], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [],
      createdBy: trainerUid, createdByName: "Mess Trainer 2d", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    const scoutCamp = camps.doc();
    await scoutCamp.set(camp(athletUid, trainerUid, { name: "Mess Scouting d5", sport: "mma", opponentId: scout.id, opponentName: "Mess Gegner Scouting", tage: 45 }));
    const scoutPlan = db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${scoutCamp.id}`);
    const planFertig = {
      campId: scoutCamp.id, sport: "mma", status: "fertig",
      inhalt: { lage: "Vorher-Stand Scouting.", waffen: [{ titel: "Vorher", text: "Stand vor dem Scouting.", beleg: "Scouting-Notiz" }], gefahren: [], soKaempfstDu: [], drills: [] },
      stand: null, geschriebenAt: new Date().toISOString(), gestartetAt: null, offen: null, fehler: null, model: "mess", usage: null, laufId: null, eingabeSchluessel: "mess",
    };
    await scoutPlan.set(planFertig);
    const m1 = await merkeScoutingAenderung(db, { opponentId: scout.id, gymId: GYM_ID, aufschubMs: 1500 });
    const nachM1 = (await scoutPlan.get()).data();
    sagt(
      m1.betroffen.length === 1 && nachM1?.aufschubId === m1.aufschubId && !!nachM1?.aufschubBis && nachM1?.status === "fertig",
      `Scouting: Marke am Gameplan des anstehenden Wettkampfs (${m1.betroffen.length}), Status bleibt ${nachM1?.status}`,
    );
    const m2 = await merkeScoutingAenderung(db, { opponentId: scout.id, gymId: GYM_ID, aufschubMs: 1500 });
    const frist = Date.now() + 280_000;
    const [r1, r2] = await Promise.all([
      gameplaeneNachScouting(db, m1, { frist, aufschubMs: 1500 }),
      gameplaeneNachScouting(db, m2, { frist, aufschubMs: 1500 }),
    ]);
    sagt(r1[0]?.ergebnis === "ueberholt" && r2[0]?.ergebnis === "offen", `Scouting: zwei Änderungen am Stück — die erste tritt zurück (${r1[0]?.ergebnis}), die zweite schreibt (${r2[0]?.ergebnis})`);
    const nachScout = (await scoutPlan.get()).data();
    sagt(
      nachScout?.status === "offen" && nachScout?.offen === "gegner" && !nachScout?.aufschubId && !nachScout?.aufschubBis &&
        nachScout?.inhalt?.lage === "Vorher-Stand Scouting." && !nachScout?.usage,
      "Scouting: Marke abgenommen, „offen · gegner“, Inhalt bleibt, kein Claude-Aufruf",
    );
    const neuPlan = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${neu.id}`).get()).data();
    sagt(!neuPlan?.aufschubId, "Scouting: Wettkampf gegen einen anderen Gegner trägt keine Marke");
    await scoutPlan.set(planFertig);

    if (BROWSER || process.env.FLAG === "1") await markierenNachweis({ db, athletUid, trainerUid, gegnerIds });
    if (BROWSER) {
      await schirme({
        athletUid, trainerUid, neuId: neu.id, bestandId: bestand.id, gegnerId: gegner.id, leerId: leer.id, db,
        scoutId: scout.id, scoutCampId: scoutCamp.id,
      });
    }
  } catch (err) {
    fehler += 1;
    console.log(`  FEHL Ausnahme: ${err?.name ?? ""} ${err?.message ?? err}`);
  } finally {
    for (const id of gegnerIds) await db.recursiveDelete(db.collection("opponents").doc(id));
    for (const uid of [athletUid, trainerUid].filter(Boolean)) {
      await db.recursiveDelete(db.collection("users").doc(uid));
      await auth.deleteUser(uid).catch(() => {});
    }
    const users = (await auth.listUsers(1000)).users;
    console.log(`Aufgeräumt: ${users.length} Auth-Konten, ${(await db.collection("users").get()).size} users-Dokumente`);
    console.log(`\n${ok}/${ok + fehler} ${fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : "PRÜFUNG(EN) FEHLGESCHLAGEN ✗"}`);
    process.exitCode = fehler === 0 ? 0 : 1;
  }
}

async function anmelden(page, email) {
  for (let a = 0; a < 3; a++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    if (await page.locator('input[type="email"]').count()) break;
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|trainer|kampfprofil)/, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

/**
 * Laufzeit-Nachweis des Markieren-Nachlaufs (Leon 17.09.: „Ja, auch beim
 * Markieren") OHNE Claude-Kosten: Prüf-Gegner mit EINER Analyse, Wettkampf
 * gegen ihn mit einem fertigen Gameplan. Der Prüf-Trainer markiert die Analyse
 * über POST /api/video-analysis/flag (echtes ID-Token) → der Gegner hat keine
 * zählende Analyse mehr → der Nachlauf setzt den Gameplan auf „offen · gegner",
 * der letzte Inhalt bleibt stehen. Braucht den Dev-Server (BASE).
 */
async function markierenNachweis({ db, athletUid, trainerUid, gegnerIds }) {
  const { readFileSync } = await import("node:fs");
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const fg = db.collection("opponents").doc();
  gegnerIds.push(fg.id);
  await fg.set({
    gymId: GYM_ID, name: "Mess Gegner Markieren", style: "striker", stance: "orthodox", heightCm: null, weightKg: null, reachCm: null,
    strengths: [], weaknesses: [], favoriteAttacks: [], notes: null, dna: {}, sharedWith: [],
    createdBy: trainerUid, createdByName: "Mess Trainer 2d", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  await fg.collection("videoAnalyses").doc("flag-1").set(analyse("opponent", fg.id, "Mess Gegner Markieren", {
    sport: "mma", flaeche: "kaefig", tageAlt: 2,
    findings: [befund("preferred-weapons_most-common", "jab", "Sein Jab ist die häufigste Waffe.")],
    actionStats: [{ id: "jab", attempted: 15, landed: 6, zone: "center" }],
    dnaSplit: { boxing: 80, kicking: 10, wrestling: 5, ground: 0, clinch: 5 },
  }));
  const { profil } = await recomputeProfile(db, "opponent", fg.id, "mess");
  sagt(profil.evidence.countedAnalyses === 1, `Markieren: Prüf-Gegner zählt vorher ${profil.evidence.countedAnalyses} Analyse`);

  const campRef = db.collection("users").doc(athletUid).collection("fightCamps").doc();
  await campRef.set(camp(athletUid, trainerUid, { name: "Mess Markieren 5b", sport: "mma", opponentId: fg.id, opponentName: "Mess Gegner Markieren", tage: 50 }));
  const planRef = db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${campRef.id}`);
  const inhalt = {
    lage: "Vorher-Stand.", waffen: [{ titel: "Vorher", text: "Stand vor dem Markieren.", beleg: "Gegner: 1 Video" }],
    gefahren: [], soKaempfstDu: [], drills: [],
  };
  await planRef.set({
    campId: campRef.id, sport: "mma", status: "fertig", inhalt, stand: null, geschriebenAt: new Date().toISOString(),
    gestartetAt: null, offen: null, fehler: null, model: "mess", usage: null, laufId: null, eingabeSchluessel: "mess",
  });

  const ohne = await fetch(`${BASE}/api/video-analysis/flag`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  sagt(ohne.status === 403, `Markieren: POST ohne Token → ${ohne.status}`);

  const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: TRAINER, password: PASSWORD, returnSecureToken: true }),
  });
  const { idToken } = await login.json();
  sagt(!!idToken, "Markieren: echtes ID-Token des Prüf-Trainers (Identity Toolkit)");
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/video-analysis/flag`, {
    method: "POST",
    headers: { authorization: `Bearer ${idToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode: "opponent", targetId: fg.id, analysisId: "flag-1", action: "flag", wrongFighter: true }),
  });
  const antwort = await res.json().catch(() => ({}));
  sagt(res.status === 200 && antwort.analysis?.wrongFighter === true, `Markieren: Route antwortet ${res.status}, wrongFighter ${antwort.analysis?.wrongFighter} (${Date.now() - t0} ms)`);
  const nachher = await warteAuf(async () => {
    const d = (await planRef.get()).data();
    return d?.status === "offen" ? d : null;
  }, 45000);
  sagt(nachher?.offen === "gegner", `Markieren: Nachlauf setzt den Gameplan auf „offen · ${nachher?.offen}“ (${Math.round((Date.now() - t0) / 100) / 10} s nach dem Aufruf)`);
  sagt(nachher?.inhalt?.lage === "Vorher-Stand." && !nachher?.usage, "Markieren: letzter Inhalt bleibt stehen, kein Claude-Aufruf");
}

/** Eine Option in einem components/ui/Select wählen. */
async function waehle(page, feld, label) {
  await page.locator(`${feld} button[aria-haspopup="listbox"]`).click();
  await page.locator('[role="listbox"] [role="option"]', { hasText: label }).first().click();
}

async function warteAuf(pruefe, ms = 30000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    const wert = await pruefe();
    if (wert) return wert;
    await new Promise((r) => setTimeout(r, 750));
  }
  return null;
}

async function schirme({ athletUid, trainerUid, neuId, bestandId, gegnerId, leerId, db, scoutId, scoutCampId }) {
  const { chromium } = await import("playwright");
  // Der Schalter erlaubt Ton ohne Nutzergeste — sonst sperrt Chromium den
  // Versus-Ton und der Zustand wäre immer „blocked" (Leons Ton, 17.09.2026).
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const konsole = [];
  const scoutPlanRef = db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${scoutCampId}`);
  let tSpeichern = 0;
  try {
    const ohneToken = await fetch(`${BASE}/api/wettkampf/gameplan/scouting`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    sagt(ohneToken.status === 403, `Scouting-Route: POST ohne Token → ${ohneToken.status}`);

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
    await anmelden(page, TRAINER);
    await page.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);

    // Wettkampfseite (neu, mit Kampfart)
    const tonAntworten = [];
    page.on("response", (r) => { if (r.url().includes("/audio/")) tonAntworten.push({ url: r.url(), status: r.status() }); });
    await page.goto(`${BASE}/trainer/competitions/${athletUid}/${neuId}`, { waitUntil: "domcontentloaded" });
    // ── Versus-Intro mit Leons Ton (17.09.2026) ─────────────────────────────
    const intro = page.locator(".tidal-vs-intro");
    const introDa = await intro
      .waitFor({ timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const tonZustand = introDa
      ? await warteAuf(async () => {
          const v = await intro.getAttribute("data-sound").catch(() => null);
          return v && v !== "pending" ? v : null;
        }, 6000)
      : null;
    sagt(introDa && tonZustand === "playing", `Versus-Intro läuft, Ton-Zustand „${tonZustand}"`);
    const tonDatei = await warteAuf(async () => tonAntworten.find((r) => r.url.includes("062864")) ?? null, 8000);
    sagt(tonDatei?.status === 200, `Versus-Ton wird ausgeliefert (${tonDatei?.status ?? "keine Anfrage"})`);
    await page.locator('[data-kampfart="mma"]').waitFor({ timeout: 60000 });
    const gameplan = page.locator('section#gameplan');
    await gameplan.waitFor({ timeout: 30000 });
    await page.waitForTimeout(4000); // Intro + Einblenden
    const gText = (await gameplan.innerText()).toLowerCase();
    sagt(gText.includes("deine waffen") && gText.includes("die gefahren") && gText.includes("so kämpfst du"), "Gameplan: drei Blöcke");
    sagt((gText.match(/\bbeleg\b/g) ?? []).length >= 4 && gText.includes("mma · "), "Gameplan: Beleg je Punkt, Kampfart im Kopf");
    sagt(
      (await page.locator('[data-feld="flaeche"][data-flaeche="kaefig"]').count()) === 1 && gText.includes("mma · käfig · "),
      "Fläche: Kopf vorbelegt mit Käfig (MMA), Gameplan-Kopf „MMA · Käfig“",
    );
    const d2 = await page.locator('[data-gameplan-drills="specific-prep"] li').count();
    const d3 = await page.locator('[data-gameplan-drills="sparring-simulation"] li').count();
    sagt(d2 >= 1 && d3 >= 1, `Drills in Phase 2 (${d2}) und Phase 3 (${d3}) des Plans`);
    await gameplan.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/mess-2d-gameplan-${THEME}.png`, fullPage: false });
    await gameplan.screenshot({ path: `${OUT}/mess-2d-gameplan-block-${THEME}.png` });
    await page.locator("#plan-phase-specific-prep").screenshot({ path: `${OUT}/mess-2d-phase2-${THEME}.png` });

    // Gegner-Seite (Start): Käfig aus seinen Videos
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const main = page.locator("main").last();
    const gegnerText = (await main.innerText()).toLowerCase();
    sagt(gegnerText.includes("am käfig") || gegnerText.includes("käfig"), "Gegner-Seite: Käfig-Wörter aus seinen Videos");
    await page.screenshot({ path: `${OUT}/mess-2d-gegner-${THEME}.png`, fullPage: false });

    // Athleten-Seite: Athletensicht
    await page.getByRole("button", { name: /Mess Athlet 2d/ }).first().click();
    await page.waitForTimeout(2000);
    const athletText = (await main.innerText()).toLowerCase();
    sagt(/profilstärke \d+ %/.test(athletText) && !athletText.includes("dna 0 %"), "Athleten-Meta: Profilstärke statt DNA-%");
    sagt(!athletText.includes("vorschläge · frei anpassbar") && !athletText.includes("übernimm"), "Athletensicht: keine Vorschläge, kein „übernimm“");
    sagt(athletText.includes("mattenmitte") || athletText.includes("matte"), "Athleten-Karte: Matten-Wörter aus seinem MMA-Profil");
    await page.screenshot({ path: `${OUT}/mess-2d-athlet-${THEME}.png`, fullPage: false });

    // ── Plan bearbeiten, Stufe 1 (Fenster d5) ───────────────────────────────
    const phase2 = page.locator("#plan-phase-specific-prep");
    await phase2.scrollIntoViewIfNeeded();
    sagt((await page.locator('[data-aktion="phase-bearbeiten"]').count()) === 4, "Plan: jede der vier Phasen trägt „Bearbeiten“");
    await phase2.locator('[data-aktion="phase-bearbeiten"]').click();
    const editor = phase2.locator('[data-phasen-editor="specific-prep"]');
    await editor.waitFor({ timeout: 10000 });
    sagt((await page.locator("[data-phasen-editor]").count()) === 1, "Plan: „Bearbeiten“ öffnet den Editor genau einer Phase");
    await editor.locator('[data-feld="fokus"]').fill("Takedown-Abwehr am Zaun");
    await editor.locator('[data-feld="einheiten"] button[aria-label$="weniger"]').click();
    await editor.locator('[data-feld="sparring"] button[aria-label$="mehr"]').click();
    await editor.locator('[data-feld="notiz"]').fill("Sparring nur mit Kopfschutz");
    await page.waitForTimeout(500);
    const edText = (await editor.innerText()).toLowerCase();
    sagt(edText.includes("3×") && edText.includes("25 %"), "Plan: Stepper 4 → 3 Einheiten, 20 → 25 % Sparring");
    await phase2.screenshot({ path: `${OUT}/mess-d5-phase-editor-${THEME}.png` });

    // ── Techniken tauschen, Stufe 3 (Fenster a0) ────────────────────────────
    // Dieselbe Phase, DERSELBE Speichervorgang: Techniken und Übungen tragen
    // die Marke „Geändert von" zusammen mit Fokus und Notiz.
    const tWahl = editor.locator('[data-wahl="techniken"]');
    const uWahl = editor.locator('[data-wahl="uebungen"]');
    // innerText liefert den GERENDERTEN Text — der Zähler steht in Versalien
    // („0 VON 12"), also case-egal vergleichen.
    const zaehler = async (w) => (await w.locator("[data-anzahl]").innerText()).trim().toLowerCase();
    sagt(
      (await zaehler(tWahl)) === "0 von 12" && (await tWahl.innerText()).includes("Noch ohne Technik"),
      "Stufe 3: leere Phase zeigt „0 von 12“ und den Hinweis",
    );
    await tWahl.locator(".goo-pill").click();
    await tWahl.locator("input.goo-input").fill("Gibtsnichtimkatalog");
    await page.waitForTimeout(400);
    sagt(
      (await tWahl.locator('[data-treffer-liste="techniken"]').innerText()).includes("Bibliothek nichts"),
      "Stufe 3: Suche ohne Treffer sagt es in einem Satz",
    );
    // „double leg" ohne Bindestrich — die Technik heißt „Double-Leg Takedown".
    await tWahl.locator("input.goo-input").fill("double leg");
    await tWahl.locator('[data-treffer="wrestling_double_leg"]').waitFor({ timeout: 10000 });
    sagt(true, "Stufe 3: MMA-Kampf bietet das Double-Leg an, auch ohne Bindestrich getippt");
    await tWahl.locator('[data-treffer="wrestling_double_leg"]').click();
    await tWahl.locator("input.goo-input").fill("Jab");
    await tWahl.locator('[data-treffer="boxing_jab"]').click();
    await page.waitForTimeout(300);
    sagt(
      (await zaehler(tWahl)) === "2 von 12" && (await tWahl.locator("[data-gewaehlt]").count()) === 2,
      "Stufe 3: zwei Techniken in der Phase, Zähler „2 von 12“",
    );
    // Das X der App nimmt eine wieder raus (components/ui/XKnopf).
    await tWahl
      .locator('[data-gewaehlt="wrestling_double_leg"] [data-aktion="wahl-raus-techniken"]')
      .click();
    await page.waitForTimeout(300);
    sagt(
      (await tWahl.locator("[data-gewaehlt]").count()) === 1 &&
        (await tWahl.locator('[data-gewaehlt="boxing_jab"]').count()) === 1,
      "Stufe 3: das X nimmt genau die angetippte Technik raus",
    );
    await uWahl.locator(".goo-pill").click();
    await uWahl.locator("input.goo-input").fill("Seilspringen");
    await uWahl.locator('[data-treffer="warmup_jump_rope"]').click();
    await page.waitForTimeout(300);
    sagt((await zaehler(uWahl)) === "1 von 12", "Stufe 3: Übung dazu, eigener Zähler");
    await phase2.screenshot({ path: `${OUT}/mess-a0-phase-wahl-${THEME}.png` });
    await editor.locator('[data-aktion="phase-speichern"]').click();
    await phase2.locator('[data-phasen-geaendert="specific-prep"]').waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    const p2Text = (await phase2.innerText()).toLowerCase();
    sagt(
      p2Text.includes("takedown-abwehr am zaun") && p2Text.includes("sparring nur mit kopfschutz") && p2Text.includes("3×") && p2Text.includes("25%"),
      "Plan: Ansicht zeigt Fokus, Notiz, 3× und 25 %",
    );
    sagt(p2Text.includes("geändert von mess trainer 2d · heute"), "Plan: „Geändert von Mess Trainer 2d · heute“");
    // Eng auf den Technik-Block gezielt: Im Drill „Sprawl nach Jab" steht das
    // Double Leg als Zweck — im Fließtext der Phase wäre die Prüfung blind.
    const tBlock = (await phase2.locator('[data-plan-techniken="specific-prep"]').innerText()).toLowerCase();
    const uBlock = (await phase2.locator('[data-plan-uebungen="specific-prep"]').innerText()).toLowerCase();
    sagt(
      tBlock.includes("geplante techniken") && tBlock.includes("jab") && !tBlock.includes("double leg"),
      "Stufe 3: aus „Empfohlene Techniken“ wird „Geplante Techniken“ mit dem Jab",
    );
    sagt(
      uBlock.includes("geplante übungen") && uBlock.includes("seilspringen"),
      "Stufe 3: „Geplante Übungen“ mit Seilspringen",
    );
    const phase1Text = (await page.locator("#plan-phase-foundation").innerText()).toLowerCase();
    sagt(
      !phase1Text.includes("geplante techniken"),
      "Stufe 3: die unberührte Phase 1 bleibt bei „Empfohlene“",
    );
    await phase2.screenshot({ path: `${OUT}/mess-d5-phase-gespeichert-${THEME}.png` });
    const campNeu = (await db.collection("users").doc(athletUid).collection("fightCamps").doc(neuId).get()).data();
    const [pa, pb] = campNeu.phases;
    sagt(
      pb.focus === "Takedown-Abwehr am Zaun" && pb.sessionsPerWeek === 3 && pb.sparringRatio === 0.25 && pb.notes === "Sparring nur mit Kopfschutz" &&
        pb.geaendert?.uid === trainerUid && pb.geaendert?.name === "Mess Trainer 2d" && pb.startsAt instanceof Timestamp,
      "Plan: Dokument trägt die Änderung an Phase 2 samt Autor, Datumsfelder bleiben Timestamps",
    );
    sagt(
      pb.techniqueIds.join() === "boxing_jab" && pb.exerciseIds.join() === "warmup_jump_rope",
      "Stufe 3: Dokument trägt genau die gewählten Listen (das Double Leg ging wieder raus)",
    );
    sagt(
      pa.techniqueIds.length === 0 && pa.exerciseIds.length === 0,
      "Stufe 3: die anderen Phasen behalten ihre Listen",
    );
    sagt(pa.focus === "Aufbau." && !pa.geaendert && campNeu.phases.length === 4 && campNeu.ownerIsStaff === false, "Plan: die anderen Phasen und ownerIsStaff unberührt");
    // Abbrechen ändert nichts
    const taper = page.locator("#plan-phase-taper");
    await taper.scrollIntoViewIfNeeded();
    await taper.locator('[data-aktion="phase-bearbeiten"]').click();
    await taper.locator('[data-phasen-editor="taper"] [data-feld="fokus"]').fill("Soll nicht gespeichert werden");
    await taper.getByRole("button", { name: "Abbrechen" }).click();
    await page.waitForTimeout(800);
    const taperDoc = (await db.collection("users").doc(athletUid).collection("fightCamps").doc(neuId).get()).data().phases[3];
    sagt((await page.locator("[data-phasen-editor]").count()) === 0 && taperDoc.focus === "Taper." && !taperDoc.geaendert, "Plan: Abbrechen schließt den Editor und speichert nichts");

    // ── Kampf verschoben, Stufe 2 (Fenster 12) ─────────────────────────────
    // Auf der Wettkampfseite VORGEZOGEN (40 → 25 Tage): Der Wettkampf bleibt
    // damit der nächste des Athleten, und die Phasen müssen schrumpfen.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-aktion="verschieben-oeffnen"]').click();
    const vEditor = page.locator("[data-verschieben-editor]");
    await vEditor.waitFor({ timeout: 15000 });
    sagt((await vEditor.locator("[data-vorschau-phase]").count()) === 4, "Verschieben: Vorschau zeigt alle vier Phasen");
    const schalter = vEditor.locator('[data-aktion="gameplan-neu"]');
    sagt(
      (await schalter.count()) === 1 && (await vEditor.innerText()).toLowerCase().includes("baut allein auf den beiden deepfight-profilen"),
      "Verschieben: Schalter „Gameplan gleich neu schreiben“ steht aus, Hilfstext erklärt warum",
    );
    const vorgezogen = new Date(Date.now() + 25 * 86_400_000);
    const feldWert = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await vEditor.locator('[data-feld="kampfdatum"]').fill(feldWert(vorgezogen));
    await page.waitForTimeout(600);
    const vorschauText = (await vEditor.locator("[data-verschieben-vorschau]").innerText()).toLowerCase();
    sagt(vorschauText.includes("→"), `Verschieben: Vorschau vergleicht alte und neue Länge (${vorschauText.split("\n").find((z) => z.includes("→"))?.trim() ?? "—"})`);
    await vEditor.screenshot({ path: `${OUT}/mess-12-verschieben-editor-${THEME}.png` });
    const planVorher = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${neuId}`).get()).data();
    await vEditor.locator('[data-aktion="verschieben-speichern"]').click();
    await page.locator("[data-verschoben]").waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200); // Collapse federt zu
    const verschobenCamp = await warteAuf(async () => {
      const d = (await db.collection("users").doc(athletUid).collection("fightCamps").doc(neuId).get()).data();
      return d?.verschoben ? d : null;
    }, 15000);
    const vPhasen = verschobenCamp?.phases ?? [];
    const spanne = (p) => Math.round((p.endsAt.toDate() - p.startsAt.toDate()) / 86_400_000);
    sagt(
      Math.abs(verschobenCamp.competitionDate.toDate() - vorgezogen) < 36 * 3600 * 1000 && verschobenCamp.weeksTotal === 4,
      `Verschieben: Camp trägt das neue Datum, weeksTotal ${verschobenCamp?.weeksTotal}`,
    );
    sagt(
      vPhasen.length === 4 &&
        vPhasen[0].startsAt.toDate().getTime() === verschobenCamp.startedAt.toDate().getTime() &&
        Math.abs(vPhasen[3].endsAt.toDate() - verschobenCamp.competitionDate.toDate()) < 1000 &&
        vPhasen.every((p, i) => i === 0 || p.startsAt.toDate().getTime() === vPhasen[i - 1].endsAt.toDate().getTime()),
      `Verschieben: Zeitachse ohne Lücke, letzte Phase endet auf dem Kampftag (${vPhasen.map(spanne).join("/")} Tage)`,
    );
    sagt(
      vPhasen[1].focus === "Takedown-Abwehr am Zaun" && vPhasen[1].notes === "Sparring nur mit Kopfschutz" &&
        vPhasen[1].sessionsPerWeek === 3 && vPhasen[1].sparringRatio === 0.25 && vPhasen[1].geaendert?.name === "Mess Trainer 2d",
      "Verschieben: Fokus, Notiz, Einheiten, Sparring und „Geändert von“ bleiben in Phase 2 stehen",
    );
    sagt(
      verschobenCamp.verschoben?.name === "Mess Trainer 2d" && verschobenCamp.verschoben?.uid === trainerUid &&
        Math.abs(verschobenCamp.verschoben.auf - verschobenCamp.competitionDate.toDate().getTime()) < 1000,
      "Verschieben: Marke trägt Autor, alten und neuen Termin",
    );
    const kopfText = (await page.locator("[data-verschoben]").innerText()).toLowerCase();
    sagt(kopfText.startsWith("verschoben vom") && kopfText.endsWith("heute"), `Verschieben: Kopf zeigt „${kopfText}“`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/mess-12-verschoben-kopf-${THEME}.png`, fullPage: false });
    await page.locator("#trainingsplan").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    sagt((await page.locator("[data-plan-verschoben]").count()) === 1, "Verschieben: der Trainingsplan nennt die Verschiebung ebenfalls");
    await page.screenshot({ path: `${OUT}/mess-12-verschoben-plan-${THEME}.png`, fullPage: false });
    const planNachVerschieben = (await db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${neuId}`).get()).data();
    sagt(
      planNachVerschieben?.status === "fertig" && planNachVerschieben?.eingabeSchluessel === planVorher?.eingabeSchluessel &&
        !planNachVerschieben?.gestartetAt && !planNachVerschieben?.usage,
      "Verschieben ohne Schalter: der Gameplan bleibt unberührt — kein Claude-Aufruf, keine Kosten",
    );

    // Schalter AN auf einem Wettkampf, dessen Gegner keine Daten hat: Die Route
    // läuft wirklich los, kommt aber ohne Claude bis „offen · gegner".
    const vCamp = db.collection("users").doc(athletUid).collection("fightCamps").doc();
    await vCamp.set(camp(athletUid, trainerUid, { name: "Mess Verschieben 12", sport: "mma", opponentId: leerId, opponentName: "Mess Gegner Leer", tage: 80 }));
    const vPlanRef = db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${vCamp.id}`);
    await vPlanRef.set({
      campId: vCamp.id, sport: "mma", status: "fertig",
      inhalt: { lage: "Stand vor dem Verschieben.", waffen: [{ titel: "Vorher", text: "Stand vor dem Verschieben.", beleg: "Scouting-Notiz" }], gefahren: [], soKaempfstDu: [], drills: [] },
      stand: null, geschriebenAt: new Date().toISOString(), gestartetAt: null, offen: null, fehler: null, model: "mess", usage: null, laufId: null, eingabeSchluessel: "mess",
    });
    await page.goto(`${BASE}/trainer/competitions/${athletUid}/${vCamp.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-aktion="verschieben-oeffnen"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.locator('[data-aktion="verschieben-oeffnen"]').click();
    const vEditor2 = page.locator("[data-verschieben-editor]");
    await vEditor2.waitFor({ timeout: 15000 });
    await vEditor2.locator('[data-feld="kampfdatum"]').fill(feldWert(new Date(Date.now() + 94 * 86_400_000)));
    await vEditor2.locator('[data-aktion="gameplan-neu"]').click();
    await page.waitForTimeout(400);
    sagt(
      (await vEditor2.innerText()).toLowerCase().includes("claude schreibt den gameplan nach dem speichern neu"),
      "Verschieben: Schalter an → der Hilfstext folgt der Wahl",
    );
    await vEditor2.locator('[data-aktion="verschieben-speichern"]').click();
    const vPlanNachher = await warteAuf(async () => {
      const d = (await vPlanRef.get()).data();
      return d?.status === "offen" ? d : null;
    }, 45000);
    const vCampNachher = (await vCamp.get()).data();
    sagt(vCampNachher?.weeksTotal === 14 && !!vCampNachher?.verschoben, `Verschieben: zwei Wochen später → ${vCampNachher?.weeksTotal} Wochen Plan`);
    sagt(
      vPlanNachher?.offen === "gegner" && vPlanNachher?.inhalt?.lage === "Stand vor dem Verschieben." && !vPlanNachher?.usage,
      `Verschieben mit Schalter: die Route läuft (→ „offen · ${vPlanNachher?.offen}“), Inhalt bleibt, kein Claude-Aufruf (Gegner ohne Daten)`,
    );

    // Bestand ohne Kampfart
    await page.goto(`${BASE}/trainer/competitions/${athletUid}/${bestandId}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-feld="kampfart-waehlen"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(3500);
    sagt((await page.locator("section#gameplan").innerText()).toLowerCase().includes("wähl oben die kampfart"), "Bestand: „Kampfart wählen“ + Hinweis im Gameplan");
    sagt((await page.locator('[data-feld="flaeche"]').count()) === 0, "Bestand ohne Kampfart: noch kein Flächen-Feld");
    await page.screenshot({ path: `${OUT}/mess-2d-bestand-${THEME}.png`, fullPage: false });

    // Bestand: Kampfart wählen → Fläche erscheint vorbelegt → Ring wählen
    const bestandRef = db.collection("users").doc(athletUid).collection("fightCamps").doc(bestandId);
    const planRef = db.collection("users").doc(athletUid).collection("fightProfile").doc(`gameplan-${bestandId}`);
    await waehle(page, '[data-feld="kampfart-waehlen"]', "MMA");
    await page.locator('[data-kampfart="mma"]').waitFor({ timeout: 30000 });
    await page.locator('[data-feld="flaeche"][data-flaeche="kaefig"]').waitFor({ timeout: 15000 });
    sagt(true, "Bestand: nach „MMA“ steht die Fläche vorbelegt auf Käfig");
    await warteAuf(async () => (await planRef.get()).data()?.status === "offen");
    await waehle(page, '[data-feld="flaeche"]', "Ring");
    await page.locator('[data-feld="flaeche"][data-flaeche="ring"]').waitFor({ timeout: 15000 });
    const campNachher = await warteAuf(async () => {
      const d = (await bestandRef.get()).data();
      return d?.flaeche === "ring" ? d : null;
    });
    sagt(campNachher?.sport === "mma" && campNachher?.flaeche === "ring", `Bestand: Camp trägt sport ${campNachher?.sport} + flaeche ${campNachher?.flaeche}`);
    const planNachher = await warteAuf(async () => {
      const d = (await planRef.get()).data();
      return d?.status === "offen" && d?.offen === "gegner" ? d : null;
    });
    sagt(!!planNachher && !planNachher.usage, `Bestand: Route schreibt „offen · ${planNachher?.offen}“ ohne Claude-Aufruf`);
    await page.screenshot({ path: `${OUT}/mess-5b-bestand-flaeche-${THEME}.png`, fullPage: false });

    // Gegnerprofil
    await page.goto(`${BASE}/trainer/deepfight/gegner/${gegnerId}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const profText = (await page.locator("main").last().innerText()).toLowerCase();
    sagt(profText.includes("käfig"), "Gegnerprofil: Käfig-Wörter (eine Kampfart, Fläche Käfig)");
    await page.screenshot({ path: `${OUT}/mess-2d-gegnerprofil-${THEME}.png`, fullPage: false });

    // ── Gameplan folgt dem Scouting zur Laufzeit (Fenster d5, echte Route) ──
    await page.goto(`${BASE}/trainer/deepfight/gegner/${scoutId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Bearbeiten" }).first().click();
    await page.getByLabel("Größe cm").fill("181");
    await page.getByRole("button", { name: "Speichern" }).first().click();
    tSpeichern = Date.now();
    const hinweis = page.locator('[data-gameplan-nachzug="1"]');
    await hinweis.waitFor({ timeout: 30000 });
    const hinweisText = (await hinweis.innerText()).toLowerCase();
    sagt(hinweisText.includes("in 90 sekunden neu") && hinweisText.includes("mess gegner scouting"), `Scouting: Hinweis nach dem Speichern (${Math.round((Date.now() - tSpeichern) / 100) / 10} s)`);
    await page.waitForTimeout(1000); // MorphSwap darunter federt nach
    await page.screenshot({ path: `${OUT}/mess-d5-scouting-gegner-${THEME}.png`, fullPage: false });
    const marke = await warteAuf(async () => {
      const d = (await scoutPlanRef.get()).data();
      return d?.aufschubId ? d : null;
    }, 15000);
    const bis = marke?.aufschubBis ? new Date(marke.aufschubBis).getTime() - tSpeichern : 0;
    sagt(!!marke && marke.status === "fertig" && bis > 80_000 && bis < 100_000, `Scouting: Marke am Gameplan, fällig in ${Math.round(bis / 1000)} s, Status ${marke?.status}`);
    await page.goto(`${BASE}/trainer/competitions/${athletUid}/${scoutCampId}`, { waitUntil: "domcontentloaded" });
    const aufschubZeile = page.locator("[data-gameplan-aufschub]");
    await aufschubZeile.waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    sagt((await aufschubZeile.innerText()).toLowerCase().includes("claude schreibt den gameplan gleich neu"), "Scouting: Wettkampfseite zeigt „Neues Scouting · Claude schreibt den Gameplan gleich neu“");
    await page.locator("section#gameplan").scrollIntoViewIfNeeded();
    await page.locator("section#gameplan").screenshot({ path: `${OUT}/mess-d5-scouting-block-${THEME}.png` });

    // Anlegen mit Vorbelegung
    await page.goto(`${BASE}/trainer/competitions/new?student=${athletUid}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-feld="kampfart"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(4000);
    const feld = (await page.locator('[data-feld="kampfart"]').innerText()).toLowerCase();
    sagt(feld.includes("mma"), `Anlegen: Kampfart vorbelegt (${feld.replace(/\s+/g, " ").trim()})`);
    const flaecheFeld = page.locator('[data-feld="flaeche"]');
    const flaecheText = (await flaecheFeld.count()) ? (await flaecheFeld.innerText()).toLowerCase() : "";
    const hilfe = (await page.locator("main").last().innerText()).toLowerCase();
    sagt(flaecheText.includes("käfig") && hilfe.includes("plant den kampf im käfig"), `Anlegen: Fläche folgt der Kampfart (${flaecheText.replace(/\s+/g, " ").trim()}) + Hilfstext`);
    await page.screenshot({ path: `${OUT}/mess-2d-anlegen-${THEME}.png`, fullPage: false });

    // Athlet: Dashboard-Karte → „Dein Gameplan" → Sheet (eigenes Konto, Client-SDK)
    const actx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: THEME });
    const apage = await actx.newPage();
    apage.on("console", (m) => { if (m.type() === "error") konsole.push(`[athlet] ${m.text()}`); });
    await anmelden(apage, ATHLET);
    await apage.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);
    await apage.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    const knopf = apage.locator('[data-aktion="gameplan-oeffnen"]');
    const planKnopf = apage.locator('[data-aktion="plan-oeffnen"]');
    await knopf.waitFor({ timeout: 60000 });
    await apage.waitForTimeout(1500);
    sagt((await planKnopf.count()) === 1, "Athlet: Wettkampf-Karte zeigt „Dein Trainingsplan“ und „Dein Gameplan“");
    await apage.screenshot({ path: `${OUT}/mess-d5-athlet-karte-${THEME}.png`, fullPage: false });

    // Trainingsplan im Sheet (Fenster d5)
    await planKnopf.click();
    const planSheet = apage.getByRole("dialog", { name: "Dein Trainingsplan" });
    await planSheet.waitFor({ timeout: 15000 });
    await apage.waitForTimeout(1200);
    const pText = (await planSheet.innerText()).toLowerCase();
    sagt(
      pText.includes("takedown-abwehr am zaun") && pText.includes("notiz von deinem trainer") && pText.includes("sparring nur mit kopfschutz"),
      "Athlet: Plan-Sheet zeigt Fokus und Notiz des Trainers",
    );
    sagt(pText.includes("geändert von mess trainer 2d · heute") && pText.includes("mma · käfig · gegen mess gegner käfig"), "Athlet: „Geändert von … · heute“ + Kopf „MMA · Käfig · gegen …“");
    const vZeile = planSheet.locator("[data-athlet-verschoben]");
    const vZeileText = (await vZeile.count()) ? (await vZeile.innerText()).toLowerCase() : "";
    sagt(
      vZeileText.includes("dein kampf ist jetzt am") && vZeileText.includes("mess trainer 2d hat ihn heute verschoben"),
      `Athlet: Verschiebung im Sheet („${vZeileText.replace(/\s+/g, " ").slice(0, 80)}…“)`,
    );
    sagt(
      (await planSheet.locator('[data-aktion="phase-bearbeiten"]').count()) === 0 && (await planSheet.locator("[data-reiter]").count()) === 2,
      "Athlet: nur lesen (kein „Bearbeiten“), zwei Reiter",
    );
    const aBlock = (await planSheet.locator('[data-plan-techniken="specific-prep"]').innerText()).toLowerCase();
    sagt(
      aBlock.includes("geplante techniken") && aBlock.includes("jab") &&
        (await planSheet.locator('[data-plan-uebungen="specific-prep"]').innerText()).toLowerCase().includes("seilspringen"),
      "Stufe 3 beim Athleten: „Geplante Techniken“ mit Jab, „Geplante Übungen“ mit Seilspringen",
    );
    const neuRef = db.collection("users").doc(athletUid).collection("fightCamps").doc(neuId);
    const neuDaten = (await neuRef.get()).data();
    neuDaten.phases[0].focus = "Live geändert d5.";
    await neuRef.update({ phases: neuDaten.phases });
    const live = await warteAuf(async () => (await planSheet.innerText()).includes("Live geändert d5."), 15000);
    sagt(!!live, "Athlet: Änderung am Plan erscheint LIVE im offenen Sheet");
    await apage.screenshot({ path: `${OUT}/mess-d5-athlet-plan-${THEME}.png`, fullPage: false });
    await apage.locator('[data-reiter="gameplan"]').click();
    const sheet = apage.getByRole("dialog", { name: "Dein Gameplan" });
    await sheet.waitFor({ timeout: 15000 });
    await apage.waitForTimeout(1200);
    const sText = (await sheet.innerText()).toLowerCase();
    sagt(sText.includes("deine waffen") && sText.includes("die gefahren") && sText.includes("so kämpfst du"), "Athlet: Sheet mit drei Blöcken");
    sagt(sText.includes("deine drills") && sText.includes("mma · käfig · gegen mess gegner käfig"), "Athlet: Drills + Kopf „MMA · Käfig · gegen …“");
    sagt(!sText.includes("neu schreiben"), "Athlet: nur lesen, kein „Neu schreiben“");
    await apage.screenshot({ path: `${OUT}/mess-5b-athlet-sheet-${THEME}.png`, fullPage: false });
    await actx.close();

    // Handy-Breite 390 px (bisher nicht gemessen)
    const hctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: THEME, hasTouch: true, isMobile: true });
    const hpage = await hctx.newPage();
    hpage.on("console", (m) => { if (m.type() === "error") konsole.push(`[handy] ${m.text()}`); });
    await anmelden(hpage, ATHLET);
    await hpage.evaluate((t) => localStorage.setItem("ta-theme", t), THEME);
    await hpage.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await hpage.locator('[data-aktion="plan-oeffnen"]').waitFor({ timeout: 60000 });
    await hpage.waitForTimeout(1200);
    await hpage.locator('[data-aktion="plan-oeffnen"]').click();
    const hSheet = hpage.getByRole("dialog", { name: "Dein Trainingsplan" });
    await hSheet.waitFor({ timeout: 15000 });
    await hpage.waitForTimeout(1500);
    const quer = await hpage.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      const els = d ? [d, ...d.querySelectorAll("*")] : [];
      return {
        seite: document.documentElement.scrollWidth - window.innerWidth,
        breiter: els.filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length,
      };
    });
    sagt(quer.seite <= 0 && quer.breiter === 0, `Handy 390 px: Plan-Sheet ohne Quer-Überlauf (Seite ${quer.seite}, Elemente rechts drüber ${quer.breiter})`);
    await hpage.screenshot({ path: `${OUT}/mess-d5-handy-plan-${THEME}.png`, fullPage: false });
    await hpage.locator('[data-reiter="gameplan"]').click();
    await hpage.waitForTimeout(1200);
    await hpage.screenshot({ path: `${OUT}/mess-d5-handy-gameplan-${THEME}.png`, fullPage: false });
    await hctx.close();

    // Scouting-Nachlauf fertig? Frühestens 90 s nach dem Speichern.
    const scoutFertig = await warteAuf(async () => {
      const d = (await scoutPlanRef.get()).data();
      return d?.status === "offen" && !d?.aufschubId ? d : null;
    }, Math.max(0, 100_000 - (Date.now() - tSpeichern)) + 40_000);
    const sek = Math.round((Date.now() - tSpeichern) / 1000);
    sagt(
      scoutFertig?.offen === "gegner" && scoutFertig?.inhalt?.lage === "Vorher-Stand Scouting." && !scoutFertig?.usage && sek >= 88,
      `Scouting zur Laufzeit: ${sek} s nach dem Speichern „offen · ${scoutFertig?.offen}“, Inhalt bleibt, kein Claude-Aufruf`,
    );

    const echt = konsole.filter((k) => !/favicon|Download the React DevTools/i.test(k));
    sagt(echt.length === 0, `Konsole ohne Fehler (${echt.length})`);
    if (echt.length) console.log(echt.slice(0, 6).join("\n"));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
