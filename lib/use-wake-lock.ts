"use client";

import { useEffect, useRef } from "react";

/**
 * Wake-Lock-Hook: hält das Display aktiv, solange `active` true ist.
 *
 * Wichtig:
 *  • Die Wake-Lock-API ist nur in HTTPS-Kontexten und neueren Browsern verfügbar.
 *  • Mobile Safari (ab iOS 16.4) und alle modernen Chromium-Browser
 *    unterstützen sie.
 *  • Wenn die Seite im Hintergrund war und wieder aktiv wird, muss der Lock
 *    neu angefordert werden — das macht der `visibilitychange`-Listener.
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let cancelled = false;

    async function request() {
      if (!active) return;
      try {
        const nav = navigator as Navigator & { wakeLock?: WakeLock };
        if (!nav.wakeLock) return;
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch {
        /* ignore — kein Wake-Lock verfügbar */
      }
    }

    function release() {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      s?.release().catch(() => {});
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && active) {
        request();
      }
    }

    if (active) {
      request();
      document.addEventListener("visibilitychange", onVisibilityChange);
    } else {
      release();
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [active]);
}
