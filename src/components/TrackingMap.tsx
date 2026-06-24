import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MobilityAsset,
  VehicleLog,
  Personnel,
  PersonnelLog,
} from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import {
  Signal,
  Navigation,
  History,
  Maximize2,
  Minimize2,
  Notebook,
  ShieldCheck,
  User,
  LucideIcon,
  Car,
  Motorbike,
  PersonStanding,
  Bike,
  Siren,
  Phone,
  MessageCircle,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { renderToString } from "react-dom/server";

// Isolate Leaflet SSR crash by ensuring it only runs in the browser
if (typeof window !== "undefined") {
  // Fix for default marker icons in Leaflet + Vite
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

// Component to handle map resizing
function ResizeMap({ isFullscreen }: { isFullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Aggressive resize detection during transition
    const interval = setInterval(() => {
      map.invalidateSize();
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      map.invalidateSize();
    }, 600); // Wait for transition to finish (300ms + buffer)

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [map, isFullscreen]);
  return null;
}

// Map of duty types to their respective SVG icons (content of <svg> tag)
export const dutyTypeIconMap: Record<string, LucideIcon> = {
  "Mobile Patrol": Car,
  "TMRU Patrol": Motorbike, // Using 'Zap' as the tactical lightning bolt
  "Foot Patrol": PersonStanding, // Accurate translation for walking/tracking paths
  "Bike Patrol": Bike,
  EMERGENCY_SOS: Siren,
};

// Custom icon based on duty type and stale status
export const createMarkerIcon = (duty_type: string, isStale: boolean) => {
  console.log(duty_type);
  if (typeof window === "undefined") return new L.Icon.Default();

  // Colors based on status
  const color =
    duty_type === "EMERGENCY_SOS" ? "#ef4444" : isStale ? "#6b6b6b" : "#10b981"; // green (Available/Moving)

  // 1. Extract the React component from your map dictionary, fallback to Shield if missing
  const IconComponent = dutyTypeIconMap[duty_type];

  // 2. Safely transform the Lucide React element into an HTML string snippet
  // We apply the core vector styling properties natively directly on the component props
  const innerSvgString = renderToString(
    <IconComponent
      size={duty_type === "EMERGENCY_SOS" ? 40 : 25}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  );

  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative flex items-center justify-center" style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${
          duty_type === "EMERGENCY_SOS"
            ? `<div class="absolute w-10 h-10 rounded-full animate-ping opacity-20}" style="position: absolute; width: 60px; height: 60px; border-radius: 50%; background-color: ${color}; opacity: 0.6;"></div>`
            : ""
        }
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white" 
             style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #ffffff; background-color: ${color}; display: flex; align-items: center; justify-content: center; color: #ffffff; ${isStale ? "opacity: 0.8;" : ""}">
          
          ${innerSvgString}
          
        </div>
        <div class="absolute -bottom-1 w-2 h-2 rotate-45" style="position: absolute; bottom: -4px; width: 8px; height: 8px; transform: rotate(45deg); background-color: ${color};"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};
interface MapProps {
  vehicles: Record<string, MobilityAsset>;
  logs: Record<string, VehicleLog>;
  personnel: Record<string, Personnel>;
  personnelLogs: Record<string, PersonnelLog>;
}

export default function TrackingMap({
  vehicles,
  logs,
  personnel,
  personnelLogs,
}: MapProps) {
  const center: [number, number] = [18.196, 120.5927]; // Ilocos Norte Coordinates
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    console.log(
      "TrackingMap mounted with logs:",
      Object.keys(personnelLogs).length,
    );
  }, [logs]);

  if (!isMounted) {
    // Provide a fallback explicit height to prevent 0px collapsing
    return (
      <div className="w-full h-full min-h-[500px] bg-[var(--background)]/90 dark:bg-[var(--primary)]/[0.9] animate-pulse rounded-3xl" />
    );
  }

  return (
    <div
      className={`${
        isFullscreen
          ? "fixed inset-0 z-[9999] bg-[var(--background)]/[0.95] dark:bg-[var(--primary)]/[0.95] p-6"
          : "h-full w-full rounded-3xl overflow-hidden border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] z-0 relative bg-[var(--background)]/[0.9] dark:bg-[var(--primary)]/[0.85]"
      } transition-[width,height,transform] duration-300`}
    >
      <div className="h-full w-full relative rounded-3xl overflow-hidden min-h-[500px]">
        <MapContainer
          center={center}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <ResizeMap isFullscreen={isFullscreen} />
          <TileLayer
            attribution="&copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {/* Vehicle Markers */}
          {Object.entries(logs).map(([vehicleId, log]) => {
            console.log(
              "Rendering marker for vehicleId:",
              vehicleId,
              "log:",
              log,
            );
            const vehicle = vehicles[vehicleId];
            if (!vehicle) return null;

            const lat = Number(log.latitude);
            const lng = Number(log.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;

            const lastUpdated = new Date(log.captured_at);
            const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes

            return (
              <Marker
                key={vehicleId}
                position={[lat, lng]}
                icon={createMarkerIcon(log.duty_type, isStale)}
              >
                <Popup className="custom-popup">
                  <div className="p-4 min-w-[260px] min-h-[200px] bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--secondary)]/[0.2] pb-3">
                      <span className="font-black text-xl text-[var(--text)]">
                        {vehicle.plate_number}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          isStale
                            ? "bg-[var(--secondary)]/[0.15] text-[var(--text)]/[0.6]"
                            : "bg-[var(--accent)]/[0.15] text-[var(--accent)]"
                        }`}
                      >
                        {isStale ? "No Movement" : "Moving"}
                      </span>
                    </div>

                    <div className="space-y-3 text-[var(--text)]/[0.9] mb-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Notebook className="w-4 h-4" />
                          <span className="font-medium">Description</span>
                        </div>
                        <span className="font-black text-[var(--text)]">
                          {vehicle.description}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Navigation className="w-4 h-4" />
                          <span className="font-medium">Current Speed</span>
                        </div>
                        <span className="font-black text-[var(--text)]">
                          {log.speed} km/h
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="font-medium">Duty Type</span>
                        </div>
                        <span className="font-black text-[var(--text)]">
                          {log.duty_type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Signal className="w-4 h-4" />
                          <span className="font-medium">Last Update</span>
                        </div>
                        <span className="font-bold text-[var(--text)]">
                          {formatDistanceToNow(lastUpdated)} ago
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/trackingmap/${vehicleId}`}
                      className="text-white-800 dark:text-slate-200 flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl bg-[var(--accent)]/[0.2] dark:[var(--accent)]/[0.8] hover:bg-[var(--accent)]/[0.3] transition-colors duration-200"
                    >
                      <History className="w-4 h-4" />
                      View History Replay
                    </Link>

                    {isStale && (
                      <div className="text-red-800 dark:text-slate-200  mt-4 p-3 leading-tight rounded-xl border border-red-50/[0.3]">
                        No Movement: Showing last known position from{" "}
                        {formatDistanceToNow(lastUpdated)} ago
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Personnel Markers */}
          {Object.entries(personnelLogs).map(([personnelId, log]) => {
            const person = personnel[personnelId];
            if (!person) return null;

            const lat = Number(log.latitude);
            const lng = Number(log.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;

            const lastUpdated = new Date(log.captured_at);
            const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes

            return (
              <Marker
                key={personnelId}
                position={[lat, lng]}
                icon={createMarkerIcon(log.duty_type, isStale)}
              >
                <Popup className="custom-popup">
                  <div className="p-4 min-w-[260px] min-h-[200px] bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-4 border-b border-[var(--secondary)]/[0.2] pb-3">
                      <span className="font-black text-xl text-[var(--text)]">
                        {person.rank?.rank_name} {person.fullname}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          isStale
                            ? "bg-[var(--secondary)]/[0.15] text-[var(--text)]/[0.6]"
                            : "bg-[var(--accent)]/[0.15] text-[var(--accent)]"
                        }`}
                      >
                        {isStale ? "No Movement" : "Moving"}
                      </span>
                    </div>

                    <div className="space-y-3 text-[var(--text)]/[0.9] mb-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Notebook className="w-4 h-4" />
                          <span className="font-medium">Designation</span>
                        </div>
                        <span className="font-black text-[var(--text)]">
                          {person.designation ?? "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="font-medium">Duty Status</span>
                        </div>
                        <span className="font-black text-[var(--text)]">
                          {person.duty_status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Info className="w-4 h-4" />
                          <span className="font-medium">Contact Info</span>
                        </div>
                        <span className="font-black text-[var(--text)]">
                          {person.phone_number && (
                            <>
                              <a
                                href={`tel:${person.phone_number}`}
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                              >
                                <Phone className="w-5 h-5" />
                                <span>{person.phone_number}</span>
                              </a>
                            </>
                          )}
                          {person.viber_number && (
                            <>
                              <a
                                href={`viber://chat?number=${person.viber_number}`}
                                className="flex items-center gap-2 text-purple-600 hover:text-purple-800"
                              >
                                <MessageCircle className="w-5 h-5" />
                                <span>{person.viber_number}</span>
                              </a>
                            </>
                          )}
                          {!person.viber_number &&
                            !person.phone_number &&
                            "No contact info."}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Signal className="w-4 h-4" />
                          <span className="font-medium">Last Update</span>
                        </div>
                        <span className="font-bold text-[var(--text)]">
                          {formatDistanceToNow(lastUpdated)} ago
                        </span>
                      </div>
                      <Link
                        to={`/personnel-tracking/${personnelId}`}
                        className="text-white-800 dark:text-slate-200 flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl bg-[var(--accent)]/[0.2] dark:[var(--accent)]/[0.8] hover:bg-[var(--accent)]/[0.3] transition-colors duration-200"
                      >
                        <User className="w-5 h-5" />
                        <span>View Personnel Track</span>
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="bg-white dark:bg-slate-900 absolute top-6 right-6 z-[1000] p-4 rounded-3xl shadow-[var(--accent)]/[0.2] dark:shadow-[var(--accent)]/[0.1] border border-[var(--secondary)]/[0.3] dark:border-[var(--secondary)]/[0.2] text-[var(--text)]/[0.8] hover:text-[var(--accent)] transition-all duration-200 hover:scale-105 active:scale-95"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-6 h-6" />
          ) : (
            <Maximize2 className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
}
