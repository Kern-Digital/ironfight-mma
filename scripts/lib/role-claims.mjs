/**
 * Das Rollen-Set für Node-Scripts — die JS-Zwillingsfassung von
 * `lib/roles.ts` (Multi-Gym Phase 2, Checkpoint 3).
 *
 * WARUM ES DIESE DATEI ÜBERHAUPT GIBT: Die Scripts laufen als reines
 * `.mjs` unter Node und können `lib/roles.ts` nicht importieren — dieselbe
 * Grenze, wegen der `scripts/migrate-multi-gym.mjs` das Default-Gym als
 * Konstante trägt statt `lib/gym.ts` zu lesen. Deshalb steht die Logik hier
 * EIN zweites Mal, nicht in jedem Script erneut.
 *
 * QUELLE DER WAHRHEIT BLEIBT `lib/roles.ts`. Wer dort etwas ändert, ändert es
 * hier mit — sonst schreiben Scripts und App verschiedene Claims, und der
 * Unterschied fällt erst auf, wenn jemand nicht mehr hineinkommt.
 */

/** Liest die gesetzten Häkchen, mit Rückfall aufs alte `role`. */
export function readRoleSet(claims) {
  const c = claims ?? {};
  const legacy = typeof c.role === "string" ? c.role : null;
  return {
    trainer: c.trainer === true || legacy === "trainer",
    verwaltung: c.verwaltung === true,
    admin: c.admin === true || legacy === "admin",
  };
}

/** Der Übergangs-Spiegel `role` — damit ein Rules-Rollback keine Aussperrung ist. */
export function legacyRole(rights) {
  if (rights.admin) return "admin";
  if (rights.trainer) return "trainer";
  return "user";
}

const MANAGED = ["role", "trainer", "verwaltung", "admin"];

/**
 * Baut die Custom Claims. Fremde Claims (vor allem `gymId`) werden
 * durchgereicht — `setCustomUserClaims` ERSETZT alles, und ohne Merge
 * verlöre der Nutzer sein Gym. Geschrieben wird nur, was wahr ist;
 * entzogene Rechte werden gelöscht, nicht auf `false` gesetzt.
 */
export function claimsWithRights(existing, rights) {
  const next = { ...(existing ?? {}) };
  for (const key of MANAGED) delete next[key];
  if (rights.trainer) next.trainer = true;
  if (rights.verwaltung) next.verwaltung = true;
  if (rights.admin) next.admin = true;
  next.role = legacyRole(rights);
  return next;
}

/**
 * Die Spiegel-Felder am users-Dokument. Anders als bei den Claims stehen
 * hier ALLE Werte ausdrücklich — ein `set(..., { merge: true })` ließe
 * fehlende Schlüssel sonst stehen, und ein entzogenes Häkchen bliebe in der
 * Mitgliederliste sichtbar.
 */
export function rightsMirror(rights) {
  return {
    trainer: rights.trainer,
    verwaltung: rights.verwaltung,
    admin: rights.admin,
    role: legacyRole(rights),
  };
}

/** Kurzform für die Script-Ausgabe: „trainer+verwaltung" bzw. „athlet". */
export function rightsText(rights) {
  const parts = [];
  if (rights.admin) parts.push("admin");
  if (rights.trainer) parts.push("trainer");
  if (rights.verwaltung) parts.push("verwaltung");
  return parts.length ? parts.join("+") : "athlet";
}
