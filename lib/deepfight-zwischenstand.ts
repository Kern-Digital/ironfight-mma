/**
 * Angefangene Analysen finden, ohne `VideoAnalysisSection` zu mounten.
 *
 * ─── DAS PROBLEM (Leons Entwurf 08.09.2026, Punkt 8) ────────────────────────
 *
 * Wer eine Analyse abbricht, bekommt auf der Landung ein Feld: „Mach weiter,
 * wo du aufgehört hast." Der gerettete Zwischenstand liegt aber in
 * `VideoAnalysisSection` — und die steht im neuen Fluss zwei Klicks tief. Ohne
 * dieses Feld fände ihn niemand, und die teure Video-Stufe liefe ein zweites
 * Mal auf eigene Rechnung.
 *
 * ─── WARUM HIER GELESEN WIRD UND NICHT DORT ─────────────────────────────────
 *
 * Die Sektion zu mounten, nur um zu FRAGEN, ob etwas angefangen ist, startet
 * ihre Firestore-Abfragen (`listVideoAnalyses`) und ihre Pipeline-Zustände.
 * Für eine Zeile Text wäre das eine Ladung Arbeit pro Landungsbesuch. Also
 * liest diese Datei den `localStorage` direkt — **nur lesend**. Geschrieben
 * wird der Schlüssel ausschließlich von der Sektion.
 *
 * ES WIRD ABSICHTLICH NICHTS GELÖSCHT. Verwerfen bleibt dort, wo der
 * Zwischenstand zu Hause ist: in der Sektion, die weiß, was noch daran hängt.
 * Ein zweiter Löschweg, der nur den Schlüssel entfernt, wäre ein halbes
 * Verwerfen — und die Landung führt ohnehin genau dorthin.
 *
 * ─── DIE FALLE, DIE HIER NICHT GILT — UND WARUM SIE TROTZDEM ERWÄHNT IST ────
 *
 * CLAUDE.md, „Der gespeicherte Formularzustand — eine Falle, teuer gemessen":
 * Die „schon geladen"-Marke der Sektion gehört in den State und trägt den
 * SCHLÜSSEL, nie in ein Ref. Diese Datei hat keine solche Marke — sie liest
 * einmalig und schreibt nie, es gibt kein Fenster zwischen Lesen und
 * Schreiben. Wer sie je um einen Schreibweg erweitert, liest den Absatz dort
 * ZUERST.
 *
 * Der Schlüssel ist der der Sektion: `ta-video-analysis-form:{mode}:{targetId}`
 * mit `mode` aus `AnalysisMode` („athlete" / „opponent") — nicht die
 * Modus-Wörter der Oberfläche („leute" / „gegner"). Diese Datei übersetzt.
 */

import type { DeepFightModus } from "@/components/deepfight/deepfight-modus";

const PRAEFIX = "ta-video-analysis-form:";

/**
 * Wie lange ein Zwischenstand etwas wert ist: Google löscht ein hochgeladenes
 * Video nach 48 Stunden von selbst. Derselbe Wert wie `PENDING_GUELTIG_MS` in
 * `VideoAnalysisSection` — er steht dort bei der Pipeline, hier bei der
 * Anzeige; laufen sie je auseinander, zeigt die Landung ein Angebot, das die
 * Sektion nicht mehr einlösen kann.
 */
export const ZWISCHENSTAND_GUELTIG_MS = 48 * 60 * 60 * 1000;

export interface Zwischenstand {
  modus: DeepFightModus;
  zielId: string;
  /** Dateiname des wartenden Videos, falls einer gespeichert ist. */
  dateiname: string | null;
  /** Liegt das Video schon bei Google? */
  videoLiegt: boolean;
  /** Ist die teure Gemini-Stufe schon durch? */
  ausgewertet: boolean;
  /** Wann der Stand gespeichert wurde (ms). Alte Einträge tragen ihn nicht. */
  gespeichertAm: number | null;
}

/** Nur das, was diese Datei aus dem gespeicherten Zustand braucht. */
type RoherStand = Partial<{
  pendingUpload: { name?: string; fileName?: string } | null;
  pendingObservation: { fingerprint?: string } | null;
  pendingSavedAt: number | null;
}>;

/**
 * Alle angefangenen Analysen, neueste zuerst.
 *
 * Ein Eintrag zählt nur, wenn wirklich etwas Gerettetes darin liegt — ein
 * hochgeladenes Video ODER eine fertige Beobachtung. Ein Schlüssel, in dem nur
 * eine halb getippte Kämpferbeschreibung steht, ist kein Zwischenstand, und
 * ein Feld dafür wäre eine Aufforderung ohne Gegenwert.
 *
 * Abgelaufene Stände (älter als 48 h) fallen raus: Das Video ist dann bei
 * Google weg, und „mach weiter" wäre ein Versprechen, das die Sektion nicht
 * halten kann. Einträge OHNE Zeitstempel (von vor dem 08.09.2026) bleiben
 * drin — sie sind nicht nachweislich abgelaufen, und die Sektion zeigt sie
 * ebenso, nur ohne Restzeit.
 */
export function leseZwischenstaende(): Zwischenstand[] {
  const out: Zwischenstand[] = [];
  let speicher: Storage;
  try {
    speicher = window.localStorage;
  } catch {
    // Privater Modus, blockierte Site-Daten: kein Zwischenstand, kein Feld.
    return out;
  }
  const jetzt = Date.now();

  for (let i = 0; i < speicher.length; i++) {
    const key = speicher.key(i);
    if (!key || !key.startsWith(PRAEFIX)) continue;

    // `{mode}:{targetId}` — der Modus ist das erste Stück, alles danach ist
    // die ID (Firestore-IDs und uids tragen keinen Doppelpunkt, aber ein
    // Split mit Limit ist billiger als die Annahme).
    const rest = key.slice(PRAEFIX.length);
    const trenn = rest.indexOf(":");
    if (trenn <= 0) continue;
    const mode = rest.slice(0, trenn);
    const zielId = rest.slice(trenn + 1);
    if (!zielId) continue;
    if (mode !== "athlete" && mode !== "opponent") continue;

    let s: RoherStand;
    try {
      const roh = speicher.getItem(key);
      if (!roh) continue;
      s = JSON.parse(roh) as RoherStand;
    } catch {
      continue; // defekter Eintrag — überspringen, nie aufräumen
    }

    const videoLiegt = !!s.pendingUpload?.name;
    const ausgewertet = !!s.pendingObservation?.fingerprint;
    if (!videoLiegt && !ausgewertet) continue;

    const gespeichertAm =
      typeof s.pendingSavedAt === "number" ? s.pendingSavedAt : null;
    if (gespeichertAm !== null && jetzt - gespeichertAm >= ZWISCHENSTAND_GUELTIG_MS) {
      continue;
    }

    out.push({
      modus: mode === "opponent" ? "gegner" : "leute",
      zielId,
      dateiname: s.pendingUpload?.fileName ?? null,
      videoLiegt,
      ausgewertet,
      gespeichertAm,
    });
  }

  // Neueste zuerst; Stände ohne Zeitstempel ans Ende (sie sind die ältesten,
  // die es geben kann — das Feld gibt es erst seit dem 08.09.2026).
  return out.sort((a, b) => (b.gespeichertAm ?? 0) - (a.gespeichertAm ?? 0));
}

/** „Noch 41 Stunden gültig" / „Noch 25 Minuten gültig" — null, wenn unbekannt. */
export function restzeitText(gespeichertAm: number | null): string | null {
  if (!gespeichertAm) return null;
  const rest = gespeichertAm + ZWISCHENSTAND_GUELTIG_MS - Date.now();
  if (rest <= 0) return null;
  const stunden = Math.floor(rest / 3_600_000);
  if (stunden >= 1) {
    return `Noch ${stunden} ${stunden === 1 ? "Stunde" : "Stunden"} gültig`;
  }
  const minuten = Math.max(1, Math.round(rest / 60_000));
  return `Noch ${minuten} ${minuten === 1 ? "Minute" : "Minuten"} gültig`;
}
