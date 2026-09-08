"use client";

/**
 * Synthesis — die bewegte Hintergrund-Schicht des DeepFight-Bereichs.
 *
 * Ein Fragment-Shader auf einem bildschirmfüllenden Dreiecksnetz: mehrfach
 * verdrehtes Rauschen („domain warping"), darüber zwei Wellen, die drei
 * Farben ineinander blenden, plus ein weicher Kern-Schein in der Mitte.
 * Vorlage ist die Komponente, die Leon am 06.09.2026 gebracht hat; geändert
 * wurden gegenüber der Vorlage nur drei Dinge, alle drei aus Hausregeln:
 *
 * 1. **KEINE FARBEN IN DER KOMPONENTE.** Die Vorlage nahm drei feste
 *    Farbwerte (Schiefer, Violett, Himmelblau) als Props entgegen. Farben
 *    gehören nach `app/globals.css` (DESIGN-BRIEF §1.1, §5) — die Komponente
 *    nimmt deshalb TOKEN-NAMEN und löst sie zur Laufzeit auf.
 * 2. **Zwei Modi statt einer Palette.** Leons Ansage vom 06.09.2026: Der
 *    Hintergrund kennt NUR den Unterschied hell gegen dunkel und folgt dem
 *    Branding-Kit ausdrücklich NICHT. „Unsere Leute" ist immer der
 *    Tidal-Blauton, „Gegner" immer Silber — derselbe Griff wie in der DNA,
 *    wo der Gegner-Zweig ins Neutrale zieht. Der Grund ist Schwarz bzw. Weiß.
 *    Die Werte stehen als `--df-*` in globals.css.
 * 3. **Sie hält an, wenn niemand hinsieht.** Bewegung nur, solange die
 *    Fläche im Bild ist, der Tab vorn liegt und `prefers-reduced-motion`
 *    nicht gesetzt ist (MOTION-BRIEF §3.6). Ohne Bewegung bleibt EIN Bild
 *    stehen, der Hintergrund verschwindet also nie. Ohne WebGL rendert die
 *    Komponente gar nichts — dahinter liegt weiter die normale
 *    Ambient-Schicht aus globals.css.
 *
 * ABWEICHUNG VON DESIGN-BRIEF §3, BEWUSST UND VON LEON ANGEORDNET
 * (06.09.2026): Dort steht „Kein Canvas/WebGL für Hintergründe." Die Regel
 * gilt weiter für den Rest der App; der DeepFight-Bereich ist die
 * ausdrückliche Ausnahme. Die Auflagen aus derselben Stelle bleiben in Kraft
 * und sind oben umgesetzt: Lesbarkeit unangetastet (die Schicht liegt hinter
 * dem Inhalt und nimmt keine Zeiger-Ereignisse), Dark UND Light, Halt bei
 * `prefers-reduced-motion`.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useResolvedTokens } from "@/components/deepfight/use-resolved-tokens";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uScale;
  uniform float uComplexity;
  uniform float uDistortion;
  uniform float uGlowIntensity;
  uniform float uFlowFrequency;
  uniform float uContrast;

  mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
  }

  void main() {
    float minRes = min(uResolution.x, uResolution.y);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / minRes;

    vec2 p = uv * uScale;
    float t = uTime;

    // Mehrfach verdrehtes Feld — die Schleifenzahl steuert uComplexity.
    for(float i = 1.0; i < 20.0; i++) {
        if(i >= uComplexity) break;
        p *= rot(t * 0.08 + i * 0.15);
        p += vec2(
            sin(p.x * i + t),
            cos(p.x * i - t)
        ) * (uDistortion / i);
    }

    // Zwei Wellen blenden die drei Farben ineinander.
    float flow1 = 0.5 + 0.5 * sin(p.x * (uFlowFrequency * 0.8) + t);
    float flow2 = 0.5 + 0.5 * sin(p.y * uFlowFrequency + t * 1.1);

    vec3 color = mix(uColor1, uColor2, flow1);
    color = mix(color, uColor3, flow2);

    // Kern-Schein in der Mitte.
    float dist = length(uv);
    float glow = exp(-dist * 1.5);
    color += uColor3 * glow * uGlowIntensity;

    color = smoothstep(0.0, uContrast, color);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Die drei Farb-Tokens in der Reihenfolge, in der der Shader sie mischt. */
export type SynthesisFarbTokens = readonly [string, string, string];

/** Wen die Werkbank gerade analysiert — das ist der EINZIGE Farbschalter. */
export type SynthesisModus = "leute" | "gegner";

/**
 * Reihenfolge: Grund · tiefe Tonstufe · heller Ton. Der Shader blendet
 * Grund → tiefe Stufe → hellen Ton und legt den Kern-Schein in der Mitte
 * ebenfalls im hellen Ton darüber. Alle Werte stehen in globals.css und
 * kennen nur hell gegen dunkel.
 */
export const SYNTHESIS_TOKENS: Record<SynthesisModus, SynthesisFarbTokens> = {
  leute: ["--df-grund", "--df-ton-leute-tief", "--df-ton-leute"],
  gegner: ["--df-grund", "--df-ton-gegner-tief", "--df-ton-gegner"],
};

export interface SynthesisProps {
  className?: string;
  /**
   * „leute" = Tidal-Blauton, „gegner" = Silber. Mehr Fälle gibt es nicht:
   * Der Hintergrund folgt weder dem Gym-Akzent noch dem Branding-Kit
   * (Leon 06.09.2026).
   */
  modus?: SynthesisModus;
  /** Tempo der Verdrehung. 0 hält das Bild an. */
  speed?: number;
  scale?: number;
  complexity?: number;
  distortion?: number;
  glowIntensity?: number;
  flowFrequency?: number;
  contrast?: number;
  /** Nur für Prüfseiten — im Betrieb entscheidet `modus`. */
  colorTokens?: SynthesisFarbTokens;
  /** Grundfläche hinter dem Netz, falls WebGL einen Frame braucht. */
  groundToken?: string;
  /**
   * Deckkraft der ganzen Schicht. Standard ist das Token `--df-deckkraft`
   * aus globals.css (Leons Zahl, 45 %) — eine Zahl hier wäre eine zweite
   * Quelle. Die Prüfseite überschreibt das Token am Feld, um zu messen.
   * Bewusst niedrig: Der Hintergrund soll den Bereich färben, nicht mit dem
   * Inhalt um Aufmerksamkeit ringen (DESIGN-BRIEF §3 — Lesbarkeit unangetastet).
   */
  opacity?: number | string;
}

interface EffektProps {
  speed: number;
  scale: number;
  complexity: number;
  distortion: number;
  glowIntensity: number;
  flowFrequency: number;
  contrast: number;
  colors: readonly [THREE.Color, THREE.Color, THREE.Color];
  /** false = die Zeit steht still, das Bild bleibt stehen. */
  animiert: boolean;
}

function Effekt({
  speed,
  scale,
  complexity,
  distortion,
  glowIntensity,
  flowFrequency,
  contrast,
  colors,
  animiert,
}: EffektProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uColor1: { value: colors[0].clone() },
      uColor2: { value: colors[1].clone() },
      uColor3: { value: colors[2].clone() },
      uScale: { value: scale },
      uComplexity: { value: complexity },
      uDistortion: { value: distortion },
      uGlowIntensity: { value: glowIntensity },
      uFlowFrequency: { value: flowFrequency },
      uContrast: { value: contrast },
    }),
    // Absichtlich einmalig: die Werte werden unten per Effekt nachgezogen,
    // damit ein Farbwechsel das Material nicht neu baut (das würde flackern).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Zielfarben — der Moduswechsel (Blau ↔ Silber) BLENDET statt zu springen
  // (MOTION-BRIEF §1.1, verwandeln statt umschalten): useFrame zieht die
  // Uniforms je Bild ein Stück nach. Steht die Zeit still (reduced-motion,
  // Tab hinten), springen sie sofort — dort wird ohnehin nur ein Bild gemalt.
  const zielRef = useRef(colors);
  zielRef.current = colors;

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    if (!animiert) {
      material.uniforms.uColor1.value.copy(colors[0]);
      material.uniforms.uColor2.value.copy(colors[1]);
      material.uniforms.uColor3.value.copy(colors[2]);
    }
    material.uniforms.uScale.value = scale;
    material.uniforms.uComplexity.value = complexity;
    material.uniforms.uDistortion.value = distortion;
    material.uniforms.uGlowIntensity.value = glowIntensity;
    material.uniforms.uFlowFrequency.value = flowFrequency;
    material.uniforms.uContrast.value = contrast;
  }, [colors, animiert, scale, complexity, distortion, glowIntensity, flowFrequency, contrast]);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    if (animiert) {
      material.uniforms.uTime.value = state.clock.getElapsedTime() * speed;
      // 0.06 je Bild ≈ eine Sekunde bis zur neuen Farbe — langsam genug, dass
      // der Wechsel als Verwandlung liest, schnell genug, dass er zum Klick
      // gehört.
      const ziel = zielRef.current;
      material.uniforms.uColor1.value.lerp(ziel[0], 0.06);
      material.uniforms.uColor2.value.lerp(ziel[1], 0.06);
      material.uniforms.uColor3.value.lerp(ziel[2], 0.06);
    }
    material.uniforms.uResolution.value.set(state.size.width, state.size.height);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function kannWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function Synthesis({
  className,
  modus = "leute",
  // Leons eingestellte Werte vom 06.09.2026 (Screenshot seines Reglerfelds).
  speed = 0.17,
  scale = 2.0,
  complexity = 6.0,
  distortion = 0.38,
  glowIntensity = 0.33,
  flowFrequency = 2.0,
  contrast = 1.2,
  colorTokens,
  groundToken = "--df-grund",
  opacity = "var(--df-deckkraft)",
}: SynthesisProps) {
  const tokens = colorTokens ?? SYNTHESIS_TOKENS[modus];
  const hostRef = useRef<HTMLDivElement>(null);
  const [webGl, setWebGl] = useState(false);
  const [reduziert, setReduziert] = useState(false);
  const [imBild, setImBild] = useState(true);
  const [tabVorn, setTabVorn] = useState(true);

  const tokenNamen = useMemo(() => [...tokens], [tokens]);
  const aufgeloest = useResolvedTokens(tokenNamen, hostRef);

  useEffect(() => {
    setWebGl(kannWebGl());
    const abfrage = matchMedia("(prefers-reduced-motion: reduce)");
    const aktualisieren = () => setReduziert(abfrage.matches);
    aktualisieren();
    abfrage.addEventListener?.("change", aktualisieren);
    return () => abfrage.removeEventListener?.("change", aktualisieren);
  }, []);

  useEffect(() => {
    const aktualisieren = () => setTabVorn(document.visibilityState !== "hidden");
    aktualisieren();
    document.addEventListener("visibilitychange", aktualisieren);
    return () => document.removeEventListener("visibilitychange", aktualisieren);
  }, []);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const beobachter = new IntersectionObserver(([eintrag]) => setImBild(eintrag.isIntersecting), {
      rootMargin: "120px",
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, []);

  const farben = useMemo(() => {
    const gelesen = tokens.map((name) => aufgeloest[name]);
    if (gelesen.some((farbe) => !farbe)) return null;
    return gelesen as unknown as readonly [THREE.Color, THREE.Color, THREE.Color];
  }, [aufgeloest, tokens]);

  const animiert = imBild && tabVorn && !reduziert;

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={["pointer-events-none absolute inset-0 h-full w-full overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      // Der Grund kommt NUR mit WebGL: Ohne rendert die Schicht gar nichts,
      // und die Ambient-Schicht der Hülle trägt den Bereich allein. Ein
      // schwarzer Grund ohne Bild darüber hätte sie schlicht verdeckt.
      style={webGl ? { background: `var(${groundToken})` } : undefined}
    >
      {/* Erst gerendert wird, wenn die Farben gelesen sind: ein Frame in den
          Vorlagen-Hexwerten wäre genau der Ausreißer, den §1.1 verbietet. */}
      {webGl && farben && (
        <div style={{ opacity, height: "100%", width: "100%" }}>
          <Canvas
            camera={{ position: [0, 0, 1] }}
            dpr={1}
            frameloop={animiert ? "always" : "demand"}
            gl={{ antialias: false, powerPreference: "high-performance" }}
          >
            <Effekt
              speed={speed}
              scale={scale}
              complexity={complexity}
              distortion={distortion}
              glowIntensity={glowIntensity}
              flowFrequency={flowFrequency}
              contrast={contrast}
              colors={farben}
              animiert={animiert}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
}
