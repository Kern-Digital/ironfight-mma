"use client";

/**
 * GYM-KARTE — die Karte der Gym-Suche (/gym-finden, Etappe 3).
 *
 * Zeigt je Gym einen Pin, dazu die Mitte der Suche (PLZ, Ort oder der eigene
 * Standort) mit dem Umkreis. Der Pin ist ein Knopf: Antippen wählt das Gym,
 * die Liste daneben folgt (`onWahl`). Umgekehrt fährt die Karte zum Gym, das
 * in der Liste gewählt wird.
 *
 * WOHIN DIE KARTE SCHAUT: mit Mitte auf den Umkreis, ohne Mitte auf alle
 * Gyms, ohne Gyms auf Deutschland. Sie stellt sich neu ein, wenn sich Mitte,
 * Umkreis oder die Menge der Gyms ändert — nicht bei jeder Auswahl.
 *
 * DER UMKREIS IST EINE KARTEN-EBENE (GeoJSON), kein HTML darüber: Er muss
 * mit der Karte zoomen. MapLibre versteht kein oklch — die Akzentfarbe wird
 * deshalb einmal über eine Zeichenfläche in rgb umgerechnet (`akzentRgb`).
 * Nach einem Themenwechsel lädt der Stil neu und nimmt die Ebene mit; sie
 * wird bei `style.load` wieder eingehängt.
 */

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as KartenObjekt, Marker } from "maplibre-gl";
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

export interface KartenGym {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  gyms: KartenGym[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
  mitte: { lat: number; lng: number } | null;
  radiusKm: number;
  className?: string;
}

const UMKREIS = "umkreis";

/** Kreis um einen Punkt als Vieleck (64 Ecken) — genau genug für jede Zoomstufe. */
function kreis(mitte: { lat: number; lng: number }, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const ecken: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((mitte.lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const w = (i / 64) * 2 * Math.PI;
    ecken.push([mitte.lng + dLng * Math.cos(w), mitte.lat + dLat * Math.sin(w)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ecken] } };
}

/** `--accent` (oklch) → "rgb(r, g, b)", über eine 1-Pixel-Zeichenfläche. */
function akzentRgb(el: HTMLElement): string {
  try {
    const farbe = getComputedStyle(el).getPropertyValue("--accent").trim();
    const flaeche = document.createElement("canvas");
    flaeche.width = flaeche.height = 1;
    const stift = flaeche.getContext("2d", { willReadFrequently: true });
    if (!stift || !farbe) return "rgb(0, 160, 170)";
    stift.fillStyle = farbe;
    stift.fillRect(0, 0, 1, 1);
    const p = stift.getImageData(0, 0, 1, 1).data;
    return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
  } catch {
    return "rgb(0, 160, 170)";
  }
}

export default function GymKarte({ gyms, gewaehlt, onWahl, mitte, radiusKm, className = "h-72" }: Props) {
  const { theme } = useTheme();
  const feld = useRef<HTMLDivElement>(null);
  const karte = useRef<KartenObjekt | null>(null);
  const lib = useRef<MapLibre | null>(null);
  const pins = useRef(new Map<string, Marker>());
  const mittePin = useRef<Marker | null>(null);
  const onWahlRef = useRef(onWahl);
  onWahlRef.current = onWahl;
  const umkreisRef = useRef<{ mitte: Props["mitte"]; radiusKm: number }>({ mitte, radiusKm });
  umkreisRef.current = { mitte, radiusKm };
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState(false);
  const startStil = useRef(theme);

  /** Hängt die Umkreis-Ebene ein (oder aktualisiert sie). Läuft auch nach jedem Stilwechsel. */
  function zeichneUmkreis() {
    const m = karte.current;
    if (!m || !feld.current || !m.isStyleLoaded()) return;
    const { mitte: mi, radiusKm: km } = umkreisRef.current;
    const daten: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: mi ? [kreis(mi, km)] : [],
    };
    const quelle = m.getSource(UMKREIS) as GeoJSONSource | undefined;
    if (quelle) {
      quelle.setData(daten);
      return;
    }
    const farbe = akzentRgb(feld.current);
    m.addSource(UMKREIS, { type: "geojson", data: daten });
    m.addLayer({ id: `${UMKREIS}-flaeche`, type: "fill", source: UMKREIS, paint: { "fill-color": farbe, "fill-opacity": 0.1 } });
    m.addLayer({ id: `${UMKREIS}-rand`, type: "line", source: UMKREIS, paint: { "line-color": farbe, "line-width": 1.5, "line-opacity": 0.7 } });
  }
  const zeichneRef = useRef(zeichneUmkreis);
  zeichneRef.current = zeichneUmkreis;

  // ── Karte einmal aufbauen ────────────────────────────────────────────────
  useEffect(() => {
    let lebt = true;
    const merker = pins.current;
    ladeMapLibre()
      .then((ml) => {
        if (!lebt || !feld.current) return;
        lib.current = ml;
        const m = new ml.Map({
          container: feld.current,
          style: KARTEN_STIL[startStil.current],
          center: [DEUTSCHLAND.lng, DEUTSCHLAND.lat],
          zoom: DEUTSCHLAND.zoom,
          locale: KARTEN_SPRACHE,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        m.on("style.load", () => {
          deutscheNamen(m);
          zeichneRef.current();
        });
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
      merker.forEach((p) => p.remove());
      merker.clear();
      mittePin.current?.remove();
      mittePin.current = null;
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

  // ── Pins der Gyms ────────────────────────────────────────────────────────
  const gymSchluessel = gyms.map((g) => `${g.id}:${g.lat}:${g.lng}`).join("|");
  useEffect(() => {
    const m = karte.current;
    const ml = lib.current;
    if (!bereit || !m || !ml) return;
    const bleibt = new Set(gyms.map((g) => g.id));
    pins.current.forEach((p, id) => {
      if (!bleibt.has(id)) {
        p.remove();
        pins.current.delete(id);
      }
    });
    for (const g of gyms) {
      const da = pins.current.get(g.id);
      if (da) {
        da.setLngLat([g.lng, g.lat]);
        continue;
      }
      const el = pinElement();
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", g.name);
      el.dataset.gymPin = g.id;
      const waehle = (e: Event) => {
        e.stopPropagation();
        onWahlRef.current(g.id);
      };
      el.addEventListener("click", waehle);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          waehle(e);
        }
      });
      pins.current.set(g.id, new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([g.lng, g.lat]).addTo(m));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymSchluessel, bereit]);

  // ── Gewähltes Gym: Pin hervorheben, Karte fährt hin ──────────────────────
  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m) return;
    pins.current.forEach((p, id) => {
      const el = p.getElement();
      if (id === gewaehlt) el.dataset.gewaehlt = "true";
      else delete el.dataset.gewaehlt;
      el.style.zIndex = id === gewaehlt ? "2" : "1";
    });
    const g = gewaehlt ? gyms.find((x) => x.id === gewaehlt) : null;
    if (g && !m.getBounds().contains([g.lng, g.lat])) {
      m.easeTo({ center: [g.lng, g.lat], duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gewaehlt, bereit, gymSchluessel]);

  // ── Mitte, Umkreis und Blick ─────────────────────────────────────────────
  useEffect(() => {
    const m = karte.current;
    const ml = lib.current;
    if (!bereit || !m || !ml) return;

    if (mitte) {
      if (!mittePin.current) {
        const el = document.createElement("div");
        el.className = "karte-mitte";
        el.setAttribute("aria-hidden", "true");
        mittePin.current = new ml.Marker({ element: el }).setLngLat([mitte.lng, mitte.lat]).addTo(m);
      } else {
        mittePin.current.setLngLat([mitte.lng, mitte.lat]);
      }
    } else {
      mittePin.current?.remove();
      mittePin.current = null;
    }
    zeichneRef.current();

    const rand = { padding: 36, duration: 600, maxZoom: 13 };
    if (mitte) {
      const dLat = radiusKm / 110.574;
      const dLng = radiusKm / (111.32 * Math.cos((mitte.lat * Math.PI) / 180));
      m.fitBounds(
        [
          [mitte.lng - dLng, mitte.lat - dLat],
          [mitte.lng + dLng, mitte.lat + dLat],
        ],
        rand,
      );
    } else if (gyms.length > 0) {
      const lngs = gyms.map((g) => g.lng);
      const lats = gyms.map((g) => g.lat);
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { ...rand, padding: 64, maxZoom: 11 },
      );
    } else {
      m.easeTo({ center: [DEUTSCHLAND.lng, DEUTSCHLAND.lat], zoom: DEUTSCHLAND.zoom, duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mitte?.lat, mitte?.lng, radiusKm, gymSchluessel, bereit]);

  return (
    <div className={`karte ${className}`} data-gym-karte data-bereit={bereit ? "ja" : "nein"}>
      {/* h-full statt absolute: MapLibre setzt am Behälter selbst position: relative. */}
      <div ref={feld} className="h-full w-full" />
      {fehler && (
        <p
          className="absolute inset-0 flex items-center justify-center px-6 text-center"
          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
        >
          Die Karte lädt gerade nicht. Die Liste zeigt dir alle Gyms.
        </p>
      )}
    </div>
  );
}
