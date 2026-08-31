"use client";

/**
 * Status einer Einladung als Chip (Multi-Gym Phase 2, Checkpoint 1B).
 *
 * Der Status wird BERECHNET (lib/invites.ts → inviteStatus), nie gespeichert:
 * „abgelaufen" ist eine Frage der aktuellen Uhrzeit. Deshalb bekommt der Chip
 * die Einladung und nicht einen fertigen Zustand.
 *
 * Farbrollen statt Dekoration — je Zustand genau eine Aussage:
 *   offen = Akzent (nutzbar) · aufgebraucht = neutral (erledigt)
 *   abgelaufen = Warnung (verstrichen) · zurückgezogen = negativ (gestoppt)
 */

import {
  INVITE_STATUS_LABEL,
  inviteStatus,
  type GymInvite,
  type InviteStatus,
} from "@/lib/invites";

const TONE: Record<InviteStatus, { fg: string; bg: string; border: string }> = {
  open: {
    fg: "var(--accent-text)",
    bg: "var(--accent-subtle)",
    border: "var(--accent)",
  },
  usedUp: {
    fg: "var(--text-3)",
    bg: "var(--surface-raised)",
    border: "var(--line)",
  },
  expired: {
    fg: "var(--warning)",
    bg: "color-mix(in oklab, var(--warning) 14%, transparent)",
    border: "color-mix(in oklab, var(--warning) 45%, transparent)",
  },
  revoked: {
    fg: "var(--negative)",
    bg: "color-mix(in oklab, var(--negative) 12%, transparent)",
    border: "color-mix(in oklab, var(--negative) 40%, transparent)",
  },
};

export default function InviteStatusChip({
  invite,
}: {
  invite: Pick<GymInvite, "revokedAt" | "expiresAt" | "usedCount" | "maxUses">;
}) {
  const status = inviteStatus(invite);
  const tone = TONE[status];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-field px-2 py-1"
      style={{
        font: "600 10px/1 var(--font-archivo), system-ui, sans-serif",
        letterSpacing: "var(--ls-label)",
        textTransform: "uppercase",
        color: tone.fg,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {INVITE_STATUS_LABEL[status]}
    </span>
  );
}
