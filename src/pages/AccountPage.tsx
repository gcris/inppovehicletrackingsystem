import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 max-w-4xl mx-auto w-full py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <User className="w-8 h-8 text-blue-600" />
            Control Center Account
          </h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mt-1">Manage your administrative identity and security</p>
        </div>
        
        <button 
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-100 transition-all disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Terminate Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 space-y-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-[28px] bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-200">
                  {user?.email?.slice(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border border-slate-50">
                  <BadgeCheck className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">{user?.email?.split('@')[0]}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Operator
                  </div>
                  <span className="text-xs font-bold text-slate-400">UID: {user?.id.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Electronic Mail</label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{user?.email}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Provider</label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700 uppercase">{user?.app_metadata?.provider || 'Auth Service'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
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
          <div className="bg-slate-900 rounded-[32px] p-8 text-white space-y-6 shadow-2xl shadow-slate-200">
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

          <div className="bg-blue-50 border border-blue-100 rounded-[32px] p-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-900 mb-2">Technical Support</p>
                <p className="text-[10px] font-bold text-blue-700/70 leading-relaxed mb-4">
                  Encountering issues with live tracking or data sync? Contact the DICT Support Team for priority assistance.
                </p>
                <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
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
    <div className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        type === 'login' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'
      }`}>
        <Shield className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-black text-slate-900">{title}</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase">{time}</span>
        </div>
        <p className="text-xs font-bold text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
