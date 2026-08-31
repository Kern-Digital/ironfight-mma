"use client";

/**
 * Wohin nach erfolgreicher Anmeldung? (Multi-Gym Phase 2, Checkpoint 1C)
 *
 * Ein Eingeladener kommt über /beitreten/{code} und wird von dort auf
 * /login bzw. /register geschickt — der Code reist als `?invite=` mit. Ohne
 * diesen Helfer landete er anschließend auf /dashboard, und die Einladung
 * wäre verloren: Er müsste den Link ein zweites Mal öffnen.
 *
 * GELESEN WIRD ÜBER useSearchParams, NICHT ÜBER window.location.
 * Das war ein echter Fehler (Leon 31.08., gemessen): Beim Wechsel innerhalb
 * der App rendert Next die Zielseite, BEVOR es die Adresszeile umschreibt.
 * 150 ms nach dem Klick auf „Jetzt loslegen" stand in `window.location` noch
 * /beitreten/{code} — der Code war für die Registrierung damit unsichtbar,
 * und der frisch registrierte Nutzer landete auf dem Dashboard statt bei
 * seiner Einladung. `useSearchParams` liest aus dem Router-Zustand und ist
 * schon beim ersten Render richtig.
 *
 * PREIS: useSearchParams zwingt die aufrufende Seite in eine
 * Suspense-Grenze (Next 14). Login und Registrierung haben deshalb einen
 * dünnen Wrapper bekommen — beim Verschieben dieses Hooks daran denken.
 *
 * Der Code wird auf Form geprüft, bevor daraus ein Ziel wird — ein
 * manipuliertes `?invite=` kann so nur auf /beitreten/… zeigen.
 */

import { useSearchParams } from "next/navigation";
import {
  inviteJoinPath,
  isPlausibleInviteCode,
  normalizeInviteCode,
} from "./invites";

export function useAfterAuthTarget(fallback = "/dashboard"): string {
  const params = useSearchParams();
  const code = normalizeInviteCode(params.get("invite") ?? "");
  return isPlausibleInviteCode(code) ? inviteJoinPath(code) : fallback;
}

/**
 * Anhang, der den Code beim Wechsel zwischen Login und Registrierung erhält —
 * ohne ihn verliert der Eingeladene die Einladung, sobald er merkt, dass er
 * auf der falschen der beiden Seiten steht.
 */
export function inviteQueryFor(target: string): string {
  const prefix = "/beitreten/";
  return target.startsWith(prefix)
    ? `?invite=${target.slice(prefix.length)}`
    : "";
}
