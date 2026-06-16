import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MobilityAsset, VehicleLog } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import {
  Signal,
  Radio,
  Navigation,
  History,
  Maximize2,
  Minimize2,
  Notebook,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

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

// Custom icons based on load status
const createIcon = (isStale: boolean) => {
  if (typeof window === "undefined") return new L.Icon.Default();

  // More distinct colors for better visibility
  const color = isStale
    ? "#ef4444" // red (No Movement/Stale)
    : "#10b981"; // green (Available/Moving)

  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative flex items-center justify-center">
        ${
          !isStale
            ? `
          <div class="absolute w-10 h-10 rounded-full animate-ping opacity-20" style="background-color: ${color}"></div>
        `
            : ""
        }
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white" style="background-color: ${color}; ${isStale ? "opacity: 0.8" : ""}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${
              isStale
                ? // No movement icon - circle with diagonal line
                  `<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15" strokeWidth="2.5"/>`
                : // Normal vehicle icon
                  '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'
            }
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
  vehicles: Record<string, MobilityAsset>;
  logs: Record<string, VehicleLog>;
}

export default function TrackingMap({ vehicles, logs }: MapProps) {
  const center: [number, number] = [18.196, 120.5927]; // Ilocos Norte Coordinates
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // console.log("TrackingMap mounted with logs:", Object.keys(logs).length);
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
                icon={createIcon(isStale)}
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
