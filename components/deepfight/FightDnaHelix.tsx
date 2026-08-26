"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/ui/Icon";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import type { DnaSplit } from "@/lib/fight-stats";
import { buildHelixModel } from "@/lib/fight-dna-helix";
import HelixGlyph, { glyphFocusColor } from "@/components/deepfight/HelixGlyph";
import type { HelixSceneProps } from "@/components/deepfight/HelixScene";

const DynamicHelixScene = dynamic<HelixSceneProps>(
  () => import("@/components/deepfight/HelixScene"),
  { ssr: false, loading: () => null },
);

/** Public integration API shared by athlete and opponent profiles. */
export interface FightDnaHelixProps {
  profile: {
    dna: GegnerDnaAnswers;
    dnaSplit: DnaSplit | null;
    dnaSplitWeight?: number;
  };
  variant?: "athlete" | "opponent";
  size?: "sm" | "md" | "lg";
  mode?: "completeness" | "split";
  focusCategoryId?: string | null;
  grownQuestionIds?: string[];
  onFocusChange?: (categoryId: string | null) => void;
  forceRenderer?: "auto" | "svg" | "webgl";
  tilt?: number;
  completenessLabel?: string;
  nearParticleCount?: number;
  farParticleCount?: number;
  glowIntensity?: number;
  flashFrequency?: number;
  twinkleIntensity?: number;
  wobbleStrength?: number;
  strandParticleDensity?: number;
  rungParticleDensity?: number;
  shellSpread?: number;
  wanderFlashCount?: number;
  wanderFlashIntensity?: number;
  wanderFlashSpeed?: number;
  wanderFlashWidth?: number;
  wanderBurstPause?: number;
  wanderRungStrike?: number;
  sideExitFrequency?: number;
  splitDamping?: number;
  splitTransitionRungs?: number;
  bokehCenterDensity?: number;
  bokehNearRatio?: number;
  strandInnerSizeRatio?: number;
  stubVariance?: number;
  opponentFlashInvert?: number;
  opponentInvertSoftness?: number;
  lightningFrequency?: number;
  splitZoomDistance?: number;
  rungKinkRatio?: number;
  rungKinkStrength?: number;
  lavaSpeed?: number;
  lavaOpacity?: number;
  lavaSharpness?: number;
  vignetteStrength?: number;
  grainEdgeSharpness?: number;
  grainNoiseAmount?: number;
  blueprintShare?: number;
  nearDriftSpeed?: number;
  farDriftSpeed?: number;
  focusGlow?: number;
  focusSide?: "auto" | "left" | "right";
  qaPulseProgress?: number | null;
  qaLightningProgress?: number | null;
  qaSparkProgress?: number | null;
  className?: string;
}

function canCreateWebGlContext(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    const extension = context.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function focusTokenAt(model: ReturnType<typeof buildHelixModel>, categoryId: string, mode: "completeness" | "split", variant: "athlete" | "opponent") {
  const segment = model.segments.find((item) => item.categoryId === categoryId);
  if (mode === "split" && model.bands && segment) {
    const progress = ((segment.start + segment.end) * 0.5) / Math.max(1, model.rungs.length);
    let cursor = 0;
    for (const band of model.bands) {
      cursor += band.share;
      if (progress <= cursor) return band.colorToken;
    }
  }
  return mode === "split" && segment
    ? segment.colorToken
    : variant === "athlete" ? "--accent-2" : "--line-strong";
}

export default function FightDnaHelix({
  profile,
  variant = "athlete",
  size = "lg",
  mode = "completeness",
  focusCategoryId = null,
  grownQuestionIds = [],
  onFocusChange,
  forceRenderer = "auto",
  tilt = 5,
  completenessLabel = "Profilstärke",
  nearParticleCount = 288,
  farParticleCount = 80,
  glowIntensity = 1.3,
  flashFrequency = 0.5,
  twinkleIntensity = 1.4,
  wobbleStrength = 0.8,
  strandParticleDensity = 28,
  rungParticleDensity = 160,
  shellSpread = 1.35,
  wanderFlashCount = 3,
  wanderFlashIntensity = 1.2,
  wanderFlashSpeed = 2.5,
  wanderFlashWidth = 0.3,
  wanderBurstPause = 3.5,
  wanderRungStrike = 0.8,
  sideExitFrequency = 0,
  splitDamping = 0.06,
  splitTransitionRungs = 5,
  bokehCenterDensity = 0.9,
  bokehNearRatio = 0.5,
  strandInnerSizeRatio = 1.35,
  stubVariance = 0.85,
  opponentFlashInvert = 1,
  opponentInvertSoftness = 0.15,
  lightningFrequency = 0.4,
  splitZoomDistance = 12.8,
  rungKinkRatio = 0.25,
  rungKinkStrength = 0,
  lavaSpeed = 0.7,
  lavaOpacity = 0.45,
  lavaSharpness = 0.35,
  vignetteStrength = 0.5,
  grainEdgeSharpness = 0.3,
  grainNoiseAmount = 0.9,
  blueprintShare = 0.65,
  nearDriftSpeed = 0.26,
  farDriftSpeed = 0.2,
  focusGlow = 1.65,
  focusSide = "auto",
  qaPulseProgress = null,
  qaLightningProgress = null,
  qaSparkProgress = null,
  className,
}: FightDnaHelixProps) {
  const model = useMemo(() => buildHelixModel(profile), [profile]);
  const hostRef = useRef<HTMLDivElement>(null);
  const recoveryTimerRef = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webGlAvailable, setWebGlAvailable] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.5 });
  const [anchorColor, setAnchorColor] = useState<string | null>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [sceneKey, setSceneKey] = useState(0);
  const [focusOpenCount, setFocusOpenCount] = useState(0);
  const [automaticFocusSide, setAutomaticFocusSide] = useState<"left" | "right">("left");
  const previousFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    setWebGlAvailable(canCreateWebGlContext());
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(
    () => () => {
      if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "120px",
    });
    const resize = new ResizeObserver(([entry]) => {
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    intersection.observe(element);
    resize.observe(element);
    return () => {
      intersection.disconnect();
      resize.disconnect();
    };
  }, []);

  const wantsWebGl =
    size !== "sm" &&
    !reducedMotion &&
    forceRenderer !== "svg" &&
    (forceRenderer === "webgl" || webGlAvailable);
  const showGlyph = !wantsWebGl || !sceneReady || contextLost;
  const motionActive = visible && pageVisible && !reducedMotion;
  const qaFrozen = qaPulseProgress !== null || qaLightningProgress !== null || qaSparkProgress !== null;
  const baseHeight = size === "sm" ? 96 : size === "md" ? 390 : 620;
  const focusedSegment = model.segments.find((segment) => segment.categoryId === focusCategoryId);
  const compactCallout = bounds.width > 0 && bounds.width < 620;
  const focusCardSide = focusSide === "auto" ? automaticFocusSide : focusSide;
  const mobileHudHeight = focusedSegment && compactCallout && size !== "sm" ? 188 : 0;
  const height = baseHeight + mobileHudHeight;
  const sceneHeight = height - mobileHudHeight;
  const anchorX = anchor.x * bounds.width;
  const anchorY = anchor.y * sceneHeight;
  const lineEndX = compactCallout
    ? bounds.width / 2
    : focusCardSide === "right"
      ? Math.max(bounds.width - 252, bounds.width * 0.66)
      : Math.min(252, bounds.width * 0.34);
  const lineEndY = compactCallout ? sceneHeight + 22 : bounds.height / 2;
  const leaderPath = useMemo(() => {
    if (compactCallout) return `M ${anchorX} ${anchorY} L ${anchorX} ${sceneHeight + 8} L ${lineEndX} ${lineEndY}`;
    const dx = lineEndX - anchorX;
    const dy = lineEndY - anchorY;
    if (Math.abs(dy) < 6) return `M ${anchorX} ${anchorY} L ${lineEndX} ${lineEndY}`;
    const seed = Math.sin((focusOpenCount + 1) * 17.31) * 43758.5453;
    const random = seed - Math.floor(seed);
    const firstTurn = 0.28 + random * 0.18;
    const turnX = anchorX + dx * firstTurn;
    return `M ${anchorX} ${anchorY} L ${turnX} ${anchorY} L ${turnX} ${lineEndY} L ${lineEndX} ${lineEndY}`;
  }, [anchorX, anchorY, compactCallout, focusOpenCount, lineEndX, lineEndY, sceneHeight]);
  const focusColorToken = focusedSegment
    ? focusTokenAt(model, focusedSegment.categoryId, mode, variant)
    : variant === "athlete" ? "--accent-2" : "--line-strong";
  const fallbackFocusColor = focusedSegment
    ? glyphFocusColor(model, focusedSegment.categoryId, mode, variant, splitDamping, splitTransitionRungs)
    : `var(${focusColorToken})`;
  const focusColor = anchorColor ?? fallbackFocusColor;

  useEffect(() => {
    const previous = previousFocusRef.current;
    if (focusCategoryId && focusCategoryId !== previous) {
      setFocusOpenCount((count) => count + 1);
      setAutomaticFocusSide((side) => side === "right" ? "left" : "right");
      setAnchorColor(null);
    }
    previousFocusRef.current = focusCategoryId;
  }, [focusCategoryId]);

  useEffect(() => {
    if (!wantsWebGl && focusedSegment) {
      const center = (focusedSegment.start + focusedSegment.end) / 2 / model.rungs.length;
      setAnchor({ x: 0.46, y: 0.07 + center * 0.82 });
    }
  }, [focusedSegment, model.rungs.length, wantsWebGl]);

  return (
    <section
      ref={hostRef}
      className={compactCallout ? `deepfight-helix--compact${className ? ` ${className}` : ""}` : className}
      aria-label="DeepFight-Helix"
      style={{
        position: "relative",
        height,
        minHeight: size === "sm" ? 64 : 320,
        overflow: "hidden",
        isolation: "isolate",
        background: "var(--bg-0)",
        borderRadius: "var(--r-xl)",
        "--lava-user-opacity": Math.min(1.4, Math.max(0, lavaOpacity)),
        "--lava-user-sharpness": Math.min(1, Math.max(0.2, lavaSharpness)),
        "--lava-user-blur": `${28 + (1 - Math.min(1, Math.max(0.2, lavaSharpness))) * 34}px`,
        "--vignette-user-strength": Math.min(1.4, Math.max(0, vignetteStrength)),
      } as CSSProperties}
    >
      <style>{`
        .deepfight-helix__lava {
          position: absolute;
          z-index: 0;
          pointer-events: none;
          --lava-theme-boost: 1;
          filter: blur(var(--lava-user-blur, 50px)) saturate(.72);
          will-change: transform, opacity, border-radius;
          animation-timing-function: cubic-bezier(.45,.05,.55,.95);
          animation-iteration-count: infinite;
        }
        .deepfight-helix__lava--a { animation-name: deepfight-lava-a; background: color-mix(in oklab, var(--accent) 34%, var(--bg-0)); }
        .deepfight-helix__lava--b { animation-name: deepfight-lava-b; background: color-mix(in oklab, var(--accent-2) 32%, var(--bg-0)); }
        .deepfight-helix__lava--c { animation-name: deepfight-lava-c; background: color-mix(in oklab, var(--accent-2) 28%, var(--bg-0)); }
        .deepfight-helix__lava--d { animation-name: deepfight-lava-d; background: color-mix(in oklab, var(--accent) 26%, var(--bg-0)); }
        @keyframes deepfight-lava-a {
          0%, 100% { transform: translate3d(-18%, -12%, 0) scale(.92) rotate(-4deg); border-radius: 48% 52% 62% 38% / 44% 58% 42% 56%; opacity: calc(var(--lava-user-opacity, 1) * .2 * var(--lava-theme-boost)); }
          27% { transform: translate3d(112%, 34%, 0) scale(1.18) rotate(7deg); border-radius: 72% 28% 38% 62% / 31% 69% 42% 58%; opacity: calc(var(--lava-user-opacity, 1) * .3 * var(--lava-theme-boost)); }
          56% { transform: translate3d(66%, 118%, 0) scale(1.02) rotate(-2deg); border-radius: 32% 68% 57% 43% / 70% 34% 66% 30%; opacity: calc(var(--lava-user-opacity, 1) * .23 * var(--lava-theme-boost)); }
          79% { transform: translate3d(-24%, 72%, 0) scale(1.1) rotate(5deg); border-radius: 61% 39% 28% 72% / 67% 38% 62% 33%; opacity: calc(var(--lava-user-opacity, 1) * .26 * var(--lava-theme-boost)); }
        }
        @keyframes deepfight-lava-b {
          0%, 100% { transform: translate3d(18%, 4%, 0) scale(1.08) rotate(5deg); border-radius: 67% 33% 42% 58% / 54% 28% 72% 46%; opacity: calc(var(--lava-user-opacity, 1) * .18 * var(--lava-theme-boost)); }
          24% { transform: translate3d(-108%, 46%, 0) scale(.9) rotate(-8deg); border-radius: 36% 64% 73% 27% / 29% 62% 38% 71%; opacity: calc(var(--lava-user-opacity, 1) * .28 * var(--lava-theme-boost)); }
          53% { transform: translate3d(-74%, 126%, 0) scale(1.2) rotate(3deg); border-radius: 64% 36% 31% 69% / 68% 41% 59% 32%; opacity: calc(var(--lava-user-opacity, 1) * .22 * var(--lava-theme-boost)); }
          78% { transform: translate3d(30%, 82%, 0) scale(.96) rotate(-4deg); border-radius: 41% 59% 74% 26% / 35% 69% 31% 65%; opacity: calc(var(--lava-user-opacity, 1) * .25 * var(--lava-theme-boost)); }
        }
        @keyframes deepfight-lava-c {
          0%, 100% { transform: translate3d(-12%, 104%, 0) scale(.86); border-radius: 58% 42% 29% 71% / 64% 34% 66% 36%; opacity: calc(var(--lava-user-opacity, 1) * .16 * var(--lava-theme-boost)); }
          31% { transform: translate3d(94%, 58%, 0) scale(1.24) rotate(6deg); border-radius: 28% 72% 63% 37% / 38% 74% 26% 62%; opacity: calc(var(--lava-user-opacity, 1) * .25 * var(--lava-theme-boost)); }
          62% { transform: translate3d(54%, -54%, 0) scale(1.02) rotate(-5deg); border-radius: 72% 28% 41% 59% / 31% 61% 39% 69%; opacity: calc(var(--lava-user-opacity, 1) * .2 * var(--lava-theme-boost)); }
          84% { transform: translate3d(-40%, -10%, 0) scale(1.14) rotate(2deg); border-radius: 37% 63% 70% 30% / 68% 36% 64% 32%; opacity: calc(var(--lava-user-opacity, 1) * .23 * var(--lava-theme-boost)); }
        }
        @keyframes deepfight-lava-d {
          0%, 100% { transform: translate3d(82%, -22%, 0) scale(.92); border-radius: 42% 58% 31% 69% / 61% 34% 66% 39%; opacity: calc(var(--lava-user-opacity, 1) * .14 * var(--lava-theme-boost)); }
          29% { transform: translate3d(-48%, 8%, 0) scale(1.12) rotate(-6deg); border-radius: 69% 31% 62% 38% / 29% 71% 35% 65%; opacity: calc(var(--lava-user-opacity, 1) * .22 * var(--lava-theme-boost)); }
          61% { transform: translate3d(-20%, 112%, 0) scale(.98) rotate(4deg); border-radius: 29% 71% 38% 62% / 74% 28% 72% 26%; opacity: calc(var(--lava-user-opacity, 1) * .18 * var(--lava-theme-boost)); }
          82% { transform: translate3d(90%, 76%, 0) scale(1.16) rotate(-2deg); border-radius: 63% 37% 72% 28% / 39% 64% 36% 61%; opacity: calc(var(--lava-user-opacity, 1) * .2 * var(--lava-theme-boost)); }
        }
        /* Schmale Viewports (Leon, 2026-08-26): border-radius-Morphing erzwingt
           Repaint + Blur pro Frame und ist der teuerste Teil der Lava. Unter
           620 px driften und atmen die Blobs weiter, die Form friert auf dem
           jeweiligen 0%-Keyframe ein. */
        .deepfight-helix--compact .deepfight-helix__lava { will-change: transform, opacity; }
        .deepfight-helix--compact .deepfight-helix__lava--a { animation-name: deepfight-lava-a-compact; border-radius: 48% 52% 62% 38% / 44% 58% 42% 56%; }
        .deepfight-helix--compact .deepfight-helix__lava--b { animation-name: deepfight-lava-b-compact; border-radius: 67% 33% 42% 58% / 54% 28% 72% 46%; }
        .deepfight-helix--compact .deepfight-helix__lava--c { animation-name: deepfight-lava-c-compact; border-radius: 58% 42% 29% 71% / 64% 34% 66% 36%; }
        .deepfight-helix--compact .deepfight-helix__lava--d { animation-name: deepfight-lava-d-compact; border-radius: 42% 58% 31% 69% / 61% 34% 66% 39%; }
        @keyframes deepfight-lava-a-compact {
          0%, 100% { transform: translate3d(-18%, -12%, 0) scale(.92) rotate(-4deg); opacity: calc(var(--lava-user-opacity, 1) * .2 * var(--lava-theme-boost)); }
          27% { transform: translate3d(112%, 34%, 0) scale(1.18) rotate(7deg); opacity: calc(var(--lava-user-opacity, 1) * .3 * var(--lava-theme-boost)); }
          56% { transform: translate3d(66%, 118%, 0) scale(1.02) rotate(-2deg); opacity: calc(var(--lava-user-opacity, 1) * .23 * var(--lava-theme-boost)); }
          79% { transform: translate3d(-24%, 72%, 0) scale(1.1) rotate(5deg); opacity: calc(var(--lava-user-opacity, 1) * .26 * var(--lava-theme-boost)); }
        }
        @keyframes deepfight-lava-b-compact {
          0%, 100% { transform: translate3d(18%, 4%, 0) scale(1.08) rotate(5deg); opacity: calc(var(--lava-user-opacity, 1) * .18 * var(--lava-theme-boost)); }
          24% { transform: translate3d(-108%, 46%, 0) scale(.9) rotate(-8deg); opacity: calc(var(--lava-user-opacity, 1) * .28 * var(--lava-theme-boost)); }
          53% { transform: translate3d(-74%, 126%, 0) scale(1.2) rotate(3deg); opacity: calc(var(--lava-user-opacity, 1) * .22 * var(--lava-theme-boost)); }
          78% { transform: translate3d(30%, 82%, 0) scale(.96) rotate(-4deg); opacity: calc(var(--lava-user-opacity, 1) * .25 * var(--lava-theme-boost)); }
        }
        @keyframes deepfight-lava-c-compact {
          0%, 100% { transform: translate3d(-12%, 104%, 0) scale(.86); opacity: calc(var(--lava-user-opacity, 1) * .16 * var(--lava-theme-boost)); }
          31% { transform: translate3d(94%, 58%, 0) scale(1.24) rotate(6deg); opacity: calc(var(--lava-user-opacity, 1) * .25 * var(--lava-theme-boost)); }
          62% { transform: translate3d(54%, -54%, 0) scale(1.02) rotate(-5deg); opacity: calc(var(--lava-user-opacity, 1) * .2 * var(--lava-theme-boost)); }
          84% { transform: translate3d(-40%, -10%, 0) scale(1.14) rotate(2deg); opacity: calc(var(--lava-user-opacity, 1) * .23 * var(--lava-theme-boost)); }
        }
        @keyframes deepfight-lava-d-compact {
          0%, 100% { transform: translate3d(82%, -22%, 0) scale(.92); opacity: calc(var(--lava-user-opacity, 1) * .14 * var(--lava-theme-boost)); }
          29% { transform: translate3d(-48%, 8%, 0) scale(1.12) rotate(-6deg); opacity: calc(var(--lava-user-opacity, 1) * .22 * var(--lava-theme-boost)); }
          61% { transform: translate3d(-20%, 112%, 0) scale(.98) rotate(4deg); opacity: calc(var(--lava-user-opacity, 1) * .18 * var(--lava-theme-boost)); }
          82% { transform: translate3d(90%, 76%, 0) scale(1.16) rotate(-2deg); opacity: calc(var(--lava-user-opacity, 1) * .2 * var(--lava-theme-boost)); }
        }
        .deepfight-helix__ambient { opacity: .22; }
        .deepfight-helix__vignette { background: radial-gradient(ellipse at center, transparent 42%, color-mix(in oklab, var(--bg-0) 78%, transparent) 100%); opacity: var(--vignette-user-strength, 1); }
        [data-theme=light] .deepfight-helix__lava { --lava-theme-boost: 2.15; filter: blur(calc(var(--lava-user-blur, 50px) * .9)) saturate(1.16); mix-blend-mode: multiply; }
        [data-theme=light] .deepfight-helix__lava--a { background: color-mix(in oklab, var(--accent-2) 74%, var(--bg-2)); }
        [data-theme=light] .deepfight-helix__lava--b { background: color-mix(in oklab, var(--accent) 72%, var(--bg-2)); }
        [data-theme=light] .deepfight-helix__lava--c { background: color-mix(in oklab, var(--accent) 68%, var(--accent-2)); }
        [data-theme=light] .deepfight-helix__lava--d { background: color-mix(in oklab, var(--accent-2) 66%, var(--accent)); }
        [data-theme=light] .deepfight-helix__ambient { opacity: .3; }
        [data-theme=light] .deepfight-helix__vignette { background: radial-gradient(ellipse at center, transparent 62%, color-mix(in oklab, var(--text-2) 32%, transparent) 100%); }
        @media (prefers-reduced-motion: reduce) {
          .deepfight-helix__lava { animation: none !important; }
        }
      `}</style>
      <div
        aria-hidden
        className="deepfight-helix__ambient"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "var(--ambient-fight)",
        }}
      />
      <div
        aria-hidden
        className="deepfight-helix__lava deepfight-helix__lava--a"
        style={{
          left: "-16%", top: "-10%", width: "68%", height: "38%",
          animationDuration: `${16 / Math.max(0.25, lavaSpeed)}s`,
          animationPlayState: motionActive && !qaFrozen ? "running" : "paused",
        }}
      />
      <div
        aria-hidden
        className="deepfight-helix__lava deepfight-helix__lava--b"
        style={{
          left: "64%", top: "-18%", width: "36%", height: "72%",
          animationDuration: `${18 / Math.max(0.25, lavaSpeed)}s`,
          animationPlayState: motionActive && !qaFrozen ? "running" : "paused",
        }}
      />
      <div
        aria-hidden
        className="deepfight-helix__lava deepfight-helix__lava--c"
        style={{
          left: "-14%", top: "28%", width: "76%", height: "31%",
          animationDuration: `${20 / Math.max(0.25, lavaSpeed)}s`,
          animationPlayState: motionActive && !qaFrozen ? "running" : "paused",
        }}
      />
      <div
        aria-hidden
        className="deepfight-helix__lava deepfight-helix__lava--d"
        style={{
          left: "46%", top: "18%", width: "42%", height: "56%",
          animationDuration: `${15 / Math.max(0.25, lavaSpeed)}s`,
          animationPlayState: motionActive && !qaFrozen ? "running" : "paused",
        }}
      />
      <div
        aria-hidden
        className="deepfight-helix__vignette"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden={wantsWebGl && sceneReady && !contextLost}
        style={{
          position: "absolute",
          inset: size === "sm"
            ? 0
            : compactCallout || !focusedSegment
              ? "6% 8%"
              : focusCardSide === "right" ? "6% 20% 6% 4%" : "6% 4% 6% 20%",
          zIndex: 2,
          display: "grid",
          placeItems: "center",
          opacity: showGlyph ? 1 : 0,
          transition: "opacity var(--dur-med) var(--ease-out), inset 1s var(--ease-out)",
          pointerEvents: showGlyph ? "auto" : "none",
        }}
      >
        <HelixGlyph
          model={model}
          variant={variant}
          mode={mode}
          focusCategoryId={focusCategoryId}
          grownQuestionIds={grownQuestionIds}
          animated={!reducedMotion}
          splitDamping={splitDamping}
          splitTransitionRungs={splitTransitionRungs}
          stubVariance={stubVariance}
          blueprintShare={blueprintShare}
          className="h-full w-full"
        />
      </div>

      {wantsWebGl && !contextLost && (
        <div
          style={{
            position: "absolute",
            inset: `0 0 ${mobileHudHeight}px`,
            zIndex: 2,
            opacity: sceneReady && !contextLost ? 1 : 0,
            transition: "opacity var(--dur-med) var(--ease-out)",
            touchAction: "pan-y",
          }}
        >
          <DynamicHelixScene
            key={sceneKey}
            model={model}
            variant={variant}
            mode={mode}
            focusCategoryId={focusCategoryId}
            grownQuestionIds={grownQuestionIds}
            active={motionActive}
            tilt={Math.min(8, Math.max(0, tilt))}
            nearParticleCount={nearParticleCount}
            farParticleCount={farParticleCount}
            glowIntensity={glowIntensity}
            flashFrequency={flashFrequency}
            twinkleIntensity={twinkleIntensity}
            wobbleStrength={wobbleStrength}
            /* Mobil-Deckel (Leon, 2026-08-26): Desktop-Defaults 28/160 bleiben
               unangetastet — unter 620 px muss der Deckel aber real greifen, sonst
               laeuft auf dem Handy die volle Partikellast. Nicht auf 30/150 anheben. */
            strandParticleDensity={compactCallout ? Math.min(18, strandParticleDensity) : strandParticleDensity}
            rungParticleDensity={compactCallout ? Math.min(110, rungParticleDensity) : rungParticleDensity}
            shellSpread={shellSpread}
            wanderFlashCount={wanderFlashCount}
            wanderFlashIntensity={wanderFlashIntensity}
            wanderFlashSpeed={wanderFlashSpeed}
            wanderFlashWidth={wanderFlashWidth}
            wanderBurstPause={wanderBurstPause}
            wanderRungStrike={wanderRungStrike}
            sideExitFrequency={sideExitFrequency}
            splitDamping={splitDamping}
            splitTransitionRungs={splitTransitionRungs}
            bokehCenterDensity={bokehCenterDensity}
            bokehNearRatio={bokehNearRatio}
            strandInnerSizeRatio={strandInnerSizeRatio}
            stubVariance={stubVariance}
            opponentFlashInvert={opponentFlashInvert}
            opponentInvertSoftness={opponentInvertSoftness}
            lightningFrequency={lightningFrequency}
            splitZoomDistance={splitZoomDistance}
            rungKinkRatio={rungKinkRatio}
            rungKinkStrength={rungKinkStrength}
            allowRungKinks={!compactCallout}
            grainEdgeSharpness={grainEdgeSharpness}
            grainNoiseAmount={grainNoiseAmount}
            blueprintShare={blueprintShare}
            nearDriftSpeed={nearDriftSpeed}
            farDriftSpeed={farDriftSpeed}
            focusGlow={focusGlow}
            focusOffset={compactCallout || !focusedSegment ? 0 : focusCardSide === "right" ? -0.72 : 0.72}
            qaPulseProgress={qaPulseProgress}
            qaLightningProgress={qaLightningProgress}
            qaSparkProgress={qaSparkProgress}
            onReady={() => setSceneReady(true)}
            onContextLost={() => {
              setContextLost(true);
              setSceneReady(false);
              if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current);
              recoveryTimerRef.current = window.setTimeout(() => {
                setSceneKey((key) => key + 1);
                setContextLost(false);
                recoveryTimerRef.current = null;
              }, 2500);
            }}
            onContextRestored={() => {
              if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current);
              recoveryTimerRef.current = null;
              setContextLost(false);
              setSceneReady(false);
              setSceneKey((key) => key + 1);
            }}
            onAnchorChange={(next) => {
              if (next.color) setAnchorColor(next.color);
              setAnchor((current) =>
                Math.abs(current.x - next.x) + Math.abs(current.y - next.y) > 0.002 ? next : current,
              );
            }}
          />
        </div>
      )}

      <div
        aria-hidden
        style={{
          position: "absolute",
          zIndex: 5,
          left: 16,
          top: 14,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            font: "var(--type-num-xl)",
            color: "var(--text-1)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {model.completeness}
        </span>
        <span style={{ font: "var(--type-label)", color: "var(--text-3)", letterSpacing: "var(--ls-label)", textTransform: "uppercase" }}>
          Prozent {completenessLabel}
        </span>
      </div>

      <AnimatePresence>
        {focusedSegment && size !== "sm" && bounds.width > 0 && (
          <>
            <motion.svg
              key={`${focusedSegment.categoryId}-${focusOpenCount}`}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              width={bounds.width}
              height={bounds.height}
              viewBox={`0 0 ${bounds.width} ${bounds.height}`}
              style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none", overflow: "visible" }}
            >
              <motion.path
                d={leaderPath}
                fill="none"
                stroke={focusColor}
                strokeWidth="1"
                opacity="0.88"
                initial={reducedMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
              />
              <motion.path
                d={`M ${anchorX - 4} ${anchorY} L ${anchorX} ${anchorY - 4} L ${anchorX + 4} ${anchorY} L ${anchorX} ${anchorY + 4} Z`}
                fill={focusColor}
                initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                animate={reducedMotion ? { scale: 1, opacity: 1 } : { scale: [0, 1.65, 1], opacity: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.32, delay: reducedMotion ? 0 : 0.16 }}
                style={{ transformOrigin: `${anchorX}px ${anchorY}px` }}
              />
              <circle cx={lineEndX} cy={lineEndY} r="2.2" fill={focusColor} />
            </motion.svg>
            <motion.aside
              key={`${focusedSegment.categoryId}-${focusOpenCount}-${focusCardSide}`}
              initial={reducedMotion ? false : {
                opacity: 0,
                clipPath: compactCallout
                  ? "polygon(0 0, 0 0, 0 100%, 0 100%, 0 100%, 0 0)"
                  : "polygon(16px 0, 16px 0, 16px 100%, 16px 100%, 0 100%, 0 16px)",
              }}
              animate={{
                opacity: 1,
                clipPath: "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
              }}
              exit={{ opacity: 0, x: compactCallout ? 0 : focusCardSide === "right" ? 8 : -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                position: "absolute",
                zIndex: 7,
                right: compactCallout ? 12 : focusCardSide === "right" ? "max(16px, env(safe-area-inset-right))" : "auto",
                left: compactCallout ? 12 : focusCardSide === "left" ? "max(16px, env(safe-area-inset-left))" : "auto",
                bottom: compactCallout ? "max(12px, env(safe-area-inset-bottom))" : "auto",
                top: compactCallout ? "auto" : "50%",
                transform: compactCallout ? undefined : "translateY(-50%)",
                width: compactCallout ? "auto" : 238,
                padding: 1,
                background: `color-mix(in oklab, var(--line-strong) 62%, ${focusColor})`,
                clipPath: "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
                backdropFilter: "blur(var(--glass-blur))",
                boxShadow: `var(--glass-shadow), 0 0 22px color-mix(in oklab, ${focusColor} 18%, transparent)`,
                color: "var(--text-1)",
              }}
            >
              <div
                style={{
                  position: "relative",
                  minHeight: 166,
                  padding: "18px 50px 15px 18px",
                  background: "color-mix(in oklab, var(--bg-1) 88%, transparent)",
                  clipPath: "polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)",
                }}
              >
                <span aria-hidden style={{ position: "absolute", left: 7, top: 7, width: 18, height: 18, borderLeft: `1px solid ${focusColor}`, borderTop: `1px solid ${focusColor}`, clipPath: "polygon(8px 0, 100% 0, 100% 1px, 8px 1px, 1px 8px, 1px 100%, 0 100%, 0 8px)" }} />
                <span aria-hidden style={{ position: "absolute", right: 7, bottom: 7, width: 18, height: 18, borderRight: `1px solid ${focusColor}`, borderBottom: `1px solid ${focusColor}`, clipPath: "polygon(0 calc(100% - 1px), 10px calc(100% - 1px), calc(100% - 1px) 10px, calc(100% - 1px) 0, 100% 0, 100% 10px, 10px 100%, 0 100%)" }} />
                <p style={{ margin: 0, font: "700 14px/1.2 var(--font-display), sans-serif", letterSpacing: "0.09em", textTransform: "uppercase" }}>
                  {focusedSegment.label}
                </p>
                <p style={{ margin: "5px 0 10px", font: "var(--type-sub)", color: "var(--text-2)" }}>
                  {focusedSegment.hint}
                </p>
                <p style={{ margin: 0, font: "700 30px/1 var(--font-mono), monospace", fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: focusColor }}>{focusedSegment.answered}</span>
                  <span style={{ color: "var(--text-3)" }}> / {focusedSegment.total}</span>
                </p>
                <div aria-hidden style={{ display: "flex", alignItems: "center", margin: "12px 0 9px" }}>
                  <span style={{ flex: 1, height: 1, background: "var(--line-strong)" }} />
                  <span style={{ width: 6, height: 6, background: focusColor, transform: "rotate(45deg)" }} />
                  <span style={{ flex: 1, height: 1, background: "var(--line-strong)" }} />
                </div>
                <p style={{ margin: 0, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, color: "var(--text-3)", font: "var(--type-label)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  <span>{completenessLabel}</span><span style={{ color: focusColor, fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>{model.completeness} %</span>
                </p>
                <button
                  type="button"
                  onClick={() => onFocusChange?.(null)}
                  aria-label="Segmentfokus schließen"
                  style={{
                    position: "absolute",
                    right: 4,
                    top: 4,
                    inlineSize: 44,
                    blockSize: 44,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--text-2)",
                    background: "transparent",
                    border: 0,
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>


      {contextLost && (
        <p
          role="status"
          style={{ position: "absolute", left: 16, bottom: 12, margin: 0, font: "var(--type-label)", color: "var(--text-3)" }}
        >
          2D-Fallback aktiv
        </p>
      )}
    </section>
  );
}
