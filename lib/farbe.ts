/**
 * FARBE HIN UND HER — zwischen dem Farbwähler des Browsers (Hex, sRGB) und
 * den zwei Zahlen, aus denen das Token-System alles ableitet (OKLCH-Farbton
 * und -Buntheit, globals.css Kopf, DESIGN-BRIEF §1).
 *
 * WARUM NICHT EINFACH DEN HEX-WERT SPEICHERN: Das Design rechnet Hintergrund,
 * Rand, Schrift, Glas und Glühen aus Farbton und Buntheit — in beiden Themes
 * mit unterschiedlicher Helligkeit (dunkel 0,78, hell 0,50). Ein fester
 * Hex-Wert wäre in einem der beiden Themes falsch. Das Gym wählt also seinen
 * FARBTON, nicht seinen Farbwert; die Helligkeit gehört dem Theme.
 *
 * Die Matrizen stammen aus Björn Ottossons OKLab-Veröffentlichung (2020) —
 * dieselbe Rechnung, die auch der Browser für `oklch()` benutzt.
 *
 * AUSSERHALB DES DARSTELLBAREN: Nicht jede Kombination aus Helligkeit,
 * Buntheit und Farbton lässt sich auf einem sRGB-Schirm zeigen. Statt
 * aufwendig zurückzurechnen, werden die Kanäle geklemmt — für einen Tupfer
 * neben dem Farbwähler reicht das, und der Browser zeigt die Seite ohnehin
 * selbst in echtem OKLCH an.
 */

const KOMMA = 1e-8;

function sRgbZuLinear(x: number): number {
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearZuSRgb(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function klemme(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export interface Oklch {
  /** Helligkeit 0–1. */
  l: number;
  /** Buntheit, praktisch 0–0,37. */
  c: number;
  /** Farbton in Grad, 0–360. */
  h: number;
}

/** „#00f7ff" → OKLCH. Kurzform (#0af) wird verstanden. */
export function hexZuOklch(hex: string): Oklch {
  const roh = hex.trim().replace(/^#/, "");
  const voll =
    roh.length === 3
      ? roh
          .split("")
          .map((z) => z + z)
          .join("")
      : roh;
  if (!/^[0-9a-f]{6}$/i.test(voll)) return { l: 0, c: 0, h: 0 };

  const r = sRgbZuLinear(parseInt(voll.slice(0, 2), 16) / 255);
  const g = sRgbZuLinear(parseInt(voll.slice(2, 4), 16) / 255);
  const b = sRgbZuLinear(parseInt(voll.slice(4, 6), 16) / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(a * a + bb * bb);
  // Ein unbuntes Grau hat keinen Farbton — 0 statt einer Zufallszahl aus dem
  // Rundungsrauschen.
  const h = c < KOMMA ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** OKLCH → „#00f7ff". */
export function oklchZuHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const r = linearZuSRgb(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S);
  const g = linearZuSRgb(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S);
  const bl = linearZuSRgb(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S);

  const zwei = (x: number) =>
    Math.round(klemme(x) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${zwei(r)}${zwei(g)}${zwei(bl)}`;
}
