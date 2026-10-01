"use client";

/**
 * KONTAKT & STANDORT — was in der Gym-Suche über dieses Gym steht (Etappe 2
 * der Gym-Suche, 01.10.2026).
 *
 * Leon am 30.09.2026 auf die Frage, wie ein Athlet ohne Gym beitritt: über
 * die Kontaktdaten des Gyms, „eigener Bereich in den Einstellungen". Und zur
 * Sichtbarkeit: Die Verwaltung schaltet frei, „standardmäßig erst mal auf on
 * (sofern datenschutztechnisch geht)".
 *
 * ─── WARUM OBEN „ÖFFENTLICH" STEHT ──────────────────────────────────────────
 *
 * Der Schalter steht von Anfang an AN, greift aber erst, wenn hier jemand
 * Straße, PLZ und Ort einträgt. Genau deshalb sagt die Seite als Erstes, wer
 * diese Angaben sieht: Wer einträgt, weiß es vorher. Ein Gym, das nie etwas
 * einträgt, steht nicht in der Suche.
 *
 * ─── DER PIN ────────────────────────────────────────────────────────────────
 *
 * Die PLZ setzt Ort und Pin aus der eingebauten Tabelle (lib/plz.ts, keine
 * fremde Anfrage). Genau wird er auf der Karte: ziehen oder tippen. Ohne Pin
 * erscheint das Gym nicht — die Suche rechnet Entfernungen.
 *
 * Gelesen wird das Gym-Dokument direkt (Mitglieder dürfen ihr Gym lesen),
 * geschrieben über POST /api/gym/kontakt — dort rechnet der Server aus, ob
 * das Gym in der Suche steht.
 */

import PinKarte from "@/components/karte/PinKarte";
import Icon from "@/components/ui/Icon";
import { SeitenZurueck } from "@/components/shell/KopfNavigation";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  KONTAKT_LEER,
  KONTAKT_MAX,
  adresseVollstaendig,
  decodeKontakt,
  type GymKontakt,
  type KontaktFeld,
} from "@/lib/gym-kontakt";
import { ladePlzTabelle, ortZurPlz, ortsnameZurPlz, type PlzTabelle } from "@/lib/plz";
import { useEffect, useRef, useState } from "react";

const META: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

function Feld({
  name,
  label,
  wert,
  onChange,
  fehler,
  ...rest
}: {
  name: KontaktFeld;
  label: string;
  wert: string;
  onChange: (v: string) => void;
  fehler: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "name">) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="t-label">{label}</span>
      <input
        {...rest}
        name={name}
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={fehler || undefined}
        data-kontakt-feld={name}
        className="min-h-hit w-full rounded-field px-3"
        style={{ ...FELD, borderColor: fehler ? "var(--negative)" : "var(--line)" }}
      />
    </label>
  );
}

export default function KontaktSeite() {
  const { user, profile, profileLoading } = useAuth();
  const istVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);

  const [geladen, setGeladen] = useState(false);
  const [k, setK] = useState<GymKontakt>(KONTAKT_LEER);
  const [tabelle, setTabelle] = useState<PlzTabelle | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlerFeld, setFehlerFeld] = useState<KontaktFeld | null>(null);
  const [gesichert, setGesichert] = useState<null | { sichtbar: boolean }>(null);
  const [laeuft, setLaeuft] = useState(false);
  /** Der Ort, den die PLZ zuletzt selbst eingetragen hat — den darf sie überschreiben. */
  const ortAusPlz = useRef("");

  useEffect(() => {
    if (!user || profileLoading || !istVerwaltung) return;
    let lebt = true;
    (async () => {
      const { doc, getDoc } = await import("firebase/firestore");
      const { getFirestoreDb } = await import("@/lib/firebase");
      const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
      if (!lebt) return;
      setK(decodeKontakt(snap.get("kontakt")));
      setGeladen(true);
    })().catch(() => {
      if (lebt) setGeladen(true);
    });
    // Die Tabelle lädt nebenher — die Seite wartet nicht auf sie.
    ladePlzTabelle()
      .then((t) => lebt && setTabelle(t))
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, [user, profileLoading, istVerwaltung, gymId]);

  function setze(teil: Partial<GymKontakt>) {
    setK((alt) => ({ ...alt, ...teil }));
    setGesichert(null);
    setFehler(null);
    setFehlerFeld(null);
  }

  /** Eine bekannte PLZ trägt den Ort ein und stellt den Pin in ihre Mitte. */
  function plzGeaendert(roh: string) {
    const plz = roh.replace(/\D/g, "").slice(0, 5);
    const treffer = tabelle && plz.length === 5 ? ortZurPlz(tabelle, plz) : null;
    if (!treffer || !tabelle) {
      setze({ plz });
      return;
    }
    const name = ortsnameZurPlz(tabelle, plz) ?? "";
    const ortFrei = !k.ort.trim() || k.ort === ortAusPlz.current;
    if (ortFrei) ortAusPlz.current = name;
    setze({ plz, lat: treffer.lat, lng: treffer.lng, ...(ortFrei ? { ort: name } : {}) });
  }

  const plzMitte = tabelle && k.plz.length === 5 ? ortZurPlz(tabelle, k.plz) : null;
  const pinAufPlz = !!plzMitte && plzMitte.lat === k.lat && plzMitte.lng === k.lng;
  const hatPin = k.lat != null && k.lng != null;

  async function speichern() {
    if (!user) return;
    setLaeuft(true);
    setFehler(null);
    setFehlerFeld(null);
    try {
      const res = await fetch("/api/gym/kontakt", {
        method: "POST",
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(k),
      });
      const daten = (await res.json().catch(() => ({}))) as {
        error?: string;
        feld?: KontaktFeld;
        kontakt?: GymKontakt;
        sichtbar?: boolean;
      };
      if (!res.ok || !daten.kontakt) {
        setFehler(daten.error ?? "Das ließ sich gerade nicht speichern.");
        setFehlerFeld(daten.feld ?? null);
        return;
      }
      // Was der Server abgelegt hat (Website mit https://, E-Mail klein).
      // Der Pin bleibt, wie er auf der Karte steht — sonst flöge sie los.
      setK((alt) => ({ ...daten.kontakt!, lat: alt.lat, lng: alt.lng }));
      setGesichert({ sichtbar: daten.sichtbar === true });
    } catch {
      setFehler("Keine Verbindung. Versuch es gleich noch einmal.");
    } finally {
      setLaeuft(false);
    }
  }

  // Der Satz unter dem Schalter folgt dem, was gerade im Formular steht.
  const standSatz = !k.inSuche
    ? "Dein Gym bleibt aus der Gym-Suche. Athleten kommen über deine Einladung zu dir."
    : !adresseVollstaendig(k)
      ? "Trag Straße, PLZ und Ort ein, dann erscheint dein Gym in der Gym-Suche."
      : !hatPin
        ? "Setz den Pin auf die Karte, dann erscheint dein Gym in der Gym-Suche."
        : "Mit diesen Angaben steht dein Gym in der Gym-Suche.";

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <SeitenZurueck href="/verwaltung" label="Verwaltung" />
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Kontakt &amp; Standort
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Trag ein, wo dein Gym ist und wie Athleten dich erreichen. Damit steht dein Gym in der
              Gym-Suche.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {!istVerwaltung ? (
          <p className="py-8 text-center" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {profileLoading ? "" : "Kontakt und Standort trägt die Verwaltung des Gyms ein."}
          </p>
        ) : !geladen ? (
          <p className="py-8 text-center" style={{ font: "var(--type-sub)", color: "var(--text-3)" }} />
        ) : (
          <>
            {/* ── Wer das sieht ─────────────────────────────────────── */}
            <p
              data-kontakt-oeffentlich
              className="flex items-start gap-3 rounded-field px-4 py-3"
              style={{
                font: "var(--type-sub)",
                color: "var(--text-1)",
                background: "var(--accent-subtle)",
                border: "1px solid var(--line-strong)",
              }}
            >
              <Icon name="info" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>
                <strong style={{ fontWeight: 600 }}>Öffentlich.</strong> Diese Angaben stehen öffentlich in
                der Gym-Suche. Jeder mit einem Konto bei Tidal Athletics sieht sie.
              </span>
            </p>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* ── Adresse ─────────────────────────────────────────── */}
              <section aria-labelledby="kontakt-adresse" className="t-card flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <h2 id="kontakt-adresse" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                    Adresse
                  </h2>
                  <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    Mit Straße, PLZ und Ort erscheint dein Gym in der Gym-Suche.
                  </p>
                </div>
                <Feld
                  name="strasse"
                  label="Straße und Hausnummer"
                  wert={k.strasse}
                  onChange={(v) => setze({ strasse: v })}
                  fehler={fehlerFeld === "strasse"}
                  maxLength={KONTAKT_MAX.strasse}
                  autoComplete="street-address"
                  placeholder="z. B. Hauptstraße 12"
                />
                <div className="grid grid-cols-[7.5rem_1fr] gap-3">
                  <Feld
                    name="plz"
                    label="PLZ"
                    wert={k.plz}
                    onChange={plzGeaendert}
                    fehler={fehlerFeld === "plz"}
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="postal-code"
                    placeholder="70173"
                  />
                  <Feld
                    name="ort"
                    label="Ort"
                    wert={k.ort}
                    onChange={(v) => setze({ ort: v })}
                    fehler={fehlerFeld === "ort"}
                    maxLength={KONTAKT_MAX.ort}
                    autoComplete="address-level2"
                    placeholder="z. B. Stuttgart"
                  />
                </div>
              </section>

              {/* ── Kontakt ─────────────────────────────────────────── */}
              <section aria-labelledby="kontakt-kontakt" className="t-card flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <h2 id="kontakt-kontakt" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                    Kontakt
                  </h2>
                  <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    Darüber melden sich Athleten für ein Probetraining. Trag ein, was du zeigen willst.
                  </p>
                </div>
                <Feld
                  name="telefon"
                  label="Telefon"
                  wert={k.telefon}
                  onChange={(v) => setze({ telefon: v })}
                  fehler={fehlerFeld === "telefon"}
                  type="tel"
                  maxLength={KONTAKT_MAX.telefon}
                  autoComplete="tel"
                  placeholder="z. B. 0711 123456"
                />
                <Feld
                  name="email"
                  label="E-Mail"
                  wert={k.email}
                  onChange={(v) => setze({ email: v })}
                  fehler={fehlerFeld === "email"}
                  type="email"
                  maxLength={KONTAKT_MAX.email}
                  autoComplete="email"
                  placeholder="z. B. info@dein-gym.de"
                />
                <Feld
                  name="website"
                  label="Website"
                  wert={k.website}
                  onChange={(v) => setze({ website: v })}
                  fehler={fehlerFeld === "website"}
                  type="text"
                  inputMode="url"
                  maxLength={KONTAKT_MAX.website}
                  autoComplete="url"
                  placeholder="z. B. dein-gym.de"
                />
              </section>
            </div>

            {/* ── Pin ───────────────────────────────────────────────── */}
            <section aria-labelledby="kontakt-pin" className="t-card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                {/* Mindestbreite: Auf dem Handy rutscht der Knopf unter den Text,
                    statt ihn auf eine Wortbreite zu quetschen. */}
                <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                  <h2 id="kontakt-pin" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                    Pin auf der Karte
                  </h2>
                  <p data-kontakt-pin-satz style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    {hatPin
                      ? "Zieh den Pin genau auf dein Gym oder tipp auf die Stelle."
                      : "Trag deine PLZ ein, dann springt der Pin dorthin. Oder tipp auf die Stelle."}
                  </p>
                </div>
                {plzMitte && hatPin && !pinAufPlz && (
                  <button
                    type="button"
                    data-press
                    onClick={() => setze({ lat: plzMitte.lat, lng: plzMitte.lng })}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                    style={{ ...META, color: "var(--text-2)" }}
                  >
                    Pin auf die PLZ setzen
                  </button>
                )}
              </div>
              <PinKarte
                lat={k.lat}
                lng={k.lng}
                onPin={(lat, lng) => setze({ lat, lng })}
                className="h-72 lg:h-96"
              />
            </section>

            {/* ── Schalter ──────────────────────────────────────────── */}
            <section className="t-card p-5">
              <button
                type="button"
                role="switch"
                aria-checked={k.inSuche}
                data-kontakt-schalter
                data-press="quiet"
                onClick={() => setze({ inSuche: !k.inSuche })}
                className="t-interactive flex min-h-hit w-full items-center justify-between gap-4 rounded-badge text-left"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>
                    In der Gym-Suche zeigen
                  </span>
                  <span data-kontakt-stand style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    {standSatz}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="relative h-6 w-11 shrink-0 rounded-pill"
                  style={{
                    background: k.inSuche ? "var(--accent)" : "var(--surface-raised)",
                    border: "1px solid",
                    borderColor: k.inSuche ? "var(--accent)" : "var(--line-strong)",
                    transition:
                      "background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
                  }}
                >
                  <span
                    className="absolute top-1/2 rounded-pill"
                    style={{
                      width: "18px",
                      height: "18px",
                      left: k.inSuche ? "22px" : "2px",
                      transform: "translateY(-50%)",
                      background: k.inSuche ? "var(--on-accent)" : "var(--text-2)",
                      transition: "left var(--dur-fast) var(--ease-out)",
                    }}
                  />
                </span>
              </button>
            </section>

            {/* ── Speichern ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 pb-2">
              <button
                type="button"
                data-press
                data-kontakt-speichern
                onClick={() => void speichern()}
                disabled={laeuft}
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                style={{
                  ...META,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                  opacity: laeuft ? 0.6 : 1,
                }}
              >
                <Icon name="check" size={14} strokeWidth={2.4} />
                {laeuft ? "Speichert …" : "Speichern"}
              </button>
              {gesichert && (
                <span data-kontakt-gesichert style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  {gesichert.sichtbar ? "Gespeichert. Dein Gym steht in der Gym-Suche." : "Gespeichert."}
                </span>
              )}
            </div>
          </>
        )}

        {fehler && (
          <p
            role="alert"
            className="rounded-field px-4 py-3"
            style={{
              font: "var(--type-sub)",
              color: "var(--text-1)",
              background: "var(--bg-2)",
              border: "1px solid var(--line-strong)",
            }}
          >
            {fehler}
          </p>
        )}
      </div>
    </main>
  );
}
