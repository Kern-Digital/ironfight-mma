"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HelixModel, HelixRung } from "@/lib/fight-dna-helix";
import { useResolvedTokens } from "@/components/deepfight/use-resolved-tokens";

export interface HelixSceneProps {
  model: HelixModel;
  variant: "athlete" | "opponent";
  mode: "completeness" | "split";
  focusCategoryId: string | null;
  grownQuestionIds: string[];
  active: boolean;
  tilt: number;
  nearParticleCount: number;
  farParticleCount: number;
  glowIntensity: number;
  flashFrequency: number;
  twinkleIntensity: number;
  wobbleStrength: number;
  strandParticleDensity: number;
  rungParticleDensity: number;
  shellSpread: number;
  wanderFlashCount: number;
  wanderFlashIntensity: number;
  wanderFlashSpeed: number;
  wanderFlashWidth: number;
  wanderBurstPause: number;
  wanderRungStrike: number;
  sideExitFrequency: number;
  splitDamping: number;
  splitTransitionRungs: number;
  bokehCenterDensity: number;
  bokehNearRatio: number;
  strandInnerSizeRatio: number;
  stubVariance: number;
  opponentFlashInvert: number;
  opponentInvertSoftness: number;
  lightningFrequency: number;
  splitZoomDistance: number;
  rungKinkRatio: number;
  rungKinkStrength: number;
  allowRungKinks: boolean;
  grainEdgeSharpness: number;
  grainNoiseAmount: number;
  blueprintShare: number;
  nearDriftSpeed: number;
  farDriftSpeed: number;
  focusGlow: number;
  focusOffset: number;
  qaPulseProgress: number | null;
  qaLightningProgress: number | null;
  qaSparkProgress: number | null;
  onReady: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  onAnchorChange: (point: { x: number; y: number; color?: string }) => void;
}

// Two full turns over the complete strand; the tighter camera crops this to roughly 1.7 turns.
const HELIX_HEIGHT = 9.35;
const HELIX_RADIUS = 1;
const HELIX_TURNS = 2;
const STRAND_RADIUS = 0.15;
const STRAND_PROGRESS_MIN = -0.15;
const STRAND_PROGRESS_MAX = 1.15;
const PARTICLE_STRAND_STEPS = 520;
const BASE_CAMERA_DISTANCE = 9.25;
const IDLE_FPS = 24;
const MAX_WANDER_FLASHES = 3;
const EXIT_SPARK_COUNT = 144;

interface VisualRung {
  rung: HelixRung;
  slot: number;
}

interface WanderRuntime {
  serial: number;
  startedAt: number;
  duration: number;
  start: number;
  end: number;
  startSide: 1 | -1;
  crossProgress: number;
  jumpCount: number;
  jumpAngles: [number, number, number, number];
}

interface BurstRuntime {
  serial: number;
  nextAt: number;
  activeCount: number;
  startedAt: number;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = clamp01((value - edge0) / Math.max(0.00001, edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function linearLuminance(color: THREE.Color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function hashQuestionId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableQuestionOrder(a: HelixRung, b: HelixRung) {
  const hashDelta = hashQuestionId(a.questionId) - hashQuestionId(b.questionId);
  return hashDelta || a.questionId.localeCompare(b.questionId);
}

/** Pure renderer layout: model truth stays untouched while visual slots remain stable. */
function makeVisualLayout(model: HelixModel, mode: "completeness" | "split"): VisualRung[] {
  const ordered = mode === "completeness"
    ? [...model.rungs].sort(stableQuestionOrder)
    : model.segments.flatMap((segment) =>
        model.rungs
          .filter((rung) => rung.categoryId === segment.categoryId)
          .sort(stableQuestionOrder),
      );
  return ordered.map((rung, slot) => ({ rung, slot }));
}

function focusedSlot(layout: VisualRung[], categoryId: string | null) {
  const slots = layout.filter((item) => item.rung.categoryId === categoryId).map((item) => item.slot);
  return slots.length > 0 ? slots[Math.floor((slots.length - 1) / 2)] : (layout.length - 1) / 2;
}

function linearColorCss(color: THREE.Color) {
  const srgb = color.clone().convertLinearToSRGB();
  return `color(srgb ${srgb.r.toFixed(5)} ${srgb.g.toFixed(5)} ${srgb.b.toFixed(5)})`;
}

function pointAt(progress: number, side: 1 | -1, target = new THREE.Vector3()) {
  const angle = progress * Math.PI * 2 * HELIX_TURNS;
  return target.set(
    Math.cos(angle) * HELIX_RADIUS * side,
    (progress - 0.5) * HELIX_HEIGHT,
    Math.sin(angle) * HELIX_RADIUS * side,
  );
}

function pointFor(index: number, side: 1 | -1, total: number, target = new THREE.Vector3()) {
  return pointAt(total > 1 ? index / (total - 1) : 0, side, target);
}

function strandFrameAt(
  progress: number,
  side: 1 | -1,
  center: THREE.Vector3,
  tangent: THREE.Vector3,
  normal: THREE.Vector3,
  binormal: THREE.Vector3,
) {
  const before = pointAt(Math.max(0, progress - 0.002), side);
  const after = pointAt(Math.min(1, progress + 0.002), side);
  pointAt(progress, side, center);
  tangent.copy(after).sub(before).normalize();
  const reference = Math.abs(tangent.y) > 0.92
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  normal.crossVectors(tangent, reference).normalize();
  binormal.crossVectors(tangent, normal).normalize();
}

function SceneLifecycle({ onReady, onContextLost, onContextRestored }: Pick<
  HelixSceneProps,
  "onReady" | "onContextLost" | "onContextRestored"
>) {
  const { gl } = useThree();
  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", lost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);
    onReady();
    return () => {
      canvas.removeEventListener("webglcontextlost", lost, false);
      canvas.removeEventListener("webglcontextrestored", onContextRestored, false);
    };
  }, [gl, onContextLost, onContextRestored, onReady]);
  return null;
}

// The visible DNA is built entirely from grains; the overhang fades before its sampled ends.
const PARTICLE_PULSE_SECONDS = 0.68;

function gaussianSample(index: number, salt: number) {
  const first = Math.max(0.00001, seeded(index, salt));
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * seeded(index, salt + 1));
}

function makeParticleStrands(density: number, spread: number, innerSizeRatio: number) {
  const perStep = THREE.MathUtils.clamp(Math.round(density), 16, 32);
  const count = PARTICLE_STRAND_STEPS * perStep * 2;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const phases = new Float32Array(count);
  const progresses = new Float32Array(count);
  const sides = new Float32Array(count);
  const radialDistances = new Float32Array(count);
  const radialAngles = new Float32Array(count);
  const focuses = new Float32Array(count);
  const center = new THREE.Vector3();
  const before = new THREE.Vector3();
  const after = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const reference = new THREE.Vector3(0, 1, 0);
  const inward = new THREE.Vector3();
  let cursor = 0;

  for (const side of [1, -1] as const) {
    for (let step = 0; step < PARTICLE_STRAND_STEPS; step += 1) {
      const sampleProgress = step / (PARTICLE_STRAND_STEPS - 1);
      const progress = THREE.MathUtils.lerp(STRAND_PROGRESS_MIN, STRAND_PROGRESS_MAX, sampleProgress);
      pointAt(progress, side, center);
      pointAt(progress - 0.002, side, before);
      pointAt(progress + 0.002, side, after);
      tangent.copy(after).sub(before).normalize();
      reference.set(0, 1, 0);
      if (Math.abs(tangent.dot(reference)) > 0.92) reference.set(1, 0, 0);
      normal.crossVectors(tangent, reference).normalize();
      binormal.crossVectors(tangent, normal).normalize();

      for (let grain = 0; grain < perStep; grain += 1) {
        const dust = seeded(cursor, 116) > 0.94;
        const sigma = STRAND_RADIUS * THREE.MathUtils.clamp(spread, 0.65, 1.45) * (dust ? 1.95 : 0.58);
        offset.copy(normal).multiplyScalar(gaussianSample(cursor, 118) * sigma)
          .addScaledVector(binormal, gaussianSample(cursor, 121) * sigma);
        const radialLength = Math.max(0.0001, offset.length());
        inward.set(-center.x, 0, -center.z).normalize();
        const inside = smoothstep(0.28, 0.98, clamp01((offset.dot(inward) / radialLength + 1) * 0.5));
        const ringArcLength = Math.sqrt(
          Math.pow(HELIX_HEIGHT * (STRAND_PROGRESS_MAX - STRAND_PROGRESS_MIN) / PARTICLE_STRAND_STEPS, 2)
          + Math.pow(HELIX_RADIUS * Math.PI * 2 * HELIX_TURNS * (STRAND_PROGRESS_MAX - STRAND_PROGRESS_MIN) / PARTICLE_STRAND_STEPS, 2),
        );
        const along = (seeded(cursor, 124) - 0.5) * ringArcLength * THREE.MathUtils.lerp(1, 0.72, inside);
        positions.set([
          center.x + offset.x + tangent.x * along,
          center.y + offset.y + tangent.y * along,
          center.z + offset.z + tangent.z * along,
        ], cursor * 3);
        normals.set([offset.x / radialLength, offset.y / radialLength, offset.z / radialLength], cursor * 3);
        radialDistances[cursor] = radialLength / STRAND_RADIUS;
        radialAngles[cursor] = Math.atan2(offset.dot(binormal), offset.dot(normal));
        const innerScale = THREE.MathUtils.lerp(1, THREE.MathUtils.clamp(innerSizeRatio, 1, 1.8), inside);
        sizes[cursor] = (dust ? 1.15 + seeded(cursor, 127) * 0.8 : 2.6 + seeded(cursor, 128) * 2.8) * innerScale;
        const overhangFade = smoothstep(STRAND_PROGRESS_MIN, -0.01, progress)
          * (1 - smoothstep(1.01, STRAND_PROGRESS_MAX, progress));
        alphas[cursor] = (dust ? 0.08 + seeded(cursor, 129) * 0.14 : 0.25 + seeded(cursor, 130) * 0.34)
          * THREE.MathUtils.lerp(1, 0.86, inside) * overhangFade;
        phases[cursor] = seeded(cursor, 131) * Math.PI * 2;
        progresses[cursor] = progress;
        sides[cursor] = side;
        cursor += 1;
      }
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aProgress", new THREE.BufferAttribute(progresses, 1));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute("aRadial", new THREE.BufferAttribute(radialDistances, 1));
  geometry.setAttribute("aAngle", new THREE.BufferAttribute(radialAngles, 1));
  geometry.setAttribute("aFocus", new THREE.BufferAttribute(focuses, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HELIX_HEIGHT);
  return geometry;
}

function ghostProfile(questionId: string, variance: number) {
  const hash = hashQuestionId(questionId);
  const spread = THREE.MathUtils.clamp(variance, 0, 1.5);
  const twoSided = seeded(hash, 137) > THREE.MathUtils.lerp(0.62, 0.36, Math.min(1, spread));
  const leftStart = THREE.MathUtils.lerp(0.035, 0.012 + seeded(hash, 138) * 0.105, spread);
  const leftEnd = THREE.MathUtils.lerp(0.305, 0.16 + seeded(hash, 139) * 0.31, spread);
  const rightStart = THREE.MathUtils.lerp(0.695, 0.53 + seeded(hash, 140) * 0.31, spread);
  const rightEnd = THREE.MathUtils.lerp(0.965, 0.89 + seeded(hash, 141) * 0.098, spread);
  const singleRight = !twoSided && seeded(hash, 143) > 0.5;
  return { twoSided, singleRight, leftStart, leftEnd, rightStart, rightEnd };
}

function ghostAlong(questionId: string, seedIndex: number, variance: number) {
  const raw = seeded(seedIndex, 142);
  const profile = ghostProfile(questionId, variance);
  if (!profile.twoSided) {
    return profile.singleRight
      ? THREE.MathUtils.lerp(profile.rightStart, profile.rightEnd, raw)
      : THREE.MathUtils.lerp(profile.leftStart, profile.leftEnd, raw);
  }
  return raw < 0.5
    ? THREE.MathUtils.lerp(profile.leftStart, profile.leftEnd, raw * 2)
    : THREE.MathUtils.lerp(profile.rightStart, profile.rightEnd, (raw - 0.5) * 2);
}

type OpenRungStage = 0 | 1 | 2;

function openRungStage(
  questionId: string,
  blueprintShare: number,
): OpenRungStage {
  const lowStrengthBlueprint = THREE.MathUtils.clamp(blueprintShare, 0.35, 0.65);
  const stableScore = seeded(hashQuestionId(questionId), 401);
  if (stableScore < lowStrengthBlueprint) return 0;
  return stableScore < lowStrengthBlueprint + 0.32 ? 1 : 2;
}

function openBlueprintVisibility(
  questionId: string,
  slot: number,
  layout: VisualRung[],
  completeness: number,
  blueprintShare: number,
) {
  const strength = clamp01(completeness / 100);
  const lowStrengthBlueprint = THREE.MathUtils.clamp(blueprintShare, 0.35, 0.65);
  const targetBlueprint = THREE.MathUtils.lerp(lowStrengthBlueprint, 0.15, strength);
  const stableScore = seeded(hashQuestionId(questionId), 401);
  const nearAnswered = strength > 0.65 && layout.some(
    (item) => item.rung.answered && Math.abs(item.slot - slot) < 3,
  );
  if (nearAnswered) return 0.08;
  return THREE.MathUtils.lerp(0.08, 1, 1 - smoothstep(targetBlueprint, targetBlueprint + 0.08, stableScore));
}

function rungSplitPoint(progress: number, questionId: string) {
  const heightSwing = (progress - 0.5) * 0.34;
  const variance = (seeded(hashQuestionId(questionId), 146) - 0.5) * 0.085;
  return THREE.MathUtils.clamp(0.5 + heightSwing + variance, 0.28, 0.72);
}

function makeKinkSlots(layout: VisualRung[], ratio: number) {
  const target = Math.round(layout.length * THREE.MathUtils.clamp(ratio, 0.25, 0.35));
  const candidates = layout
    .map((item) => ({ slot: item.slot, score: seeded(hashQuestionId(item.rung.questionId), 301) }))
    .sort((a, b) => a.score - b.score);
  const selected = new Set<number>();
  for (const candidate of candidates) {
    if (selected.size >= target) break;
    if (Array.from(selected).every((slot) => Math.abs(slot - candidate.slot) >= 3)) selected.add(candidate.slot);
  }
  return selected;
}

function kinkOffsetAt(
  along: number,
  slot: number,
  direction: THREE.Vector3,
  strength: number,
) {
  const first = 0.22 + seeded(slot, 303) * 0.1;
  const second = 0.68 + seeded(slot, 307) * 0.1;
  const doubleKink = seeded(slot, 311) < 0.2;
  const primary = seeded(slot, 313) < 0.5 ? first : second;
  const tent = (center: number) => center < 0.5
    ? (along <= center ? along / center : (1 - along) / (1 - center))
    : (along <= center ? along / center : (1 - along) / (1 - center));
  const amount = doubleKink
    ? tent(first) * (along <= 0.5 ? 1 : 0) - tent(second) * (along > 0.5 ? 1 : 0)
    : tent(primary);
  return direction.multiplyScalar(THREE.MathUtils.clamp(strength, 0, 0.07) * amount);
}

function makeParticleRungs(
  layout: VisualRung[],
  density: number,
  openDensity: number,
  grownQuestionIds: string[],
  completeness: number,
  blueprintShare: number,
  shellSpread: number,
  stubVariance: number,
  kinkRatio: number,
  kinkStrength: number,
  allowKinks: boolean,
) {
  const answeredDensity = THREE.MathUtils.clamp(Math.round(density), 140, 180);
  const ghostDensity = THREE.MathUtils.clamp(Math.round(openDensity), 28, 40);
  const count = layout.reduce((sum, item) => sum + (item.rung.answered ? answeredDensity : ghostDensity), 0);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const origins = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const phases = new Float32Array(count);
  const progresses = new Float32Array(count);
  const openness = new Float32Array(count);
  const openStages = new Float32Array(count);
  const growthOrders = new Float32Array(count);
  const rungIndices = new Float32Array(count);
  const slotIndices = new Float32Array(count);
  const alongs = new Float32Array(count);
  const focuses = new Float32Array(count);
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const target = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const reference = new THREE.Vector3(0, 1, 0);
  const leftCenter = new THREE.Vector3();
  const leftTangent = new THREE.Vector3();
  const leftNormal = new THREE.Vector3();
  const leftBinormal = new THREE.Vector3();
  const rightCenter = new THREE.Vector3();
  const rightTangent = new THREE.Vector3();
  const rightNormal = new THREE.Vector3();
  const rightBinormal = new THREE.Vector3();
  const strandShellPoint = new THREE.Vector3();
  const kinkDirection = new THREE.Vector3();
  const kinkOffset = new THREE.Vector3();
  const kinkSlots = allowKinks ? makeKinkSlots(layout, kinkRatio) : new Set<number>();
  let cursor = 0;

  layout.forEach(({ rung, slot }) => {
    const progress = slot / Math.max(1, layout.length - 1);
    pointFor(slot, 1, layout.length, start);
    pointFor(slot, -1, layout.length, end);
    strandFrameAt(progress, 1, leftCenter, leftTangent, leftNormal, leftBinormal);
    strandFrameAt(progress, -1, rightCenter, rightTangent, rightNormal, rightBinormal);
    axis.copy(end).sub(start).normalize();
    reference.set(0, 1, 0);
    if (Math.abs(axis.dot(reference)) > 0.92) reference.set(1, 0, 0);
    normal.crossVectors(axis, reference).normalize();
    binormal.crossVectors(axis, normal).normalize();
    const localCount = rung.answered ? answeredDensity : ghostDensity;
    const openStage = rung.answered
      ? 1
      : openRungStage(rung.questionId, blueprintShare);
    const blueprintVisibility = rung.answered
      ? 1
      : openBlueprintVisibility(rung.questionId, slot, layout, completeness, blueprintShare);
    const growthOrder = grownQuestionIds.indexOf(rung.questionId);
    const splitPoint = rungSplitPoint(progress, rung.questionId);
    const kinked = kinkSlots.has(slot);
    kinkDirection.copy(binormal).multiplyScalar(0.82).addScaledVector(new THREE.Vector3(0, 1, 0), 0.45).normalize();
    if (seeded(slot, 317) < 0.5) kinkDirection.multiplyScalar(-1);

    for (let grain = 0; grain < localCount; grain += 1) {
      const raw = seeded(cursor, 142);
      const edgeBiased = raw < 0.5
        ? 0.5 * Math.pow(raw * 2, 2.2)
        : 1 - 0.5 * Math.pow((1 - raw) * 2, 2.2);
      const fullAlong = 0.035 + edgeBiased * 0.93;
      const openAlong = openStage === 0
        ? 0.045 + seeded(cursor, 405) * 0.91
        : openStage === 1
          ? ghostAlong(rung.questionId, cursor, stubVariance)
          : 0.08 + seeded(cursor, 407) * 0.84;
      const along = rung.answered ? fullAlong : openAlong;
      const shell = rung.answered ? 0.021 : openStage === 0 ? 0.012 : openStage === 1 ? 0.038 : 0.026;
      target.copy(start).lerp(end, along)
        .addScaledVector(normal, gaussianSample(cursor, 144) * shell)
        .addScaledVector(binormal, gaussianSample(cursor, 147) * shell);
      if (kinked) target.add(kinkOffsetAt(along, slot, kinkOffset.copy(kinkDirection), kinkStrength));
      const endpointDistance = Math.min(along, 1 - along);
      const endpointBlend = 1 - smoothstep(0.015, 0.15, endpointDistance);
      if (endpointBlend > 0) {
        const atLeft = along < splitPoint;
        const shellNormal = atLeft ? leftNormal : rightNormal;
        const shellBinormal = atLeft ? leftBinormal : rightBinormal;
        const shellCenter = atLeft ? leftCenter : rightCenter;
        const dust = seeded(cursor, 149) > 0.94;
        const sigma = STRAND_RADIUS * THREE.MathUtils.clamp(shellSpread, 0.65, 1.45) * (dust ? 1.72 : 0.56);
        strandShellPoint.copy(shellCenter)
          .addScaledVector(shellNormal, gaussianSample(cursor, 150) * sigma)
          .addScaledVector(shellBinormal, gaussianSample(cursor, 152) * sigma);
        target.lerp(strandShellPoint, endpointBlend);
      }
      positions.set([target.x, target.y, target.z], cursor * 3);

      const stubLimit = ghostAlong(rung.questionId, cursor, stubVariance);
      origin.copy(start).lerp(end, stubLimit)
        .addScaledVector(normal, gaussianSample(cursor, 160) * 0.042)
        .addScaledVector(binormal, gaussianSample(cursor, 163) * 0.042);
      if (kinked) origin.add(kinkOffsetAt(stubLimit, slot, kinkOffset.copy(kinkDirection), kinkStrength));
      origins.set([origin.x, origin.y, origin.z], cursor * 3);
      sizes[cursor] = rung.answered
        ? 2.4 + seeded(cursor, 154) * 3.4
        : openStage === 0
          ? 1.4 + seeded(cursor, 155) * 1.2
          : openStage === 1
            ? 1.55 + seeded(cursor, 155) * 1.55
            : 0.75 + seeded(cursor, 155) * 0.8;
      alphas[cursor] = rung.answered
        ? 0.54 + seeded(cursor, 156) * 0.36
        : openStage === 0
          ? (0.16 + seeded(cursor, 157) * 0.12) * blueprintVisibility
          : openStage === 1
            ? 0.2 + seeded(cursor, 157) * 0.16
            : seeded(cursor, 159) < 0.34 ? 0.1 + seeded(cursor, 157) * 0.08 : 0.012;
      phases[cursor] = seeded(cursor, 158) * Math.PI * 2;
      progresses[cursor] = slot / Math.max(1, layout.length - 1);
      openness[cursor] = rung.answered ? 0 : 1;
      openStages[cursor] = openStage;
      growthOrders[cursor] = growthOrder;
      rungIndices[cursor] = rung.index;
      slotIndices[cursor] = slot;
      alongs[cursor] = along;
      cursor += 1;
    }
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aOrigin", new THREE.BufferAttribute(origins, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aProgress", new THREE.BufferAttribute(progresses, 1));
  geometry.setAttribute("aOpen", new THREE.BufferAttribute(openness, 1));
  geometry.setAttribute("aOpenStage", new THREE.BufferAttribute(openStages, 1));
  geometry.setAttribute("aGrowthOrder", new THREE.BufferAttribute(growthOrders, 1));
  geometry.setAttribute("aRungIndex", new THREE.BufferAttribute(rungIndices, 1));
  geometry.setAttribute("aSlotIndex", new THREE.BufferAttribute(slotIndices, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(alongs, 1));
  geometry.setAttribute("aFocus", new THREE.BufferAttribute(focuses, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  return geometry;
}

function makeParticleBokeh(count: number, centerDensity: number, nearRatio: number, aspect: number) {
  const safeCount = THREE.MathUtils.clamp(Math.round(count), 40, 80);
  const centerBias = THREE.MathUtils.clamp(centerDensity, 0, 1);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(safeCount * 3);
  const colors = new Float32Array(safeCount * 3);
  const sizes = new Float32Array(safeCount);
  const alphas = new Float32Array(safeCount);
  const phases = new Float32Array(safeCount);
  const nearTiers = new Float32Array(safeCount);
  const frontTiers = new Float32Array(safeCount);
  const edgeAnchors = [
    [-0.8, -0.72], [-0.79, 0.08], [-0.78, 0.74],
    [0.8, -0.7], [0.79, 0.12], [0.78, 0.76],
    [-0.38, -0.78], [0.32, -0.77], [-0.34, 0.79], [0.4, 0.78],
  ];
  for (let index = 0; index < safeCount; index += 1) {
    const edge = edgeAnchors[index];
    const rawX = seeded(index, 170) * 2 - 1;
    const rawY = seeded(index, 171) * 2 - 1;
    const centerWeighted = seeded(index, 176) < centerBias;
    const near = seeded(index, 179) < THREE.MathUtils.clamp(nearRatio, 0, 0.5);
    const front = near && seeded(index, 181) < 0.1;
    const normalizedX = edge
      ? edge[0] + (seeded(index, 177) - 0.5) * 0.08
      : centerWeighted ? Math.sign(rawX) * Math.pow(Math.abs(rawX), 1.85) : rawX;
    const normalizedY = edge
      ? edge[1] + (seeded(index, 178) - 0.5) * 0.08
      : centerWeighted ? Math.sign(rawY) * Math.pow(Math.abs(rawY), 1.7) : rawY;
    positions.set([
      normalizedX * 4.75 * THREE.MathUtils.clamp(aspect, 0.55, 1.8),
      normalizedY * 4.75,
      front ? 1.2 + seeded(index, 172) * 0.7 : near ? -2.6 + seeded(index, 172) : -3 - seeded(index, 172) * 2,
    ], index * 3);
    sizes[index] = front ? 7 + seeded(index, 173) * 7 : near ? 10 + seeded(index, 173) * 16 : 22 + seeded(index, 173) * 54;
    alphas[index] = front ? 0.025 + seeded(index, 174) * 0.035 : near ? 0.07 + seeded(index, 174) * 0.09 : 0.04 + seeded(index, 174) * 0.065;
    phases[index] = seeded(index, 175) * Math.PI * 2;
    nearTiers[index] = near ? 1 : 0;
    frontTiers[index] = front ? 1 : 0;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aNear", new THREE.BufferAttribute(nearTiers, 1));
  geometry.setAttribute("aFront", new THREE.BufferAttribute(frontTiers, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14);
  return geometry;
}

function makeExitSparks() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(EXIT_SPARK_COUNT * 3);
  const colors = new Float32Array(EXIT_SPARK_COUNT * 3);
  const directions = new Float32Array(EXIT_SPARK_COUNT * 3);
  const sizes = new Float32Array(EXIT_SPARK_COUNT);
  const alphas = new Float32Array(EXIT_SPARK_COUNT);
  const delays = new Float32Array(EXIT_SPARK_COUNT);
  for (let index = 0; index < EXIT_SPARK_COUNT; index += 1) {
    directions.set([
      0.72 + seeded(index, 210) * 0.62,
      (seeded(index, 211) - 0.5) * 0.34,
      (seeded(index, 212) - 0.5) * 0.3,
    ], index * 3);
    sizes[index] = 1.1 + seeded(index, 213) * 2.6;
    alphas[index] = 0.28 + seeded(index, 214) * 0.48;
    delays[index] = seeded(index, 215) * 0.1;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aDirection", new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aDelay", new THREE.BufferAttribute(delays, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14);
  return geometry;
}

function particleShaderMaterial(
  kind: "strand" | "rung" | "bokeh" | "exit",
  pixelRatio: number,
  light: boolean,
  background: THREE.Color,
  depthColor: THREE.Color,
  opponent: boolean,
  darkAthlete = false,
) {
  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uTwinkle: { value: 1 },
    uGlow: { value: 1 },
    uPulseT: { value: -1 },
    uPulseActive: { value: 0 },
    uGrowthTime: { value: 99 },
    uCrossRung: { value: -1 },
    uLightTheme: { value: light ? 1 : 0 },
    uJitter: { value: 1 },
    uBgColor: { value: background.clone() },
    uDepthColor: { value: depthColor.clone() },
    uOpponent: { value: opponent ? 1 : 0 },
    uDarkOpponent: { value: opponent && !light ? 1 : 0 },
    uLightOpponent: { value: opponent && light ? 1 : 0 },
    uOpponentFlashInvert: { value: 1 },
    uInvertSoftness: { value: 0.72 },
    uEdgeSharpness: { value: 0 },
    uNoiseAmount: { value: 0 },
    uFocusGlow: { value: 1.65 },
    uSplitMode: { value: 0 },
    uNearDriftSpeed: { value: 0.32 },
    uFarDriftSpeed: { value: 0.16 },
    uPulseAngle: { value: 0 },
    uLightningCenter: { value: -10 },
    uLightningWidth: { value: 0.06 },
    uLightningAngle: { value: 0 },
    uLightningDirection: { value: 1 },
    uLightningIntensity: { value: 0 },
    uCameraScale: { value: 1 },
    uWanderHead: { value: new Float32Array(MAX_WANDER_FLASHES).fill(-10) },
    uWanderSide: { value: new Float32Array(MAX_WANDER_FLASHES) },
    uWanderOriginSide: { value: new Float32Array(MAX_WANDER_FLASHES) },
    uWanderDirection: { value: new Float32Array(MAX_WANDER_FLASHES).fill(1) },
    uWanderIntensity: { value: new Float32Array(MAX_WANDER_FLASHES) },
    uWanderCross: { value: new Float32Array(MAX_WANDER_FLASHES).fill(-1) },
    uWanderAngle: { value: new Float32Array(MAX_WANDER_FLASHES) },
    uWanderWidth: { value: 0.46 },
    uExitProgress: { value: 0 },
    uExitSide: { value: 1 },
    uExitAge: { value: -1 },
    uExitActive: { value: 0 },
  };
  const wanderUniforms = `
    uniform float uWanderHead[${MAX_WANDER_FLASHES}]; uniform float uWanderSide[${MAX_WANDER_FLASHES}];
    uniform float uWanderOriginSide[${MAX_WANDER_FLASHES}];
    uniform float uWanderDirection[${MAX_WANDER_FLASHES}]; uniform float uWanderIntensity[${MAX_WANDER_FLASHES}];
    uniform float uWanderCross[${MAX_WANDER_FLASHES}]; uniform float uWanderAngle[${MAX_WANDER_FLASHES}];
  `;
  const strandVertex = `
    attribute float aSize; attribute float aAlpha; attribute float aPhase;
    attribute float aProgress; attribute float aSide; attribute float aRadial; attribute float aAngle; attribute float aFocus;
    varying vec3 vColor; varying float vAlpha; varying float vPulse; varying float vInvertPulse;
    varying float vFocus;
    uniform float uTime; uniform float uPixelRatio; uniform float uTwinkle;
    uniform float uGlow; uniform float uPulseT; uniform float uPulseActive; uniform float uPulseAngle;
    uniform float uLightTheme; uniform float uJitter; uniform float uWanderWidth; uniform float uOpponent;
    uniform float uDarkOpponent; uniform float uLightOpponent; uniform float uOpponentFlashInvert;
    uniform float uCameraScale; uniform float uNoiseAmount; uniform float uFocusGlow; uniform float uSplitMode;
    uniform float uLightningCenter; uniform float uLightningWidth; uniform float uLightningAngle; uniform float uLightningDirection; uniform float uLightningIntensity;
    uniform vec3 uDepthColor;
    ${wanderUniforms}
    void main() {
      float grain = sin(uTime * (4.2 + mod(aPhase, 1.7)) + aPhase * 13.0);
      float blink = pow(0.5 + 0.5 * grain, 2.2);
      float radialGate = 1.0 - smoothstep(uWanderWidth * 0.48, uWanderWidth, aRadial);
      float pulseAngularDistance = abs(atan(sin(aAngle - uPulseAngle), cos(aAngle - uPulseAngle)));
      float pulseAngleGate = 1.0 - smoothstep(0.58, 1.34, pulseAngularDistance);
      float head = exp(-pow((aProgress - uPulseT) / 0.032, 2.0));
      float trail = smoothstep(0.19, 0.0, uPulseT - aProgress) * step(aProgress, uPulseT);
      float largePulse = uPulseActive * (head * 3.0 + trail * 0.88);
      float wander = 0.0;
      for (int i = 0; i < ${MAX_WANDER_FLASHES}; i++) {
        float sideMatch = 1.0 - step(0.5, abs(aSide - uWanderSide[i]));
        float distanceBehind = (uWanderHead[i] - aProgress) * uWanderDirection[i];
        float shortTrail = step(0.0, distanceBehind) * (1.0 - smoothstep(0.0, 0.046, distanceBehind));
        float smallHead = exp(-pow((aProgress - uWanderHead[i]) / 0.009, 2.0));
        float angularDistance = abs(atan(sin(aAngle - uWanderAngle[i]), cos(aAngle - uWanderAngle[i])));
        float angleGate = 1.0 - smoothstep(0.44, 1.02, angularDistance);
        wander += (smallHead * 1.55 + shortTrail * 0.48) * uWanderIntensity[i] * sideMatch * radialGate * angleGate * 1.75;
      }
      float neuralZigzag = sin(aProgress * 62.0 + uLightningAngle * 1.7) * 0.22
        + sin(aProgress * 137.0 - uLightningAngle * 0.8) * 0.09;
      float neuralPathAngle = uLightningAngle + neuralZigzag;
      float lightningAngleDistance = abs(atan(sin(aAngle - neuralPathAngle), cos(aAngle - neuralPathAngle)));
      float lightningGate = 1.0 - smoothstep(0.08, 0.52, lightningAngleDistance);
      float branchCell = floor(aProgress * 13.0);
      float branchLocal = fract(aProgress * 13.0);
      float branchWindow = smoothstep(0.08, 0.3, branchLocal) * (1.0 - smoothstep(0.58, 0.92, branchLocal));
      float branchSign = step(0.0, sin(branchCell * 12.9898 + uLightningAngle * 3.1)) * 2.0 - 1.0;
      float branchAngle = neuralPathAngle + branchSign * (0.28 + branchLocal * 0.62);
      float branchDistance = abs(atan(sin(aAngle - branchAngle), cos(aAngle - branchAngle)));
      float branchGate = branchWindow * (1.0 - smoothstep(0.08, 0.44, branchDistance));
      float lightningBehind = (uLightningCenter - aProgress) * uLightningDirection;
      float lightningHead = exp(-pow((aProgress - uLightningCenter) / max(0.008, uLightningWidth), 2.0));
      float lightningTrail = step(0.0, lightningBehind)
        * (1.0 - smoothstep(0.0, max(0.03, uLightningWidth * 3.8), lightningBehind));
      float lightning = (lightningHead * 2.3 + lightningTrail)
        * uLightningIntensity * (lightningGate + branchGate * 0.85) * radialGate * 4.2;
      vPulse = largePulse + wander + lightning;
      vInvertPulse = (largePulse + wander + lightning) * uOpponentFlashInvert * uDarkOpponent;
      vFocus = aFocus * uFocusGlow;
      vec3 displaced = position + normal * sin(uTime * 7.0 + aPhase * 19.0) * 0.0075 * uJitter;
      vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
      vec4 axisView = modelViewMatrix * vec4(0.0, displaced.y, 0.0, 1.0);
      float back = 1.0 - smoothstep(-1.12, 0.04, viewPosition.z - axisView.z);
      float organicNoise = (sin(aProgress * 18.8496 + aAngle * 0.72) + sin(aProgress * 39.5841 - aAngle * 1.31) * 0.5 + sin(aProgress * 81.6814 + aAngle * 2.17) * 0.25) / 1.75;
      float organicSize = 1.0 + organicNoise * uNoiseAmount * 0.36;
      float pulseSize = mix(mix(0.34, 0.56, uLightTheme), 0.07, uDarkOpponent);
      float darkAthleteCompleteness = (1.0 - uOpponent) * (1.0 - uLightTheme) * (1.0 - uSplitMode);
      float basePointSize = max(1.0, aSize * organicSize * mix(1.0, 0.56, back) * (1.0 + vPulse * pulseSize + vFocus * 0.045) * mix(1.0, 0.84, darkAthleteCompleteness) * uPixelRatio * uCameraScale * (10.0 / max(1.0, -viewPosition.z)));
      gl_PointSize = basePointSize;
      gl_Position = projectionMatrix * viewPosition;
      vec3 viewNormal = normalize(normalMatrix * normal);
      float facing = clamp(dot(viewNormal, vec3(0.0, 0.0, 1.0)) * 0.5 + 0.5, 0.0, 1.0);
      float chromeBands = pow(0.5 + 0.5 * sin(aProgress * 25.1327 + aPhase * 0.22), 5.0);
      float darkChrome = min(1.34, 0.34 + facing * 0.62 + chromeBands * facing * 0.52);
      float lightChrome = min(1.08, 0.46 + facing * 0.44 + chromeBands * facing * 0.2);
      float chrome = mix(darkChrome, lightChrome, uLightOpponent);
      vec3 normalColor = mix(color, uDepthColor, back * mix(0.6, 0.58, uLightTheme)) * (1.0 + vPulse * mix(0.32, 0.13, uLightTheme));
      vec3 chromeColor = color * chrome;
      vColor = mix(normalColor, chromeColor, uOpponent);
      if (uOpponent < 0.5 && uLightTheme < 0.5) {
        float luminance = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
        float saturation = mix(2.15, 1.72, uSplitMode);
        vec3 saturated = max(vec3(0.0), vec3(luminance) + (vColor - vec3(luminance)) * saturation);
        float saturatedLuminance = dot(saturated, vec3(0.2126, 0.7152, 0.0722));
        vColor = saturated * (luminance / max(0.0001, saturatedLuminance)) * mix(1.0, 1.18, uSplitMode);
      }
      float baseAlpha = aAlpha * (1.0 + organicNoise * uNoiseAmount * 0.42) * mix(1.0, 0.2, back) * mix(0.28 + blink * 0.52 * uTwinkle, 0.68 + blink * 0.16, uLightTheme) * uGlow;
      float darkAthleteAlpha = mix(0.27, 0.2, uSplitMode);
      baseAlpha *= mix(mix(darkAthleteAlpha, 1.0, uLightTheme), 1.0, uOpponent) * (1.0 + vFocus * 0.08);
      vAlpha = mix(baseAlpha, min(1.0, baseAlpha * mix(0.95, 1.5, uLightOpponent)), uOpponent);
    }
  `;
  const rungVertex = `
    attribute vec3 aOrigin;
    attribute float aSize; attribute float aAlpha; attribute float aPhase;
    attribute float aProgress; attribute float aOpen; attribute float aOpenStage; attribute float aGrowthOrder; attribute float aSlotIndex; attribute float aAlong; attribute float aFocus;
    varying vec3 vColor; varying float vAlpha; varying float vPulse; varying float vInvertPulse;
    varying float vFocus; varying float vOpen;
    uniform float uTime; uniform float uPixelRatio; uniform float uTwinkle;
    uniform float uGlow; uniform float uPulseT; uniform float uPulseActive; uniform float uPulseAngle;
    uniform float uGrowthTime; uniform float uCrossRung; uniform float uLightTheme; uniform float uOpponent;
    uniform float uDarkOpponent; uniform float uLightOpponent; uniform float uOpponentFlashInvert; uniform float uCameraScale;
    uniform float uNoiseAmount; uniform float uFocusGlow; uniform float uSplitMode; uniform vec3 uDepthColor;
    uniform float uLightningCenter; uniform float uLightningWidth; uniform float uLightningAngle; uniform float uLightningDirection; uniform float uLightningIntensity;
    ${wanderUniforms}
    void main() {
      float hasGrowth = step(-0.5, aGrowthOrder);
      float growth = clamp((uGrowthTime - aGrowthOrder * 0.12) / 1.2, 0.0, 1.0);
      float eased = 1.0 - pow(1.0 - growth, 3.0);
      vec3 grownPosition = mix(aOrigin, position, mix(1.0, eased, hasGrowth));
      float breathRate = mix(0.628, 1.047, fract(aPhase * 0.731));
      float openBreath = 0.87 + sin(uTime * breathRate + aPhase * 3.7) * mix(0.09, 0.15, step(1.5, aOpenStage));
      float twinkle = pow(0.5 + 0.5 * sin(uTime * 5.8 + aPhase * 11.0), 2.0);
      float wave = uPulseActive * exp(-pow((aProgress - uPulseT) / 0.04, 2.0)) * 1.35;
      float cross = step(abs(aSlotIndex - uCrossRung), 0.25) * exp(-pow((uPulseT - aProgress) / 0.055, 2.0));
      float wander = 0.0;
      for (int i = 0; i < ${MAX_WANDER_FLASHES}; i++) {
        float nearby = exp(-pow((aProgress - uWanderHead[i]) / 0.01, 2.0)) * 0.16 * (1.0 - aOpen);
        float crossDistance = (uWanderHead[i] - uWanderCross[i]) * uWanderDirection[i];
        float crossPhase = smoothstep(-0.032, 0.032, crossDistance);
        float forwardAlong = mix(0.07, 0.93, crossPhase);
        float crossAlong = mix(1.0 - forwardAlong, forwardAlong, step(0.0, uWanderOriginSide[i]));
        float rungDirection = mix(-1.0, 1.0, step(0.0, uWanderOriginSide[i]));
        float rungBehind = (crossAlong - aAlong) * rungDirection;
        float crossingHead = exp(-pow((aAlong - crossAlong) / 0.075, 2.0)) * 2.8;
        float crossingTrail = step(0.0, rungBehind) * (1.0 - smoothstep(0.0, 0.22, rungBehind)) * 0.65;
        float crossing = step(0.0, uWanderCross[i])
          * exp(-pow((aProgress - uWanderCross[i]) / 0.006, 2.0))
          * exp(-pow(crossDistance / 0.04, 2.0))
          * (crossingHead + crossingTrail) * (1.0 - aOpen) * 2.35;
        wander += (nearby + crossing) * uWanderIntensity[i];
      }
      float revealTime = uGrowthTime - aGrowthOrder * 0.12;
      float lock = hasGrowth
        * smoothstep(0.0, 0.5, revealTime)
        * (1.0 - smoothstep(1.1, 2.0, revealTime));
      float rungLightningBehind = (uLightningCenter - aProgress) * uLightningDirection;
      float rungLightningHead = exp(-pow((aProgress - uLightningCenter) / max(0.008, uLightningWidth), 2.0));
      float rungLightningTrail = step(0.0, rungLightningBehind)
        * (1.0 - smoothstep(0.0, max(0.03, uLightningWidth * 3.2), rungLightningBehind));
      float neuralRung = 0.08 + pow(0.5 + 0.5 * sin(aAlong * 31.0 + aProgress * 79.0 + uLightningAngle), 5.0) * 0.14;
      float branchAlong = 0.18 + 0.64 * fract(sin(floor(aProgress * 13.0) * 43.17 + uLightningAngle) * 43758.5453);
      float rungBranch = exp(-pow((aAlong - branchAlong) / 0.12, 2.0)) * 1.5;
      float lightning = (rungLightningHead * 1.5 + rungLightningTrail * 0.42)
        * uLightningIntensity * (1.0 - aOpen) * (neuralRung + rungBranch) * 2.4;
      float invertiblePulse = wave * 1.9 + cross * 2.35 + wander + lightning;
      vPulse = invertiblePulse + lock * 1.18;
      vInvertPulse = invertiblePulse * uOpponentFlashInvert * uDarkOpponent;
      vFocus = aFocus * uFocusGlow;
      vOpen = aOpen;
      vec4 viewPosition = modelViewMatrix * vec4(grownPosition, 1.0);
      vec4 axisView = modelViewMatrix * vec4(0.0, grownPosition.y, 0.0, 1.0);
      float back = 1.0 - smoothstep(-1.05, 0.08, viewPosition.z - axisView.z);
      float organicNoise = (sin(aProgress * 17.2788 + aAlong * 5.7) + sin(aProgress * 36.1283 - aAlong * 11.3) * 0.5 + sin(aProgress * 74.1416 + aAlong * 19.1) * 0.25) / 1.75;
      float pulseSize = mix(mix(0.28, 0.58, uLightTheme), 0.055, uDarkOpponent);
      float darkAthleteCompleteness = (1.0 - uOpponent) * (1.0 - uLightTheme) * (1.0 - uSplitMode);
      float basePointSize = max(1.0, aSize * (1.0 + organicNoise * uNoiseAmount * 0.3) * mix(1.0, 0.6, back) * (1.0 + vPulse * pulseSize + vFocus * 0.055) * mix(1.0, 1.26, aOpen * uLightTheme) * mix(1.0, 0.88, darkAthleteCompleteness) * uPixelRatio * uCameraScale * (10.0 / max(1.0, -viewPosition.z)));
      gl_PointSize = basePointSize;
      gl_Position = projectionMatrix * viewPosition;
      vColor = mix(color, uDepthColor, back * mix(0.72, 0.52, uLightTheme)) * (1.0 + vPulse * mix(0.64, 0.17, uLightTheme));
      if (uOpponent > 0.5) vColor *= mix(1.12, 0.82, uLightOpponent);
      if (uOpponent < 0.5 && uLightTheme < 0.5) {
        float luminance = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
        float saturation = mix(2.05, 1.64, uSplitMode);
        vec3 saturated = max(vec3(0.0), vec3(luminance) + (vColor - vec3(luminance)) * saturation);
        float saturatedLuminance = dot(saturated, vec3(0.2126, 0.7152, 0.0722));
        vColor = saturated * (luminance / max(0.0001, saturatedLuminance)) * mix(1.0, 1.16, uSplitMode);
      }
      float regularOpenVisibility = aOpenStage < 0.5 ? 14.0 : aOpenStage < 1.5 ? 6.2 : 7.5;
      float darkAthleteOpenVisibility = aOpenStage < 0.5 ? 5.2 : aOpenStage < 1.5 ? 3.0 : 3.4;
      float openVisibility = aOpen < 0.5
        ? mix(1.0, 1.72, darkAthleteCompleteness)
        : mix(regularOpenVisibility, darkAthleteOpenVisibility, darkAthleteCompleteness);
      vAlpha = aAlpha * (1.0 + organicNoise * uNoiseAmount * 0.38) * mix(1.0, 0.23, back) * (0.46 + twinkle * 0.48 * uTwinkle) * mix(1.0, 0.72, uLightTheme) * uGlow * mix(1.0, openBreath, aOpen) * openVisibility * (1.0 + vFocus * 0.13);
      float darkAthleteAlpha = mix(0.23, 0.17, uSplitMode);
      vAlpha *= mix(mix(darkAthleteAlpha, 1.0, uLightTheme), 1.0, uOpponent);
      vAlpha *= mix(1.0, 0.2, aOpen * uLightTheme);
      if (uOpponent > 0.5) vAlpha = min(1.0, vAlpha * mix(1.1, 1.38, uLightOpponent));
    }
  `;
  const bokehVertex = `
    attribute float aSize; attribute float aAlpha; attribute float aPhase; attribute float aNear; attribute float aFront;
    varying vec3 vColor; varying float vAlpha; varying float vPulse; varying float vNear; varying float vFront;
    uniform float uTime; uniform float uPixelRatio; uniform float uLightTheme; uniform float uCameraScale; uniform float uNearDriftSpeed; uniform float uFarDriftSpeed;
    void main() {
      vec3 drifted = position;
      float driftSpeed = mix(uFarDriftSpeed, uNearDriftSpeed, aNear);
      vec2 farDrift = vec2(-cos(uTime * driftSpeed * 0.31 + aPhase * 1.7), sin(uTime * driftSpeed * 0.24 + aPhase));
      vec2 nearDrift = vec2(sin(uTime * driftSpeed * 0.46 + aPhase), cos(uTime * driftSpeed * 0.34 + aPhase * 1.7));
      drifted.xy += mix(farDrift * vec2(0.22, 0.28), nearDrift * vec2(0.18, 0.2), aNear);
      vec4 viewPosition = modelViewMatrix * vec4(drifted, 1.0);
      gl_PointSize = max(2.0, aSize * uPixelRatio * uCameraScale * (10.0 / max(1.0, -viewPosition.z)));
      gl_Position = projectionMatrix * viewPosition;
      vColor = color;
      vAlpha = min(mix(0.3, 0.34, aNear), aAlpha * mix(1.0, mix(2.65, 2.2, aNear), uLightTheme));
      vPulse = 0.0;
      vNear = aNear;
      vFront = aFront;
    }
  `;
  const exitVertex = `
    attribute vec3 aDirection; attribute float aSize; attribute float aAlpha; attribute float aDelay;
    varying vec3 vColor; varying float vAlpha; varying float vPulse;
    uniform float uPixelRatio; uniform float uLightTheme; uniform float uExitProgress;
    uniform float uExitSide; uniform float uExitAge; uniform float uExitActive;
    void main() {
      float angle = uExitProgress * 12.5663706144;
      vec3 origin = vec3(cos(angle) * uExitSide, (uExitProgress - 0.5) * 9.35, sin(angle) * uExitSide);
      vec3 radial = normalize(vec3(origin.x, 0.0, origin.z));
      vec3 tangent = normalize(vec3(-sin(angle) * uExitSide * 12.566, 9.35, cos(angle) * uExitSide * 12.566));
      float life = clamp((uExitAge - aDelay) / 0.32, 0.0, 1.0);
      vec3 direction = radial * aDirection.x + tangent * aDirection.y + vec3(0.0, aDirection.z, 0.0);
      vec3 sparkPosition = origin + direction * (life * 0.82) + vec3(0.0, -life * life * 0.16, 0.0);
      vec4 viewPosition = modelViewMatrix * vec4(sparkPosition, 1.0);
      float envelope = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.56, 1.0, life)) * uExitActive;
      gl_PointSize = max(1.0, aSize * (1.0 - life * 0.45) * uPixelRatio * (10.0 / max(1.0, -viewPosition.z)));
      gl_Position = projectionMatrix * viewPosition;
      vColor = color;
      vAlpha = aAlpha * envelope * mix(1.0, 0.52, uLightTheme);
      vPulse = envelope * 0.7;
    }
  `;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: kind === "strand" ? strandVertex : kind === "rung" ? rungVertex : kind === "bokeh" ? bokehVertex : exitVertex,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha; varying float vPulse;
      ${kind === "bokeh" ? "varying float vNear; varying float vFront;" : ""}
      ${kind === "strand" || kind === "rung" ? `varying float vInvertPulse; varying float vFocus;${kind === "rung" ? " varying float vOpen;" : ""}` : ""}
      uniform float uLightTheme; uniform float uOpponent; uniform float uDarkOpponent; uniform float uSplitMode;
      uniform float uInvertSoftness; uniform float uEdgeSharpness; uniform vec3 uBgColor;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float distanceToCenter = length(centered) * 2.0;
        if (distanceToCenter > 1.0) discard;
        float soft = ${kind === "bokeh" ? "exp(-distanceToCenter * distanceToCenter * mix(2.7, mix(6.4, 2.1, vFront), vNear))" : kind === "strand" ? "1.0 - smoothstep(mix(0.18, 0.86, uEdgeSharpness), 1.0, distanceToCenter)" : kind === "rung" ? "mix(1.0 - smoothstep(mix(0.18, 0.86, uEdgeSharpness), 1.0, distanceToCenter), exp(-distanceToCenter * distanceToCenter * 2.4) * (1.0 - smoothstep(0.86, 1.0, distanceToCenter)), vOpen * uLightTheme)" : "smoothstep(1.0, 0.18, distanceToCenter)"};
        float core = ${kind === "bokeh" ? "0.0" : kind === "rung" ? "exp(-distanceToCenter * distanceToCenter * 18.0) * (1.0 - vOpen * uLightTheme)" : "exp(-distanceToCenter * distanceToCenter * 18.0)"};
        ${kind === "strand" || kind === "rung" ? `
        float darkNormalAthlete = (1.0 - uOpponent) * (1.0 - uLightTheme) * (1.0 - uSplitMode);
        float darkDustSharpness = ${kind === "rung" ? "mix(5.2, 3.2, vOpen)" : "4.4"};
        float dustSoft = exp(-distanceToCenter * distanceToCenter * darkDustSharpness) * (1.0 - smoothstep(0.84, 1.0, distanceToCenter));
        soft = mix(soft, dustSoft, darkNormalAthlete);
        core *= mix(1.0, ${kind === "rung" ? "mix(0.34, 0.12, vOpen)" : "0.28"}, darkNormalAthlete);
        ` : ""}
        float edgeCompensation = ${kind === "strand" || kind === "rung" ? "mix(1.0, 0.58, uEdgeSharpness)" : "1.0"};
        float alpha = vAlpha * soft * edgeCompensation;
        ${kind === "strand" || kind === "rung" ? `alpha *= mix(1.0, ${kind === "rung" ? "mix(1.18, 1.0, vOpen)" : "1.12"}, darkNormalAthlete);` : ""}
        float coreBoost = mix(mix(0.08, 0.035, uLightTheme), mix(0.07, 0.025, uLightTheme), uOpponent);
        float pulseBoost = vPulse * mix(0.36, 0.17, uOpponent) * mix(1.0, 0.1, uDarkOpponent);
        vec3 finalColor = vColor * (1.0 + core * coreBoost + pulseBoost);
        ${kind === "strand" || kind === "rung" ? `
        float darkAthlete = (1.0 - uOpponent) * (1.0 - uLightTheme);
        alpha *= mix(1.0, ${kind === "rung" ? "0.92" : "1.0"}, darkAthlete);
        alpha *= mix(1.0, 0.74, smoothstep(0.8, 1.85, vPulse) * darkAthlete);
        float focusLight = vFocus * mix(0.3, 0.14, uLightTheme) + core * vFocus * mix(0.68, 0.28, uLightTheme);
        finalColor *= 1.0 + focusLight;
        float invertStrength = clamp(vInvertPulse, 0.0, 1.0) * mix(0.92, 0.995, clamp(uInvertSoftness, 0.0, 1.0));
        vec3 darkCore = uBgColor * 0.06;
        finalColor = mix(finalColor, darkCore, invertStrength);
        float lightOpponentPulse = clamp(vPulse * 0.54, 0.0, 0.82) * uOpponent * uLightTheme;
        finalColor = mix(finalColor, uBgColor, lightOpponentPulse);
        alpha = max(alpha, clamp(vInvertPulse, 0.0, 1.0) * soft * 0.5);
        ` : ""}
        finalColor *= mix(1.0, 1.08, uSplitMode * (1.0 - uLightTheme) * (1.0 - uOpponent));
        ${kind === "strand" || kind === "rung" ? `
        float colorPeak = max(max(finalColor.r, finalColor.g), finalColor.b);
        vec3 huePreservedPeak = finalColor * min(1.0, 0.965 / max(0.0001, colorPeak));
        finalColor = mix(min(finalColor, vec3(0.965)), huePreservedPeak, darkAthlete);
        ` : "finalColor = min(finalColor, vec3(0.965));"}
        gl_FragColor = vec4(finalColor, alpha);
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: light || ((opponent || darkAthlete) && (kind === "strand" || kind === "rung"))
      ? THREE.NormalBlending
      : THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function bandRanges(model: HelixModel) {
  let cursor = 0;
  return model.bands?.map((band) => {
    const start = cursor;
    cursor += band.share;
    return { token: band.colorToken, start, end: cursor };
  }) ?? [];
}

function splitColor(
  model: HelixModel,
  progress: number,
  colors: Record<string, THREE.Color>,
  side: 1 | -1,
  grainSeed: number,
  transitionRungs: number,
) {
  const ranges = bandRanges(model);
  if (ranges.length === 0) return null;
  const found = ranges.findIndex((range) => progress <= range.end);
  const ownIndex = found < 0 ? ranges.length - 1 : found;
  const own = ranges[ownIndex];
  const ownColor = colors[own.token]?.clone();
  if (!ownColor) return null;
  for (let index = 0; index < ranges.length - 1; index += 1) {
    const boundaryKey = hashQuestionId(`${ranges[index].token}:${ranges[index + 1].token}`);
    const sideSalt = side === 1 ? 0 : 97;
    const baseRungs = THREE.MathUtils.clamp(transitionRungs, 3, 7);
    const leftRungs = baseRungs * (0.78 + seeded(boundaryKey + sideSalt, 261) * 0.48);
    const rightRungs = baseRungs * (0.78 + seeded(boundaryKey + sideSalt, 267) * 0.48);
    const fringe = (seeded(grainSeed + boundaryKey, 271 + sideSalt) - 0.5) * 1.3;
    const boundary = ranges[index].end + fringe / Math.max(1, model.rungs.length - 1);
    const leftBandShare = ranges[index].end - ranges[index].start;
    const rightBandShare = ranges[index + 1].end - ranges[index + 1].start;
    const leftSpan = Math.min(leftRungs / Math.max(1, model.rungs.length - 1), leftBandShare * 0.28);
    const rightSpan = Math.min(rightRungs / Math.max(1, model.rungs.length - 1), rightBandShare * 0.28);
    if (progress < boundary - leftSpan || progress > boundary + rightSpan) continue;
    const left = colors[ranges[index].token];
    const right = colors[ranges[index + 1].token];
    if (!left || !right) return ownColor;
    const blend = smoothstep(boundary - leftSpan, boundary + rightSpan, progress);
    return left.clone().lerp(right, blend);
  }
  return ownColor;
}

function resolvedParticleColor(
  model: HelixModel,
  rung: HelixRung,
  progress: number,
  side: 1 | -1,
  colors: Record<string, THREE.Color>,
  variant: "athlete" | "opponent",
  mode: "completeness" | "split",
  focusCategoryId: string | null,
  grainSeed: number,
  splitDamping: number,
  splitTransitionRungs: number,
) {
  const lightTheme = colors["--bg-0"].r + colors["--bg-0"].g + colors["--bg-0"].b > 1.5;
  const depthColor = lightTheme ? colors["--text-2"] : colors["--bg-0"];
  const colorVariant = mode === "split" ? "athlete" : variant;
  const athleteCyan = colors["--accent"];
  const athleteViolet = colors["--accent-2"].clone();
  if (colorVariant === "athlete" && !lightTheme) {
    const luminanceScale = THREE.MathUtils.clamp(
      linearLuminance(athleteCyan) / Math.max(0.0001, linearLuminance(athleteViolet)),
      1,
      1.36,
    );
    athleteViolet.multiplyScalar(luminanceScale);
    const violetLuminance = linearLuminance(athleteViolet);
    athleteViolet.setRGB(
      THREE.MathUtils.clamp(violetLuminance + (athleteViolet.r - violetLuminance) * 1.45, 0, 1),
      THREE.MathUtils.clamp(violetLuminance + (athleteViolet.g - violetLuminance) * 1.45, 0, 1),
      THREE.MathUtils.clamp(violetLuminance + (athleteViolet.b - violetLuminance) * 1.45, 0, 1),
    );
  }
  const start = colorVariant === "athlete"
    ? side === 1 ? athleteCyan : athleteViolet
    : colors[side === 1 ? "--text-2" : "--text-3"];
  const end = colorVariant === "athlete"
    ? side === 1 ? athleteViolet : athleteCyan
    : colors[side === 1 ? "--text-3" : "--text-2"];
  const colorProgress = colorVariant === "athlete" && !lightTheme
    ? side === 1
      ? smoothstep(0.18, 0.58, progress)
      : smoothstep(0.42, 0.82, progress)
    : progress;
  const darkAthleteCompleteness = colorVariant === "athlete" && !lightTheme && mode === "completeness";
  const color = darkAthleteCompleteness
    ? start.clone()
    : colorVariant === "athlete" && !lightTheme
      ? start.clone().lerpHSL(end, colorProgress)
      : start.clone().lerp(end, colorProgress);
  if (variant === "opponent" && mode === "completeness") {
    const zone = seeded(grainSeed, 293);
    if (lightTheme) {
      if (zone < 0.12) color.lerp(colors["--text-1"], 0.9);
      else if (zone < 0.46) color.lerp(colors["--text-1"], 0.54);
      else color.lerp(colors["--text-2"], 0.32);
    } else {
      const grayStep = mode === "completeness"
        ? zone < 0.33 ? 0.32 : zone < 0.68 ? 0.47 : 0.58
        : zone < 0.33 ? 0.14 : zone < 0.68 ? 0.32 : 0.52;
      color.lerp(colors["--text-1"], grayStep);
    }
  }
  const split = mode === "split"
    ? splitColor(model, progress, colors, side, grainSeed, splitTransitionRungs)
    : null;
  if (split) {
    const curveVariation = Math.sin(progress * Math.PI * 15 + side * 0.9) * 0.045;
    const grainVariation = (seeded(grainSeed, 283) - 0.5) * 0.09;
    const categoryShare = clamp01(1 - splitDamping + curveVariation + grainVariation);
    if (!lightTheme && colorVariant === "athlete") color.lerpHSL(split, categoryShare);
    else color.lerp(split, categoryShare);
    const lightness = 0.94 + seeded(grainSeed, 287) * 0.08 + Math.sin(progress * Math.PI * 23) * 0.025;
    color.multiplyScalar(lightness * (lightTheme ? 0.92 : 1.12));
  }
  if (focusCategoryId && rung.categoryId !== focusCategoryId) color.lerp(depthColor, 0.26);
  if (focusCategoryId && rung.categoryId === focusCategoryId) {
    const focusColor = colors["--accent-2"];
    if (variant === "athlete" || mode === "split") {
      color.copy(focusColor);
      if (!lightTheme) {
        const focusLuminance = linearLuminance(color);
        color.setRGB(
          THREE.MathUtils.clamp(focusLuminance + (color.r - focusLuminance) * 1.45, 0, 1),
          THREE.MathUtils.clamp(focusLuminance + (color.g - focusLuminance) * 1.45, 0, 1),
          THREE.MathUtils.clamp(focusLuminance + (color.b - focusLuminance) * 1.45, 0, 1),
        );
        const saturatedLuminance = linearLuminance(color);
        color.multiplyScalar(focusLuminance / Math.max(0.0001, saturatedLuminance));
      }
    }
    color.multiplyScalar(lightTheme ? 1.08 : 1.18);
  }
  if (colorVariant === "athlete" && !lightTheme) color.multiplyScalar(mode === "completeness" ? 2.75 : 0.85);
  return color;
}

function paintParticleGeometry(
  geometry: THREE.BufferGeometry,
  model: HelixModel,
  layout: VisualRung[],
  colors: Record<string, THREE.Color>,
  variant: "athlete" | "opponent",
  mode: "completeness" | "split",
  focusCategoryId: string | null,
  kind: "strand" | "rung" | "bokeh" | "exit",
  splitDamping: number,
  splitTransitionRungs: number,
) {
  const colorAttribute = geometry.getAttribute("color") as THREE.BufferAttribute;
  const progressAttribute = kind === "strand" || kind === "rung" ? geometry.getAttribute("aProgress") as THREE.BufferAttribute : null;
  const sideAttribute = kind === "strand" ? geometry.getAttribute("aSide") as THREE.BufferAttribute : null;
  const rungAttribute = kind === "rung" ? geometry.getAttribute("aRungIndex") as THREE.BufferAttribute : null;
  const alongAttribute = kind === "rung" ? geometry.getAttribute("aAlong") as THREE.BufferAttribute : null;
  const nearAttribute = kind === "bokeh" ? geometry.getAttribute("aNear") as THREE.BufferAttribute : null;
  const focusAttribute = kind === "strand" || kind === "rung"
    ? geometry.getAttribute("aFocus") as THREE.BufferAttribute
    : null;
  const lightTheme = colors["--bg-0"].r + colors["--bg-0"].g + colors["--bg-0"].b > 1.5;
  for (let index = 0; index < colorAttribute.count; index += 1) {
    let color: THREE.Color;
    if (kind === "bokeh" || kind === "exit") {
      color = colors[index % 2 === 0 ? "--accent" : "--accent-2"].clone();
      if (kind === "bokeh") {
        const near = (nearAttribute?.getX(index) ?? 0) > 0.5;
        color = lightTheme
          ? colors["--bg-0"].clone().lerp(colors[index % 2 === 0 ? "--text-2" : "--text-1"], near ? 0.82 : 0.68)
          : color.lerp(colors["--bg-0"], 0.58);
      }
      if (kind === "exit") color.lerp(colors["--bg-0"], 0.18);
    } else {
      const progress = progressAttribute?.getX(index) ?? 0;
      const slot = Math.round(clamp01(progress) * (layout.length - 1));
      const rung = rungAttribute
        ? model.rungs[Math.round(rungAttribute.getX(index))]
        : layout[slot].rung;
      const focusedRung = Boolean(focusCategoryId && rung.categoryId === focusCategoryId);
      focusAttribute?.setX(index, focusedRung ? 1 : 0);
      const along = alongAttribute?.getX(index) ?? 0.5;
      const splitPoint = rungSplitPoint(progress, rung.questionId);
      const side = sideAttribute?.getX(index) === -1 || (kind === "rung" && along >= splitPoint) ? -1 : 1;
      const strandColor = resolvedParticleColor(
        model, rung, progress, side, colors, variant, mode, focusCategoryId,
        index, splitDamping, splitTransitionRungs,
      );
      color = strandColor.clone();
      if (kind === "rung") {
        if (!rung.answered) {
          if (focusedRung && (variant === "athlete" || mode === "split")) {
            color.copy(strandColor).multiplyScalar(lightTheme ? 0.72 : 0.78);
          } else if (!lightTheme && variant === "athlete" && mode === "completeness") {
            color.copy(strandColor).multiplyScalar(0.58);
          } else {
            color.copy(colors["--text-2"]);
            if (lightTheme) color.lerp(colors["--bg-0"], 0.72);
          }
          colorAttribute.setXYZ(index, color.r, color.g, color.b);
          continue;
        }
        const centerColor = rung.answered
          ? resolvedParticleColor(
              model, rung, progress, side, colors, variant, mode, focusCategoryId,
              index + 409, splitDamping, splitTransitionRungs,
            )
          : colors["--line-strong"].clone();
        const endpointBlend = 1 - smoothstep(0.015, 0.15, Math.min(along, 1 - along));
        color.copy(centerColor).lerp(strandColor, endpointBlend);
      }
    }
    colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }
  colorAttribute.needsUpdate = true;
  if (focusAttribute) focusAttribute.needsUpdate = true;
}

function spawnWander(
  state: WanderRuntime,
  index: number,
  groupSerial: number,
  startedAt: number,
  preferredStart: number,
  answeredSlots: number[],
  totalSlots: number,
  speed: number,
  rungStrikeChance: number,
) {
  state.serial += 1;
  const seedIndex = groupSerial * 71 + state.serial * 11 + index * 37;
  const distance = 0.24 + seeded(seedIndex, 230) * 0.22;
  state.start = THREE.MathUtils.clamp(preferredStart, 0.04, 0.68);
  state.end = THREE.MathUtils.clamp(state.start + distance, 0.28, 0.97);
  state.startSide = seeded(seedIndex, 233) > 0.5 ? 1 : -1;
  state.duration = THREE.MathUtils.clamp((0.9 + seeded(seedIndex, 234) * 0.65) * (3.2 / THREE.MathUtils.clamp(speed, 2.5, 4)), 0.72, 1.65);
  state.startedAt = startedAt;
  state.jumpCount = 1 + Math.floor(seeded(seedIndex, 237) * 3);
  state.jumpAngles = [0, 1, 2, 3].map((jump) => (
    (seeded(seedIndex + jump * 13, 238) * 2 - 1) * Math.PI
  )) as WanderRuntime["jumpAngles"];
  const low = Math.min(state.start, state.end);
  const high = Math.max(state.start, state.end);
  const candidates = answeredSlots.filter((slot) => {
    const progress = slot / Math.max(1, totalSlots - 1);
    return progress > low + 0.035 && progress < high - 0.035;
  });
  const shouldCross = candidates.length > 0
    && (index === 0 || seeded(seedIndex, 235) < THREE.MathUtils.clamp(rungStrikeChance, 0, 1));
  const crossSlot = shouldCross
    ? candidates[Math.floor(seeded(seedIndex, 236) * candidates.length) % candidates.length]
    : -1;
  state.crossProgress = crossSlot >= 0 ? crossSlot / Math.max(1, totalSlots - 1) : -1;
}

function ParticleHelixContent(props: Omit<HelixSceneProps, "onReady" | "onContextLost" | "onContextRestored">) {
  const {
    model, variant, mode, focusCategoryId, grownQuestionIds, active, tilt,
    nearParticleCount, farParticleCount, glowIntensity, flashFrequency,
    twinkleIntensity, wobbleStrength, strandParticleDensity, rungParticleDensity,
    shellSpread, wanderFlashCount, wanderFlashIntensity, wanderFlashSpeed,
    wanderFlashWidth, wanderBurstPause, wanderRungStrike, sideExitFrequency,
    splitDamping, splitTransitionRungs, bokehCenterDensity, strandInnerSizeRatio,
    bokehNearRatio, stubVariance, opponentFlashInvert, opponentInvertSoftness,
    lightningFrequency, splitZoomDistance,
    rungKinkRatio, rungKinkStrength, allowRungKinks, focusOffset,
    grainEdgeSharpness, grainNoiseAmount,
    blueprintShare, nearDriftSpeed, farDriftSpeed, focusGlow,
    qaPulseProgress, qaLightningProgress, qaSparkProgress,
    onAnchorChange,
  } = props;
  const groupRef = useRef<THREE.Group>(null);
  const activeTime = useRef(0);
  const growthStart = useRef(0);
  const frameCount = useRef(0);
  const statsStarted = useRef(0);
  const statsLast = useRef(0);
  const pulseState = useRef({ nextAt: 1.4, startedAt: -1, count: 0, crossRung: -1 });
  const previousFlashFrequency = useRef(flashFrequency);
  const lightningState = useRef({
    serial: 0, nextAt: 2.2, startedAt: -1, duration: 0.32,
    center: 0.5, start: 0.08, end: 0.92, direction: 1, width: 0.04, angle: 0,
    clusterRemaining: 0, clusterSize: 0, strength: 1,
  });
  const burstState = useRef<BurstRuntime>({ serial: 0, nextAt: 0.8, activeCount: 0, startedAt: -1 });
  const wanderStates = useRef<WanderRuntime[]>(Array.from({ length: MAX_WANDER_FLASHES }, () => ({
    serial: 0, startedAt: -1, duration: 0.7, start: 0, end: 0, startSide: 1, crossProgress: -1,
    jumpCount: 1, jumpAngles: [0, 0, 0, 0],
  })));
  const exitState = useRef({ nextAt: 12, startedAt: -1, progress: 0.5, side: 1 as 1 | -1, serial: 0 });
  const lookAtY = useRef(0);
  const anchorColorKey = useRef("");
  const bokehRef = useRef<THREE.Points>(null);
  const { camera, gl, invalidate, scene, size } = useThree();
  const visualLayout = useMemo(() => makeVisualLayout(model, mode), [mode, model]);
  const tokenNames = useMemo(() => [
    "--bg-0", "--bg-1", "--text-1", "--text-2", "--text-3", "--line-strong", "--accent", "--accent-2",
    ...model.segments.map((segment) => segment.colorToken),
    ...model.bands?.map((band) => band.colorToken) ?? [],
  ], [model.bands, model.segments]);
  const colors = useResolvedTokens(tokenNames);
  const ready = tokenNames.every((token) => colors[token]);
  const light = ready && colors["--bg-0"].r + colors["--bg-0"].g + colors["--bg-0"].b > 1.5;
  const effectiveOpponent = variant === "opponent" && mode === "completeness";
  const strandGeometry = useMemo(
    () => makeParticleStrands(strandParticleDensity, shellSpread, strandInnerSizeRatio),
    [shellSpread, strandInnerSizeRatio, strandParticleDensity],
  );
  const openDensity = THREE.MathUtils.clamp(Math.round(nearParticleCount / 9), 28, 40);
  const rungGeometry = useMemo(
    () => makeParticleRungs(
      visualLayout, rungParticleDensity, openDensity, grownQuestionIds, model.completeness, blueprintShare, shellSpread, stubVariance,
      rungKinkRatio, rungKinkStrength, allowRungKinks && size.height >= 500,
    ),
    [allowRungKinks, blueprintShare, grownQuestionIds, model.completeness, openDensity, rungKinkRatio, rungKinkStrength, rungParticleDensity, shellSpread, size.height, stubVariance, visualLayout],
  );
  const bokehGeometry = useMemo(
    () => makeParticleBokeh(farParticleCount, bokehCenterDensity, bokehNearRatio, size.width / Math.max(1, size.height)),
    [bokehCenterDensity, bokehNearRatio, farParticleCount, size.height, size.width],
  );
  const exitGeometry = useMemo(() => makeExitSparks(), []);
  const materials = useMemo(() => {
    if (!ready) return null;
    const depthColor = light ? colors["--text-2"] : colors["--bg-0"];
    return {
      strand: particleShaderMaterial("strand", gl.getPixelRatio(), light, colors["--bg-0"], depthColor, effectiveOpponent, !light && !effectiveOpponent),
      rung: particleShaderMaterial("rung", gl.getPixelRatio(), light, colors["--bg-0"], depthColor, effectiveOpponent, !light && !effectiveOpponent),
      bokeh: particleShaderMaterial("bokeh", gl.getPixelRatio(), light, colors["--bg-0"], depthColor, false),
      exit: particleShaderMaterial("exit", gl.getPixelRatio(), light, colors["--bg-0"], depthColor, false),
    };
  }, [colors, effectiveOpponent, gl, light, mode, ready]);
  const answeredSlots = useMemo(
    () => visualLayout.filter((item) => item.rung.answered).map((item) => item.slot),
    [visualLayout],
  );

  useEffect(() => {
    growthStart.current = activeTime.current;
    invalidate();
  }, [grownQuestionIds, invalidate]);

  useLayoutEffect(() => {
    wanderStates.current.forEach((state) => { state.startedAt = -1; });
    burstState.current.activeCount = 0;
    burstState.current.nextAt = activeTime.current + 0.6;
    exitState.current.nextAt = activeTime.current + (sideExitFrequency > 0 ? Math.min(12, sideExitFrequency * 0.65) : Number.POSITIVE_INFINITY);
  }, [sideExitFrequency, visualLayout, wanderBurstPause, wanderFlashSpeed, wanderRungStrike]);

  useLayoutEffect(() => {
    if (previousFlashFrequency.current === flashFrequency) return;
    previousFlashFrequency.current = flashFrequency;
    pulseState.current.startedAt = -1;
    pulseState.current.nextAt = activeTime.current + 0.25;
    invalidate();
  }, [flashFrequency, invalidate]);

  useEffect(() => {
    if (!ready) return;
    paintParticleGeometry(strandGeometry, model, visualLayout, colors, variant, mode, focusCategoryId, "strand", splitDamping, splitTransitionRungs);
    paintParticleGeometry(rungGeometry, model, visualLayout, colors, variant, mode, focusCategoryId, "rung", splitDamping, splitTransitionRungs);
    paintParticleGeometry(bokehGeometry, model, visualLayout, colors, variant, mode, focusCategoryId, "bokeh", splitDamping, splitTransitionRungs);
    paintParticleGeometry(exitGeometry, model, visualLayout, colors, variant, mode, focusCategoryId, "exit", splitDamping, splitTransitionRungs);
    const fog = new THREE.Fog(colors["--bg-0"], 8.8, 15.5);
    scene.fog = fog;
    gl.setClearColor(colors["--bg-0"], 0);
    invalidate();
    return () => {
      if (scene.fog === fog) scene.fog = null;
    };
  }, [bokehGeometry, colors, exitGeometry, focusCategoryId, gl, invalidate, mode, model, ready, rungGeometry, scene, splitDamping, splitTransitionRungs, strandGeometry, variant, visualLayout]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => invalidate(), 1000 / IDLE_FPS);
    return () => window.clearInterval(timer);
  }, [active, invalidate]);

  useEffect(() => () => {
    strandGeometry.dispose();
    rungGeometry.dispose();
    bokehGeometry.dispose();
    exitGeometry.dispose();
  }, [bokehGeometry, exitGeometry, rungGeometry, strandGeometry]);

  useEffect(() => () => {
    if (!materials) return;
    materials.strand.dispose();
    materials.rung.dispose();
    materials.bokeh.dispose();
    materials.exit.dispose();
  }, [materials]);

  useFrame((_state, rawDelta) => {
    if (!active || document.visibilityState === "hidden" || !ready || !materials || !groupRef.current) return;
    const delta = Math.min(rawDelta, 0.05);
    const qaFrozen = qaPulseProgress !== null || qaLightningProgress !== null || qaSparkProgress !== null;
    if (!qaFrozen) activeTime.current += delta;
    const now = qaFrozen ? 6.25 : activeTime.current;
    const pulse = pulseState.current;
    const frequency = THREE.MathUtils.clamp(flashFrequency, 0.25, 2.4);
    if (pulse.startedAt < 0 && now >= pulse.nextAt) {
      pulse.startedAt = now;
      pulse.crossRung = pulse.count % 4 === 3 && answeredSlots.length > 0
        ? answeredSlots[Math.floor(seeded(pulse.count, 190) * answeredSlots.length) % answeredSlots.length]
        : -1;
    }
    let pulseAge = pulse.startedAt < 0 ? -1 : now - pulse.startedAt;
    if (pulseAge > PARTICLE_PULSE_SECONDS) {
      pulse.count += 1;
      pulse.startedAt = -1;
      pulse.nextAt = now + THREE.MathUtils.clamp((8 + seeded(pulse.count, 191) * 6) / frequency, 5.5, 12);
      pulseAge = -1;
    }
    const pulseT = qaFrozen
      ? qaPulseProgress !== null ? clamp01(qaPulseProgress) : -1
      : pulseAge >= 0 ? clamp01(pulseAge / PARTICLE_PULSE_SECONDS) : -1;
    const pulseActive = qaFrozen ? qaPulseProgress !== null ? 1 : 0 : pulseAge >= 0 ? 1 : 0;

    const lightning = lightningState.current;
    const lightningRate = THREE.MathUtils.clamp(lightningFrequency, 0, 2.4);
    if (lightningRate <= 0) {
      lightning.startedAt = -1;
      lightning.nextAt = Number.POSITIVE_INFINITY;
    } else if (lightning.startedAt < 0 && now >= lightning.nextAt) {
      lightning.serial += 1;
      lightning.startedAt = now;
      if (lightning.clusterRemaining <= 0) {
        lightning.clusterSize = 2 + Math.floor(seeded(lightning.serial, 329) * 3);
        lightning.clusterRemaining = lightning.clusterSize;
      }
      const strikeIndex = lightning.clusterSize - lightning.clusterRemaining;
      const clusterBuild = lightning.clusterSize > 1
        ? strikeIndex / (lightning.clusterSize - 1)
        : 1;
      lightning.strength = THREE.MathUtils.lerp(
        0.34,
        1.2,
        smoothstep(0, 1, clusterBuild),
      ) * (0.9 + seeded(lightning.serial, 333) * 0.2);
      lightning.duration = 0.34 + seeded(lightning.serial, 331) * 0.26;
      lightning.direction = seeded(lightning.serial, 335) > 0.5 ? 1 : -1;
      const travel = 0.55 + seeded(lightning.serial, 337) * 0.35;
      const edgeInset = 0.045 + seeded(lightning.serial, 339) * 0.08;
      lightning.start = lightning.direction > 0 ? edgeInset : 1 - edgeInset;
      lightning.end = THREE.MathUtils.clamp(lightning.start + lightning.direction * travel, 0.025, 0.975);
      lightning.center = lightning.start;
      lightning.width = 0.022 + seeded(lightning.serial, 347) * 0.025;
      lightning.angle = (seeded(lightning.serial, 349) * 2 - 1) * Math.PI;
    }
    let lightningAge = lightning.startedAt < 0 ? -1 : now - lightning.startedAt;
    if (lightningAge > lightning.duration) {
      lightning.startedAt = -1;
      lightning.clusterRemaining = Math.max(0, lightning.clusterRemaining - 1);
      lightning.nextAt = lightning.clusterRemaining > 0
        ? now + 0.12 + seeded(lightning.serial, 351) * 0.18
        : now + THREE.MathUtils.clamp(
          (2.2 + seeded(lightning.serial, 353) * 4.8) / Math.max(0.2, lightningRate),
          1.5,
          8.5,
        );
      lightningAge = -1;
    }
    const lightningPhase = lightningAge >= 0 ? lightningAge / lightning.duration : -1;
    const qaLightningPhase = qaLightningProgress !== null ? clamp01(qaLightningProgress) : -1;
    const lightningBaseEnvelope = qaFrozen
      ? qaLightningProgress !== null
        ? smoothstep(0, 0.06, qaLightningPhase) * (1 - smoothstep(0.72, 1, qaLightningPhase))
        : 0
      : lightningPhase >= 0
      ? smoothstep(0, 0.06, lightningPhase) * (1 - smoothstep(0.72, 1, lightningPhase))
      : 0;
    const activeLightningPhase = qaLightningPhase >= 0 ? qaLightningPhase : lightningPhase;
    const lightningFlicker = activeLightningPhase >= 0
      ? 0.58 + Math.abs(Math.sin((activeLightningPhase * 5.2 + seeded(lightning.serial, 357)) * Math.PI)) * 0.42
      : 0;
    const lightningPhaseBuild = activeLightningPhase >= 0
      ? 0.55 + smoothstep(0.08, 0.68, activeLightningPhase) * 0.45
      : 0;
    const lightningStrikeStrength = qaLightningPhase >= 0
      ? THREE.MathUtils.lerp(0.34, 1.2, smoothstep(0.08, 0.78, qaLightningPhase))
      : lightning.strength;
    const lightningEnvelope = lightningBaseEnvelope
      * lightningFlicker
      * lightningPhaseBuild
      * lightningStrikeStrength;
    const lightningTravel = activeLightningPhase >= 0 ? smoothstep(0, 1, activeLightningPhase) : 0;
    const lightningCenter = qaLightningProgress !== null
      ? THREE.MathUtils.lerp(0.08, 0.92, lightningTravel)
      : THREE.MathUtils.lerp(lightning.start, lightning.end, lightningTravel);
    const lightningDirection = qaLightningProgress !== null ? 1 : lightning.direction;

    const requestedWanders = THREE.MathUtils.clamp(Math.round(wanderFlashCount), 0, MAX_WANDER_FLASHES);
    const wanderHeads = new Float32Array(MAX_WANDER_FLASHES).fill(-10);
    const wanderSides = new Float32Array(MAX_WANDER_FLASHES);
    const wanderOriginSides = new Float32Array(MAX_WANDER_FLASHES);
    const wanderDirections = new Float32Array(MAX_WANDER_FLASHES).fill(1);
    const wanderIntensities = new Float32Array(MAX_WANDER_FLASHES);
    const wanderCrosses = new Float32Array(MAX_WANDER_FLASHES).fill(-1);
    const wanderAngles = new Float32Array(MAX_WANDER_FLASHES);
    const burst = burstState.current;
    if (qaSparkProgress !== null) {
      const phase = clamp01(qaSparkProgress);
      const fade = Math.min(1, phase / 0.12, (1 - phase) / 0.2);
      wanderHeads[0] = THREE.MathUtils.lerp(0.23, 0.72, phase);
      wanderOriginSides[0] = 1;
      wanderSides[0] = wanderHeads[0] >= 0.44 ? -1 : 1;
      wanderDirections[0] = 1;
      wanderIntensities[0] = Math.max(0, fade) * THREE.MathUtils.clamp(wanderFlashIntensity, 0, 1.5);
      wanderCrosses[0] = 0.44;
      wanderAngles[0] = 0.28;
      burst.activeCount = 0;
    } else if (requestedWanders === 0) {
      burst.activeCount = 0;
      burst.nextAt = now + THREE.MathUtils.clamp(wanderBurstPause, 1.25, 4);
      wanderStates.current.forEach((state) => { state.startedAt = -1; });
    } else if (burst.activeCount === 0 && now >= burst.nextAt) {
      burst.serial += 1;
      burst.activeCount = 1 + Math.floor(seeded(burst.serial, 228) * requestedWanders);
      burst.startedAt = now;
      const firstStart = 0.12 + seeded(burst.serial, 229) * 0.46;
      for (let index = 0; index < burst.activeCount; index += 1) {
        const preferredStart = index === 0
          ? firstStart
          : index === 1
            ? firstStart + 0.12 + seeded(burst.serial, 244) * 0.2
            : firstStart - 0.14 - seeded(burst.serial, 245) * 0.2;
        spawnWander(
          wanderStates.current[index], index, burst.serial, now + index * (0.12 + seeded(burst.serial + index, 246) * 0.08),
          preferredStart, answeredSlots, visualLayout.length, wanderFlashSpeed, wanderRungStrike,
        );
      }
    }
    let burstFinished = burst.activeCount > 0;
    for (let index = 0; index < burst.activeCount; index += 1) {
      const state = wanderStates.current[index];
      const age = now - state.startedAt;
      if (age < state.duration) burstFinished = false;
      if (age < 0 || age >= state.duration) continue;
      const phase = clamp01(age / state.duration);
      const fade = Math.min(1, phase / 0.12, (1 - phase) / 0.2);
      wanderHeads[index] = THREE.MathUtils.lerp(state.start, state.end, phase);
      const direction = Math.sign(state.end - state.start) || 1;
      const crossed = state.crossProgress >= 0
        && (wanderHeads[index] - state.crossProgress) * direction >= 0;
      wanderOriginSides[index] = state.startSide;
      wanderSides[index] = crossed ? -state.startSide : state.startSide;
      wanderDirections[index] = direction;
      wanderIntensities[index] = Math.max(0, fade) * THREE.MathUtils.clamp(wanderFlashIntensity, 0, 1.5);
      wanderCrosses[index] = state.crossProgress;
      const jumpIndex = Math.min(state.jumpCount, Math.floor(phase * (state.jumpCount + 1)));
      wanderAngles[index] = state.jumpAngles[jumpIndex];
    }
    if (burstFinished) {
      burst.activeCount = 0;
      const silence = THREE.MathUtils.clamp(
        wanderBurstPause * (0.72 + seeded(burst.serial, 247) * 0.56),
        1.25,
        4,
      );
      burst.nextAt = now + silence;
      wanderStates.current.forEach((state) => { state.startedAt = -1; });
    }

    const exit = exitState.current;
    if (sideExitFrequency <= 0) {
      exit.nextAt = Number.POSITIVE_INFINITY;
      exit.startedAt = -1;
    } else if (now >= exit.nextAt && burst.activeCount > 0) {
      const activeSources = wanderStates.current
        .slice(0, burst.activeCount)
        .map((state, index) => ({ state, index }))
        .filter(({ state }) => now >= state.startedAt && now - state.startedAt < state.duration);
      if (activeSources.length > 0) {
      const sourceIndex = activeSources[exit.serial % activeSources.length].index;
      const source = wanderStates.current[sourceIndex];
      const sourcePhase = clamp01((now - source.startedAt) / source.duration);
      exit.progress = THREE.MathUtils.lerp(source.start, source.end, sourcePhase);
      const sourceDirection = Math.sign(source.end - source.start) || 1;
      const sourceCrossed = source.crossProgress >= 0
        && (exit.progress - source.crossProgress) * sourceDirection >= 0;
      exit.side = sourceCrossed
        ? source.startSide === 1 ? -1 : 1
        : source.startSide;
      exit.startedAt = now;
      exit.serial += 1;
      exit.nextAt = now + sideExitFrequency * (0.86 + seeded(exit.serial, 241) * 0.28);
      }
    }
    const exitAge = exit.startedAt < 0 ? -1 : now - exit.startedAt;
    if (exitAge > 0.48) exit.startedAt = -1;

    for (const material of [materials.strand, materials.rung]) {
      material.uniforms.uTime.value = now;
      material.uniforms.uTwinkle.value = twinkleIntensity;
      material.uniforms.uGlow.value = glowIntensity;
      material.uniforms.uPulseT.value = pulseT;
      material.uniforms.uPulseActive.value = pulseActive;
      material.uniforms.uJitter.value = wobbleStrength;
      material.uniforms.uOpponentFlashInvert.value = THREE.MathUtils.clamp(opponentFlashInvert, 0, 1);
      material.uniforms.uInvertSoftness.value = THREE.MathUtils.clamp(opponentInvertSoftness, 0, 1);
      material.uniforms.uEdgeSharpness.value = THREE.MathUtils.clamp(grainEdgeSharpness, 0, 1);
      material.uniforms.uNoiseAmount.value = THREE.MathUtils.clamp(grainNoiseAmount, 0, 1);
      material.uniforms.uFocusGlow.value = THREE.MathUtils.clamp(focusGlow, 0.5, 2);
      material.uniforms.uSplitMode.value = mode === "split" ? 1 : 0;
      material.uniforms.uPulseAngle.value = (seeded(pulse.count, 359) * 2 - 1) * Math.PI;
      material.uniforms.uLightningCenter.value = lightningCenter;
      material.uniforms.uLightningWidth.value = qaLightningProgress !== null ? 0.04 : lightning.width;
      material.uniforms.uLightningAngle.value = qaLightningProgress !== null ? -0.42 : lightning.angle;
      material.uniforms.uLightningDirection.value = lightningDirection;
      material.uniforms.uLightningIntensity.value = lightningEnvelope * 1.32;
      (material.uniforms.uWanderHead.value as Float32Array).set(wanderHeads);
      (material.uniforms.uWanderSide.value as Float32Array).set(wanderSides);
      (material.uniforms.uWanderOriginSide.value as Float32Array).set(wanderOriginSides);
      (material.uniforms.uWanderDirection.value as Float32Array).set(wanderDirections);
      (material.uniforms.uWanderIntensity.value as Float32Array).set(wanderIntensities);
      (material.uniforms.uWanderCross.value as Float32Array).set(wanderCrosses);
      (material.uniforms.uWanderAngle.value as Float32Array).set(wanderAngles);
    }
    materials.strand.uniforms.uWanderWidth.value = THREE.MathUtils.clamp(wanderFlashWidth, 0.3, 0.78);
    materials.rung.uniforms.uGrowthTime.value = now - growthStart.current;
    materials.rung.uniforms.uCrossRung.value = pulse.crossRung;
    materials.bokeh.uniforms.uTime.value = now;
    materials.bokeh.uniforms.uNearDriftSpeed.value = THREE.MathUtils.clamp(nearDriftSpeed, 0.05, 0.8);
    materials.bokeh.uniforms.uFarDriftSpeed.value = THREE.MathUtils.clamp(farDriftSpeed, 0.03, 0.5);
    materials.exit.uniforms.uExitProgress.value = exit.progress;
    materials.exit.uniforms.uExitSide.value = exit.side;
    materials.exit.uniforms.uExitAge.value = exitAge;
    materials.exit.uniforms.uExitActive.value = exitAge >= 0 && !(effectiveOpponent && !light) ? 1 : 0;

    const group = groupRef.current;
    group.rotation.y = qaFrozen ? 0.58 : group.rotation.y + delta * (Math.PI * 2 / 38);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, THREE.MathUtils.degToRad(THREE.MathUtils.clamp(tilt, 0, 8)), 6, delta);
    group.position.x = THREE.MathUtils.damp(group.position.x, THREE.MathUtils.clamp(focusOffset, -1, 1), 4.6, delta);
    group.position.y = qaFrozen ? 0 : Math.sin(now * 0.3) * 0.045;
    const focusSlots = visualLayout.filter((item) => item.rung.categoryId === focusCategoryId).map((item) => item.slot);
    const focusIndex = focusedSlot(visualLayout, focusCategoryId);
    const focusY = pointFor(focusIndex, 1, visualLayout.length).y;
    const focused = focusSlots.length > 0;
    const desiredDistance = focused
      ? 7
      : mode === "split" ? THREE.MathUtils.clamp(splitZoomDistance, 12.8, 13.6) : BASE_CAMERA_DISTANCE;
    const verticalHalfView = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov * 0.5)) * desiredDistance;
    const extendedHalfHeight = HELIX_HEIGHT * (STRAND_PROGRESS_MAX - 0.5);
    const derivedFocusLimit = Math.max(1.2, extendedHalfHeight - verticalHalfView * 0.7);
    const safeFocusY = THREE.MathUtils.clamp(focusY, -derivedFocusLimit, derivedFocusLimit);
    const desiredCamera = new THREE.Vector3(0, focused ? safeFocusY : 0, desiredDistance);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * (focused ? 6.5 : 4.2)));
    lookAtY.current = THREE.MathUtils.damp(lookAtY.current, focused ? safeFocusY : 0, focused ? 6.5 : 4.2, delta);
    camera.lookAt(0, lookAtY.current, 0);
    const cameraScale = camera.position.z / BASE_CAMERA_DISTANCE;
    materials.strand.uniforms.uCameraScale.value = cameraScale;
    materials.rung.uniforms.uCameraScale.value = cameraScale;
    materials.bokeh.uniforms.uCameraScale.value = cameraScale;
    if (bokehRef.current) {
      const fieldScale = Math.max(1, cameraScale * 1.08);
      bokehRef.current.scale.set(fieldScale, fieldScale, 1);
    }
    if (focused) {
      const plus = pointFor(focusIndex, 1, visualLayout.length).clone();
      const minus = pointFor(focusIndex, -1, visualLayout.length).clone();
      group.localToWorld(plus);
      group.localToWorld(minus);
      const plusDepth = plus.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const minusDepth = minus.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const frontSide: 1 | -1 = plusDepth > minusDepth ? 1 : -1;
      const anchor = frontSide === 1 ? plus : minus;
      anchor.project(camera);
      const semanticKey = `${focusCategoryId}|${mode}|${variant}|${light ? "light" : "dark"}|${frontSide}`;
      let color: string | undefined;
      if (anchorColorKey.current !== semanticKey) {
        anchorColorKey.current = semanticKey;
        const slot = Math.round(focusIndex);
        const rung = visualLayout[slot]?.rung;
        if (rung) {
          const progress = slot / Math.max(1, visualLayout.length - 1);
          const perStep = THREE.MathUtils.clamp(Math.round(strandParticleDensity), 16, 32);
          const sampleStep = Math.round((progress - STRAND_PROGRESS_MIN) / (STRAND_PROGRESS_MAX - STRAND_PROGRESS_MIN) * (PARTICLE_STRAND_STEPS - 1));
          const grainSeed = (frontSide === 1 ? 0 : PARTICLE_STRAND_STEPS * perStep) + sampleStep * perStep;
          color = linearColorCss(resolvedParticleColor(
            model, rung, progress, frontSide, colors, variant, mode, focusCategoryId,
            grainSeed, splitDamping, splitTransitionRungs,
          ));
        }
      }
      onAnchorChange({ x: clamp01(anchor.x * 0.5 + 0.5), y: clamp01(-anchor.y * 0.5 + 0.5), color });
    }

    frameCount.current += 1;
    if (statsStarted.current === 0) statsStarted.current = performance.now();
    const statsNow = performance.now();
    if (statsNow - statsLast.current > 750) {
      const seconds = Math.max(0.001, (statsNow - statsStarted.current) / 1000);
      window.dispatchEvent(new CustomEvent("deepfight-helix-stats", {
        detail: {
          fps: Math.round(frameCount.current / seconds),
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          points: gl.info.render.points,
          lines: gl.info.render.lines,
        },
      }));
      frameCount.current = 0;
      statsStarted.current = statsNow;
      statsLast.current = statsNow;
    }
  });

  if (!ready || !materials) return null;
  return (
    <>
      <group ref={groupRef}>
        <points geometry={strandGeometry} material={materials.strand} frustumCulled={false} renderOrder={2} />
        <points geometry={rungGeometry} material={materials.rung} frustumCulled={false} renderOrder={3} />
        <points geometry={exitGeometry} material={materials.exit} frustumCulled={false} renderOrder={4} />
      </group>
      <points ref={bokehRef} geometry={bokehGeometry} material={materials.bokeh} frustumCulled={false} renderOrder={0} />
    </>
  );
}

export default function ParticleHelixScene(props: HelixSceneProps) {
  return (
    <Canvas
      data-deepfight-webgl
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [0, 0, 9.25], fov: 42, near: 0.1, far: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "pan-y" }}
    >
      <SceneLifecycle
        onReady={props.onReady}
        onContextLost={props.onContextLost}
        onContextRestored={props.onContextRestored}
      />
      <ParticleHelixContent {...props} />
    </Canvas>
  );
}
