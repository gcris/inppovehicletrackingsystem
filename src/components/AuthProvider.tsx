import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";

import { supabase, Personnel } from "../lib/supabase";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Personnel | null;
  loading: boolean;

  isAdmin: boolean;
  isApproved: boolean;
  isMfaVerified: boolean;
  isPnpIdExpires: boolean;

  setIsMfaVerified: (verified: boolean) => void;

  clearAuthCache: () => Promise<void>;

  role: Personnel["role"] | null;
  unitId: Personnel["unit_id"] | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,

  loading: true,

  isAdmin: false,
  isApproved: false,
  isMfaVerified: false,
  isPnpIdExpires: false,

  setIsMfaVerified: () => {},

  clearAuthCache: async () => {},

  role: null,
  unitId: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Personnel | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isMfaVerified, setIsMfaVerifiedState] = useState(false);
  const [isPnpIdExpires, setIsPnpIdExpires] = useState(false);
  /**
   * Tracks the currently loaded user.
   *
   * This prevents fetching the personnel profile repeatedly
   * when Supabase refreshes the access token.
   */
  const lastUserIdRef = useRef<string | null>(null);

  /**
   * Prevents multiple profile requests from running at the
   * same time.
   */
  const profileLoadingRef = useRef(false);

  /**
   * Tracks whether the provider is still mounted.
   */
  const mountedRef = useRef(false);

  const sessionRef = useRef<Session | null>(null);

  /**
   * ---------------------------------------------------------
   * FETCH PROFILE
   * ---------------------------------------------------------
   */

  const checkIfPnpIdExpired = (expirationDate: string) => {
    if (!expirationDate) return true;

    const expiry = new Date(expirationDate);
    const today = new Date();

    // Ignore time
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    return expiry < today;
  };

  const fetchProfile = useCallback(async (uid: string) => {
    if (!uid) return;

    /**
     * Prevent duplicate simultaneous requests.
     */
    if (profileLoadingRef.current) {
      return;
    }

    profileLoadingRef.current = true;

    try {
      console.log("AUTH: Fetching profile:", uid);

      const { data, error } = await supabase
        .from("personnel")
        .select("*, unit(*), rank(*)")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error("AUTH: Error fetching profile:", error.message);

        if (mountedRef.current) {
          setProfile(null);
        }

        return;
      }

      if (mountedRef.current) {
        if (data?.is_blocked) {
          await supabase.auth.signOut();
          window.location.href = "/login";
          return;
        }

        console.log("data: ", data);
        const expires = checkIfPnpIdExpired(data.expiration_date);

        setIsPnpIdExpires(expires);

        setProfile(data);
      }
    } catch (error) {
      console.error("AUTH: Profile fetch error:", error);

      if (mountedRef.current) {
        setProfile(null);
      }
    } finally {
      profileLoadingRef.current = false;
    }
  }, []);

  /**
   * ---------------------------------------------------------
   * MFA VERIFICATION
   * ---------------------------------------------------------
   */

  const checkMfaStatus = useCallback(async () => {
    try {
      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (error) {
        console.error("AUTH: MFA assurance error:", error.message);

        return;
      }

      if (!mountedRef.current) return;

      const verified = data?.currentLevel === "aal2";

      setIsMfaVerifiedState(verified);

      console.log("AUTH: MFA status:", verified ? "AAL2" : "AAL1");
    } catch (error) {
      console.error("AUTH: MFA status check failed:", error);
    }
  }, []);

  /**
   * ---------------------------------------------------------
   * MFA STATE UPDATE
   * ---------------------------------------------------------
   */

  const updateMfaVerification = useCallback(
    async (verified: boolean) => {
      if (!mountedRef.current) return;

      setIsMfaVerifiedState(verified);

      /**
       * Only refresh session/profile after MFA has actually
       * been verified.
       */
      if (!verified) {
        return;
      }

      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            "AUTH: Error getting session after MFA:",
            error.message,
          );

          return;
        }

        if (!currentSession?.user) {
          return;
        }

        if (!mountedRef.current) return;

        const sameSession =
          session?.access_token === currentSession.access_token;

        if (!sameSession) {
          setSession(currentSession);
          sessionRef.current = currentSession;
          setUser(currentSession.user);
        }

        /**
         * Fetch profile only if it is not already loaded
         * for this user.
         */
        if (lastUserIdRef.current !== currentSession.user.id) {
          lastUserIdRef.current = currentSession.user.id;

          await fetchProfile(currentSession.user.id);
        }
      } catch (error) {
        console.error("AUTH: Error refreshing after MFA verification:", error);
      }
    },
    [fetchProfile],
  );

  /**
   * ---------------------------------------------------------
   * AUTH INITIALIZATION + AUTH STATE LISTENER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    let initialized = false;

    /**
     * -------------------------------------------------------
     * INITIAL SESSION
     * -------------------------------------------------------
     */

    const initializeAuth = async () => {
      try {
        console.log("AUTH: Initializing...");

        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("AUTH: getSession error:", error.message);

          return;
        }

        if (!mountedRef.current) return;

        /**
         * Store current session.
         */
        const sameSession =
          session?.access_token === currentSession?.access_token;

        if (!sameSession) {
          setSession(currentSession);
          sessionRef.current = currentSession;
          setUser(currentSession?.user!);
        }

        /**
         * No authenticated user.
         */
        if (!currentSession?.user) {
          lastUserIdRef.current = null;

          setProfile(null);
          setIsMfaVerifiedState(false);

          return;
        }

        /**
         * Remember current user.
         */
        lastUserIdRef.current = currentSession.user.id;

        /**
         * Load personnel profile.
         */
        await fetchProfile(currentSession.user.id);

        if (!mountedRef.current) return;

        /**
         * Determine current MFA level.
         */
        await checkMfaStatus();
      } catch (error) {
        console.error("AUTH: Initialization error:", error);
      } finally {
        initialized = true;

        if (mountedRef.current) {
          setInitializing(false);
        }
      }
    };

    /**
     * Start initial authentication check.
     */
    initializeAuth();

    /**
     * -------------------------------------------------------
     * AUTH STATE CHANGE
     * -------------------------------------------------------
     */

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mountedRef.current) return;

      console.log("AUTH EVENT:", event, currentSession?.user?.id ?? null);

      /**
       * ---------------------------------------------------
       * SIGNED OUT
       * ---------------------------------------------------
       */

      if (!currentSession?.user) {
        setSession(null);
        setUser(null);

        lastUserIdRef.current = null;

        setProfile(null);
        setIsMfaVerifiedState(false);

        return;
      }

      /**
       * ---------------------------------------------------
       * SESSION EXISTS
       * ---------------------------------------------------
       */

      const sameSession =
        session?.access_token === currentSession?.access_token;

      if (!sameSession) {
        setSession(currentSession);
        sessionRef.current = currentSession;
        setUser(currentSession?.user!);
      }

      const currentUserId = currentSession.user.id;

      const userChanged = lastUserIdRef.current !== currentUserId;

      /**
       * ---------------------------------------------------
       * USER CHANGED
       * ---------------------------------------------------
       *
       * This normally happens after SIGNED_IN.
       */

      if (userChanged) {
        lastUserIdRef.current = currentUserId;

        /**
         * Do not await Supabase operations directly
         * inside onAuthStateChange.
         *
         * Supabase auth events can be sensitive to
         * callbacks that perform additional Supabase
         * operations synchronously.
         */
        setTimeout(() => {
          if (!mountedRef.current) return;

          fetchProfile(currentUserId);
        }, 0);
      }

      /**
       * ---------------------------------------------------
       * SIGNED IN
       * ---------------------------------------------------
       */

      console.log("AUTH EVENT:", event);

      if (event === "SIGNED_IN") {
        setTimeout(() => {
          if (!mountedRef.current) return;

          checkMfaStatus();
        }, 0);

        return;
      }

      /**
       * ---------------------------------------------------
       * MFA CHALLENGE VERIFIED
       * ---------------------------------------------------
       */

      if (event === "MFA_CHALLENGE_VERIFIED") {
        setTimeout(() => {
          if (!mountedRef.current) return;

          checkMfaStatus();
        }, 0);

        return;
      }

      /**
       * ---------------------------------------------------
       * TOKEN REFRESH
       * ---------------------------------------------------
       *
       * IMPORTANT:
       *
       * Do NOT fetch the profile again here.
       *
       * Supabase can refresh the token when the browser
       * becomes active again.
       *
       * The user is still the same user.
       */
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      /**
       * ---------------------------------------------------
       * INITIAL_SESSION
       * ---------------------------------------------------
       *
       * We intentionally do nothing here.
       *
       * The initial session is already handled by
       * initializeAuth().
       */
      if (event === "INITIAL_SESSION") {
        return;
      }
    });

    /**
     * -------------------------------------------------------
     * CLEANUP
     * -------------------------------------------------------
     */

    return () => {
      mountedRef.current = false;

      subscription.unsubscribe();
    };
  }, [fetchProfile, checkMfaStatus]);

  /**
   * ---------------------------------------------------------
   * CLEAR AUTH CACHE
   * ---------------------------------------------------------
   */

  const clearAuthCache = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("AUTH: Sign out during cache clear failed:", error);
    } finally {
      /**
       * Clear local browser storage.
       */
      sessionStorage.clear();

      /**
       * Clear cookies belonging to the current path.
       */
      const cookies = document.cookie.split(";");

      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];

        const eqPos = cookie.indexOf("=");

        const name =
          eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();

        document.cookie =
          name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }

      /**
       * Reset application.
       */
      //window.location.href = "/mobility";
    }
  }, []);

  /**
   * ---------------------------------------------------------
   * CONTEXT VALUE
   * ---------------------------------------------------------
   */

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,

      loading: initializing,

      isAdmin: profile?.role?.includes("admin") ?? false,

      isApproved: profile?.is_approved === true,

      isPnpIdExpires: isPnpIdExpires,

      isMfaVerified,

      setIsMfaVerified: updateMfaVerification,

      clearAuthCache,

      role: profile?.role ?? null,

      unitId: profile?.unit_id ?? null,
    }),
    [
      user,
      session,
      profile,
      initializing,
      isMfaVerified,
      updateMfaVerification,
      clearAuthCache,
    ],
  );

  /**
   * ---------------------------------------------------------
   * INITIAL LOADING SCREEN
   * ---------------------------------------------------------
   */

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

          <p className="animate-pulse font-medium text-slate-500">
            Initializing Application...
          </p>
        </div>
      </div>
    );
  }

  /**
   * ---------------------------------------------------------
   * PROVIDER
   * ---------------------------------------------------------
   */

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
