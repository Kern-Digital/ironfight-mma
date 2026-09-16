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
 * KEINE `.t-card` HIER DRIN: Der Fluss sitzt auf der Analyse-Seite bereits in
 * einer, und im Bereich ist jede `.t-card` Glas. Eigene Flächen laufen über
 * `--surface-raised` + `--line`.
 */

import { Collapse, SheetShell, StaggerFlow, FlowItem, useMotionCapability } from "@/components/motion";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
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
  SPORT_KURZ,
  SPORT_LABEL,
  SPORT_ORDER,
  VIDEO_TYPE_LABEL,
  commitVideoAnalysis,
  deleteUploadedFile,
  isSport,
  isUploadStillActive,
  readVideoDuration,
  runVideoAnalysis,
  runVideoObservation,
  runVideoPreview,
  uploadVideoFile,
  vorschlagSport,
  type CornerColor,
  type FightRecency,
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
  if (stunden >= 1) return `Noch ${stunden} ${stunden === 1 ? "Stunde" : "Stunden"} gültig`;
  const minuten = Math.max(1, Math.round(rest / 60_000));
  return `Noch ${minuten} ${minuten === 1 ? "Minute" : "Minuten"} gültig`;
}

/** YouTube-Link mit Sprung zur Sekunde. */
function youtubeAb(url: string, sekunde: number | null): string {
  if (sekunde == null) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${sekunde}s`;
}

/**
 * Zieht ein Standbild aus der lokalen Datei — der Browser kann das ohne
 * Server. Breite gedeckelt, damit zwei Bilder im Speicher keine Last sind.
 */
function standbild(file: File, sekunde: number): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const fertig = (bild: string | null) => {
      URL.revokeObjectURL(url);
      resolve(bild);
    };
    video.onloadedmetadata = () => {
      const ziel = Math.min(sekunde, Math.max(0, (video.duration || sekunde) - 0.1));
      video.currentTime = ziel;
    };
    video.onseeked = () => {
      try {
        const breite = Math.min(640, video.videoWidth || 640);
        const hoehe = Math.round(breite * ((video.videoHeight || 360) / (video.videoWidth || 640)));
        const canvas = document.createElement("canvas");
        canvas.width = breite;
        canvas.height = hoehe;
        canvas.getContext("2d")?.drawImage(video, 0, 0, breite, hoehe);
        fertig(canvas.toDataURL("image/jpeg", 0.8));
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
  const [bilder, setBilder] = useState<Record<number, string>>({});
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
  const [artOffen, setArtOffen] = useState(false);
  const [sportOffen, setSportOffen] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

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
    } catch {
      /* defekter Eintrag → ignorieren */
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

  // ─── Standbilder aus der Datei, sobald Vorlauf UND Datei da sind ──────────
  useEffect(() => {
    if (!preview || !file) return;
    let alive = true;
    (async () => {
      const out: Record<number, string> = {};
      for (let i = 0; i < preview.fighters.length; i++) {
        const sek = preview.fighters[i].bestSecond;
        if (sek == null) continue;
        const bild = await standbild(file, sek);
        if (bild) out[i] = bild;
      }
      if (alive) setBilder(out);
    })();
    return () => {
      alive = false;
    };
  }, [preview, file]);

  // ─── Ablage: ziehen, einfügen, wählen ────────────────────────────────────
  const nimmDatei = useCallback((f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setRunError(
        `„${f.name}" ist kein Video. Leg eine Videodatei ab — MP4, MOV und was dein Handy sonst aufnimmt.`,
      );
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
        setStageDetail("Bereits hochgeladenes Video wird geprüft …");
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
            ? "Das zuvor hochgeladene Video ist nicht mehr gültig — bitte die Datei erneut auswählen."
            : "Bitte eine Videodatei auswählen.",
        );
      }
      const duration = await readVideoDuration(file);
      if (duration != null && duration > MAX_VIDEO_SECONDS + 5) {
        throw new Error(
          `Video ist ${Math.round(duration / 60)} Minuten lang — maximal 15 Minuten.`,
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
    if (!youtubeUrl.trim()) throw new Error("Bitte einen YouTube-Link angeben.");
    const startSeconds = parseTimecode(ytStart);
    const endSeconds = parseTimecode(ytEnd);
    if (startSeconds != null && endSeconds != null && endSeconds - startSeconds > MAX_VIDEO_SECONDS) {
      throw new Error("Der Ausschnitt darf maximal 15 Minuten lang sein.");
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
      setStageDetail("Die KI schaut sich die ersten zwei Minuten an …");
      // Derselbe Auto-Neustart wie bei der Analyse: „überlastet" ist wiederholbar.
      let vorlauf: VideoPreview | null = null;
      for (let attempt = 1; attempt <= 3 && !vorlauf; attempt++) {
        try {
          vorlauf = await runVideoPreview(source);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.includes("überlastet") || attempt >= 3) throw err;
          for (let s = 15; s > 0; s--) {
            setStageDetail(`KI-Dienst überlastet — automatischer Neustart in ${s} s`);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
      if (!vorlauf) throw new Error("Vorlauf lieferte kein Ergebnis");
      if (sourceKind === "youtube") setPendingSavedAt(Date.now());

      // Ohne gefundenen Kämpfer trotzdem eine Karte — der Trainer beschreibt
      // ihn dann selbst (zugeklappter Rückfall).
      const kaempfer = vorlauf.fighters.length
        ? vorlauf.fighters
        : [{ corner: "unknown" as const, clothing: "", features: "", description: "", bestSecond: null }];
      setZuordnungen(
        kaempfer.map((f) => ({
          person: null,
          ignoriert: false,
          corner: f.corner,
          clothing: f.clothing,
          features: f.features,
          description: f.description,
          bestSecond: f.bestSecond,
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
      setRunError(err instanceof Error ? err.message : "Vorlauf fehlgeschlagen");
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
      setHinweis("Wähle mind. eine Person zur Auswertung aus.");
      return;
    }
    if (recency === "") {
      setHinweis("Wähle, wann das Video aufgenommen wurde.");
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
          startPosition: z.description.trim(),
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
                "Die KI-Dienste sind gerade stark ausgelastet — wir haben es automatisch 3× versucht. Bitte in ein paar Minuten auf Analysieren tippen; Upload, Zuordnung und Zwischenstand bleiben gespeichert.",
              );
            }
            for (let s = 20; s > 0; s--) {
              setStageDetail(
                `KI-Dienst überlastet — automatischer Neustart in ${s} s (Versuch ${attempt + 1}/${MAX_ATTEMPTS})`,
              );
              await new Promise((r) => setTimeout(r, 1000));
            }
            setStageDetail(null);
          }
        }
        if (!result) throw new Error("Analyse lieferte kein Ergebnis");

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
      } catch {
        /* optional */
      }
      setPreview(null);
      setPendingUpload(null);
      setPendingSavedAt(null);
      setBeobachtungen({});
      setZuordnungen([]);
      setFile(null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Analyse fehlgeschlagen");
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

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf */}
      <div className="min-w-0">
        <div className="t-label">KI-Video-Analyse</div>
        <p className="mt-0.5" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          {schritt === "ablage"
            ? "Leg ein Kampf-Video ab (max. 15 Minuten) oder verlink eins. Wen du analysierst, ordnest du danach zu."
            : schritt === "zuordnen"
              ? "Die KI hat die Kämpfer gefunden. Sag ihr, wer wer ist — dann zählt, beobachtet und bewertet sie jede zugeordnete Person."
              : "Fertig. Jede Auswertung steht im Profil der Person."}
        </p>
      </div>

      {runError && (
        <div className="t-danger rounded-field px-3 py-2" style={{ font: "var(--type-sub)" }}>
          {runError}
        </div>
      )}

      {/* ── Schritt 1: Ablage ─────────────────────────────────────────────── */}
      <Collapse open={schritt === "ablage" && !running}>
        <div className="flex flex-col gap-4 rounded-card p-4" style={FLAECHE}>
          {pendingUpload && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-field px-3 py-2.5"
              style={{
                background: "color-mix(in oklab, var(--positive) 12%, transparent)",
                border: "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
              }}
            >
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Erledigt text={`${pendingUpload.fileName} liegt bei Google`} />
                {restzeit && (
                  <span style={{ ...META_FONT, color: "var(--text-2)" }}>{restzeit}</span>
                )}
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
                className="t-interactive flex w-full flex-col items-center gap-2 rounded-card px-4 py-8 text-center"
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
                      {(file.size / 1_048_576).toFixed(0)} MB · Tipp hier für ein anderes Video
                    </span>
                  </>
                ) : pendingUpload ? (
                  <>
                    <span className="max-w-full truncate" style={{ font: "var(--type-body-strong)" }}>
                      {pendingUpload.fileName}
                    </span>
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      Liegt schon oben · Tipp hier für ein anderes Video
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ font: "var(--type-body-strong)" }}>
                      {ueberAblage ? "Lass los" : "Zieh dein Video hierher"}
                    </span>
                    <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                      Oder tipp hier und such es aus. Kopiertes fügst du mit Strg+V ein — auch einen
                      YouTube-Link. Bis 15 Minuten, MP4, MOV und was dein Handy sonst aufnimmt.
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
            <>
              <Field
                label="YouTube-Link"
                hint="Die KI liest das Video direkt von YouTube — hochladen musst du nichts."
              >
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
            </>
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

      {/* ── Schritt 3: Kämpfer zuordnen ───────────────────────────────────── */}
      <Collapse open={schritt === "zuordnen" && !running}>
        {preview && (
          <div className="flex flex-col gap-4 rounded-card p-4" style={FLAECHE}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 style={{ font: "var(--type-h3)", color: "var(--text-1)" }}>Kämpfer zuordnen</h2>
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Tipp auf eine Karte und sag, wer das ist. Wen du nicht auswerten willst, ignorierst du.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {pendingUpload && <Erledigt text="Video liegt bei Google" />}
                {restzeit && <span style={{ ...META_FONT, color: "var(--text-2)" }}>{restzeit}</span>}
              </div>
            </div>

            {/* Die Karten */}
            <div className={`grid gap-3 ${zuordnungen.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {zuordnungen.map((z, i) => {
                const bild = bilder[i] ?? null;
                const inWahl = wahl === i;
                const titel = z.person ? z.person.name : `Kämpfer ${i + 1}`;
                const ecke =
                  z.corner === "red" ? "var(--corner-red)" : z.corner === "blue" ? "var(--corner-blue)" : null;
                return (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-card"
                    style={{
                      background: "var(--surface-card)",
                      border: `1px solid ${z.person && !z.ignoriert ? "var(--accent)" : "var(--line)"}`,
                      opacity: z.ignoriert ? 0.45 : 1,
                      transition: "opacity var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
                    }}
                    data-ignoriert={z.ignoriert || undefined}
                  >
                    {/* Die ganze Karte ist der Knopf: grau → zurück, aktiv → Wahl. */}
                    <button
                      type="button"
                      onClick={() => karteTipp(i)}
                      data-press="surface"
                      aria-pressed={inWahl}
                      aria-label={
                        z.ignoriert
                          ? `${titel}: wieder auswerten`
                          : z.person
                            ? `${titel}: Zuordnung ändern`
                            : `${titel}: zuordnen`
                      }
                      className="t-interactive block w-full text-left"
                    >
                      <div
                        className="relative w-full"
                        style={{
                          aspectRatio: "16 / 9",
                          background: "var(--surface-raised)",
                          // Blur nur, wo er nichts kostet (MOTION-BRIEF §3.5) — auf
                          // Touch übernimmt die dunkle Fläche allein.
                          filter: inWahl && canBlur ? "blur(6px)" : undefined,
                          transition: "filter var(--dur-fast) var(--ease-out)",
                        }}
                      >
                        {bild ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bild} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
                            <span style={{ color: "var(--text-2)", lineHeight: 0 }}>
                              <Icon name="user" size={28} strokeWidth={1.6} />
                            </span>
                            <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                              {z.description || "Kein Standbild — die Beschreibung unten hilft der KI."}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {ecke && (
                          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ecke }} />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate"
                            style={{
                              font: "var(--type-body-strong)",
                              color: z.person ? "var(--accent-text)" : "var(--text-body)",
                            }}
                          >
                            {titel}
                          </span>
                          <span className="block truncate" style={{ ...META_FONT, color: "var(--text-2)" }}>
                            {z.ignoriert
                              ? "Ignoriert · tipp zum Auswerten"
                              : z.person
                                ? `${z.person.kind === "gegner" ? "Gegner" : "Athlet"} · tipp zum Ändern`
                                : z.corner !== "unknown"
                                  ? `${CORNER_LABEL[z.corner]} · tipp zum Zuordnen`
                                  : "Tipp zum Zuordnen"}
                          </span>
                        </span>
                      </div>
                    </button>

                    {/* Am Rahmen: X Ignorieren (nur solange die Karte aktiv ist). */}
                    {!z.ignoriert && (
                      <button
                        type="button"
                        onClick={() => ignorieren(i)}
                        className="t-interactive absolute right-2 top-2 inline-flex min-h-hit items-center gap-1 rounded-field px-2.5"
                        style={{
                          ...META_FONT,
                          background: "color-mix(in oklab, var(--surface-page) 82%, transparent)",
                          color: "var(--text-body)",
                          border: "1px solid var(--line)",
                          backdropFilter: "blur(6px)",
                        }}
                        aria-label={`${titel} ignorieren`}
                      >
                        <Icon name="x" size={12} strokeWidth={2.4} />
                        Ignorieren
                      </button>
                    )}

                    {/* Die Wahl: zwei Felder über dem unscharfen Bild. */}
                    {inWahl && (
                      <div
                        className="absolute inset-x-0 top-0 flex items-center justify-center gap-3 px-4"
                        style={{
                          aspectRatio: "16 / 9",
                          background: canBlur ? "color-mix(in oklab, var(--surface-page) 35%, transparent)" : "color-mix(in oklab, var(--surface-page) 82%, transparent)",
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
                      className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-3"
                      style={{ ...META_FONT, color: "var(--accent-text)", border: "1px solid var(--line)", textDecoration: "none" }}
                    >
                      <Icon name="play" size={12} strokeWidth={2.4} />
                      Kämpfer {i + 1} im Video ansehen
                    </a>
                  ) : null,
                )}
              </div>
            )}

            {/* Drei Angaben zum Video */}
            <Field
              label="Wann wurde das Video aufgenommen?"
              hint={
                recency === ""
                  ? "Bestimmt mit, wie stark dieses Video das Profil gewichtet. Weißt du es nicht, ist das in Ordnung — dann zählt es fast voll."
                  : "Bestimmt mit, wie stark dieses Video das Profil gewichtet: Je frischer, desto mehr Gewicht."
              }
            >
              <Select
                value={recency}
                onChange={(v) => setRecency(v as FightRecency | "")}
                options={(["recent", "mid", "old", "ancient", "unknown"] as FightRecency[]).map((r) => ({
                  value: r,
                  label: FIGHT_RECENCY_LABEL[r],
                }))}
                placeholder="— wählen —"
              />
            </Field>

            <div className="flex flex-col gap-2">
              <span className="t-label">Art und Kampfart</span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Die KI hat gesetzt — ein Tipp öffnet die Änderung, sonst kein Klick. */}
                <button
                  type="button"
                  onClick={() => {
                    setArtOffen((o) => !o);
                    setSportOffen(false);
                  }}
                  aria-expanded={artOffen}
                  className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-3"
                  style={{ ...META_FONT, ...FLAECHE, color: "var(--text-body)" }}
                >
                  {VIDEO_TYPE_LABEL[videoType ?? preview.videoType]}
                  <Icon name="edit" size={12} strokeWidth={2.2} />
                </button>
                <span aria-hidden style={{ color: "var(--text-2)" }}>
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSportOffen((o) => !o);
                    setArtOffen(false);
                  }}
                  aria-expanded={sportOffen}
                  className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-3"
                  style={{ ...META_FONT, ...FLAECHE, color: "var(--text-body)" }}
                >
                  {SPORT_KURZ[sport ?? "mma"]}
                  <Icon name="edit" size={12} strokeWidth={2.2} />
                </button>
              </div>
              <Collapse open={artOffen}>
                <div className="max-w-sm pt-1">
                  <Select
                    value={videoType ?? preview.videoType}
                    onChange={(v) => {
                      setVideoType(v as VideoType);
                      setArtOffen(false);
                    }}
                    options={(["full", "excerpt", "sparring", "highlight"] as VideoType[]).map((t) => ({
                      value: t,
                      label: VIDEO_TYPE_LABEL[t],
                    }))}
                  />
                </div>
              </Collapse>
              <Collapse open={sportOffen}>
                <div className="max-w-sm pt-1">
                  <Select
                    value={sport ?? "mma"}
                    onChange={(v) => {
                      if (isSport(v)) setSport(v);
                      setSportOffen(false);
                    }}
                    options={SPORT_ORDER.map((s) => ({ value: s, label: SPORT_LABEL[s] }))}
                  />
                </div>
              </Collapse>
              <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                Die KI hat beides aus dem Video gelesen. Stimmt etwas nicht, tipp es an. Die Kampfart gilt für alle
                Kämpfer im Video und entscheidet, in welches Profil die Auswertung läuft.
              </span>
            </div>

            {/* Beschreibung als zugeklappter Rückfall */}
            <div>
              <button
                type="button"
                onClick={() => setBeschreibungOffen((o) => !o)}
                aria-expanded={beschreibungOffen}
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-2"
                style={{ ...META_FONT, color: "var(--text-2)" }}
              >
                <span
                  aria-hidden
                  style={{
                    transform: beschreibungOffen ? "rotate(180deg)" : "none",
                    transition: "transform var(--dur-fast) var(--ease-out)",
                    lineHeight: 0,
                  }}
                >
                  <Icon name="chevron-down" size={14} strokeWidth={2.2} />
                </span>
                Beschreibung der Kämpfer anpassen
              </button>
              <Collapse open={beschreibungOffen}>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  {zuordnungen.map((z, i) =>
                    z.ignoriert ? null : (
                      <div key={i} className="flex flex-col gap-3 rounded-field p-3" style={FLAECHE}>
                        <span style={{ font: "var(--type-body-strong)" }}>
                          {z.person ? z.person.name : `Kämpfer ${i + 1}`}
                        </span>
                        <Field label="Hose / Rashguard">
                          <input
                            value={z.clothing}
                            onChange={(e) => setzeKarte(i, { clothing: e.target.value })}
                            placeholder="z. B. schwarze Shorts, weißes Logo"
                            className="min-h-hit rounded-field px-3"
                            style={inputStyle}
                          />
                        </Field>
                        <Field label="Merkmale (Tattoos, Haare, Statur …)">
                          <input
                            value={z.features}
                            onChange={(e) => setzeKarte(i, { features: e.target.value })}
                            placeholder="z. B. Tattoo rechter Unterarm, der Größere"
                            className="min-h-hit rounded-field px-3"
                            style={inputStyle}
                          />
                        </Field>
                      </div>
                    ),
                  )}
                </div>
              </Collapse>
            </div>

            {hinweis && (
              <div
                className="rounded-field px-3 py-2"
                style={{
                  font: "var(--type-sub)",
                  color: "var(--warning)",
                  border: "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
                }}
                role="status"
              >
                {hinweis}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Voll farbig erst, wenn alles steht — sonst sagt der Klick, was
                  fehlt. BEWUSST kein `aria-disabled`: Der Knopf IST klickbar,
                  er antwortet mit dem Hinweis; ein „deaktiviert" wäre eine
                  falsche Aussage an Screenreader und Tests. */}
              <button
                type="button"
                onClick={handleAnalysieren}
                data-bereit={bereit || undefined}
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: bereit ? "var(--accent)" : "var(--accent-subtle)",
                  color: bereit ? "var(--on-accent)" : "var(--accent-text)",
                  boxShadow: bereit ? "var(--accent-glow)" : undefined,
                  border: bereit ? undefined : "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
                  transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
                }}
              >
                <Icon name="spark" size={13} strokeWidth={2.4} />
                Analysieren
              </button>
              <button
                type="button"
                onClick={verwerfen}
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
                style={{ ...BTN_FONT, color: "var(--text-2)" }}
              >
                Verwerfen
              </button>
            </div>
          </div>
        )}
      </Collapse>

      {/* ── Schritt 5: Fertig ─────────────────────────────────────────────── */}
      <Collapse open={schritt === "fertig" && !running}>
        <div className="flex flex-col gap-3 rounded-card p-4" style={FLAECHE}>
          <div>
            <div className="t-label" style={{ color: "var(--positive)" }}>
              Im Profil
            </div>
            <p className="mt-0.5" style={{ font: "var(--type-body-strong)" }}>
              {(ergebnisse ?? []).length === 1
                ? "Die Auswertung ist gespeichert und eingerechnet."
                : `${(ergebnisse ?? []).length} Auswertungen sind gespeichert und eingerechnet.`}
            </p>
          </div>
          <StaggerFlow className="flex flex-col gap-2">
            {(ergebnisse ?? []).map((e, i) => (
              <FlowItem key={`${e.person.kind}:${e.person.id}`} index={i}>
                <Link
                  href={`/trainer/deepfight/analyse?modus=${e.person.kind}&ziel=${e.person.id}&analyse=${e.analysisId}`}
                  data-press="quiet"
                  className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2"
                  style={{ ...FLAECHE, textDecoration: "none", color: "var(--text-body)" }}
                >
                  <span
                    className="shrink-0"
                    style={{ color: e.person.kind === "gegner" ? "var(--text-2)" : "var(--accent-text)", lineHeight: 0 }}
                  >
                    <Icon name="user" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ font: "var(--type-body-strong)" }}>
                      {e.person.name}
                    </span>
                    <span className="block truncate" style={{ ...META_FONT, color: "var(--text-2)" }}>
                      {e.strength ? `zählt zu ${e.strength} Prozent` : "zählt noch nicht — Kämpfer unsicher"} · Ergebnis
                      ansehen
                    </span>
                  </span>
                  <span aria-hidden style={{ color: "var(--text-2)", lineHeight: 0 }}>
                    <Icon name="arrow-right" size={16} strokeWidth={2.2} />
                  </span>
                </Link>
              </FlowItem>
            ))}
          </StaggerFlow>
          <div>
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

      {/* ── Läuft: Vollbild-Overlay ───────────────────────────────────────── */}
      {running && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
          style={{
            background: "color-mix(in oklab, var(--surface-page) 92%, transparent)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
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
                ? "Kämpfer finden"
                : laufKarte
                  ? `${laufKarte.name} (${laufKarte.i} von ${laufKarte.n})`
                  : "Analyse"}
          </p>
          <p className="mt-1 max-w-xs text-center" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            {stage === "gemini"
              ? "Video-Beobachtung"
              : stage === "claude"
                ? "Bewertung & Analyse"
                : stage === "save"
                  ? "Speichern und Profil rechnen"
                  : stage === "vorlauf"
                    ? "Das dauert nur kurz."
                    : "Lass die App im Vordergrund — der Bildschirm bleibt von selbst an."}
            {stageDetail && (
              <span className="block" style={{ color: "var(--accent-text)" }}>
                {stageDetail}
              </span>
            )}
          </p>
        </div>
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
            <div>
              <h2 className="t-sheet-title">{sheet?.kind === "gegner" ? "Welcher Gegner?" : "Welcher Athlet?"}</h2>
              <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                {sheet ? `Für Kämpfer ${sheet.karte + 1}. ` : ""}
                Wer schon auf der anderen Karte sitzt, steht grau.
              </p>
            </div>
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
                  ? "Niemand passt zu deiner Suche."
                  : sheet?.kind === "gegner"
                    ? "Noch kein Gegner angelegt. Leg ihn in der Gegner-Bibliothek an."
                    : "Niemand sichtbar."}
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
                          Sitzt auf Kämpfer {andereKarte! + 1}
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
    </div>
  );
}
