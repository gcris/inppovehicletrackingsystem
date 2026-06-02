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
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Personnel | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isMfaVerified, _setIsMfaVerified] = useState(true);
  const isMfaVerifiedRef = React.useRef(true);

  const setIsMfaVerifiedState = (val: boolean) => {
    // Temporarily bypass MFA requirement so user can always proceed to the dashboard
    _setIsMfaVerified(true);
    isMfaVerifiedRef.current = true;
    console.log('[AuthProvider] MFA Bypassed (temporarily forced to true)');
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
        setProfile(null);
      } else {
        console.log(data);
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      setProfile(null);
    }
  }, []);

  const updateMfaVerification = React.useCallback(async (verified: boolean) => {
    setIsMfaVerifiedState(verified);
    if (verified) {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
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
            setSession(currentSession);
            setUser(currentSession.user);
            await fetchProfile(currentSession.user.id);

            const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            const verified = mfaData?.currentLevel === 'aal2';
            setIsMfaVerifiedState(verified);
          } else {
            setSession(null);
            setUser(null);
            setIsMfaVerifiedState(false);
            setProfile(null);
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
        if (event === 'INITIAL_SESSION') return;

        let currentSession = session;
        if (!currentSession) {
          const { data } = await supabase.auth.getSession();
          currentSession = data.session;
        }
        
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchProfile(currentSession.user.id);

          const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          console.log('[onAuthStateChange] mfaData currentLevel:', mfaData?.currentLevel, 'event:', event, 'isMfaVerifiedRef:', isMfaVerifiedRef.current);

          if (event === 'SIGNED_OUT') {
            setIsMfaVerifiedState(false);
          } else if (event === 'SIGNED_IN') {
            if (mfaData?.currentLevel === 'aal2') {
              setIsMfaVerifiedState(true);
            } else {
              setIsMfaVerifiedState(false);
            }
          } else if (event === 'MFA_CHALLENGE_VERIFIED') {
            setIsMfaVerifiedState(true);
          } else {
            // Other events (TOKEN_REFRESHED, USER_UPDATED, etc.)
            if (mfaData?.currentLevel === 'aal2' || isMfaVerifiedRef.current) {
              setIsMfaVerifiedState(true);
            } else {
              setIsMfaVerifiedState(false);
            }
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsMfaVerifiedState(false);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    });

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
