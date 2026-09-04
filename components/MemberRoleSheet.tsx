"use client";

/**
 * Rechte eines Mitglieds ändern (Multi-Gym Phase 2, Checkpoint 2) — Sheet in
 * der Picker-Optik, geöffnet durch Klick auf eine Zeile der Mitgliederliste.
 * Muster: components/InviteCreateSheet.tsx.
 *
 * WARUM DIE HÄKCHEN HIER STEHEN UND NICHT IN DER LISTENZEILE: Ein Fehlgriff
 * auf dem Handy würde sonst gym-weite Rechte vergeben — und zurücknehmen
 * kann man einen Klick, das Wissen darüber nicht. Dazu brauchen die
 * Erklärungen Platz: Jedes Häkchen sagt in ganzen Sätzen, was es bedeutet,
 * und der Satz FOLGT dem Zustand (Regel „Hilfstexte erklärend").
 *
 * Der Client zeigt nur an. Entschieden wird in /api/members/role: Aufrufer
 * ist Verwaltung desselben Gyms, niemals `admin`, niemals ein gymId-Wechsel,
 * Aussperr-Schutz, Audit-Eintrag (Konzept §3, „Der Client zeigt an, der
 * Server entscheidet").
 */

import Icon from "@/components/ui/Icon";
import { MorphSwap, SheetShell, useLetzterWert } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import type { StudentEntry } from "@/lib/admin";
import {
  isPlatformAdmin,
  memberName,
  membershipLong,
  memberSince,
  removeMemberRequest,
  RIGHT_EXPLAIN,
  sameRights,
  setMemberRightsRequest,
  type MemberRights,
} from "@/lib/members";
import { rightsLabel } from "@/lib/roles";
import { useEffect, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * Ein Häkchen mit Erklärung darunter. Der ganze Block ist das Klickziel
 * (Touch-Ziel deutlich über 44 px), das Kästchen selbst ist nur Anzeige —
 * deshalb liegt hier kein <input> im <button>.
 */
function RightToggle({
  label,
  checked,
  disabled,
  explain,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  explain: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="t-interactive flex w-full items-start gap-3 rounded-field p-3 text-left disabled:opacity-50"
      style={{
        background: checked ? "var(--accent-subtle)" : "var(--surface-raised)",
        border: "1px solid",
        borderColor: checked ? "var(--accent)" : "var(--line)",
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px]"
        style={{
          background: checked ? "var(--accent)" : "transparent",
          border: "1.5px solid",
          borderColor: checked ? "var(--accent)" : "var(--line-strong)",
          color: "var(--on-accent)",
        }}
      >
        {checked && <Icon name="check" size={14} strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span
          style={{
            font: "var(--type-label)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            color: checked ? "var(--accent-text)" : "var(--text-body)",
          }}
        >
          {label}
        </span>
        <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {explain}
        </span>
      </span>
    </button>
  );
}

/** Inhalt INNERHALB der Huelle: sein Entwurf (gewaehlte Rechte) soll beim
 *  Schliessen verschwinden, nicht bis zum naechsten Oeffnen ueberdauern. */
function MemberRoleInhalt({
  member,
  onChanged,
  onClose,
}: {
  member: StudentEntry;
  /** Läuft nach erfolgreicher Änderung — die Liste liest neu. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { user, refreshRole } = useAuth();
  const current = member.rights;
  const [rights, setRights] = useState<MemberRights>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Entfernen fragt an Ort und Stelle nach (zweiter Klick bestätigt) statt
  // per Popup — Muster aus InviteDetailSheet. Der Vorgang ist umkehrbar
  // (neue Einladung), aber niemand soll ihn aus Versehen auslösen.
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const since = memberSince(member);

  const isAdminTarget = isPlatformAdmin(member);
  const isSelf = user?.uid === member.uid;
  const dirty = !sameRights(rights, current);
  // Sachliche Ansage, keine Warnung: Wer sich selbst das Verwaltungsrecht
  // nimmt, verliert genau diesen Bereich — das darf man wissen, bevor man
  // speichert.
  const losingOwnAccess = isSelf && current.verwaltung && !rights.verwaltung;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleRemove() {
    if (removing || !user) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      setError(null);
      return;
    }
    setRemoving(true);
    setError(null);
    try {
      await removeMemberRequest(await user.getIdToken(), member.uid);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entfernen fehlgeschlagen.");
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  }

  async function handleSave() {
    if (saving || !user || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await setMemberRightsRequest(await user.getIdToken(), member.uid, rights);
      // Die eigenen Rechte stehen im ID-Token — ohne Refresh liefe die App
      // bis zum nächsten stündlichen Token-Wechsel mit dem alten Stand
      // weiter (und die Middleware ließe einen weiter durch).
      if (isSelf) await refreshRole();
      onChanged();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="flex min-w-0 flex-col items-start">
            <div
              aria-hidden
              className="mb-2 h-1 w-10 rounded-full sm:invisible"
              style={{ background: "var(--line-strong)" }}
            />
            <span className="t-sheet-title max-w-full truncate">
              {memberName(member)}
            </span>
            <span
              className="max-w-full truncate"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {rightsLabel(current)}
              {member.email ? ` · ${member.email}` : ""}
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
              {isAdminTarget
                ? "Dieses Konto verwaltet die Plattform und hat damit ohnehin alle Rechte. Geändert wird das nicht hier, sondern zentral."
                : current.trainer || current.verwaltung
                  ? "Ändere, was diese Person in deinem Gym übernimmt."
                  : "Mach jemanden zum Trainer — oder erweitere dein Verwaltungsteam."}
            </p>

            {/* Zugehörigkeit: in der Liste steht die Kurzform, hier das
                genaue Datum. */}
            <div
              className="flex items-center gap-2.5"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              <Icon name="calendar" size={15} strokeWidth={2} />
              {membershipLong(since)}
            </div>

            <RightToggle
              label="Trainer"
              checked={rights.trainer}
              disabled={isAdminTarget || saving}
              explain={
                rights.trainer
                  ? RIGHT_EXPLAIN.trainer.on
                  : RIGHT_EXPLAIN.trainer.off
              }
              onToggle={() =>
                setRights((r) => ({ ...r, trainer: !r.trainer }))
              }
            />
            <RightToggle
              label="Verwaltung"
              checked={rights.verwaltung}
              disabled={isAdminTarget || saving}
              explain={
                rights.verwaltung
                  ? RIGHT_EXPLAIN.verwaltung.on
                  : RIGHT_EXPLAIN.verwaltung.off
              }
              onToggle={() =>
                setRights((r) => ({ ...r, verwaltung: !r.verwaltung }))
              }
            />

            {!isAdminTarget && !isSelf && (
              <div
                className="mt-1 flex flex-col gap-2 border-t pt-4"
                style={{ borderColor: "var(--line)" }}
              >
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={removing || saving}
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 self-start rounded-field px-4 disabled:opacity-50"
                  style={{
                    ...BTN_FONT,
                    background: confirmRemove
                      ? "var(--negative)"
                      : "transparent",
                    border: "1px solid",
                    borderColor: confirmRemove
                      ? "var(--negative)"
                      : "var(--line)",
                    color: confirmRemove
                      ? "var(--on-accent)"
                      : "var(--negative)",
                  }}
                >
                  <Icon name="minus" size={13} strokeWidth={2.6} />
                  {removing
                    ? "Entferne…"
                    : confirmRemove
                      ? "Wirklich entfernen"
                      : "Aus dem Gym entfernen"}
                </button>
                {/* Kurzer Satz wird langer Warntext, und „Abbrechen" fliesst
                    mit herein — als EINE Verwandlung, damit die Hoehe federt
                    statt zu springen. Der Knopf darueber bleibt bewusst
                    draussen: Er traegt schon die CSS-Grundhaptik, und zwei
                    Federn auf einem Element multiplizieren sich
                    (MOTION-BRIEF §3.8). Sein Farbwechsel ist CSS. */}
                <MorphSwap
                  activeKey={confirmRemove ? "confirm" : "idle"}
                  innerClassName="flex flex-col gap-2"
                >
                  <>
                    <p
                      style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    >
                      {confirmRemove
                        ? `${memberName(member)} gehört danach zu keinem Gym mehr: Kampfprofil, Analysen und Wettkämpfe sind für euch nicht mehr sichtbar, freigegebene Pläne und Gegnerprofile werden zurückgenommen. Mit einer neuen Einladung kann die Person jederzeit wiederkommen.`
                        : "Beendet die Mitgliedschaft. Das Konto bleibt bestehen — es gehört der Person, nicht dem Gym; löschen kann es nur sie selbst."}
                    </p>
                    {confirmRemove && !removing && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(false)}
                        className="t-interactive self-start rounded-field px-2 py-1"
                        style={{ ...BTN_FONT, color: "var(--text-3)" }}
                      >
                        Abbrechen
                      </button>
                    )}
                  </>
                </MorphSwap>
              </div>
            )}

            {losingOwnAccess && (
              <p
                className="rounded-field p-3"
                style={{
                  font: "var(--type-sub)",
                  color: "var(--text-2)",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                }}
              >
                Das bist du selbst: Nach dem Speichern verwaltet jemand anderes
                das Gym, und dieser Bereich ist für dich nicht mehr sichtbar.
              </p>
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
            {error ?? (dirty ? `Neu: ${rightsLabel(rights)}` : "")}
          </span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || saving || isAdminTarget}
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
    </>
  );
}

export default function MemberRoleSheet({
  member,
  onChanged,
  onClose,
}: {
  /** null heisst geschlossen — der Aufrufer setzt es beim Schliessen. */
  member: StudentEntry | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  // Waehrend der Austritts-Feder ist `member` schon null; ohne den letzten
  // Wert fuehre ein leeres Panel hinaus.
  const zeigen = useLetzterWert(member);
  return (
    <SheetShell
      open={member !== null}
      onClose={onClose}
      label={zeigen ? `Rechte von ${memberName(zeigen)}` : "Rechte"}
      panelClassName="pointer-events-auto relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "80dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {zeigen && (
        <MemberRoleInhalt
          member={zeigen}
          onChanged={onChanged}
          onClose={onClose}
        />
      )}
    </SheetShell>
  );
}
