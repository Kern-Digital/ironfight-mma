/**
 * DIE USt-IdNr. EINES GYMS PRÜFEN — Schritt 3 (21.09.2026).
 *
 * Leon 21.09.: USt-IdNr. „Erst beim Kauf (Empfohlen)" — mit BZSt-Prüfung,
 * Reverse Charge bei EU-Ausland (Konzept §6). Wozu die Prüfung da ist: Ein Gym
 * im EU-Ausland zahlt nur dann OHNE deutsche Umsatzsteuer, wenn seine Nummer
 * am Tag des Kaufs gültig war — und das muss Tidal belegen können. Deshalb
 * speichert die Route das Ergebnis samt Kennung der Abfrage am Gym.
 *
 * ZWEI WEGE, einer gewinnt (Recherche 21.09.2026, beide live angefragt):
 *   BZSt (`https://api.evatr.vies.bzst.de/app/v1/abfrage`) — der deutsche
 *        Weg mit Vertrauensschutz. Verlangt die EIGENE deutsche USt-IdNr.
 *        (`anfragendeUstid`); ohne sie antwortet der Dienst mit evatr-0002.
 *        Darum erst, wenn `EIGENE_UST_ID` gesetzt ist. Die alte
 *        XML-RPC-Schnittstelle ist seit dem 30.11.2025 abgeschaltet.
 *   VIES (`https://ec.europa.eu/taxation_customs/vies/rest-api`) — der Weg
 *        der EU-Kommission, ohne eigene Nummer. Bis Leon ein Gewerbe hat,
 *        der einzige.
 * Deutsche Nummern prüft keiner von beiden für uns (BZSt: evatr-0006 „nicht
 * berechtigt"): Bei DE reicht das Format — ein deutsches Gym zahlt ohnehin
 * 19 %, die Nummer steht nur auf der Rechnung.
 *
 * Greift eine Prüfung ins Leere (Wartung 23–5 Uhr, ein Mitgliedstaat offline),
 * sagt die Route das so — sie rechnet NICHT still mit 19 %, denn das Gym hat
 * seine Nummer ja angegeben, um genau das nicht zu zahlen.
 */

/** EU-Präfixe. Griechenland heißt EL, Nordirland XI. */
const EU = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI",
]);

export type UstPruefung =
  | { ok: true; ustId: string; land: string; reverseCharge: boolean; quelle: "format" | "bzst" | "vies"; kennung: string | null }
  | { ok: false; grund: "format" | "ungueltig" | "nicht-erreichbar"; text: string };

/** „atu 123.456-78" → „ATU12345678"; GR wird EL. */
export function normalisiereUstId(roh: string): string {
  const s = roh.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.startsWith("GR") ? `EL${s.slice(2)}` : s;
}

const FORMAT_TEXT =
  "Die USt-IdNr. passt nicht ins Format. Sie beginnt mit dem Länderkürzel, zum Beispiel DE123456789 oder ATU12345678.";
const UNGUELTIG_TEXT =
  "Die USt-IdNr. ist laut Prüfstelle nicht gültig. Prüf die Nummer, oder lass das Feld leer — dann rechnen wir mit 19 % deutscher USt.";
const WEG_TEXT =
  "Die Prüfstelle für USt-IdNrn. antwortet gerade nicht. Versuch es in ein paar Minuten noch einmal.";

async function mitFrist(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function perBzst(eigene: string, ustId: string): Promise<UstPruefung> {
  try {
    const res = await mitFrist("https://api.evatr.vies.bzst.de/app/v1/abfrage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anfragendeUstid: eigene, angefragteUstid: ustId }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; status?: string };
    // Auf den Status-Text verzweigen, nicht auf den HTTP-Code — Liste und
    // Spezifikation des BZSt widersprechen sich bei den Codes.
    const st = data.status ?? "";
    if (st === "evatr-0000" || st === "evatr-2008") {
      return { ok: true, ustId, land: ustId.slice(0, 2), reverseCharge: true, quelle: "bzst", kennung: data.id ?? null };
    }
    if (["evatr-2001", "evatr-2002", "evatr-2006", "evatr-0004", "evatr-0005", "evatr-0012", "evatr-2003"].includes(st)) {
      return { ok: false, grund: "ungueltig", text: UNGUELTIG_TEXT };
    }
    return { ok: false, grund: "nicht-erreichbar", text: WEG_TEXT };
  } catch {
    return { ok: false, grund: "nicht-erreichbar", text: WEG_TEXT };
  }
}

async function perVies(ustId: string): Promise<UstPruefung> {
  try {
    const res = await mitFrist("https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countryCode: ustId.slice(0, 2), vatNumber: ustId.slice(2) }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      valid?: boolean;
      requestIdentifier?: string;
      actionSucceed?: boolean;
      errorWrappers?: { error?: string }[];
    };
    // Fehler kommen bei VIES mit HTTP 200 und `actionSucceed: false`.
    if (data.actionSucceed === false || data.errorWrappers?.length) {
      const fehler = data.errorWrappers?.[0]?.error ?? "";
      if (fehler === "INVALID_INPUT") return { ok: false, grund: "format", text: FORMAT_TEXT };
      return { ok: false, grund: "nicht-erreichbar", text: WEG_TEXT };
    }
    if (data.valid === true) {
      return { ok: true, ustId, land: ustId.slice(0, 2), reverseCharge: true, quelle: "vies", kennung: data.requestIdentifier || null };
    }
    if (data.valid === false) return { ok: false, grund: "ungueltig", text: UNGUELTIG_TEXT };
    return { ok: false, grund: "nicht-erreichbar", text: WEG_TEXT };
  } catch {
    return { ok: false, grund: "nicht-erreichbar", text: WEG_TEXT };
  }
}

/**
 * Prüft die Nummer. Leer → `null` (keine Angabe, 19 % im Regel-Modus).
 * `EIGENE_UST_ID` = Tidals eigene deutsche Nummer, sobald es sie gibt.
 *
 * `nurFormat` für den Kleinunternehmer-Modus: Dort hängt keine Steuer an der
 * Nummer, sie steht nur auf der Rechnung — eine Prüfstelle in Wartung soll
 * dann keinen Kauf aufhalten.
 */
export async function pruefeUstId(
  roh: string | null | undefined,
  nurFormat = false,
): Promise<UstPruefung | null> {
  const ustId = normalisiereUstId(roh ?? "");
  if (!ustId) return null;
  const land = ustId.slice(0, 2);
  if (!EU.has(land) || ustId.length < 4 || ustId.length > 14) {
    return { ok: false, grund: "format", text: FORMAT_TEXT };
  }
  if (land === "DE") {
    return /^DE\d{9}$/.test(ustId)
      ? { ok: true, ustId, land, reverseCharge: false, quelle: "format", kennung: null }
      : { ok: false, grund: "format", text: FORMAT_TEXT };
  }
  if (nurFormat) return { ok: true, ustId, land, reverseCharge: false, quelle: "format", kennung: null };
  const eigene = normalisiereUstId(process.env.EIGENE_UST_ID ?? "");
  return /^DE\d{9}$/.test(eigene) ? perBzst(eigene, ustId) : perVies(ustId);
}
