import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Lock, Mail, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="max-w-[440px] w-full">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 shadow-xl shadow-blue-200 overflow-hidden rounded-[24px] mb-6 group cursor-default">
            <img src="/input_file_0.png" alt="INPPO Logo" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">INPPO PATROL</h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Ilocos Norte Provincial Office</p>
        </div>

        <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-sm font-bold text-slate-400">Sign in to access the command center</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-xs font-black uppercase leading-relaxed">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    required
                    type="email"
                    placeholder="name@pnp.gov.ph"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Password</label>
                  <Link to="/forgot-password" size="sm" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
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

          <div className="bg-slate-50 p-6 border-t border-slate-100 flex items-center justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
              Secured by Department of Information and <br />Communications Technology
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
