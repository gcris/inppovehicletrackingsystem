import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  EyeOff,
  Eye,
} from "lucide-react";
import MfaVerificationForm from "../../components/auth/MfaVerificationForm";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mfaChallenge, setMfaChallenge] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalData?.currentLevel === "aal1") {
        const { data: factors, error } = await supabase.auth.mfa.listFactors();

        if (error) {
          setError(error.message);
          return;
        }

        const factor = factors.totp.find((f) => f.status === "verified");

        if (factor) {
          setMfaFactorId(factor.id);
          setMfaChallenge(true);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        const { data: factors } = await supabase.auth.mfa.listFactors();

        const factor = factors?.totp.find((f) => f.status === "verified");

        if (factor) {
          setMfaFactorId(factor.id);
          setMfaChallenge(true);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleVerifyMfa = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!mfaFactorId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: mfaFactorId,
        });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalData?.currentLevel !== "aal2") {
        throw new Error("MFA verification failed.");
      }

      setMfaChallenge(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError(null);

    if (!password || !confirmPassword) {
      setError("Please complete all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalData?.currentLevel !== "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();

        const factor = factors?.totp.find((f) => f.status === "verified");

        if (!factor) {
          throw new Error("No MFA factor found.");
        }

        setMfaFactorId(factor.id);
        setMfaChallenge(true);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccess(true);

      setTimeout(async () => {
        await supabase.auth.signOut();

        navigate("/login", {
          replace: true,
        });
      }, 3000);
    } catch (err: any) {
      setError(err.message ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  if (mfaChallenge && mfaFactorId) {
    return (
      <MfaVerificationForm
        mfaCode={mfaCode}
        setMfaCode={setMfaCode}
        loading={loading}
        error={error ?? ""}
        onSubmit={handleVerifyMfa}
        onCancel={() => navigate("/login")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-[440px] w-full">
        <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-xl p-10">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />

              <h2 className="text-2xl font-bold">Password Updated</h2>

              <p className="mt-3 text-slate-500">Redirecting to login...</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-8">Set your new password</h2>

              <form onSubmit={handleUpdate} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                    <p>{error}</p>
                  </div>
                )}

                <div>
                  <label className="block mb-2">New Password</label>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block mb-2">Confirm Password</label>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-100"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white rounded-xl py-4 flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
