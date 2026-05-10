import React from 'react';
import { useVehicleRealtime } from '../hooks/useVehicleRealtime';
import TrackingMap from '../components/TrackingMap';
import { Map as MapIcon } from 'lucide-react';

export default function LiveMapPage() {
  const { vehicles, logs } = useVehicleRealtime();

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-slate-50">
        <div>
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-blue-600" />
            INPPO Provincial Sector Real-time Tracking
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ilocos Norte Provincial Office Command</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-100 dark:border-slate-800">
          <LegendItem color="bg-green-500" label="Normal" />
          <LegendItem color="bg-amber-500" label="Expired" />
        </div>
      </div>
      <div className="flex-1 relative mt-2">
        <TrackingMap vehicles={vehicles} logs={logs} />
      </div>
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
