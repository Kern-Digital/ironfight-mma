"use client";

/**
 * ExerciseAnimation — abstrakte geometrische Übungsdarstellung
 *
 * Vollständig eigenständig entwickelt, kein Asset-Bezug zu fremden Apps.
 * Framer Motion + inline SVG; kein externes Icon-/Animationspaket nötig.
 *
 * Animationstypen:
 *   punch   — Boxing-Jab: Faust schießt horizontal vor, zieht zurück
 *   kick    — Muay Thai: Fuß/Schienbein schwenkt als Bogen aufwärts
 *   grapple — Wrestling/BJJ: zwei Kreise umkreisen sich (Clinch / Takedown)
 *   bounce  — Konditionierung: Kreis mit Squash-Stretch beim Aufprall
 *   breathe — Aufwärmen / Cooldown: Ringe pulsieren ruhig nach außen
 */

// AUSNAHME vom „kein framer-motion außerhalb components/motion/"
// (MOTION-BRIEF §3.1): Diese Datei animiert SVG-Formen — Kreise, Linien,
// Ellipsen, die zusammen die Übung vorführen. Hier ist die Bewegung der
// Inhalt, kein Baustein könnte sie kapseln.
import { motion } from "framer-motion";
import type { ExerciseKind, Category } from "@/lib/types";

// ─── Design-Token ─────────────────────────────────────────────────────────────

const T = {
  cyan:    "#23C4CE",
  cyanDim: "rgba(35,196,206,0.25)",
  pink:    "#FF4FA8",
  pinkDim: "rgba(255,79,168,0.25)",
  ink:     "#110B1E",
  fgDim:   "rgba(255,255,255,0.12)",
} as const;

// ─── Typ-Auflösung ────────────────────────────────────────────────────────────

type AnimKind = "punch" | "kick" | "grapple" | "bounce" | "breathe";

function toAnimKind(kind: ExerciseKind, cat: Category | "any"): AnimKind {
  if (kind === "warmup" || kind === "cooldown") return "breathe";
  if (kind === "conditioning") return "bounce";
  if (cat === "boxing") return "punch";
  if (cat === "muay-thai") return "kick";
  if (cat === "wrestling" || cat === "bjj") return "grapple";
  return "breathe";
}

// ─── Sub-Animationen ──────────────────────────────────────────────────────────

/** Boxing-Jab: linke Faust schießt vor */
function PunchAnim() {
  const dur = 1.4;
  return (
    <g>
      {/* Arm-Spur */}
      <line
        x1="35" y1="75" x2="168" y2="75"
        stroke={T.cyanDim}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Hintere Faust (Guard) — statisch */}
      <circle cx="38" cy="75" r="13" fill={T.cyanDim} />

      {/* Vordere Faust — bewegt sich vor und zurück */}
      <motion.circle
        cx={50} cy={75} r={15}
        fill={T.cyan}
        style={{ filter: "drop-shadow(0 0 10px rgba(35,196,206,.8))" }}
        animate={{ cx: [50, 162, 50] }}
        transition={{
          duration: dur,
          times: [0, 0.22, 1],
          ease: ["easeIn", "easeOut"],
          repeat: Infinity,
          repeatDelay: 0.25,
        }}
      />

      {/* Impact-Ring beim Aufprall */}
      <motion.circle
        cx={162} cy={75} r={18}
        fill="none"
        stroke={T.cyan}
        strokeWidth={2}
        animate={{
          opacity: [0, 0, 0.9, 0],
          r:       [15, 15, 30, 38],
        }}
        transition={{
          duration: dur,
          times: [0, 0.19, 0.26, 0.45],
          repeat: Infinity,
          repeatDelay: 0.25,
        }}
      />
    </g>
  );
}

/** Muay Thai Roundhouse: Fuß schwingt bogenförmig nach oben */
function KickAnim() {
  // Schwenkt von (160,120) über (145,40) nach (70,35)
  const dur = 1.6;
  return (
    <g>
      {/* Körper */}
      <circle cx="100" cy="32" r="12" fill={T.cyanDim} />
      <line x1="100" y1="44" x2="100" y2="90" stroke={T.cyanDim} strokeWidth="4" strokeLinecap="round" />
      <line x1="100" y1="90" x2="88" y2="130" stroke={T.cyanDim} strokeWidth="4" strokeLinecap="round" />

      {/* Standbein */}
      <line
        x1="100" y1="90" x2="112" y2="130"
        stroke={T.cyanDim} strokeWidth="4" strokeLinecap="round"
      />

      {/* Schwungbein / Schienbein — animated */}
      <motion.line
        x1={100} y1={90}
        x2={155} y2={125}
        stroke={T.cyan}
        strokeWidth="5"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 8px rgba(35,196,206,.7))" }}
        animate={{
          x2: [155, 65, 155],
          y2: [125, 38, 125],
        }}
        transition={{
          duration: dur,
          times: [0, 0.35, 1],
          ease: ["easeIn", "easeOut"],
          repeat: Infinity,
          repeatDelay: 0.4,
        }}
      />

      {/* Fuß-Kreis — folgt dem Bein-Endpunkt */}
      <motion.circle
        cx={155} cy={125} r={11}
        fill={T.cyan}
        style={{ filter: "drop-shadow(0 0 12px rgba(35,196,206,.9))" }}
        animate={{
          cx: [155, 65, 155],
          cy: [125, 38, 125],
        }}
        transition={{
          duration: dur,
          times: [0, 0.35, 1],
          ease: ["easeIn", "easeOut"],
          repeat: Infinity,
          repeatDelay: 0.4,
        }}
      />
    </g>
  );
}

/** Wrestling / BJJ: zwei Figuren umkreisen einander */
function GrappleAnim() {
  const dur = 2.8;
  // Kreisbahn um Mittelpunkt (100, 78)
  const R = 32;
  return (
    <g>
      {/* Mittelpunkt-Achse */}
      <circle cx="100" cy="78" r="4" fill={T.fgDim} />

      {/* Figur A — Cyan (der Athlet) */}
      <motion.circle
        cx={100 + R} cy={78} r={18}
        fill={T.cyan}
        style={{ filter: "drop-shadow(0 0 10px rgba(35,196,206,.7))" }}
        animate={{
          cx: [
            100 + R,
            100,
            100 - R,
            100,
            100 + R,
          ],
          cy: [
            78,
            78 - R,
            78,
            78 + R,
            78,
          ],
        }}
        transition={{
          duration: dur,
          ease: "linear",
          repeat: Infinity,
        }}
      />

      {/* Figur B — Pink (Gegner), entgegengesetzt */}
      <motion.circle
        cx={100 - R} cy={78} r={18}
        fill={T.pink}
        style={{ filter: "drop-shadow(0 0 8px rgba(255,79,168,.6))" }}
        animate={{
          cx: [
            100 - R,
            100,
            100 + R,
            100,
            100 - R,
          ],
          cy: [
            78,
            78 + R,
            78,
            78 - R,
            78,
          ],
        }}
        transition={{
          duration: dur,
          ease: "linear",
          repeat: Infinity,
        }}
      />

      {/* Label A */}
      <motion.text
        x={100 + R} y={83}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill={T.ink}
        animate={{
          x: [100 + R, 100, 100 - R, 100, 100 + R],
          y: [78, 78 - R, 78, 78 + R, 78],
        }}
        transition={{ duration: dur, ease: "linear", repeat: Infinity }}
      >
        A
      </motion.text>
    </g>
  );
}

/** Konditionierung: Kreis springt mit Squash-Stretch */
function BounceAnim() {
  const dur = 0.9;
  return (
    <g>
      {/* Schatten / Boden */}
      <motion.ellipse
        cx={100} cy={128} rx={22} ry={7}
        fill="rgba(35,196,206,0.18)"
        animate={{
          rx: [22, 12, 22],
          ry: [7, 3, 7],
          opacity: [0.35, 0.15, 0.35],
        }}
        transition={{
          duration: dur,
          ease: ["easeIn", "easeOut"],
          times: [0, 0.45, 1],
          repeat: Infinity,
        }}
      />

      {/* Springender Kreis */}
      <motion.circle
        cx={100} cy={100} r={22}
        fill={T.cyan}
        style={{ filter: "drop-shadow(0 0 14px rgba(35,196,206,.8))" }}
        animate={{
          cy:    [100, 38, 100],
          scaleX:[1,   1,  1],
          scaleY:[1,  1.15, 1],
        }}
        transition={{
          duration: dur,
          ease: ["easeIn", "easeOut"],
          times: [0, 0.45, 1],
          repeat: Infinity,
        }}
      />
    </g>
  );
}

/** Aufwärmen / Cooldown: Ringe expandieren ruhig nach außen */
function BreatheAnim() {
  const dur = 3.2;
  const rings = [
    { delay: 0,       r: 18, opacity: 0.8 },
    { delay: dur / 3, r: 18, opacity: 0.5 },
    { delay: (dur / 3) * 2, r: 18, opacity: 0.3 },
  ];

  return (
    <g>
      {/* Kern */}
      <motion.circle
        cx={100} cy={75} r={18}
        fill={T.cyan}
        style={{ filter: "drop-shadow(0 0 12px rgba(35,196,206,.9))" }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: dur, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Expansionsringe */}
      {rings.map(({ delay, r: startR, opacity }, i) => (
        <motion.circle
          key={i}
          cx={100} cy={75}
          r={startR}
          fill="none"
          stroke={T.cyan}
          strokeWidth={2}
          animate={{
            r:       [startR, 68],
            opacity: [opacity, 0],
          }}
          transition={{
            duration: dur,
            delay,
            ease: "easeOut",
            repeat: Infinity,
          }}
        />
      ))}
    </g>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

export interface ExerciseAnimationProps {
  kind: ExerciseKind;
  category: Category | "any";
  /** Klassen für den äußeren Container */
  className?: string;
}

export default function ExerciseAnimation({
  kind,
  category,
  className = "",
}: ExerciseAnimationProps) {
  const animKind = toAnimKind(kind, category);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-ink-2 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 150"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
      >
        {animKind === "punch"   && <PunchAnim />}
        {animKind === "kick"    && <KickAnim />}
        {animKind === "grapple" && <GrappleAnim />}
        {animKind === "bounce"  && <BounceAnim />}
        {animKind === "breathe" && <BreatheAnim />}
      </svg>
    </div>
  );
}
