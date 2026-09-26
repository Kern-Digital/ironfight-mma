"use client";

/**
 * DIE GYM-FARBE IN DER GANZEN APP — Branding-Kit (Konzept §8, 24.09.2026).
 *
 * Setzt --accent-h und --accent-c am <html>-Element auf die Farbe des Gyms.
 * Mehr braucht es nicht: Hintergrund, Rand, Schrift, Glas, Knopf und Glühen
 * leiten sich daraus ab (globals.css, Kopf des Token-Systems).
 *
 * ─── WARUM AM <html> UND NICHT IRGENDWO TIEFER ──────────────────────────────
 *
 * Dort stehen auch die Vorgabewerte, und die abgeleiteten Tokens sind an
 * derselben Stelle deklariert — die Rechnung läuft also ohne zusätzliches
 * data-theme neu. Ein Stil direkt am Element schlägt dabei jede Regel aus dem
 * Stylesheet.
 *
 * ─── WAS TROTZDEM BERNSTEIN BLEIBT ──────────────────────────────────────────
 *
 * Die Bereiche setzen ihre eigene Farbe auf einem TIEFEREN Element
 * ([data-area="verwaltung"], [data-area="admin"]). Eine Deklaration weiter
 * unten gewinnt für ihren Teilbaum — die Verwaltung bleibt also bernstein,
 * die Plattform karmin, und die Gym-Farbe trägt alles andere. Genau so war
 * die Bereichsfarbe gedacht.
 *
 * ─── OHNE BRANDING-KIT ──────────────────────────────────────────────────────
 *
 * Steht nichts am Gym, wird nichts gesetzt und der Tidal-Ton gilt. Beim
 * Abmelden oder Gym-Wechsel räumt der Effekt selbst auf; sonst trüge das
 * nächste Konto die Farbe des vorigen.
 */

import { useAuth } from "@/lib/auth-context";
import { decodeGymAbo, leistungenFuer } from "@/lib/abo";
import { KEIN_GYM, decodeBranding, resolveGymId } from "@/lib/gym";
import { useEffect } from "react";

/**
 * Setzt eine Farbe als --accent-h/--accent-c ans <html> und räumt sie beim
 * Verlassen wieder ab. `null` heißt: Tidal-Ton.
 *
 * Auch die Beitritts-Seite nimmt diesen Weg — dort ist noch niemand
 * angemeldet, die Farbe kommt aus der Einladungs-Vorschau.
 */
export function useAkzentAmRoot(akzent: { h: number; c: number } | null | undefined) {
  // Die ZAHLEN sind die Abhängigkeit, nicht das Objekt: Der Aufrufer baut es
  // bei jedem Rendern neu, und am Objekt hängend liefe der Effekt endlos.
  const h = akzent?.h ?? null;
  const c = akzent?.c ?? null;
  useEffect(() => {
    const wurzel = document.documentElement;
    if (h == null || c == null) {
      wurzel.style.removeProperty("--accent-h");
      wurzel.style.removeProperty("--accent-c");
      return;
    }
    wurzel.style.setProperty("--accent-h", String(h));
    wurzel.style.setProperty("--accent-c", String(c));
    return () => {
      wurzel.style.removeProperty("--accent-h");
      wurzel.style.removeProperty("--accent-c");
    };
  }, [h, c]);
}

export default function GymBrandingTokens() {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);

  useEffect(() => {
    const wurzel = document.documentElement;
    const abraeumen = () => {
      wurzel.style.removeProperty("--accent-h");
      wurzel.style.removeProperty("--accent-c");
    };
    if (!user || !gymId || gymId === KEIN_GYM) {
      abraeumen();
      return;
    }

    let lebt = true;
    const holen = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { getFirestoreDb } = await import("@/lib/firebase");
        const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
        if (!lebt) return;
        // DIE STUFE ENTSCHEIDET, NICHT DAS GESPEICHERTE. Wer von Gym auf Team
        // wechselt, trägt wieder den Tidal-Look — sonst wäre das Branding-Kit
        // ein Schalter, den man einmal für einen Monat kauft und für immer
        // behalt. Gelöscht wird nichts: Beim nächsten Aufstieg steht die
        // Farbe wieder da, wo sie war.
        const stufe = decodeGymAbo(snap.get("subscription")).plan;
        const b = decodeBranding(snap.get("branding"));
        if (!leistungenFuer(stufe).branding || b.akzentH == null || b.akzentC == null) {
          abraeumen();
          return;
        }
        wurzel.style.setProperty("--accent-h", String(b.akzentH));
        wurzel.style.setProperty("--accent-c", String(b.akzentC));
      } catch {
        // Lesefehler: beim Tidal-Ton bleiben. Eine App ohne Gym-Farbe ist
        // richtig, eine App mit halber Farbpalette wäre kaputt.
        if (lebt) abraeumen();
      }
    };

    void holen();
    // Die Verwaltungsseite meldet sich, wenn jemand gerade gespeichert hat —
    // dann steht die neue Farbe ohne Neuladen.
    const nochmal = () => void holen();
    window.addEventListener("tidal:branding", nochmal);
    return () => {
      lebt = false;
      window.removeEventListener("tidal:branding", nochmal);
    };
  }, [user, gymId]);

  return null;
}
