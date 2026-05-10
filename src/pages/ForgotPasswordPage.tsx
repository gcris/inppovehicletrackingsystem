import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Mail, AlertCircle, Loader2, ChevronLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="max-w-[440px] w-full">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-200 dark:shadow-none mb-6 font-bold text-white">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">SECURE ACCESS</h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="p-10">
            {success ? (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Check Your Inbox</h2>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-8 leading-relaxed">
                  We've sent a passkey recovery link to <span className="text-slate-900 dark:text-white font-extrabold">{email}</span>
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Account Recovery</h2>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Provide your verified email to reset your passkey</p>
                </div>

                <form onSubmit={handleReset} className="space-y-6">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-xs font-black uppercase text-red-600 dark:text-red-400">{error}</p>
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
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 shadow-xl shadow-slate-200 dark:shadow-none disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Request Recovery Link'
                    )}
                  </button>

                  <div className="text-center">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" />
                      Return to Secure Login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
