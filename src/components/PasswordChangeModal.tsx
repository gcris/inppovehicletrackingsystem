import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  CheckCircle2,
  Loader2,
  MessageCircleWarning,
  ShieldAlert,
} from "lucide-react";
import MfaVerificationForm from "./auth/MfaVerificationForm";
import { useAuth } from "./AuthProvider";

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  title?: string;
  description?: string;
}

export function PasswordChangeModal({
  isOpen,
  onClose,
  email,
  title = "Change Password",
  description = "For security, please enter your current and new password.",
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const { setIsMfaVerified, clearAuthCache } = useAuth();

  // Add this helper inside your component
  const updatePassword = useCallback(async () => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });

    if (error) {
      throw error;
    }

    setSuccess("Successfully changed password.");
    setMfaChallenge(false);
    setMfaFactorId("");
    setMfaCode("");
    setIsMfaVerified(false);
  }, [currentPassword, newPassword, setIsMfaVerified]);

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleVerify = useCallback(async () => {
    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }

    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // DO NOT call signInWithPassword()

      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalData?.currentLevel === "aal2") {
        await updatePassword();
        return;
      }

      const { data: factors, error: factorError } =
        await supabase.auth.mfa.listFactors();

      if (factorError) throw factorError;

      const factor = factors.totp.find((f) => f.status === "verified");

      if (!factor) {
        throw new Error("No verified MFA factor found.");
      }

      setMfaFactorId(factor.id);
      setMfaChallenge(true);
    } catch (err: any) {
      setError(err.message ?? "Unable to change password.");
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, updatePassword]);

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
        throw new Error("MFA verification did not establish an AAL2 session.");
      }

      setIsMfaVerified(true);

      await updatePassword();
    } catch (err: any) {
      setError(err.message || "Invalid authentication code");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (mfaChallenge && mfaFactorId) {
    return (
      <MfaVerificationForm
        mfaCode={mfaCode}
        setMfaCode={setMfaCode}
        loading={loading}
        error={error!}
        onSubmit={handleVerifyMfa}
        onCancel={() => {
          setMfaFactorId("");
          setMfaCode("");
          clearAuthCache();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <ShieldAlert className="w-12 h-12 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6 flex items-start gap-3">
            <MessageCircleWarning className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="bg-green-50 dark:bg-green-900 border border-green-100 dark:border-green-800 text-green-600 dark:text-green-400 p-4 rounded-lg mb-6 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{success}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Current Password
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={64}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                autoComplete="current-password"
                inputMode="text"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              New Password
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={64}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                autoComplete="new-password"
                inputMode="text"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={64}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                autoComplete="new-password"
                inputMode="text"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={
                loading ||
                !currentPassword.trim() ||
                !newPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              className="ml-3 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
