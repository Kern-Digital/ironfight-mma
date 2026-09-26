"use client";

/**
 * MARKE — Logo und Farbe des Gyms (Branding-Kit, Konzept §8; gebaut
 * 24.09.2026).
 *
 * Leon am 22.09.2026, als er die Stufen gestückelt hat: Branding „Gym +
 * Saison". Das Kit ist der einzige Mehrwert der mittleren Stufe, der NICHTS
 * an Rechenzeit kostet und trotzdem jeden Tag sichtbar ist — deshalb steht er
 * hier und nicht in einer Ausbaustufe.
 *
 * ─── WAS DIE SEITE ÄNDERT ───────────────────────────────────────────────────
 *
 * ZWEI ZAHLEN und EIN BILD, mehr nicht. Farbton und Buntheit gehen als
 * --accent-h/--accent-c ins Token-System, und daraus rechnet das Design
 * Hintergrund, Rand, Schrift, Glas, Knopf und Glühen selbst aus (globals.css
 * Kopf, DESIGN-BRIEF §1). Ein Gym kann seine Farbe also setzen, ohne dass
 * irgendwo ein Kontrast reißt. Das Logo steht auf der Einladung, die der
 * Athlet öffnet — dort gehört das Zeichen dem Gym, nicht uns (JoinLayout).
 *
 * ─── WARUM DIE VORSCHAU IHR EIGENES data-theme TRÄGT ────────────────────────
 *
 * Die abgeleiteten Tokens sind in dem Block deklariert, der auch data-theme
 * bedient. Wer --accent-h auf einem Unter-Element überschreibt, MUSS dort
 * data-theme mitsetzen, sonst rechnet nichts neu (globals.css, Kopf des
 * Token-Systems). Die Vorschau tut genau das — und sie ist der einzige Ort
 * auf dieser Seite, der die Gym-Farbe überhaupt zeigen KANN: Der
 * Verwaltungsbereich färbt sich selbst bernsteinfarben
 * ([data-area="verwaltung"]), die Gym-Farbe sieht man hier also nur im
 * Kasten.
 */

import Icon from "@/components/ui/Icon";
import { SeitenZurueck } from "@/components/shell/KopfNavigation";
import { useAuth, useRights } from "@/lib/auth-context";
import { useAboStufe } from "@/lib/use-abo-stufe";
import { useTheme } from "@/lib/theme-context";
import { hexZuOklch, oklchZuHex } from "@/lib/farbe";
import {
  AKZENT_C_MAX,
  AKZENT_TIDAL,
  decodeBranding,
  getGymName,
  resolveGymId,
  type GymBranding,
} from "@/lib/gym";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/** Die Helligkeit, mit der das Token-System den Akzent zeichnet (globals.css). */
const AKZENT_L = { dark: 0.78, light: 0.5 } as const;

/** Auf 320 px Breite gerechnet zeigt das Logo auf jedem Schirm scharf. */
const LOGO_BREITE = 320;
const LOGO_HOEHE = 96;
/** Muss zur Grenze der Route passen (app/api/gym/branding/route.ts). */
const LOGO_MAX_ZEICHEN = 96 * 1024;

const META: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * Bild → kleine Data-URL. Der Browser rechnet herunter, bevor irgendetwas
 * das Netz sieht: aus 4 MB Handyfoto werden ein paar Kilobyte.
 *
 * SVG bleibt SVG — eine Vektordatei durch ein Raster zu schicken, macht sie
 * nur schlechter, und klein ist sie ohnehin.
 */
async function logoLesen(datei: File): Promise<string> {
  const roh = await new Promise<string>((fertig, schiefgegangen) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result ?? ""));
    leser.onerror = () => schiefgegangen(new Error("Die Datei ließ sich nicht lesen."));
    leser.readAsDataURL(datei);
  });

  if (datei.type === "image/svg+xml") {
    if (roh.length > LOGO_MAX_ZEICHEN) throw new Error("Dein Logo ist zu groß. Nimm eine kleinere Datei.");
    return roh;
  }

  const bild = await new Promise<HTMLImageElement>((fertig, schiefgegangen) => {
    const b = new Image();
    b.onload = () => fertig(b);
    b.onerror = () => schiefgegangen(new Error("Das ist kein Bild, das der Browser öffnen kann."));
    b.src = roh;
  });

  const faktor = Math.min(LOGO_BREITE / bild.width, LOGO_HOEHE / bild.height, 1);
  const breite = Math.max(1, Math.round(bild.width * faktor));
  const hoehe = Math.max(1, Math.round(bild.height * faktor));
  const flaeche = document.createElement("canvas");
  flaeche.width = breite;
  flaeche.height = hoehe;
  const stift = flaeche.getContext("2d");
  if (!stift) throw new Error("Das Bild ließ sich nicht umrechnen.");
  stift.drawImage(bild, 0, 0, breite, hoehe);

  // WebP hält Transparenz und ist deutlich kleiner als PNG. Kann ein Browser
  // es nicht schreiben, liefert toDataURL still ein PNG — auch gut.
  const klein = flaeche.toDataURL("image/webp", 0.92);
  if (klein.length > LOGO_MAX_ZEICHEN) throw new Error("Dein Logo ist zu groß. Nimm eine kleinere Datei.");
  return klein;
}

export default function BrandingSeite() {
  const { user, profile, profileLoading } = useAuth();
  const istVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);
  const { theme } = useTheme();
  const { plan, leistungen } = useAboStufe(gymId);

  const [geladen, setGeladen] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [akzentH, setAkzentH] = useState<number | null>(null);
  const [akzentC, setAkzentC] = useState<number | null>(null);
  const [gymName, setGymName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesichert, setGesichert] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);

  // Was gerade gezeigt wird: die Gym-Farbe, sonst der Tidal-Ton.
  const zeigH = akzentH ?? AKZENT_TIDAL.h;
  const zeigC = akzentC ?? AKZENT_TIDAL.c;
  const zeigHex = oklchZuHex(AKZENT_L[theme], zeigC, zeigH);

  useEffect(() => {
    if (!user || profileLoading || !istVerwaltung) return;
    let lebt = true;
    (async () => {
      const { doc, getDoc } = await import("firebase/firestore");
      const { getFirestoreDb } = await import("@/lib/firebase");
      const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
      if (!lebt) return;
      const b: GymBranding = decodeBranding(snap.get("branding"));
      setGymName(await getGymName(gymId).catch(() => ""));
      setLogo(b.logoUrl ?? null);
      setAkzentH(b.akzentH ?? null);
      setAkzentC(b.akzentC ?? null);
      setGeladen(true);
    })().catch(() => {
      if (lebt) setGeladen(true);
    });
    return () => {
      lebt = false;
    };
  }, [user, profileLoading, istVerwaltung, gymId]);

  const nimmDatei = useCallback(async (datei: File | undefined) => {
    if (!datei) return;
    setFehler(null);
    setGesichert(false);
    try {
      setLogo(await logoLesen(datei));
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das Bild ließ sich nicht laden.");
    }
  }, []);

  function farbeWaehlen(hex: string) {
    const { c, h } = hexZuOklch(hex);
    setAkzentH(Math.round(h * 10) / 10);
    setAkzentC(Math.round(Math.min(c, AKZENT_C_MAX) * 1000) / 1000);
    setGesichert(false);
  }

  async function speichern() {
    if (!user) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await fetch("/api/gym/branding", {
        method: "POST",
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ logoUrl: logo, akzentH, akzentC }),
      });
      const daten = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFehler(daten.error ?? "Das ließ sich gerade nicht speichern.");
        return;
      }
      setGesichert(true);
      // Die App trägt die neue Farbe sofort, ohne Neuladen.
      window.dispatchEvent(new CustomEvent("tidal:branding"));
    } catch {
      setFehler("Keine Verbindung. Versuch es gleich noch einmal.");
    } finally {
      setLaeuft(false);
    }
  }

  const darfBranden = leistungen?.branding === true;

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
              Marke
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Dein Logo und deine Farbe. Die App trägt sie ab dem Speichern — und die Einladung, die dein
              Athlet öffnet, auch.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {!istVerwaltung ? (
          <p className="py-8 text-center" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {profileLoading ? "" : "Logo und Farbe setzt die Verwaltung des Gyms."}
          </p>
        ) : plan === null || !geladen ? (
          <p className="py-8 text-center" style={{ font: "var(--type-sub)", color: "var(--text-3)" }} />
        ) : !darfBranden ? (
          <section className="t-card flex flex-col gap-4 p-5">
            <h2 className="t-sheet-title" style={{ color: "var(--text-1)" }}>
              Logo und Farbe gehören zu Gym und Saison
            </h2>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              Ab der Stufe Gym trägt die App dein Zeichen und deine Farbe: im Menü, auf jedem Knopf und auf
              der Einladung, die dein Athlet öffnet.
            </p>
            <Link
              href="/trainer/deepfight/abo"
              data-press
              className="t-interactive inline-flex min-h-hit w-fit items-center gap-2 rounded-field px-5"
              style={{
                ...META,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              Stufen ansehen
            </Link>
          </section>
        ) : (
          <>
            {/* ── Logo ──────────────────────────────────────────────── */}
            <section aria-labelledby="marke-logo" className="t-card flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <h2 id="marke-logo" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                  Logo
                </h2>
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  PNG, JPG, WebP oder SVG. Auf dunklem Grund steht es am besten frei — ohne weißen Kasten
                  drumherum.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="flex h-20 min-w-[140px] items-center justify-center rounded-field px-4"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Dein Logo" className="h-12 w-auto object-contain" style={{ maxWidth: 160 }} />
                  ) : (
                    <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>Noch kein Logo</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-press
                    onClick={() => dateiFeld.current?.click()}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                    style={{ ...META, border: "1px solid var(--line-strong)", color: "var(--text-1)" }}
                  >
                    <Icon name="frame" size={14} strokeWidth={2.2} />
                    {logo ? "Anderes Logo" : "Logo aussuchen"}
                  </button>
                  {logo && (
                    <button
                      type="button"
                      data-press
                      onClick={() => {
                        setLogo(null);
                        setGesichert(false);
                      }}
                      className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                      style={{ ...META, color: "var(--text-2)" }}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                <input
                  ref={dateiFeld}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    void nimmDatei(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </section>

            {/* ── Farbe ─────────────────────────────────────────────── */}
            <section aria-labelledby="marke-farbe" className="t-card flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <h2 id="marke-farbe" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                  Farbe
                </h2>
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Such deinen Ton aus. Den Rest — Ränder, Schrift, Knöpfe, Glühen — rechnet die App daraus
                  aus, hell wie dunkel.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-3" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  <input
                    type="color"
                    value={zeigHex}
                    onChange={(e) => farbeWaehlen(e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-field"
                    style={{ background: "transparent", border: "1px solid var(--line-strong)" }}
                    aria-label="Farbton deines Gyms"
                  />
                  <span>
                    Farbton {Math.round(zeigH)}° · Sättigung {zeigC.toFixed(2)}
                  </span>
                </label>
                {akzentH != null && (
                  <button
                    type="button"
                    data-press
                    onClick={() => {
                      setAkzentH(null);
                      setAkzentC(null);
                      setGesichert(false);
                    }}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                    style={{ ...META, color: "var(--text-2)" }}
                  >
                    Tidal-Ton zurück
                  </button>
                )}
              </div>
            </section>

            {/* ── Vorschau ──────────────────────────────────────────── */}
            <section aria-labelledby="marke-vorschau" className="t-card flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <h2 id="marke-vorschau" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                  So sieht es dein Athlet
                </h2>
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Die Einladung, die er öffnet, bevor er das erste Mal in der App steht.
                </p>
              </div>

              {/* data-theme MUSS hier stehen, sonst rechnen die Ableitungen
                  nicht neu (globals.css, Kopf des Token-Systems). */}
              <div
                data-theme={theme}
                style={
                  {
                    "--accent-h": String(zeigH),
                    "--accent-c": String(zeigC),
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                  } as React.CSSProperties
                }
                className="flex flex-col items-center gap-3 rounded-card px-5 py-7"
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="h-12 w-auto object-contain" style={{ maxWidth: 160 }} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/logo.png" alt="" aria-hidden className="h-11 w-11 object-contain" />
                )}
                <span
                  style={{
                    font: "var(--type-display)",
                    letterSpacing: "var(--ls-display)",
                    textTransform: "uppercase",
                    color: "var(--text-1)",
                  }}
                >
                  {gymName.trim() || "Dein Gym"}
                </span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Dein Trainer hat dich eingeladen.
                </span>
                <span
                  className="mt-1 inline-flex min-h-hit items-center rounded-field px-5"
                  style={{
                    ...META,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    boxShadow: "var(--accent-glow)",
                  }}
                >
                  Jetzt loslegen
                </span>
              </div>
            </section>

            {/* ── Speichern ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 pb-2">
              <button
                type="button"
                data-press
                data-marke-speichern
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
                <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Gespeichert. Deine Marke steht.
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
