"use client";

/**
 * Rahmen der Beitritts-Seiten (Multi-Gym Phase 2, Checkpoint 1C).
 *
 * Diese Seiten sind für viele Menschen der ERSTE Bildschirm der App —
 * meist noch ausgeloggt, oft auf dem Handy, aus einem Link im Kurs-Chat.
 * Aufbau seit Leons Vorlage vom 31.08.: hinter allem laufen die
 * Kampfsport-Bänder (JoinBackdrop), davor steht EINE dunkle Karte mit
 * Tunnel-Animation und Verlauf (.join-panel in globals.css).
 *
 * Die Karte ist in beiden Themes dunkel und bringt ihre eigenen Text-Farben
 * mit (--panel-fg/-2/-3). Alles davon leitet sich aus --accent-h/--accent-c
 * ab — ein Gym-Branding färbt Tunnel, Verlauf und Felder automatisch mit
 * (DESIGN-BRIEF §1: eine Variable ändern, die App folgt).
 */

import Icon from "@/components/ui/Icon";
import JoinBackdrop from "@/components/JoinBackdrop";
import Link from "next/link";

export const JOIN_BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function JoinLayout({
  eyebrow,
  title,
  sub,
  logo,
  legal,
  children,
}: {
  /** Kurze Rubrik über der Überschrift. */
  eyebrow: string;
  title: string;
  /**
   * Logo des einladenden Gyms (Branding-Kit, Konzept §8). Ohne Angabe steht
   * dort das Tidal-Zeichen — siehe JoinMark.
   */
  logo?: string | null;
  /** Erklärender Satz — ganze Sätze, kein Stichwortstil. */
  sub?: string;
  /**
   * Rechts-Zeile am Fuß zeigen. NUR dort, wo als Nächstes wirklich ein
   * Beitritt oder eine Registrierung folgt — auf „schon Mitglied" oder einem
   * abgelaufenen Code stimmt niemand irgendetwas zu.
   */
  legal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <JoinBackdrop />

      {/* Auf dem Desktop deutlich breiter (Leon 31.08.) — mobil bleibt
          die volle Breite, dort gibt es nichts zu gewinnen. */}
      <div className="join-panel relative z-10 w-full max-w-sm sm:max-w-xl">
        {/* Ruhiges Glühen hinter dem Kopf + Verlauf darüber — reine Deko.
            Die wandernden Ringe sind raus (Leon 31.08.). */}
        <div className="join-tunnel" aria-hidden />
        <div className="join-panel-veil" aria-hidden />

        <div
          className="relative z-10 flex flex-col items-center gap-5 px-7 pt-11 sm:gap-7 sm:px-14 sm:pt-16"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2.5rem)",
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <JoinMark logo={logo} />
            {/* Über dem Tunnel-Licht braucht die Rubrik den kräftigeren Ton —
                mit --panel-fg-3 verschwand sie im Glühen. */}
            <span className="t-label" style={{ color: "var(--panel-fg-2)" }}>
              {eyebrow}
            </span>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
                color: "var(--panel-fg)",
              }}
            >
              {title}
            </h1>
            {sub && (
              <p
                className="mt-1"
                style={{ font: "var(--type-sub)", color: "var(--panel-fg-2)" }}
              >
                {sub}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-4">{children}</div>

          {legal && <JoinLegalNote />}
        </div>
      </div>
    </main>
  );
}

/**
 * Das Zeichen über der Kopfzeile.
 *
 * Gehört dem GYM, nicht uns: hat das Gym ein Branding-Kit gebucht und ein
 * Logo hinterlegt (gyms/{gymId}.branding.logoUrl, Konzept §8), steht das
 * dort. Solange keines hinterlegt ist — und das ist heute bei jedem Gym so —
 * steht dort das Tidal-Zeichen (Leon 31.08.).
 *
 * Die FARBEN der Karte brauchen dafür nichts Weiteres: Verlauf, Glühen,
 * Felder und der Knopf leiten sich alle aus --accent-h/--accent-c ab. Setzt
 * das Branding-Kit diese beiden Werte auf die Gym-Farbe, färbt sich die
 * ganze Karte samt „Jetzt loslegen" von selbst mit (DESIGN-BRIEF §1).
 */
function JoinMark({ logo }: { logo?: string | null }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        className="mb-2 h-12 w-auto object-contain"
        style={{ maxWidth: "160px" }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      className="mb-2 h-11 w-11 object-contain"
    />
  );
}

/**
 * Rechts-Zeile am Fuß der Karte — Platzierung aus Leons Vorlage übernommen
 * (er hat sie ausdrücklich als richtig platziert bezeichnet, 31.08.).
 *
 * OFFEN / NOCH NICHT VERLINKT: Nutzungsbedingungen und Datenschutzhinweise
 * gibt es in der App noch nicht als Seiten. Sie stehen in der Kostenkarte
 * unter „vor der ersten Zahlung fällig" (zusammen mit Impressum und AVV).
 * Deshalb steht der Satz hier bewusst als TEXT und nicht als toter Link.
 * Sobald /agb und /datenschutz existieren: die beiden <span> durch <Link>
 * ersetzen, sonst nichts ändern. Siehe Backlog in CLAUDE.md.
 */
function JoinLegalNote() {
  const linkLook: React.CSSProperties = {
    color: "var(--panel-fg-2)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  };
  return (
    <p
      className="text-center"
      style={{
        font: "var(--type-sub)",
        fontSize: "12px",
        lineHeight: 1.5,
        color: "var(--panel-fg-3)",
      }}
    >
      Mit dem Beitritt stimmst du unseren{" "}
      <span style={linkLook}>Nutzungsbedingungen</span> und{" "}
      <span style={linkLook}>Datenschutzhinweisen</span> zu.
    </p>
  );
}

/** Primärer Knopf (Akzentfläche) — als Link oder als Aktion. */
export function JoinPrimary({
  href,
  onClick,
  disabled,
  icon,
  children,
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Icon>["name"];
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    ...JOIN_BTN_FONT,
    background: "var(--panel-accent)",
    color: "var(--panel-on-accent)",
    boxShadow: "var(--panel-accent-glow)",
    textDecoration: "none",
  };
  const className =
    "t-interactive inline-flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-5 disabled:opacity-40";
  const inner = (
    <>
      {icon && <Icon name={icon} size={14} strokeWidth={2.4} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {inner}
    </button>
  );
}

/**
 * Zweiter Weg — seit Leons Anmerkung vom 31.08. nur noch TEXT: keine Fläche,
 * kein Rahmen, eine Stufe kleiner. Der primäre Knopf soll allein stehen.
 * Die Trefferfläche bleibt trotzdem bei 44 px (Design-Brief §1.8).
 */
export function JoinSecondary({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    ...JOIN_BTN_FONT,
    fontSize: "12px",
    background: "transparent",
    color: "var(--panel-fg-2)",
    textDecoration: "none",
  };
  const className =
    "inline-flex min-h-hit w-full items-center justify-center gap-2 px-3 transition-colors";
  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}
