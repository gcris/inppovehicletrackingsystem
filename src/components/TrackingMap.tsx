import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Vehicle, VehicleLog } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Signal, Radio, Navigation, History, Maximize2, Minimize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

// Fix for default marker icons in Leaflet + Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map resizing
function ResizeMap({ isFullscreen }: { isFullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, isFullscreen ? 500 : 100);
    return () => clearTimeout(timer);
  }, [map, isFullscreen]);
  return null;
}

// Custom icons based on load status
const createIcon = (status: string, isStale: boolean) => {
  const color = isStale ? '#9ca3af' : // gray
                status === 'Emergency' ? '#ef4444' : // red
                status === 'On Patrol' ? '#22c55e' : // green
                status === 'Maintenance' ? '#f59e0b' : // amber
                '#3b82f6'; // blue (Available)

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-10 h-10 rounded-full animate-ping opacity-20" style="background-color: ${color}"></div>
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white" style="background-color: ${color}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 w-2 h-2 rotate-45" style="background-color: ${color}"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

interface MapProps {
  vehicles: Record<string, Vehicle>;
  logs: Record<string, VehicleLog>;
}

export default function TrackingMap({ vehicles, logs }: MapProps) {
  const center: [number, number] = [18.1960, 120.5927]; // Ilocos Norte Coordinates
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    console.log('TrackingMap mounted with logs:', Object.keys(logs).length);
  }, [logs]);

  return (
    <div className={`${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] bg-white dark:bg-slate-900 p-4' 
        : 'h-full w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm z-0 relative bg-slate-100'
    } transition-[width,height,transform] duration-300`}>
      <div className="h-full w-full relative rounded-xl overflow-hidden">
        <MapContainer 
          center={center} 
          zoom={11} 
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <ResizeMap isFullscreen={isFullscreen} />
          <TileLayer
            attribution='&copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {Object.entries(logs).map(([vehicleId, log]) => {
            const vehicle = vehicles[vehicleId];
            if (!vehicle) return null;

            const lastUpdated = new Date(log.captured_at);
            const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes

            return (
              <Marker
                key={vehicleId}
                position={[log.latitude, log.longitude]}
                icon={createIcon(vehicle.load_status, isStale)}
              >
                <Popup className="custom-popup">
                  <div className="p-3 min-w-[220px]">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                      <span className="font-black text-lg text-slate-900">{vehicle.plate_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isStale ? 'bg-slate-100 text-slate-500' : 
                        vehicle.load_status === 'Expired' ? 'bg-amber-100 text-amber-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {isStale ? 'Offline' : vehicle.load_status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-xs text-slate-500 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Navigation className="w-3 h-3" />
                          <span>Current Speed</span>
                        </div>
                        <span className="font-black text-slate-900">{log.speed} km/h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio className="w-3 h-3" />
                          <span>Signal Quality</span>
                        </div>
                        <span className="font-black text-slate-900">{log.network_signal}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Signal className="w-3 h-3" />
                          <span>Last Update</span>
                        </div>
                        <span className="font-bold">{formatDistanceToNow(lastUpdated)} ago</span>
                      </div>
                    </div>

                    <Link 
                      to={`/map/${vehicleId}/history`}
                      className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors"
                    >
                      <History className="w-3 h-3" />
                      View History Replay
                    </Link>

                    {isStale && (
                      <div className="mt-3 p-2 bg-amber-50 text-amber-700 text-[10px] leading-tight rounded border border-amber-100 font-medium">
                        Note: Vehicle signal lost. Showing last known position.
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-4 right-4 z-[1000] p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-all hover:scale-110 active:scale-95"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
