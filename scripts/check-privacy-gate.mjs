/**
 * Prüft das Gate `canAccessMemberData` EHRLICH: per Firestore-REST
 * mit echten ID-Tokens. Das Admin-SDK umgeht Regeln und beweist nichts.
 *
 * Aufbau: zwei Trainer (A, B) und ein Athlet (C) im Gym, alle mit
 * athleteProfile/main und fightProfile/main.
 *
 * SEIT DEM 03.09.2026 IST DIE FREIGABE NACH BEREICHEN GETRENNT (Leons
 * Revision, `users/{uid}.profileShares`, Schlüssel in lib/profile-sharing.ts).
 * Der Test prüft deshalb nicht mehr nur „gesperrt/frei", sondern auch, dass
 * ein Bereich den anderen NICHT mitöffnet — genau die Falle, die entstünde,
 * wenn der generische users-Wildcard `fightProfile` weiter mitdeckte.
 *
 * Erwartung:
 *   A liest C (Athlet)                          → 200
 *   A liest A (sich selbst)                     → 200
 *   A liest B (Kollege, privat)                 → 403
 *   B gibt A NUR „athlet" frei                  → Profil 200, Kampfprofil 403
 *   B gibt A zusätzlich „deepfight" frei        → Kampfprofil 200
 *   B nimmt alles zurück                        → wieder 403
 *   C (Athlet) liest B                          → 403
 *   Der Inhaber schreibt seine Freigabe selbst  → 200
 *   Der Inhaber schreibt sich ein Recht         → 403
 *
 * SEIT SCHRITT 2b (04.09.2026) STEHEN DIE WETTKÄMPFE MIT DRIN. Sie waren die
 * Ausnahme: `match /{path=**}/fightCamps/{campId}` matchte auch den direkten
 * Pfad und prüfte dort nur `sameGym` — die großzügigere Regel gewann, jeder
 * Trainer las jedes Camp. Geschlossen mit einem materialisierten
 * `ownerIsStaff` am Camp (lib/fight-camp.ts). Geprüft wird deshalb beides:
 * der EINZELZUGRIFF wie bei den anderen Bereichen UND die gym-weite
 * collectionGroup-Query, die den Fix überhaupt erst nötig machte.
 *
 *   A liest C-Camp (Athlet)                     → 200
 *   A liest B-Camp ohne Freigabe                → 403   (war 200)
 *   nur athlet frei → B-Camp                    → 403   (Bereichstrennung)
 *   wettkampf frei  → B-Camp                    → 200
 *   gym-weite Query mit ownerIsStaff==false     → nur das Athleten-Camp
 *   gym-weite Query OHNE den Filter             → 403   (Regel greift)
 *   A setzt am eigenen Camp ownerIsStaff:false  → 403   (Schreibvergleich)
 *   A ändert am eigenen Camp den Namen          → 200   (Gegenprobe)
 *
 * Danach alles löschen und Bestand zählen.
 */
import { readFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";
import { claimsWithRights, rightsMirror } from "./lib/role-claims.mjs";

const GYM = "tidal-athletics";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "ironfight-mma";
if (!API_KEY) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY fehlt in .env.local");

initAdmin();
const auth = getAuth();
const db = getFirestore();
const before = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
console.log(`Vorher: ${before.auth} Auth-Konten, ${before.docs} users-Dokumente`);

const pw = `gate-${Math.random().toString(36).slice(2)}A1!`;
const konten = {
  A: { email: "gate-a@tidal-athletics.invalid", rights: { trainer: true, verwaltung: false, admin: false }, name: "Trainer A" },
  B: { email: "gate-b@tidal-athletics.invalid", rights: { trainer: true, verwaltung: false, admin: false }, name: "Trainer B" },
  C: { email: "gate-c@tidal-athletics.invalid", rights: { trainer: false, verwaltung: false, admin: false }, name: "Athlet C" },
};
const uids = {};
const campIds = {};
let fehler = 0;
try {
  for (const [k, v] of Object.entries(konten)) {
    const u = await auth.createUser({ email: v.email, password: pw, displayName: v.name });
    uids[k] = u.uid;
    await auth.setCustomUserClaims(u.uid, claimsWithRights({ gymId: GYM }, v.rights));
    await db.collection("users").doc(u.uid).set({
      email: v.email, displayName: v.name, gymId: GYM, ...rightsMirror(v.rights), createdAt: new Date(),
    });
    await db.collection("users").doc(u.uid).collection("athleteProfile").doc("main").set({ level: "beginner" });
    await db.collection("users").doc(u.uid).collection("fightProfile").doc("main").set({ dna: {} });
    // Ein Wettkampf je Konto. `ownerIsStaff` spiegelt die Rechte — genau das,
    // was der Backfill und beide Schreibstellen in lib/fight-camp.ts tun.
    const camp = await db.collection("users").doc(u.uid).collection("fightCamps").add({
      studentUid: u.uid,
      gymId: GYM,
      ownerIsStaff: v.rights.trainer || v.rights.verwaltung || v.rights.admin,
      createdBy: u.uid,
      competitionName: `Testkampf ${k}`,
      competitionDate: new Date(Date.now() + 30 * 864e5),
      startedAt: new Date(),
      weeksTotal: 4,
      status: "active",
      opponent: { name: "Prüfgegner", style: "striker", stance: "orthodox", strengths: [], weaknesses: [], favoriteAttacks: [] },
      phases: [],
    });
    campIds[k] = camp.id;
  }

  async function token(k) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: konten[k].email, password: pw, returnSecureToken: true }),
    });
    const j = await r.json();
    if (!j.idToken) throw new Error(`Login ${k}: ${JSON.stringify(j.error ?? j)}`);
    return j.idToken;
  }
  async function lese(alsK, zielK, pfad = "athleteProfile/main") {
    const t = await token(alsK);
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids[zielK]}/${pfad}`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${t}` } });
    return r.status;
  }
  /** Der Inhaber schreibt SELBST an seinem users-Dokument — per REST, mit
      updateMask, damit nur genau dieses Feld angefasst wird. */
  async function schreibeSelbst(alsK, felder) {
    const t = await token(alsK);
    const maske = Object.keys(felder).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids[alsK]}?${maske}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ fields: felder }),
    });
    return r.status;
  }
  /** `profileShares` als Firestore-REST-Wert: Map von Bereich → Array<uid>. */
  const sharesWert = (map) => ({
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(map).map(([bereich, liste]) => [
          bereich,
          { arrayValue: { values: liste.map((u) => ({ stringValue: u })) } },
        ]),
      ),
    },
  });
  /**
   * Freigabe per Admin-SDK setzen (schneller Aufbau eines Zustands).
   *
   * ALLE DREI BEREICHE STEHEN IMMER AUSDRÜCKLICH DRIN — auch die leeren.
   * `set(..., { merge: true })` mergt eine Map FELDWEISE: Ein Aufruf mit nur
   * `{ wettkampf: [...] }` ließ die vorher gesetzte `athlet`-Freigabe stehen,
   * und der Test meldete daraufhin einen Zugriff als Lücke, den er selbst
   * erlaubt hatte (gemessen 04.09.2026). Dieselbe Falle wie beim
   * users-Rechte-Spiegel in lib/roles.ts, und dieselbe Lösung.
   */
  const setzeShares = (k, map) =>
    db.collection("users").doc(uids[k]).set(
      { profileShares: { athlet: [], deepfight: [], wettkampf: [], ...map } },
      { merge: true },
    );

  /** Ein Camp direkt lesen — derselbe Weg wie `getFightCamp`. */
  const leseCamp = (alsK, zielK) => lese(alsK, zielK, `fightCamps/${campIds[zielK]}`);

  /**
   * Die gym-weite collectionGroup-Query per REST — genau die Abfrage, die
   * `listAllFightCamps` stellt. Sie ist der eigentliche Grund für
   * `ownerIsStaff`: Eine Query kann keinen get() aufs Eltern-Dokument machen.
   *
   * Rückgabe: { status, ids } — bei 200 die Camp-IDs, die durchkamen.
   * Ein fehlender Index meldet sich als 400, nicht als 403; die beiden
   * auseinanderzuhalten ist der halbe Wert dieser Prüfung.
   */
  async function gymWeiteCampQuery(alsK, mitOwnerFilter) {
    const t = await token(alsK);
    const filters = [
      { fieldFilter: { field: { fieldPath: "gymId" }, op: "EQUAL", value: { stringValue: GYM } } },
    ];
    if (mitOwnerFilter) {
      filters.push({
        fieldFilter: { field: { fieldPath: "ownerIsStaff" }, op: "EQUAL", value: { booleanValue: false } },
      });
    }
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
    const r = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "fightCamps", allDescendants: true }],
          where: { compositeFilter: { op: "AND", filters } },
          // Die Sortierung gehört DAZU, nicht weg: Genau so fragt
          // listAllFightCamps, und nur so trifft die Abfrage einen Index, den
          // es gibt. Ohne orderBy verlangt Firestore einen eigenen
          // COLLECTION_GROUP-Index auf gymId — der Lauf endet dann in 400
          // („requires an index"), und ein 400 beweist über die REGELN nichts.
          orderBy: [{ field: { fieldPath: "competitionDate" }, direction: "DESCENDING" }],
        },
      }),
    });
    if (r.status !== 200) {
      const text = await r.text();
      return { status: r.status, ids: [], hinweis: text.slice(0, 160) };
    }
    const rows = await r.json();
    const ids = (Array.isArray(rows) ? rows : [])
      .filter((row) => row.document)
      .map((row) => row.document.name.split("/").pop());
    return { status: 200, ids };
  }

  const erwarte = (bez, ist, soll) => {
    if (ist !== soll) fehler += 1;
    console.log(`${ist === soll ? "✓" : "✗"} ${bez.padEnd(50)} → ${ist}  (erwartet ${soll})`);
  };

  console.log("\nGATE canAccessMemberData — per REST:");
  erwarte("A (Trainer) liest C (Athlet)", await lese("A", "C"), 200);
  erwarte("A liest sich selbst", await lese("A", "A"), 200);
  erwarte("A liest B (Kollege, privat)", await lese("A", "B"), 403);
  erwarte("A liest B/fightProfile (privat)", await lese("A", "B", "fightProfile/main"), 403);
  erwarte("C (Athlet) liest B", await lese("C", "B"), 403);
  erwarte("A liest B users-Dokument (Identität)", await lese("A", "B", ""), 200);

  // ─── Bereiche sind getrennt (Leons Revision 03.09.) ──────────────────────
  console.log("\nBEREICHE — eine Freigabe öffnet NUR ihren Bereich:");
  await setzeShares("B", { athlet: [uids.A] });
  erwarte("nur athlet frei → Athletenprofil", await lese("A", "B"), 200);
  erwarte("nur athlet frei → Kampfprofil", await lese("A", "B", "fightProfile/main"), 403);

  await setzeShares("B", { athlet: [uids.A], deepfight: [uids.A] });
  erwarte("auch deepfight frei → Kampfprofil", await lese("A", "B", "fightProfile/main"), 200);

  await setzeShares("B", { athlet: [], deepfight: [uids.A] });
  erwarte("athlet zurückgenommen → Athletenprofil", await lese("A", "B"), 403);
  erwarte("deepfight bleibt → Kampfprofil", await lese("A", "B", "fightProfile/main"), 200);

  erwarte("C liest B trotz Freigabe an A", await lese("C", "B"), 403);

  // ─── Wer die Liste pflegen darf (Schritt 2, der Freigabe-Knopf) ──────────
  //
  // ACHTUNG, TEUER GELERNT (03.09.2026): `affectedKeys()` in den Regeln
  // enthaelt NUR Felder, die sich tatsaechlich AENDERN. Ein Schreibvorgang mit
  // dem bereits gespeicherten Wert ist ein No-Op — `affectedKeys()` ist dann
  // leer, `hasAny([...])` liefert false und `hasOnly([...])` sogar true. Ein
  // erster Anlauf dieses Tests schrieb genau solche No-Ops und meldete
  // freudig 200, wo er 403 erwartete. Jede Zeile hier muss deshalb einen Wert
  // setzen, den das Zieldokument NICHT schon traegt.
  console.log("\nSCHREIBRECHT am eigenen users-Dokument:");
  erwarte(
    "B setzt seine eigene Freigabe",
    await schreibeSelbst("B", { profileShares: sharesWert({ athlet: [uids.A] }) }),
    200,
  );
  erwarte(
    // C ist Athlet und traegt trainer:false — das hier ist eine ECHTE Aenderung.
    "C setzt sich selbst das Trainer-Recht",
    await schreibeSelbst("C", { trainer: { booleanValue: true } }),
    403,
  );
  erwarte(
    "A setzt die Freigabe von B (fremdes Dokument)",
    await (async () => {
      const t = await token("A");
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids.B}?updateMask.fieldPaths=profileShares`;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ fields: { profileShares: sharesWert({ athlet: [uids.C] }) } }),
      });
      return r.status;
    })(),
    403,
  );

  // ─── Wettkämpfe (Schritt 2b, 04.09.2026) ────────────────────────────────
  //
  // Vor dem Fix las A das Camp von B mit 200 — ohne Freigabe, und auch die
  // erteilte Freigabe änderte nichts. Beides steht hier als Zeile.
  console.log("\nWETTKÄMPFE — Einzelzugriff:");
  await setzeShares("B", {});
  erwarte("A liest C-Camp (Athlet)", await leseCamp("A", "C"), 200);
  erwarte("A liest sein eigenes Camp", await leseCamp("A", "A"), 200);
  erwarte("A liest B-Camp (Kollege, privat)", await leseCamp("A", "B"), 403);

  await setzeShares("B", { athlet: [uids.A], deepfight: [uids.A] });
  erwarte("athlet+deepfight frei → B-Camp", await leseCamp("A", "B"), 403);

  await setzeShares("B", { wettkampf: [uids.A] });
  erwarte("wettkampf frei → B-Camp", await leseCamp("A", "B"), 200);
  erwarte("wettkampf frei → B-Athletenprofil", await lese("A", "B"), 403);

  await setzeShares("B", {});
  erwarte("Freigabe zurück → B-Camp", await leseCamp("A", "B"), 403);

  console.log("\nWETTKÄMPFE — die gym-weite Query:");
  const mitFilter = await gymWeiteCampQuery("A", true);
  erwarte("Query mit ownerIsStaff==false", mitFilter.status, 200);
  if (mitFilter.status !== 200) console.log(`    Hinweis: ${mitFilter.hinweis}`);
  erwarte(
    "… liefert das Athleten-Camp",
    mitFilter.ids.includes(campIds.C),
    true,
  );
  erwarte(
    "… und KEINES der beiden Trainer-Camps",
    mitFilter.ids.includes(campIds.A) || mitFilter.ids.includes(campIds.B),
    false,
  );
  const ohneFilter = await gymWeiteCampQuery("A", false);
  erwarte("Query OHNE den Filter wird abgewiesen", ohneFilter.status, 403);

  // ─── Der Schreibvergleich (ownerIsStaffStimmt) ──────────────────────────
  //
  // Ohne ihn könnte jemand mit Wettkampf-Freigabe ein fremdes Camp auf
  // ownerIsStaff:false setzen und es damit gym-weit sichtbar machen. A ist
  // Stab-Konto — `false` an seinem eigenen Camp ist also eine Lüge.
  // ACHTUNG No-Op-Falle: Beide Werte unten ändern das Dokument wirklich.
  console.log("\nWETTKÄMPFE — Schreibvergleich am Camp:");
  async function schreibeCamp(alsK, zielK, felder) {
    const t = await token(alsK);
    const maske = Object.keys(felder).map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uids[zielK]}/fightCamps/${campIds[zielK]}?${maske}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ fields: felder }),
    });
    return r.status;
  }
  erwarte(
    "A setzt am eigenen Camp ownerIsStaff:false",
    await schreibeCamp("A", "A", { ownerIsStaff: { booleanValue: false } }),
    403,
  );
  erwarte(
    "A ändert am eigenen Camp den Namen",
    await schreibeCamp("A", "A", { competitionName: { stringValue: "Umbenannt" } }),
    200,
  );
} finally {
  for (const uid of Object.values(uids)) {
    await db.recursiveDelete(db.collection("users").doc(uid));
    await auth.deleteUser(uid);
  }
  const after = { auth: (await auth.listUsers(1000)).users.length, docs: (await db.collection("users").get()).size };
  console.log(`\nAufgeräumt: ${after.auth} / ${after.docs} ${after.auth === before.auth && after.docs === before.docs ? "✓ wie vorher" : "✗ ABWEICHUNG"}`);
  console.log(fehler === 0 ? "ALLE PRÜFUNGEN BESTANDEN ✓" : `${fehler} PRÜFUNG(EN) FEHLGESCHLAGEN ✗`);
}
