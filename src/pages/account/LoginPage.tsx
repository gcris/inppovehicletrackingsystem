import React, { useState, useEffect } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  Shield,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ChevronRight,
  QrCode,
  Fingerprint,
  ShieldCheck,
  MapPinned,
  Radio,
  BarChart3,
  EyeOff,
  Eye,
  Sun,
  Moon,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useAuth } from "../../components/AuthProvider";
import MfaVerificationForm from "../../components/auth/MfaVerificationForm";
import { useTheme, useThemeActions } from "../../components/ThemeProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, profile, isMfaVerified, setIsMfaVerified, clearAuthCache } =
    useAuth();

  useEffect(() => {
    if (user && isMfaVerified) {
      navigate(
        profile?.role?.includes("supply")
          ? "/dashboard-mobility"
          : "/dashboard",
      );
    }
  }, [user, isMfaVerified, navigate]);

  useEffect(() => {
    const detectActiveSession = async () => {
      // If MFA is already verified or bypassed, don't run active session enrolments
      if (isMfaVerified) {
        return;
      }
      try {
        let loggedInEmail = "";
        const {
          data: { session: activeSession },
        } = await supabase.auth.getSession();
        if (activeSession?.user) {
          const { data: mfaData } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          loggedInEmail = activeSession?.user.email || "";
          if (mfaData?.currentLevel === "aal2") {
            setIsMfaVerified(true);
            return;
          }

          // User is signed in but at aal1 (needs MFA verification)
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const factors = factorsData?.all || [];
          const totpFactor = factors.find(
            (f: any) => f.factor_type === "totp" && f.status === "verified",
          );
          if (totpFactor) {
            setMfaFactorId(totpFactor.id);
          } else {
            // Unenroll any existing unverified totp factors to get a fresh QR code
            const unverifiedFactors = factors.filter(
              (f: any) => f.factor_type === "totp" && f.status === "unverified",
            );
            for (const uf of unverifiedFactors) {
              try {
                await supabase.auth.mfa.unenroll({ factorId: uf.id });
              } catch (unenrollErr) {
                console.warn(
                  "Could not unenroll unverified factor on active session detection:",
                  unenrollErr,
                );
              }
            }

            // Need to enroll them if they haven't enrolled yet
            const { data: factorData } = await supabase.auth.mfa.enroll({
              factorType: "totp",
              issuer: "INPPO",
              friendlyName: `Project J.O.E.M.A.R`,
            });

            if (factorData) {
              const localSecret = factorData.totp.secret;
              const customLabel = `INPPO: Project J.O.E.M.A.R(${loggedInEmail})`;
              const customUri = `otpauth://totp/${loggedInEmail}?secret=${localSecret}&issuer=${customLabel}&algorithm=SHA1&digits=6&period=30`;

              setMfaFactorId(factorData.id);

              setUnenrolledMfaData({
                id: factorData.id,
                qrCodeUrl: customUri,
              });
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
  const [mfaCode, setMfaCode] = useState("");
  const [unenrolledMfaData, setUnenrolledMfaData] = useState<{
    id: string;
    qrCodeUrl: string;
  } | null>(null);

  const theme = useTheme();
  const { toggleTheme } = useThemeActions();

  const handleLogin = async (e: React.SyntheticEvent) => {
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
      const totpFactor = factors.find(
        (f: any) => f.factor_type === "totp" && f.status === "verified",
      );

      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
      } else {
        // Unenroll any existing unverified totp factors to get a fresh QR code
        const unverifiedFactors = factors.filter(
          (f: any) => f.factor_type === "totp" && f.status === "unverified",
        );
        for (const uf of unverifiedFactors) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: uf.id });
          } catch (unenrollErr) {
            console.warn(
              "Could not unenroll unverified factor on handleLogin:",
              unenrollErr,
            );
          }
        }

        // Force MFA enrollment for existing users who didn't set it up
        const { data: factorData, error: enrollError } =
          await supabase.auth.mfa.enroll({
            factorType: "totp",
            issuer: "INPPO",
            friendlyName: "Project J.O.E.M.A.R",
          });
        if (enrollError) {
          setError(
            "Securing account required: Failed to initialize Google Authenticator setup. " +
              enrollError.message,
          );
        } else if (factorData) {
          const localSecret = factorData.totp.secret;
          const customLabel = `INPPO: Project J.O.E.M.A.R(${email})`;
          const customUri = `otpauth://totp/${email}?secret=${localSecret}&issuer=${customLabel}&algorithm=SHA1&digits=6&period=30`;

          setMfaFactorId(factorData.id);

          setUnenrolledMfaData({
            id: factorData.id,
            qrCodeUrl: customUri,
          });
        }
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err?.message || "Login failed due to a network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const factorIdToVerify = mfaFactorId ?? unenrolledMfaData?.id;
    if (!factorIdToVerify) return;

    setLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factorIdToVerify });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorIdToVerify,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase
        .from("personnel")
        .update({
          mfa_enabled: true,
        })
        .eq("id", user?.id); // or session?.user.id

      if (updateError) throw updateError;

      setIsMfaVerified(true);
    } catch (err: any) {
      setError(err.message || "Invalid authentication code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="min-h-screen bg-slate-100 dark:bg-[#020617] relative overflow-hidden transition-colors">
        <div className="fixed top-4 right-10 z-50">
          <div className="flex items-center gap-4 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-2">
            {/* Theme Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            >
              {theme === "light" ? (
                <Moon className="h-6 w-6" />
              ) : (
                <Sun className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md h-[90vh]">
            {unenrolledMfaData && (
              <div className="min-h-screen flex items-center justify-center p-4 transition-colors">
                <div className="max-w-[440px] w-full">
                  <div className="rounded-[36px] border border-white/30 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
                    <div className="p-10">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                      </div>
                      <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">
                        Setup Required
                      </h2>
                      <p className="text-base font-bold text-center text-slate-600 dark:text-slate-400 mb-6">
                        Security policy requires Google Authenticator.
                      </p>

                      <div className="flex justify-center bg-slate-50 dark:bg-white p-4 rounded-2xl mb-8 border border-slate-100">
                        <QRCode
                          value={unenrolledMfaData?.qrCodeUrl}
                          size={200}
                        />
                      </div>

                      <form onSubmit={handleVerifyMfa} className="space-y-6">
                        {error && (
                          <div className="bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-xs font-black uppercase leading-relaxed">
                              {error}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <input
                            type="text"
                            required
                            maxLength={6}
                            value={mfaCode}
                            onChange={(e) =>
                              setMfaCode(e.target.value.replace(/[^0-9]/g, ""))
                            }
                            placeholder="123456"
                            className="w-full text-center bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 text-xl font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loading || mfaCode.length !== 6}
                          className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setUnenrolledMfaData(null);
                            setMfaCode("");
                            clearAuthCache();
                          }}
                          className="w-full text-center text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
                        >
                          Cancel Setup
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mfaFactorId && (
              <MfaVerificationForm
                mfaCode={mfaCode}
                setMfaCode={setMfaCode}
                loading={loading}
                error={error!}
                onSubmit={handleVerifyMfa}
                onCancel={() => {
                  setMfaFactorId(null);
                  setMfaCode("");
                  clearAuthCache();
                }}
              />
            )}

            {!unenrolledMfaData && !mfaFactorId && (
              <>
                {/* Card */}
                <div className="rounded-[36px] border border-white/30 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
                  <div className="p-10">
                    <div className="mb-10">
                      <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                        Welcome Back
                      </h2>

                      <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Sign in using your official INPPO account.
                      </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                      {error && (
                        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900 p-4 flex gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-base text-red-600 dark:text-red-400">
                            {error}
                          </p>
                        </div>
                      )}

                      {/* Email */}
                      <div>
                        <label className="block mb-2 text-base font-semibold text-slate-600 dark:text-slate-400">
                          Email Address
                        </label>

                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                          <input
                            required
                            type="email"
                            placeholder="name@pnp.gov.ph"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block mb-2 text-base font-semibold text-slate-600 dark:text-slate-400">
                          Password
                        </label>

                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                          <input
                            required
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-12 pr-14 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Link
                          to="/forgot-password"
                          className="text-base text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Forgot Password?
                        </Link>
                      </div>

                      <button
                        disabled={loading}
                        type="submit"
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-3"
                      >
                        {loading ? (
                          <Loader2 className="animate-spin w-5 h-5" />
                        ) : (
                          <>
                            Sign in
                            <ChevronRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-[36px] p-8">
                    <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 p-5 text-center">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        New Personnel?
                      </p>

                      <p className="text-base text-slate-500 dark:text-slate-400 mt-2 mb-5">
                        Only authorized personnel with existing records may
                        register.
                      </p>

                      <Link
                        to="/register"
                        className="inline-flex items-center justify-center w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all"
                      >
                        Register Official Account
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
