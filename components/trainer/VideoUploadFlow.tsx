"use client";

/**
 * Der Upload-Fluss (Etappe 2 des Analyse-Umbaus, 16.09.2026): erst das
 * Video, dann der Vorlauf, dann die Zuordnung — und erst danach läuft je
 * zugeordnetem Kämpfer die teure Analyse.
 *
 * ─── DER ABLAUF, WIE LEON IHN FESTGELEGT HAT ────────────────────────────────
 *
 *   1. ABLAGE      Video ziehen, einfügen oder wählen — oder ein YouTube-
 *                  Link. Wen es betrifft, fragt hier niemand.
 *   2. VORLAUF     Gemini Flash über die ersten zwei Minuten in niedriger
 *                  Auflösung. Der Nutzer sieht davon NICHTS: Die gefundenen
 *                  Kämpfer werden zu Karten, Art und Kampfart zu einer
 *                  vorbelegten Zeile.
 *   3. ZUORDNEN    „Kämpfer zuordnen": je Kämpfer eine Karte mit Standbild
 *                  (Canvas aus der lokalen Datei an der besten Sekunde;
 *                  YouTube: Beschreibung + Sprung ins Video). Am Rand
 *                  „X Ignorieren" → Karte grau; ein Tipp auf die graue Karte
 *                  holt sie zurück, ohne Extra-Knopf. Tipp auf eine aktive
 *                  Karte → unscharf, zwei Felder „Athlet" / „Gegner" → Sheet
 *                  mit Liste und Suche. Wer auf Karte eins sitzt, ist auf
 *                  Karte zwei grau. Darunter DREI Angaben zum VIDEO: Zeitraum
 *                  (Pflicht, ohne Vorbelegung), Art (KI setzt, antippbar),
 *                  Kampfart (KI schlägt vor, antippbar) — Art und Kampfart in
 *                  EINER Zeile. „Analysieren" wird erst voll farbig, wenn
 *                  mindestens eine Karte zugeordnet UND der Zeitraum gewählt
 *                  ist; sonst sagt der Klick, was fehlt.
 *   4. ANALYSE     Je Zuordnung Beobachtung (Gemini) und Bewertung (Claude)
 *                  als eigene Requests (300-s-Budget), dann `commit`: Der
 *                  Server speichert und rechnet das Profil neu. Aus einem
 *                  Upload werden so bis zu zwei Auswertungen.
 *   5. FERTIG      Je Person eine Zeile mit dem Weg ins Ergebnis.
 *
 * DIE KAMPFART GEHÖRT ZUM VIDEO, NICHT ZUR PERSON (Leons Einwand 16.09.):
 * Wer im Video MMA kämpft, hat MMA gekämpft, egal was sein Profil sagt. Sie
 * wird deshalb einmal je Upload festgelegt und gilt für beide Karten. Der
 * Vorschlag hält die zuletzt gewählte Kampfart des Trainers, solange das
 * Gesehene hineinpasst (`vorschlagSport`).
 *
 * DER ZWISCHENSTAND trägt kein Ziel mehr im Schlüssel
 * (`ta-video-analysis-form:upload:{uploadId}`, lib/deepfight-zwischenstand.ts):
 * Upload, Vorlauf, Zuordnungen, Angaben und fertige Beobachtungen überleben
 * einen Abbruch; jede geschaffte Stufe bleibt geschafft. Die „schon
 * geladen"-Marke ist ein STATE mit Schlüssel, kein Ref (CLAUDE.md, „Der
 * gespeicherte Formularzustand — eine Falle").
 *
 * OHNE AUSSENRAHMEN (Leon 16.09. abends: „alleine hier schon wieder drei
 * Boxen"): Der Fluss steht direkt auf der Seite. Glas tragen nur noch die
 * Kämpfer-Karten und die rechte Spalte mit den Fragen zum Video. Nebenbei
 * heilt das einen Fehler: Die Außenkarte hatte im Bereich `backdrop-filter`
 * und wurde damit zum Bezugsrahmen für ALLES mit `position: fixed` — die
 * Vollbild-Ladeanzeige und das Personen-Sheet klebten an der Karte statt am
 * Fenster. Die Ladeanzeige geht zusätzlich per Portal an den `body`.
 *
 * DIE STANDBILDER ÜBERLEBEN DEN ABBRUCH: Sie entstehen aus der lokalen Datei,
 * und die ist nach dem Verlassen der Seite weg. Deshalb liegen sie als JPEG
 * unter einem eigenen Schlüssel (`ta-deepfight-standbilder:{uploadId}`) —
 * getrennt vom Zwischenstand, damit ein voller Speicher nie den Stand selbst
 * kostet.
 *
 * DER RAHMEN UM DEN KÄMPFER: Der Vorlauf liefert je Kämpfer einen Rahmen in
 * seiner besten Sekunde; die Karte zeigt nur den Ausschnitt darum, und der
 * Trainer kann ihn im Popup neu ziehen. Der Rahmen geht als Ortsangabe in die
 * Beschreibung der Beobachtung (`positionsSatz`) — so findet die KI genau
 * diese Person wieder.
 */

import { createPortal } from "react-dom";
import { Collapse, SheetShell, StaggerFlow, FlowItem, useMotionCapability } from "@/components/motion";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import RainbowButton from "@/components/ui/RainbowButton";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { nameVon, sichtbareMitglieder } from "@/lib/deepfight-analysen";
import { zwischenstandKey } from "@/lib/deepfight-zwischenstand";
import { FIGHTER_STANCE_LABEL, FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { getFightProfile } from "@/lib/fight-profile";
import type { ActionStat, DnaSplit } from "@/lib/fight-stats";
import { resolveGymId } from "@/lib/gym";
import { getOpponent, listOpponentsForGym, type Opponent } from "@/lib/opponents";
import { useAnalysisProgress } from "@/lib/use-analysis-progress";
import { useWakeLock } from "@/lib/use-wake-lock";
import {
  CORNER_LABEL,
  FIGHT_RECENCY_LABEL,
  MAX_VIDEO_SECONDS,
  SPORT_LABEL,
  SPORT_ORDER,
  VIDEO_TYPE_LABEL,
  commitVideoAnalysis,
  deleteUploadedFile,
  isSport,
  isUploadStillActive,
  locateFightersInStill,
  readVideoDuration,
  runVideoAnalysis,
  runVideoObservation,
  runVideoPreview,
  uploadVideoFile,
  vorschlagSport,
  type CornerColor,
  type FightRecency,
  type FighterBox,
  type Sport,
  type VideoObservation,
  type VideoPreview,
  type VideoSource,
  type VideoType,
} from "@/lib/video-analysis";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Schnitte und Flächen, wie sie im ganzen DeepFight-Bereich stehen ───────

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const FLAECHE: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
};
const inputStyle: React.CSSProperties = {
  ...FLAECHE,
  color: "var(--text-body)",
  font: "var(--type-sub)",
};

// ─── Datenformen ─────────────────────────────────────────────────────────────

/** Wer auf einer Karte sitzt. */
interface Person {
  kind: "leute" | "gegner";
  id: string;
  name: string;
}

/** Eine Karte: ein Kämpfer aus dem Vorlauf plus das, was der Trainer dazu sagt. */
interface Zuordnung {
  person: Person | null;
  ignoriert: boolean;
  corner: CornerColor;
  clothing: string;
  features: string;
  description: string;
  bestSecond: number | null;
  /** Rahmen um den Kämpfer im Standbild — von der KI, oder von Hand gezogen. */
  box: FighterBox | null;
}

/** Ein Standbild samt Maßen — die Maße braucht der Ausschnitt der Karte. */
interface Standbild {
  src: string;
  w: number;
  h: number;
}

/** Erfolgreicher Upload, der bei Fehlversuchen wiederverwendet wird (48 h gültig). */
interface PendingUpload {
  name: string;
  fileUri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number | null;
}

/** Fertige Gemini-Beobachtung EINER Karte aus einem früheren Versuch. */
interface PendingObservation {
  observation: VideoObservation;
  model: string;
  fingerprint: string;
}

/** Was im localStorage liegt. */
interface Gespeichert {
  sourceKind: "upload" | "youtube";
  youtubeUrl: string;
  ytStart: string;
  ytEnd: string;
  pendingUpload: PendingUpload | null;
  preview: VideoPreview | null;
  zuordnungen: Zuordnung[];
  recency: FightRecency | "";
  videoType: VideoType | null;
  sport: Sport | null;
  beobachtungen: Record<string, PendingObservation>;
  pendingSavedAt: number | null;
}

/** Eine fertige Auswertung — die Zeile im Ergebnis. */
interface Ergebnis {
  person: Person;
  analysisId: string;
  strength: number | null;
}

type Stage = "idle" | "upload" | "vorlauf" | "gemini" | "claude" | "save";
type Phase = Exclude<Stage, "idle">;

const PHASE_SHARE: Record<Phase, number> = { upload: 55, vorlauf: 45, gemini: 60, claude: 35, save: 5 };
const PHASE_TAU: Record<Phase, number> = { upload: 45, vorlauf: 20, gemini: 75, claude: 30, save: 3 };

const PENDING_GUELTIG_MS = 48 * 60 * 60 * 1000;
/** Zuletzt gewählte Kampfart des Trainers — der Vorschlag beim nächsten Video. */
const SPORT_MERKER = "ta-deepfight-sport";
/** Die Standbilder eines Laufs — eigener Schlüssel neben dem Zwischenstand. */
const STANDBILD_PRAEFIX = "ta-deepfight-standbilder:";
const standbildKey = (uploadId: string) => `${STANDBILD_PRAEFIX}${uploadId}`;
/** Seitenverhältnis des Bildes auf der Karte (Breite / Höhe). */
const KARTE_FORMAT = 1;

function neueId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** "mm:ss" oder Sekunden-Zahl → Sekunden (null bei leerem/ungültigem Input). */
function parseTimecode(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const mmss = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function restzeitText(savedAt: number | null): string | null {
  if (!savedAt) return null;
  const rest = savedAt + PENDING_GUELTIG_MS - Date.now();
  if (rest <= 0) return null;
  const stunden = Math.floor(rest / 3_600_000);
  if (stunden >= 1) return `Noch ${stunden} ${stunden === 1 ? "Stunde" : "Stunden"} verfügbar`;
  const minuten = Math.max(1, Math.round(rest / 60_000));
  return `Noch ${minuten} ${minuten === 1 ? "Minute" : "Minuten"} verfügbar`;
}

/** YouTube-Link mit Sprung zur Sekunde. */
function youtubeAb(url: string, sekunde: number | null): string {
  if (sekunde == null) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${sekunde}s`;
}

/**
 * Der Ausschnitt, den die Karte zeigt: der Rahmen mit etwas Luft, auf das
 * Kartenformat erweitert und ins Bild geschoben. Ohne Rahmen die Bildmitte.
 * Alles normiert auf 0–1.
 */
function ausschnitt(box: FighterBox | null, bild: Standbild, format = KARTE_FORMAT): FighterBox {
  const W = bild.w || 1;
  const H = bild.h || 1;
  let cw: number;
  let ch: number;
  let mx: number;
  let my: number;
  if (box) {
    // Der Körper füllt fast die ganze Kartenhöhe — so wenig Umfeld wie möglich.
    ch = (box.h * H) / 0.9;
    cw = (box.w * W) / 0.8;
    mx = (box.x + box.w / 2) * W;
    my = (box.y + box.h / 2) * H;
  } else {
    ch = H;
    cw = W;
    mx = W / 2;
    my = H / 2;
  }
  if (cw / ch < format) cw = ch * format;
  else ch = cw / format;
  const passt = Math.min(1, W / cw, H / ch);
  cw *= passt;
  ch *= passt;
  const x = Math.min(Math.max(mx - cw / 2, 0), W - cw);
  const y = Math.min(Math.max(my - ch / 2, 0), H - ch);
  return { x: x / W, y: y / H, w: cw / W, h: ch / H };
}

/** Der Rahmen als Satz für die Beobachtung — die KI liest Text, keine Pixel. */
function positionsSatz(z: Zuordnung): string {
  if (!z.box || z.bestSecond == null) return "";
  const p = (v: number) => Math.round(v * 100);
  return `Erkennungshilfe: In Sekunde ${z.bestSecond} steht diese Person im Bereich ${p(z.box.x)}–${p(z.box.x + z.box.w)} % der Bildbreite (von links) und ${p(z.box.y)}–${p(z.box.y + z.box.h)} % der Bildhöhe (von oben).`;
}

/**
 * Zieht ein Standbild aus der lokalen Datei — der Browser kann das ohne
 * Server. Breite gedeckelt: groß genug für den Ausschnitt, klein genug für
 * den localStorage.
 */
function standbild(file: File, sekunde: number): Promise<Standbild | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const fertig = (bild: Standbild | null) => {
      URL.revokeObjectURL(url);
      resolve(bild);
    };
    video.onloadedmetadata = () => {
      const ziel = Math.min(sekunde, Math.max(0, (video.duration || sekunde) - 0.1));
      video.currentTime = ziel;
    };
    video.onseeked = () => {
      try {
        const breite = Math.min(960, video.videoWidth || 960);
        const hoehe = Math.round(breite * ((video.videoHeight || 540) / (video.videoWidth || 960)));
        const canvas = document.createElement("canvas");
        canvas.width = breite;
        canvas.height = hoehe;
        canvas.getContext("2d")?.drawImage(video, 0, 0, breite, hoehe);
        fertig({ src: canvas.toDataURL("image/jpeg", 0.78), w: breite, h: hoehe });
      } catch {
        fertig(null);
      }
    };
    video.onerror = () => fertig(null);
    video.src = url;
  });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="t-label">{label}</span>
      {children}
      {hint && (
        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>{hint}</span>
      )}
    </label>
  );
}

/**
 * Beschreibungsfeld, das beim Antippen aufgeht (Leon 16.09.): ruhig eine
 * Zeile, im Fokus so hoch wie der Text (mindestens gut vier Zeilen), ein Tipp
 * daneben klappt es wieder zu. Gespeichert wird bei jedem Tastendruck über
 * den Zwischenstand — einen Speichern-Knopf gibt es nicht.
 */
function WachsendesFeld({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [offen, setOffen] = useState(false);
  const [hoehe, setHoehe] = useState(ZU_HOEHE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!offen) {
      el.scrollTop = 0;
      setHoehe(ZU_HOEHE);
      return;
    }
    // scrollHeight misst den Inhalt unabhängig von der gesetzten Höhe.
    setHoehe(Math.max(AUF_HOEHE, el.scrollHeight + 2));
  }, [offen, value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setOffen(true)}
      onBlur={() => setOffen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") e.currentTarget.blur();
      }}
      placeholder={placeholder}
      className="w-full resize-none rounded-field px-3 py-[11px]"
      style={{
        ...inputStyle,
        lineHeight: "20px",
        height: hoehe,
        overflow: offen ? "auto" : "hidden",
        whiteSpace: offen ? "pre-wrap" : "nowrap",
        textOverflow: "ellipsis",
        borderColor: offen ? "var(--accent)" : undefined,
        transition: "height var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
      }}
    />
  );
}
const ZU_HOEHE = 44;
const AUF_HOEHE = 124;

function Erledigt({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
    >
      <span style={{ color: "var(--positive)", lineHeight: 0 }}>
        <Icon name="check" size={13} strokeWidth={2.6} />
      </span>
      {text}
    </span>
  );
}

// ─── Der Fluss ──────────────────────────────────────────────────────────────

export default function VideoUploadFlow({
  uploadId: uploadIdProp = null,
}: {
  /** Ein gemerkter Zwischenstand (`?upload=`), sonst ein neuer Lauf. */
  uploadId?: string | null;
}) {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";
  const router = useRouter();
  const { canBlur } = useMotionCapability();

  // Die ID lebt im State, nicht im Prop: Ein neuer Lauf tauscht sie aus,
  // ohne die Komponente neu zu mounten — sonst ginge die lokale Datei (und
  // mit ihr die Standbilder) beim ersten Speichern der Adresse verloren.
  const [uploadId, setUploadId] = useState(() => uploadIdProp ?? neueId());
  const storageKey = zwischenstandKey(uploadId);

  // ── Quelle ────────────────────────────────────────────────────────────────
  const [sourceKind, setSourceKind] = useState<"upload" | "youtube">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytStart, setYtStart] = useState("");
  const [ytEnd, setYtEnd] = useState("");
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [pendingSavedAt, setPendingSavedAt] = useState<number | null>(null);
  const [ueberAblage, setUeberAblage] = useState(false);
  const ablageTiefe = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Vorlauf und Zuordnung ─────────────────────────────────────────────────
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [zuordnungen, setZuordnungen] = useState<Zuordnung[]>([]);
  const [bilder, setBilder] = useState<Record<number, Standbild>>({});
  const [recency, setRecency] = useState<FightRecency | "">("");
  const [videoType, setVideoType] = useState<VideoType | null>(null);
  const [sport, setSport] = useState<Sport | null>(null);
  const [beobachtungen, setBeobachtungen] = useState<Record<string, PendingObservation>>({});
  /** Welche Karte gerade „Athlet / Gegner" zeigt. */
  const [wahl, setWahl] = useState<number | null>(null);
  /** Welches Sheet offen ist — für welche Karte, welche Liste. */
  const [sheet, setSheet] = useState<{ karte: number; kind: "leute" | "gegner" } | null>(null);
  const [suche, setSuche] = useState("");
  const [beschreibungOffen, setBeschreibungOffen] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  /** Für welche Karte das Rahmen-Popup offen ist, und der Rahmen darin. */
  const [rahmenKarte, setRahmenKarte] = useState<number | null>(null);
  const [entwurf, setEntwurf] = useState<FighterBox | null>(null);
  const zeichenStart = useRef<{ x: number; y: number; vorher: FighterBox | null } | null>(null);
  const nachwahlRef = useRef<HTMLInputElement>(null);

  // ── Listen für die Sheets ─────────────────────────────────────────────────
  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>("idle");
  const [stageDetail, setStageDetail] = useState<string | null>(null);
  const [laufKarte, setLaufKarte] = useState<{ i: number; n: number; name: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[] | null>(null);
  const progress = useAnalysisProgress<Phase>(stage !== "idle", PHASE_SHARE, PHASE_TAU);
  useWakeLock(stage !== "idle");

  // ─── Persistenz: State ↔ localStorage ────────────────────────────────────
  const [hydriertFuer, setHydriertFuer] = useState<string | null>(null);
  const hydriert = hydriertFuer === storageKey;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Gespeichert>;
        if (s.sourceKind) setSourceKind(s.sourceKind);
        if (s.youtubeUrl) setYoutubeUrl(s.youtubeUrl);
        if (s.ytStart) setYtStart(s.ytStart);
        if (s.ytEnd) setYtEnd(s.ytEnd);
        if (s.pendingUpload?.name) setPendingUpload(s.pendingUpload);
        if (s.preview) setPreview(s.preview);
        if (Array.isArray(s.zuordnungen)) setZuordnungen(s.zuordnungen);
        if (s.recency) setRecency(s.recency);
        if (s.videoType) setVideoType(s.videoType);
        if (isSport(s.sport)) setSport(s.sport);
        if (s.beobachtungen) setBeobachtungen(s.beobachtungen);
        if (typeof s.pendingSavedAt === "number") setPendingSavedAt(s.pendingSavedAt);
      }
      const bilderRoh = localStorage.getItem(standbildKey(uploadId));
      if (bilderRoh) setBilder(JSON.parse(bilderRoh) as Record<number, Standbild>);
    } catch {
      /* defekter Eintrag → ignorieren */
    }
    // Standbilder ohne Zwischenstand sind Reste eines beendeten Laufs.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k?.startsWith(STANDBILD_PRAEFIX) || k === standbildKey(uploadId)) continue;
        if (!localStorage.getItem(zwischenstandKey(k.slice(STANDBILD_PRAEFIX.length)))) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      /* optional */
    }
    setHydriertFuer(storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const hatZwischenstand = !!pendingUpload || !!preview;
  useEffect(() => {
    if (!hydriert || !hatZwischenstand) return; // nichts Leeres in den Speicher
    try {
      const s: Gespeichert = {
        sourceKind,
        youtubeUrl,
        ytStart,
        ytEnd,
        pendingUpload,
        preview,
        zuordnungen,
        recency,
        videoType,
        sport,
        beobachtungen,
        pendingSavedAt,
      };
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      /* Speicher voll/blockiert → Feature ist optional */
    }
  }, [
    hydriert,
    hatZwischenstand,
    storageKey,
    sourceKind,
    youtubeUrl,
    ytStart,
    ytEnd,
    pendingUpload,
    preview,
    zuordnungen,
    recency,
    videoType,
    sport,
    beobachtungen,
    pendingSavedAt,
  ]);

  // Die Standbilder getrennt — ein voller Speicher kostet höchstens sie.
  useEffect(() => {
    if (!hydriert || Object.keys(bilder).length === 0) return;
    try {
      localStorage.setItem(standbildKey(uploadId), JSON.stringify(bilder));
    } catch {
      /* Speicher voll → die Bilder entstehen neu, sobald die Datei wieder da ist */
    }
  }, [hydriert, bilder, uploadId]);

  // Die Adresse trägt den Lauf, sobald er etwas wert ist — so kommt die
  // Landung („Analysen in Arbeit") und ein Neuladen wieder hierher.
  useEffect(() => {
    if (!hatZwischenstand || uploadIdProp === uploadId) return;
    router.replace(`/trainer/deepfight/analyse?upload=${uploadId}`);
  }, [hatZwischenstand, uploadIdProp, uploadId, router]);

  // ─── Listen ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    Promise.all([
      listAllMembers(gymId).catch(() => [] as StudentEntry[]),
      listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
    ]).then(([m, o]) => {
      if (!alive) return;
      setMembers(m);
      setOpponents(o);
    });
    return () => {
      alive = false;
    };
  }, [gymId]);

  const sichtbar = useMemo(
    () => (members ? sichtbareMitglieder(members, eigeneUid, gymId) : null),
    [members, eigeneUid, gymId],
  );

  // ─── Standbilder nachziehen: nach einem Abbruch ohne gespeicherte Bilder ───
  // Der normale Weg zieht sie in `handleWeiter`. Hier nur, wenn der Trainer
  // die Datei nachwählt und keine Bilder da sind — die Rahmen stehen dann
  // schon im Zwischenstand.
  const hatBilder = Object.keys(bilder).length > 0;
  useEffect(() => {
    if (!preview || !file || hatBilder) return;
    let alive = true;
    (async () => {
      const out: Record<number, Standbild> = {};
      for (let i = 0; i < preview.fighters.length; i++) {
        const sek = preview.fighters[i].bestSecond;
        if (sek == null) continue;
        const bild = await standbild(file, sek);
        if (bild) out[i] = bild;
      }
      if (alive && Object.keys(out).length > 0) setBilder(out);
    })();
    return () => {
      alive = false;
    };
  }, [preview, file, hatBilder]);

  // ─── Ablage: ziehen, einfügen, wählen ────────────────────────────────────
  const nimmDatei = useCallback((f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setRunError(`„${f.name}" ist kein Video. Nimm eine Videodatei, zum Beispiel MP4 oder MOV.`);
      return;
    }
    setSourceKind("upload");
    setFile(f);
    setRunError(null);
  }, []);

  const istYoutube = (t: string) => /(?:youtube\.com|youtu\.be)\//i.test(t);

  useEffect(() => {
    if (preview || stage !== "idle") return;
    function onPaste(e: ClipboardEvent) {
      const ziel = e.target as HTMLElement | null;
      if (
        ziel &&
        (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable)
      ) {
        return;
      }
      const datei = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("video/"),
      );
      if (datei) {
        e.preventDefault();
        nimmDatei(datei);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      if (istYoutube(text)) {
        e.preventDefault();
        setSourceKind("youtube");
        setYoutubeUrl(text);
        setRunError(null);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [preview, stage, nimmDatei]);

  function ablageEnter(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    ablageTiefe.current += 1;
    setUeberAblage(true);
  }
  function ablageLeave() {
    ablageTiefe.current = Math.max(0, ablageTiefe.current - 1);
    if (ablageTiefe.current === 0) setUeberAblage(false);
  }
  function ablageDrop(e: React.DragEvent) {
    e.preventDefault();
    ablageTiefe.current = 0;
    setUeberAblage(false);
    nimmDatei(e.dataTransfer.files?.[0]);
  }

  /** Alles wegwerfen und mit einem neuen Video anfangen — ohne Neumounten. */
  function verwerfen() {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(standbildKey(uploadId));
    } catch {
      /* optional */
    }
    setSourceKind("upload");
    setFile(null);
    setYoutubeUrl("");
    setYtStart("");
    setYtEnd("");
    setPendingUpload(null);
    setPendingSavedAt(null);
    setPreview(null);
    setZuordnungen([]);
    setBilder({});
    setRecency("");
    setVideoType(null);
    setSport(null);
    setBeobachtungen({});
    setWahl(null);
    setSheet(null);
    setRahmenKarte(null);
    setErgebnisse(null);
    setRunError(null);
    setHinweis(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadId(neueId());
    router.replace("/trainer/deepfight/analyse");
  }

  // ─── Schritt 1 → 2: Upload und Vorlauf ───────────────────────────────────

  async function quelleBereitstellen(): Promise<VideoSource> {
    if (sourceKind === "upload") {
      const matchesSelected =
        !!file && !!pendingUpload && pendingUpload.fileName === file.name && pendingUpload.fileSize === file.size;
      let reuse: PendingUpload | null = null;
      if (pendingUpload && (!file || matchesSelected)) {
        setStage("upload");
        progress.enter("upload");
        setStageDetail("Hochgeladenes Video prüfen …");
        if (await isUploadStillActive(pendingUpload.name)) {
          reuse = pendingUpload;
          progress.report(1);
        } else {
          setPendingUpload(null);
        }
        setStageDetail(null);
      }
      if (reuse) {
        return {
          kind: "upload",
          fileUri: reuse.fileUri,
          mimeType: reuse.mimeType,
          fileName: reuse.fileName,
          durationSeconds: reuse.durationSeconds,
        };
      }
      if (!file) {
        throw new Error(
          pendingUpload
            ? "Dein hochgeladenes Video ist abgelaufen. Wähl die Datei noch einmal aus."
            : "Wähl zuerst ein Video aus.",
        );
      }
      const duration = await readVideoDuration(file);
      if (duration != null && duration > MAX_VIDEO_SECONDS + 5) {
        throw new Error(
          `Dein Video dauert ${Math.round(duration / 60)} Minuten. Nimm einen Ausschnitt bis 15 Minuten.`,
        );
      }
      setStage("upload");
      progress.enter("upload");
      const uploaded = await uploadVideoFile(file, (msg, fraction) => {
        setStageDetail(msg);
        if (fraction != null) progress.report(fraction);
      });
      setStageDetail(null);
      setPendingUpload({
        name: uploaded.name,
        fileUri: uploaded.fileUri,
        mimeType: uploaded.mimeType,
        fileName: file.name,
        fileSize: file.size,
        durationSeconds: duration,
      });
      setPendingSavedAt(Date.now());
      return {
        kind: "upload",
        fileUri: uploaded.fileUri,
        mimeType: uploaded.mimeType,
        fileName: file.name,
        durationSeconds: duration,
      };
    }
    if (!youtubeUrl.trim()) throw new Error("Füg zuerst einen YouTube-Link ein.");
    const startSeconds = parseTimecode(ytStart);
    const endSeconds = parseTimecode(ytEnd);
    if (startSeconds != null && endSeconds != null && endSeconds - startSeconds > MAX_VIDEO_SECONDS) {
      throw new Error("Wähl einen Ausschnitt bis 15 Minuten.");
    }
    return { kind: "youtube", url: youtubeUrl.trim(), startSeconds, endSeconds };
  }

  async function handleWeiter() {
    setRunError(null);
    progress.reset();
    progress.begin(sourceKind === "upload" && !pendingUpload ? ["upload", "vorlauf"] : ["vorlauf"]);
    try {
      const source = await quelleBereitstellen();
      setStage("vorlauf");
      progress.enter("vorlauf");
      // Derselbe Auto-Neustart wie bei der Analyse: „überlastet" ist wiederholbar.
      let vorlauf: VideoPreview | null = null;
      for (let attempt = 1; attempt <= 3 && !vorlauf; attempt++) {
        try {
          vorlauf = await runVideoPreview(source);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.includes("überlastet") || attempt >= 3) throw err;
          for (let s = 15; s > 0; s--) {
            setStageDetail(`Gerade viel los · neuer Versuch in ${s} s`);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
      if (!vorlauf) throw new Error("Die Kämpfersuche kam leer zurück. Versuch es noch einmal.");
      if (sourceKind === "youtube") setPendingSavedAt(Date.now());

      // Ohne gefundenen Kämpfer trotzdem eine Karte — der Trainer beschreibt
      // ihn dann selbst (zugeklappter Rückfall).
      // Fehlt einem Kämpfer die Sekunde (gesehen 16.09., Gemini ist nicht
      // jedes Mal gleich), nimmt er die des anderen — im Sparring stehen
      // beide im selben Bild, und die Rahmen-Suche kennt beide Beschreibungen.
      const ersteSekunde = vorlauf.fighters.find((f) => f.bestSecond != null)?.bestSecond ?? null;
      const kaempfer = vorlauf.fighters.length
        ? vorlauf.fighters.map((f) => ({ ...f, bestSecond: f.bestSecond ?? ersteSekunde }))
        : [{ corner: "unknown" as const, clothing: "", features: "", description: "", bestSecond: null }];

      // Standbilder ziehen und die Kämpfer DARAUF eingrenzen — noch unter der
      // Ladeanzeige, damit die Karten gleich richtig sitzen. Je Sekunde ein
      // Bild und ein Aufruf; alle Beschreibungen gehen mit, damit die KI die
      // zwei auseinanderhält. Klappt es nicht, bleibt die Karte ohne Rahmen.
      const neueBilder: Record<number, Standbild> = {};
      const boxen: (FighterBox | null)[] = kaempfer.map(() => null);
      if (sourceKind === "upload" && file) {
        const beschreibungen = kaempfer.map((f) => ({
          description: f.description,
          clothing: f.clothing,
          features: f.features,
        }));
        const sekunden = Array.from(
          new Set(kaempfer.map((f) => f.bestSecond).filter((sek): sek is number => sek != null)),
        );
        for (const sek of sekunden) {
          const bild = await standbild(file, sek);
          if (!bild) continue;
          const hier = kaempfer.map((f, i) => (f.bestSecond === sek ? i : -1)).filter((i) => i >= 0);
          hier.forEach((i) => {
            neueBilder[i] = bild;
          });
          try {
            const gefunden = await locateFightersInStill(bild.src, beschreibungen);
            hier.forEach((i) => {
              boxen[i] = gefunden[i] ?? null;
            });
          } catch {
            /* ohne Rahmen weiter — der Trainer kann ihn selbst ziehen */
          }
        }
      }
      setBilder(neueBilder);
      setZuordnungen(
        kaempfer.map((f, i) => ({
          person: null,
          ignoriert: false,
          corner: f.corner,
          clothing: f.clothing,
          features: f.features,
          description: f.description,
          bestSecond: f.bestSecond,
          box: boxen[i],
        })),
      );
      setVideoType(vorlauf.videoType);
      let zuletzt: Sport | null = null;
      try {
        const roh = localStorage.getItem(SPORT_MERKER);
        zuletzt = isSport(roh) ? roh : null;
      } catch {
        /* optional */
      }
      setSport(vorschlagSport(vorlauf.sport, zuletzt));
      setPreview(vorlauf);
      progress.complete();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Die Kämpfersuche hat nicht geklappt. Versuch es noch einmal.");
    } finally {
      setStage("idle");
      setStageDetail(null);
    }
  }

  // ─── Schritt 3: Zuordnen ──────────────────────────────────────────────────

  function setzeKarte(i: number, patch: Partial<Zuordnung>) {
    setZuordnungen((prev) => prev.map((z, k) => (k === i ? { ...z, ...patch } : z)));
  }

  /** Klick auf die Karte: grau → wieder aktiv; aktiv → „Athlet / Gegner". */
  function karteTipp(i: number) {
    const z = zuordnungen[i];
    if (!z) return;
    if (z.ignoriert) {
      setzeKarte(i, { ignoriert: false });
      return;
    }
    setWahl((w) => (w === i ? null : i));
  }

  function ignorieren(i: number) {
    setzeKarte(i, { ignoriert: true, person: null });
    if (wahl === i) setWahl(null);
  }

  // ── Rahmen ziehen ─────────────────────────────────────────────────────────
  function rahmenOeffnen(i: number) {
    setWahl(null);
    setEntwurf(zuordnungen[i]?.box ?? null);
    setRahmenKarte(i);
  }
  function punktIm(e: React.PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1))),
    };
  }
  function zeichnenBeginnt(e: React.PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = punktIm(e);
    zeichenStart.current = { ...p, vorher: entwurf };
    setEntwurf({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function zeichnenZieht(e: React.PointerEvent<HTMLElement>) {
    const s = zeichenStart.current;
    if (!s) return;
    const p = punktIm(e);
    setEntwurf({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }
  function zeichnenEndet() {
    const s = zeichenStart.current;
    zeichenStart.current = null;
    // Ein Tipp ohne Ziehen ist kein Rahmen — der vorige bleibt.
    setEntwurf((b) => (b && b.w > 0.02 && b.h > 0.03 ? b : (s?.vorher ?? null)));
  }
  function rahmenUebernehmen() {
    if (rahmenKarte === null) return;
    setzeKarte(rahmenKarte, { box: entwurf });
    setRahmenKarte(null);
  }

  /** Nach einem Abbruch: dieselbe Datei noch einmal wählen → die Standbilder kommen zurück. */
  function dateiNachwaehlen(f: File | null | undefined) {
    if (!f) return;
    if (pendingUpload && (f.name !== pendingUpload.fileName || f.size !== pendingUpload.fileSize)) {
      setHinweis(`Das ist ein anderes Video. Wähl „${pendingUpload.fileName}".`);
      return;
    }
    setHinweis(null);
    setFile(f);
  }

  useEffect(() => {
    if (wahl === null) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWahl(null);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [wahl]);

  /** Wer schon auf einer ANDEREN Karte sitzt — dort grau und nicht wählbar. */
  const vergeben = useMemo(() => {
    const m = new Map<string, number>();
    zuordnungen.forEach((z, i) => {
      if (z.person && !z.ignoriert) m.set(`${z.person.kind}:${z.person.id}`, i);
    });
    return m;
  }, [zuordnungen]);

  function waehlePerson(p: Person) {
    if (!sheet) return;
    setzeKarte(sheet.karte, { person: p, ignoriert: false });
    setSheet(null);
    setWahl(null);
    setHinweis(null);
  }

  const aktiveZuordnungen = zuordnungen
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => !z.ignoriert && !!z.person);
  const bereit = aktiveZuordnungen.length > 0 && recency !== "";

  // ─── Schritt 4: Analyse je Zuordnung ─────────────────────────────────────

  async function handleAnalysieren() {
    if (aktiveZuordnungen.length === 0) {
      setHinweis("Wähl mindestens eine Person zur Auswertung aus.");
      return;
    }
    if (recency === "") {
      setHinweis("Wähl noch, wann das Video entstanden ist.");
      return;
    }
    if (!preview) return;
    setHinweis(null);
    setRunError(null);
    setWahl(null);

    const artFinal: VideoType = videoType ?? preview.videoType;
    const sportFinal: Sport = sport ?? vorschlagSport(preview.sport, null);
    const zeitraum: FightRecency = recency;

    try {
      const source = await quelleBereitstellen();
      const fileFingerprint =
        source.kind === "upload"
          ? `file:${source.fileName}|${file?.size ?? pendingUpload?.fileSize ?? 0}|${source.durationSeconds ?? ""}`
          : `yt:${source.url}|${source.startSeconds ?? ""}|${source.endSeconds ?? ""}`;
      const srcKey =
        source.kind === "upload" ? source.fileUri : `${source.url}|${source.startSeconds}|${source.endSeconds}`;

      const fertig: Ergebnis[] = [...(ergebnisse ?? [])];
      const n = aktiveZuordnungen.length;
      for (let k = 0; k < n; k++) {
        const { z, i } = aktiveZuordnungen[k];
        const person = z.person!;
        // Schon fertig (Abbruch nach der ersten Karte)? Dann nicht doppelt.
        if (fertig.some((e) => e.person.kind === person.kind && e.person.id === person.id)) continue;
        setLaufKarte({ i: k + 1, n, name: person.name });
        progress.reset();
        progress.begin(["gemini", "claude", "save"]);

        const mode = person.kind === "gegner" ? "opponent" : "athlete";
        const fighter = {
          name: person.name,
          corner: z.corner,
          clothing: z.clothing.trim(),
          features: z.features.trim(),
          startPosition: [z.description.trim(), positionsSatz(z)].filter(Boolean).join(" "),
        };

        // Bestand des Ziels als Kontext für die Bewertung (Bestätigungen,
        // Widersprüche) — frisch gelesen, nicht aus einem Prop.
        let existingDna: Record<string, string> = {};
        let existingSplit: DnaSplit | null = null;
        let existingStats: ActionStat[] = [];
        let profileContext = `Eigener Athlet des Gyms: ${person.name}`;
        if (mode === "opponent") {
          const o = await getOpponent(person.id);
          if (o) {
            existingDna = o.dna;
            existingSplit = o.dnaSplit ?? null;
            existingStats = o.actionStats ?? [];
            const parts = [`Stil: ${FIGHT_STYLE_LABEL[o.style]}`, `Auslage: ${FIGHTER_STANCE_LABEL[o.stance]}`];
            if (o.heightCm) parts.push(`Größe: ${o.heightCm} cm`);
            if (o.reachCm) parts.push(`Reichweite: ${o.reachCm} cm`);
            if (o.strengths.length) parts.push(`Bekannte Stärken: ${o.strengths.join(", ")}`);
            if (o.weaknesses.length) parts.push(`Bekannte Schwächen: ${o.weaknesses.join(", ")}`);
            if (o.notes) parts.push(`Notizen: ${o.notes}`);
            profileContext = parts.join(" · ");
          }
        } else {
          const p = await getFightProfile(person.id);
          existingDna = p.dna;
          existingSplit = p.dnaSplit;
          existingStats = p.actionStats;
        }

        const fingerprint = JSON.stringify({ mode, fighter, src: srcKey });
        const merkKey = String(i);
        let cachedObs: PendingObservation | null =
          beobachtungen[merkKey]?.fingerprint === fingerprint ? beobachtungen[merkKey] : null;

        const baseRequest = {
          mode: mode as "opponent" | "athlete",
          source,
          fighter,
          tier: "flash" as const,
          existingDna,
          existingSplit,
          existingStats,
          profileContext,
          recency: zeitraum,
          // Die Datei bleibt bei Google, bis die LETZTE Person durch ist —
          // sonst fände die zweite Beobachtung sie nicht mehr (Gemini 403).
          keepFile: true,
        };
        const MAX_ATTEMPTS = 3;
        let result: Awaited<ReturnType<typeof runVideoAnalysis>> | null = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            if (!cachedObs) {
              setStage("gemini");
              progress.enter("gemini");
              const observed = await runVideoObservation(baseRequest);
              cachedObs = { observation: observed.observation, model: observed.model, fingerprint };
              const merk = cachedObs;
              setBeobachtungen((prev) => ({ ...prev, [merkKey]: merk }));
            }
            setStage("claude");
            progress.enter("claude");
            result = await runVideoAnalysis(
              { ...baseRequest, observation: cachedObs.observation, observationModel: cachedObs.model },
              (s) => {
                if (s === "claude") setStage(s);
              },
              undefined,
              (fraction) => progress.report(fraction),
            );
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            const retryable = msg.includes("überlastet") || msg.includes("kein Ergebnis");
            if (!retryable) throw err;
            if (attempt >= MAX_ATTEMPTS) {
              throw new Error(
                "Beim KI-Dienst ist gerade zu viel los, drei Versuche sind durchgelaufen. Tipp in ein paar Minuten noch einmal auf Analysieren. Dein Upload und deine Zuordnung bleiben gespeichert.",
              );
            }
            for (let s = 20; s > 0; s--) {
              setStageDetail(
                `DeepFight ist gerade stark ausgelastet · Versuch ${attempt + 1} von ${MAX_ATTEMPTS} in ${s} s`,
              );
              await new Promise((r) => setTimeout(r, 1000));
            }
            setStageDetail(null);
          }
        }
        if (!result) throw new Error("Die Analyse kam leer zurück. Tipp noch einmal auf Analysieren.");

        setStage("save");
        progress.enter("save");
        const saved = await commitVideoAnalysis({
          mode,
          targetId: person.id,
          targetName: person.name,
          sourceKind: source.kind,
          sourceLabel: source.kind === "upload" ? source.fileName : source.url,
          youtubeUrl: source.kind === "youtube" ? source.url : null,
          fileFingerprint,
          fighter,
          tier: "flash",
          recency: zeitraum,
          videoType: artFinal,
          sport: sportFinal,
          fightMonth: preview.fightMonth,
          models: result.models,
          usage: result.usage,
          observation: result.observation,
          evaluation: result.evaluation,
        });
        fertig.push({
          person,
          analysisId: saved.id,
          strength: saved.weight.identified ? Math.round(saved.weight.value * 100) : 0,
        });
        setErgebnisse([...fertig]);
        progress.complete();
      }

      // Alles durch: Datei bei Google löschen, Merker setzen, Zwischenstand
      // löschen. Die Datei erst JETZT — beide Auswertungen brauchten sie.
      if (source.kind === "upload" && pendingUpload?.name) {
        await deleteUploadedFile(pendingUpload.name);
      }
      try {
        localStorage.setItem(SPORT_MERKER, sportFinal);
        localStorage.removeItem(storageKey);
        localStorage.removeItem(standbildKey(uploadId));
      } catch {
        /* optional */
      }
      setPreview(null);
      setBilder({});
      setPendingUpload(null);
      setPendingSavedAt(null);
      setBeobachtungen({});
      setZuordnungen([]);
      setFile(null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Die Analyse hat nicht geklappt. Tipp noch einmal auf Analysieren.");
    } finally {
      setStage("idle");
      setStageDetail(null);
      setLaufKarte(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const running = stage !== "idle";
  const schritt: "ablage" | "zuordnen" | "fertig" =
    ergebnisse && !preview ? "fertig" : preview ? "zuordnen" : "ablage";
  const restzeit = restzeitText(pendingSavedAt);

  const listeImSheet = useMemo(() => {
    if (!sheet) return [];
    const q = suche.trim().toLowerCase();
    if (sheet.kind === "gegner") {
      return (opponents ?? [])
        .filter((o) => !q || o.name.toLowerCase().includes(q))
        .map<Person>((o) => ({ kind: "gegner", id: o.id, name: o.name }));
    }
    const leute = (sichtbar ?? []).filter((s) => {
      const n = nameVon(s).toLowerCase();
      return !q || n.includes(q) || (s.email ?? "").toLowerCase().includes(q);
    });
    // Ich selbst zuoberst — ein Trainer analysiert sich wie einen Athleten.
    leute.sort((a, b) => (a.uid === eigeneUid ? -1 : b.uid === eigeneUid ? 1 : 0));
    return leute.map<Person>((s) => ({ kind: "leute", id: s.uid, name: nameVon(s) }));
  }, [sheet, suche, opponents, sichtbar, eigeneUid]);

  const kopf =
    schritt === "ablage"
      ? {
          titel: "Neues Video",
          text: "Zieh dein Kampfvideo rein oder füg einen YouTube-Link ein. Wer darin kämpft, legst du im nächsten Schritt fest.",
        }
      : schritt === "zuordnen"
        ? {
            titel: "Kämpfer zuordnen",
            text: "Die Analyse fließt direkt in die Fight-DNA der ausgewählten Kämpfer.",
          }
        : {
            titel: "Fight-DNA aktualisiert",
            text:
              (ergebnisse ?? []).length === 1
                ? "Deine Auswertung steckt jetzt im Profil. Tipp auf den Namen und sieh dir das Ergebnis an."
                : "Deine Auswertungen stecken jetzt in den Profilen. Tipp auf einen Namen und sieh dir das Ergebnis an.",
          };

  /** Schrift, die frei über der bewegten Schicht steht, trägt nur `--text-1`. */
  const FREI: React.CSSProperties = { color: "var(--text-1)" };
  const aktiveKarten = zuordnungen.map((z, i) => ({ z, i })).filter(({ z }) => !z.ignoriert);
  const bilderFehlen =
    sourceKind === "upload" &&
    !file &&
    Object.keys(bilder).length === 0 &&
    zuordnungen.some((z) => z.bestSecond != null);
  const rahmenBild = rahmenKarte !== null ? (bilder[rahmenKarte] ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf — frei auf der Seite, ohne Rahmen */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h2 style={{ font: "var(--type-display)", ...FREI }}>
            {kopf.titel}
          </h2>
          <p className="mt-2" style={{ font: "var(--type-body)", ...FREI }}>
            {kopf.text}
          </p>
        </div>
        {schritt === "zuordnen" && !running && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ font: "var(--type-sub)", ...FREI }}>
            {pendingUpload && (
              <span className="inline-flex items-center gap-1.5">
                <span style={{ color: "var(--accent-text)", lineHeight: 0 }}>
                  <Icon name="check" size={14} strokeWidth={2.6} />
                </span>
                Video hochgeladen
              </span>
            )}
            {pendingUpload && restzeit && (
              <>
                <span aria-hidden className="hidden h-4 w-px sm:block" style={{ background: "var(--line-strong)" }} />
                <span>{restzeit}</span>
              </>
            )}
            {/* Ersetzt „Verwerfen" unter den Knöpfen (Leon 16.09.): dickes
                rotes X oben rechts, unter dem Zeiger wächst „Löschen" heraus. */}
            <XKnopf
              onClick={verwerfen}
              ariaLabel="Video löschen und neu anfangen"
              wort="Löschen"
              drehung="roll"
              style={{ ...BTN_FONT, color: "var(--negative)" }}
            />
          </div>
        )}
      </div>

      {runError && (
        <div className="t-danger rounded-field px-3 py-2" style={{ font: "var(--type-sub)" }}>
          {runError}
        </div>
      )}

      {/* ── Schritt 1: Ablage ─────────────────────────────────────────────── */}
      <Collapse open={schritt === "ablage" && !running}>
        <div className="flex max-w-3xl flex-col gap-4">
          {pendingUpload && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-field px-3 py-2.5"
              style={{
                background: "color-mix(in oklab, var(--positive) 12%, transparent)",
                border: "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
              }}
            >
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Erledigt text={`${pendingUpload.fileName} ist hochgeladen`} />
                {restzeit && <span style={{ ...META_FONT, color: "var(--text-2)" }}>{restzeit}</span>}
              </span>
              <button
                type="button"
                onClick={verwerfen}
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-3"
                style={{ ...BTN_FONT, color: "var(--text-2)" }}
              >
                Verwerfen
              </button>
            </div>
          )}

          <div className="flex gap-2" role="group" aria-label="Videoquelle">
            {(
              [
                ["upload", "Datei"],
                ["youtube", "YouTube-Link"],
              ] as const
            ).map(([kind, label]) => {
              const aktiv = sourceKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setSourceKind(kind)}
                  aria-pressed={aktiv}
                  className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
                  style={{
                    ...BTN_FONT,
                    background: aktiv ? "var(--accent)" : "var(--surface-card)",
                    color: aktiv ? "var(--on-accent)" : "var(--text-2)",
                    border: `1px solid ${aktiv ? "var(--accent)" : "var(--line)"}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {sourceKind === "upload" ? (
            <div
              onDragEnter={ablageEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={ablageLeave}
              onDrop={ablageDrop}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-press="surface"
                className="t-interactive flex w-full flex-col items-center gap-2 rounded-card px-4 py-10 text-center"
                style={{
                  background: ueberAblage ? "var(--accent-subtle)" : "var(--surface-card)",
                  border: `1.5px dashed ${ueberAblage ? "var(--accent)" : "var(--line-strong)"}`,
                }}
              >
                <span style={{ color: ueberAblage ? "var(--accent-text)" : "var(--text-2)", lineHeight: 0 }}>
                  <Icon name="video" size={26} strokeWidth={1.8} />
                </span>
                {file ? (
                  <>
                    <span className="max-w-full truncate" style={{ font: "var(--type-body-strong)" }}>
                      {file.name}
                    </span>
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      {(file.size / 1_048_576).toFixed(0)} MB · Tipp für ein anderes Video
                    </span>
                  </>
                ) : pendingUpload ? (
                  <>
                    <span className="max-w-full truncate" style={{ font: "var(--type-body-strong)" }}>
                      {pendingUpload.fileName}
                    </span>
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      Schon hochgeladen · Tipp für ein anderes Video
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ font: "var(--type-body-strong)" }}>
                      {ueberAblage ? "Lass los" : "Zieh dein Video hierher"}
                    </span>
                    <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                      Oder tipp hier und such es aus. Mit Strg+V fügst du ein kopiertes Video oder einen
                      YouTube-Link ein. Bis 15 Minuten.
                    </span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => nimmDatei(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="t-card flex flex-col gap-4 p-4">
              <Field label="YouTube-Link" hint="Füg den Link ein, das Video holt sich DeepFight direkt von YouTube.">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="min-h-hit rounded-field px-3"
                  style={inputStyle}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start (mm:ss, optional)">
                  <input
                    value={ytStart}
                    onChange={(e) => setYtStart(e.target.value)}
                    placeholder="z. B. 2:30"
                    className="min-h-hit rounded-field px-3"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Ende (mm:ss, optional)">
                  <input
                    value={ytEnd}
                    onChange={(e) => setYtEnd(e.target.value)}
                    placeholder="z. B. 17:30"
                    className="min-h-hit rounded-field px-3"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleWeiter}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="arrow-right" size={13} strokeWidth={2.4} />
              Weiter
            </button>
          </div>
        </div>
      </Collapse>

      {/* ── Schritt 3: Kämpfer zuordnen ───────────────────────────────────────
          Links die Karten, rechts die Fragen zum Video (Leons Vorlage 16.09.).
          Auf dem Handy: Karten → Fragen → Knöpfe. */}
      <Collapse open={schritt === "zuordnen" && !running} ueberstehen>
        {preview && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:grid-rows-[auto_1fr]">
            {/* Links: Karten */}
            <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
              {bilderFehlen && (
                <div className="t-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span style={{ font: "var(--type-sub)", color: "var(--text-body)" }}>
                    Wähl dein Video noch einmal aus, dann siehst du die Kämpfer wieder im Bild.
                  </span>
                  <button
                    type="button"
                    onClick={() => nachwahlRef.current?.click()}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                    style={{ ...BTN_FONT, color: "var(--accent-text)", border: "1px solid var(--line-strong)" }}
                  >
                    <Icon name="video" size={13} strokeWidth={2.4} />
                    Video wählen
                  </button>
                  <input
                    ref={nachwahlRef}
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    onChange={(e) => dateiNachwaehlen(e.target.files?.[0])}
                  />
                </div>
              )}

              <div className={`grid gap-4 ${zuordnungen.length > 1 ? "sm:grid-cols-2" : "sm:max-w-md"}`}>
                {zuordnungen.map((z, i) => {
                  const bild = bilder[i] ?? null;
                  const inWahl = wahl === i;
                  const titel = z.person ? z.person.name : `Kämpfer ${i + 1}`;
                  const aktiv = !!z.person && !z.ignoriert;
                  const aus = bild ? ausschnitt(z.box, bild) : null;
                  return (
                    <div
                      key={i}
                      className="t-card relative flex flex-col overflow-hidden"
                      data-ignoriert={z.ignoriert || undefined}
                      style={{
                        borderColor: aktiv ? "var(--accent)" : undefined,
                        boxShadow: aktiv ? "0 0 0 1px var(--accent), var(--accent-glow)" : undefined,
                        opacity: z.ignoriert ? 0.55 : 1,
                        transition:
                          "opacity var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
                      }}
                    >
                      {/* Das Bild ist der Knopf: grau → zurück, aktiv → Wahl. */}
                      <button
                        type="button"
                        onClick={() => karteTipp(i)}
                        data-press="surface"
                        aria-pressed={inWahl}
                        aria-label={
                          z.ignoriert
                            ? `${titel}: zurückholen`
                            : z.person
                              ? `${titel}: Zuordnung ändern`
                              : `${titel}: zuordnen`
                        }
                        className="t-interactive relative block w-full overflow-hidden"
                        style={{ aspectRatio: `${KARTE_FORMAT} / 1`, background: "var(--surface-raised)" }}
                      >
                        <span
                          className="absolute inset-0 block"
                          style={{
                            // Blur nur, wo er nichts kostet (MOTION-BRIEF §3.5).
                            filter: inWahl && canBlur ? "blur(6px)" : undefined,
                            transition: "filter var(--dur-fast) var(--ease-out)",
                          }}
                        >
                          {bild && aus ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={bild.src}
                                alt=""
                                draggable={false}
                                className="absolute"
                                style={{
                                  maxWidth: "none",
                                  width: `${100 / aus.w}%`,
                                  height: `${100 / aus.h}%`,
                                  left: `${(-aus.x / aus.w) * 100}%`,
                                  top: `${(-aus.y / aus.h) * 100}%`,
                                  filter: z.ignoriert ? "grayscale(1)" : undefined,
                                }}
                              />
                              {z.box && !z.ignoriert && (
                                <span
                                  aria-hidden
                                  className="absolute rounded-[10px]"
                                  style={{
                                    left: `${((z.box.x - aus.x) / aus.w) * 100}%`,
                                    top: `${((z.box.y - aus.y) / aus.h) * 100}%`,
                                    width: `${(z.box.w / aus.w) * 100}%`,
                                    height: `${(z.box.h / aus.h) * 100}%`,
                                    border: `2px solid ${aktiv ? "var(--accent)" : "color-mix(in oklab, white 80%, transparent)"}`,
                                    boxShadow: "0 0 0 1px color-mix(in oklab, black 35%, transparent)",
                                  }}
                                />
                              )}
                            </>
                          ) : (
                            <span className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                              <span style={{ color: "var(--text-2)", lineHeight: 0 }}>
                                <Icon name="user" size={30} strokeWidth={1.6} />
                              </span>
                              <span style={{ font: "var(--type-sub)", color: "var(--text-body)" }}>
                                {z.description || "Für diesen Kämpfer gibt es kein Standbild."}
                              </span>
                            </span>
                          )}
                        </span>
                      </button>

                      {/* Die Wahl: zwei Felder über dem unscharfen Bild. */}
                      {inWahl && (
                        <div
                          className="absolute inset-x-0 top-0 flex items-center justify-center gap-3 px-4"
                          style={{
                            aspectRatio: `${KARTE_FORMAT} / 1`,
                            background: canBlur
                              ? "color-mix(in oklab, var(--surface-page) 35%, transparent)"
                              : "color-mix(in oklab, var(--surface-page) 82%, transparent)",
                          }}
                        >
                          {(
                            [
                              ["leute", "Athlet", "user"],
                              ["gegner", "Gegner", "target"],
                            ] as const
                          ).map(([kind, label, icon]) => (
                            <button
                              key={kind}
                              type="button"
                              data-press="surface"
                              aria-label={`Kämpfer ${i + 1} als ${label} zuordnen`}
                              onClick={() => {
                                setSuche("");
                                setSheet({ karte: i, kind });
                              }}
                              className="t-interactive inline-flex min-h-hit flex-1 items-center justify-center gap-2 rounded-field px-4 py-3"
                              style={{
                                ...BTN_FONT,
                                maxWidth: 180,
                                background: kind === "leute" ? "var(--accent)" : "var(--surface-card)",
                                color: kind === "leute" ? "var(--on-accent)" : "var(--text-body)",
                                border: `1px solid ${kind === "leute" ? "var(--accent)" : "var(--line-strong)"}`,
                                boxShadow: kind === "leute" ? "var(--accent-glow)" : undefined,
                              }}
                            >
                              <Icon name={icon} size={14} strokeWidth={2.4} />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Fuß: X (unter dem Zeiger „Ignorieren"), Name, Rahmen. */}
                      <div className="flex items-center gap-3 px-3 py-3">
                        <XKnopf
                          onClick={() => (z.ignoriert ? setzeKarte(i, { ignoriert: false }) : ignorieren(i))}
                          ariaLabel={z.ignoriert ? `${titel} zurückholen` : `${titel} ignorieren`}
                          dataAktion={z.ignoriert ? "zurueckholen" : "ignorieren"}
                          wort={z.ignoriert ? "Zurückholen" : "Ignorieren"}
                          icon={z.ignoriert ? "refresh" : "x"}
                          size={30}
                          strokeWidth={3.8}
                          drehung="viertel"
                          style={{ ...META_FONT, color: "var(--text-body)" }}
                        />
                        {/* Name und Zustand — ein Tipp wirkt wie auf das Bild. */}
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => karteTipp(i)}
                          aria-hidden
                        >
                          <span
                            className="block truncate"
                            style={{
                              font: "var(--type-body-strong)",
                              color: aktiv ? "var(--text-1)" : "var(--text-body)",
                            }}
                          >
                            {titel}
                          </span>
                          <span
                            className="block truncate"
                            style={{ ...META_FONT, color: aktiv ? "var(--accent-text)" : "var(--text-2)" }}
                          >
                            {z.ignoriert
                              ? "Bleibt außen vor"
                              : z.person
                                ? z.person.kind === "gegner"
                                  ? "Gegner"
                                  : "Athlet"
                                : z.corner !== "unknown"
                                  ? `${CORNER_LABEL[z.corner]} · Zuordnen`
                                  : "Tipp zum Zuordnen"}
                          </span>
                        </div>
                        {bild && !z.ignoriert && (
                          <button
                            type="button"
                            onClick={() => rahmenOeffnen(i)}
                            aria-label={`${titel} markieren`}
                            title="Rahmen ziehen"
                            className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-2 rounded-field px-2.5"
                            style={{ ...META_FONT, color: "var(--text-2)" }}
                          >
                            <Icon name="frame" size={17} strokeWidth={2} />
                            <span className="hidden 2xl:inline">Rahmen</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* YouTube: kein Standbild, dafür der Sprung ins Video. */}
              {sourceKind === "youtube" && youtubeUrl && (
                <div className="flex flex-wrap gap-2">
                  {zuordnungen.map((z, i) =>
                    z.bestSecond != null ? (
                      <a
                        key={i}
                        href={youtubeAb(youtubeUrl, z.bestSecond)}
                        target="_blank"
                        rel="noreferrer"
                        data-press
                        className="t-card t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-3"
                        style={{ ...META_FONT, color: "var(--accent-text)", textDecoration: "none" }}
                      >
                        <Icon name="play" size={12} strokeWidth={2.4} />
                        Kämpfer {i + 1} im Video ansehen
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>

            {/* Rechts: die Fragen zum Video */}
            <aside className="t-card flex flex-col p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
              <div className="flex flex-col gap-3 pb-5">
                <h3 className="flex items-center gap-3" style={{ font: "var(--type-h3)", color: "var(--text-1)" }}>
                  <span style={{ color: "var(--accent-text)", lineHeight: 0 }}>
                    <Icon name="calendar" size={22} strokeWidth={1.9} />
                  </span>
                  Wann ist das Video entstanden?
                </h3>
                <Select
                  value={recency}
                  onChange={(v) => setRecency(v as FightRecency | "")}
                  options={(["recent", "mid", "old", "ancient", "unknown"] as FightRecency[]).map((r) => ({
                    value: r,
                    label: FIGHT_RECENCY_LABEL[r],
                  }))}
                  placeholder="Zeitraum wählen"
                />
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Damit hilfst du DeepFight, die Fight-DNA genauer aufzubauen.
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t py-5" style={{ borderColor: "var(--line)" }}>
                <h3 className="flex items-center gap-3" style={{ font: "var(--type-h3)", color: "var(--text-1)" }}>
                  <span style={{ color: "var(--accent-text)", lineHeight: 0 }}>
                    <Icon name="wave" size={22} strokeWidth={1.9} />
                  </span>
                  Session &amp; Kampfart
                </h3>
                <Select
                  value={videoType ?? preview.videoType}
                  onChange={(v) => setVideoType(v as VideoType)}
                  options={(["full", "excerpt", "sparring", "highlight"] as VideoType[]).map((t) => ({
                    value: t,
                    label: VIDEO_TYPE_LABEL[t],
                  }))}
                />
                <Select
                  value={sport ?? "mma"}
                  onChange={(v) => {
                    if (isSport(v)) setSport(v);
                  }}
                  options={SPORT_ORDER.map((s) => ({ value: s, label: SPORT_LABEL[s] }))}
                />
              </div>

              <div className="border-t pt-4" style={{ borderColor: "var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setBeschreibungOffen((o) => !o)}
                  aria-expanded={beschreibungOffen}
                  className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field text-left"
                  style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}
                >
                  <span style={{ color: "var(--accent-text)", lineHeight: 0 }}>
                    <Icon name="edit" size={20} strokeWidth={1.9} />
                  </span>
                  <span className="flex-1">Kämpfer beschreiben</span>
                  <span
                    aria-hidden
                    style={{
                      color: "var(--text-2)",
                      transform: beschreibungOffen ? "rotate(180deg)" : "none",
                      transition: "transform var(--dur-fast) var(--ease-out)",
                      lineHeight: 0,
                    }}
                  >
                    <Icon name="chevron-down" size={16} strokeWidth={2.2} />
                  </span>
                </button>
                <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  {beschreibungOffen
                    ? "Übernimm den Vorschlag oder ergänze ihn mit weiteren Erkennungsmerkmalen."
                    : "Wenn sich die Kämpfer ähneln, helfen Details wie Kleidung, Tattoos oder Körperbau bei der eindeutigen Zuordnung."}
                </p>
                <Collapse open={beschreibungOffen}>
                  <div className="flex flex-col gap-4 pt-4">
                    {aktiveKarten.map(({ z, i }) => (
                      <div key={i} className="flex flex-col gap-3">
                        <span style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>
                          {z.person ? z.person.name : `Kämpfer ${i + 1}`}
                        </span>
                        <Field label="Hose / Rashguard">
                          <WachsendesFeld
                            value={z.clothing}
                            onChange={(v) => setzeKarte(i, { clothing: v })}
                            placeholder="z. B. schwarze Shorts, weißes Logo"
                          />
                        </Field>
                        <Field label="Merkmale">
                          <WachsendesFeld
                            value={z.features}
                            onChange={(v) => setzeKarte(i, { features: v })}
                            placeholder="z. B. Tattoo am rechten Unterarm, der Größere"
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                </Collapse>
              </div>
            </aside>

            {/* Unten links: Hinweis und Knöpfe */}
            <div className="flex flex-col items-start gap-3 lg:col-start-1 lg:row-start-2 lg:self-start">
              {hinweis && (
                <div
                  className="t-card px-4 py-2.5"
                  style={{ font: "var(--type-sub)", color: "var(--text-1)", borderColor: "var(--warning)" }}
                  role="status"
                >
                  {hinweis}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {/* Voll farbig erst, wenn alles steht — sonst sagt der Klick, was
                    fehlt. BEWUSST kein `aria-disabled`: Der Knopf IST klickbar,
                    er antwortet mit dem Hinweis. */}
                <RainbowButton
                  onClick={handleAnalysieren}
                  data-bereit={bereit || undefined}
                  style={{ ...BTN_FONT, fontSize: 15, height: 52 }}
                >
                  <Icon name="spark" size={15} strokeWidth={2.4} />
                  Analysieren
                  <Icon name="arrow-right" size={15} strokeWidth={2.4} />
                </RainbowButton>
              </div>
            </div>
          </div>
        )}
      </Collapse>

      {/* ── Schritt 5: Fertig ─────────────────────────────────────────────── */}
      <Collapse open={schritt === "fertig" && !running}>
        <div className="flex max-w-3xl flex-col gap-3">
          <StaggerFlow className="flex flex-col gap-2">
            {(ergebnisse ?? []).map((e, i) => (
              <FlowItem key={`${e.person.kind}:${e.person.id}`} index={i}>
                <Link
                  href={`/trainer/deepfight/analyse?modus=${e.person.kind}&ziel=${e.person.id}&analyse=${e.analysisId}`}
                  data-press="quiet"
                  className="t-card t-interactive flex min-h-hit w-full items-center gap-3 px-4 py-3"
                  style={{ textDecoration: "none", color: "var(--text-body)" }}
                >
                  <span
                    className="shrink-0"
                    style={{ color: e.person.kind === "gegner" ? "var(--text-2)" : "var(--accent-text)", lineHeight: 0 }}
                  >
                    <Icon name="user" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>
                      {e.person.name}
                    </span>
                    <span className="block truncate" style={{ ...META_FONT, color: "var(--text-2)" }}>
                      {e.strength
                        ? `Zählt zu ${e.strength} % · Ergebnis ansehen`
                        : "Zählt noch nicht, der Kämpfer war unsicher · Ergebnis ansehen"}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: "var(--text-2)", lineHeight: 0 }}>
                    <Icon name="arrow-right" size={16} strokeWidth={2.2} />
                  </span>
                </Link>
              </FlowItem>
            ))}
          </StaggerFlow>
          <div className="pt-1">
            <button
              type="button"
              onClick={verwerfen}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="video" size={13} strokeWidth={2.4} />
              Nächstes Video
            </button>
          </div>
        </div>
      </Collapse>

      {/* ── Läuft: Vollbild-Overlay, per Portal am body ──────────────────────
          Ein Vorfahr mit `backdrop-filter` oder `transform` fängt sonst
          `position: fixed` ein (gesehen 16.09.: die Anzeige klebte an der
          Glas-Karte). */}
      {running &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
            style={{
              background: "color-mix(in oklab, var(--surface-page) 92%, transparent)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              color: "var(--text-body)",
            }}
          >
            <div className="ai-loader-wrapper" aria-label="Analyse läuft">
              <div className="ai-loader" />
              {"Analysiere".split("").map((ch, i) => (
                <span key={i} className="ai-loader-letter" style={{ animationDelay: `${i * 0.1}s` }}>
                  {ch}
                </span>
              ))}
            </div>
            <div
              className="mt-4 tabular-nums"
              style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
              aria-live="polite"
            >
              {progress.percent} %
            </div>
            <div className="t-progress mt-2 w-full max-w-xs">
              <span style={{ width: `${progress.percent}%`, transition: "width 200ms linear" }} />
            </div>
            <p className="mt-4 max-w-xs text-center" style={{ font: "var(--type-body-strong)" }}>
              {stage === "upload"
                ? "Video hochladen"
                : stage === "vorlauf"
                  ? "Kämpfer suchen"
                  : laufKarte
                    ? `${laufKarte.name} · ${laufKarte.i} von ${laufKarte.n}`
                    : "Analyse"}
            </p>
            <p className="mt-1 max-w-xs text-center" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {stage === "gemini"
                ? "Video beobachten"
                : stage === "claude"
                  ? "Kampf bewerten"
                  : stage === "save"
                    ? "Fight-DNA aktualisieren"
                    : stage === "vorlauf"
                      ? "Das dauert nur ein paar Sekunden"
                      : "Bitte geöffnet lassen."}
              {stageDetail && (
                <span className="block" style={{ color: "var(--accent-text)" }}>
                  {stageDetail}
                </span>
              )}
            </p>
          </div>,
          document.body,
        )}

      {/* ── Das Sheet: Athleten oder Gegner wählen ────────────────────────── */}
      <SheetShell
        open={!!sheet}
        onClose={() => setSheet(null)}
        label={sheet?.kind === "gegner" ? "Gegner wählen" : "Athlet wählen"}
        panelClassName="pointer-events-auto relative flex w-full max-h-[80vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)] lg:max-w-3xl"
        panelStyle={{ maxHeight: "80dvh", background: "var(--surface-card)", boxShadow: "var(--glass-shadow)" }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 pb-3">
            <h2 className="t-sheet-title">
              {sheet?.kind === "gegner" ? "Wähle aus euren Gegnern" : "Wähle aus euren Athleten"}
            </h2>
            <GooeySearch value={suche} onChange={setSuche} placeholder="Name …" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
            {(sheet?.kind === "gegner" ? opponents : sichtbar) === null ? (
              <>
                <Skeleton className="h-12 w-full rounded-field" />
                <Skeleton className="h-12 w-2/3 rounded-field" />
              </>
            ) : listeImSheet.length === 0 ? (
              <p className="px-1 py-3" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                {suche
                  ? "Kein Name passt zu deiner Suche."
                  : sheet?.kind === "gegner"
                    ? "Du hast noch keinen Gegner angelegt. Das machst du in der Gegner-Bibliothek."
                    : "Noch hat dich niemand für DeepFight freigegeben."}
              </p>
            ) : (
              listeImSheet.map((p) => {
                const key = `${p.kind}:${p.id}`;
                const andereKarte = vergeben.get(key);
                const gesperrt = andereKarte !== undefined && sheet !== null && andereKarte !== sheet.karte;
                const selbst = p.kind === "leute" && p.id === eigeneUid;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={gesperrt}
                    data-press="quiet"
                    onClick={() => waehlePerson(p)}
                    className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2 text-left disabled:cursor-not-allowed"
                    style={{
                      ...FLAECHE,
                      opacity: gesperrt ? 0.45 : 1,
                      color: "var(--text-body)",
                    }}
                  >
                    <span
                      className="shrink-0"
                      style={{ color: p.kind === "gegner" ? "var(--text-2)" : "var(--accent-text)", lineHeight: 0 }}
                    >
                      <Icon name={p.kind === "gegner" ? "target" : "user"} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ font: "var(--type-body-strong)" }}>
                        {p.name}
                        {selbst ? " (ich)" : ""}
                      </span>
                      {gesperrt && (
                        <span className="block truncate" style={{ ...META_FONT, color: "var(--text-2)" }}>
                          Schon bei Kämpfer {andereKarte! + 1}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SheetShell>

      {/* ── Das Rahmen-Popup: einen Rahmen um den Kämpfer ziehen ──────────── */}
      <SheetShell
        open={rahmenKarte !== null && !!rahmenBild}
        onClose={() => setRahmenKarte(null)}
        label="Kämpfer markieren"
        panelClassName="pointer-events-auto relative flex w-full max-h-[92vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-2xl sm:rounded-[var(--r-xl)] lg:max-w-5xl"
        panelStyle={{ maxHeight: "92dvh", background: "var(--surface-card)", boxShadow: "var(--glass-shadow)" }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
          <div className="flex items-start gap-3 px-1">
            <div className="min-w-0 flex-1">
              <h2 className="t-sheet-title">
                {rahmenKarte !== null ? (zuordnungen[rahmenKarte]?.person?.name ?? `Kämpfer ${rahmenKarte + 1}`) : ""}{" "}
                markieren
              </h2>
              <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                Zieh einen Rahmen um den ganzen Körper – damit DeepFight die Person über das gesamte Video hinweg
                eindeutig zuordnen kann.
              </p>
            </div>
            {/* Ersetzt „Abbrechen" (Leon 16.09.). Schließen ist nicht
                zerstörerisch, deshalb neutral statt rot wie „Löschen". */}
            <XKnopf
              onClick={() => setRahmenKarte(null)}
              ariaLabel="Schließen"
              wort="Schließen"
              drehung="roll"
              style={{ ...BTN_FONT, color: "var(--text-1)" }}
            />
          </div>
          {rahmenBild && (
            <div
              className="relative mx-auto w-fit max-w-full cursor-crosshair select-none overflow-hidden rounded-field"
              style={{ touchAction: "none" }}
              onPointerDown={zeichnenBeginnt}
              onPointerMove={zeichnenZieht}
              onPointerUp={zeichnenEndet}
              onPointerCancel={zeichnenEndet}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rahmenBild.src}
                alt="Standbild aus dem Video"
                draggable={false}
                className="pointer-events-none block h-auto max-h-[62dvh] w-auto max-w-full"
              />
              {/* Die anderen Kämpfer zur Orientierung, gestrichelt. */}
              {zuordnungen.map((z, k) =>
                k !== rahmenKarte && z.box && !z.ignoriert && bilder[k]?.src === rahmenBild.src ? (
                  <span
                    key={k}
                    aria-hidden
                    className="pointer-events-none absolute rounded-[8px]"
                    style={{
                      left: `${z.box.x * 100}%`,
                      top: `${z.box.y * 100}%`,
                      width: `${z.box.w * 100}%`,
                      height: `${z.box.h * 100}%`,
                      border: "2px dashed color-mix(in oklab, white 55%, transparent)",
                    }}
                  />
                ) : null,
              )}
              {entwurf && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute rounded-[8px]"
                  style={{
                    left: `${entwurf.x * 100}%`,
                    top: `${entwurf.y * 100}%`,
                    width: `${entwurf.w * 100}%`,
                    height: `${entwurf.h * 100}%`,
                    border: "2px solid var(--accent)",
                    boxShadow:
                      "0 0 0 1px color-mix(in oklab, black 40%, transparent), 0 0 0 9999px color-mix(in oklab, black 38%, transparent)",
                  }}
                />
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 px-1">
            <button
              type="button"
              onClick={rahmenUebernehmen}
              disabled={!entwurf}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5 disabled:opacity-50"
              style={{ ...BTN_FONT, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--accent-glow)" }}
            >
              <Icon name="check" size={13} strokeWidth={2.6} />
              Übernehmen
            </button>
          </div>
        </div>
      </SheetShell>
    </div>
  );
}
