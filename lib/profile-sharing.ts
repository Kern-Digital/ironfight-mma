/**
 * Freigabe des eigenen Profils an Trainer — die BEREICHE.
 *
 * Ausgangslage (Leon 03.09.2026): Ein Trainer ist standardmäßig privat. Was
 * ein Kollege von ihm sieht, entscheidet er selbst — und seit Leons Revision
 * am selben Abend **je Bereich getrennt**, nicht als eine Freigabe für alles.
 *
 * ─── SEIT ETAPPE 2 DER AUTOMATIK (Leon 16.09.2026): DEEPFIGHT FÜR ALLE ──────
 *
 * Jeder Athlet entscheidet selbst, welche Trainer sein Kampfprofil und seine
 * DeepFight-Analysen sehen — nicht nur Stab-Konten. Ohne Freigabe kann ihn
 * niemand analysieren (dasselbe Tor gilt fürs Anlegen einer Analyse). Für
 * `athlet` und `wettkampf` bleibt es wie bisher: Athleten sind für alle
 * Trainer des Gyms offen, nur Stab-Konten brauchen eine Freigabe. Bestand
 * ist Demo — keine Vorbelegung (Leon).
 *
 * Dazu ist „alle Trainer" eine LEBENDE Regel: Wer sie setzt, meint auch den
 * Trainer, der nächsten Monat anfängt. Deshalb trägt jeder Bereich jetzt
 * ZWEI Listen — Namen (`uids`) und Gyms (`gyms`):
 *
 *   users/{uid}.profileShares = {
 *     athlet:    { uids: [uid, …], gyms: [gymId, …] },
 *     deepfight: { uids: [uid, …], gyms: [gymId, …] },
 *     wettkampf: { uids: [uid, …], gyms: [gymId, …] }
 *   }
 *
 * Die alte Form (je Bereich eine nackte uid-Liste) lesen `readShares` und
 * `hatFreigabe()` in den Regeln weiter; geschrieben wird nur noch die neue.
 *
 * WARUM DIESE DATEI EXISTIERT: Der Bereichs-Schlüssel steht an drei Orten —
 * in `firestore.rules` (`hatFreigabe(d, bereich)`), im geschriebenen Dokument
 * und in der Oberfläche. Drei Orte, an denen sich ein Tippfehler verstecken
 * kann, ohne dass irgendetwas kaputtgeht: Eine Freigabe auf einen Schlüssel,
 * den die Regel nicht kennt, wirkt einfach nicht. Deshalb kommen Schlüssel,
 * Beschriftung und Erklärung aus EINER Liste — dasselbe Muster wie
 * `lib/roles.ts` für die Rechte. Diese Datei hat keine React- und keine
 * Firebase-Abhängigkeit: `lib/server/member-access.ts` liest sie ebenfalls.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * „WETTKÄMPFE" IST SEIT SCHRITT 2b DABEI (04.09.2026)
 *
 * Der Bereich stand von Anfang an in den Regeln, die Oberfläche vergab ihn
 * aber nicht — ein Häkchen, das nichts hält, wäre eine falsche
 * Sicherheitsaussage gewesen. Gemessen am 03.09. per REST mit echten
 * ID-Tokens: `match /{path=**}/fightCamps/{campId}` matchte nicht nur
 * collectionGroup-Queries, sondern denselben direkten Pfad wie
 * `match /users/{uid}/fightCamps/{campId}` — und prüfte dort nur `sameGym`.
 * Firestore-Regeln sind ODER-verknüpft: Die großzügigere gewann, ein Camp war
 * für jeden Trainer des Gyms lesbar, und eine erteilte Freigabe änderte daran
 * nichts. Geschlossen mit einem materialisierten `ownerIsStaff` am
 * Camp-Dokument (`lib/fight-camp.ts`).
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Ein freigebbarer Bereich. Jeder Schlüssel steht so auch in den Regeln. */
export type ShareArea = "athlet" | "deepfight" | "wettkampf";

/** Was je Bereich am users-Dokument steht: Namen und Gyms. */
export interface ShareEntry {
  uids: string[];
  gyms: string[];
}

export type ProfileShares = Partial<Record<ShareArea, ShareEntry>>;

/**
 * Die Bereiche, die ein Mensch vergeben kann — in der Reihenfolge, in der sie
 * im Sheet stehen.
 *
 * Die Erklärungen folgen dem Zustand (Regel „Hilfstexte erklärend", Leon
 * 31.08.): Steht ein Häkchen auf aus, beschreibt der Satz darunter nicht den
 * eingeschalteten Zustand. Und sie sagen, was daraus FOLGT — „sieht dein
 * Kampfprofil" allein erklärt niemandem, dass damit auch das Analysieren
 * dazugehört.
 */
export const SHARE_AREAS: {
  key: ShareArea;
  label: string;
  /** Was dieser Bereich umfasst — einmal im Sheet-Kopf erklärt. */
  umfasst: string;
  /** Gilt der Bereich für JEDEN (Athlet wie Stab) oder nur für Stab-Konten? */
  fuerAlle: boolean;
}[] = [
  {
    key: "athlet",
    label: "Athletenprofil & Training",
    umfasst:
      "Disziplin, Level, Körperdaten, deine Workouts und deine Rückmeldungen aus dem Kursplan.",
    fuerAlle: false,
  },
  {
    key: "deepfight",
    label: "Kampfprofil & DeepFight",
    umfasst:
      "Dein Kampfprofil und die Ergebnisse aus deinen DeepFight-Analysen — wer das sieht, kann dich auch analysieren.",
    fuerAlle: true,
  },
  {
    key: "wettkampf",
    label: "Wettkämpfe",
    umfasst:
      "Deine Fight Camps mit Gegner, Zeitplan und Phasen — wer das sieht, plant deine Vorbereitung mit und legt dir neue Wettkämpfe an.",
    fuerAlle: false,
  },
];

/** Die Schlüssel, die in der Oberfläche vorkommen. */
export const SICHTBARE_BEREICHE: ShareArea[] = SHARE_AREAS.map((a) => a.key);

/** Die Bereiche, die DIESES Konto vergeben kann: Stab alle, Athlet nur DeepFight. */
export function bereicheFuerKonto(istStab: boolean): typeof SHARE_AREAS {
  return istStab ? SHARE_AREAS : SHARE_AREAS.filter((a) => a.fuerAlle);
}

export function leererEintrag(): ShareEntry {
  return { uids: [], gyms: [] };
}

function nurStrings(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Liest die Freigaben aus einem rohen users-Dokument (undefined-fest) — die
 * alte Listenform wie die neue Map-Form. Bereiche ohne Eintrag fehlen.
 */
export function readShares(data: Record<string, unknown> | undefined): ProfileShares {
  const roh = data?.profileShares;
  if (!roh || typeof roh !== "object") return {};
  const out: ProfileShares = {};
  for (const { key } of SHARE_AREAS) {
    const v = (roh as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      out[key] = { uids: nurStrings(v), gyms: [] };
    } else if (v && typeof v === "object") {
      const m = v as Record<string, unknown>;
      out[key] = { uids: nurStrings(m.uids), gyms: nurStrings(m.gyms) };
    }
  }
  return out;
}

/**
 * Darf `viewerUid` diesen Bereich sehen? Die CLIENT-Seite der Regel
 * `hatFreigabe`: namentlich ODER über das Gym des Betrachters.
 */
export function darfSehen(
  shares: ProfileShares | undefined,
  bereich: ShareArea,
  viewerUid: string,
  viewerGymId?: string | null,
): boolean {
  const e = shares?.[bereich];
  if (!e) return false;
  if (e.uids.includes(viewerUid)) return true;
  return !!viewerGymId && e.gyms.includes(viewerGymId);
}

/** Alle Bereiche, die dieser eine Mensch sehen darf. */
export function bereicheFuer(
  shares: ProfileShares | undefined,
  viewerUid: string,
  viewerGymId?: string | null,
): ShareArea[] {
  return SICHTBARE_BEREICHE.filter((b) => darfSehen(shares, b, viewerUid, viewerGymId));
}

/** Die Bereiche, die für ALLE Trainer eines Gyms offen sind. */
export function alleTrainerBereiche(
  shares: ProfileShares | undefined,
  gymId: string,
): ShareArea[] {
  return SICHTBARE_BEREICHE.filter((b) => (shares?.[b]?.gyms ?? []).includes(gymId));
}

/**
 * Die Gegenrichtung: Wer aus dieser Liste gibt MIR diesen Bereich frei?
 *
 * Sie kostet keine zweite Abfrage — `listAllMembers` trägt `profileShares` an
 * jedem Eintrag. Genau davon lebt der Wettkampfbereich: Er fragt die Camps
 * seiner freigegebenen Kollegen einzeln ab, und diese Liste sagt ihm, welche
 * das sind.
 */
export function werTeiltMitMir(
  eintraege: { uid: string; profileShares?: ProfileShares }[],
  bereich: ShareArea,
  viewerUid: string,
  viewerGymId?: string | null,
): string[] {
  return eintraege
    .filter((e) => darfSehen(e.profileShares, bereich, viewerUid, viewerGymId))
    .map((e) => e.uid);
}

/** Setzt ein einzelnes Namens-Häkchen und gibt die neue Sammlung zurück. */
export function mitBereich(
  shares: ProfileShares,
  bereich: ShareArea,
  uid: string,
  an: boolean,
): ProfileShares {
  const bisher = shares[bereich] ?? leererEintrag();
  const uids = an
    ? bisher.uids.includes(uid)
      ? bisher.uids
      : [...bisher.uids, uid]
    : bisher.uids.filter((x) => x !== uid);
  return { ...shares, [bereich]: { ...bisher, uids } };
}

/** Setzt „alle Trainer dieses Gyms, auch künftige" für einen Bereich. */
export function mitGym(
  shares: ProfileShares,
  bereich: ShareArea,
  gymId: string,
  an: boolean,
): ProfileShares {
  const bisher = shares[bereich] ?? leererEintrag();
  const gyms = an
    ? bisher.gyms.includes(gymId)
      ? bisher.gyms
      : [...bisher.gyms, gymId]
    : bisher.gyms.filter((x) => x !== gymId);
  return { ...shares, [bereich]: { ...bisher, gyms } };
}

/**
 * Was am Ende GESPEICHERT wird: jeder Bereich als vollständiger Eintrag,
 * auch leer. Ein fehlender Bereich müsste sonst als „unverändert" gelten,
 * und eine zurückgenommene Freigabe bliebe stehen — dasselbe Argument wie
 * beim Rechte-Spiegel in `rightsMirror` (lib/roles.ts).
 */
export function vollstaendig(shares: ProfileShares): Required<ProfileShares> {
  return {
    athlet: shares.athlet ?? leererEintrag(),
    deepfight: shares.deepfight ?? leererEintrag(),
    wettkampf: shares.wettkampf ?? leererEintrag(),
  };
}

/** Wie viele Menschen sehen namentlich mindestens einen Bereich? */
export function anzahlEmpfaenger(shares: ProfileShares | undefined): number {
  return empfaenger(shares).length;
}

/** Die uids, die namentlich mindestens einen Bereich sehen — in stabiler Reihenfolge. */
export function empfaenger(shares: ProfileShares | undefined): string[] {
  const alle: string[] = [];
  for (const b of SICHTBARE_BEREICHE) {
    for (const uid of shares?.[b]?.uids ?? []) {
      if (!alle.includes(uid)) alle.push(uid);
    }
  }
  return alle;
}

/** Gleich? Für den „gibt es etwas zu speichern"-Zustand des Sheets. */
export function gleicheShares(a: ProfileShares, b: ProfileShares): boolean {
  const gleich = (x: string[], y: string[]) => {
    const xs = [...x].sort();
    const ys = [...y].sort();
    return xs.length === ys.length && xs.every((v, i) => v === ys[i]);
  };
  for (const bereich of SICHTBARE_BEREICHE) {
    const ea = a[bereich] ?? leererEintrag();
    const eb = b[bereich] ?? leererEintrag();
    if (!gleich(ea.uids, eb.uids) || !gleich(ea.gyms, eb.gyms)) return false;
  }
  return true;
}

/**
 * Was ein Bereich in EINER Aufzählung beisteuert — einzelne Glieder, KEINE
 * fertigen Teilsätze.
 *
 * Der Unterschied ist der ganze Punkt (Leon 04.09.2026): Solange jeder Bereich
 * ein fertiges Stück mit eigenem „und" lieferte, entstand beim Zusammensetzen
 * eine Kette — „Sieht dein Athletenprofil und dein Training und dein
 * Kampfprofil und deine Analysen." Als Glieder gefügt liest derselbe Zustand
 * „Sieht dein Athletenprofil, dein Training, dein Kampfprofil und deine
 * Analysen."
 */
const GLIEDER: Record<ShareArea, string[]> = {
  athlet: ["dein Athletenprofil", "dein Training"],
  deepfight: ["dein Kampfprofil", "deine Analysen"],
  wettkampf: ["deine Wettkämpfe"],
};

/** „a", „a und b", „a, b und c" — deutsche Aufzählung, ein Komma zu wenig statt eins zu viel. */
function aufzaehlung(teile: string[]): string {
  if (teile.length <= 1) return teile[0] ?? "";
  return `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}

/**
 * Der Satz unter einem Namen — er FOLGT der Auswahl (siehe Kopfkommentar).
 * Bewusst positiv formuliert: „sieht aktuell nur deinen Namen" statt „sieht
 * nichts" (Sprachregel, Verneinung ist keine Erklärung).
 *
 * `moeglich` sagt, wie viele Bereiche dieses Konto überhaupt vergeben kann —
 * ein Athlet nur einen. Alle vergebbaren zusammen bekommen einen eigenen
 * Satz: Die volle Aufzählung wäre fünf Glieder lang und sagt weniger als
 * „alles von dir".
 */
export function satzFuerPerson(
  bereiche: ShareArea[],
  moeglich: number = SICHTBARE_BEREICHE.length,
): string {
  if (bereiche.length === 0) return "Sieht aktuell nur deinen Namen.";
  if (moeglich === SICHTBARE_BEREICHE.length && bereiche.length === moeglich) {
    return "Sieht alles von dir und betreut dich wie einen Athleten.";
  }
  const teile = SICHTBARE_BEREICHE.filter((b) => bereiche.includes(b)).flatMap(
    (b) => GLIEDER[b],
  );
  return `Sieht ${aufzaehlung(teile)}.`;
}
