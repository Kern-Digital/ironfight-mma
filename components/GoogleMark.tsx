/**
 * Googles Wort-/Bildmarke für „Mit Google anmelden".
 *
 * ─── DIE EINE STELLE MIT FESTEN HEX-WERTEN — UND WARUM SIE BLEIBEN ─────────
 *
 * DESIGN-BRIEF §1.1 verbietet hart geschriebene Farben in Komponenten, und
 * §5 sucht per `grep -riE '#[0-9a-f]{3,8}'` danach. Diese Datei ist ein
 * BEWUSSTER Treffer, denn hier gilt der Grund der Regel nicht:
 *
 * Das Zeichen gehört NICHT uns. Vier Farben (Blau, Grün, Gelb, Rot) sind von
 * Google vorgeschrieben; ein Gym-Branding darf sie nicht mitfärben, sonst ist
 * es nicht mehr Googles Marke, sondern eine Nachahmung. Dieselbe Logik wie
 * beim VS-Banner und beim Metall-Einstieg — Material statt Oberfläche —, nur
 * dass die Vorgabe diesmal von außen kommt.
 *
 * SIE STEHT HIER UND NICHT ZWEIMAL IN DEN SEITEN: Bis zum 13.09.2026 war
 * dieselbe Funktion Zeichen für Zeichen in `app/login/page.tsx` UND
 * `app/register/page.tsx` kopiert. Zwei Kopien heißen zwei Orte, an denen
 * jemand „die Farben an die App anpasst" — jetzt ist es einer, mit dieser
 * Notiz darüber.
 */
export default function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
