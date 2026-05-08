"use client";

import AdminRoute from "@/components/AdminRoute";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { listAllUsers, setUserRole, type AdminUserEntry } from "@/lib/admin";
import type { UserRole } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";

// ─── Rollen-Konfiguration ──────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string; color: string; bg: string; border: string }[] = [
  {
    value: "user",
    label: "Mitglied",
    color: "var(--fg-3)",
    bg: "var(--ink-4)",
    border: "var(--ink-5)",
  },
  {
    value: "trainer",
    label: "Trainer",
    color: "var(--ta-cyan)",
    bg: "rgba(0,212,230,.1)",
    border: "rgba(0,212,230,.35)",
  },
  {
    value: "admin",
    label: "Admin",
    color: "#FBBF24",
    bg: "rgba(251,191,36,.1)",
    border: "rgba(251,191,36,.35)",
  },
];

function roleMeta(role: UserRole | undefined) {
  return ROLES.find((r) => r.value === (role ?? "user")) ?? ROLES[0];
}

// ─── Initialen ────────────────────────────────────────────────────────────

function initials(entry: AdminUserEntry): string {
  const name = entry.displayName ?? entry.authProviderName ?? entry.email ?? "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function displayLabel(entry: AdminUserEntry): string {
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? entry.uid;
}

// ─── Nutzerzeile ───────────────────────────────────────────────────────────

function UserRow({
  entry,
  isSelf,
  onRoleChange,
}: {
  entry: AdminUserEntry;
  isSelf: boolean;
  onRoleChange: (uid: string, role: UserRole) => void;
}) {
  const [pending, setPending] = useState(false);
  const meta = roleMeta(entry.role);

  async function handleRoleChange(newRole: UserRole) {
    if (pending || newRole === (entry.role ?? "user")) return;
    setPending(true);
    try {
      await onRoleChange(entry.uid, newRole);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
        border: isSelf ? "1px solid rgba(251,191,36,.3)" : "1px solid var(--ink-4)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display-ta text-sm font-black"
          style={{
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            color: meta.color,
          }}
        >
          {initials(entry)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-display-ta font-bold uppercase truncate"
              style={{ fontSize: "14px", letterSpacing: "0.04em", color: "var(--fg-1)" }}
            >
              {displayLabel(entry)}
            </span>
            {isSelf && (
              <span
                className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] uppercase"
                style={{
                  letterSpacing: "0.15em",
                  background: "rgba(251,191,36,.12)",
                  border: "1px solid rgba(251,191,36,.35)",
                  color: "#FBBF24",
                }}
              >
                Du
              </span>
            )}
            {/* Aktuelle Rolle */}
            <span
              className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] uppercase"
              style={{
                letterSpacing: "0.15em",
                background: meta.bg,
                border: `1px solid ${meta.border}`,
                color: meta.color,
              }}
            >
              {meta.label}
            </span>
          </div>

          {/* E-Mail */}
          {entry.email && (
            <div
              className="font-mono-ta mt-0.5 truncate text-[10px]"
              style={{ letterSpacing: "0.08em", color: "var(--fg-4)" }}
            >
              {entry.email}
            </div>
          )}

          {/* Registrierungsdatum */}
          {entry.createdAt && (
            <div
              className="font-mono-ta text-[9px]"
              style={{ letterSpacing: "0.08em", color: "var(--fg-4)" }}
            >
              Seit {entry.createdAt.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          )}
        </div>
      </div>

      {/* Rollen-Buttons */}
      <div className="mt-3 flex gap-2">
        {ROLES.map((r) => {
          const isActive = (entry.role ?? "user") === r.value;
          const isDisabled = pending || (isSelf && r.value !== "admin");
          return (
            <button
              key={r.value}
              onClick={() => handleRoleChange(r.value)}
              disabled={isDisabled}
              className="flex-1 rounded-xl py-1.5 text-[10px] font-bold uppercase transition-all"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                background: isActive ? r.bg : "var(--ink-3)",
                border: `1px solid ${isActive ? r.border : "var(--ink-5)"}`,
                color: isActive ? r.color : "var(--fg-4)",
                opacity: isDisabled && !isActive ? 0.4 : 1,
                cursor: isDisabled ? "not-allowed" : "pointer",
              }}
            >
              {pending && isActive ? "…" : r.label}
            </button>
          );
        })}
      </div>

      {isSelf && (
        <p
          className="font-mono-ta mt-2 text-[9px]"
          style={{ letterSpacing: "0.08em", color: "var(--fg-4)" }}
        >
          Deine eigene Rolle kann nicht geändert werden.
        </p>
      )}
    </div>
  );
}

// ─── Filter-Tabs ──────────────────────────────────────────────────────────

type Filter = "all" | UserRole;

const FILTER_TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "admin", label: "Admins" },
  { value: "trainer", label: "Trainer" },
  { value: "user", label: "Mitglieder" },
];

// ─── Hauptinhalt ──────────────────────────────────────────────────────────

function AdminUsersContent() {
  const [users, setUsers] = useState<AdminUserEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selfUid, setSelfUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setUsers(null);
    try {
      // selfUid aus dem Auth-Context holen (via window.__selfUid gesetzt vom AdminRoute)
      const { getFirebaseAuth } = await import("@/lib/firebase");
      setSelfUid(getFirebaseAuth().currentUser?.uid ?? null);
      const data = await listAllUsers();
      setUsers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(msg);
      setUsers([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(uid: string, role: UserRole) {
    await setUserRole(uid, role);
    setUsers((prev) =>
      prev ? prev.map((u) => (u.uid === uid ? { ...u, role } : u)) : prev,
    );
  }

  // Filter + Suche
  const filtered = (users ?? []).filter((u) => {
    const matchesFilter =
      filter === "all" || (u.role ?? "user") === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (u.displayName ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.authProviderName ?? "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  // Zähler für Tabs
  const counts = {
    all: (users ?? []).length,
    admin: (users ?? []).filter((u) => u.role === "admin").length,
    trainer: (users ?? []).filter((u) => u.role === "trainer").length,
    user: (users ?? []).filter((u) => (u.role ?? "user") === "user").length,
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b px-4 py-10 sm:px-6"
        style={{
          borderColor: "rgba(251,191,36,.2)",
          background:
            "radial-gradient(400px 250px at 100% 50%, rgba(251,191,36,.1), transparent 60%), linear-gradient(160deg, #0d0b04, #050505)",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="font-mono-ta rounded px-2 py-0.5 text-[10px] font-black uppercase"
              style={{
                letterSpacing: "0.2em",
                background: "rgba(251,191,36,.12)",
                border: "1px solid rgba(251,191,36,.4)",
                color: "#FBBF24",
              }}
            >
              Admin
            </span>
          </div>
          <h1
            className="font-display-ta font-black uppercase leading-none"
            style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "0.02em" }}
          >
            Nutzerverwaltung
          </h1>
          <p
            className="font-mono-ta mt-2 text-[11px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Rollen zuweisen · Mitglieder & Trainer verwalten
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6">
            <ErrorState
              title="Nutzer konnten nicht geladen werden"
              message={error}
              hint="Prüfe die Firestore-Regeln — Admin muss Lesezugriff auf die users-Collection haben."
              onRetry={load}
            />
          </div>
        )}

        {/* Suche + Filter */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Suche nach Name oder E-Mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm sm:max-w-xs"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
              color: "var(--fg-1)",
              outline: "none",
            }}
          />
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.value;
              const count = counts[tab.value];
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase transition-all"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.12em",
                    background: active ? "rgba(251,191,36,.12)" : "var(--ink-3)",
                    border: `1px solid ${active ? "rgba(251,191,36,.4)" : "var(--ink-5)"}`,
                    color: active ? "#FBBF24" : "var(--fg-4)",
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-md px-1 py-0.5 text-[9px]"
                    style={{
                      background: active ? "rgba(251,191,36,.2)" : "var(--ink-4)",
                      color: active ? "#FBBF24" : "var(--fg-4)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nutzerliste */}
        {users === null && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {users !== null && filtered.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ border: "1px dashed var(--ink-5)", background: "var(--ink-2)" }}
          >
            <p className="text-sm" style={{ color: "var(--fg-4)" }}>
              {search ? "Keine Nutzer gefunden." : "Noch keine Nutzer registriert."}
            </p>
          </div>
        )}

        {users !== null && filtered.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
              <UserRow
                key={entry.uid}
                entry={entry}
                isSelf={entry.uid === selfUid}
                onRoleChange={handleRoleChange}
              />
            ))}
          </div>
        )}

        {/* Info-Kasten */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            background: "var(--ink-2)",
            border: "1px solid var(--ink-4)",
          }}
        >
          <p
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Rollenübersicht
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ROLES.map((r) => (
              <div
                key={r.value}
                className="rounded-xl p-3"
                style={{
                  background: r.bg,
                  border: `1px solid ${r.border}`,
                }}
              >
                <span
                  className="font-mono-ta text-[10px] font-black uppercase"
                  style={{ letterSpacing: "0.15em", color: r.color }}
                >
                  {r.label}
                </span>
                <p className="mt-1 text-xs" style={{ color: "var(--fg-3)" }}>
                  {r.value === "user" && "Kann trainieren, Techniken ansehen, am Stundenplan teilnehmen."}
                  {r.value === "trainer" && "Zusätzlich: Übungen im Stundenplan hinterlegen, Trainer-Dashboard."}
                  {r.value === "admin" && "Vollzugriff: Trainer-Rechte + Nutzerverwaltung."}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  return (
    <AdminRoute>
      <AdminUsersContent />
    </AdminRoute>
  );
}
