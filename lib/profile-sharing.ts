/**
 * Freigabe des eigenen Profils an Trainerkollegen — die BEREICHE.
 *
 * Ausgangslage (Leon 03.09.2026): Ein Trainer ist standardmäßig privat. Was
 * ein Kollege von ihm sieht, entscheidet er selbst — und seit Leons Revision
 * am selben Abend **je Bereich getrennt**, nicht als eine Freigabe für alles.
 *
 * WARUM DIESE DATEI EXISTIERT: Der Bereichs-Schlüssel steht an drei Orten —
 * in `firestore.rules` (`hatFreigabe(d, bereich)`), im geschriebenen Dokument
 * und in der Oberfläche. Drei Orte, an denen sich ein Tippfehler verstecken
 * kann, ohne dass irgendetwas kaputtgeht: Eine Freigabe auf einen Schlüssel,
 * den die Regel nicht kennt, wirkt einfach nicht. Deshalb kommen Schlüssel,
 * Beschriftung und Erklärung aus EINER Liste — dasselbe Muster wie
 * `lib/roles.ts` für die Rechte.
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
 * nichts.
 *
 * Geschlossen mit einem materialisierten `ownerIsStaff` am Camp-Dokument
 * (`lib/fight-camp.ts`): Die collectionGroup-Regel liefert seither nur noch
 * Athleten-Camps, die Camps von Stab-Konten laufen ausschließlich über die
 * strenge Regel — und damit über genau diesen Schlüssel.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Ein freigebbarer Bereich. Jeder Schlüssel steht so auch in den Regeln. */
export type ShareArea = "athlet" | "deepfight" | "wettkampf";

/** Was am users-Dokument steht: je Bereich eine Liste von Trainer-uids. */
export type ProfileShares = Partial<Record<ShareArea, string[]>>;

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
}[] = [
  {
    key: "athlet",
    label: "Athletenprofil & Training",
    umfasst:
      "Disziplin, Level, Körperdaten, deine Workouts und deine Rückmeldungen aus dem Kursplan.",
  },
  {
    key: "deepfight",
    label: "Kampfprofil & DeepFight",
    umfasst:
      "Dein Kampfprofil und die Ergebnisse aus deinen DeepFight-Analysen — so kann man dich analysieren wie einen Athleten.",
  },
  {
    key: "wettkampf",
    label: "Wettkämpfe",
    umfasst:
      "Deine Fight Camps mit Gegner, Zeitplan und Phasen — wer das sieht, plant deine Vorbereitung mit und legt dir neue Wettkämpfe an.",
  },
];

/** Die Schlüssel, die in der Oberfläche vorkommen. */
export const SICHTBARE_BEREICHE: ShareArea[] = SHARE_AREAS.map((a) => a.key);

/** Liest die Freigaben aus einem rohen users-Dokument (undefined-fest). */
export function readShares(data: Record<string, unknown> | undefined): ProfileShares {
  const roh = data?.profileShares;
  if (!roh || typeof roh !== "object") return {};
  const out: ProfileShares = {};
  for (const { key } of SHARE_AREAS) {
    const liste = (roh as Record<string, unknown>)[key];
    if (Array.isArray(liste)) {
      out[key] = liste.filter((x): x is string => typeof x === "string");
    }
  }
  return out;
}

/** Darf `viewerUid` diesen Bereich sehen? Die CLIENT-Seite der Regel. */
export function darfSehen(
  shares: ProfileShares | undefined,
  bereich: ShareArea,
  viewerUid: string,
): boolean {
  return (shares?.[bereich] ?? []).includes(viewerUid);
}

/** Alle Bereiche, die dieser eine Mensch sehen darf. */
export function bereicheFuer(
  shares: ProfileShares | undefined,
  viewerUid: string,
): ShareArea[] {
  return SICHTBARE_BEREICHE.filter((b) => darfSehen(shares, b, viewerUid));
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
): string[] {
  return eintraege
    .filter((e) => darfSehen(e.profileShares, bereich, viewerUid))
    .map((e) => e.uid);
}

/** Setzt ein einzelnes Häkchen und gibt die neue Sammlung zurück. */
export function mitBereich(
  shares: ProfileShares,
  bereich: ShareArea,
  uid: string,
  an: boolean,
): ProfileShares {
  const bisher = shares[bereich] ?? [];
  const neu = an
    ? bisher.includes(uid)
      ? bisher
      : [...bisher, uid]
    : bisher.filter((x) => x !== uid);
  return { ...shares, [bereich]: neu };
}

/** Wie viele Menschen sehen mindestens einen Bereich? */
export function anzahlEmpfaenger(shares: ProfileShares | undefined): number {
  const alle = new Set<string>();
  for (const b of SICHTBARE_BEREICHE) {
    for (const uid of shares?.[b] ?? []) alle.add(uid);
  }
  return alle.size;
}

/** Die uids, die mindestens einen Bereich sehen — in stabiler Reihenfolge. */
export function empfaenger(shares: ProfileShares | undefined): string[] {
  const alle: string[] = [];
  for (const b of SICHTBARE_BEREICHE) {
    for (const uid of shares?.[b] ?? []) {
      if (!alle.includes(uid)) alle.push(uid);
    }
  }
  return alle;
}

/** Gleich? Für den „gibt es etwas zu speichern"-Zustand des Sheets. */
export function gleicheShares(a: ProfileShares, b: ProfileShares): boolean {
  for (const bereich of SICHTBARE_BEREICHE) {
    const x = [...(a[bereich] ?? [])].sort();
    const y = [...(b[bereich] ?? [])].sort();
    if (x.length !== y.length) return false;
    if (x.some((v, i) => v !== y[i])) return false;
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
 * Alle Bereiche zusammen bekommen einen eigenen Satz: Die volle Aufzählung
 * wäre fünf Glieder lang und sagt weniger als „alles von dir".
 */
export function satzFuerPerson(bereiche: ShareArea[]): string {
  if (bereiche.length === 0) return "Sieht aktuell nur deinen Namen.";
  if (bereiche.length === SICHTBARE_BEREICHE.length) {
    return "Sieht alles von dir und betreut dich wie einen Athleten.";
  }
  const teile = SICHTBARE_BEREICHE.filter((b) => bereiche.includes(b)).flatMap(
    (b) => GLIEDER[b],
  );
  return `Sieht ${aufzaehlung(teile)}.`;
}
