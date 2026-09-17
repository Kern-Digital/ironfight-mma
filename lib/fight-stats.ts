/**
 * Fight-Stats — quantitative Gegner-Analyse (Ergänzung zur qualitativen Gegner-DNA).
 *
 * Während `gegner-dna.ts` Freitext-Scouting abbildet, modelliert diese Datei den
 * messbaren Teil aus dem App-Konzept:
 *   §1 Fight-DNA-Split  → prozentuale Verteilung der Kampfbereiche (Boxen/Kick/…)
 *   §2 Action-Stats     → gezählte Techniken: Versuche, Treffer, Käfig-Zone, Setup
 *   §3 Tendenzen        → aus den Zahlen abgeleitete Klartext-Erkenntnisse
 *   §4 Vorschläge       → Gameplan-/Drill-Empfehlungen aus den Tendenzen
 *   §5 Zonen-Aggregation→ Käfig-Heatmap-Daten (Center / Open / Cage)
 *
 * Alles ist eine reine, erklärbare Heuristik (kein KI-System). Eingabe erfolgt
 * manuell durch den Trainer beim Videoschauen. IDs sind stabil — niemals ändern.
 */

import { FIGHT_FAMILY_COLOR } from "@/lib/discipline-colors";

// ─── §1 Fight-DNA-Split ──────────────────────────────────────────────────────

/** Prozentuale Verteilung der Kampfbereiche (gespeichert normiert: Summe exakt 100). */
export interface DnaSplit {
  boxing: number;
  kicking: number;
  wrestling: number;
  ground: number;
  clinch: number;
}

export type DnaSplitKey = keyof DnaSplit;

export const DNA_SPLIT_KEYS: DnaSplitKey[] = [
  "boxing",
  "kicking",
  "wrestling",
  "ground",
  "clinch",
];

export const DNA_SPLIT_META: Record<
  DnaSplitKey,
  { label: string; color: string }
> = {
  // Farben kommen zentral aus lib/discipline-colors.ts — eine Rubrik hat
  // app-weit immer dieselbe Farbe, und ein Chart nie zwei ähnliche Töne.
  boxing: { label: "Boxen", color: FIGHT_FAMILY_COLOR.striking },
  kicking: { label: "Kicks", color: FIGHT_FAMILY_COLOR.kicks },
  wrestling: { label: "Wrestling", color: FIGHT_FAMILY_COLOR.wrestling },
  ground: { label: "Boden", color: FIGHT_FAMILY_COLOR.ground },
  clinch: { label: "Clinch", color: FIGHT_FAMILY_COLOR.clinch },
};

export const EMPTY_DNA_SPLIT: DnaSplit = {
  boxing: 0,
  kicking: 0,
  wrestling: 0,
  ground: 0,
  clinch: 0,
};

/** Summe aller Split-Werte. */
export function dnaSplitTotal(split: DnaSplit): number {
  return DNA_SPLIT_KEYS.reduce((sum, k) => sum + (split[k] || 0), 0);
}

/** True, wenn kein einziger Split-Wert gesetzt ist. */
export function isDnaSplitEmpty(split: DnaSplit | undefined | null): boolean {
  if (!split) return true;
  return dnaSplitTotal(split) === 0;
}

/** Normiert die Werte auf Prozent (0..100) relativ zur Gesamtsumme. */
export function normalizeDnaSplit(split: DnaSplit): Record<DnaSplitKey, number> {
  const total = dnaSplitTotal(split);
  const out = {} as Record<DnaSplitKey, number>;
  for (const k of DNA_SPLIT_KEYS) {
    out[k] = total > 0 ? Math.round(((split[k] || 0) / total) * 100) : 0;
  }
  return out;
}

/**
 * Säubert einen Split für Firestore und normiert ihn auf Summe EXAKT 100.
 *
 * Largest-Remainder-Verfahren: jeden Anteil abrunden, dann die fehlenden
 * Punkte an die größten Nachkommareste vergeben (bei Gleichstand entscheidet
 * die Katalog-Reihenfolge — deterministisch). Ein bereits normierter Split
 * bleibt beim erneuten Säubern unverändert.
 *
 * Warum: Modelle liefern gelegentlich Summen wie 95 oder 108, und Runden je
 * Feld allein kann 99/101 erzeugen (33,3/33,3/33,4). Beides würde in
 * mergeDnaSplit als verstecktes Zusatzgewicht wirken und die Anzeige von
 * "100 %" brechen. Leerer Split (alle Werte ≤ 0) bleibt leer.
 */
export function cleanDnaSplit(split: DnaSplit | undefined | null): DnaSplit {
  const out = { ...EMPTY_DNA_SPLIT };
  if (!split) return out;
  const raw = { ...EMPTY_DNA_SPLIT };
  let total = 0;
  for (const k of DNA_SPLIT_KEYS) {
    const v = Number(split[k]);
    raw[k] = Number.isFinite(v) && v > 0 ? v : 0;
    total += raw[k];
  }
  if (total <= 0) return out;
  let used = 0;
  const rest: { k: DnaSplitKey; frac: number }[] = [];
  for (const k of DNA_SPLIT_KEYS) {
    const exact = (raw[k] * 100) / total;
    out[k] = Math.floor(exact);
    used += out[k];
    rest.push({ k, frac: exact - out[k] });
  }
  // sort ist stabil — bei gleichem Rest bleibt die Katalog-Reihenfolge.
  rest.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < 100 - used; i++) out[rest[i].k] += 1;
  return out;
}

/**
 * Führt einen neuen Split gewichtet in den bestehenden ein.
 *
 * Echter gewichteter Mittelwert über alle bisher eingeflossenen Videos:
 *
 *   split_neu = (split_alt · W + split_video · w) / (W + w)
 *
 * `W` ist die Summe der bisherigen Gewichte. Ohne dieses Mitzählen bliebe nur
 * `(alt + neu) / 2` — dabei bekäme jedes neue Video pauschal die Hälfte, egal
 * wie viele Kämpfe schon im Profil stecken.
 *
 * Sonderfälle: bestehender Split leer oder `W = 0` → der neue Split wird
 * vollständig übernommen. Neuer Split leer → nichts ändert sich.
 */
export function mergeDnaSplit(
  current: DnaSplit | null | undefined,
  currentWeight: number,
  incoming: DnaSplit | null | undefined,
  incomingWeight: number,
): { split: DnaSplit | null; weight: number } {
  const w = Math.max(0, incomingWeight);
  const W = Math.max(0, currentWeight);
  const base = current ?? null;

  if (!incoming || isDnaSplitEmpty(incoming) || w === 0) {
    return { split: base && !isDnaSplitEmpty(base) ? cleanDnaSplit(base) : null, weight: W };
  }
  if (!base || isDnaSplitEmpty(base) || W === 0) {
    return { split: cleanDnaSplit(incoming), weight: w };
  }

  const total = W + w;
  // Beide Seiten VOR dem Mittel auf Summe 100 normieren — sonst wirkt eine
  // Roh-Summe ≠ 100 (Modell-Output, Altbestand) als verstecktes Zusatzgewicht.
  const base100 = cleanDnaSplit(base);
  const incoming100 = cleanDnaSplit(incoming);
  const out = { ...EMPTY_DNA_SPLIT };
  for (const k of DNA_SPLIT_KEYS) {
    out[k] = (base100[k] * W + incoming100[k] * w) / total;
  }
  return { split: cleanDnaSplit(out), weight: total };
}

// ─── §2 Action-Stats ─────────────────────────────────────────────────────────

/**
 * Sechs Gruppen (Kampfart-Steckbriefe, Leon 17.09.2026). `clinch` = Knie,
 * kurze Schläge und Fegen im STEHENDEN Griffkontakt — vorher zählte ein
 * Clinch-Knie als Kick und ein Umwerfen aus dem Thai-Clinch als Takedown.
 * `submission` = Würger, Armhebel, Beinhebel statt eines Sammeleintrags.
 * `takedown` heißt überall „Stand → Boden", auch Würfe.
 */
export type ActionGroup = "strike" | "kick" | "clinch" | "takedown" | "ground" | "submission";

/** Anzeige-Reihenfolge der Gruppen. */
export const ACTION_GROUPS: ActionGroup[] = ["strike", "kick", "clinch", "takedown", "ground", "submission"];

export const ACTION_GROUP_META: Record<
  ActionGroup,
  { label: string; color: string }
> = {
  strike: { label: "Schläge", color: FIGHT_FAMILY_COLOR.striking },
  kick: { label: "Kicks", color: FIGHT_FAMILY_COLOR.kicks },
  clinch: { label: "Clinch", color: FIGHT_FAMILY_COLOR.clinch },
  takedown: { label: "Takedowns & Würfe", color: FIGHT_FAMILY_COLOR.wrestling },
  ground: { label: "Boden", color: FIGHT_FAMILY_COLOR.ground },
  // Aufgabegriffe gehören zur Boden-Familie (Rubrik = immer dieselbe Farbe);
  // im Stats-Block stehen die Gruppen untereinander, nie im selben Chart.
  submission: { label: "Aufgabegriffe", color: FIGHT_FAMILY_COLOR.ground },
};

export interface ActionDef {
  /** Stabile ID — NIEMALS ändern. */
  id: string;
  label: string;
  group: ActionGroup;
  /**
   * Woran ein VERSUCH im Video sichtbar ist — und woran ein GELUNGENER.
   * Endzustände statt Momente (ein Jab dauert 0,3 s, ein Takedown hinterlässt
   * Sekunden): „gelungen" beschreibt den Zustand danach, nie Kraft, Absicht
   * oder Wertung. Quelle: docs/kampfart-steckbriefe.md 4.3. Der Katalogtext
   * im Beobachtungs-Prompt (lib/server/gemini.ts) liest beide Felder.
   */
  versucht: string;
  gelungen: string;
}

/**
 * Technik-Katalog — 37 Einträge (Stand 17.09.2026). `throw` und `submission`
 * sind Rückfall-IDs, wenn die Art nicht erkennbar ist. Welche Technik in
 * welcher Kampfart zählt, steht in lib/kampfart-steckbrief.ts.
 */
export const ACTION_CATALOG: ActionDef[] = [
  // Schläge aus der Distanz
  { id: "jab", label: "Jab", group: "strike", versucht: "Führhand streckt sich gerade zum Ziel", gelungen: "Kontakt an Kopf oder Rumpf, Kopf oder Rumpf bewegt sich" },
  { id: "cross", label: "Cross", group: "strike", versucht: "Schlaghand gerade, Hüfte dreht ein", gelungen: "Kontakt an Kopf oder Rumpf, Kopf oder Rumpf bewegt sich" },
  { id: "hook", label: "Hook", group: "strike", versucht: "gebogener Arm auf seitlicher Bogenbahn", gelungen: "Kontakt, Kopf dreht" },
  { id: "uppercut", label: "Uppercut", group: "strike", versucht: "Schlagbahn von unten nach oben", gelungen: "Kontakt, Kopf hebt sich" },
  { id: "overhand", label: "Overhand", group: "strike", versucht: "Bogen über die Deckung (kaum vom Haken zu trennen, sparsam nutzen)", gelungen: "Kontakt" },
  { id: "elbow", label: "Ellbogen", group: "strike", versucht: "angewinkelter Arm auf kurzer Distanz OHNE Griff", gelungen: "Kontakt, Kopf knickt oder Cut" },
  { id: "spinning-strike", label: "Drehschlag", group: "strike", versucht: "sichtbare Drehung um mindestens 180° mit Faust oder Ellbogen (Backfist, Spinning Elbow)", gelungen: "Kontakt" },
  // Tritte und Knie aus der Distanz
  { id: "low-kick", label: "Low Kick", group: "kick", versucht: "gestrecktes Bein, Schienbein oder Rist Richtung Oberschenkel", gelungen: "Kontakt, Bein knickt oder wandert; gecheckt zählt als abgewehrt" },
  { id: "body-kick", label: "Body Kick", group: "kick", versucht: "gestrecktes Bein auf Rumpfhöhe", gelungen: "Kontakt, Rumpf oder Arme klappen" },
  { id: "high-kick", label: "High Kick", group: "kick", versucht: "gestrecktes Bein auf Kopfhöhe", gelungen: "Kontakt, Kopf weicht" },
  { id: "front-kick", label: "Front Kick (Teep)", group: "kick", versucht: "gerader Stoß mit dem Bein nach vorn", gelungen: "Gegner wird weggeschoben oder geht zurück" },
  { id: "knee", label: "Knie", group: "kick", versucht: "Knie stößt Richtung Ziel OHNE Griff (Distanz, Sprung)", gelungen: "Kontakt, Rumpf klappt" },
  { id: "spinning-kick", label: "Drehkick", group: "kick", versucht: "Rotation über mindestens zwei Bilder mit gestrecktem Bein (Back, Hook, Wheel, Axe Kick)", gelungen: "Kontakt" },
  // Im stehenden Griffkontakt
  { id: "clinch-knee", label: "Knie im Clinch", group: "clinch", versucht: "Griff an Nacken, Arm oder Körper UND Knie stößt", gelungen: "Kontakt, Rumpf oder Kopf bewegt sich" },
  { id: "clinch-strike", label: "Schlag im Clinch", group: "clinch", versucht: "Faust oder Ellbogen bei gehaltenem Griff (Dirty Boxing)", gelungen: "Kontakt" },
  { id: "sweep-dump", label: "Fegen / Umwerfen", group: "clinch", versucht: "Fußfeger, Zug oder Drehung aus dem Griff oder nach gefangenem Bein — danach KEIN Bodenkampf", gelungen: "Gegner berührt mit mehr als den Füßen den Boden, der Ausführende bleibt stehen" },
  // Takedowns & Würfe: Stand → Boden
  { id: "single-leg", label: "Single Leg", group: "takedown", versucht: "Niveauwechsel, Hände oder Arme an EINEM Bein unterhalb der Hüfte (auch High Crotch, Ankle Pick)", gelungen: "Gegner mit Rumpf oder Gesäß am Boden (oder Hände, Knie und Kopf) UND Angreifer oben oder hinter ihm, mindestens drei Bilder" },
  { id: "double-leg", label: "Double Leg", group: "takedown", versucht: "Arme um BEIDE Beine, Kopf seitlich an der Hüfte", gelungen: "Gegner mit Rumpf oder Gesäß am Boden UND Angreifer oben oder hinter ihm, mindestens drei Bilder" },
  { id: "body-lock", label: "Body-Lock-Takedown", group: "takedown", versucht: "Arme um den Rumpf geschlossen UND sichtbare Hebe-, Kipp- oder Drehbewegung — bloßes Umklammern ist Clinch, kein Versuch", gelungen: "Gegner mit Rumpf oder Gesäß am Boden UND Angreifer oben oder hinter ihm, mindestens drei Bilder" },
  { id: "trip", label: "Trip / Beintechnik", group: "takedown", versucht: "Bein des Angreifers blockiert, fegt oder hebt das Gegnerbein, Gegner verliert das Gleichgewicht (Trip, Fußfeger, Sichel, Uchi-mata)", gelungen: "Gegner am Boden UND Angreifer oben oder hinter ihm, mindestens drei Bilder" },
  { id: "throw-hip", label: "Hüftwurf", group: "takedown", versucht: "Eindrehen mit Hüftkontakt, Gegner hebt ab (Koshi-waza, Hüftschwung)", gelungen: "Landung auf Seite oder Rücken unter Griffkontrolle" },
  { id: "throw-shoulder", label: "Schulterwurf", group: "takedown", versucht: "Eindrehen unter den Arm ohne Hüftblock oder Arm fixiert (Seoi-nage, Tai-otoshi, Achselwurf)", gelungen: "Landung auf Seite oder Rücken unter Griffkontrolle" },
  { id: "throw-sacrifice", label: "Opferwurf", group: "takedown", versucht: "Angreifer fällt selbst mit auf Rücken oder Seite und hält den Griff (Tomoe-nage, Suplex, Überwurf)", gelungen: "Gegner landet auf Seite oder Rücken" },
  { id: "throw", label: "Wurf", group: "takedown", versucht: "Gegner verliert beide Füße vom Boden, Wurfart nicht erkennbar", gelungen: "Landung auf Seite oder Rücken" },
  { id: "go-behind", label: "Go-behind", group: "takedown", versucht: "Richtungswechsel hinter den Gegner aus der Bindung (Armzug, Duck-under, Nackenzug)", gelungen: "Kontrolle von hinten, Gegner mit Händen und Knien am Boden" },
  { id: "guard-pull", label: "Guard-Pull", group: "takedown", versucht: "Hinsetzen oder Springen MIT Griff", gelungen: "Guard steht, Gegner oben, mindestens drei Bilder" },
  // Bodenkampf
  { id: "pass", label: "Guard Pass", group: "ground", versucht: "Oberer greift die Beinlinie des Unteren an", gelungen: "Side Control, North-South, Knee on Belly oder Mount, mindestens drei Bilder" },
  { id: "sweep", label: "Sweep / Umdrehen von unten", group: "ground", versucht: "Unterer kippt oder hebt den Oberen", gelungen: "Rollentausch, neue Oberlage mindestens drei Bilder" },
  { id: "back-take", label: "Rücken nehmen", group: "ground", versucht: "Hüfte hinter den Gegner, Hooks oder Body-Triangle", gelungen: "Position mindestens drei Bilder" },
  { id: "escape", label: "Escape / Aufstehen", group: "ground", versucht: "Unterer verlässt Side Control, Mount oder Back oder steht auf", gelungen: "Guard zurück, Turtle oder beide Füße frei, mindestens drei Bilder" },
  { id: "turn", label: "Drehen am Boden", group: "ground", versucht: "Oberer dreht den Unteren um die Längsachse (Durchdreher, Beinschraube, Halbnelson)", gelungen: "Unterer rollt über den Rücken; jede Umdrehung zählt einzeln" },
  { id: "hold-down", label: "Haltegriff", group: "ground", versucht: "Oberer quer auf dem Gegner, dessen Rücken am Boden, Rumpf auf Rumpf", gelungen: "mindestens 5 Sekunden gehalten" },
  { id: "ground-strikes", label: "Ground & Pound", group: "ground", versucht: "Schlagserie aus der Oberlage", gelungen: "Kontakt, Kopf des Unteren bewegt sich" },
  { id: "submission", label: "Submission", group: "ground", versucht: "Aufgabegriff geschlossen, Gegner zeigt Abwehrreaktion, Art nicht erkennbar", gelungen: "Abklopfen oder Abbruch" },
  // Aufgabegriffe
  { id: "choke", label: "Würger", group: "submission", versucht: "Arm, Revers oder Beine am Hals UND sichtbare Abwehrreaktion (RNC, Guillotine, Triangle)", gelungen: "Abklopfen, Abbruch oder bewusstlos" },
  { id: "armlock", label: "Armhebel", group: "submission", versucht: "Arm isoliert UND Streck- oder Drehbewegung (Armbar, Kimura, Americana, Omoplata)", gelungen: "Abklopfen oder Abbruch" },
  { id: "leglock", label: "Beinhebel", group: "submission", versucht: "Bein isoliert UND Streckung oder Drehung (Straight Ankle, Kneebar, Heel Hook)", gelungen: "Abklopfen oder Abbruch" },
];

export const ACTION_BY_ID: Map<string, ActionDef> = new Map(
  ACTION_CATALOG.map((a) => [a.id, a] as const),
);

export function actionLabel(id: string): string {
  return ACTION_BY_ID.get(id)?.label ?? id;
}

/**
 * Zone, in der eine Aktion überwiegend passiert (Konzept §4/§5). Die
 * Schlüssel bleiben, die Bedeutung ist seit den Kampfart-Steckbriefen
 * (17.09.2026) kampfartneutral: cage = am RAND der Kampffläche (Käfig,
 * Seile oder Mattenrand). Die Wörter je Kampfart liefern zonenLabel() und
 * zonenPhrase() in lib/kampfart-steckbrief.ts; die Werte hier gelten ohne
 * Kampfart (Gegnerprofil, Gesamtprofil über mehrere Kampfarten).
 */
export type CageZone = "center" | "open" | "cage";

export const CAGE_ZONE_LABEL: Record<CageZone, string> = {
  center: "Mitte",
  open: "Offener Raum",
  cage: "Am Rand",
};

/** Gebeugte Ortsangabe für Fließtext („… passieren im offenen Raum"). */
export const CAGE_ZONE_PHRASE: Record<CageZone, string> = {
  center: "in der Mitte",
  open: "im offenen Raum",
  cage: "am Rand",
};

/** Eine gezählte Aktion, aggregiert über die hochgeladenen Kämpfe. */
export interface ActionStat {
  /** Katalog-ID (siehe ACTION_CATALOG). */
  id: string;
  /** Gesamtzahl der Versuche. */
  attempted: number;
  /** Davon erfolgreich (Treffer / erfolgreicher Takedown). */
  landed: number;
  /** Überwiegende Käfig-Zone (optional). */
  zone?: CageZone | null;
  /** Womit wird die Aktion vorbereitet — Freitext, z.B. „Linker Jab" (optional). */
  setup?: string | null;
}

/** Trefferquote 0..1 (0, wenn keine Versuche). */
export function successRate(s: Pick<ActionStat, "attempted" | "landed">): number {
  return s.attempted > 0 ? Math.max(0, Math.min(1, s.landed / s.attempted)) : 0;
}

/** True, wenn eine Aktion echte Daten trägt. */
export function hasActionData(s: ActionStat): boolean {
  return (s.attempted || 0) > 0 || (s.landed || 0) > 0;
}

/** Entfernt leere Aktionen & clampt Werte — Firestore-sicher (kein undefined). */
export function cleanActionStats(
  stats: ActionStat[] | undefined | null,
): ActionStat[] {
  if (!stats) return [];
  const out: ActionStat[] = [];
  for (const s of stats) {
    if (!ACTION_BY_ID.has(s.id)) continue;
    const attempted = Math.max(0, Math.round(Number(s.attempted) || 0));
    let landed = Math.max(0, Math.round(Number(s.landed) || 0));
    if (landed > attempted) landed = attempted;
    if (attempted === 0 && landed === 0) continue;
    const clean: ActionStat = { id: s.id, attempted, landed };
    if (s.zone === "center" || s.zone === "open" || s.zone === "cage")
      clean.zone = s.zone;
    if (typeof s.setup === "string" && s.setup.trim())
      clean.setup = s.setup.trim();
    out.push(clean);
  }
  return out;
}

/** True, wenn keine Aktion Daten trägt. */
export function isActionStatsEmpty(
  stats: ActionStat[] | undefined | null,
): boolean {
  return !stats || !stats.some(hasActionData);
}

/** Summen über eine Aktionsliste. */
export function actionTotals(stats: ActionStat[]): {
  attempted: number;
  landed: number;
  rate: number;
} {
  const attempted = stats.reduce((n, s) => n + (s.attempted || 0), 0);
  const landed = stats.reduce((n, s) => n + (s.landed || 0), 0);
  return { attempted, landed, rate: attempted > 0 ? landed / attempted : 0 };
}

/** Gruppiert Stats nach ActionGroup (nur Gruppen mit Daten). */
export function statsByGroup(
  stats: ActionStat[],
): { group: ActionGroup; stats: ActionStat[] }[] {
  return ACTION_GROUPS
    .map((group) => ({
      group,
      stats: stats.filter(
        (s) => ACTION_BY_ID.get(s.id)?.group === group && hasActionData(s),
      ),
    }))
    .filter((g) => g.stats.length > 0);
}

// ─── §5 Zonen-Aggregation (Käfig-Heatmap) ────────────────────────────────────

/** Versuche je Käfig-Zone — Basis der Heatmap. Aktionen ohne Zone bleiben außen vor. */
export function zoneDistribution(
  stats: ActionStat[],
): Record<CageZone, number> {
  const out: Record<CageZone, number> = { center: 0, open: 0, cage: 0 };
  for (const s of stats) {
    if (s.zone && hasActionData(s)) out[s.zone] += s.attempted || 0;
  }
  return out;
}

// ─── §3 Tendenzen ────────────────────────────────────────────────────────────

export type TendencyTone = "weapon" | "success" | "zone" | "setup" | "warning";

export interface Tendency {
  id: string;
  text: string;
  tone: TendencyTone;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Leitet Klartext-Erkenntnisse aus den Action-Stats ab (Konzept §9/§10).
 * Bewusst konservativ: nur Aussagen, die durch genug Versuche gestützt sind.
 */
export function deriveTendencies(
  stats: ActionStat[],
  /** Ortsangaben je Kampfart (zonenPhrase aus lib/kampfart-steckbrief.ts). */
  zonenPhrase: Record<CageZone, string> = CAGE_ZONE_PHRASE,
): Tendency[] {
  const active = stats.filter(hasActionData);
  if (active.length === 0) return [];
  const out: Tendency[] = [];

  // Häufigste Waffe = meiste Versuche.
  const mostUsed = [...active].sort((a, b) => b.attempted - a.attempted)[0];
  if (mostUsed && mostUsed.attempted > 0) {
    out.push({
      id: "most-used",
      tone: "weapon",
      text: `Häufigste Waffe: ${actionLabel(mostUsed.id)} (${mostUsed.attempted} Versuche).`,
    });
  }

  // Gefährlichste Technik = höchste Trefferquote bei ausreichend Versuchen (≥3).
  const reliable = active.filter((s) => s.attempted >= 3);
  if (reliable.length > 0) {
    const best = [...reliable].sort(
      (a, b) => successRate(b) - successRate(a),
    )[0];
    if (best && successRate(best) >= 0.5) {
      out.push({
        id: "most-dangerous",
        tone: "success",
        text: `Gefährlichste Technik: ${actionLabel(best.id)} — ${pct(successRate(best))} Trefferquote (${best.landed}/${best.attempted}).`,
      });
    }
  }

  // Takedown-Profil (Konzept §9): Erfolgsrate + dominante Zone.
  const takedowns = active.filter(
    (s) => ACTION_BY_ID.get(s.id)?.group === "takedown",
  );
  if (takedowns.length > 0) {
    const t = actionTotals(takedowns);
    if (t.attempted >= 3) {
      out.push({
        id: "takedown-rate",
        tone: "success",
        text: `Takedowns: ${t.landed}/${t.attempted} erfolgreich (${pct(t.rate)}).`,
      });
    }
    const zones = zoneDistribution(takedowns);
    const zTotal = zones.center + zones.open + zones.cage;
    if (zTotal > 0) {
      const dom = (Object.keys(zones) as CageZone[]).sort(
        (a, b) => zones[b] - zones[a],
      )[0];
      if (zones[dom] / zTotal >= 0.6) {
        out.push({
          id: "takedown-zone",
          tone: "zone",
          text: `${pct(zones[dom] / zTotal)} der Takedowns passieren ${zonenPhrase[dom]}.`,
        });
      }
    }
  }

  // Setup-Muster (Konzept §5): welche Vorbereitung taucht am häufigsten auf.
  const setups = new Map<string, number>();
  for (const s of active) {
    if (s.setup) setups.set(s.setup, (setups.get(s.setup) || 0) + s.attempted);
  }
  if (setups.size > 0) {
    const top = Array.from(setups.entries()).sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: "setup",
      tone: "setup",
      text: `Häufige Vorbereitung: „${top[0]}" leitet viele Angriffe ein.`,
    });
  }

  // Warnung: Technik mit sehr hohem Volumen UND hoher Quote = klare Bedrohung.
  if (mostUsed && mostUsed.attempted >= 5 && successRate(mostUsed) >= 0.6) {
    out.push({
      id: "threat",
      tone: "warning",
      text: `Achtung: ${actionLabel(mostUsed.id)} kommt oft und trifft (${pct(successRate(mostUsed))}) — Hauptbedrohung.`,
    });
  }

  return out;
}

// ─── §4 Gameplan- & Drill-Vorschläge ─────────────────────────────────────────

export interface Suggestion {
  id: string;
  kind: "gameplan" | "drill";
  text: string;
}

/**
 * Erzeugt aus Split + Stats konkrete, editierbare Gameplan-/Drill-Vorschläge
 * (Konzept §10/§11). Reine Regel-Heuristik — der Trainer verfeinert frei.
 */
export function deriveSuggestions(
  split: DnaSplit | undefined | null,
  stats: ActionStat[],
  opts: {
    /** Ortsangaben je Kampfart (zonenPhrase aus lib/kampfart-steckbrief.ts). */
    zonenPhrase?: Record<CageZone, string>;
    /** false in Kampfarten ohne Takedowns (Boxen, Kickboxen): kein Boden-Plan. */
    mitTakedowns?: boolean;
    /**
     * true in Kampfarten ohne Schläge (Ringen, Sambo, BJJ): Takedowns SIND der
     * Kampf — kein „Distanz halten gegen Takedowns", kein Ground & Pound.
     */
    grappling?: boolean;
  } = {},
): Suggestion[] {
  const ort = opts.zonenPhrase ?? CAGE_ZONE_PHRASE;
  const mitTakedowns = opts.mitTakedowns ?? true;
  const grappling = opts.grappling ?? false;
  const out: Suggestion[] = [];
  const active = stats.filter(hasActionData);
  const norm = split ? normalizeDnaSplit(split) : null;

  const takedowns = active.filter(
    (s) => ACTION_BY_ID.get(s.id)?.group === "takedown",
  );
  const tdTotals = actionTotals(takedowns);
  const tdZones = zoneDistribution(takedowns);
  const tdZoneTotal = tdZones.center + tdZones.open + tdZones.cage;

  // Starker Ringer am Rand → Takedown-Abwehr priorisieren. Im Ringen, Sambo
  // und BJJ ist Wrestling-Zeit der Normalfall — dort gibt es den Plan nicht.
  if (
    !grappling &&
    ((norm && norm.wrestling >= 35) ||
      (tdTotals.attempted >= 4 && tdTotals.rate >= 0.5))
  ) {
    out.push({
      id: "td-defense",
      kind: "gameplan",
      text: `Takedown-Verteidigung zuerst: Distanz ${ort.center} halten und ${ort.cage} sofort seitlich rausdrehen.`,
    });
    if (tdZoneTotal > 0 && tdZones.cage / tdZoneTotal >= 0.5) {
      out.push({
        id: "drill-cage-defense",
        kind: "drill",
        text: `Drill: Takedown-Abwehr ${ort.cage} — Underhooks, Rausdrehen, Wieder-Aufstehen und Konter auf den Entry.`,
      });
    }
  }

  // Setup-Muster → genau diese Sequenz drillen (Konzept §10-Beispiel).
  const setupAction = active.find((s) => s.setup);
  if (setupAction?.setup) {
    out.push({
      id: "drill-setup",
      kind: "drill",
      text: `Drill: Reaktion auf „${setupAction.setup}" automatisieren — sobald das Setup kommt, Kopf sichern und kontern.`,
    });
  }

  // Striker-lastig → Defense gegen die häufigste Waffe.
  const mostUsed = [...active].sort((a, b) => b.attempted - a.attempted)[0];
  if (mostUsed && mostUsed.attempted >= 4) {
    const g = ACTION_BY_ID.get(mostUsed.id)?.group;
    if (g === "strike" || g === "kick") {
      out.push({
        id: "drill-counter-weapon",
        kind: "drill",
        text: `Drill: Defense & Konter gegen ${actionLabel(mostUsed.id)} — Timing lesen und mit eigenem Konter bestrafen.`,
      });
    }
  }

  // Schwache Bodenlage des Gegners ausnutzen.
  if (mitTakedowns && norm && norm.ground <= 15 && norm.wrestling <= 25) {
    out.push({
      id: "gameplan-ground",
      kind: "gameplan",
      text: grappling
        ? "Bodenlage des Gegners wirkt schwach — eigene Würfe und Takedowns mit Kontrolle oben als Sieg-Pfad einplanen."
        : "Bodenlage des Gegners wirkt schwach — eigene Takedowns + Ground & Pound als Sieg-Pfad einplanen.",
    });
  }

  return out;
}
