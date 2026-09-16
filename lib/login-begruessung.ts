/**
 * Die Begrüßung auf der Anmeldeseite — je nachdem, ob auf diesem Gerät schon
 * einmal jemand angemeldet war (Leons Entscheidung 14.09.2026).
 *
 * ─── WARUM EIN COOKIE UND NICHT `localStorage` ─────────────────────────────
 *
 * Ein erster Anlauf legte den Merker in `localStorage` und tauschte den Text
 * in einem Layout-Effekt. GEMESSEN am 14.09.: Auf einem bekannten Gerät stand
 * der Vorgabetext **38 Bilder — rund eine Sekunde — sichtbar da**, bevor er
 * umsprang.
 *
 * Der Grund ist die Reihenfolge, und kein Effekt-Typ ändert sie: Der Server
 * schickt fertiges HTML, der Browser MALT es, und erst danach hängt React sich
 * ein. `useLayoutEffect` läuft vor dem Malen — aber vor dem Malen des ERSTEN
 * Bildes NACH der Hydration, nicht vor dem des Server-HTML. Alles, was nur der
 * Client weiß, kommt für den ersten Anblick zu spät.
 *
 * Ein Cookie kommt dagegen MIT DER ANFRAGE. Der Server weiß beim Rendern
 * bereits Bescheid, und der richtige Text steht im ersten Byte. Kein
 * Umspringen, und es funktioniert sogar, bevor JavaScript geladen ist.
 *
 * Der Merker sagt nur „hier war schon mal jemand angemeldet" — kein
 * Konto-Bezug, keine Kennung, kein Verlauf. Er kann verschwinden (geleerte
 * Browserdaten, privates Fenster, anderer Browser); dann sieht man wieder die
 * Begrüßung für Neue. Das ist kein Fehler, sondern der einzig ehrliche
 * Zustand: Wir WISSEN es dann nicht mehr.
 *
 * RECHTLICH IST ER NICHT „EINFACH SO ERLAUBT": § 25 TDDDG gilt für JEDE
 * Speicherung auf dem Endgerät, für Cookies wie für `localStorage`, und nimmt
 * nur aus, was für den ausdrücklich gewünschten Dienst UNBEDINGT ERFORDERLICH
 * ist. Eine persönlichere Begrüßung ist das nicht. Der Merker gehört deshalb
 * in dasselbe Paket wie AGB, Datenschutzhinweise und AVV (Backlog: „vor der
 * ersten Zahlung fällig") — entweder in die Hinweise aufgenommen oder an eine
 * Einwilligung gehängt.
 *
 * ─── DIE TEXTE ─────────────────────────────────────────────────────────────
 *
 * Beide Sätze sind LISTEN, obwohl heute je genau ein Eintrag darin steht.
 * Leons Plan (14.09.): Es sollen mehrere Fassungen werden, die sich zufällig
 * abwechseln, „damit nicht jeder Login gleich aussieht" — die weiteren Texte
 * kommen später. Wer eine ergänzt, schreibt einen Eintrag mehr in die Liste;
 * die Auswahl unten nimmt ihn ohne weitere Änderung mit.
 *
 * Die kleine Zeile über der Überschrift bleibt bewusst KONSTANT. Änderten
 * sich alle drei Zeilen gleichzeitig, wirkte die Karte bei jedem Aufruf wie
 * eine andere Seite. Sie nennt die Marke — auf `/login` gibt es keinen
 * Gym-Kontext (ausgeloggt, kein Code), dort steht das Tidal-Zeichen und der
 * Standard-Akzent.
 */

export type Begruessung = {
  eyebrow: string;
  title: string;
  sub: string;
};

export const MERKER = "ta-geraet-bekannt";
/** Ein Jahr. Danach ist ein Gerät, auf dem niemand mehr war, wieder „neu". */
const MERKER_DAUER = 60 * 60 * 24 * 365;

/** Niemand war auf diesem Gerät je angemeldet — oder wir wissen es nicht. */
export const NEUES_GERAET: Begruessung[] = [
  {
    eyebrow: "Tidal Athletics",
    title: "Entfessle dein Potenzial",
    sub: "Hocheffiziente Trainings, Athletenplanung und DeepFight-Auswertungen warten auf dich.",
  },
];

/** Hier hat sich schon einmal jemand erfolgreich angemeldet. */
export const BEKANNTES_GERAET: Begruessung[] = [
  {
    eyebrow: "Tidal Athletics",
    title: "Schön, dass du wieder da bist",
    sub: "Bau deine Fight-DNA weiter aus — mit einer neuen DeepFight-Analyse.",
  },
];

/**
 * Die Wahl fällt auf dem SERVER, beim Rendern — dort ist der Cookie bekannt.
 * `bekannt` kommt aus `cookies()` der Anmeldeseite.
 */
export function waehleBegruessung(bekannt: boolean): Begruessung {
  const satz = bekannt ? BEKANNTES_GERAET : NEUES_GERAET;
  return satz[Math.floor(Math.random() * satz.length)];
}

/**
 * Nach jeder erfolgreichen Anmeldung aufrufen (Client).
 *
 * `SameSite=Lax` reicht: Der Merker wird nur beim Aufruf der eigenen Seite
 * gebraucht, nie aus einem fremden Kontext heraus. KEIN `Secure`-Anhang, weil
 * die Entwicklung über `http://localhost` läuft und der Browser den Cookie
 * sonst verwürfe — in Produktion läuft ohnehin alles über HTTPS, und der
 * Merker trägt nichts Schützenswertes.
 */
export function merkeGeraet(): void {
  try {
    document.cookie = `${MERKER}=1; max-age=${MERKER_DAUER}; path=/; SameSite=Lax`;
  } catch {
    /* Speicher gesperrt — dann bleibt das Gerät eben „neu". */
  }
}
