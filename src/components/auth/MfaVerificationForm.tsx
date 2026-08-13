import { AlertCircle, Loader2, QrCode } from "lucide-react";

interface MfaVerificationFormProps {
  mfaCode: string;
  setMfaCode: (code: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  buttonText?: string;
}

export default function MfaVerificationForm({
  mfaCode,
  setMfaCode,
  loading,
  error,
  onSubmit,
  onCancel,
  title = "Two-Factor Auth",
  description = "Enter the 6-digit code from Google Authenticator",
  buttonText = "Verify Code",
}: MfaVerificationFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6 py-12">
      <div className="w-full max-w-md">
        <div
          className="
      overflow-hidden
      rounded-3xl
      border
      border-slate-200
      dark:border-slate-800
      bg-white/95
      dark:bg-slate-900/95
      shadow-2xl
      backdrop-blur-xl
    "
        >
          {/* Header */}

          <div className="border-b border-slate-200 dark:border-slate-800 px-8 py-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-xl shadow-blue-500/25">
              <QrCode className="h-10 w-10 text-white" />
            </div>

            <div className="mt-6 text-center">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Secure Verification
              </span>

              <h2 className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
                {title}
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-500">
                {description}
              </p>
            </div>
          </div>

          {/* Body */}

          <div className="px-8 py-8">
            <form onSubmit={onSubmit} className="space-y-6">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />

                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-400">
                        Verification Failed
                      </p>

                      <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* OTP */}

              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Authentication Code
                </label>

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

              {/* Info */}

              <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm leading-6 text-blue-700 dark:text-blue-300">
                  Open your authenticator application and enter the current
                  6-digit verification code displayed for your account.
                </p>
              </div>

              {/* Submit */}

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="
              flex
              w-full
              items-center
              justify-center
              rounded-2xl
              bg-blue-600
              py-4
              text-base
              font-semibold
              text-white
              shadow-lg
              shadow-blue-500/25
              transition-all
              hover:-translate-y-0.5
              hover:bg-blue-700
              hover:shadow-xl
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  buttonText
                )}
              </button>

              {/* Cancel */}

              <button
                type="button"
                onClick={onCancel}
                className="
              w-full
              rounded-2xl
              border
              border-slate-300
              dark:border-slate-700
              py-3
              text-sm
              font-medium
              text-slate-600
              transition
              hover:bg-slate-100
              dark:text-slate-300
              dark:hover:bg-slate-800
            "
              >
                Cancel Setup & Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
