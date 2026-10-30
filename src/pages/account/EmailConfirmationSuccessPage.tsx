import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { CheckCircle2, LogIn } from "lucide-react";
import { useTheme, useThemeActions } from "../../components/ThemeProvider";

export default function EmailConfirmationSuccessPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { toggleTheme } = useThemeActions();

  // Sign out any session created during the Supabase confirmation flow
  // so the user must log in manually.
  useEffect(() => {
    supabase.auth.signOut();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
      >
        {theme === "light" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-md text-center bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-blue-500/5 p-8 border border-slate-100 dark:border-slate-800 transition-colors flex flex-col items-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-500" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Email Confirmed
        </h2>

        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
          Your email address has been successfully verified. Please sign in to
          continue.
        </p>

        <button
          onClick={() => navigate("/login", { replace: true })}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none w-fit"
        >
          <LogIn className="w-5 h-5" />
          Go to Login
        </button>
      </div>
    </div>
  );
}
