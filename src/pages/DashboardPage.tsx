import React, { useState, useEffect } from 'react';
import { supabase, Vehicle, VehicleLog, Personnel, Schedule } from '../lib/supabase';
import { 
  Activity, 
  Map as MapIcon, 
  Shield, 
  Car, 
  Users, 
  AlertCircle, 
  ArrowUpRight, 
  Navigation,
  Clock,
  Radio
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    activeVehicles: 0,
    onDutyPersonnel: 0,
    totalPersonnel: 0,
    emergencyAlerts: 0,
    recentLogs: [] as any[],
    schedules: [] as any[]
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    const [vehiclesRes, personnelRes, schedulesRes, logsRes] = await Promise.all([
      supabase.from('vehicles').select('*'),
      supabase.from('personnel').select('*'),
      supabase.from('schedule').select('*, personnel(*), unit(*)').eq('date', format(new Date(), 'yyyy-MM-dd')),
      supabase.from('vehicle_logs').select('*, vehicles(*)').order('captured_at', { ascending: false }).limit(5)
    ]);

    if (vehiclesRes.data) {
      setData(prev => ({
        ...prev,
        activeVehicles: vehiclesRes.data.filter(v => v.load_status === 'Normal').length,
        emergencyAlerts: vehiclesRes.data.filter(v => v.load_status === 'Expired').length
      }));
    }

    if (personnelRes.data) {
      setData(prev => ({
        ...prev,
        totalPersonnel: personnelRes.data.length
      }));
    }

    if (schedulesRes.data) {
      setData(prev => ({
        ...prev,
        onDutyPersonnel: schedulesRes.data.length,
        schedules: schedulesRes.data
      }));
    }

    if (logsRes.data) {
      setData(prev => ({
        ...prev,
        recentLogs: logsRes.data
      }));
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Command Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Real-time situational awareness for INPPO Provincial Command</p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 transition-colors">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{format(new Date(), 'HH:mm')} • {format(new Date(), 'MMM dd, yyyy')}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard 
              label="Normal Units" 
              value={data.activeVehicles} 
              icon={<Car className="w-5 h-5 text-green-600" />} 
              status="success"
              sub="Systems operational"
            />
            <SummaryCard 
              label="Expired Units" 
              value={data.emergencyAlerts} 
              icon={<AlertCircle className="w-5 h-5 text-amber-500" />} 
              status={data.emergencyAlerts > 0 ? "danger" : undefined}
              sub="Immediate review required"
            />
            <Link to="/map" className="group">
              <div className="h-full bg-blue-600 p-6 rounded-2xl shadow-lg border border-blue-700 flex flex-col justify-between hover:bg-blue-700 transition-all cursor-pointer">
                <MapIcon className="w-8 h-8 text-white/50 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="text-white font-black text-lg flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                    Live View <ArrowUpRight className="w-4 h-4" />
                  </p>
                  <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Switch to Tracking Map</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Vehicle Activity */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  Recent Telemetry Updates
                </h3>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.recentLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        log.vehicles?.load_status === 'Expired' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                      }`}>
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{log.vehicles?.plate_number}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                          <span className="text-blue-600">{log.speed} km/h</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                          <span>Signal: {log.network_signal}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{format(new Date(log.captured_at), 'HH:mm:ss')}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">Received</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Deployment List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest text-[10px] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Active Assignments
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {data.schedules.slice(0, 5).map((sched) => (
                  <div key={sched.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">{sched.unit?.unit_name}</span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none">{sched.time_from.slice(0, 5)} - {sched.time_to.slice(0, 5)}</span>
                    </div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">{sched.personnel?.fullname}</p>
                    <div className="flex items-center gap-2">
                      <Radio className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{sched.sector}</span>
                    </div>
                  </div>
                ))}
                {data.schedules.length === 0 && (
                  <p className="text-xs font-bold text-slate-400 text-center py-10">No active assignments</p>
                )}
                <Link to="/schedule" className="block text-center text-[10px] font-black text-blue-600 uppercase tracking-widest pt-2 hover:underline">
                  View Full Schedule
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, status, sub }: { label: string, value: number, icon: React.ReactNode, status?: 'success' | 'danger', sub: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          {icon}
        </div>
        <div className={`w-2 h-2 rounded-full ${
          status === 'danger' && value > 0 ? 'bg-red-500 animate-pulse' :
          status === 'success' ? 'bg-green-500' :
          'bg-slate-200 dark:bg-slate-700'
        }`}></div>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <h3 className={`text-3xl font-black tracking-tighter ${
          status === 'success' ? 'text-green-600' : 
          status === 'danger' && value > 0 ? 'text-red-500' : 
          'text-slate-900 dark:text-white'
        }`}>{value}</h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">{sub}</p>
      </div>
    </div>
  );
}
