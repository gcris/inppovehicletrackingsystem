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
  Download,
  Filter
} from 'lucide-react';
import { format, subDays, formatDistanceToNow } from 'date-fns';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7); // Last X days
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState({
    patrolHours: [] as any[],
    signalLogs: [] as any[],
    unitDistribution: [] as any[],
    avgSpeed: 0,
    avgSignal: 84,
    weeklyHours: 0,
    activeAlerts: 0
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch dynamic analytics data based on timeRange
      const rangeStart = subDays(new Date(), timeRange).toISOString();
      const [unitsRes, logsRes, vehiclesRes, scheduleRes] = await Promise.all([
        supabase.from('unit').select('*'),
        supabase.from('vehicle_logs').select('*').gte('captured_at', rangeStart),
        supabase.from('vehicles').select('*'),
        supabase.from('schedule').select('*').gte('date', rangeStart.split('T')[0])
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (logsRes.error) throw logsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (scheduleRes.error) throw scheduleRes.error;

      // 1. Unit Distribution (Pie)
      let dist: any[] = [];
      if (unitsRes.data && vehiclesRes.data) {
        dist = unitsRes.data.map(u => ({
          name: u.unit_name,
          value: vehiclesRes.data.filter(v => v.unit_id === u.id).length
        })).filter(d => d.value > 0); // Only show units with vehicles
      }

      // 2. Average Speed, Signals, & Active Alerts
      let signalLogs: any[] = [];
      let avgSpeed = 0;
      let activeAlerts = 0;
      let avgSignal = 84;

      const sortedLogData = logsRes.data ? [...logsRes.data].sort((a, b) => 
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
      ) : [];

      if (sortedLogData.length > 0) {
        const avgSpeedCalc = sortedLogData.reduce((a, b) => a + Number(b.speed || 0), 0) / sortedLogData.length;
        avgSpeed = Number(avgSpeedCalc.toFixed(1));
        
        // Sampling down for dense/performance on charts (max 20 points)
        const sampleCount = 20;
        const step = Math.max(1, Math.floor(sortedLogData.length / sampleCount));
        const sampledLogs = [];
        for (let i = 0; i < sortedLogData.length; i += step) {
          sampledLogs.push(sortedLogData[i]);
        }
        
        signalLogs = sampledLogs.map(l => ({
          time: format(new Date(l.captured_at), 'MMM dd HH:mm'),
          signal: l.network_signal || 0,
          speed: Number(l.speed || 0)
        }));

        activeAlerts = sortedLogData.filter(l => (l.network_signal || 0) < 20).length;
        
        const totalSignal = sortedLogData.reduce((sum, l) => sum + (l.network_signal || 0), 0);
        avgSignal = Math.round(totalSignal / sortedLogData.length);
      }

      // 3. Patrol Hours based on schedule date and time
      const lastXDays = Array.from({ length: Math.min(timeRange, 14) }, (_, i) => subDays(new Date(), Math.min(timeRange, 14) - 1 - i));
      const daysData = lastXDays.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayName = format(date, 'EEE, MMM d');
        
        const daySchedules = (scheduleRes.data || []).filter(s => s.date === dateStr);
        let hours = 0;
        daySchedules.forEach(s => {
          if (s.time_from && s.time_to) {
            const [fH, fM] = s.time_from.split(':').map(Number);
            const [tH, tM] = s.time_to.split(':').map(Number);
            let diffMinutes = (tH * 60 + (tM || 0)) - (fH * 60 + (fM || 0));
            if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift
            hours += diffMinutes / 60;
          }
        });

        return {
          day: dayName,
          date: dateStr,
          hours: Number(hours.toFixed(1))
        };
      });

      let patrolHours = daysData;
      const weeklyHours = Math.round(patrolHours.reduce((sum, d) => sum + d.hours, 0));

      setStats({
        patrolHours,
        signalLogs,
        unitDistribution: dist,
        avgSpeed,
        avgSignal: sortedLogData.length > 0 ? avgSignal : '--' as any,
        weeklyHours,
        activeAlerts
      });

      // 4. Generate recent activities based on actual data
      const recentActivities: any[] = [];
      const recentSchedules = (scheduleRes.data || []).sort((a, b) => new Date(`${b.date}T${b.time_from || '00:00'}`).getTime() - new Date(`${a.date}T${a.time_from || '00:00'}`).getTime());
      
      recentSchedules.slice(0, 5).forEach(s => {
        const unitName = unitsRes.data?.find(u => u.id === s.unit_id)?.unit_name || 'Unknown Unit';
        const dObj = new Date(`${s.date}T${s.time_from || '00:00'}`);
        recentActivities.push({
          title: `Schedule Assigned - ${unitName}`,
          time: dObj.getTime() < Date.now() ? formatDistanceToNow(dObj, { addSuffix: true }) : `Planned for ${format(dObj, 'MMM d, p')}`,
          type: 'schedule',
          dateObj: dObj
        });
      });

      if (sortedLogData.length > 0) {
        // High speed
        const speedAlerts = sortedLogData.filter(l => l.speed > 80);
        const speedByVehicle = Array.from(new Set(speedAlerts.map(a => a.vehicle_id)));
        speedByVehicle.slice(0, 3).forEach(vId => {
          const logsForVehicle = speedAlerts.filter(a => a.vehicle_id === vId).sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
          const log = logsForVehicle[0]; // most recent
          const vehicleInfo = vehiclesRes.data?.find(v => v.id === log.vehicle_id);
          const dObj = new Date(log.captured_at);
          recentActivities.push({
            title: `High Speed Alert: ${vehicleInfo?.plate_number || 'Unknown'} (${log.speed} km/h)`,
            time: formatDistanceToNow(dObj, { addSuffix: true }),
            type: 'alert',
            dateObj: dObj
          });
        });

        // Low signal
        const signalAlerts = sortedLogData.filter(l => l.network_signal < 20);
        const signalByVehicle = Array.from(new Set(signalAlerts.map(a => a.vehicle_id)));
        signalByVehicle.slice(0, 3).forEach(vId => {
          const logsForVehicle = signalAlerts.filter(a => a.vehicle_id === vId).sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
          const log = logsForVehicle[0]; // most recent
          const vehicleInfo = vehiclesRes.data?.find(v => v.id === log.vehicle_id);
          const dObj = new Date(log.captured_at);
          recentActivities.push({
            title: `Signal Drop: ${vehicleInfo?.plate_number || 'Unknown'} (${Math.round(log.network_signal)}%)`,
            time: formatDistanceToNow(dObj, { addSuffix: true }),
            type: 'alert',
            dateObj: dObj
          });
        });
      }

      recentActivities.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      
      if (recentActivities.length === 0) {
        recentActivities.push({
          title: "System Online & Syncing Data",
          time: "Just now",
          type: "sync",
          dateObj: new Date()
        });
      }

      setActivities(recentActivities.slice(0, 7));

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-1 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Performance Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Deep dive into unit efficiency and fleet health</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
            <button 
              onClick={() => setTimeRange(1)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${timeRange === 1 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              24h
            </button>
            <button 
              onClick={() => setTimeRange(7)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${timeRange === 7 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              7d
            </button>
            <button 
              onClick={() => setTimeRange(30)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${timeRange === 30 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              30d
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 hidden sm:flex">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
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
              value={`${stats.avgSignal}%`} 
              icon={<Zap className="w-5 h-5 text-amber-500" />} 
            />
            <AnalyticCard 
              label="Weekly Patrol Hours" 
              value={`${stats.weeklyHours}h`} 
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
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">Patrol Hours Distribution</h3>
                <Shield className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              </div>
              <div className="h-64 flex items-center justify-center">
                {(!stats.patrolHours || stats.patrolHours.every((d: any) => d.hours === 0)) ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                      <Shield className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No scheduled hours</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Add schedules to see data</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.patrolHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }} />
                      <Bar dataKey="hours" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Signal Quality Line Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">Signal Stability Trends</h3>
                <Zap className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              </div>
              <div className="h-64 flex items-center justify-center">
                {(!stats.signalLogs || stats.signalLogs.length === 0) ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                      <Zap className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No logs collected</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Start a patrol session</p>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Unit Fleet Pie Chart */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm xl:col-span-1 transition-colors">
              <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs mb-6 px-2">Fleet Composition by Unit</h3>
              <div className="h-64 flex items-center justify-center">
                {(!stats.unitDistribution || stats.unitDistribution.length === 0) ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                      <BarChart3 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No vehicles tracked</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Assign vehicles to units</p>
                  </div>
                ) : (
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
                )}
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

            {/* Recent System Activity Log */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm xl:col-span-2 transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">Recent System Activity</h3>
                <FileText className="w-4 h-4 text-slate-300 dark:text-slate-700" />
              </div>
              <div className="space-y-2">
                {activities.map((act, i) => (
                  <ActivityRow key={i} title={act.title} time={act.time} type={act.type} />
                ))}
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
  const getIcon = () => {
    switch (type) {
      case 'alert': return <AlertCircle className="w-4 h-4" />;
      case 'sync': return <Clock className="w-4 h-4" />;
      case 'schedule': return <FileText className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors cursor-default -mx-2">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          type === 'alert' ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
          type === 'sync' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400' :
          type === 'schedule' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400' :
          'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }`}>
          {getIcon()}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{title}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{time}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 shrink-0 ml-2" />
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
