"use client";

/**
 * PIN-KARTE — die Verwaltung setzt den Standort ihres Gyms (Etappe 2 der
 * Gym-Suche, /verwaltung/kontakt).
 *
 * Der Pin kommt von außen (`lat`/`lng`): Die Seite setzt ihn aus der PLZ,
 * sobald eine eingetragen ist. Auf der Karte wird er genau: ziehen oder auf
 * die Stelle tippen — beides meldet `onPin`. Kommt von außen eine NEUE
 * Stelle (andere PLZ), fliegt die Karte dorthin; die eigene Meldung löst
 * keinen Flug aus (`gemeldet`).
 *
 * Ohne Pin zeigt die Karte Deutschland.
 */

import { useEffect, useRef, useState } from "react";
import type { Map as KartenObjekt, Marker } from "maplibre-gl";
import { useTheme } from "@/lib/theme-context";
import {
  DEUTSCHLAND,
  KARTEN_SPRACHE,
  KARTEN_STIL,
  deutscheNamen,
  ladeMapLibre,
  pinElement,
  type MapLibre,
} from "./karte-basis";

interface Props {
  lat: number | null;
  lng: number | null;
  onPin: (lat: number, lng: number) => void;
  /** Höhe als CSS-Klasse, z. B. "h-72". */
  className?: string;
}

export default function PinKarte({ lat, lng, onPin, className = "h-72" }: Props) {
  const { theme } = useTheme();
  const feld = useRef<HTMLDivElement>(null);
  const karte = useRef<KartenObjekt | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const pin = useRef<Marker | null>(null);
  const gemeldet = useRef<string>("");
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState(false);

  // ── Karte einmal aufbauen ────────────────────────────────────────────────
  const startStil = useRef(theme);
  const startPin = useRef({ lat, lng });
  useEffect(() => {
    let lebt = true;
    ladeMapLibre()
      .then((ml) => {
        if (!lebt || !feld.current) return;
        lib.current = ml;
        const s = startPin.current;
        const hatPin = s.lat != null && s.lng != null;
        const m = new ml.Map({
          container: feld.current,
          style: KARTEN_STIL[startStil.current],
          center: hatPin ? [s.lng!, s.lat!] : [DEUTSCHLAND.lng, DEUTSCHLAND.lat],
          zoom: hatPin ? 15 : DEUTSCHLAND.zoom,
          locale: KARTEN_SPRACHE,
          attributionControl: { compact: true },
          // Mit zwei Fingern drehen und kippen verwirrt beim Pin-Setzen nur.
          dragRotate: false,
          pitchWithRotate: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        m.on("click", (e) => {
          gemeldet.current = `${e.lngLat.lat},${e.lngLat.lng}`;
          onPinRef.current(e.lngLat.lat, e.lngLat.lng);
        });
        m.on("style.load", () => deutscheNamen(m));
        m.on("error", () => {
          /* einzelne Kachel fehlt — die Karte bleibt benutzbar */
        });
        karte.current = m;
        setBereit(true);
      })
      .catch(() => {
        if (lebt) setFehler(true);
      });
    return () => {
      lebt = false;
      pin.current?.remove();
      pin.current = null;
      karte.current?.remove();
      karte.current = null;
    };
  }, []);

  // ── Thema folgt der App ──────────────────────────────────────────────────
  useEffect(() => {
    if (!bereit || !karte.current || startStil.current === theme) return;
    startStil.current = theme;
    karte.current.setStyle(KARTEN_STIL[theme]);
  }, [theme, bereit]);

  // ── Pin setzen, versetzen, wegnehmen ─────────────────────────────────────
  useEffect(() => {
    const m = karte.current;
    const ml = lib.current;
    if (!bereit || !m || !ml) return;
    if (lat == null || lng == null) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      const marke = new ml.Marker({
        element: pinElement({ ziehbar: true, label: "Pin deines Gyms" }),
        anchor: "bottom",
        draggable: true,
      });
      marke.on("dragend", () => {
        const p = marke.getLngLat();
        gemeldet.current = `${p.lat},${p.lng}`;
        onPinRef.current(p.lat, p.lng);
      });
      pin.current = marke.setLngLat([lng, lat]).addTo(m);
    } else {
      pin.current.setLngLat([lng, lat]);
    }
    // Von außen gesetzt (PLZ): hinfliegen. Selbst gemeldet: stehen bleiben.
    if (gemeldet.current !== `${lat},${lng}`) {
      m.flyTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 13), duration: 600 });
    }
  }, [lat, lng, bereit]);

  return (
    <div className={`karte ${className}`} data-pin-karte data-bereit={bereit ? "ja" : "nein"}>
      {/* h-full statt absolute: MapLibre setzt am Behälter selbst position: relative. */}
      <div ref={feld} className="h-full w-full" />
      {fehler && (
        <p
          className="absolute inset-0 flex items-center justify-center px-6 text-center"
          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
        >
          Die Karte lädt gerade nicht. Deine Adresse kannst du trotzdem speichern.
        </p>
      )}
    </div>
  );
}
