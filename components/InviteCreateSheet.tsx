"use client";

/**
 * Einladung ausstellen (Multi-Gym Phase 2, Checkpoint 1B) — Sheet in der
 * Picker-Optik (Overlay, slide-up, Grabber, x schließt; Desktop zentriert),
 * Muster: components/PlanAudienceSheet.tsx.
 *
 * Drei Felder, weil mehr keine Entscheidung wäre:
 *   • Rolle — nur sichtbar, wenn der Betrachter Trainer einladen darf.
 *     Der Server prüft das ohnehin hart (403); das Feld verschwindet nur,
 *     damit niemand eine Option sieht, die er nicht hat.
 *   • „Für wen?" — eine Person (Code stirbt nach dem Einlösen) oder eine
 *     Gruppe mit Obergrenze. Das ist der eigentliche Schutz: ein
 *     weitergereichter Gruppen-Link kann höchstens so viele Fremde
 *     hereinlassen, wie hier steht.
 *   • Notiz — Freitext für die Übersicht (Serverlimit 120 Zeichen).
 * Die Gültigkeit bleibt fest bei INVITE_DEFAULT_DAYS (Leon 31.08.: ein
 * Wahlfeld, das immer auf dem Standard steht, macht das Formular nur länger).
 *
 * Nach dem Erstellen wechselt DASSELBE Sheet in den Erfolgszustand: der
 * frische Code ist der Zweck der Übung, er darf nicht in der Liste gesucht
 * werden müssen.
 */

import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { copyText } from "@/lib/clipboard";
import {
  createInviteRequest,
  formatInviteCode,
  INVITE_DEFAULT_DAYS,
  inviteJoinUrl,
  type CreateInviteResult,
  type InviteRole,
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

/** Gruppengrößen — Vorgaben statt freier Zahl (Serverobergrenze 200). */
const GROUP_SIZES = [5, 10, 20, 30, 50, 100, 200];

export default function InviteCreateSheet({
  canInviteTrainer,
  onCreated,
  onClose,
}: {
  /** Blendet die Rollen-Wahl ein (heute Admin, ab Checkpoint 3 Verwaltung). */
  canInviteTrainer: boolean;
  /** Läuft nach erfolgreichem Erstellen — die Liste liest neu. */
  onCreated: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const [role, setRole] = useState<InviteRole>("user");
  const [forGroup, setForGroup] = useState(false);
  const [groupSize, setGroupSize] = useState("10");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateInviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Body-Scroll-Lock (Muster der App-Sheets)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape schließt — auch im Erfolgszustand, der Code steht dann schon in
  // der Liste dahinter.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCreate() {
    if (saving || !user) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createInviteRequest(await user.getIdToken(), {
        role,
        maxUses: forGroup ? Number(groupSize) : 1,
        note: note.trim(),
      });
      setResult(created);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erstellen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    const ok = await copyText(inviteJoinUrl(result.code));
    if (!ok) {
      setError("Kopieren hat nicht geklappt — Link bitte von Hand übernehmen.");
      return;
    }
    setCopied(true);
    setError(null);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Einladung erstellen"
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
            <span className="t-sheet-title">
              {result ? "Einladung erstellt" : "Neue Einladung"}
            </span>
            <span
              className="max-w-full truncate"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {result
                ? `Gültig ${INVITE_DEFAULT_DAYS} Tage`
                : "So kommt jemand Neues dazu"}
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
          {result ? (
            /* ── Erfolgszustand: Code + Link ── */
            <div className="flex flex-col gap-4 pb-2">
              <div
                className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] px-4 py-6"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent)",
                }}
              >
                <span style={{ ...META_FONT, color: "var(--accent-text)" }}>
                  Code
                </span>
                <span
                  className="font-mono-ta text-center text-2xl sm:text-3xl"
                  style={{ fontWeight: 700, color: "var(--text-body)" }}
                >
                  {formatInviteCode(result.code)}
                </span>
              </div>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {result.maxUses === 1
                  ? "Schick den Link an die Person, die dazukommen soll: Sie legt ihr Konto an und ist danach Mitglied in deinem Gym. Danach ist der Link verbraucht."
                  : `Teil den Link mit deiner Gruppe: Jeder, der ihn öffnet, legt sein Konto an und ist danach Mitglied in deinem Gym — bis zu ${result.maxUses} Personen.`}
              </p>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="t-interactive inline-flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                <Icon
                  name={copied ? "check" : "copy"}
                  size={13}
                  strokeWidth={2.4}
                />
                {copied ? "Kopiert" : "Link kopieren"}
              </button>
            </div>
          ) : (
            /* ── Formular ── */
            <div className="flex flex-col gap-5 pb-2">
              {canInviteTrainer && (
                <div className="flex flex-col gap-2">
                  <span className="t-label">Beitritt als</span>
                  <Select
                    value={role}
                    onChange={(v) =>
                      setRole(v === "trainer" ? "trainer" : "user")
                    }
                    options={[
                      { value: "user", label: "Athlet" },
                      { value: "trainer", label: "Trainer" },
                    ]}
                  />
                  {/* Der Hinweis beschreibt IMMER die gerade gewählte Seite —
                      sonst liest man beim Athleten eine Trainer-Erklärung. */}
                  <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    {role === "trainer"
                      ? "Trainer sind dein Team — sie bekommen zusätzlich die Werkzeuge: DeepFight, Wettkämpfe und die Athletenliste."
                      : "Athleten trainieren bei dir — sie sehen ihre Kurse, ihre Workout-Pläne und ihr eigenes Kampfprofil."}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="t-label">Für wen?</span>
                <div className="flex gap-2">
                  {[
                    { group: false, label: "Eine Person" },
                    { group: true, label: "Für eine Gruppe" },
                  ].map((opt) => {
                    const active = forGroup === opt.group;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setForGroup(opt.group)}
                        aria-pressed={active}
                        className="t-interactive min-h-hit flex-1 rounded-field px-3"
                        style={{
                          font: "600 13px/1.2 var(--font-archivo), system-ui, sans-serif",
                          background: active
                            ? "var(--accent-subtle)"
                            : "var(--surface-raised)",
                          border: "1px solid",
                          borderColor: active ? "var(--accent)" : "var(--line)",
                          color: active ? "var(--accent-text)" : "var(--text-2)",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {forGroup ? (
                  <>
                    <Select
                      value={groupSize}
                      onChange={setGroupSize}
                      options={GROUP_SIZES.map((n) => ({
                        value: String(n),
                        label: `Bis zu ${n} Personen`,
                      }))}
                    />
                    <p
                      style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    >
                      Ein Link für alle — du postest ihn einmal, etwa im
                      Kurs-Chat, und jeder tritt selbst bei. Ist die Zahl
                      erreicht, ist der Link verbraucht.
                    </p>
                  </>
                ) : (
                  <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    Ein Link für genau einen Menschen — sobald er beigetreten
                    ist, ist der Link verbraucht.
                  </p>
                )}
              </div>

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
              </div>
            </div>
          )}
        </div>

        {/* ── Fuß ── */}
        <div
          className="flex items-center justify-between gap-3 border-t px-5 pt-3"
          style={{
            borderColor: "var(--line)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          <span
            className="min-w-0 flex-1 truncate"
            style={{
              font: "var(--type-sub)",
              color: error ? "var(--negative)" : "var(--text-3)",
            }}
          >
            {error ?? (result ? "" : `Gültig ${INVITE_DEFAULT_DAYS} Tage`)}
          </span>
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-body)",
              }}
            >
              Fertig
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
              className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="plus" size={13} strokeWidth={2.4} />
              {saving ? "Erstelle…" : "Erstellen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
