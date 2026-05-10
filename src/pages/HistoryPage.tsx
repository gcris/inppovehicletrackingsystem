import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase, Vehicle, VehicleLog } from '../lib/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Navigation,
  Activity,
  History as HistoryIcon
} from 'lucide-react';

const getSpeedColor = (speed: number) => {
  if (speed > 80) return '#ef4444'; // Red
  if (speed > 50) return '#f59e0b'; // Amber
  if (speed > 20) return '#22c55e'; // Green
  return '#3b82f6'; // Blue
};

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 14);
  return null;
}

export default function HistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchVehicle(id);
      fetchHistory(id, selectedDate);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentIndex < logs.length - 1) {
      interval = setInterval(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    } else {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, logs.length]);

  const fetchVehicle = async (vehicleId: string) => {
    const { data } = await supabase.from('vehicles').select('*').eq('id', vehicleId).single();
    if (data) setVehicle(data);
  };

  const fetchHistory = async (vehicleId: string, dateStr: string) => {
    setLoading(true);
    const start = startOfDay(new Date(dateStr)).toISOString();
    const end = endOfDay(new Date(dateStr)).toISOString();

    const { data, error } = await supabase
      .from('vehicle_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .gte('captured_at', start)
      .lte('captured_at', end)
      .order('captured_at', { ascending: true });

    if (data) {
      setLogs(data);
      setCurrentIndex(0);
    }
    setLoading(false);
  };

  // Group logs into segments for color-coded Polyline
  const segments = logs.reduce((acc: any[], log, i) => {
    if (i === 0) return acc;
    const prevLog = logs[i - 1];
    acc.push({
      positions: [[prevLog.latitude, prevLog.longitude], [log.latitude, log.longitude]],
      color: getSpeedColor(Number(log.speed))
    });
    return acc;
  }, []);

  const currentLog = logs[currentIndex];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-sm transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-blue-600" />
              Patrol Trail Replay
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Vehicle: <span className="text-slate-900 dark:text-slate-200 font-bold">{vehicle?.plate_number || 'Loading...'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Map Area */}
        <div className="flex-[3] bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 relative flex flex-col overflow-hidden transition-colors">
          <div className="flex-1 relative rounded-xl overflow-hidden">
            <MapContainer center={[14.5995, 120.9842]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {segments.map((seg, i) => (
                <Polyline key={i} positions={seg.positions} color={seg.color} weight={5} opacity={0.8} />
              ))}

              {currentLog && (
                <Marker 
                  position={[currentLog.latitude, currentLog.longitude]}
                  icon={L.divIcon({
                    className: 'custom-replay-icon',
                    html: `<div class="w-10 h-10 bg-blue-600 rounded-full border-4 border-white dark:border-slate-800 shadow-xl flex items-center justify-center text-white">
                      <Navigation class="w-5 h-5" style="transform: rotate(${currentIndex > 0 ? '45deg' : '0deg'})" />
                    </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                  })}
                >
                  <Popup>
                    <div className="text-sm">
                      <p><b>Time:</b> {format(new Date(currentLog.captured_at), 'HH:mm:ss')}</p>
                      <p><b>Speed:</b> {currentLog.speed} km/h</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {currentLog && <ChangeView center={[currentLog.latitude, currentLog.longitude]} />}
            </MapContainer>
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4 transition-colors">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={logs.length === 0}
                className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>

              <button 
                onClick={() => setCurrentIndex(0)}
                disabled={logs.length === 0}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <div className="flex-1 flex flex-col gap-2">
                <input 
                  type="range"
                  min="0"
                  max={logs.length > 0 ? logs.length - 1 : 0}
                  value={currentIndex}
                  onChange={(e) => setCurrentIndex(Number(e.target.value))}
                  className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <span>Start: {logs.length > 0 ? format(new Date(logs[0].captured_at), 'HH:mm') : '--:--'}</span>
                  <span>{currentLog ? format(new Date(currentLog.captured_at), 'HH:mm:ss') : 'Playback Progress'}</span>
                  <span>End: {logs.length > 0 ? format(new Date(logs[logs.length-1].captured_at), 'HH:mm') : '--:--'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trail Sidebar */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              Trail Analytics
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl transition-colors">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Summary</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Total Points</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">{logs.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Avg Speed</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white italic">
                    {logs.length > 0 ? (logs.reduce((a, b) => a + Number(b.speed), 0) / logs.length).toFixed(1) : 0} <span className="text-[10px]">KM/H</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Recent Violations</p>
              <p className="text-xs text-slate-400 dark:text-slate-600 italic">No speed violations detected for this range.</p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Speed Legend</p>
              <div className="space-y-2">
                <LegendItem color="#ef4444" label="Overspeeding (>80)" />
                <LegendItem color="#f59e0b" label="Fast (50-80)" />
                <LegendItem color="#22c55e" label="Patrol (20-50)" />
                <LegendItem color="#3b82f6" label="Slow/Static (<20)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-1 rounded-full" style={{ backgroundColor: color }}></div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}
