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
 * WARUM „WETTKÄMPFE" HIER (NOCH) FEHLT — gemessen am 03.09.2026, nicht
 * angenommen: Der Bereich hat in `firestore.rules` zwei Regeln, und die
 * großzügigere gewinnt. `match /{path=**}/fightCamps/{campId}` matcht nicht
 * nur collectionGroup-Queries, sondern denselben Pfad wie
 * `match /users/{uid}/fightCamps/{campId}` — und prüft dort nur `sameGym`.
 * Firestore-Regeln sind ODER-verknüpft: Eine strengere Regel daneben schränkt
 * nichts ein.
 *
 * Per REST mit echten ID-Tokens belegt (Trainer A auf Trainer B, kein
 * Freigabe-Eintrag): Camp direkt lesen → **200**, `athleteProfile` desselben
 * Kollegen → 403, Camp aus fremdem Gym → 403. Und nach erteilter Freigabe:
 * unverändert 200 — die Freigabe bewirkt für Camps schlicht nichts.
 *
 * Ein Häkchen „Wettkämpfe" wäre damit eine falsche Sicherheitsaussage. Es
 * kommt hinzu, sobald die collectionGroup-Regel Stab-Camps aussortieren kann
 * (materialisiertes `ownerIsStaff` am Camp, Muster `trainerPlans.audienceUids`)
 * — Schritt 2b, Bauplan im CLAUDE.md-Backlog. Die Regel für den DIREKTEN Pfad
 * fragt schon heute nach dem Schlüssel `"wettkampf"`; es kann ihn nur noch
 * niemand setzen.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Ein freigebbarer Bereich. `wettkampf` steht in den Regeln, aber noch nicht
    in der Oberfläche (Begründung im Kopfkommentar). */
export type ShareArea = "athlet" | "deepfight" | "wettkampf";

/** Was am users-Dokument steht: je Bereich eine Liste von Trainer-uids. */
export type ProfileShares = Partial<Record<ShareArea, string[]>>;

/**
 * Die Bereiche, die ein Mensch heute vergeben kann — in der Reihenfolge, in
 * der sie im Sheet stehen.
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
      "Dein Kampfprofil und deine Video-Analysen — wer das sieht, darf dich auch analysieren wie einen Athleten.",
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
  // `wettkampf` wird mitgelesen, obwohl es die Oberfläche noch nicht vergibt —
  // sonst löschte ein Speichern aus dem Sheet einen später gesetzten Wert.
  const wk = (roh as Record<string, unknown>).wettkampf;
  if (Array.isArray(wk)) {
    out.wettkampf = wk.filter((x): x is string => typeof x === "string");
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
 * Der Satz unter einem Namen — er FOLGT der Auswahl (siehe Kopfkommentar).
 * Bewusst positiv formuliert: „bleibt bei dir" statt „sieht nichts"
 * (Sprachregel, Verneinung ist keine Erklärung).
 */
export function satzFuerPerson(bereiche: ShareArea[]): string {
  if (bereiche.length === 0) {
    return "Sieht deinen Namen in der Mitgliederliste — mehr bleibt bei dir.";
  }
  if (bereiche.length === SICHTBARE_BEREICHE.length) {
    return "Sieht dein Profil, dein Training, dein Kampfprofil und deine Analysen — und betreut dich wie einen Athleten.";
  }
  if (bereiche[0] === "athlet") {
    return "Sieht dein Athletenprofil und dein Training.";
  }
  return "Sieht dein Kampfprofil und deine Analysen — und darf dich analysieren.";
}
