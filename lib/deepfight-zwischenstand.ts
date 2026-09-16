/**
 * Angefangene Analysen finden, ohne den Upload-Fluss zu mounten.
 *
 * ─── DAS PROBLEM (Leons Entwurf 08.09.2026, Punkt 8) ────────────────────────
 *
 * Wer eine Analyse abbricht, bekommt auf der Landung ein Feld: „Mach weiter,
 * wo du aufgehört hast." Der gerettete Zwischenstand liegt aber im
 * `localStorage` des Upload-Flusses — und der steht einen Klick tief. Ohne
 * dieses Feld fände ihn niemand, und die teure Video-Stufe liefe ein zweites
 * Mal auf eigene Rechnung.
 *
 * ─── WARUM HIER GELESEN WIRD UND NICHT DORT ─────────────────────────────────
 *
 * Den Fluss zu mounten, nur um zu FRAGEN, ob etwas angefangen ist, startet
 * seine Firestore-Abfragen und seine Pipeline-Zustände. Für eine Zeile Text
 * wäre das eine Ladung Arbeit pro Landungsbesuch. Also liest diese Datei den
 * `localStorage` direkt — **nur lesend**. Geschrieben wird der Schlüssel
 * ausschließlich vom Fluss.
 *
 * ES WIRD ABSICHTLICH NICHTS GELÖSCHT. Verwerfen bleibt dort, wo der
 * Zwischenstand zu Hause ist: im Fluss, der weiß, was noch daran hängt.
 *
 * ─── SEIT ETAPPE 2 (16.09.2026): DER SCHLÜSSEL TRÄGT KEIN ZIEL MEHR ─────────
 *
 * Der Ablauf ist umgedreht — erst Upload, dann Vorlauf, dann Zuordnung. Ein
 * Zwischenstand kann also kein `{mode}:{targetId}` mehr tragen, bevor
 * zugeordnet ist. Der Schlüssel heißt jetzt
 * `ta-video-analysis-form:upload:{uploadId}`; das Ziel steht IM Stand (die
 * Zuordnungen), nicht im Schlüssel. Ältere Schlüssel mit Ziel gehören zum
 * alten Ablauf, den es nicht mehr gibt — sie werden ignoriert (Bestand ist
 * Demo, Leon 16.09.).
 *
 * ─── DIE FALLE, DIE HIER NICHT GILT — UND WARUM SIE TROTZDEM ERWÄHNT IST ────
 *
 * CLAUDE.md, „Der gespeicherte Formularzustand — eine Falle, teuer gemessen":
 * Die „schon geladen"-Marke des Flusses gehört in den State und trägt den
 * SCHLÜSSEL, nie in ein Ref. Diese Datei hat keine solche Marke — sie liest
 * einmalig und schreibt nie, es gibt kein Fenster zwischen Lesen und
 * Schreiben. Wer sie je um einen Schreibweg erweitert, liest den Absatz dort
 * ZUERST.
 */

const PRAEFIX = "ta-video-analysis-form:upload:";

/** Der Schlüssel eines Upload-Standes — EINE Stelle für Leser und Schreiber. */
export function zwischenstandKey(uploadId: string): string {
  return `${PRAEFIX}${uploadId}`;
}

/**
 * Wie lange ein Zwischenstand etwas wert ist: Google löscht ein hochgeladenes
 * Video nach 48 Stunden von selbst. Derselbe Wert wie `PENDING_GUELTIG_MS`
 * im Fluss — er steht dort bei der Pipeline, hier bei der Anzeige; laufen sie
 * je auseinander, zeigt die Landung ein Angebot, das der Fluss nicht mehr
 * einlösen kann.
 */
export const ZWISCHENSTAND_GUELTIG_MS = 48 * 60 * 60 * 1000;

export interface Zwischenstand {
  uploadId: string;
  /** Dateiname bzw. YouTube-Link des wartenden Videos. */
  quelle: string | null;
  /** Liegt das Video schon bei Google (bzw. ist der Link gemerkt)? */
  videoLiegt: boolean;
  /** Ist der Vorlauf durch — warten die Karten auf eine Zuordnung? */
  zugeordnet: boolean;
  /** Ist mindestens eine teure Beobachtung schon durch? */
  ausgewertet: boolean;
  /** Wann der Stand gespeichert wurde (ms). */
  gespeichertAm: number | null;
}

/** Nur das, was diese Datei aus dem gespeicherten Zustand braucht. */
type RoherStand = Partial<{
  sourceKind: "upload" | "youtube";
  youtubeUrl: string;
  pendingUpload: { name?: string; fileName?: string } | null;
  preview: { fighters?: unknown[] } | null;
  zuordnungen: ({ person?: { id?: string } | null; ignoriert?: boolean } | null)[];
  beobachtungen: Record<string, unknown>;
  pendingSavedAt: number | null;
}>;

/**
 * Alle angefangenen Analysen, neueste zuerst.
 *
 * Ein Eintrag zählt nur, wenn wirklich etwas Gerettetes darin liegt — ein
 * hochgeladenes Video (oder ein gemerkter Link mit Vorlauf). Ein Schlüssel
 * mit einer halb gewählten Datei ist kein Zwischenstand.
 *
 * Abgelaufene Stände (älter als 48 h) fallen raus: Das Video ist dann bei
 * Google weg, und „mach weiter" wäre ein Versprechen, das der Fluss nicht
 * halten kann.
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
    const uploadId = key.slice(PRAEFIX.length);
    if (!uploadId) continue;

    let s: RoherStand;
    try {
      const roh = speicher.getItem(key);
      if (!roh) continue;
      s = JSON.parse(roh) as RoherStand;
    } catch {
      continue; // defekter Eintrag — überspringen, nie aufräumen
    }

    const videoLiegt =
      !!s.pendingUpload?.name || (s.sourceKind === "youtube" && !!s.youtubeUrl && !!s.preview);
    if (!videoLiegt) continue;

    const gespeichertAm =
      typeof s.pendingSavedAt === "number" ? s.pendingSavedAt : null;
    if (gespeichertAm !== null && jetzt - gespeichertAm >= ZWISCHENSTAND_GUELTIG_MS) {
      continue;
    }

    out.push({
      uploadId,
      quelle: s.pendingUpload?.fileName ?? s.youtubeUrl ?? null,
      videoLiegt,
      zugeordnet: (s.zuordnungen ?? []).some((z) => !!z?.person?.id && !z.ignoriert),
      ausgewertet: Object.keys(s.beobachtungen ?? {}).length > 0,
      gespeichertAm,
    });
  }

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
