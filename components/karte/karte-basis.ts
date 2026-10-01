/**
 * KARTEN-GRUNDLAGE — MapLibre GL + OpenFreeMap (Gym-Suche, Etappen 2 und 3).
 *
 * Leons Vorgabe 30.09.2026: interaktive Karte, kein Schlüssel. MapLibre GL
 * zeichnet, die Kacheln kommen von OpenFreeMap (tiles.openfreemap.org, frei,
 * ohne Konto, Daten von OpenStreetMap). Der Browser fragt dort Kacheln an —
 * das ist die EINE fremde Adresse dieser Funktion und gehört in die
 * Datenschutzerklärung. Was jemand sucht und wo er steht, geht NICHT dorthin:
 * PLZ und Ort löst lib/plz.ts im Gerät auf.
 *
 * MapLibre wiegt rund 230 KB (gepackt). Es lädt erst, wenn eine Karte
 * wirklich auf den Schirm kommt (`ladeMapLibre`), nie mit dem Rest der App.
 *
 * VERSION 5 FEST GEPINNT: Die 6er-Reihe liefert ihren Worker als eigene
 * Datei, die der Bundler von Next 14 nicht findet. Die 5er trägt ihn in sich.
 */

import "maplibre-gl/dist/maplibre-gl.css";
import "./karte.css";

export type MapLibre = typeof import("maplibre-gl");

/** Helle und dunkle Karte — sie folgt dem Thema der App. */
export const KARTEN_STIL = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/** Ganz Deutschland — der Blick, solange nichts gewählt ist. */
export const DEUTSCHLAND = { lat: 51.16, lng: 10.45, zoom: 4.7 } as const;

/** Die Knöpfe und die Karte selbst sprechen Deutsch (Vorleseprogramme). */
export const KARTEN_SPRACHE: Record<string, string> = {
  "Map.Title": "Karte",
  "NavigationControl.ZoomIn": "Näher heran",
  "NavigationControl.ZoomOut": "Weiter weg",
  "AttributionControl.ToggleAttribution": "Quellen der Karte",
  "AttributionControl.MapFeedback": "Fehler in der Karte melden",
  "Marker.Title": "Pin",
};

let geladen: Promise<MapLibre> | null = null;

export function ladeMapLibre(): Promise<MapLibre> {
  if (!geladen) {
    geladen = import("maplibre-gl").then((m) => ((m as { default?: MapLibre }).default ?? m) as MapLibre);
    geladen.catch(() => {
      geladen = null;
    });
  }
  return geladen;
}

/** Das Pin-Element: ein Tropfen in der Akzentfarbe, Spitze unten. */
export function pinElement(opts: { ziehbar?: boolean; label?: string } = {}): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "karte-pin";
  if (opts.ziehbar) el.dataset.ziehbar = "true";
  if (opts.label) el.setAttribute("aria-label", opts.label);
  el.innerHTML =
    '<svg viewBox="0 0 34 44" aria-hidden="true"><path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 10.9 13.2 24.3 14.6 25.7a1.25 1.25 0 0 0 1.8 0c1.4-1.4 14.6-14.8 14.6-25.7C32.5 8.3 25.6 1.5 17 1.5Z" fill="currentColor" stroke="var(--bg-0)" stroke-width="1.5"/><circle cx="17" cy="16.5" r="5.5" fill="var(--on-accent)"/></svg>';
  return el;
}
