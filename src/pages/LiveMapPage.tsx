import React from 'react';
import { useVehicleRealtime } from '../hooks/useVehicleRealtime';
import TrackingMap from '../components/TrackingMap';
import { Map as MapIcon } from 'lucide-react';

export default function LiveMapPage() {
  const { vehicles, logs } = useVehicleRealtime();
  const vehiclesList = vehicles ? Object.values(vehicles) : [];
  const normalCount = 0;
  const expiredCount = 0;

  return (
    <div className="flex flex-col gap-6 h-full min-h-[750px] pb-6">
      {/* Live Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <StatCard label="Live Units" value={Object.keys(logs || {}).length} sub="Real-time logs" />
        <StatCard label="Normal Status" value={normalCount} sub="Operations normal" status="success" />
        <StatCard label="Expired Status" value={expiredCount} sub="Action required" status="danger" />
        <StatCard label="Ilocos Norte Reach" value={14} sub="Officers deployed" />
      </div>

      {/* Map Container Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 min-h-[500px] transition-colors">
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-slate-50 dark:border-slate-800/50">
          <div>
            <h2 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-blue-600" />
              INPPO Provincial Sector Real-time Tracking
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Ilocos Norte Provincial Office Command</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-100 dark:border-slate-800">
            <LegendItem color="bg-green-500" label="Normal" />
            <LegendItem color="bg-amber-500" label="Expired" />
          </div>
        </div>
        <div className="flex-1 relative mt-2 min-h-[400px]">
          <TrackingMap vehicles={vehicles} logs={logs} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, status }: { label: string, value: number, sub: string, status?: 'success' | 'danger' }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-end gap-2 mb-1">
        <h3 className={`text-3xl font-black tracking-tighter ${
          status === 'success' ? 'text-green-600' : 
          status === 'danger' ? 'text-red-500' : 
          'text-slate-900 dark:text-white'
        }`}>{value}</h3>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{sub}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
      <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
    </div>
  );
}
