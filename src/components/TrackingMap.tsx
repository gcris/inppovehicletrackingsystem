import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle, VehicleLog } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Signal, Radio, Navigation } from 'lucide-react';
import { renderToString } from 'react-dom/server';

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
  const center: [number, number] = [14.5995, 120.9842]; // Manila Coordinates

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm z-0">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-slate-800">{vehicle.plate_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isStale ? 'bg-slate-100 text-slate-500' : 
                      vehicle.load_status === 'Emergency' ? 'bg-red-100 text-red-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {isStale ? 'Offline' : vehicle.load_status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4" />
                      <span>Speed: <b>{log.speed} km/h</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4" />
                      <span>Signal: <b>{log.network_signal}%</b></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Signal className="w-4 h-4" />
                      <span>Last seen: {formatDistanceToNow(lastUpdated)} ago</span>
                    </div>
                  </div>

                  {isStale && (
                    <div className="mt-3 p-2 bg-amber-50 text-amber-700 text-xs rounded border border-amber-100">
                      Warning: Signal lost more than 5 minutes ago. Showing last known position.
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
