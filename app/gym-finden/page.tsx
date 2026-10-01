"use client";

/**
 * /gym-finden — der Weg in ein Gym (Leon 30.09.2026: „eine seite … wo er alle
 * gym's sieht die Tidal athletics nutzen … über ortsnamen oder plz oder
 * standort freigabe, sich im beliebigen radius, oder frei gyms anzeigen
 * lassen mit dabei eine interaktive karte").
 *
 * ETAPPE 3 (01.10.2026): Liste und Karte. Die Gyms kommen von
 * `POST /api/gyms/suche` — nur Gyms, deren Verwaltung auf „Kontakt &
 * Standort" eine Adresse eingetragen hat und den Schalter an lässt.
 *
 * ─── WAS IM BROWSER BLEIBT ──────────────────────────────────────────────────
 *
 * Die Liste ist für alle dieselbe; alles Persönliche passiert im Gerät:
 *   • PLZ oder Ort: eingebaute Tabelle (lib/plz.ts), keine fremde Anfrage.
 *   • „Meinen Standort nutzen": `navigator.geolocation`, einmal, auf Knopf.
 *     Der Standort wird nicht gespeichert und nicht gesendet — er ist nur
 *     die Mitte, um die der Umkreis gerechnet wird.
 *   • Umkreis und Entfernung: Luftlinie, gerechnet in `entfernungKm`.
 * Die EINE fremde Adresse ist der Kachel-Dienst der Karte (OpenFreeMap).
 *
 * ─── OHNE MITTE STEHEN ALLE DA ──────────────────────────────────────────────
 *
 * Die Seite öffnet mit allen Gyms, nach Namen sortiert („frei anzeigen").
 * Erst eine Mitte (PLZ, Ort, Standort) bringt den Umkreis-Regler und sortiert
 * nach Entfernung. „Alle anzeigen" nimmt die Mitte wieder weg.
 *
 * ETAPPE 4: Je Gym der Knopf „Probetraining vereinbaren" (AnfrageSheet,
 * lib/gym-anfrage.ts). Wer schon angefragt hat, sieht statt des Knopfs das
 * Datum — die Route gibt die EIGENEN offenen Anfragen mit.
 *
 * Die Seite gehört zu den drei Seiten, die ein Konto ohne Gym sehen darf
 * (OhneGymGate); Mitglieder dürfen sie ebenfalls öffnen.
 */

import AnfrageSheet, { type AnfrageZiel } from "@/components/AnfrageSheet";
import AthleteTabBar from "@/components/AthleteTabBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import GymKarte from "@/components/karte/GymKarte";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useAuth, useHasStaffShell } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { anfrageTag } from "@/lib/gym-anfrage";
import { adressZeile, websiteKurz, type SuchGym } from "@/lib/gym-kontakt";
import { UMKREIS_START, UMKREIS_STUFEN, kmText, ladeSuchGyms } from "@/lib/gym-suche";
import {
  PLZ_QUELLE_TEXT,
  entfernungKm,
  ladePlzTabelle,
  sucheOrte,
  type OrtVorschlag,
  type PlzTabelle,
} from "@/lib/plz";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Die Mitte der Suche. `titel` steht hinter „um": „um 70173 Stuttgart", „um deinen Standort". */
interface Mitte {
  lat: number;
  lng: number;
  titel: string;
  art: "ort" | "standort";
}

type Stand = "laedt" | "ok" | "fehler";

function KontaktLink({ href, icon, children, neu }: { href: string; icon: IconName; children: React.ReactNode; neu?: boolean }) {
  return (
    <a
      href={href}
      {...(neu ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      className="t-interactive -mx-2 inline-flex min-h-hit min-w-0 items-center gap-2 rounded-field px-2"
      style={{ font: "var(--type-sub)", color: "var(--accent-text)", textDecoration: "none" }}
    >
      <Icon name={icon} size={16} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
}

function GymFindenContent() {
  const hasStaffShell = useHasStaffShell();
  const { user, profile } = useAuth();
  const eigenesGym = resolveGymId(profile);

  const [gyms, setGyms] = useState<SuchGym[]>([]);
  const [stand, setStand] = useState<Stand>("laedt");
  const [text, setText] = useState("");
  const [tabelle, setTabelle] = useState<PlzTabelle | null>(null);
  const [mitte, setMitte] = useState<Mitte | null>(null);
  const [stufe, setStufe] = useState<number>(UMKREIS_STUFEN.indexOf(UMKREIS_START));
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ortet, setOrtet] = useState(false);
  const [ortHinweis, setOrtHinweis] = useState<string | null>(null);
  // Etappe 4: bei welchen Gyms dieses Konto schon angefragt hat (Gym → Datum).
  const [angefragt, setAngefragt] = useState<Record<string, string | null>>({});
  const [anfrageZiel, setAnfrageZiel] = useState<AnfrageZiel | null>(null);
  const liste = useRef<HTMLUListElement>(null);
  const radiusKm = UMKREIS_STUFEN[stufe];

  const laden = useCallback(() => {
    if (!user) return;
    setStand("laedt");
    ladeSuchGyms(user)
      .then((e) => {
        setGyms(e.gyms);
        setAngefragt(Object.fromEntries(e.angefragt.map((a) => [a.gymId, a.am])));
        setStand("ok");
      })
      .catch(() => setStand("fehler"));
  }, [user]);
  useEffect(laden, [laden]);

  // Die PLZ-Tabelle lädt mit dem ersten Buchstaben, nicht mit der Seite.
  useEffect(() => {
    if (!text || tabelle) return;
    let lebt = true;
    ladePlzTabelle()
      .then((t) => lebt && setTabelle(t))
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, [text, tabelle]);

  const vorschlaege = useMemo<OrtVorschlag[]>(() => {
    if (!tabelle || text.trim().length < 2) return [];
    if (mitte?.art === "ort" && mitte.titel === text) return [];
    return sucheOrte(tabelle, text);
  }, [tabelle, text, mitte]);
  const sucheLeer =
    !!tabelle && text.trim().length >= 3 && vorschlaege.length === 0 && !(mitte?.art === "ort" && mitte.titel === text);

  function waehleOrt(v: OrtVorschlag) {
    setMitte({ lat: v.lat, lng: v.lng, titel: v.titel, art: "ort" });
    setText(v.titel);
    setOrtHinweis(null);
    setGewaehlt(null);
  }

  function standortNutzen() {
    setOrtHinweis(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setOrtHinweis("Dein Browser gibt den Standort gerade nicht frei. Such über PLZ oder Ort.");
      return;
    }
    setOrtet(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMitte({ lat: p.coords.latitude, lng: p.coords.longitude, titel: "deinen Standort", art: "standort" });
        setText("");
        setGewaehlt(null);
        setOrtet(false);
      },
      () => {
        setOrtHinweis("Dein Browser gibt den Standort gerade nicht frei. Such über PLZ oder Ort.");
        setOrtet(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function alleAnzeigen() {
    setMitte(null);
    setText("");
    setOrtHinweis(null);
    setGewaehlt(null);
  }

  /** Mit Mitte: im Umkreis, nächstes zuerst. Ohne: alle, nach Namen. */
  const treffer = useMemo(() => {
    if (!mitte) return gyms.map((g) => ({ gym: g, km: null as number | null }));
    return gyms
      .map((g) => ({ gym: g, km: entfernungKm(mitte, g) as number | null }))
      .filter((t) => (t.km ?? 0) <= radiusKm)
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  }, [gyms, mitte, radiusKm]);
  const kartenGyms = useMemo(
    () => treffer.map(({ gym }) => ({ id: gym.id, name: gym.name, lat: gym.lat, lng: gym.lng })),
    [treffer],
  );

  /** Pin angetippt: Gym wählen und seine Karte in der Liste zeigen. */
  const waehleVonKarte = useCallback((id: string) => {
    setGewaehlt(id);
    liste.current
      ?.querySelector<HTMLElement>(`[data-gym="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const n = treffer.length;
  const zahlSatz = mitte
    ? `${n} ${n === 1 ? "Gym" : "Gyms"} im Umkreis von ${radiusKm} km um ${mitte.titel}`
    : `${n} ${n === 1 ? "Gym" : "Gyms"} auf Tidal Athletics`;

  return (
    <div
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8 lg:max-w-6xl lg:px-6 lg:pt-12">
        <header className="flex flex-col gap-1">
          <span className="t-label">Gym finden</span>
          {/* `--type-h1` gibt es nicht (das Grundgerüst aus Etappe 1 fiel damit auf
              die Fließschrift zurück) — die große Zeile ist `--type-display`. */}
          <h1
            style={{
              font: "var(--type-display)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
              color: "var(--text-1)",
            }}
          >
            Dein Gym auf Tidal Athletics
          </h1>
          <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
            Such nach PLZ oder Ort oder nutz deinen Standort. Du siehst alle Gyms in deiner Nähe, die mit
            Tidal Athletics trainieren.
          </p>
        </header>

        {/* ── Suche: PLZ/Ort, Standort, Umkreis ───────────────────────── */}
        <section aria-label="Suche" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="relative"
              data-gym-suchfeld
              onKeyDown={(e) => {
                if (e.key === "Enter" && vorschlaege[0]) {
                  e.preventDefault();
                  waehleOrt(vorschlaege[0]);
                }
              }}
            >
              <GooeySearch
                value={text}
                onChange={(v) => {
                  setText(v);
                  setOrtHinweis(null);
                }}
                label="PLZ oder Ort"
                placeholder="PLZ oder Ort …"
                breiteZu={150}
                breiteAuf={260}
              />
              {(vorschlaege.length > 0 || sucheLeer) && (
                <ul
                  role="listbox"
                  aria-label="Orte"
                  data-gym-vorschlaege
                  className="absolute left-1 top-full z-30 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-field py-1"
                  style={{
                    background: "var(--bg-1)",
                    border: "1px solid var(--line-strong)",
                    boxShadow: "var(--shadow-pop)",
                  }}
                >
                  {vorschlaege.map((v) => (
                    <li key={v.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        data-press="quiet"
                        onClick={() => waehleOrt(v)}
                        className="t-interactive flex min-h-hit w-full items-baseline gap-2 px-3 text-left"
                      >
                        <span style={{ font: "var(--type-body)", color: "var(--text-1)" }}>{v.titel}</span>
                        {v.zusatz && (
                          <span className="truncate" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                            {v.zusatz}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {sucheLeer && (
                    <li className="px-3 py-2.5" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                      Kein Ort mit diesem Namen. Probier es mit der PLZ.
                    </li>
                  )}
                </ul>
              )}
            </div>

            <button
              type="button"
              data-press
              data-gym-standort
              onClick={standortNutzen}
              disabled={ortet}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
              style={{
                ...BTN_FONT,
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-1)",
                opacity: ortet ? 0.6 : 1,
              }}
            >
              <Icon name="ortung" size={16} strokeWidth={2} />
              {ortet ? "Sucht deinen Standort …" : "Meinen Standort nutzen"}
            </button>

            {mitte && (
              <button
                type="button"
                data-press
                data-gym-alle
                onClick={alleAnzeigen}
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                style={{ ...BTN_FONT, color: "var(--text-2)" }}
              >
                Alle anzeigen
              </button>
            )}
          </div>

          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {ortHinweis ?? "Dein Standort bleibt auf deinem Gerät."}
          </p>

          {mitte && (
            <label className="flex max-w-md flex-col gap-1.5" data-gym-umkreis>
              <span className="flex items-baseline justify-between gap-3">
                <span className="t-label">Umkreis</span>
                <span style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>{radiusKm} km</span>
              </span>
              <input
                type="range"
                min={0}
                max={UMKREIS_STUFEN.length - 1}
                step={1}
                value={stufe}
                onChange={(e) => setStufe(Number(e.target.value))}
                aria-label="Umkreis in Kilometern"
                aria-valuetext={`${radiusKm} Kilometer`}
                className="w-full"
                style={{ accentColor: "var(--accent)" }}
              />
            </label>
          )}
        </section>

        {/* ── Liste + Karte ───────────────────────────────────────────── */}
        <section
          aria-label="Gyms"
          className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start"
        >
          <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
            <p data-gym-zahl aria-live="polite" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {stand === "ok" ? zahlSatz : stand === "laedt" ? "Lädt die Gyms …" : ""}
            </p>

            {stand === "fehler" && (
              <div className="t-card flex flex-col gap-3 p-5" role="alert">
                <p style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
                  Die Gym-Suche lädt gerade nicht. Versuch es gleich noch einmal.
                </p>
                <button
                  type="button"
                  data-press
                  onClick={laden}
                  className="t-interactive inline-flex min-h-hit w-fit items-center gap-2 rounded-field px-4"
                  style={{ ...BTN_FONT, border: "1px solid var(--line-strong)", color: "var(--text-1)" }}
                >
                  <Icon name="refresh" size={14} strokeWidth={2.2} />
                  Noch einmal laden
                </button>
              </div>
            )}

            {stand === "ok" && n === 0 && (
              <div className="t-card flex flex-col gap-3 p-5" data-gym-leer>
                <p style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
                  {mitte
                    ? `Im Umkreis von ${radiusKm} km trainiert noch kein Gym mit Tidal Athletics. Zieh den Umkreis größer oder sieh dir alle Gyms an.`
                    : "Noch steht kein Gym in der Suche. Frag dein Gym nach dem Einladungscode."}
                </p>
                {mitte && gyms.length > 0 && (
                  <button
                    type="button"
                    data-press
                    onClick={alleAnzeigen}
                    className="t-interactive inline-flex min-h-hit w-fit items-center gap-2 rounded-field px-4"
                    style={{ ...BTN_FONT, border: "1px solid var(--line-strong)", color: "var(--text-1)" }}
                  >
                    Alle anzeigen
                  </button>
                )}
              </div>
            )}

            <ul ref={liste} className="flex flex-col gap-3" data-gym-liste>
              {treffer.map(({ gym, km }) => {
                const aktiv = gewaehlt === gym.id;
                return (
                  <li key={gym.id} data-gym={gym.id} data-gewaehlt={aktiv || undefined}>
                    <article
                      className="t-card flex flex-col gap-1 p-4"
                      style={aktiv ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : undefined}
                    >
                      <button
                        type="button"
                        data-press="quiet"
                        aria-pressed={aktiv}
                        onClick={() => setGewaehlt(aktiv ? null : gym.id)}
                        className="t-interactive -m-2 flex items-start justify-between gap-3 rounded-field p-2 text-left"
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>
                              {gym.name}
                            </span>
                            {gym.id === eigenesGym && (
                              <span
                                className="rounded-badge px-2 py-0.5"
                                style={{
                                  font: "var(--type-meta)",
                                  letterSpacing: "var(--ls-label)",
                                  textTransform: "uppercase",
                                  background: "var(--accent-subtle)",
                                  color: "var(--accent-text)",
                                }}
                              >
                                Dein Gym
                              </span>
                            )}
                          </span>
                          <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                            {adressZeile(gym)}
                          </span>
                        </span>
                        {km != null && (
                          <span
                            className="shrink-0 pt-0.5"
                            style={{ font: "var(--type-sub)", color: "var(--text-2)", whiteSpace: "nowrap" }}
                          >
                            {kmText(km)}
                          </span>
                        )}
                      </button>

                      {(gym.telefon || gym.email || gym.website) && (
                        <div className="mt-1 flex flex-col">
                          {gym.telefon && (
                            <KontaktLink href={`tel:${gym.telefon.replace(/[^\d+]/g, "")}`} icon="telefon">
                              {gym.telefon}
                            </KontaktLink>
                          )}
                          {gym.email && (
                            <KontaktLink href={`mailto:${gym.email}`} icon="brief">
                              {gym.email}
                            </KontaktLink>
                          )}
                          {gym.website && (
                            <KontaktLink href={gym.website} icon="welt" neu>
                              {websiteKurz(gym.website)}
                            </KontaktLink>
                          )}
                        </div>
                      )}

                      {/* Probetraining: der Weg ins Gym ohne Einladung (Leon
                          30.09.). Am eigenen Gym gibt es nichts anzufragen. */}
                      {gym.id !== eigenesGym &&
                        (gym.id in angefragt ? (
                          <p
                            data-gym-angefragt
                            className="mt-2 flex items-start gap-2"
                            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                          >
                            <Icon name="check" size={16} strokeWidth={2.2} className="mt-0.5 shrink-0" />
                            <span>
                              Angefragt{angefragt[gym.id] ? ` am ${anfrageTag(angefragt[gym.id])}` : ""}. Das Gym
                              meldet sich per E-Mail bei dir.
                            </span>
                          </p>
                        ) : (
                          <button
                            type="button"
                            data-press
                            data-gym-anfragen
                            onClick={() => setAnfrageZiel({ gymId: gym.id, gymName: gym.name })}
                            className="t-interactive mt-2 inline-flex min-h-hit items-center gap-2 self-start rounded-field px-4"
                            style={{
                              ...BTN_FONT,
                              background: "var(--accent)",
                              color: "var(--on-accent)",
                              boxShadow: "var(--accent-glow)",
                            }}
                          >
                            Probetraining vereinbaren
                          </button>
                        ))}
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Die Karte bleibt beim Scrollen stehen. Athleten haben unten die
              Leiste (Platz lassen), der Stab oben den Kopfbalken. */}
          <div className={`order-1 lg:sticky lg:order-2 ${hasStaffShell ? "lg:top-24" : "lg:top-6"}`}>
            <GymKarte
              gyms={kartenGyms}
              gewaehlt={gewaehlt}
              onWahl={waehleVonKarte}
              mitte={mitte}
              radiusKm={radiusKm}
              className={
                hasStaffShell
                  ? "h-72 lg:h-[min(40rem,calc(100vh-8rem))]"
                  : "h-72 lg:h-[clamp(20rem,calc(100vh-26rem),38rem)]"
              }
            />
          </div>
        </section>

        {/* ── Der kurze Weg: Einladungscode ───────────────────────────── */}
        <div className="t-card flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
              style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}
            >
              <Icon name="hash" size={18} strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span style={{ font: "var(--type-body-strong)" }}>Einladungscode</span>
              <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Mit dem Code deines Gyms bist du in einer Minute drin.
              </span>
            </span>
          </div>
          <Link
            data-press
            href="/beitreten"
            className="t-interactive inline-flex min-h-hit items-center gap-2 self-start rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            Code eingeben
          </Link>
        </div>

        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Du führst selbst ein Gym?{" "}
          <Link href="/gym-anmelden" style={{ color: "var(--accent-text)" }}>
            Gym anmelden
          </Link>
        </p>

        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{PLZ_QUELLE_TEXT}</p>
      </div>
      {!hasStaffShell && <AthleteTabBar />}

      <AnfrageSheet
        ziel={anfrageZiel}
        onGesendet={(a) => setAngefragt((alt) => ({ ...alt, [a.gymId]: a.am }))}
        onClose={() => setAnfrageZiel(null)}
      />
    </div>
  );
}

export default function GymFindenPage() {
  return (
    <ProtectedRoute>
      <GymFindenContent />
    </ProtectedRoute>
  );
}
