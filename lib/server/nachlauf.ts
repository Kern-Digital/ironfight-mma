/**
 * Arbeit NACH der Antwort einer Route weiterlaufen lassen (Gameplan-Nachlauf).
 *
 * WARUM NICHT `@vercel/functions`: Das Paket (v3) bringt über `@vercel/oidc`
 * eine `jose` v6 mit, die nur als ES-Modul läuft. In der Vercel-Funktion lud
 * `jwks-rsa` (firebase-admin) danach diese Fassung per `require()` —
 * ERR_REQUIRE_ESM, jede Route mit dem Import antwortete 500, darunter
 * /api/video-analysis/commit (gemessen 17.09.2026 nach dem Push b770354, lokal
 * mit Node 24 unsichtbar, weil Node 24 `require(esm)` kann).
 *
 * Diese Datei tut dasselbe wie `waitUntil` aus dem Paket: Sie holt den
 * Anfrage-Kontext, den die Vercel-Laufzeit unter
 * `Symbol.for("@vercel/request-context")` ablegt, und reicht das Promise an
 * dessen `waitUntil`. Außerhalb von Vercel (next dev, Skripte) gibt es keinen
 * Kontext — dann läuft das Promise im Prozess einfach weiter.
 */

type AnfrageKontext = { waitUntil?: (p: Promise<unknown>) => void };

const KONTEXT = Symbol.for("@vercel/request-context");

export function nachAntwortWeiter(arbeit: Promise<unknown>): void {
  const halter = (globalThis as unknown as Record<symbol, { get?: () => AnfrageKontext } | undefined>)[KONTEXT];
  const kontext = halter?.get?.() ?? {};
  // Ein Fehler im Nachlauf darf nie als unbehandelte Ablehnung enden.
  const sicher = arbeit.catch(() => {});
  kontext.waitUntil?.(sicher);
}
