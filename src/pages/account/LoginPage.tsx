import React, { useState, useEffect } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { supabase, supabaseAdmin } from "../../lib/supabase";
import {
  Shield,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ChevronRight,
  QrCode,
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
  const {
    user,
    profile,
    isMfaVerified,
    setIsMfaVerified,
    resendConfirmationEmail,
    clearAuthCache,
  } = useAuth();

  useEffect(() => {
    if (user && isMfaVerified) {
      navigate("/dashboard");
    }
  }, [user, isMfaVerified, navigate]);

  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [unenrolledMfaData, setUnenrolledMfaData] = useState<{
    id: string;
    qrCodeUrl: string;
  } | null>(null);

  /**
   * True when the signed-in user's email address has not been confirmed
   * yet. While this is true the user cannot reach MFA enrollment and is
   * instead shown a screen with a "Resend confirmation email" button.
   */
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const theme = useTheme();
  const { toggleTheme } = useThemeActions();

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: signInData, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // A user must confirm their email address before they are
      // allowed to set up MFA. If the email is not confirmed, stop
      // here and show the confirmation screen instead of starting
      // MFA enrollment.
      if (!signInData?.session?.user?.email_confirmed_at) {
        setEmailNotConfirmed(true);
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
            friendlyName: "Project PATROL",
          });
        if (enrollError) {
          setError(
            "Securing account required: Failed to initialize Google Authenticator setup. " +
              enrollError.message,
          );
        } else if (factorData) {
          const localSecret = factorData.totp.secret;
          const customLabel = `INPPO: Project PATROL`;
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

  const handleResendConfirmation = async () => {
    if (!email.trim()) return;

    setResendState("sending");
    setResendMessage(null);

    try {
      const { error } = await resendConfirmationEmail(email.trim());

      if (error) {
        setResendState("error");
        setResendMessage(
          error.message ||
            "Could not resend the confirmation email. Please try again later.",
        );
        return;
      }

      setResendState("sent");
      setResendMessage(
        "Confirmation email resent. Please check your inbox (and spam folder).",
      );
    } catch (err: any) {
      console.error("Resend confirmation failed:", err);

      setResendState("error");
      setResendMessage(
        err?.message ||
          "Could not resend the confirmation email. Please try again later.",
      );
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
          is_online: true,
        })
        .eq("user_id", user?.id); // or session?.user.id

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
        <div className="flex-1 flex items-center justify-center px-6 py-6">
          <div className="w-full max-w-md">
            {unenrolledMfaData && (
              <div className="min-h-screen flex items-center justify-center p-4 transition-colors">
                <div className="max-w-[440px] w-full">
                  <div className="rounded-[36px] border border-white/30 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl relative">
                    {/* Theme Button inside Setup Box */}
                    <div className="absolute top-6 right-6 z-10">
                      <button
                        onClick={toggleTheme}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                        title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                      >
                        {theme === "light" ? (
                          <Moon className="h-5 w-5" />
                        ) : (
                          <Sun className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    <div className="p-10">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                      </div>
                      <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">
                        Setup Required
                      </h2>
                      <p className="font-bold text-center text-slate-600 dark:text-slate-400 mb-6">
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
                            className="
                              w-full
                              rounded-2xl
                              border
                              border-slate-300
                              dark:border-slate-700
                              bg-slate-50
                              dark:bg-slate-800
                              py-4
                              text-center
                              text-4xl
                              font-mono
                              font-bold
                              tracking-[0.5em]
                              text-slate-900
                              dark:text-white
                              outline-none
                              transition
                              focus:border-blue-500
                              focus:ring-4
                              focus:ring-blue-500/20
                            "
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
                            setMfaFactorId(null);
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

            {mfaFactorId && !unenrolledMfaData && (
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

            {emailNotConfirmed && (
              <div className="rounded-[36px] border border-white/30 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl relative">
                {/* Theme Button inside Confirmation Box */}
                <div className="absolute top-6 right-6 z-10">
                  <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                    title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                  >
                    {theme === "light" ? (
                      <Moon className="h-5 w-5" />
                    ) : (
                      <Sun className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="p-10">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Mail className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>

                  <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">
                    Confirm your email address
                  </h2>
                  <p className="font-bold text-center text-slate-600 dark:text-slate-400 mb-6">
                    We sent a confirmation link to{" "}
                    <span className="text-slate-900 dark:text-white">
                      {email}
                    </span>
                    . Open the email and click the link to activate your
                    account.
                  </p>

                  {resendMessage && (
                    <div
                      className={`mb-6 p-4 rounded-2xl border text-sm font-medium ${
                        resendState === "error"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400"
                          : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {resendMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendState === "sending"}
                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {resendState === "sending" ? (
                      <Loader2 className="animate-spin w-5 h-5" />
                    ) : (
                      "Resend confirmation email"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmailNotConfirmed(false);
                      setResendState("idle");
                      setResendMessage(null);
                    }}
                    className="w-full mt-3 text-center text-slate-600 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-medium"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            )}

            {!unenrolledMfaData && !mfaFactorId && !emailNotConfirmed && (
              <>
                {/* Card with relative positioning */}
                <div className="rounded-[36px] border border-white/30 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl relative">
                  {/* Theme Button inside Login Box */}
                  <div className="absolute top-6 right-6 z-10">
                    <button
                      onClick={toggleTheme}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                      title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                    >
                      {theme === "light" ? (
                        <Moon className="h-5 w-5" />
                      ) : (
                        <Sun className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="p-6">
                    {/* LOGO CONTAINER */}
                    <div className="flex justify-center mb-4 pt-2">
                      <img
                        src="/assets/inppo_logo.png" // Replace with your logo path or imported logo variable
                        alt="INPPO Logo"
                        className="h-20 w-auto object-contain drop-shadow-md"
                      />
                    </div>

                    <div className="mb-5 text-center">
                      <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                        Welcome
                      </h2>

                      <p className="text-xl text-slate-700 dark:text-slate-200 mt-1">
                        Project P.A.T.R.O.L
                      </p>
                      <p className="text-slate-700 dark:text-slate-200 mt-1">
                        Personnel App Tracking and Real-Time OnLine Deployment
                        Monitoring
                      </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-3">
                      {error && (
                        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900 p-4 flex gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-red-600 dark:text-red-400">
                            {error}
                          </p>
                        </div>
                      )}

                      {/* Email */}
                      <div>
                        <label className="block mb-2 font-semibold text-slate-600 dark:text-slate-400">
                          Email Address
                        </label>

                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                          <input
                            required
                            type="email"
                            placeholder="name@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block mb-2 font-semibold text-slate-600 dark:text-slate-400">
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
                          className="text-blue-600 dark:text-blue-400 hover:underline"
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
                      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          New Account?
                        </span>{" "}
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
