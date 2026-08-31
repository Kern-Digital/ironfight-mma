"use client";

/**
 * Einladung im Detail (Multi-Gym Phase 2, Checkpoint 1B) — Sheet in der
 * Picker-Optik, geöffnet durch Klick auf eine Zeile der Übersicht.
 *
 * Warum ein Sheet und keine Detailseite: Es gibt hier nichts zu bearbeiten.
 * Eine Einladung hat genau zwei Handlungen — Link kopieren und Zurückziehen —
 * und ein paar Fakten. Eine eigene Route mit Ladezustand wäre dafür zu viel
 * Apparat, und die Liste bleibt so als Kontext sichtbar.
 *
 * Zurückziehen fragt an Ort und Stelle nach (zweiter Klick bestätigt) statt
 * per Popup: der Vorgang ist nicht rückholbar, aber auch nicht zerstörerisch —
 * der Eintrag bleibt mit `revokedAt` stehen.
 */

import Icon from "@/components/ui/Icon";
import InviteStatusChip from "@/components/InviteStatusChip";
import { useAuth } from "@/lib/auth-context";
import { copyText } from "@/lib/clipboard";
import {
  formatInviteCode,
  INVITE_ROLE_LABEL,
  inviteJoinUrl,
  inviteStatus,
  revokeInviteRequest,
  updateInviteNoteRequest,
  type GymInvite,
} from "@/lib/invites";
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

const DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(d: Date | null): string {
  return d ? DATE_FMT.format(d) : "—";
}

/** Eine Zeile „Merkmal — Wert" im Faktenblock. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <span style={{ ...META_FONT, color: "var(--text-3)" }}>{label}</span>
      <span
        className="min-w-0 truncate text-right"
        style={{ font: "var(--type-body)", color: "var(--text-body)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function InviteDetailSheet({
  invite,
  onChanged,
  onClose,
}: {
  invite: GymInvite;
  /** Läuft nach jeder Änderung (Notiz, Zurückziehen) — die Liste liest neu. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Notiz wird hier bearbeitet (Leon 31.08.) — geschrieben über
  // /api/invites/note, weil Einladungen für Clients schreibgeschützt sind.
  const [note, setNote] = useState(invite.note);
  const [savedNote, setSavedNote] = useState(invite.note);
  const [savingNote, setSavingNote] = useState(false);
  const noteDirty = note.trim() !== savedNote.trim();

  const status = inviteStatus(invite);
  const canRevoke = status === "open" || status === "expired";

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

  async function handleCopy() {
    const ok = await copyText(inviteJoinUrl(invite.code));
    if (!ok) {
      setError("Kopieren hat nicht geklappt — Link bitte von Hand übernehmen.");
      return;
    }
    setCopied(true);
    setError(null);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveNote() {
    if (savingNote || !user || !noteDirty) return;
    setSavingNote(true);
    setError(null);
    try {
      const stored = await updateInviteNoteRequest(
        await user.getIdToken(),
        invite.code,
        note,
      );
      // Der Server trimmt und kürzt — die gespeicherte Fassung gewinnt,
      // sonst bliebe das Feld nach dem Speichern „schmutzig".
      setNote(stored);
      setSavedNote(stored);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleRevoke() {
    if (busy || !user) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await revokeInviteRequest(await user.getIdToken(), invite.code);
      onChanged();
      onClose();
    } catch (err) {
      setBusy(false);
      setConfirming(false);
      setError(
        err instanceof Error ? err.message : "Zurückziehen fehlgeschlagen",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Einladung ${formatInviteCode(invite.code)}`}
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
        className="pointer-events-auto animate-slide-up relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
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
            <span className="t-sheet-title">Einladung</span>
            <span
              className="max-w-full truncate"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {INVITE_ROLE_LABEL[invite.role]}
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
            <div className="flex flex-col items-center gap-3">
              <span
                className="font-mono-ta text-center text-2xl sm:text-3xl"
                style={{ fontWeight: 700, color: "var(--text-body)" }}
              >
                {formatInviteCode(invite.code)}
              </span>
              <InviteStatusChip invite={invite} />
            </div>

            {/* Notiz — hier bearbeitbar. Der Speichern-Knopf erscheint erst,
                wenn sich etwas geändert hat: kein toter Knopf im Blick. */}
            <div className="flex flex-col gap-2">
              <span className="t-label">Notiz</span>
              <input
                type="text"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Anfängerkurs September"
                aria-label="Notiz"
                className="t-interactive min-h-hit w-full rounded-field px-3.5"
                style={{
                  font: "var(--type-body)",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                  color: "var(--text-body)",
                  outline: "none",
                }}
              />
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Die Notiz hilft dir, den Code später wiederzuerkennen — sie
                steht nur in deiner Übersicht, nie im Link.
              </p>
              {noteDirty && (
                <button
                  type="button"
                  onClick={() => void handleSaveNote()}
                  disabled={savingNote}
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 self-start rounded-field px-5 disabled:opacity-50"
                  style={{
                    ...BTN_FONT,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    boxShadow: "var(--accent-glow)",
                  }}
                >
                  <Icon name="check" size={13} strokeWidth={2.4} />
                  {savingNote ? "Speichere…" : "Notiz speichern"}
                </button>
              )}
            </div>

            <div className="flex flex-col">
              <Fact
                label="Einlösungen"
                value={`${invite.usedCount} von ${invite.maxUses}`}
              />
              <Fact label="Gültig bis" value={formatDate(invite.expiresAt)} />
              <Fact
                label="Erstellt"
                value={
                  invite.createdByName
                    ? `${formatDate(invite.createdAt)} · ${invite.createdByName}`
                    : formatDate(invite.createdAt)
                }
              />
              {invite.revokedAt && (
                <Fact
                  label="Zurückgezogen"
                  value={formatDate(invite.revokedAt)}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className="t-interactive inline-flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background:
                  status === "open" ? "var(--accent)" : "var(--surface-raised)",
                border:
                  status === "open" ? "1px solid transparent" : "1px solid var(--line)",
                color:
                  status === "open" ? "var(--on-accent)" : "var(--text-body)",
                boxShadow: status === "open" ? "var(--accent-glow)" : undefined,
              }}
            >
              <Icon
                name={copied ? "check" : "copy"}
                size={13}
                strokeWidth={2.4}
              />
              {copied ? "Kopiert" : "Link kopieren"}
            </button>
            {status !== "open" && (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Dieser Link ist nicht mehr gültig — er bleibt nur als Nachweis
                stehen.
              </p>
            )}
          </div>
        </div>

        {/* ── Fuß: Zurückziehen ── */}
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
              (confirming ? "Wirklich? Der Code gilt danach nicht mehr." : "")}
          </span>
          {canRevoke && (
            <button
              type="button"
              onClick={() => void handleRevoke()}
              disabled={busy}
              className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
              style={{
                ...BTN_FONT,
                background: confirming
                  ? "color-mix(in oklab, var(--negative) 16%, transparent)"
                  : "var(--surface-raised)",
                border: `1px solid ${
                  confirming
                    ? "color-mix(in oklab, var(--negative) 55%, transparent)"
                    : "var(--line)"
                }`,
                color: "var(--negative)",
              }}
            >
              <Icon name="trash" size={13} strokeWidth={2.2} />
              {busy
                ? "Ziehe zurück…"
                : confirming
                  ? "Ja, zurückziehen"
                  : "Zurückziehen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
