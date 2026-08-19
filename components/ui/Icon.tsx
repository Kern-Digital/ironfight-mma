/**
 * Zentrales Icon-Set — Stroke-basierte SVGs im einheitlichen Stil.
 * Ersetzt sämtliche Emoji in der App. Farbe via currentColor,
 * Größe via size-Prop (Default 20px).
 */

export type IconName =
  | "glove"
  | "gi"
  | "grapple"
  | "kick"
  | "trophy"
  | "bell"
  | "vibrate"
  | "moon"
  | "phone"
  | "lock"
  | "refresh"
  | "clipboard"
  | "hand"
  | "book"
  | "fullscreen"
  | "rope"
  | "barbell"
  | "dumbbell"
  | "ball"
  | "mat"
  | "body"
  | "agility"
  | "flame"
  | "check"
  | "x"
  | "warn"
  | "star"
  | "target"
  | "chart"
  | "calendar"
  | "users"
  | "shield"
  | "spark"
  | "timer"
  | "arrow-right"
  | "arrow-left"
  | "plus"
  | "wave"
  | "video"
  | "edit";

const PATHS: Record<IconName, React.ReactNode> = {
  // Boxhandschuh
  glove: (
    <>
      <path d="M7 11V8a5 5 0 0 1 10 0v4.5a4.5 4.5 0 0 1-4.5 4.5H10a3 3 0 0 1-3-3v-1.5a1.75 1.75 0 0 1 3.5 0" />
      <path d="M9.5 17v3h7v-3.2" />
    </>
  ),
  // Gi / Kampfanzug mit Gürtel
  gi: (
    <>
      <path d="M7 4 4.5 6.5 6 9.5l1.5-1V20h9V8.5l1.5 1 1.5-3L17 4l-3.5 5.5h-3L7 4Z" />
      <path d="M7.5 15.5h9" />
    </>
  ),
  // Grappling — zwei Ringer
  grapple: (
    <>
      <circle cx="6.5" cy="6" r="2" />
      <circle cx="17.5" cy="6" r="2" />
      <path d="M4 20l2-7 4 1.5L14 13l4 1 2 6" />
      <path d="M8.5 10.5 12 12.5l3-1.5" />
    </>
  ),
  // Kick — Bein mit Bewegungslinien
  kick: (
    <>
      <circle cx="7" cy="5" r="2" />
      <path d="M7.5 7.5 9 12l6 2.5 4.5-1" />
      <path d="M9 12l-2.5 7.5" />
      <path d="M16 9.5l2-1M16.5 12l2.5-.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 14v3M8.5 20h7M10 20v-2.5h4V20" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 16Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  vibrate: (
    <>
      <rect x="8.5" y="5" width="7" height="14" rx="1.6" />
      <path d="M5.5 9v6M2.8 10.5v3M18.5 9v6M21.2 10.5v3" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5Z" />,
  phone: (
    <>
      <rect x="7" y="3.5" width="10" height="17" rx="2" />
      <path d="M10.5 18h3" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <circle cx="12" cy="15.2" r="1.1" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.7 3.8v3.4h-3.4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="5" width="12" height="16" rx="2" />
      <path d="M9.5 5a2.5 2.5 0 0 1 5 0" />
      <path d="M9 11h6M9 14.5h6M9 18h3.5" />
    </>
  ),
  hand: (
    <>
      <path d="M8 11.5V6a1.4 1.4 0 0 1 2.8 0v4.6V5a1.4 1.4 0 0 1 2.8 0v5.6V6.5a1.4 1.4 0 0 1 2.8 0v6.8a6 6 0 0 1-6 6.2c-2.6 0-4-1.3-5-3.3l-1.8-3.8a1.4 1.4 0 0 1 2.4-1.3L8 13" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5 8.5 4.5 5 4.5v13c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-13c-3.5 0-5.5.5-7 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </>
  ),
  // Springseil
  rope: (
    <>
      <path d="M5 14c0-4.5 3-8 7-8s7 3.5 7 8" />
      <rect x="3.6" y="14" width="2.8" height="6" rx="1.2" />
      <rect x="17.6" y="14" width="2.8" height="6" rx="1.2" />
    </>
  ),
  barbell: (
    <>
      <path d="M2.5 12h3M18.5 12h3" />
      <rect x="5.5" y="7.5" width="2.6" height="9" rx="1" />
      <rect x="15.9" y="7.5" width="2.6" height="9" rx="1" />
      <path d="M8.1 12h7.8" />
    </>
  ),
  dumbbell: (
    <>
      <rect x="3" y="9" width="3" height="6" rx="1" />
      <rect x="18" y="9" width="3" height="6" rx="1" />
      <rect x="6" y="7.5" width="2.6" height="9" rx="1" />
      <rect x="15.4" y="7.5" width="2.6" height="9" rx="1" />
      <path d="M8.6 12h6.8" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5S9.5 5.8 12 3.5Z" />
      <path d="M3.5 12h17" />
    </>
  ),
  // Matte
  mat: (
    <>
      <path d="M3 16.5 12 12l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 12.5 12 8l9 4.5" />
    </>
  ),
  // Körpergewicht — stehende Person
  body: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.5v7M12 14.5 9 20.5M12 14.5l3 6M7.5 10.5 12 9l4.5 1.5" />
    </>
  ),
  // Agilität / Cartwheel
  agility: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10V5.5M12 14v4.5M10 12H5.5M14 12h4.5" />
      <path d="M8.8 8.8 6 6M15.2 15.2 18 18M15.2 8.8 18 6M8.8 15.2 6 18" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3.5c.5 3-1.5 4.5-3 6.5-1.4 1.9-2 3.5-2 5a7 7 0 0 0 14 0c0-2.5-1.2-4.5-2.5-6-.3 1.2-.8 2-1.8 2.6C16.5 8.5 15 5 12 3.5Z" />
      <path d="M12 20.5a3 3 0 0 1-3-3c0-1.4.9-2.4 2-3.5.4 1 1.2 1.5 2 2 .9.5 1.5 1.3 1.5 2.5a3 3 0 0 1-2.5 2Z" />
    </>
  ),
  check: <path d="M4.5 12.5 10 18 19.5 6.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  warn: (
    <>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4M12 16.8v.4" />
    </>
  ),
  star: (
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c.5-3.5 2.7-5.5 5.5-5.5s5 2 5.5 5.5" />
      <path d="M15.5 5.5a3 3 0 0 1 0 5.4M17 14.2c2 .7 3.2 2.5 3.5 5.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.5 9.5" />
    </>
  ),
  spark: (
    <path d="M12 3.5 13.8 10 20.5 12 13.8 14 12 20.5 10.2 14 3.5 12 10.2 10 12 3.5Z" />
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 2M9.5 3h5" />
    </>
  ),
  "arrow-right": <path d="M4 12h16M14 6l6 6-6 6" />,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  // Welle — Tidal-Markenmotiv
  wave: (
    <>
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity=".5" />
    </>
  ),
  // Videokamera (KI-Video-Analyse)
  video: (
    <>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
    </>
  ),
  // Stift — Bearbeiten
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.7 3.8a2.2 2.2 0 0 1 3.1 3.1L7.5 19.2 3.5 20.5l1.3-4z" />
    </>
  ),
};

export default function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
