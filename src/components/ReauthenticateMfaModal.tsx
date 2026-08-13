import React, { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircleWarning,
  ShieldAlert,
} from "lucide-react";

interface ReauthenticateMfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  title?: string;
  description?: string;
}

/**
 * Re-authenticate with MFA (AAL2) modal
 * Used before sensitive actions like changing password or email
 */
export function ReauthenticateMfaModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Verify Your Identity",
  description = "For security, please verify your identity with your authenticator app.",
}: ReauthenticateMfaModalProps) {
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = useCallback(async () => {
    if (!totpCode.trim()) {
      setError("Please enter your authenticator code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get the list of factors to find the TOTP factor
      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const factors = factorsData?.all || [];
      const totpFactor = factors.find(
        (f: any) => f.factor_type === "totp" && f.status === "verified",
      );

      if (!totpFactor) {
        throw new Error(
          "No verified TOTP factor found. Please set up MFA in your account settings.",
        );
      }

      // Step 2: Create a challenge for the TOTP factor
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challengeError) throw challengeError;

      // Step 3: Verify the challenge with TOTP code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: totpCode,
      });
      if (verifyError) throw verifyError;

      // Success - execute the callback
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.message ||
          "Authentication failed. Please check your authenticator code.",
      );
      setLoading(false);
    }
  }, [totpCode, onSuccess, onClose, supabase.auth]);

  const handleClose = () => {
    setTotpCode("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl">
        <div className="text-center mb-6">
          <ShieldAlert className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h2>
          <p className="text-slate-600 dark:text-slate-300">{description}</p>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg mb-6 flex items-start gap-3">
            <MessageCircleWarning className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Enter your authenticator code
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="○○○○○○"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-2xl font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleVerify();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const paste = e.clipboardData.getData("text");
                  const numbers = paste.replace(/\D/g, "");
                  setTotpCode(numbers.substring(0, 6));
                }}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                # # # # # #
              </div>
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
              disabled={loading || !totpCode.trim()}
              className="ml-3 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
