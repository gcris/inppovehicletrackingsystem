import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { 
  User, 
  Mail, 
  Shield, 
  ShieldCheck, 
  LogOut, 
  ArrowRight, 
  Clock, 
  BadgeCheck,
  AlertCircle,
  Loader2,
  Building2,
  Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccountPage() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const initial = profile?.fullname?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto w-full py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <User className="w-8 h-8 text-blue-600" />
            Control Center Account
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Manage your administrative identity and security</p>
        </div>
        
        <button 
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-100 dark:hover:bg-red-900/40 transition-all disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Terminate Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-8 space-y-8 transition-colors">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-[28px] bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-200">
                  {initial}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md border border-slate-50 dark:border-slate-700">
                  {profile?.is_approved ? (
                    <BadgeCheck className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {profile?.fullname || user?.email?.split('@')[0]}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    {isAdmin ? 'Central Admin' : 'Verified Operator'}
                  </div>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ID: {profile?.badge_number || user?.id.slice(0, 8)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Rank & Serial</label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Award className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {profile?.rank || 'No Rank Set'}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Assigned Unit</label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">
                    {(profile as any)?.unit?.unit_name || 'Unit Assignment Pending'}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Electronic Mail</label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{user?.email}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Identity Provider</label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Shield className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">{user?.app_metadata?.provider || 'Auth Service'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-8 transition-colors">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Recent Security Events
            </h3>
            <div className="space-y-4">
              <SecurityEvent 
                title="System Authorization" 
                desc="Authorized login from Manila, PH" 
                time="Today, 08:42 AM" 
                type="login"
              />
              <SecurityEvent 
                title="Session Refresh" 
                desc="Automatic token rotation verified" 
                time="Yesterday, 11:24 PM" 
                type="refresh"
              />
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 dark:bg-slate-950 rounded-[32px] p-8 text-white space-y-6 shadow-2xl shadow-slate-200 dark:shadow-none transition-colors border border-transparent dark:border-slate-800">
            <div>
              <h3 className="text-lg font-black mb-2">Security Advisory</h3>
              <p className="text-xs text-slate-400 font-bold leading-relaxed">
                Your account is currently protected by standard verification. For enhanced station security, we recommend rotating your passkey every 90 days.
              </p>
            </div>
            
            <button className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group">
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-widest mb-1 text-blue-400">Passkey Rotation</p>
                <p className="text-[10px] font-bold text-white/60">Update security access codes</p>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group">
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-widest mb-1 text-amber-400">Station Logs</p>
                <p className="text-[10px] font-bold text-white/60">Audit your recent actions</p>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-[32px] p-8 transition-colors">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-300 mb-2">Technical Support</p>
                <p className="text-[10px] font-bold text-blue-700/70 dark:text-blue-400/70 leading-relaxed mb-4">
                  Encountering issues with live tracking or data sync? Contact the DICT Support Team for priority assistance.
                </p>
                <button className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline">
                  Submit Support Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityEvent({ title, desc, time, type }: { title: string, desc: string, time: string, type: string }) {
  return (
    <div className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        type === 'login' 
          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
      }`}>
        <Shield className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">{title}</p>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{time}</span>
        </div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
    </div>
  );
}
