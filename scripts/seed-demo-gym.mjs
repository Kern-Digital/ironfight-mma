/**
 * Demo-Mitglieder für ein Gym anlegen — Kurs-Abos und Teilnahmen inklusive.
 *
 * WOZU: Die Übersichtsseiten (Trainer, Verwaltung, Plattform) rechnen mit
 * echten Abfragen. Ohne Daten zeigen sie überall Null, und dann lässt sich
 * weder das Aussehen beurteilen noch die Rechnung prüfen. Leons Ansage
 * 2026-09-01: „lege einfach Fake-Schüler an mit Fake-Daten … dann baue die
 * Anzeige gleich richtig und füttere sie mit den vorliegenden Fake-Daten."
 *
 * ES ENTSTEHEN KEINE AUTH-KONTEN, nur `users/{uid}`-Dokumente. Niemand meldet
 * sich als Demo-Mitglied an — für Listen, Zählungen und Kennzahlen reicht das
 * Dokument. Das hält die Anmeldung sauber und macht das Aufräumen trivial:
 * Alle Demo-UIDs tragen dasselbe Präfix.
 *
 * Aufruf (PowerShell, im Projektordner):
 *   node scripts/seed-demo-gym.mjs            30 Mitglieder anlegen
 *   node scripts/seed-demo-gym.mjs --count 50
 *   node scripts/seed-demo-gym.mjs --clear    alle Demo-Mitglieder entfernen
 *   node scripts/seed-demo-gym.mjs --gym anderes-gym
 *
 * DIE KURSLISTE WIRD AUS lib/schedule.ts GELESEN, nicht hier wiederholt: Eine
 * zweite Liste wäre die, die beim nächsten neuen Kurs vergessen wird.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { rightsMirror } from "./lib/role-claims.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const GYM_ID = value("--gym", "tidal-athletics");
const COUNT = Number(value("--count", "30"));
const CLEAR = flag("--clear");
/** Alle Demo-Dokumente tragen dieses Präfix — daran hängt das Aufräumen. */
const UID_PREFIX = "demo-";
/** Über so viele Wochen zurück werden Teilnahmen gestreut. */
const WEEKS_BACK = 14;

// ─── Kurse aus lib/schedule.ts ──────────────────────────────────────────────

function readBlocks() {
  const src = readFileSync(resolve(process.cwd(), "lib/schedule.ts"), "utf8");
  const blocks = [];
  const re =
    /\{\s*id:\s*"([^"]+)",\s*weekday:\s*(\d+),\s*title:\s*"([^"]+)",\s*startTime:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    blocks.push({ id: m[1], weekday: Number(m[2]), title: m[3], startTime: m[4] });
  }
  return blocks;
}

// ─── Wochenkennung ──────────────────────────────────────────────────────────

/**
 * ZEICHENGLEICH ZU `getWeekIdentifier` in lib/schedule.ts. Sie muss es sein:
 * Die Teilnahme-ID lautet `${blockId}_${weekIdentifier}`, und eine abweichende
 * Rechnung erzeugte Dokumente, die die App nie wiederfindet. Node kann kein TS
 * importieren — deshalb diese Zwillingsfassung, wie bei role-claims.mjs.
 */
function weekIdentifier(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ─── Namen ──────────────────────────────────────────────────────────────────

const VORNAMEN = [
  "Lena", "Jonas", "Mira", "Elias", "Sina", "Noah", "Alina", "Finn", "Nele",
  "Luca", "Emilia", "Ben", "Frieda", "Jakob", "Maja", "Theo", "Ida", "Paul",
  "Clara", "Anton", "Romy", "Til", "Hanna", "Milo", "Greta", "Bruno", "Nora",
  "Levi", "Zoe", "Matt", "Yara", "Kian", "Selma", "Arne", "Juna", "Tarek",
];
const NACHNAMEN = [
  "Berger", "Hoffmann", "Krause", "Lorenz", "Neumann", "Pohl", "Richter",
  "Schäfer", "Vogel", "Wagner", "Zimmer", "Brandt", "Engel", "Fuchs",
  "Gruber", "Hein", "Jansen", "Keller", "Marx", "Ott", "Reuter", "Sauer",
];

/**
 * Deterministischer Pseudo-Zufall: Derselbe Aufruf liefert dieselbe Zahl.
 * So erzeugt ein zweiter Lauf dieselben Mitglieder statt einer zweiten Charge —
 * der Seeder ist idempotent, und die Kennzahlen springen nicht bei jedem Lauf.
 */
function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const pick = (arr, seed) => arr[Math.floor(rand(seed) * arr.length) % arr.length];

// ─── Aufräumen ──────────────────────────────────────────────────────────────

async function clearDemo(db) {
  const snap = await db.collection("users").get();
  const demo = snap.docs.filter((d) => d.id.startsWith(UID_PREFIX));
  if (demo.length === 0) {
    console.log("Keine Demo-Mitglieder gefunden.");
    return;
  }
  let subDocs = 0;
  for (const d of demo) {
    for (const sub of ["participations", "subscriptions"]) {
      const s = await d.ref.collection(sub).get();
      subDocs += s.size;
      // Batches à 400 — Firestore erlaubt 500 Schreibvorgänge pro Batch.
      for (let i = 0; i < s.docs.length; i += 400) {
        const batch = db.batch();
        for (const doc of s.docs.slice(i, i + 400)) batch.delete(doc.ref);
        await batch.commit();
      }
    }
    await d.ref.delete();
  }
  console.log(`Entfernt: ${demo.length} Demo-Mitglieder, ${subDocs} Unterdokumente.`);
}

// ─── Anlegen ────────────────────────────────────────────────────────────────

async function seed(db, blocks) {
  const now = new Date();
  const rights = { trainer: false, verwaltung: false, admin: false };
  const mirror = rightsMirror(rights);

  let members = 0;
  let subs = 0;
  let parts = 0;

  for (let i = 0; i < COUNT; i++) {
    const uid = `${UID_PREFIX}${String(i + 1).padStart(3, "0")}`;
    const vorname = pick(VORNAMEN, i + 1);
    const nachname = pick(NACHNAMEN, i * 7 + 3);
    // Beitritt gestreut über die letzten acht Monate — sonst wäre die Kurve
    // „neue Mitglieder je Monat" eine einzige Säule.
    const joinedDaysAgo = Math.floor(rand(i * 3 + 11) * 240);
    const joinedAt = new Date(now.getTime() - joinedDaysAgo * 86400000);

    await db.collection("users").doc(uid).set(
      {
        displayName: `${vorname} ${nachname}`,
        email: `${vorname.toLowerCase()}.${nachname.toLowerCase()}@demo.invalid`,
        gymId: GYM_ID,
        gymJoinedAt: Timestamp.fromDate(joinedAt),
        createdAt: Timestamp.fromDate(joinedAt),
        // Damit sofort erkennbar ist, was Demo ist und was echte Mitglieder
        // sind — und damit `--clear` nicht die einzige Sicherung bleibt.
        isDemo: true,
        ...mirror,
      },
      { merge: true },
    );
    members++;

    // Ein bis drei Stammkurse. Wer nur einen hat, kommt seltener — das ist
    // gewollt: Eine Kennzahl, in der alle gleich fleißig sind, sagt nichts.
    const courseCount = 1 + Math.floor(rand(i * 5 + 2) * 3);
    const mine = [];
    for (let c = 0; c < courseCount; c++) {
      mine.push(blocks[Math.floor(rand(i * 13 + c * 29 + 7) * blocks.length)]);
    }

    for (const block of mine) {
      await db
        .collection("users").doc(uid)
        .collection("subscriptions").doc(block.id)
        .set({
          trainingBlockId: block.id,
          blockTitle: block.title,
          weekday: block.weekday,
          startTime: block.startTime,
          subscribedAt: Timestamp.fromDate(joinedAt),
        });
      subs++;
    }

    // Verlässlichkeit je Mitglied: zwischen 25 % und 95 %. Daraus entsteht die
    // Streuung, die eine Kennzahl überhaupt erst lesenswert macht.
    const reliability = 0.25 + rand(i * 17 + 5) * 0.7;

    for (let w = 0; w < WEEKS_BACK; w++) {
      const weekStart = new Date(now.getTime() - w * 7 * 86400000);
      // Vor dem Beitritt gibt es keine Teilnahme.
      if (weekStart < joinedAt) continue;
      const weekId = weekIdentifier(weekStart);

      for (const block of mine) {
        if (rand(i * 101 + w * 31 + block.weekday * 7) > reliability) continue;
        const day = new Date(weekStart);
        // Auf den Wochentag des Kurses schieben (0 = Montag).
        const shift = block.weekday - ((day.getDay() + 6) % 7);
        day.setDate(day.getDate() + shift);
        if (day > now) continue;
        const [h, min] = block.startTime.split(":").map(Number);
        day.setHours(h, min, 0, 0);

        const sessionId = `${block.id}_${weekId}`;
        await db
          .collection("users").doc(uid)
          .collection("participations").doc(sessionId)
          .set({
            trainingSessionId: sessionId,
            trainingBlockId: block.id,
            blockTitle: block.title,
            weekIdentifier: weekId,
            joinedAt: Timestamp.fromDate(day),
            // OHNE DAS ZÄHLT DIE TEILNAHME IN KEINER KENNZAHL — die
            // collectionGroup-Abfrage sieht den Elternpfad nicht (Begründung
            // an `Participation.gymId` in lib/types.ts).
            gymId: GYM_ID,
          });
        parts++;
      }
    }
    process.stdout.write(`\r  ${i + 1}/${COUNT} Mitglieder …`);
  }
  process.stdout.write("\n");
  console.log(`Angelegt: ${members} Mitglieder, ${subs} Kurs-Abos, ${parts} Teilnahmen.`);
}

// ─── Ablauf ─────────────────────────────────────────────────────────────────

async function main() {
  const { projectId, source } = initAdmin();
  console.log(`Admin-SDK: ${projectId} (Credentials aus ${source})`);
  const db = getFirestore();

  const before = (await db.collection("users").get()).size;
  console.log(`Vorher: ${before} users-Dokumente`);

  if (CLEAR) {
    await clearDemo(db);
  } else {
    const blocks = readBlocks();
    if (blocks.length === 0) {
      console.error("Keine Kurse in lib/schedule.ts gefunden — Muster geprüft?");
      process.exit(1);
    }
    console.log(`Kurse aus lib/schedule.ts: ${blocks.length}`);
    await seed(db, blocks);
  }

  const after = (await db.collection("users").get()).size;
  console.log(`Nachher: ${after} users-Dokumente`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
