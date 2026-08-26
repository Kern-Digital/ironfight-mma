"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

export type ResolvedTokenMap = Record<string, THREE.Color>;

function srgbChannelToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function fromSrgbChannels(red: number, green: number, blue: number) {
  return new THREE.Color(
    srgbChannelToLinear(clamp(red)),
    srgbChannelToLinear(clamp(green)),
    srgbChannelToLinear(clamp(blue)),
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function parseComputedColor(value: string): THREE.Color {
  if (value.startsWith("oklch(")) {
    const parts = value.slice(6, value.indexOf(")")).split(/[\s/]+/).filter(Boolean);
    const lightness = parts[0].endsWith("%") ? Number.parseFloat(parts[0]) / 100 : Number.parseFloat(parts[0]);
    const chroma = Number.parseFloat(parts[1]);
    const hue = Number.parseFloat(parts[2]) * Math.PI / 180;
    const labA = chroma * Math.cos(hue);
    const labB = chroma * Math.sin(hue);
    const lRoot = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
    const mRoot = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
    const sRoot = lightness - 0.0894841775 * labA - 1.291485548 * labB;
    const l = lRoot * lRoot * lRoot;
    const m = mRoot * mRoot * mRoot;
    const s = sRoot * sRoot * sRoot;
    return new THREE.Color(
      clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    );
  }

  if (value.startsWith("color(srgb ")) {
    const parts = value.slice(11, value.indexOf(")")).split(/[\s/]+/).filter(Boolean);
    return fromSrgbChannels(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  }

  const legacyFunction = "r" + "gb(";
  if (value.startsWith(legacyFunction)) {
    const parts = value.slice(legacyFunction.length, value.indexOf(")")).split(/[\s,/]+/).filter(Boolean);
    const channels = parts.slice(0, 3).map((part) => part.endsWith("%") ? Number.parseFloat(part) / 100 : Number(part) / 255);
    return fromSrgbChannels(channels[0], channels[1], channels[2]);
  }

  return new THREE.Color(value);
}

function readTokens(names: readonly string[]): ResolvedTokenMap {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;inline-size:0;block-size:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const colors: ResolvedTokenMap = {};
  for (const name of names) {
    probe.style.color = `var(${name})`;
    colors[name] = parseComputedColor(getComputedStyle(probe).color);
  }
  probe.remove();
  return colors;
}

/** Resolves CSS color tokens (including oklch) into colors three.js can consume. */
export function useResolvedTokens(names: readonly string[]): ResolvedTokenMap {
  const stableNames = useMemo(() => Array.from(new Set(names)), [names.join("|")]);
  const [colors, setColors] = useState<ResolvedTokenMap>({});

  useEffect(() => {
    const refresh = () => setColors(readTokens(stableNames));
    refresh();
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "data-theme")) refresh();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [stableNames]);

  return colors;
}
