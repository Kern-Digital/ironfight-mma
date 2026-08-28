"use client";

/**
 * Fertig-Animation (Lottie public/lottie/done.json, von Leon 2026-08-28):
 * spielt beim Workout-Abschluss EINMAL ab und bleibt im letzten Bild
 * stehen. lottie-web wird dynamisch importiert — nur der Fertig-Screen
 * zahlt für die Player-Größe; bei prefers-reduced-motion springt die
 * Animation direkt ans Ende.
 */

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

export default function DoneAnimation({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let anim: AnimationItem | null = null;
    let cancelled = false;
    void import("lottie-web").then((mod) => {
      if (cancelled || !containerRef.current) return;
      anim = mod.default.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "/lottie/done.json",
      });
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        anim.addEventListener("DOMLoaded", () => {
          anim?.goToAndStop(Math.max(0, anim.totalFrames - 1), true);
        });
      }
    });
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden />;
}
