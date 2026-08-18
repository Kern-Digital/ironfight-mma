"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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
  markTrainerOnboarded as markProfileTrainerOnboarded,
} from "./user-profile";
import type { UserProfile, UserRole } from "./types";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  /** Fehler aus Google-Redirect (für Login/Register-Seiten) */
  redirectError: string | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateDisplayName: (name: string | null) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  finishTrainerOnboarding: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect-Ergebnis prüfen (Fallback wenn Popup geblockt war)
    getRedirectResult(getFirebaseAuth())
      .then((result) => {
        // Erfolg: onAuthStateChanged übernimmt den Rest
        if (result?.user) {
          // Profil anlegen/aktualisieren — nicht-blockierend
          ensureUserProfile(result.user).catch(() => {});
        }
      })
      .catch((err: { code?: string; message?: string }) => {
        // auth/no-auth-event = normaler Fall (kein Redirect gestartet)
        const ignoredCodes = new Set(["auth/no-auth-event", "auth/null-user"]);
        if (err?.code && !ignoredCodes.has(err.code)) {
          console.error("[TidalAthletics] getRedirectResult error:", err.code, err.message);
          setRedirectError("Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
        }
      });

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
        // Rolle kommt autoritativ aus den Auth Custom Claims, nicht aus Firestore
        const { claims } = await u.getIdTokenResult();
        setProfile({ ...p, role: claims.role as UserRole | undefined });
      } catch (err) {
        console.warn("[TidalAthletics] ensureUserProfile failed:", err);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    });
    return unsub;
  }, []);

  // Spiegelt das Firebase-ID-Token in ein `__session`-Cookie, damit die
  // Middleware (serverseitig) (un)authentifizierte Nutzer erkennen kann.
  // onIdTokenChanged feuert bei Login, Logout und Token-Refresh (~stuendlich).
  useEffect(() => {
    return onIdTokenChanged(getFirebaseAuth(), async (u) => {
      if (u) {
        const token = await u.getIdToken();
        const secure =
          typeof location !== "undefined" && location.protocol === "https:"
            ? "; secure"
            : "";
        document.cookie = `__session=${token}; path=/; max-age=3600; samesite=lax${secure}`;
      } else {
        document.cookie = "__session=; path=/; max-age=0; samesite=lax";
      }
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const p = await getUserProfile(user.uid);
      const { claims } = await user.getIdTokenResult();
      const role = claims.role as UserRole | undefined;
      setProfile(p ? { ...p, role } : p);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  /**
   * Erzwingt ein Token-Refresh, damit ein frisch per Admin-SDK-Script gesetzter
   * Rollen-Claim sofort im Client ankommt (ohne Re-Login).
   */
  const refreshRole = useCallback(async () => {
    if (!user) return;
    const { claims } = await user.getIdTokenResult(true);
    const role = claims.role as UserRole | undefined;
    setProfile((prev) => (prev ? { ...prev, role } : prev));
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

  const finishTrainerOnboarding = useCallback(async () => {
    if (!user) return;
    await markProfileTrainerOnboarded(user.uid);
    await refreshProfile();
  }, [user, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      redirectError,

      signUp: async (email, password, displayName) => {
        // Schritt 1: Auth-Account erstellen — dieser MUSS klappen
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          email,
          password,
        );

        // Schritt 2: Profil aufsetzen — nicht-blockierend für den User
        // Fehler hier dürfen die Registrierung NICHT abbrechen
        if (displayName?.trim()) {
          try {
            await updateProfile(cred.user, { displayName: displayName.trim() });
            await ensureUserProfile(cred.user);
            await setProfileDisplayName(cred.user.uid, displayName.trim());
          } catch (profileErr) {
            // Auth-Account ist erstellt, Profil-Setup schlägt fehl
            // onAuthStateChanged wird es beim nächsten Aufruf erneut versuchen
            console.warn("[TidalAthletics] Profile setup failed (non-critical):", profileErr);
          }
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

        try {
          // Popup funktioniert auf Desktop und modernem Mobile zuverlässig.
          // signInWithRedirect ist von Firebase für Browser-Apps deprecated.
          const cred = await signInWithPopup(getFirebaseAuth(), provider);
          return cred.user;
        } catch (err) {
          if (
            err instanceof FirebaseError &&
            (err.code === "auth/popup-blocked" ||
              err.code === "auth/operation-not-supported-in-this-environment")
          ) {
            // Fallback auf Redirect, wenn Popup explizit blockiert wurde
            await signInWithRedirect(getFirebaseAuth(), provider);
            return null;
          }
          throw err;
        }
      },

      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebaseAuth(), email);
      },

      logOut: () => signOut(getFirebaseAuth()),
      updateDisplayName,
      finishOnboarding,
      finishTrainerOnboarding,
      refreshProfile,
      refreshRole,
    }),
    [
      user,
      profile,
      loading,
      profileLoading,
      redirectError,
      updateDisplayName,
      finishOnboarding,
      finishTrainerOnboarding,
      refreshProfile,
      refreshRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useFighterName(): string {
  const { profile } = useAuth();
  return profile?.displayName?.trim() || "Flex";
}
