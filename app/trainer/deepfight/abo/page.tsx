"use client";

/**
 * DAS DEEPFIGHT-ABO — die Seite hinter „Analysen holen" (Schritt 3,
 * 21.09.2026).
 *
 * Leon 20.09.: „schöne werbungsseite … par online bezahldienst direkt
 * freischalten". Seit dem 21.09. spät ein ABO statt Paketen (Konzept §6), und
 * seine Antworten zu dieser Seite (wörtlich): Ort „Eigene Seite (Empfohlen)" ·
 * Stufenwahl „Drei Karten nebeneinander (Empfohlen)" · Preis „Netto groß,
 * brutto klein (Empfohlen)" · Wer kauft „Nur die Verwaltung (Empfohlen)" ·
 * Mit Guthaben „Stand oben, Nachkauf darunter (Empfohlen)" · Nachkauf „10
 * Analysen für 35 € (Empfohlen)".
 *
 * ZWEI GESICHTER, EINE ADRESSE:
 *   ohne Abo   Stand (die Geschenkten) → Werbung → drei Karten mit
 *              Umschalter monatlich/jährlich → Kasse.
 *   mit Abo    Stand mit nächster Gutschrift → Nachkauf → Rechnungen. Die
 *              Karten fallen weg: Stufe und Laufzeit wechselt das Gym im
 *              Stripe-Kundenportal („Abo verwalten").
 *
 * WER NICHT IN DER VERWALTUNG IST, sieht alles, aber statt „Abonnieren" den
 * Satz, wer das kann — Rechnungen und Portal gibt es für ihn nicht.
 *
 * GELD ENTSTEHT HIER NICHT. Die Seite öffnet die Stripe-Kasse; die Analysen
 * schreibt allein der Webhook, wenn Stripe die Zahlung meldet. Nach der
 * Rückkehr (`?kauf=ok`) fragt die Seite deshalb ein paar Sekunden lang nach,
 * bis sie da sind.
 */

import FightDnaHelix from "@/components/deepfight/FightDnaHelix";
import { FightDnaHeading } from "@/components/deepfight/FightDnaEntry";
import { SeitenZurueck } from "@/components/shell/KopfNavigation";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import {
  ABO_STUFEN,
  ABO_VORWAHL,
  NACHKAUF,
  STEUERMODUS,
  UST_SATZ,
  aboLage,
  brutto,
  datumLang,
  decodeGymAbo,
  euro,
  fristEnde,
  stueckpreis,
  stufeInfo,
  type AboIntervall,
  type AboStufe,
  type GymAbo,
} from "@/lib/abo";
import { useAuth, useRights } from "@/lib/auth-context";
import { DEMO_FIGHT_PROFILE } from "@/lib/demo-fight-profile";
import { resolveGymId } from "@/lib/gym";
import { getGuthabenStand, type GuthabenStand } from "@/lib/guthaben";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const LABEL: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
  color: "var(--text-2)",
};

/** Dasselbe Feld wie im Wettkampf-Formular (KampfVerschieben, PhasenEditor). */
const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  maxWidth: 320,
};

const KNOPF: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Die drei Punkte der Werbung — was eine Analyse dem Gym bringt. */
const PUNKTE: { icon: "video" | "chart" | "target"; titel: string; text: string }[] = [
  {
    icon: "video",
    titel: "Ein Video, jeder Fighter einzeln",
    text: "Lad ein Sparring hoch und wähl die Person. DeepFight wertet genau diesen Fighter aus.",
  },
  {
    icon: "chart",
    titel: "Die Fight-DNA wächst mit",
    text: "Jede Analyse schärft das Profil deines Athleten. Du siehst Stärken und Lücken, bevor sie im Kampf auffallen.",
  },
  {
    icon: "target",
    titel: "Gameplan gegen den nächsten Gegner",
    text: "Scoute den Gegner mit demselben Werkzeug. Der Gameplan für den Wettkampf entsteht daraus — ohne Aufpreis.",
  },
];

// ─── Server-Aufrufe ────────────────────────────────────────────────────────

interface Rechnung {
  id: string;
  nummer: string | null;
  datum: number;
  betrag: number;
  offen: boolean;
  pdf: string | null;
  seite: string | null;
  text: string | null;
}

async function mitToken<T>(
  token: string,
  pfad: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; daten: T & { error?: string; feld?: string } }> {
  const res = await fetch(pfad, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const daten = (await res.json().catch(() => ({}))) as T & { error?: string; feld?: string };
  return { ok: res.ok, daten };
}

// ─── Bausteine ─────────────────────────────────────────────────────────────

function Streifen({
  ton,
  children,
}: {
  ton: "gut" | "warnung" | "ruhig";
  children: React.ReactNode;
}) {
  const farbe = ton === "gut" ? "var(--positive)" : ton === "warnung" ? "var(--warning)" : "var(--accent)";
  return (
    <div
      role="status"
      className="rounded-field px-4 py-3"
      style={{
        font: "var(--type-sub)",
        color: "var(--text-1)",
        border: `1px solid color-mix(in oklab, ${farbe} 45%, transparent)`,
        background: `color-mix(in oklab, ${farbe} 12%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

/** Netto groß, brutto klein (Leon 21.09.) — im Kleinunternehmer-Modus nur ein Preis. */
function Preis({ netto, takt, gross = true }: { netto: number; takt: string | null; gross?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          style={{
            font: gross ? "var(--type-display)" : "var(--type-num-xl)",
            color: "var(--text-1)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {euro(netto)}
        </span>
        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          {takt ? `${takt} ` : ""}
          {STEUERMODUS === "regel" ? "zzgl. USt." : ""}
        </span>
      </div>
      <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {STEUERMODUS === "regel"
          ? `${euro(brutto(netto))} inkl. ${UST_SATZ} % USt.`
          : "Endpreis nach § 19 UStG"}
      </span>
    </div>
  );
}

function UstFeld({
  wert,
  onWert,
  fehler,
}: {
  wert: string;
  onWert: (v: string) => void;
  fehler: string | null;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={LABEL}>USt-IdNr. eures Gyms · optional</span>
      <input
        value={wert}
        onChange={(e) => onWert(e.target.value)}
        placeholder="z. B. DE123456789"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={fehler ? true : undefined}
        aria-describedby="abo-ust-hilfe"
        className="abo-feld min-h-hit w-full rounded-field px-3"
        style={FELD}
      />
      <span id="abo-ust-hilfe" style={{ font: "var(--type-sub)", color: fehler ? "var(--text-1)" : "var(--text-3)" }}>
        {fehler ??
          (STEUERMODUS === "regel"
            ? "Gyms in Deutschland zahlen 19 % USt. Ein Gym im EU-Ausland mit gültiger Nummer zahlt den Nettopreis und führt die Steuer selbst ab."
            : "Die Nummer steht dann auf eurer Rechnung.")}
      </span>
    </label>
  );
}

// ─── Seite ─────────────────────────────────────────────────────────────────

function AboSeite() {
  const { user, profile, profileLoading } = useAuth();
  const darfKaufen = useRights().verwaltung;
  const gymId = resolveGymId(profile);
  const params = useSearchParams();
  const kauf = params.get("kauf");

  const [abo, setAbo] = useState<GymAbo | null>(null);
  const [stand, setStand] = useState<GuthabenStand | null>(null);
  const [ustVorher, setUstVorher] = useState("");
  const [geladen, setGeladen] = useState(false);
  const [intervall, setIntervall] = useState<AboIntervall>("monat");
  const [stufe, setStufe] = useState<AboStufe>(ABO_VORWAHL);
  const [ust, setUst] = useState("");
  const [ustFehler, setUstFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<"kaufen" | "nachkauf" | "portal" | null>(null);
  const [rechnungen, setRechnungen] = useState<Rechnung[] | null>(null);
  const [bestaetigt, setBestaetigt] = useState(false);

  const laden = useCallback(async () => {
    const { doc, getDoc } = await import("firebase/firestore");
    const { getFirestoreDb } = await import("@/lib/firebase");
    const [snap, s] = await Promise.all([
      getDoc(doc(getFirestoreDb(), "gyms", gymId)),
      getGuthabenStand(gymId).catch(() => null),
    ]);
    const a = decodeGymAbo(snap.get("subscription"));
    setAbo(a);
    setStand(s);
    setUstVorher((snap.get("rechnung.ustId") as string | undefined) ?? "");
    setGeladen(true);
    return { a, s };
  }, [gymId]);

  useEffect(() => {
    if (!user || profileLoading) return;
    laden().catch(() => setGeladen(true));
  }, [user, profileLoading, laden]);

  useEffect(() => setUst((u) => u || ustVorher), [ustVorher]);

  // Nach der Kasse: nachfragen, bis der Webhook die Analysen geschrieben hat.
  useEffect(() => {
    if (kauf !== "ok" || !user || profileLoading) return;
    let lebt = true;
    let versuche = 0;
    const vorher = stand?.gesamt ?? null;
    const t = setInterval(async () => {
      versuche += 1;
      try {
        const { a, s } = await laden();
        const da = aboLage(a) !== "keins" && (vorher === null || (s?.gesamt ?? 0) > vorher);
        if (lebt && (da || versuche >= 16)) {
          setBestaetigt(da);
          clearInterval(t);
        }
      } catch {
        /* weiter fragen */
      }
    }, 2500);
    return () => {
      lebt = false;
      clearInterval(t);
    };
    // Bewusst nur beim Eintreffen — `stand` ändert sich durch das Nachfragen selbst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kauf, user, profileLoading]);

  const lage = aboLage(abo);

  useEffect(() => {
    if (!user || !darfKaufen || lage === "keins") return;
    let lebt = true;
    user
      .getIdToken()
      .then((t) => mitToken<{ rechnungen: Rechnung[] }>(t, "/api/abo/rechnungen"))
      .then(({ ok, daten }) => {
        if (lebt) setRechnungen(ok ? daten.rechnungen ?? [] : []);
      })
      .catch(() => lebt && setRechnungen([]));
    return () => {
      lebt = false;
    };
  }, [user, darfKaufen, lage]);

  async function zurKasse(art: "abo" | "nachkauf") {
    if (!user) return;
    setFehler(null);
    setUstFehler(null);
    setLaeuft(art === "abo" ? "kaufen" : "nachkauf");
    try {
      const { ok, daten } = await mitToken<{ url?: string }>(await user.getIdToken(), "/api/abo/kaufen", {
        method: "POST",
        body: art === "abo" ? { art, stufe, intervall, ustId: ust } : { art, ustId: ust },
      });
      if (ok && daten.url) {
        window.location.assign(daten.url);
        return;
      }
      if (daten.feld === "ustId") setUstFehler(daten.error ?? null);
      else setFehler(daten.error ?? "Die Kasse ließ sich gerade nicht öffnen.");
    } catch {
      setFehler("Keine Verbindung. Prüf dein Netz und versuch es noch einmal.");
    }
    setLaeuft(null);
  }

  async function zumPortal() {
    if (!user) return;
    setFehler(null);
    setLaeuft("portal");
    try {
      const { ok, daten } = await mitToken<{ url?: string }>(await user.getIdToken(), "/api/abo/portal", {
        method: "POST",
      });
      if (ok && daten.url) {
        window.location.assign(daten.url);
        return;
      }
      setFehler(daten.error ?? "Das Kundenportal ließ sich nicht öffnen.");
    } catch {
      setFehler("Keine Verbindung. Prüf dein Netz und versuch es noch einmal.");
    }
    setLaeuft(null);
  }

  const gewaehlt = stufeInfo(stufe);
  const aktuelleStufe = abo && abo.plan !== "free" ? stufeInfo(abo.plan) : null;

  return (
    <main className="pb-16" style={{ color: "var(--text-body)" }}>
      {/* Der Rückweg steht AUSSERHALB der Lücken-Spalte: Ab lg wandert er
          in den Kopf der Hülle, und eine leere Zeile hätte oben trotzdem
          ihre 32 px Abstand behalten. */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <SeitenZurueck href="/trainer/deepfight" label="DeepFight" />
        <h1 className="sr-only">DeepFight-Abo</h1>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-2 sm:px-6">

        {/* ── Rückkehr aus der Kasse ─────────────────────────────────── */}
        {kauf === "ok" && (
          <Streifen ton={bestaetigt ? "gut" : "ruhig"}>
            {bestaetigt ? (
              <>
                <strong style={{ fontWeight: 600 }}>Geschafft.</strong> Eure Analysen sind da — leg los.
              </>
            ) : (
              <>
                <strong style={{ fontWeight: 600 }}>Danke!</strong> Stripe bestätigt gerade die Zahlung. Eure
                Analysen erscheinen hier in ein paar Sekunden.
              </>
            )}
          </Streifen>
        )}
        {kauf === "abgebrochen" && (
          <Streifen ton="ruhig">Du hast die Kasse verlassen. Wähl in Ruhe — die Stufen warten hier.</Streifen>
        )}

        {/* ── Der Stand ──────────────────────────────────────────────── */}
        {!geladen ? (
          <Skeleton className="h-28 w-full rounded-card" />
        ) : lage === "keins" ? (
          stand && stand.rest > 0 ? (
            <p data-abo-stand={stand.rest} style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              Ihr habt noch {stand.rest} {stand.rest === 1 ? "Analyse" : "Analysen"}
              {stand.restBezahlt === 0 ? " zum Ausprobieren" : ""}. Mit dem Abo kommen jeden Monat neue dazu.
            </p>
          ) : null
        ) : (
          <section aria-label="Euer Abo" className="t-card flex flex-col gap-4 p-5" data-abo-lage={lage}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span style={LABEL}>Eure Analysen</span>
                <div className="flex items-baseline gap-3">
                  <span
                    data-abo-stand={stand?.rest ?? 0}
                    style={{ font: "var(--type-display)", color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {stand?.rest ?? 0}
                  </span>
                  <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>übrig</span>
                </div>
              </div>
              {darfKaufen && (
                <button
                  type="button"
                  data-press
                  data-abo-portal
                  onClick={zumPortal}
                  disabled={laeuft !== null}
                  className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                  style={{ ...KNOPF, border: "1px solid var(--line)", color: "var(--text-1)" }}
                >
                  <Icon name="settings" size={14} strokeWidth={2.2} />
                  {laeuft === "portal" ? "Öffnet …" : "Abo verwalten"}
                </button>
              )}
            </div>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {aktuelleStufe && (
                <>
                  Euer Abo: <strong style={{ color: "var(--text-1)", fontWeight: 600 }}>{aktuelleStufe.name}</strong>
                  {" · "}
                  {aktuelleStufe.analysenJeMonat} Analysen im Monat
                  {" · "}
                  {abo?.intervall === "jahr" ? "jährlich" : "monatlich"}.{" "}
                </>
              )}
              {lage === "aktiv" &&
                (stand?.naechsteGutschrift
                  ? `Die nächsten ${stand.naechsteGutschrift.menge} kommen am ${datumLang(stand.naechsteGutschrift.am)}.`
                  : abo?.currentPeriodEnd && aktuelleStufe
                    ? `Die nächsten ${aktuelleStufe.analysenJeMonat} kommen am ${datumLang(abo.currentPeriodEnd)}.`
                    : "")}
              {" "}
              Ungenutzte Analysen sammeln sich an und gelten 24 Monate.
            </p>
            {lage === "zahlung-offen" && abo && (
              <Streifen ton="warnung">
                <strong style={{ fontWeight: 600 }}>Eure letzte Zahlung ist nicht durchgegangen.</strong>{" "}
                {fristEnde(abo)
                  ? `Aktualisier die Karte bis ${datumLang(fristEnde(abo)!)}, sonst endet das Abo.`
                  : "Aktualisier die Karte unter „Abo verwalten“."}{" "}
                Was ihr schon bezahlt habt, bleibt nutzbar.
              </Streifen>
            )}
            {lage === "gekuendigt" && abo?.kuendigtZum && (
              <Streifen ton="ruhig">
                Euer Abo endet am {datumLang(abo.kuendigtZum)}. Die Analysen, die ihr bis dahin habt, bleiben 24
                Monate nutzbar.
              </Streifen>
            )}
          </section>
        )}

        {/* ── Ohne Abo: Werbung und die drei Stufen ───────────────────── */}
        {geladen && lage === "keins" && (
          <>
            <section aria-label="Was DeepFight kann" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="flex min-w-0 flex-col gap-5">
                <FightDnaHeading />
                <ul className="flex flex-col gap-4">
                  {PUNKTE.map((p) => (
                    <li key={p.titel} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
                        style={{ background: "color-mix(in oklab, var(--accent) 14%, transparent)", color: "var(--accent)" }}
                      >
                        <Icon name={p.icon} size={18} strokeWidth={2} />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <strong style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>{p.titel}</strong>
                        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>{p.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Beispieldaten — wie auf der Landung inert und stumm. `inert`
                  per Ref wie in FightDnaEntry: React 18 kennt das Attribut
                  noch nicht und warnt sonst in der Konsole. */}
              <div
                className="abo-helix hidden min-w-0 lg:block"
                aria-hidden="true"
                ref={(el) => {
                  if (el) el.inert = true;
                }}
              >
                <FightDnaHelix profile={DEMO_FIGHT_PROFILE} variant="athlete" size="md" kennzahlZeigen={false} />
              </div>
            </section>

            <section aria-labelledby="abo-stufen-titel" className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 id="abo-stufen-titel" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                  Wähl euer Abo
                </h2>
                <div className="df-filter" role="group" aria-label="Laufzeit">
                  {(["monat", "jahr"] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={intervall === i}
                      data-abo-intervall={i}
                      onClick={() => setIntervall(i)}
                    >
                      {i === "monat" ? "Monatlich" : "Jährlich · 2 Monate geschenkt"}
                    </button>
                  ))}
                </div>
              </div>

              <div role="radiogroup" aria-labelledby="abo-stufen-titel" className="grid gap-4 md:grid-cols-3">
                {ABO_STUFEN.map((s) => {
                  const an = s.id === stufe;
                  return (
                    <label
                      key={s.id}
                      data-abo-stufe={s.id}
                      data-gewaehlt={an || undefined}
                      className="abo-karte t-card relative flex cursor-pointer flex-col gap-4 p-5"
                    >
                      <input
                        type="radio"
                        name="abo-stufe"
                        value={s.id}
                        checked={an}
                        onChange={() => setStufe(s.id)}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span style={{ ...LABEL, color: an ? "var(--accent-text, var(--accent))" : "var(--text-2)" }}>
                          {s.name}
                        </span>
                        <span
                          aria-hidden
                          className="flex h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            border: `2px solid ${an ? "var(--accent)" : "var(--line)"}`,
                            background: an ? "var(--accent)" : "transparent",
                            color: "var(--on-accent)",
                          }}
                        >
                          {an && <Icon name="check" size={12} strokeWidth={3} />}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span style={{ font: "var(--type-num-xl)", color: "var(--text-1)" }}>{s.analysenJeMonat}</span>
                        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>Analysen im Monat</span>
                      </div>
                      <Preis netto={s.netto[intervall]} takt={intervall === "jahr" ? "im Jahr" : "im Monat"} />
                      <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                        {euro(stueckpreis(s.id, intervall))} je Analyse
                        {intervall === "jahr" ? ` · ${s.analysenJeMonat * 12} im Jahr` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="t-card flex flex-col gap-5 p-5">
                {darfKaufen ? (
                  <>
                    <UstFeld wert={ust} onWert={setUst} fehler={ustFehler} />
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        data-press
                        data-abo-kaufen={stufe}
                        onClick={() => zurKasse("abo")}
                        disabled={laeuft !== null}
                        className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                        style={{
                          ...KNOPF,
                          background: "var(--accent)",
                          color: "var(--on-accent)",
                          boxShadow: "var(--accent-glow)",
                        }}
                      >
                        <Icon name="spark" size={14} strokeWidth={2.4} />
                        {laeuft === "kaufen" ? "Kasse öffnet …" : `${gewaehlt.name} abonnieren`}
                      </button>
                      <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                        Bezahlt wird per Karte über Stripe.
                      </span>
                    </div>
                  </>
                ) : (
                  <p data-abo-nur-verwaltung style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
                    Das Abo bucht die Verwaltung eures Gyms. Sprich sie an — die Stufen seht ihr hier schon.
                  </p>
                )}
                {fehler && (
                  <p role="alert" style={{ font: "var(--type-sub)", color: "var(--text-1)" }}>
                    {fehler}
                  </p>
                )}
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {intervall === "monat"
                    ? "Monatlich kündbar zum Ende des Monats."
                    : "Ein Jahr Laufzeit, die Analysen kommen trotzdem Monat für Monat."}{" "}
                  Ungenutzte Analysen sammeln sich an und gelten 24 Monate. Das Angebot richtet sich an Gyms und
                  Vereine.
                </p>
              </div>
            </section>
          </>
        )}

        {/* ── Mit Abo: Nachkauf und Rechnungen ────────────────────────── */}
        {geladen && lage !== "keins" && (
          <>
            <section aria-labelledby="abo-nachkauf-titel" className="t-card flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <h2 id="abo-nachkauf-titel" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
                  Nachkauf
                </h2>
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Der Monat reicht nicht? Hol euch {NACHKAUF.analysen} Analysen dazu. Sie gelten 24 Monate, wie alle
                  anderen.
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-start gap-5">
                  <div className="flex items-baseline gap-2">
                    <span style={{ font: "var(--type-num-xl)", color: "var(--text-1)" }}>{NACHKAUF.analysen}</span>
                    <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>Analysen</span>
                  </div>
                  <Preis netto={NACHKAUF.netto} takt={null} gross={false} />
                </div>
                {darfKaufen ? (
                  <button
                    type="button"
                    data-press
                    data-abo-nachkauf
                    onClick={() => zurKasse("nachkauf")}
                    disabled={laeuft !== null || lage === "zahlung-offen"}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                    style={{ ...KNOPF, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--accent-glow)" }}
                  >
                    <Icon name="plus" size={14} strokeWidth={2.4} />
                    {laeuft === "nachkauf" ? "Kasse öffnet …" : "Nachkaufen"}
                  </button>
                ) : (
                  <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    Nachkaufen kann die Verwaltung eures Gyms.
                  </span>
                )}
              </div>
              {darfKaufen && STEUERMODUS === "regel" && <UstFeld wert={ust} onWert={setUst} fehler={ustFehler} />}
              {fehler && (
                <p role="alert" style={{ font: "var(--type-sub)", color: "var(--text-1)" }}>
                  {fehler}
                </p>
              )}
            </section>

            {darfKaufen && (
              <section aria-labelledby="abo-rechnungen-titel" className="flex flex-col gap-3">
                <h2 id="abo-rechnungen-titel" style={LABEL}>
                  Rechnungen
                </h2>
                {rechnungen === null ? (
                  <Skeleton className="h-20 w-full rounded-card" />
                ) : rechnungen.length === 0 ? (
                  <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    Eure erste Rechnung erscheint hier, sobald Stripe sie ausgestellt hat.
                  </p>
                ) : (
                  <ul className="t-card flex flex-col divide-y p-1" style={{ borderColor: "var(--line)" }}>
                    {rechnungen.map((r) => {
                      const link = r.pdf ?? r.seite;
                      return (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="flex min-w-0 flex-col">
                          <span style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
                            {new Date(r.datum).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                            {" · "}
                            {euro(r.betrag)}
                            {r.offen ? " · offen" : ""}
                          </span>
                          <span className="truncate" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                            {[r.nummer, r.text].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            data-press
                            className="t-interactive inline-flex min-h-hit items-center gap-1.5 rounded-field px-3"
                            style={{ ...KNOPF, color: "var(--text-1)" }}
                          >
                            <Icon name="download" size={14} strokeWidth={2.2} />
                            PDF
                          </a>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function AboPage() {
  return (
    <Suspense fallback={null}>
      <AboSeite />
    </Suspense>
  );
}
