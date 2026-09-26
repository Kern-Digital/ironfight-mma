/**
 * Test: die Einstiegs-Drills und ihr Glossar — rein, ohne Browser und ohne Netz.
 *
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/test-einstiegs-drills.mjs
 *
 * Prüft zwei Sorten von Regeln:
 *
 * STRUKTUR — was brechen würde, wenn es fehlt:
 *   • Jeder Drill trägt role "drill" und level "anfaenger", IDs und Slugs sind
 *     eindeutig, jede verwandte und jede nächste Technik lässt sich auflösen.
 *   • Jede Glossar-Markierung trifft einen Begriff.
 *   • MARKIERUNGEN NUR IN `whyItMatters` UND `description`. Alle anderen Felder
 *     erscheinen an Stellen ohne Glossar-Rahmen — bis in die Seiten-Metadaten.
 *     Genau das ist beim Bau einmal passiert ({{sprawl}} stand in `usage`).
 *   • Jeder Drill hat eine planbare Hülle in lib/exercises.ts.
 *
 * STIMME — die Regeln aus .claude/skills/tidal-stimme, soweit eine Maschine
 * sie sehen kann:
 *   • Kein Ausrufezeichen.
 *   • Kein „ihr/euch/euer" — die App spricht EINE Person an.
 *   • Kein „nicht X, sondern Y". Leon nennt diese Wendung künstlich.
 *   • Kein typischer Fehler, der mit „Du" beginnt: Der Mangel gehört nie dem
 *     Leser, ein Fehler steht als Sache da.
 *   • Kein Satzbaustein zweimal über alle Drills hinweg.
 */

import { DRILL_TECHNIQUES } from "../lib/techniques/drills.ts";
import { ALL_TECHNIQUES } from "../lib/techniques/index.ts";
import { GLOSSAR, getBegriff, zerlegeText } from "../lib/glossar.ts";
import { EXERCISES } from "../lib/exercises.ts";

let fehler = 0;
const sagt = (ok, text) => {
  if (!ok) fehler += 1;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

const MARKIERUNG = /\{\{([a-z0-9-]+)(?:\|([^}]*))?\}\}/g;
/** Die Felder, die ein Glossar-Rahmen umgibt. Alle anderen zeigen roh an. */
const MIT_GLOSSAR = new Set(["whyItMatters", "description"]);

/** Jedes sichtbare Textstück eines Drills, mit dem Feld, aus dem es stammt. */
function texte(t) {
  const raus = [];
  const nimm = (feld, wert) => {
    if (typeof wert === "string") raus.push({ feld, text: wert });
    else if (Array.isArray(wert))
      wert.forEach((w) => typeof w === "string" && raus.push({ feld, text: w }));
  };
  for (const feld of [
    "name",
    "whyItMatters",
    "description",
    "steps",
    "commonMistakes",
    "usage",
    "coachingCues",
    "safetyNotes",
    "useCases",
    "subCategory",
  ]) {
    nimm(feld, t[feld]);
  }
  return raus;
}

console.log(`\n═══ Einstiegs-Drills (${DRILL_TECHNIQUES.length}) ═══\n`);

// ── Struktur ───────────────────────────────────────────────────────────────
console.log("── Struktur ──");

sagt(DRILL_TECHNIQUES.length === 12, `12 Drills vorhanden (${DRILL_TECHNIQUES.length})`);

const jeKampfart = {};
for (const d of DRILL_TECHNIQUES) jeKampfart[d.category] = (jeKampfart[d.category] ?? 0) + 1;
for (const cat of ["boxing", "wrestling", "bjj", "muay-thai"]) {
  sagt(jeKampfart[cat] === 3, `${cat}: 3 Drills (${jeKampfart[cat] ?? 0})`);
}

const ids = new Set();
const slugs = new Set();
for (const d of DRILL_TECHNIQUES) {
  if (ids.has(d.id)) sagt(false, `ID doppelt: ${d.id}`);
  ids.add(d.id);
  const key = `${d.category}/${d.slug}`;
  if (slugs.has(key)) sagt(false, `Slug doppelt: ${key}`);
  slugs.add(key);
}
sagt(ids.size === DRILL_TECHNIQUES.length, `IDs eindeutig (${ids.size})`);
sagt(slugs.size === DRILL_TECHNIQUES.length, `Slugs eindeutig je Kampfart (${slugs.size})`);

const rollen = DRILL_TECHNIQUES.filter((d) => d.role === "drill").length;
sagt(rollen === DRILL_TECHNIQUES.length, `alle tragen role "drill" (${rollen})`);
const stufen = DRILL_TECHNIQUES.filter(
  (d) => d.level === "anfaenger" && d.difficulty === "anfaenger",
).length;
sagt(stufen === DRILL_TECHNIQUES.length, `alle auf Stufe Anfänger (${stufen})`);

const alleIds = new Set(ALL_TECHNIQUES.map((t) => t.id));
let toteBezuege = 0;
for (const d of DRILL_TECHNIQUES) {
  for (const rid of d.relatedTechniqueIds ?? []) {
    if (!alleIds.has(rid)) {
      toteBezuege += 1;
      console.log(`       ${d.id} → verwandt ${rid} gibt es nicht`);
    }
  }
  if (d.nextTechniqueId && !alleIds.has(d.nextTechniqueId)) {
    toteBezuege += 1;
    console.log(`       ${d.id} → nächste ${d.nextTechniqueId} gibt es nicht`);
  }
}
sagt(toteBezuege === 0, `keine toten Technik-Bezüge (${toteBezuege})`);

const imIndex = DRILL_TECHNIQUES.filter((d) => alleIds.has(d.id)).length;
sagt(imIndex === DRILL_TECHNIQUES.length, `alle im Technik-Index eingehängt (${imIndex})`);

// ── Glossar ────────────────────────────────────────────────────────────────
console.log("\n── Glossar ──");

let markierungenGesamt = 0;
let unbekannt = 0;
let amFalschenOrt = 0;
for (const d of DRILL_TECHNIQUES) {
  for (const { feld, text } of texte(d)) {
    const muster = new RegExp(MARKIERUNG.source, "g");
    let treffer;
    while ((treffer = muster.exec(text)) !== null) {
      markierungenGesamt += 1;
      if (!MIT_GLOSSAR.has(feld)) {
        amFalschenOrt += 1;
        console.log(`       ${d.id}: {{${treffer[1]}}} steht in "${feld}" — dort gibt es keinen Glossar-Rahmen`);
      }
      if (!getBegriff(treffer[1])) {
        unbekannt += 1;
        console.log(`       ${d.id}: {{${treffer[1]}}} kennt das Glossar nicht`);
      }
    }
  }
}
sagt(markierungenGesamt > 0, `${markierungenGesamt} Markierungen gefunden`);
sagt(unbekannt === 0, `jede Markierung trifft einen Begriff (${unbekannt} tot)`);
sagt(amFalschenOrt === 0, `Markierungen nur in whyItMatters und description (${amFalschenOrt} daneben)`);

let toteQuerverweise = 0;
for (const g of GLOSSAR) {
  for (const s of g.siehe ?? []) {
    if (!getBegriff(s)) {
      toteQuerverweise += 1;
      console.log(`       ${g.id} → siehe ${s} gibt es nicht`);
    }
  }
  if (g.techniqueId && !alleIds.has(g.techniqueId)) {
    toteQuerverweise += 1;
    console.log(`       ${g.id} → Technik ${g.techniqueId} gibt es nicht`);
  }
}
sagt(toteQuerverweise === 0, `Glossar ohne tote Verweise (${GLOSSAR.length} Begriffe)`);

const zerlegt = zerlegeText("Der {{clinch}} und {{gerade|eine Gerade}} und {{gibtsnicht}}.");
sagt(zerlegt.filter((s) => s.begriff).length === 2, "zerlegeText findet genau die bekannten Begriffe");
sagt(
  zerlegt.map((s) => s.text).join("") === "Der Clinch und eine Gerade und gibtsnicht.",
  "unbekannte Markierung fällt still auf Text zurück",
);

// ── Planbare Hülle ─────────────────────────────────────────────────────────
console.log("\n── Planbare Hülle in lib/exercises.ts ──");

let ohneHuelle = 0;
for (const d of DRILL_TECHNIQUES) {
  const huelle = EXERCISES.find((e) => (e.techniqueIds ?? []).includes(d.id));
  if (!huelle) {
    ohneHuelle += 1;
    console.log(`       ${d.id} hat keinen Übungs-Eintrag`);
    continue;
  }
  if (huelle.category !== d.category) {
    ohneHuelle += 1;
    console.log(`       ${huelle.id}: Kategorie ${huelle.category} statt ${d.category}`);
  }
  if (huelle.defaultRounds < 1 || huelle.durationSeconds < 30) {
    ohneHuelle += 1;
    console.log(`       ${huelle.id}: unbrauchbare Runden oder Dauer`);
  }
}
sagt(ohneHuelle === 0, `jeder Drill ist planbar (${DRILL_TECHNIQUES.length} Hüllen)`);

const huellenIds = new Set(
  EXERCISES.filter((e) => e.id.startsWith("drill_")).map((e) => e.id),
);
sagt(huellenIds.size === 12, `12 Übungs-Hüllen mit Präfix drill_ (${huellenIds.size})`);

// ── Stimme ─────────────────────────────────────────────────────────────────
console.log("\n── Stimme (tidal-stimme) ──");

const alleTexte = DRILL_TECHNIQUES.flatMap((d) => texte(d).map((t) => ({ ...t, id: d.id })));

const rufe = alleTexte.filter((t) => t.text.includes("!"));
sagt(rufe.length === 0, `kein Ausrufezeichen (${rufe.length})`);
rufe.slice(0, 3).forEach((t) => console.log(`       ${t.id}/${t.feld}: ${t.text}`));

const IHR = /(?<!\p{L})(ihr|euch|euer|eure|eurem|euren|eurer)(?!\p{L})/giu;
const ihrzen = alleTexte.filter((t) => IHR.test(t.text));
sagt(ihrzen.length === 0, `kein „ihr/euch/euer" (${ihrzen.length})`);
ihrzen.slice(0, 5).forEach((t) => console.log(`       ${t.id}/${t.feld}: ${t.text}`));

const SONDERN = /(?<!\p{L})nicht(?!\p{L})[^.?!]{0,80}(?<!\p{L})sondern(?!\p{L})/iu;
const gegensatz = alleTexte.filter((t) => SONDERN.test(t.text));
sagt(gegensatz.length === 0, `kein „nicht X, sondern Y" (${gegensatz.length})`);
gegensatz.slice(0, 3).forEach((t) => console.log(`       ${t.id}/${t.feld}: ${t.text}`));

const vorwurf = alleTexte.filter((t) => t.feld === "commonMistakes" && /^Du\s/.test(t.text));
sagt(vorwurf.length === 0, `kein typischer Fehler beginnt mit „Du" (${vorwurf.length})`);
vorwurf.slice(0, 5).forEach((t) => console.log(`       ${t.id}: ${t.text}`));

/**
 * Leons Fund vom 24.09.: Ein Fehler ohne „du" darf kein bloßer Infinitiv
 * werden. „Rückwärts ausweichen statt seitlich" liest sich im Deutschen als
 * AUFFORDERUNG — und genau diese Form tragen die coachingCues auf derselben
 * Seite („Jeden Schlag ansagen"). Dieselbe Grammatik hieße dann einmal
 * „mach das" und einmal „mach das nicht".
 *
 * Der Ausweg: ein Körperteil oder die Lage wird zum Subjekt. Deshalb die
 * Positivliste — sie lässt nur Satzanfänge zu, nach denen ein finites Verb
 * folgen kann. Wer einen neuen Anfang braucht, trägt ihn bewusst hier ein.
 */
const ERLAUBTE_ANFAENGE = new Set([
  "Der", "Die", "Das", "Den", "Dem", "Ein", "Eine", "Einen", "Es",
  "Beide", "Gebeugte", "Nach", "Aus", "Bei", "Im", "In", "Vor", "Zu", "Ohne",
]);
const befehle = alleTexte.filter((t) => {
  if (t.feld !== "commonMistakes") return false;
  const erstes = t.text.split(/\s+/)[0].replace(/[^A-Za-zÄÖÜäöüß-]/g, "");
  return !ERLAUBTE_ANFAENGE.has(erstes);
});
sagt(
  befehle.length === 0,
  `kein typischer Fehler liest sich als Aufforderung (${befehle.length})`,
);
befehle
  .slice(0, 5)
  .forEach((t) => console.log(`       ${t.id}: ${t.text}  ← braucht ein Subjekt`));

const gesehen = new Map();
let doppelt = 0;
for (const t of alleTexte) {
  const key = t.text.trim().toLowerCase();
  if (key.length < 25) continue;
  if (gesehen.has(key)) {
    doppelt += 1;
    console.log(`       doppelt in ${gesehen.get(key)} und ${t.id}: ${t.text}`);
  } else gesehen.set(key, t.id);
}
sagt(doppelt === 0, `kein Satzbaustein zweimal (${alleTexte.length} Textstücke geprüft)`);

const kurzeWarum = DRILL_TECHNIQUES.filter(
  (d) => !d.whyItMatters || d.whyItMatters.split(/\s+/).length < 8,
);
sagt(kurzeWarum.length === 0, `jeder Drill begründet sich (${DRILL_TECHNIQUES.length}× whyItMatters)`);

const langeNamen = DRILL_TECHNIQUES.filter((d) => d.name.split(/\s+/).length > 6);
sagt(langeNamen.length === 0, `jeder Name hat höchstens 6 Wörter (${langeNamen.length} zu lang)`);
langeNamen.forEach((d) => console.log(`       ${d.name}`));

console.log(fehler === 0 ? `\nALLES GRÜN\n` : `\n${fehler} FEHLER\n`);
process.exit(fehler === 0 ? 0 : 1);
