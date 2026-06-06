import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Lock, Mail, AlertCircle, Loader2, ChevronRight, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useAuth } from '../components/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, isMfaVerified, setIsMfaVerified, clearAuthCache } = useAuth();

  useEffect(() => {
    if (user && isMfaVerified) {
      navigate('/dashboard');
    }
  }, [user, isMfaVerified, navigate]);

  useEffect(() => {
    const detectActiveSession = async () => {
      // If MFA is already verified or bypassed, don't run active session enrolments
      if (isMfaVerified) {
        return;
      }
      try {
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        if (activeSession?.user) {
          const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (mfaData?.currentLevel === 'aal2') {
            setIsMfaVerified(true);
            return;
          }

          // User is signed in but at aal1 (needs MFA verification)
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const factors = factorsData?.all || [];
          const totpFactor = factors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
          if (totpFactor) {
            setMfaFactorId(totpFactor.id);
          } else {
            // Unenroll any existing unverified totp factors to get a fresh QR code
            const unverifiedFactors = factors.filter((f: any) => f.factor_type === 'totp' && f.status === 'unverified');
            for (const uf of unverifiedFactors) {
              try {
                await supabase.auth.mfa.unenroll({ factorId: uf.id });
              } catch (unenrollErr) {
                console.warn("Could not unenroll unverified factor on active session detection:", unenrollErr);
              }
            }

            // Need to enroll them if they haven't enrolled yet
            const { data: factorData } = await supabase.auth.mfa.enroll({
              factorType: 'totp',
            });
            if (factorData) {
              setUnenrolledMfaData({ id: factorData.id, qrCodeUrl: factorData.totp.uri });
            }
          }
        }
      } catch (err) {
        console.error("Detecting active session failed:", err);
      }
    };

    detectActiveSession();
  }, []);

  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [unenrolledMfaData, setUnenrolledMfaData] = useState<{ id: string, qrCodeUrl: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Check if MFA is required
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factors = factorsData?.all || [];
      const totpFactor = factors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');

      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
      } else {
        // Unenroll any existing unverified totp factors to get a fresh QR code
        const unverifiedFactors = factors.filter((f: any) => f.factor_type === 'totp' && f.status === 'unverified');
        for (const uf of unverifiedFactors) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: uf.id });
          } catch (unenrollErr) {
            console.warn("Could not unenroll unverified factor on handleLogin:", unenrollErr);
          }
        }

        // Force MFA enrollment for existing users who didn't set it up
        const { data: factorData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
        });
        if (enrollError) {
          setError("Securing account required: Failed to initialize Google Authenticator setup. " + enrollError.message);
        } else if (factorData) {
          setUnenrolledMfaData({ id: factorData.id, qrCodeUrl: factorData.totp.uri });
        }
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err?.message || "Login failed due to a network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    const factorIdToVerify = mfaFactorId || unenrolledMfaData?.id;
    if (!factorIdToVerify) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factorIdToVerify });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorIdToVerify,
        challengeId: challengeData.id,
        code: mfaCode
      });
      if (verifyError) throw verifyError;

      setIsMfaVerified(true);
    } catch (err: any) {
      setError(err.message || "Invalid authentication code");
    } finally {
      setLoading(false);
    }
  };

  if (unenrolledMfaData) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="max-w-[440px] w-full">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="p-10">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-500" />
              </div>
              <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">Setup Required</h2>
              <p className="text-sm font-bold text-center text-slate-400 dark:text-slate-500 mb-6">Security policy requires Google Authenticator.</p>

              <div className="flex justify-center bg-slate-50 dark:bg-white p-4 rounded-2xl mb-8 border border-slate-100">
                <QRCode value={unenrolledMfaData.qrCodeUrl} size={150} />
              </div>

              <form onSubmit={handleVerifyMfa} className="space-y-6">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs font-black uppercase leading-relaxed">{error}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 text-xl font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Enroll"}
                </button>
                
                <button 
                  type="button"
                  onClick={() => { setUnenrolledMfaData(null); setMfaCode(''); clearAuthCache(); }}
                  className="w-full text-center text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest"
                >
                  Cancel setup & Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mfaFactorId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="max-w-[440px] w-full">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="p-10">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-500" />
              </div>
              <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">Two-Factor Auth</h2>
              <p className="text-sm font-bold text-center text-slate-400 dark:text-slate-500 mb-8">Enter the 6-digit code from Google Authenticator</p>

              <form onSubmit={handleVerifyMfa} className="space-y-6">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs font-black uppercase leading-relaxed">{error}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 text-xl font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                </button>
                
                <button 
                  type="button"
                  onClick={() => { setMfaFactorId(null); setMfaCode(''); clearAuthCache(); }}
                  className="w-full text-center text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest cursor-pointer"
                >
                  Cancel setup & Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="max-w-[440px] w-full">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 overflow-hidden rounded-[24px] mb-6 group cursor-default bg-blue-600 flex items-center justify-center">
            <img 
              src="/assets/inppo_logo.png" 
              alt="INPPO Logo" 
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
              }}
            />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">INPPO PATROL</h1>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em] mt-2">Ilocos Norte Provincial Office</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Welcome Back</h2>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Sign in to access the command center</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs font-black uppercase leading-relaxed">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Work Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                  <input
                    required
                    type="email"
                    placeholder="name@pnp.gov.ph"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="ml-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Security Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer appearance-none w-4 h-4 rounded-md border-2 border-slate-200 dark:border-slate-800 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">Remember Me</span>
                </label>
                <Link to="/forgot-password" className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Authorize Connection
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center leading-relaxed">
              Don't have an account? <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline">Register Official Account</Link>
            </p>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center leading-relaxed opacity-50">
              Secured by Ilocos Norte Police Provincial Office
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
