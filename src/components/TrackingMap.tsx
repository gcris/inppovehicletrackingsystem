import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MobilityAsset, PatrolLog, Personnel } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import {
  Signal,
  Navigation,
  Maximize2,
  Minimize2,
  Notebook,
  ShieldCheck,
  Network,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { snapToRoad } from "../lib/snapToRoad";
import { createMarkerIcon } from "../helper/MarkerIcon";

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
    const interval = setInterval(() => {
      map.invalidateSize();
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      map.invalidateSize();
    }, 600);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [map, isFullscreen]);
  return null;
}

// Automatically centers and flies to active SOS signals
function AutoFlyToEmergency({
  patrolLogs: patrolLogs,
}: {
  patrolLogs: Record<string, PatrolLog>;
}) {
  const map = useMap();

  useEffect(() => {
    const emergencyLog = Object.values(patrolLogs).find(
      (log) => log.duty_type === "EMERGENCY_SOS",
    );

    if (emergencyLog) {
      const logDate = new Date(emergencyLog.captured_at);
      const now = new Date();

      const ONE_HOUR_IN_MS = 60 * 60 * 1000;
      const animate_ping = now.getTime() - logDate.getTime() <= ONE_HOUR_IN_MS;
      if (!animate_ping) return;

      const lat = Number(emergencyLog.latitude);
      const lng = Number(emergencyLog.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        map.flyTo([lat, lng], 16, {
          animate: true,
          duration: 1.5,
        });
      }
    }
  }, [patrolLogs, map]);

  return null;
}

interface MapProps {
  vehicles: Record<string, MobilityAsset>;
  logs: Record<string, PatrolLog>;
}

function getOffsetPosition(
  lat: number,
  lng: number,
  index: number,
  total: number,
): [number, number] {
  if (total <= 1) return [lat, lng];

  const radius = 0.00003; // ~3 meters
  const angle = (2 * Math.PI * index) / total;

  return [lat + radius * Math.cos(angle), lng + radius * Math.sin(angle)];
}

export default function TrackingMap({
  vehicles,
  logs,
  personnel,
}: MapProps & { personnel: Record<string, Personnel> }) {
  const center: [number, number] = [18.196, 120.5927]; // Ilocos Norte Coordinates
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [description, setDescription] = useState<string>();
  const [snappedPositions, setSnappedPositions] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  useEffect(() => {
    setIsMounted(true);

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000); // or 30000

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function updatePositions() {
      const positions: Record<string, { lat: number; lng: number }> = {};

      await Promise.all(
        Object.entries(logs).map(async ([index, log]) => {
          const lat = Number(log.latitude);
          const lng = Number(log.longitude);

          if (isNaN(lat) || isNaN(lng)) return;

          positions[index] = { lat, lng };
        }),
      );

      if (!cancelled) {
        setSnappedPositions(positions);
      }
    }

    updatePositions();

    return () => {
      cancelled = true;
    };
  }, [logs]);

  if (!isMounted) {
    return (
      <div className="w-full h-full min-h-[500px] bg-[var(--background)]/90 dark:bg-[var(--primary)]/[0.9] animate-pulse rounded-3xl" />
    );
  }

  const groupedMarkers = new Map<
    string,
    {
      vehicleId: string;
      log: PatrolLog;
    }[]
  >();

  Object.entries(logs).forEach(([vehicleId, log]) => {
    const lat = Number(log.latitude).toFixed(5);
    const lng = Number(log.longitude).toFixed(5);

    const key = `${lat},${lng}`;

    if (!groupedMarkers.has(key)) {
      groupedMarkers.set(key, []);
    }

    groupedMarkers.get(key)!.push({
      vehicleId,
      log,
    });
  });

  return (
    <div
      className={`${
        isFullscreen
          ? "fixed inset-0 z-[9999] bg-[var(--background)]/[0.95] dark:bg-[var(--primary)]/[0.95] p-1"
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
          <AutoFlyToEmergency patrolLogs={logs} />

          {/* Vehicle Markers */}
          {Array.from(groupedMarkers.entries()).map(([, group]) => {
            return group.map(({ vehicleId, log }, index) => {
              const vehicle = vehicles[vehicleId];
              const personnelInfo = personnel[log?.personnel_id || ""];
              if (!vehicle && !personnelInfo) return null;

              const lat = Number(log.latitude);
              const lng = Number(log.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;

              const lastUpdated = new Date(log.captured_at);
              const age = now - lastUpdated.getTime();
              const isStale = age > 5 * 60 * 1000;

              // Calculate offset position to prevent marker overlap
              const [displayLat, displayLng] = getOffsetPosition(
                lat,
                lng,
                index,
                group.length,
              );

              return (
                <Marker
                  key={`${vehicleId}-${index}`} // Unique key for each marker in group
                  position={[
                    snappedPositions[vehicleId]?.lat ?? displayLat,
                    snappedPositions[vehicleId]?.lng ?? displayLng,
                  ]}
                  icon={createMarkerIcon(
                    log.duty_type,
                    log.captured_at,
                    log.status,
                    isStale,
                  )}
                >
                  <Popup className="custom-popup">
                    <div className="p-4 min-w-[260px] min-h-[200px] bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between mb-4 border-b border-[var(--secondary)]/[0.2] pb-3">
                        <span className="font-black text-xl text-[var(--text)]">
                          {vehicle?.plate_number ||
                            personnelInfo?.rank?.rank_name +
                              " " +
                              personnelInfo?.fullname ||
                            "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-4 border-b border-[var(--secondary)]/[0.2] pb-3">
                        <span className="font-black text-md text-[var(--text)]">
                          {vehicle
                            ? vehicle.unit?.unit_name || "Unknown Unit"
                            : personnelInfo?.unit?.unit_name || "Unknown Unit"}
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
                        {vehicle && vehicle.description && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Notebook className="w-4 h-4" />
                              <span className="font-medium">Description</span>
                            </div>
                            <span className="font-black text-[var(--text)]">
                              {vehicle.description}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Navigation className="w-4 h-4" />
                            <span className="font-medium">Current Speed</span>
                          </div>
                          <span className="font-black text-[var(--text)]">
                            {log.speed.toFixed(2)} km/h
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Network className="w-4 h-4" />
                            <span className="font-medium">Network Signal</span>
                          </div>
                          <span className="font-black text-[var(--text)]">
                            {log.network_signal > 5
                              ? log.network_signal
                              : log.network_signal + "/4"}
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
                        className="text-[16px] text-white-800 dark:text-slate-200 flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl transition-colors duration-200"
                      >
                        View History Replay
                      </Link>

                      {isStale && (
                        <div className="text-red-800 dark:text-slate-200 mt-4 p-3 leading-tight rounded-xl border border-red-50/[0.3]">
                          No Movement: Showing last known position from{" "}
                          {formatDistanceToNow(lastUpdated)} ago
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            });
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
