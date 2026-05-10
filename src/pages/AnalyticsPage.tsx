import React, { useState, useEffect } from 'react';
import { supabase, Vehicle, Unit, VehicleLog } from '../lib/supabase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Clock, 
  Shield, 
  AlertCircle,
  FileText,
  Download
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    patrolHours: [] as any[],
    signalLogs: [] as any[],
    unitDistribution: [] as any[],
    avgSpeed: 0,
    activeAlerts: 0
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    
    // Simulate/Fetch some analytics data
    const [unitsRes, logsRes, vehiclesRes] = await Promise.all([
      supabase.from('unit').select('*'),
      supabase.from('vehicle_logs').select('*').gte('captured_at', subDays(new Date(), 7).toISOString()),
      supabase.from('vehicles').select('*')
    ]);

    // 1. Unit Distribution (Pie)
    if (unitsRes.data && vehiclesRes.data) {
      const dist = unitsRes.data.map(u => ({
        name: u.unit_name,
        value: vehiclesRes.data.filter(v => v.unit_id === u.id).length
      }));
      setStats(prev => ({ ...prev, unitDistribution: dist }));
    }

    // 2. Average Speed & Active Alerts
    if (logsRes.data) {
      const avg = logsRes.data.reduce((a, b) => a + Number(b.speed), 0) / logsRes.data.length;
      const signalLogs = logsRes.data
        .slice(0, 20) // Just sample for visualization
        .map(l => ({
          time: format(new Date(l.captured_at), 'HH:mm'),
          signal: l.network_signal,
          speed: l.speed
        }));
      
      setStats(prev => ({ 
        ...prev, 
        avgSpeed: Number(avg.toFixed(1)),
        signalLogs: signalLogs,
        activeAlerts: logsRes.data.filter(l => l.network_signal < 20).length
      }));
    }

    // 3. Simulated Patrol Hours
    setStats(prev => ({
      ...prev,
      patrolHours: [
        { day: 'Mon', hours: 45 },
        { day: 'Tue', hours: 52 },
        { day: 'Wed', hours: 48 },
        { day: 'Thu', hours: 61 },
        { day: 'Fri', hours: 55 },
        { day: 'Sat', hours: 32 },
        { day: 'Sun', hours: 28 },
      ]
    }));

    setLoading(false);
  };

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Performance Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Deep dive into unit efficiency and fleet health</p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-6">
          {/* Top Row Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <AnalyticCard 
              label="Avg Patrol Speed" 
              value={`${stats.avgSpeed} km/h`} 
              icon={<TrendingUp className="w-5 h-5 text-blue-600" />} 
            />
            <AnalyticCard 
              label="Network Signal Avg" 
              value="84%" 
              icon={<Zap className="w-5 h-5 text-amber-500" />} 
            />
            <AnalyticCard 
              label="Weekly Patrol Hours" 
              value="321h" 
              icon={<Clock className="w-5 h-5 text-green-600" />} 
            />
            <AnalyticCard 
              label="Connection Drops" 
              value={stats.activeAlerts} 
              icon={<AlertCircle className="w-5 h-5 text-red-500" />} 
              trend="24h period"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Patrol Hours Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">Patrol Hours Distribution (Past 7 Days)</h3>
                <Shield className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.patrolHours}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Signal Quality Line Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">Signal Stability Trends</h3>
                <Zap className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.signalLogs}>
                    <defs>
                      <linearGradient id="colorSignal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }} />
                    <Area type="monotone" dataKey="signal" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSignal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Unit Fleet Pie Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm xl:col-span-1 transition-colors">
              <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs mb-6 px-2">Fleet Composition by Unit</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.unitDistribution}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.unitDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {stats.unitDistribution.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{item.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Data Activity Log */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm xl:col-span-2 transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">Recent System Activity</h3>
                <FileText className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              </div>
              <div className="space-y-4">
                <ActivityRow title="Database Sync Completed" time="2 mins ago" type="sync" />
                <ActivityRow title="Weekly Report Generated" time="15 mins ago" type="report" />
                <ActivityRow title="New Vehicle Registered (PNP-882)" time="1 hour ago" type="vehicle" />
                <ActivityRow title="Signal Drop Alert: Sector 4" time="2 hours ago" type="alert" />
                <ActivityRow title="Schedule Updated for Station 6" time="4 hours ago" type="schedule" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticCard({ label, value, icon, trend }: { label: string, value: string | number, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          {icon}
        </div>
        {trend && <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{trend}</span>}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function ActivityRow({ title, time, type }: { title: string, time: string, type: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          type === 'alert' ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
          type === 'sync' ? 'bg-green-50 dark:bg-green-900/20 text-green-500 dark:text-green-400' :
          'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }`}>
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{time}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
