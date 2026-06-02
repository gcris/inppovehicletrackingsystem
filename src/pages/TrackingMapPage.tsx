import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase, Vehicle, VehicleLog, Schedule } from '../lib/supabase';
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

if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

const getSpeedColor = (speed: number) => {
  if (speed > 80) return '#ef4444'; // Red
  if (speed > 50) return '#f59e0b'; // Amber
  if (speed > 20) return '#22c55e'; // Green
  return '#3b82f6'; // Blue
};

function ChangeView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], 14);
      map.invalidateSize();
    }
  }, [map, lat, lng]);
  return null;
}

// Helper to group logs into sessions based on interval
const groupLogsBySession = (allLogs: VehicleLog[], thresholdMinutes = 10) => {
  if (allLogs.length === 0) return [];
  const sessions: VehicleLog[][] = [];
  let currentSession: VehicleLog[] = [allLogs[0]];

  for (let i = 1; i < allLogs.length; i++) {
    const prevTime = new Date(allLogs[i - 1].captured_at).getTime();
    const currTime = new Date(allLogs[i].captured_at).getTime();
    const diffMinutes = (currTime - prevTime) / 60000;

    if (diffMinutes > thresholdMinutes) {
      sessions.push(currentSession);
      currentSession = [allLogs[i]];
    } else {
      currentSession.push(allLogs[i]);
    }
  }
  sessions.push(currentSession);
  return sessions;
};

export default function TrackingMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [sessions, setSessions] = useState<VehicleLog[][]>([]);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(-1);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [threshold, setThreshold] = useState<number>(30); // Default to 30 mins to avoid premature splitting
  const [totalLogs, setTotalLogs] = useState<number>(0);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Group logs into sessions whenever they change or threshold changes
  useEffect(() => {
    if (logs.length > 0) {
      const grouped = groupLogsBySession(logs, threshold);
      setSessions(grouped);
      setSelectedSessionIndex(prev => {
        if (prev >= 0 && prev < grouped.length) return prev;
        return 0;
      });
    } else {
      setSessions([]);
      setSelectedSessionIndex(-1);
    }
  }, [logs, threshold]);

  // Use logs from the selected session for playback
  const activeLogs = selectedSessionIndex >= 0 ? sessions[selectedSessionIndex] : [];

  useEffect(() => {
    if (id) {
      fetchVehicle(id);
      fetchHistory(id, selectedDate);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    if (vehicle?.unit_id && selectedDate) {
      fetchSchedules(vehicle.unit_id, selectedDate);
    }
  }, [vehicle?.unit_id, selectedDate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentIndex < activeLogs.length - 1) {
      interval = setInterval(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    } else {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, activeLogs.length]);

  const fetchVehicle = async (vehicleId: string) => {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', vehicleId).single();
      if (error) console.error('Error fetching vehicle:', error);
      else if (data) setVehicle(data);
    } catch (err) {
      console.error('Fetch vehicle failed:', err);
    }
  };

  const fetchSchedules = async (unitId: string, dateStr: string) => {
    try {
      const { data, error } = await supabase
        .from('schedule')
        .select('*, personnel(*)')
        .eq('unit_id', unitId)
        .eq('date', dateStr)
        .order('time_from', { ascending: true });
      
      if (error) console.error('Error fetching schedules:', error);
      else if (data) setSchedules(data);
    } catch (err) {
      console.error('Fetch schedules failed:', err);
    }
  };

  const fetchHistory = async (vehicleId: string, dateStr: string) => {
    setLoading(true);
    
    try {
      // Safely offset to Philippines (UTC+8) operational timeframe to retrieve all logs of the selected date
      const localStart = new Date(`${dateStr}T00:00:00`);
      const start = new Date(localStart.getTime()).toISOString();
      
      const localEnd = new Date(`${dateStr}T23:59:59.999`);
      const end = new Date(localEnd.getTime()).toISOString();

      let allData: VehicleLog[] = [];
      let pageNum = 1;
      let hasMore = true;
      let totalCount = 0;

      // Loop to fetch everything, bypassing the 1000 limit, max 10000 points to prevent browser crash
      while (hasMore && allData.length < 10000) {
        const fromRange = (pageNum - 1) * 1000;
        const toRange = pageNum * 1000 - 1;

        const { data, error, count } = await supabase
          .from('vehicle_logs')
          .select('*', { count: 'exact' })
          .eq('vehicle_id', vehicleId)
          .gte('captured_at', start)
          .lte('captured_at', end)
          .order('captured_at', { ascending: true })
          .range(fromRange, toRange);

        if (error) {
          console.error('Error fetching history logs:', error.message);
          break;
        }

        if (count !== null && count !== undefined && pageNum === 1) {
          totalCount = count;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          pageNum++;
          // If we got less than 1000, we've reached the end
          if (data.length < 1000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      setTotalLogs(totalCount || allData.length);

      if (allData.length > 0) {
        const cleanLogs = allData.filter(log => {
          const lat = Number(log.latitude);
          const lng = Number(log.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });
        setLogs(cleanLogs);
        setCurrentIndex(0);
      } else {
        setLogs([]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Fetch history failed:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Group logs into segments for color-coded Polyline
  const segments = activeLogs.reduce((acc: any[], log, i) => {
    if (i === 0) return acc;
    const prevLog = activeLogs[i - 1];
    acc.push({
      positions: [[prevLog.latitude, prevLog.longitude], [log.latitude, log.longitude]],
      color: getSpeedColor(Number(log.speed))
    });
    return acc;
  }, []);

  const currentLog = activeLogs[currentIndex];

  if (!isMounted) {
    return <div className="animate-pulse bg-slate-100 dark:bg-slate-900 rounded-xl min-h-[600px] w-full" />;
  }

  return (
    <div className="flex flex-col gap-6">
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
              Tracking Map / Session Replay
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

      <div className="flex gap-6 h-[calc(100vh-250px)] min-h-[600px]">
        {/* Map Area */}
        <div className="flex-[3] bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 relative flex flex-col overflow-hidden transition-colors">
          <div className="flex-1 relative rounded-xl overflow-hidden min-h-[500px]">
            <MapContainer 
              center={[18.1960, 120.5927]} 
              zoom={11} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer 
                attribution='&copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
              />
              
              {segments.map((seg, i) => (
                <Polyline key={i} positions={seg.positions} color={seg.color} weight={5} opacity={0.8} />
              ))}

              {currentLog && typeof window !== 'undefined' && (
                <Marker 
                  position={[currentLog.latitude, currentLog.longitude]}
                  icon={L.divIcon({
                    className: 'custom-replay-icon',
                    html: `<div class="w-10 h-10 bg-blue-600 rounded-full border-4 border-white dark:border-slate-800 shadow-xl flex items-center justify-center text-white">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${currentIndex > 0 ? '45deg' : '0deg'})">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                      </svg>
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
              {currentLog && <ChangeView lat={currentLog.latitude} lng={currentLog.longitude} />}
            </MapContainer>
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4 transition-colors text-slate-900 dark:text-white">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={activeLogs.length === 0}
                className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>

              <button 
                onClick={() => setCurrentIndex(0)}
                disabled={activeLogs.length === 0}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <div className="flex-1 flex flex-col gap-2">
                <input 
                  type="range"
                  min="0"
                  max={activeLogs.length > 0 ? activeLogs.length - 1 : 0}
                  value={currentIndex}
                  onChange={(e) => setCurrentIndex(Number(e.target.value))}
                  className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <span>Start: {activeLogs.length > 0 ? format(new Date(activeLogs[0].captured_at), 'HH:mm') : '--:--'}</span>
                  <span>{currentLog ? format(new Date(currentLog.captured_at), 'HH:mm:ss') : 'Playback Progress'}</span>
                  <span>End: {activeLogs.length > 0 ? format(new Date(activeLogs[activeLogs.length-1].captured_at), 'HH:mm') : '--:--'}</span>
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
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Session Selection */}
            <div className="space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patrol Sessions</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Split Gap: {threshold} mins</p>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                  {[10, 20, 30, 60].map(val => (
                    <button
                      key={val}
                      onClick={() => setThreshold(val)}
                      className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                        threshold === val
                          ? 'bg-blue-600 text-white shadow-sm font-black'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {val}m
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {sessions.length > 0 ? (
                  sessions.map((session, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedSessionIndex(idx);
                        setCurrentIndex(0);
                        setIsPlaying(false);
                      }}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedSessionIndex === idx
                          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-2 ring-blue-600/10'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${selectedSessionIndex === idx ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                          Session {idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedSessionIndex === idx ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`}></div>
                          <span className="text-[10px] font-bold text-slate-400">{session.length} pts</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {format(new Date(session[0].captured_at), 'HH:mm')} - {format(new Date(session[session.length - 1].captured_at), 'HH:mm')}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-400">No logs for this date</p>
                  </div>
                )}
              </div>

            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl transition-colors">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Session Summary</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Session Points</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">{activeLogs.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Avg Speed</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white italic">
                    {activeLogs.length > 0 ? (activeLogs.reduce((a, b) => a + Number(b.speed), 0) / activeLogs.length).toFixed(1) : 0} <span className="text-[10px]">KM/H</span>
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

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                Patrol Schedule
              </h3>
              
              {schedules?.length > 0 ? (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div 
                      key={schedule.id}
                      className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          {(schedule.time_from || '').slice(0, 5)} - {(schedule.time_to || '').slice(0, 5)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800 transition-colors">
                          {schedule.sector}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {schedule.personnel?.rank} {schedule.personnel?.fullname}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors">
                  <p className="text-xs text-slate-400 dark:text-slate-500">No schedule found for this date.</p>
                </div>
              )}
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
