"use client";

// AUSNAHME (MOTION-BRIEF §3.1): Die Helix — dort IST die Bewegung der Inhalt.
import { motion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import type { HelixModel } from "@/lib/fight-dna-helix";

interface HelixGlyphProps {
  model: HelixModel;
  variant?: "athlete" | "opponent";
  mode?: "completeness" | "split";
  focusCategoryId?: string | null;
  grownQuestionIds?: string[];
  animated?: boolean;
  splitDamping?: number;
  splitTransitionRungs?: number;
  stubVariance?: number;
  blueprintShare?: number;
  className?: string;
}

const WIDTH = 88;
const HEIGHT = 144;
const PADDING = -4;
const AMPLITUDE = 23;
const TURNS = 2;

function glyphNoise(index: number, salt: number) {
  let value = (Math.imul(index + 1, 1664525) + Math.imul(salt + 1, 1013904223)) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function hashQuestionId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function visualRungs(model: HelixModel, mode: "completeness" | "split") {
  const compare = (a: HelixModel["rungs"][number], b: HelixModel["rungs"][number]) =>
    hashQuestionId(a.questionId) - hashQuestionId(b.questionId) || a.questionId.localeCompare(b.questionId);
  return mode === "completeness"
    ? [...model.rungs].sort(compare)
    : model.segments.flatMap((segment) =>
        model.rungs.filter((rung) => rung.categoryId === segment.categoryId).sort(compare),
      );
}

function strandPoint(index: number, side: 1 | -1, total: number) {
  const progress = total > 1 ? index / (total - 1) : 0;
  const phase = progress * Math.PI * 2 * TURNS;
  return {
    x: WIDTH / 2 + Math.sin(phase) * AMPLITUDE * side,
    y: PADDING + progress * (HEIGHT - PADDING * 2),
    depth: Math.cos(phase) * side,
  };
}

function bandToken(model: HelixModel, index: number): string | null {
  if (!model.bands) return null;
  const progress = (index + 0.5) / model.rungs.length;
  let cursor = 0;
  for (const band of model.bands) {
    cursor += band.share;
    if (progress <= cursor) return band.colorToken;
  }
  return model.bands[model.bands.length - 1]?.colorToken ?? null;
}

function baseCssColor(
  model: HelixModel,
  index: number,
  side: 1 | -1,
  variant: "athlete" | "opponent",
  lightTheme = false,
) {
  const linearProgress = index / Math.max(1, model.rungs.length - 1);
  const curveStart = side === 1 ? 0.18 : 0.42;
  const curveEnd = side === 1 ? 0.58 : 0.82;
  const normalized = Math.max(0, Math.min(1, (linearProgress - curveStart) / (curveEnd - curveStart)));
  const balancedProgress = variant === "athlete" && !lightTheme
    ? normalized * normalized * (3 - 2 * normalized)
    : linearProgress;
  const progress = Math.round(balancedProgress * 100);
  const start = variant === "athlete"
    ? side === 1 ? "--accent" : "--accent-2"
    : side === 1 ? "--text-2" : "--text-3";
  const end = variant === "athlete"
    ? side === 1 ? "--accent-2" : "--accent"
    : side === 1 ? "--text-3" : "--text-2";
  return `color-mix(in oklab, var(${start}) ${100 - progress}%, var(${end}))`;
}

function splitCssColor(
  model: HelixModel,
  index: number,
  side: 1 | -1,
  splitDamping: number,
  transitionRungs: number,
  lightTheme = false,
): string | null {
  const own = bandToken(model, index);
  if (!own || !model.bands) return null;
  const progress = index / Math.max(1, model.rungs.length - 1);
  let cursor = 0;
  let categoryColor = `var(${own})`;
  for (let bandIndex = 0; bandIndex < model.bands.length - 1; bandIndex += 1) {
    cursor += model.bands[bandIndex].share;
    const left = model.bands[bandIndex].colorToken;
    const right = model.bands[bandIndex + 1].colorToken;
    const boundaryKey = hashQuestionId(`${left}:${right}`) + (side === 1 ? 0 : 97);
    const base = Math.max(3, Math.min(7, transitionRungs));
    const leftShare = model.bands[bandIndex].share;
    const rightBandShare = model.bands[bandIndex + 1].share;
    const leftSpan = Math.min(base * (0.78 + glyphNoise(boundaryKey, 17) * 0.48) / Math.max(1, model.rungs.length - 1), leftShare * 0.28);
    const rightSpan = Math.min(base * (0.78 + glyphNoise(boundaryKey, 23) * 0.48) / Math.max(1, model.rungs.length - 1), rightBandShare * 0.28);
    const fringe = (glyphNoise(index + boundaryKey, 29) - 0.5) * 1.1 / Math.max(1, model.rungs.length - 1);
    const boundary = cursor + fringe;
    if (progress < boundary - leftSpan || progress > boundary + rightSpan) continue;
    const normalized = Math.max(0, Math.min(1, (progress - boundary + leftSpan) / (leftSpan + rightSpan)));
    const eased = normalized * normalized * (3 - 2 * normalized);
    const rightShare = Math.round(eased * 100);
    categoryColor = `color-mix(in oklab, var(${left}) ${100 - rightShare}%, var(${right}))`;
    break;
  }
  const categoryShare = Math.round((1 - Math.max(0, Math.min(0.1, splitDamping))) * 100);
  return `color-mix(in oklab, ${categoryColor} ${categoryShare}%, ${baseCssColor(model, index, side, "athlete", lightTheme)})`;
}

export function glyphFocusColor(
  model: HelixModel,
  categoryId: string,
  mode: "completeness" | "split",
  variant: "athlete" | "opponent",
  splitDamping: number,
  splitTransitionRungs: number,
) {
  const layout = visualRungs(model, mode);
  const slots = layout.map((rung, slot) => ({ rung, slot })).filter((item) => item.rung.categoryId === categoryId);
  const slot = slots[Math.floor((slots.length - 1) / 2)]?.slot ?? Math.floor((layout.length - 1) / 2);
  const plus = strandPoint(slot, 1, layout.length);
  const minus = strandPoint(slot, -1, layout.length);
  const side: 1 | -1 = plus.depth >= minus.depth ? 1 : -1;
  return mode === "split"
    ? splitCssColor(model, slot, side, splitDamping, splitTransitionRungs, true) ?? baseCssColor(model, slot, side, "athlete", true)
    : baseCssColor(model, slot, side, variant, true);
}

function glyphGhostProfile(questionId: string, variance: number) {
  const hash = hashQuestionId(questionId);
  const spread = Math.max(0, Math.min(1.5, variance));
  const twoSided = glyphNoise(hash, 137) > 0.62 - Math.min(1, spread) * 0.26;
  return {
    twoSided,
    singleRight: !twoSided && glyphNoise(hash, 143) > 0.5,
    leftStart: 0.035 + (0.012 + glyphNoise(hash, 138) * 0.105 - 0.035) * spread,
    leftEnd: 0.305 + (0.16 + glyphNoise(hash, 139) * 0.31 - 0.305) * spread,
    rightStart: 0.695 + (0.53 + glyphNoise(hash, 140) * 0.31 - 0.695) * spread,
    rightEnd: 0.965 + (0.89 + glyphNoise(hash, 141) * 0.098 - 0.965) * spread,
  };
}

function glyphOpenStage(
  questionId: string,
  blueprintShare: number,
) {
  const lowStrengthBlueprint = Math.max(0.35, Math.min(0.65, blueprintShare));
  const stableScore = glyphNoise(hashQuestionId(questionId), 401);
  if (stableScore < lowStrengthBlueprint) return "blueprint" as const;
  return stableScore < lowStrengthBlueprint + 0.32 ? "stub" as const : "hint" as const;
}

function glyphBlueprintVisibility(
  questionId: string,
  slot: number,
  layout: HelixModel["rungs"],
  completeness: number,
  blueprintShare: number,
) {
  const strength = Math.max(0, Math.min(1, completeness / 100));
  const lowStrengthBlueprint = Math.max(0.35, Math.min(0.65, blueprintShare));
  const targetBlueprint = lowStrengthBlueprint + (0.15 - lowStrengthBlueprint) * strength;
  const stableScore = glyphNoise(hashQuestionId(questionId), 401);
  const nearAnswered = strength > 0.65 && layout.some((rung, index) => rung.answered && Math.abs(index - slot) < 3);
  if (nearAnswered) return 0.08;
  const blend = Math.max(0, Math.min(1, (stableScore - targetBlueprint) / 0.08));
  const eased = blend * blend * (3 - 2 * blend);
  return 1 + (0.08 - 1) * eased;
}

function glyphRungSplit(index: number, total: number, questionId: string) {
  const progress = index / Math.max(1, total - 1);
  return Math.max(0.28, Math.min(0.72, 0.5 + (progress - 0.5) * 0.34 + (glyphNoise(hashQuestionId(questionId), 146) - 0.5) * 0.085));
}

export default function HelixGlyph({
  model,
  variant = "athlete",
  mode = "completeness",
  focusCategoryId = null,
  grownQuestionIds = [],
  animated = true,
  splitDamping = 0.1,
  splitTransitionRungs = 5,
  stubVariance = 0.55,
  blueprintShare = 0.5,
  className,
}: HelixGlyphProps) {
  const gradientId = useId().replaceAll(":", "");
  const [lightTheme, setLightTheme] = useState(false);
  const grown = new Set(grownQuestionIds);
  const layout = visualRungs(model, mode);
  const athleteTokens = ["--accent", "--accent-2"] as const;
  const opponentTokens = ["--text-2", "--text-3"] as const;
  const effectiveVariant = mode === "split" ? "athlete" : variant;
  const backboneTokens = effectiveVariant === "athlete" ? athleteTokens : opponentTokens;

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setLightTheme(root.getAttribute("data-theme") === "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label={`DeepFight-DNA, ${model.completeness} Prozent vollständig`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${gradientId}-left`} x1="0" y1="0" x2="0.65" y2="1">
          <stop offset="0" stopColor={`var(${backboneTokens[0]})`} />
          <stop offset="1" stopColor={`var(${backboneTokens[1]})`} />
        </linearGradient>
        <linearGradient id={`${gradientId}-right`} x1="0.35" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`var(${backboneTokens[1]})`} />
          <stop offset="1" stopColor={`var(${backboneTokens[0]})`} />
        </linearGradient>
        <filter id={`${gradientId}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${gradientId}-halo`} x="-160%" y="-160%" width="420%" height="420%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter id={`${gradientId}-open-soft`} x="-80%" y="-180%" width="260%" height="460%">
          <feGaussianBlur stdDeviation="0.72" />
        </filter>
        {layout.map((rung, index) => {
          const token = mode === "split" ? bandToken(model, index) : null;
          const leftColor = token
            ? splitCssColor(model, index, 1, splitDamping, splitTransitionRungs, lightTheme) ?? `var(${token})`
            : baseCssColor(model, index, 1, effectiveVariant, lightTheme);
          const rightColor = token
            ? splitCssColor(model, index, -1, splitDamping, splitTransitionRungs, lightTheme) ?? `var(${token})`
            : baseCssColor(model, index, -1, effectiveVariant, lightTheme);
          const split = glyphRungSplit(index, layout.length, rung.questionId) * 100;
          return (
            <linearGradient key={`rung-gradient-${rung.questionId}`} id={`${gradientId}-rung-${index}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset={`${Math.max(0, split - 5)}%`} stopColor={leftColor} />
              <stop offset={`${Math.min(100, split + 5)}%`} stopColor={rightColor} />
            </linearGradient>
          );
        })}
      </defs>
      <motion.g
        animate={animated ? { opacity: [0.88, 1, 0.88] } : { opacity: 1 }}
        transition={animated ? { duration: 4.8, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        {([1, -1] as const).map((side, sideIndex) => (
          <polyline
            key={`grains-${side}`}
            points={layout.map((_, index) => {
              const point = strandPoint(index, side, layout.length);
              return `${point.x},${point.y}`;
            }).join(" ")}
            fill="none"
            stroke={`url(#${gradientId}-${sideIndex === 0 ? "left" : "right"})`}
            strokeWidth={effectiveVariant === "athlete" ? 3.4 : 3.15}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5.8 3.1"
            opacity={effectiveVariant === "athlete" ? 0.98 : 0.86}
          />
        ))}
        {layout.slice(0, -1).flatMap((rung, index) => {
          const next = index + 1;
          const segmentFocused = !focusCategoryId || rung.categoryId === focusCategoryId;
          const token = mode === "split" ? bandToken(model, index) : null;
          return ([1, -1] as const).map((side, sideIndex) => {
            const a = strandPoint(index, side, layout.length);
            const b = strandPoint(next, side, layout.length);
            const color = token ? splitCssColor(model, index, side, splitDamping, splitTransitionRungs, lightTheme) ?? `var(${token})` : `url(#${gradientId}-${sideIndex === 0 ? "left" : "right"})`;
            return (
              <line
                key={`${rung.questionId}-${side}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeWidth={segmentFocused ? (effectiveVariant === "athlete" ? 3.2 : 2.95) : 2.35}
                strokeLinecap="round"
                strokeDasharray="4.9 2.5"
                opacity={segmentFocused ? (effectiveVariant === "athlete" ? 0.98 : 0.84) : 0.46}
                filter={segmentFocused && focusCategoryId ? `url(#${gradientId}-glow)` : undefined}
                style={{ transition: "opacity 600ms ease, stroke 800ms ease, stroke-width 600ms ease" }}
              />
            );
          });
        })}

        {layout.slice(0, 48).map((rung, index) => {
          const side = index % 2 === 0 ? 1 : -1;
          const point = strandPoint(index, side, layout.length);
          const token = mode === "split" ? bandToken(model, index) : backboneTokens[index % 2];
          return (
            <circle
              key={`grain-${rung.questionId}`}
              cx={point.x + (glyphNoise(index, 3) - 0.5) * 4.8}
              cy={point.y + (glyphNoise(index, 4) - 0.5) * 3.2}
              r={0.35 + glyphNoise(index, 5) * 0.5}
              fill={effectiveVariant === "opponent" && index % 8 === 0 ? "var(--text-1)" : `var(${token ?? (effectiveVariant === "opponent" ? "--text-2" : "--accent-2")})`}
              opacity={0.3 + glyphNoise(index, 6) * 0.44}
            />
          );
        })}

        {layout.map((rung, index) => {
          const left = strandPoint(index, 1, layout.length);
          const right = strandPoint(index, -1, layout.length);
          const front = left.depth >= right.depth ? left : right;
          const deviation = (glyphNoise(index, 8) - 0.5) * 1.2;
          const rungLeft = { x: left.x, y: left.y - deviation };
          const rungRight = { x: right.x, y: right.y + deviation };
          const focused = !focusCategoryId || rung.categoryId === focusCategoryId;
          const token = mode === "split" ? bandToken(model, index) : effectiveVariant === "opponent" ? "--text-2" : "--accent-2";
          const rungColor = mode === "split"
            ? splitCssColor(model, index, 1, splitDamping, splitTransitionRungs, lightTheme) ?? `var(${token ?? "--accent-2"})`
            : `var(${effectiveVariant === "opponent" ? "--text-2" : "--accent-2"})`;
          const rungGradient = `url(#${gradientId}-rung-${index})`;
          const leftJointColor = mode === "split"
            ? splitCssColor(model, index, 1, splitDamping, splitTransitionRungs, lightTheme) ?? rungColor
            : baseCssColor(model, index, 1, effectiveVariant, lightTheme);
          const rightJointColor = mode === "split"
            ? splitCssColor(model, index, -1, splitDamping, splitTransitionRungs, lightTheme) ?? rungColor
            : baseCssColor(model, index, -1, effectiveVariant, lightTheme);
          const isGrown = grown.has(rung.questionId);
          const ghost = glyphGhostProfile(rung.questionId, stubVariance);
          const openStage = glyphOpenStage(rung.questionId, blueprintShare);
          const blueprintVisibility = glyphBlueprintVisibility(rung.questionId, index, layout, model.completeness, blueprintShare);
          const breathDuration = 6 + glyphNoise(hashQuestionId(rung.questionId), 412) * 4;
          const at = (amount: number) => ({
            x: rungLeft.x + (rungRight.x - rungLeft.x) * amount,
            y: rungLeft.y + (rungRight.y - rungLeft.y) * amount,
          });
          const leftStart = at(ghost.leftStart);
          const leftStub = at(ghost.leftEnd);
          const rightStub = at(ghost.rightStart);
          const rightEnd = at(ghost.rightEnd);
          return (
            <motion.g
              key={rung.questionId}
              initial={isGrown && animated ? { opacity: 0, scale: 0.25 } : false}
              animate={{ opacity: focused ? 1 : 0.5, scale: 1 }}
              transition={{ duration: isGrown ? 0.72 : 0.6, delay: isGrown ? grownQuestionIds.indexOf(rung.questionId) * 0.06 : 0 }}
              style={{ transformOrigin: `${WIDTH / 2}px ${left.y}px` }}
            >
              {rung.answered ? (
                <motion.line
                  x1={rungLeft.x}
                  y1={rungLeft.y}
                  x2={rungRight.x}
                  y2={rungRight.y}
                  stroke={rungGradient}
                  strokeWidth={2.1 + Math.max(left.depth, right.depth) * 0.32}
                  strokeLinecap="round"
                  strokeDasharray="4.2 2.1"
                  opacity={effectiveVariant === "athlete" ? 0.96 : 0.84}
                  initial={isGrown && animated ? { pathLength: 0.28 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: isGrown ? 0.8 : 0, delay: isGrown ? grownQuestionIds.indexOf(rung.questionId) * 0.12 : 0 }}
                  style={{ transition: "stroke 800ms ease" }}
                />
              ) : (
                <>
                  {openStage === "blueprint" && (
                    <motion.line
                      x1={rungLeft.x} y1={rungLeft.y} x2={rungRight.x} y2={rungRight.y}
                      stroke={lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"} strokeWidth={lightTheme ? 1.02 : 0.82} strokeLinecap="round" strokeDasharray="0.1 1.35"
                      filter={lightTheme ? `url(#${gradientId}-open-soft)` : undefined}
                      animate={animated ? { opacity: lightTheme ? [0.04 * blueprintVisibility, 0.075 * blueprintVisibility, 0.04 * blueprintVisibility] : [0.14 * blueprintVisibility, 0.24 * blueprintVisibility, 0.14 * blueprintVisibility] } : { opacity: (lightTheme ? 0.055 : 0.19) * blueprintVisibility }}
                      transition={animated ? { duration: breathDuration, repeat: Infinity, ease: "easeInOut" } : undefined}
                    />
                  )}
                  {openStage === "stub" && (!ghost.singleRight || ghost.twoSided) && (
                    <motion.line x1={leftStart.x} y1={leftStart.y} x2={leftStub.x} y2={leftStub.y} stroke={lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"} strokeWidth={lightTheme ? 1.28 : 1.1} strokeLinecap="round" strokeDasharray="0.1 1.7" filter={lightTheme ? `url(#${gradientId}-open-soft)` : undefined}
                      animate={animated ? { opacity: lightTheme ? [0.065, 0.11, 0.065] : [0.27, 0.4, 0.27] } : { opacity: lightTheme ? 0.085 : 0.34 }} transition={animated ? { duration: breathDuration, repeat: Infinity, ease: "easeInOut" } : undefined} />
                  )}
                  {openStage === "stub" && (ghost.singleRight || ghost.twoSided) && (
                    <motion.line x1={rightStub.x} y1={rightStub.y} x2={rightEnd.x} y2={rightEnd.y} stroke={lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"} strokeWidth={lightTheme ? 1.28 : 1.1} strokeLinecap="round" strokeDasharray="0.1 1.7" filter={lightTheme ? `url(#${gradientId}-open-soft)` : undefined}
                      animate={animated ? { opacity: lightTheme ? [0.065, 0.11, 0.065] : [0.27, 0.4, 0.27] } : { opacity: lightTheme ? 0.085 : 0.34 }} transition={animated ? { duration: breathDuration, repeat: Infinity, ease: "easeInOut" } : undefined} />
                  )}
                  {openStage === "hint" && [0.2, 0.42, 0.64, 0.81].map((amount, dustIndex) => {
                    const point = at(amount + (glyphNoise(index + dustIndex, 419) - 0.5) * 0.05);
                    return <motion.circle key={dustIndex} cx={point.x} cy={point.y} r={(lightTheme ? 0.46 : 0.34) + glyphNoise(index + dustIndex, 421) * 0.24} fill={lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"} filter={lightTheme ? `url(#${gradientId}-open-soft)` : undefined}
                      animate={animated ? { opacity: lightTheme ? [0.025, 0.06, 0.025] : [0.1, 0.2, 0.1] } : { opacity: lightTheme ? 0.04 : 0.15 }} transition={animated ? { duration: breathDuration, repeat: Infinity, ease: "easeInOut", delay: dustIndex * 0.35 } : undefined} />;
                  })}
                </>
              )}
              <circle
                cx={rungLeft.x}
                cy={rungLeft.y}
                r={rung.answered ? 2.05 : lightTheme ? 1.42 : 1.25}
                fill={rung.answered ? leftJointColor : lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"}
                opacity={rung.answered ? 0.9 : lightTheme ? 0.075 : 0.28}
                filter={!rung.answered && lightTheme ? `url(#${gradientId}-open-soft)` : undefined}
              />
              <circle
                cx={rungRight.x}
                cy={rungRight.y}
                r={rung.answered ? 2.05 : lightTheme ? 1.42 : 1.25}
                fill={rung.answered ? rightJointColor : lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"}
                opacity={rung.answered ? 0.9 : lightTheme ? 0.075 : 0.28}
                filter={!rung.answered && lightTheme ? `url(#${gradientId}-open-soft)` : undefined}
              />
              {rung.answered && (
                <circle
                  cx={(rungLeft.x + rungRight.x) / 2}
                  cy={left.y}
                  r="4.2"
                  fill={rungColor}
                  opacity="0.28"
                  filter={`url(#${gradientId}-halo)`}
                />
              )}
              {!rung.answered && openStage === "stub" && (
                <>
                  <circle cx={front.x} cy={front.y} r={lightTheme ? 1.38 : 1.2} fill={lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"} opacity={lightTheme ? 0.1 : 0.48} filter={lightTheme ? `url(#${gradientId}-open-soft)` : undefined} />
                   <circle cx={ghost.singleRight ? rightStub.x : leftStub.x} cy={ghost.singleRight ? rightStub.y : leftStub.y} r={lightTheme ? 0.92 : 0.75} fill={lightTheme ? "color-mix(in oklab, var(--line-strong) 24%, var(--bg-0))" : "var(--line-strong)"} opacity={lightTheme ? 0.085 : 0.42} filter={lightTheme ? `url(#${gradientId}-open-soft)` : undefined} />
                </>
              )}
              {isGrown && animated && (
                <motion.circle
                  cx={WIDTH / 2}
                  cy={left.y}
                  r="5.2"
                  fill={rungColor}
                  initial={{ opacity: 0, scale: 0.45 }}
                  animate={{ opacity: [0, 0.62, 0.62, 0], scale: [0.45, 1, 1.08, 1.2] }}
                  transition={{ duration: 2, times: [0, 0.25, 0.55, 1], delay: grownQuestionIds.indexOf(rung.questionId) * 0.12 }}
                  style={{ transformOrigin: `${WIDTH / 2}px ${left.y}px` }}
                />
              )}
            </motion.g>
          );
        })}
      </motion.g>
    </svg>
  );
}
