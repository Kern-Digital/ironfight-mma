/**
 * DIE WOCHE VON TIDAL ATHLETICS, WIE SIE BIS ZUM 26.09.2026 IM CODE STAND.
 *
 * NUR FÜR ZWEI ZWECKE:
 *   · scripts/kursplan-uebernehmen.mjs schreibt sie EINMAL als Plan des Gyms
 *     tidal-athletics (dieselben IDs — Kurs-Abos, Rückmeldungen und
 *     Plan-Freigaben hängen daran).
 *   · lib/demo-seed.ts baut daraus Demo-Rückmeldungen.
 *
 * NIE IN DER OBERFLÄCHE LESEN. Genau das war der Fehler, den diese Datei
 * behebt: Jedes Gym sah diese Woche als seine eigene. Die Kurse eines Gyms
 * kommen aus useKursplan() (lib/kursplan-context.tsx).
 */

import type { TrainingBlock } from "./types";

export const KURSPLAN_VORLAGE_TIDAL: TrainingBlock[] = [
  // ─── Montag (0) ───────────────────────────────────────────────────────────
  { id: "mon-01", weekday: 0, title: "Wing Tsung Kleine Helden", startTime: "16:15", endTime: "17:00", level: "kids", discipline: "wing-tsung" },
  { id: "mon-02", weekday: 0, title: "Wing Tsung Jugend", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "wing-tsung" },
  { id: "mon-03", weekday: 0, title: "Wing Tsung Adult", startTime: "18:30", endTime: "20:00", level: "adult", discipline: "wing-tsung" },
  { id: "mon-04", weekday: 0, title: "MMA Advanced (Grappling)", startTime: "20:15", endTime: "21:45", level: "advanced", category: "wrestling", discipline: "wrestling" },

  // ─── Dienstag (1) ─────────────────────────────────────────────────────────
  { id: "tue-01", weekday: 1, title: "Karate Mixed", startTime: "15:00", endTime: "17:00", level: "mixed", discipline: "karate" },
  { id: "tue-02", weekday: 1, title: "Kickboxen Teens", startTime: "17:15", endTime: "18:15", level: "teens", category: "boxing", discipline: "kickboxen" },
  { id: "tue-03", weekday: 1, title: "Kickboxen Adult", startTime: "18:30", endTime: "20:00", level: "adult", category: "boxing", discipline: "kickboxen" },
  { id: "tue-04", weekday: 1, title: "MMA (Ringen)", startTime: "20:15", endTime: "21:45", category: "wrestling", discipline: "wrestling" },

  // ─── Mittwoch (2) ─────────────────────────────────────────────────────────
  { id: "wed-01", weekday: 2, title: "MMA Teens", startTime: "16:00", endTime: "17:00", level: "teens", discipline: "mma" },
  { id: "wed-02", weekday: 2, title: "MMA Teens", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "mma" },
  { id: "wed-03", weekday: 2, title: "MMA Advanced (Sparring)", startTime: "18:30", endTime: "20:00", level: "advanced", discipline: "mma" },
  { id: "wed-04", weekday: 2, title: "MMA", startTime: "20:15", endTime: "21:45", discipline: "mma" },

  // ─── Donnerstag (3) ───────────────────────────────────────────────────────
  { id: "thu-01", weekday: 3, title: "MMA Mixed", startTime: "10:00", endTime: "11:30", level: "mixed", discipline: "mma" },
  { id: "thu-02", weekday: 3, title: "Muay Thai Teens", startTime: "16:00", endTime: "17:00", level: "teens", category: "muay-thai", discipline: "muay-thai" },
  { id: "thu-03", weekday: 3, title: "Wing Tsung Jugend", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "wing-tsung" },
  { id: "thu-04", weekday: 3, title: "(Fitness-)Kickboxen", startTime: "18:30", endTime: "20:00", category: "boxing", discipline: "fitness-kickboxen" },
  { id: "thu-05", weekday: 3, title: "Muay Thai Adult", startTime: "20:15", endTime: "21:45", level: "adult", category: "muay-thai", discipline: "muay-thai" },

  // ─── Freitag (4) ──────────────────────────────────────────────────────────
  { id: "fri-01", weekday: 4, title: "MMA Teens", startTime: "16:00", endTime: "17:00", level: "teens", discipline: "mma" },
  { id: "fri-02", weekday: 4, title: "MMA Teens", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "mma" },
  { id: "fri-03", weekday: 4, title: "MMA Advanced", startTime: "18:30", endTime: "20:00", level: "advanced", discipline: "mma" },
  { id: "fri-04", weekday: 4, title: "MMA", startTime: "20:15", endTime: "21:45", discipline: "mma" },

  // ─── Samstag (5) ──────────────────────────────────────────────────────────
  { id: "sat-01", weekday: 5, title: "MMA/Kickboxen Sparring", startTime: "10:00", endTime: "11:30", category: "boxing", discipline: "kickboxen" },
  { id: "sat-02", weekday: 5, title: "Karate Mixed", startTime: "18:00", endTime: "20:00", level: "mixed", discipline: "karate" },

  // ─── Sonntag (6) ──────────────────────────────────────────────────────────
  { id: "sun-01", weekday: 6, title: "Open Mat für Mitglieder", startTime: "10:00", endTime: "12:00" },
];
