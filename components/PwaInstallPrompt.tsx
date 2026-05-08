"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type Platform = "android" | "ios" | "other";

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "pwa-prompt-dismissed-at";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const IOS_SHOW_DELAY_MS = 3500;

// ── Helpers ────────────────────────────────────────────────────────────────
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari
  if ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

function wasDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(STORAGE_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage blocked (private mode etc.) — silently ignore
  }
}

// ── Inline SVG Icons ───────────────────────────────────────────────────────
function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconShareUpArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function IconPlusSquare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Never show if already running as an installed PWA
    if (isStandalone()) return;
    // Never show if user dismissed recently
    if (wasDismissedRecently()) return;

    const detected = detectPlatform();
    setPlatform(detected);

    // Android Chrome / Desktop Chrome+Edge: browser fires this event
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as unknown as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // iOS Safari: no event — show guide after a short delay
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (detected === "ios") {
      iosTimer = setTimeout(() => setVisible(true), IOS_SHOW_DELAY_MS);
    }

    // Hide if app gets installed during this session (Android)
    function handleAppInstalled() {
      markDismissed();
      setVisible(false);
    }
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    markDismissed();
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        markDismissed();
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  // Only render on android (with prompt) or ios
  if (!visible || !platform) return null;
  if (platform === "other" && !deferredPrompt) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={dismiss}
          />

          {/* Bottom Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[90] mx-auto max-w-lg px-3 pb-5"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div
              className="relative overflow-hidden rounded-2xl p-5"
              style={{
                background: "linear-gradient(160deg, var(--ink-4) 0%, var(--ink-3) 100%)",
                border: "1px solid var(--ink-6)",
                boxShadow:
                  "0 -4px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,212,230,0.10)",
              }}
            >
              {/* Top glow line */}
              <div
                className="pointer-events-none absolute left-0 right-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, var(--ta-cyan) 50%, transparent 100%)",
                  opacity: 0.6,
                }}
              />

              {/* Close */}
              <button
                onClick={dismiss}
                className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors"
                style={{ color: "var(--fg-4)" }}
                aria-label="Schließen"
              >
                <IconX />
              </button>

              {/* App icon + title */}
              <div className="mb-4 flex items-center gap-3 pr-8">
                <img
                  src="/icons/icon-192.png"
                  alt="Tidal Athletics"
                  width={48}
                  height={48}
                  className="rounded-xl shrink-0"
                  style={{ border: "1px solid rgba(0,212,230,0.2)" }}
                />
                <div>
                  <div
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--ta-cyan)" }}
                  >
                    App installieren
                  </div>
                  <div
                    className="heading-display text-xl font-black leading-tight"
                    style={{ color: "var(--fg)" }}
                  >
                    Tidal Athletics
                  </div>
                </div>
              </div>

              {/* Tagline */}
              <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--fg-3)" }}>
                Füge die App zum Homescreen hinzu — schneller Zugriff, Offline-Nutzung
                und ein vollständiges App-Erlebnis ohne Browser.
              </p>

              {/* ── Android / Desktop Chrome+Edge: direct install ── */}
              {(platform === "android" || platform === "other") && deferredPrompt && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="btn-primary w-full gap-2 disabled:opacity-60"
                >
                  <IconDownload />
                  {installing ? "Wird installiert…" : "Zum Homescreen hinzufügen"}
                </button>
              )}

              {/* ── iOS Safari: step-by-step guide ── */}
              {platform === "ios" && (
                <div className="space-y-3">
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: "var(--ink-2)",
                      border: "1px solid var(--ink-5)",
                    }}
                  >
                    <p
                      className="mb-4 text-[10px] font-black uppercase tracking-widest"
                      style={{ color: "var(--fg-4)" }}
                    >
                      In 2 Schritten installieren:
                    </p>

                    <ol className="space-y-4">
                      <li className="flex items-start gap-3">
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                          style={{
                            background: "rgba(0,212,230,0.12)",
                            color: "var(--ta-cyan)",
                            border: "1px solid rgba(0,212,230,0.3)",
                          }}
                        >
                          1
                        </span>
                        <div>
                          <div
                            className="flex items-center gap-1.5 text-sm font-bold"
                            style={{ color: "var(--fg)" }}
                          >
                            <IconShareUpArrow />
                            Teilen-Symbol tippen
                          </div>
                          <div
                            className="mt-0.5 text-xs leading-snug"
                            style={{ color: "var(--fg-4)" }}
                          >
                            Das Quadrat mit dem Pfeil nach oben — unten in der Safari-Leiste
                          </div>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                          style={{
                            background: "rgba(0,212,230,0.12)",
                            color: "var(--ta-cyan)",
                            border: "1px solid rgba(0,212,230,0.3)",
                          }}
                        >
                          2
                        </span>
                        <div>
                          <div
                            className="flex items-center gap-1.5 text-sm font-bold"
                            style={{ color: "var(--fg)" }}
                          >
                            <IconPlusSquare />
                            „Zum Home-Bildschirm" wählen
                          </div>
                          <div
                            className="mt-0.5 text-xs leading-snug"
                            style={{ color: "var(--fg-4)" }}
                          >
                            Im Menü nach unten scrollen und antippen — dann „Hinzufügen"
                          </div>
                        </div>
                      </li>
                    </ol>
                  </div>

                  <button onClick={dismiss} className="btn-secondary w-full text-xs">
                    Später
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
