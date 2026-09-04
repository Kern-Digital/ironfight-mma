"use client";

/**
 * „Sichtbarkeit bearbeiten" — die Freigabe des eigenen Profils an Kollegen.
 * Sheet in der Picker-Optik, geöffnet aus `components/ProfileShareButton`.
 * Muster: components/MemberRoleSheet.tsx.
 *
 * WARUM DIE HÄKCHEN HIER STEHEN UND NICHT IN DER KARTE: Dieselbe Begründung
 * wie beim Rechte-Sheet — ein Fehlgriff auf dem Handy gäbe sonst das eigene
 * Kampfprofil her, und zurücknehmen kann man den Klick, das Gelesene nicht.
 * Dazu brauchen die Bereiche Platz: Was „Kampfprofil & DeepFight" umfasst,
 * versteht niemand aus zwei Wörtern.
 *
 * GRUPPIERT NACH MENSCH, NICHT NACH BEREICH. Die Frage, die jemand hier
 * beantwortet, lautet „was darf Roman sehen" — nicht „wer darf mein
 * Kampfprofil sehen". Bei drei Trainern im Gym ist das auch die kürzere Liste.
 *
 * Der Client zeigt nur an. Durchgesetzt wird es in `firestore.rules`:
 * `hatFreigabe(d, bereich)` liest genau die Schlüssel aus
 * `lib/profile-sharing.ts` — und `allow update` am users-Dokument lässt
 * `profileShares` ausdrücklich zu, weil das Feld dem Inhaber gehört.
 */

import Icon from "@/components/ui/Icon";
import type { GeteiltMitMir } from "@/components/ProfileShareButton";
import type { StudentEntry } from "@/lib/admin";
import { memberName } from "@/lib/members";
import Link from "next/link";
import {
  SHARE_AREAS,
  bereicheFuer,
  gleicheShares,
  mitBereich,
  satzFuerPerson,
  type ProfileShares,
} from "@/lib/profile-sharing";
import { useEffect, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Zwei Buchstaben aus dem Namen — dieselbe Regel wie in der Sidebar. */
function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return "?";
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[1][0]).toUpperCase();
}

/**
 * Ein Bereich als Schalter. Kein `<input>` im `<button>` — das Kästchen ist
 * Anzeige, der ganze Chip ist das Klickziel (Höhe `--hit-min`).
 */
function BereichChip({
  label,
  an,
  gesperrt,
  onToggle,
}: {
  label: string;
  an: boolean;
  gesperrt: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      disabled={gesperrt}
      onClick={onToggle}
      className="t-interactive flex min-h-hit flex-1 items-center gap-2 rounded-field px-3 text-left disabled:opacity-60"
      style={{
        font: "var(--type-sub)",
        background: an ? "var(--accent-subtle)" : "var(--surface-raised)",
        border: "1px solid",
        borderColor: an
          ? "color-mix(in oklab, var(--accent) 45%, transparent)"
          : "var(--line)",
        color: an ? "var(--accent-text)" : "var(--text-2)",
      }}
    >
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-badge"
        style={{
          background: an ? "var(--accent)" : "transparent",
          border: "1.5px solid",
          borderColor: an ? "var(--accent)" : "var(--line-strong)",
          color: "var(--on-accent)",
        }}
      >
        {an && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

export default function ProfileShareSheet({
  shares,
  kollegen,
  teilenMitMir,
  onSave,
  onClose,
}: {
  /** Der gespeicherte Stand. */
  shares: ProfileShares;
  /**
   * Trainer des eigenen Gyms, ohne einen selbst UND ohne Plattform-Admins —
   * die filtert `ProfileShareButton` heraus (Ghost-Konten, Begründung an
   * `isGhostAccount` in lib/admin.ts). Deshalb behandelt dieses Sheet jede
   * Zeile gleich: Wer hier steht, ist ein Kollege im Gym.
   */
  kollegen: StudentEntry[];
  /**
   * Die GEGENRICHTUNG: Kollegen, die MIR etwas freigegeben haben.
   *
   * Sie stand bis zum 04.09.2026 als zweiter Block in der Karte auf der Seite.
   * Mit der Karte ist sie hierher gezogen — sie gehört zur selben Frage
   * („wer sieht wen"), kostet keine eigene Abfrage und hätte sonst gar keinen
   * Ort mehr. Leer bleibt der Abschnitt weg.
   */
  teilenMitMir: GeteiltMitMir[];
  /** Speichert und schließt — wirft bei Fehler. */
  onSave: (naechste: ProfileShares) => Promise<void>;
  onClose: () => void;
}) {
  const [entwurf, setEntwurf] = useState<ProfileShares>(shares);
  /**
   * Welcher Kollege gerade aufgeklappt ist (Leon 04.09.2026: „erst anzeigen,
   * wenn man auf das Profil tippt").
   *
   * IMMER NUR EINER — dasselbe Muster wie das DeepFight-Akkordeon. Bei vier
   * Kollegen standen sonst zwölf Schalter untereinander, und die eigentliche
   * Frage („was darf Roman sehen") verschwand zwischen den Zeilen. Start
   * geschlossen: Wer das Sheet öffnet, will meist nur nachsehen, was gerade
   * gilt — und das steht schon im Satz unter dem Namen.
   */
  const [offenerKollege, setOffenerKollege] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !gleicheShares(entwurf, shares);

  useEffect(() => {
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = vorher;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function speichern() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(entwurf);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern hat gerade nicht geklappt.",
      );
    } finally {
      setSaving(false);
    }
  }

  const anzahl = kollegen.filter(
    (k) => bereicheFuer(entwurf, k.uid).length > 0,
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sichtbarkeit bearbeiten"
    >
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          animation: "fade-in 0.2s ease-out both",
        }}
        onClick={onClose}
      />
      <div
        className="pointer-events-auto animate-slide-up relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-lg sm:rounded-[var(--r-xl)]"
        style={{
          maxHeight: "80dvh",
          background: "var(--surface-card)",
          border: "1px solid transparent",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="flex min-w-0 flex-col items-start">
            <div
              aria-hidden
              className="mb-2 h-1 w-10 rounded-full sm:invisible"
              style={{ background: "var(--line-strong)" }}
            />
            <span className="t-sheet-title max-w-full truncate">
              Sichtbarkeit bearbeiten
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
            style={{ color: "var(--text-3)" }}
          >
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          <div className="flex flex-col gap-4 pb-2">
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Als Trainer entscheidest du selbst, mit wem du deine Daten und
              Analysen teilst.
            </p>

            {/* Was die Bereiche umfassen — EINMAL, statt unter jedem Häkchen
                jeder Person. Die Erklärung gehört zum Bereich, nicht zur
                Person (Regel „Hilfstexte erklärend"). */}
            <div
              className="flex flex-col gap-3 rounded-field p-3.5"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
              }}
            >
              {SHARE_AREAS.map((bereich) => (
                <div key={bereich.key} className="flex flex-col gap-0.5">
                  <span className="t-label">{bereich.label}</span>
                  <span
                    style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                  >
                    {bereich.umfasst}
                  </span>
                </div>
              ))}
            </div>

            {kollegen.length === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                In deinem Gym trainiert gerade kein zweiter Trainer. Sobald
                jemand das Trainer-Häkchen bekommt, steht er hier.
              </p>
            ) : (
              kollegen.map((kollege) => {
                const name = memberName(kollege);
                const aktive = bereicheFuer(entwurf, kollege.uid);
                const offen = offenerKollege === kollege.uid;
                return (
                  <div
                    key={kollege.uid}
                    className="t-card flex flex-col gap-3 p-3.5"
                  >
                    {/* DIE GANZE ZEILE IST DAS KLICKZIEL — Bild, Name und
                        Satz gehören zusammen, und auf dem Handy wäre ein
                        Pfeil allein ein 16-px-Ziel. */}
                    <button
                      type="button"
                      aria-expanded={offen}
                      onClick={() =>
                        setOffenerKollege(offen ? null : kollege.uid)
                      }
                      className="t-interactive -m-1 flex items-center gap-3 rounded-field p-1 text-left"
                    >
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
                        style={{
                          font: "var(--type-body-strong)",
                          letterSpacing: "var(--ls-label)",
                          background: "var(--accent-subtle)",
                          border:
                            "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
                          color: "var(--accent-text)",
                        }}
                      >
                        {initialen(name)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="truncate"
                          style={{ font: "var(--type-body-strong)" }}
                        >
                          {name}
                        </span>
                        {/* Der Satz FOLGT der Auswahl — siehe
                            satzFuerPerson() in lib/profile-sharing.ts. Er
                            trägt im zugeklappten Zustand die ganze Auskunft. */}
                        <span
                          style={{
                            font: "var(--type-sub)",
                            color: "var(--text-3)",
                          }}
                        >
                          {satzFuerPerson(aktive)}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{
                          color: "var(--text-3)",
                          transform: offen ? "rotate(180deg)" : "none",
                          transition:
                            "transform var(--dur-fast) var(--ease-out)",
                          lineHeight: 0,
                        }}
                      >
                        <Icon name="chevron-down" size={16} strokeWidth={2.4} />
                      </span>
                    </button>

                    {/* EINE ZEILE JE BEREICH, auch am Desktop (Leon
                        04.09.2026). Nebeneinander blieben bei drei Bereichen
                        141 px je Chip — „Athletenprofil & Training" brach
                        dort mitten im Namen um und stand zweizeilig neben
                        einem einzeiligen „Wettkämpfe". Untereinander trägt
                        jeder Chip seinen Namen in einer Zeile. */}
                    {offen && (
                    <div className="flex flex-col gap-2">
                      {SHARE_AREAS.map((bereich) => (
                        <BereichChip
                          key={bereich.key}
                          label={bereich.label}
                          an={aktive.includes(bereich.key)}
                          gesperrt={saving}
                          onToggle={() =>
                            setEntwurf((v) =>
                              mitBereich(
                                v,
                                bereich.key,
                                kollege.uid,
                                !bereicheFuer(v, kollege.uid).includes(
                                  bereich.key,
                                ),
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                    )}
                  </div>
                );
              })
            )}

            {/* ─── Und was umgekehrt bei mir ankommt ─────────────────────── */}
            {teilenMitMir.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">
                <div
                  aria-hidden
                  style={{ height: "1px", background: "var(--line)" }}
                />
                <span className="t-label pt-2">Mit dir geteilt</span>
                {teilenMitMir.map(({ eintrag, bereiche }) => (
                  // NAME OBEN, BEREICHE DARUNTER — nebeneinander drängte die
                  // Bereichszeile den Namen auf 390 px vollständig aus der
                  // Zeile und lief 23 px über den Rand (gemessen 03.09.2026).
                  <Link
                    key={eintrag.uid}
                    href={`/trainer/athleten/${eintrag.uid}`}
                    className="t-interactive flex min-h-hit items-center gap-3 rounded-field px-2 py-1.5"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className="truncate"
                        style={{ font: "var(--type-body-strong)" }}
                      >
                        {memberName(eintrag)}
                      </span>
                      <span
                        className="truncate"
                        style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                      >
                        {bereiche
                          .map(
                            (b) => SHARE_AREAS.find((a) => a.key === b)?.label ?? b,
                          )
                          .join(" · ")}
                      </span>
                    </span>
                    <span aria-hidden style={{ color: "var(--text-3)" }}>
                      <Icon name="arrow-right" size={16} strokeWidth={2.2} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 border-t px-5 pt-3"
          style={{
            borderColor: "var(--line)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          <span
            className="min-w-0 flex-1"
            style={{
              font: "var(--type-sub)",
              color: error ? "var(--negative)" : "var(--text-3)",
            }}
          >
            {error ??
              (dirty
                ? anzahl === 0
                  ? "Neu: dein Profil bleibt bei dir"
                  : `Neu: ${anzahl} ${anzahl === 1 ? "Kollege sieht" : "Kollegen sehen"} etwas von dir`
                : "")}
          </span>
          <button
            type="button"
            onClick={() => void speichern()}
            disabled={!dirty || saving}
            className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
            }}
          >
            <Icon name="check" size={13} strokeWidth={2.6} />
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
