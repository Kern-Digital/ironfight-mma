"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import {
  ensureUserProfile,
  getUserProfile,
  setDisplayName as setProfileDisplayName,
  markOnboarded as markProfileOnboarded,
} from "./user-profile";
import type { UserProfile } from "./types";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** True solange Profil noch lädt — auch wenn user schon da ist */
  profileLoading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  /** Aktualisiert den vom User gewählten Anzeigenamen (FighterName) */
  updateDisplayName: (name: string | null) => Promise<void>;
  /** Markiert den ersten-Login-Onboarding als erledigt, ohne Namen zu setzen */
  finishOnboarding: () => Promise<void>;
  /** Lädt das Profil neu — z. B. nach Settings-Änderung */
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (u) => {
      setUser(u);
      setLoading(false);

      if (!u) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const p = await ensureUserProfile(u);
        setProfile(p);
      } catch (err) {
        console.warn("[IronFight] ensureUserProfile failed:", err);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    });
    return unsub;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const p = await getUserProfile(user.uid);
      setProfile(p);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  const updateDisplayName = useCallback(
    async (name: string | null) => {
      if (!user) return;
      await setProfileDisplayName(user.uid, name);
      await refreshProfile();
    },
    [user, refreshProfile],
  );

  const finishOnboarding = useCallback(async () => {
    if (!user) return;
    await markProfileOnboarded(user.uid);
    await refreshProfile();
  }, [user, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      signUp: async (email, password, displayName) => {
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          email,
          password,
        );
        // FighterName direkt setzen, falls bei Registrierung angegeben
        if (displayName?.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
          // Profil mit FighterName als displayName initialisieren
          await ensureUserProfile(cred.user);
          await setProfileDisplayName(cred.user.uid, displayName.trim());
        }
        return cred.user;
      },
      signIn: async (email, password) => {
        const cred = await signInWithEmailAndPassword(
          getFirebaseAuth(),
          email,
          password,
        );
        return cred.user;
      },
      signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(getFirebaseAuth(), provider);
        // ensureUserProfile wird im onAuthStateChanged-Handler aufgerufen.
        // Wichtig: Wir setzen displayName NICHT auf den Google-Klarnamen.
        return cred.user;
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebaseAuth(), email);
      },
      logOut: () => signOut(getFirebaseAuth()),
      updateDisplayName,
      finishOnboarding,
      refreshProfile,
    }),
    [
      user,
      profile,
      loading,
      profileLoading,
      updateDisplayName,
      finishOnboarding,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Convenience: liefert den aktiven Anzeigenamen mit Fallback "Fighter".
 * Wird in Navbar, Dashboard, Begrüßungen genutzt — niemals der Auth-Klarname.
 */
export function useFighterName(): string {
  const { profile } = useAuth();
  return profile?.displayName?.trim() || "Fighter";
}
