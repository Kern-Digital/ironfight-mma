"use client";

import AdminRoute from "@/components/AdminRoute";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DashboardHero from "@/components/dashboard/DashboardHero";
import SectionCard from "@/components/dashboard/SectionCard";
import EmptyState from "@/components/dashboard/EmptyState";
import Reveal from "@/components/dashboard/Reveal";
import { listAllUsers, type AdminUserEntry } from "@/lib/admin";
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
    bg: "rgba(35,196,206,.1)",
    border: "rgba(35,196,206,.35)",
  },
  {
    value: "admin",
    label: "Admin",
    color: "#8A63E8",
    bg: "rgba(138,99,232,.1)",
    border: "rgba(138,99,232,.35)",
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
}: {
  entry: AdminUserEntry;
  isSelf: boolean;
}) {
  const meta = roleMeta(entry.role);

  return (
    <div
      className="card-glass !p-4"
      style={
        isSelf ? { borderColor: "rgba(138,99,232,.3)" } : undefined
      }
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
                  background: "rgba(138,99,232,.12)",
                  border: "1px solid rgba(138,99,232,.35)",
                  color: "#8A63E8",
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
    <main className="min-h-screen">
      <DashboardHero
        badges={[{ label: "Admin", accent: "amber", icon: "shield" }]}
        accent="amber"
        title="Nutzerverwaltung"
        subtitle="Mitglieder & Trainer einsehen · Rollen werden per Script vergeben"
      />

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
                    background: active ? "rgba(138,99,232,.12)" : "var(--ink-3)",
                    border: `1px solid ${active ? "rgba(138,99,232,.4)" : "var(--ink-5)"}`,
                    color: active ? "#8A63E8" : "var(--fg-4)",
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-md px-1 py-0.5 text-[9px]"
                    style={{
                      background: active ? "rgba(138,99,232,.2)" : "var(--ink-4)",
                      color: active ? "#8A63E8" : "var(--fg-4)",
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
          <EmptyState
            icon="users"
            title={search ? "Keine Nutzer gefunden." : "Noch keine Nutzer registriert."}
          />
        )}

        {users !== null && filtered.length > 0 && (
          <Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entry) => (
                <UserRow
                  key={entry.uid}
                  entry={entry}
                  isSelf={entry.uid === selfUid}
                />
              ))}
            </div>
          </Reveal>
        )}

        {/* Info-Kasten */}
        <SectionCard
          title="Rollenübersicht"
          icon="shield"
          accent="var(--ta-amber)"
          className="mt-8"
        >
          <div className="grid gap-2 sm:grid-cols-3">
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
          <p className="mt-3 text-xs" style={{ color: "var(--fg-4)" }}>
            Rollen werden serverseitig per Admin-SDK-Script vergeben
            (<span className="font-mono-ta">scripts/set-role.mjs</span>) — aus
            Sicherheitsgründen nicht mehr direkt in der App.
          </p>
        </SectionCard>
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
