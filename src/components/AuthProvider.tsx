import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, Personnel } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Personnel | null;
  loading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  isMfaVerified: boolean;
  setIsMfaVerified: (verified: boolean) => void;
  clearAuthCache: () => Promise<void>;
  // Additional fields for role and unit_id
  role: Personnel['role'] | null;
  unitId: Personnel['unit_id'] | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isApproved: false,
  isMfaVerified: false,
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
  const [loading, setLoading] = useState(true);
  
  const userRef = React.useRef<User | null>(null);
  const sessionRef = React.useRef<Session | null>(null);
  const profileRef = React.useRef<Personnel | null>(null);

  const setUserState = (u: User | null) => {
    setUser(u);
    userRef.current = u;
  };
  const setSessionState = (s: Session | null) => {
    setSession(s);
    sessionRef.current = s;
  };
  const setProfileState = (p: Personnel | null) => {
    setProfile(p);
    profileRef.current = p;
  };

  const [isMfaVerified, _setIsMfaVerified] = useState(false);
  const isMfaVerifiedRef = React.useRef(false);

  const setIsMfaVerifiedState = (val: boolean) => {
    _setIsMfaVerified(val);
    isMfaVerifiedRef.current = val;
    console.log('[AuthProvider] MFA verification state updated:', val);
  };

  const fetchProfile = React.useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('personnel')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error.message);
        setProfileState(null);
      } else {
        console.log(data);
        setProfileState(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      setProfileState(null);
    }
  }, []);

  const updateMfaVerification = React.useCallback(async (verified: boolean) => {
    setIsMfaVerifiedState(verified);
    if (verified) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSessionState(currentSession);
          setUserState(currentSession.user);
          await fetchProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error("Error refreshing session on MFA verification:", err);
      }
    }
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // Fallback timeout to ensure we don't get stuck in loading state ever
    const timeoutId = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error.message);
        }

        if (mounted) {
          if (currentSession?.user) {
            setSessionState(currentSession);
            setUserState(currentSession.user);
            await fetchProfile(currentSession.user.id);

            const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const verified = mfaData?.currentLevel === 'aal2';
            setIsMfaVerifiedState(verified);
          } else {
            setSessionState(null);
            setUserState(null);
            setIsMfaVerifiedState(false);
            setProfileState(null);
          }
        }
      } catch (err) {
        console.error('Fatal auth initialization error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initializeAuth();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('Control Plane Auth event incoming:', event);
        if (!mounted) return;

        // Avoid re-triggering INITIAL_SESSION if we already handled it in initializeAuth
        if (event === 'INITIAL_SESSION' || event === "SIGNED_IN" || event === "SIGNED_OUT") return;

        // DO NOT call getSession() here to avoid infinite token-refresh loop on tab focus!
        // We strictly use the session provided by the onAuthStateChange callback.
        const currentSession = session;
        
        if (currentSession?.user) {
          // const isSameUser = userRef.current?.id === currentSession.user.id;
          // const isSameSession = sessionRef.current?.access_token === currentSession.access_token;

          // if (isSameUser && isSameSession) {
          //   // Already initialized with this session. No need to fetch profile/MFA again,
          //   // preventing unhandled promise rejections on window focus/tab-reload.
          //   return;
          // }

          // if (!isSameSession) {
            
          // }
          // if (!isSameUser) {
          //   console.log("Current user", userRef.current?.email);
            
          // }

          setSessionState(currentSession);
          setUserState(currentSession.user);

          // Only fetch profile if user has changed or profile has not been fetched yet
          await fetchProfile(currentSession.user.id);

          const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          console.log('[onAuthStateChange] mfaData currentLevel:', mfaData?.currentLevel, 'event:', event, 'isMfaVerifiedRef:', isMfaVerifiedRef.current);

          setIsMfaVerifiedState(mfaData?.currentLevel === 'aal2' || event === 'MFA_CHALLENGE_VERIFIED');
        } else {
          // If there is no session, and we currently have active states, clean them up
          if (userRef.current || sessionRef.current || profileRef.current) {
            setSessionState(null);
            setUserState(null);
            setProfileState(null);
            setIsMfaVerifiedState(false);
          }
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } 
    });

    setLoading(false);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [fetchProfile]);

  const OWNER_EMAIL = 'itsme.gerrycriscariaga@gmail.com';

  const clearAuthCache = React.useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out during cache clear failed:", e);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }, []);

  const value = React.useMemo(() => {
    return {
      user,
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin' || user?.email === OWNER_EMAIL,
      isApproved: profile?.is_approved === true || user?.email === OWNER_EMAIL,
      isMfaVerified,
      setIsMfaVerified: updateMfaVerification,
      clearAuthCache,
      role: profile?.role ?? null,
      unitId: profile?.unit_id ?? null,
    };
  }, [user, session, profile, loading, isMfaVerified, updateMfaVerification, clearAuthCache]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing Application...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
