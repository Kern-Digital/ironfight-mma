"use client";

import PageHeader from "@/components/PageHeader";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";
import { useEffect, useState } from "react";

function ProfileContent() {
  const { user, profile, profileLoading, updateDisplayName, logOut } = useAuth();

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.displayName ?? "");
  }, [profile?.displayName]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingName(true);
    try {
      await updateDisplayName(name.trim() || null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingName(false);
    }
  }

  const greeting = greetingFor(profile?.displayName);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={greeting}
        description="Dein Profil, Anzeigename und persönliche Einstellungen."
      />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {profileLoading ? (
          <div className="card animate-pulse">
            <div className="h-4 w-32 bg-carbon-600 mb-3" />
            <div className="h-10 bg-carbon-600" />
          </div>
        ) : (
          <>
            {/* Fighter-Name */}
            <div className="card">
              <div className="text-xs font-bold uppercase tracking-widest text-blood">
                Fighter-Name
              </div>
              <p className="mt-2 text-sm text-foreground/70">
                So heißt du in der App. Lass das Feld leer, wenn du einfach
                „Fighter" bleiben willst.
              </p>
              <form onSubmit={handleSaveName} className="mt-4 space-y-3">
                <input
                  type="text"
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Fighter"
                  className="w-full rounded-sm border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none"
                />
                {error && (
                  <div className="rounded-sm border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="btn-primary disabled:opacity-50"
                  >
                    {savingName ? "Speichere…" : "Speichern"}
                  </button>
                  {savedFlash && (
                    <span className="text-xs uppercase tracking-widest text-green-400">
                      Gespeichert ✓
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Account-Info */}
            <div className="mt-6 card">
              <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
                Account
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-carbon-500/60 pb-2">
                  <dt className="text-foreground/60">E-Mail</dt>
                  <dd className="font-bold">{user?.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-carbon-500/60 pb-2">
                  <dt className="text-foreground/60">Auth-Anbieter</dt>
                  <dd className="font-bold">
                    {profile?.authProviderName
                      ? `Google (${profile.authProviderName})`
                      : "E-Mail"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground/60">Angezeigter Name</dt>
                  <dd className="font-bold text-blood">
                    {profile?.displayName?.trim() || "Fighter"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-foreground/60">
                Dein Auth-Name (z. B. Google-Klarname) wird intern für die
                Anmeldung gespeichert, aber niemals in der App angezeigt.
              </p>
            </div>

            {/* Logout */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => logOut()}
                className="btn-secondary text-sm"
              >
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
