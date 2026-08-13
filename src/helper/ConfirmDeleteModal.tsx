import React, { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock } from "lucide-react";

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  message?: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (confirmWord: string) => Promise<void> | void;
}

export default function ConfirmDeleteModal({
  open,
  title = "Delete Record",
  message = 'This action cannot be undone. Please enter the confirmation word "DELETE" to continue.',
  loading = false,
  error,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [confirmWord, setConfirmWord] = useState("");

  useEffect(() => {
    if (open) {
      setConfirmWord("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 p-6 dark:border-slate-800">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              {title}
            </h2>

            <p className="text-slate-700 dark:text-slate-300">
              Delete confirmation required
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            {message}
          </p>

          <div>
            <label className="mb-2 block font-medium text-slate-700 dark:text-slate-300">
              Type "DELETE" to confirm
            </label>

            <div className="relative">
              <input
                autoFocus
                type="text"
                value={confirmWord}
                disabled={loading}
                onChange={(e) => setConfirmWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && confirmWord.trim()) {
                    onConfirm(confirmWord);
                  }
                }}
                placeholder="Type 'DELETE' to confirm"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-4 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {error && <p className="mt-2 font-medium text-red-600">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 p-6 dark:border-slate-800">
          <button
            disabled={loading}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            disabled={loading || !confirmWord.trim()}
            onClick={() => onConfirm(confirmWord)}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            Delete Record
          </button>
        </div>
      </div>
    </div>
  );
}
