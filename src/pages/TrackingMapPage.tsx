import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  supabase,
  MobilityAsset,
  VehicleLog,
  PatrolSchedule,
  Personnel,
} from "../lib/supabase";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  Navigation,
  Activity,
  History as HistoryIcon,
  Phone,
  MessageCircle,
} from "lucide-react";

if (typeof window !== "undefined") {
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

const getSpeedColor = (speed: number) => {
  if (speed > 80) return "#ef4444"; // Red
  if (speed > 50) return "#f59e0b"; // Amber
  if (speed > 20) return "#22c55e"; // Green
  return "#3b82f6"; // Blue
};

function ChangeView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (
      typeof lat === "number" &&
      typeof lng === "number" &&
      !isNaN(lat) &&
      !isNaN(lng)
    ) {
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
  const [vehicle, setVehicle] = useState<MobilityAsset | null>(null);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [sessions, setSessions] = useState<VehicleLog[][]>([]);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(-1);
  const [schedules, setSchedules] = useState<PatrolSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [threshold, setThreshold] = useState<number>(10); // Fixed to 10 mins as requested
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
      setSelectedSessionIndex((prev) => {
        if (prev >= 0 && prev < grouped.length) return prev;
        return 0;
      });
    } else {
      setSessions([]);
      setSelectedSessionIndex(-1);
    }
  }, [logs, threshold]);

  // Use logs from the selected session for playback
  const activeLogs =
    selectedSessionIndex >= 0 ? sessions[selectedSessionIndex] : [];

  useEffect(() => {
    if (id) {
      fetchVehicle(id);
      fetchHistory(id, selectedDate);
    }
  }, [id, selectedDate]);

  useEffect(() => {
    if (vehicle && vehicle.unit_id && selectedDate) {
      fetchSchedules(vehicle.unit_id, vehicle.id, selectedDate);
    }
  }, [vehicle, vehicle?.unit_id, selectedDate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentIndex < activeLogs.length - 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 500);
    } else {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, activeLogs.length]);

  const fetchVehicle = async (mobilityId: string) => {
    try {
      const { data, error } = await supabase
        .from("mobility_assets")
        .select("*")
        .eq("id", mobilityId)
        .single();
      if (error) console.error("Error fetching mobility asset:", error);
      else if (data) setVehicle(data);
    } catch (err) {
      console.error("Fetch mobility asset failed:", err);
    }
  };

  const fetchSchedules = async (
    unitId: string,
    mobility_id: string,
    dateStr: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("patrol_schedule")
        .select(
          "*, mobility_assets(*), unit(*), schedule_assignments(personnel(*, rank:rank_id(*)))",
        )
        .eq("unit_id", unitId)
        .eq("mobility_id", mobility_id)
        .eq("date", dateStr)
        .order("time_from", { ascending: true });

      if (error) console.error("Error fetching schedules:", error);
      else if (data) setSchedules(data);
    } catch (err) {
      console.error("Fetch schedules failed:", err);
    }
  };

  const fetchHistory = async (mobilityId: string, dateStr: string) => {
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
          .from("vehicle_logs")
          .select("*", { count: "exact" })
          .eq("vehicle_id", mobilityId)
          .gte("captured_at", start)
          .lte("captured_at", end)
          .order("captured_at", { ascending: true })
          .range(fromRange, toRange);

        if (error) {
          console.error("Error fetching history logs:", error.message);
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
        const cleanLogs = allData.filter((log) => {
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
      console.error("Fetch history failed:", err);
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
      positions: [
        [prevLog.latitude, prevLog.longitude],
        [log.latitude, log.longitude],
      ],
      color: getSpeedColor(Number(log.speed)),
    });
    return acc;
  }, []);

  // Calculate total hour patrolled from active logs
  // Calculate overall hour patrolled (sum of hour patrolled for each session)
  const overallHourPatrolled = sessions.reduce((sum, session) => {
    if (session.length <= 1) return sum;
    const sessionHourPatrolled =
      (new Date(session[session.length - 1].captured_at).getTime() -
        new Date(session[0].captured_at).getTime()) /
      (1000 * 60 * 60);
    return sum + sessionHourPatrolled;
  }, 0);

  // Helper function to format hours to "X hour(s) and Y minute(s)" format
  const formatHoursToHoursAndMinutes = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minutesPart = totalMinutes % 60;

    if (hoursPart === 0) {
      return `${minutesPart} minute${minutesPart !== 1 ? "s" : ""}`;
    }
    if (minutesPart === 0) {
      return `${hoursPart} hour${hoursPart !== 1 ? "s" : ""}`;
    }
    return `${hoursPart} hour${hoursPart !== 1 ? "s" : ""} and ${minutesPart} minute${minutesPart !== 1 ? "s" : ""}`;
  };

  // Calculate number of personnel assigned
  const personnelAssignedCount = schedules.reduce((total, schedule) => {
    return total + (schedule.schedule_assignments?.length || 0);
  }, 0);

  // Calculate overall man-hour
  const overallManHour = overallHourPatrolled * personnelAssignedCount;

  const currentLog = activeLogs[currentIndex];

  if (!isMounted) {
    return (
      <div className="animate-pulse bg-slate-100 dark:bg-slate-900 rounded-xl min-h-[600px] w-full" />
    );
  }

  const calculateDistance = (logs: VehicleLog[] | null) => {
    if (!logs || logs.length < 2) return 0;

    const EARTH_RADIUS_KM = 6371;
    const deg2rad = (deg: any) => deg * (Math.PI / 180);
    let totalDistance = 0;

    for (let i = 0; i < logs.length - 1; i++) {
      const current = logs[i];
      const next = logs[i + 1];

      // Ensure coordinates are not null/corrupted
      if (
        !current.latitude ||
        !current.longitude ||
        !next.latitude ||
        !next.longitude
      )
        continue;

      const dLat = deg2rad(next.latitude - current.latitude);
      const dLng = deg2rad(next.longitude - current.longitude);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(current.latitude)) *
          Math.cos(deg2rad(next.latitude)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = EARTH_RADIUS_KM * c;

      // Jitter Filter: Ignore tiny GPS variations below 5 meters to prevent "ghost mileage"
      if (distance > 0.005) {
        totalDistance += distance;
      }
    }

    return parseFloat(totalDistance.toFixed(2)); // Returns total KM rounded to two decimal places
  };

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
              Tracking Map
            </h1>
            <p className="font-medium">
              <span className="font-bold">Mobility Asset:</span>{" "}
              {vehicle?.plate_number || "Loading..."}
            </p>
            {vehicle && (
              <div className="mt-1">
                <span className="font-bold">Description:</span>{" "}
                {vehicle.description || "N/A"} &nbsp;|&nbsp;
                <span className="font-bold">Status:</span>{" "}
                {vehicle.status || "Serviceable"}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-10 pr-4 font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-250px)] min-h-[600px]">
        {/* Map Area */}
        <div className="flex-[2] bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 relative flex flex-col overflow-hidden transition-colors">
          <div className="flex-1 relative rounded-xl overflow-hidden">
            <MapContainer
              center={[18.196, 120.5927]}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {segments.map((seg, i) => (
                <Polyline
                  key={i}
                  positions={seg.positions}
                  color={seg.color}
                  weight={5}
                  opacity={0.8}
                />
              ))}

              {currentLog && typeof window !== "undefined" && (
                <Marker
                  position={[currentLog.latitude, currentLog.longitude]}
                  icon={L.divIcon({
                    className: "custom-replay-icon",
                    html: `<div class="w-10 h-10 bg-blue-600 rounded-full border-4 border-white dark:border-slate-800 shadow-xl flex items-center justify-center text-white">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${currentIndex > 0 ? "45deg" : "0deg"})">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                      </svg>
                    </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                  })}
                >
                  <Popup>
                    <div>
                      <p>
                        <b>Time:</b>{" "}
                        {format(new Date(currentLog.captured_at), "HH:mm:ss")}
                      </p>
                      <p>
                        <b>Speed:</b> {currentLog.speed} km/h
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {currentLog && (
                <ChangeView
                  lat={currentLog.latitude}
                  lng={currentLog.longitude}
                />
              )}
            </MapContainer>
          </div>
        </div>

        {/* Trail Sidebar */}
        <div className="flex-[1.5] bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              Patrol Sessions
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Session Selection */}
            <div className="space-y-3">
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
                      className={`text-left p-3 rounded-xl border transition-all w-full ${
                        selectedSessionIndex === idx
                          ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-2 ring-blue-600/10"
                          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                      }`}
                    >
                      {/* Changed to items-start so the top lines align properly */}
                      <div className="flex items-start justify-between">
                        {/* LEFT COLUMN: Session Name & Time Grouped Together */}
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={`font-black uppercase tracking-wider ${
                              selectedSessionIndex === idx
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-400"
                            }`}
                          >
                            Session {idx + 1}
                          </span>
                          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {format(
                              new Date(session[0].captured_at),
                              "HH:mm",
                            )}{" "}
                            -{" "}
                            {format(
                              new Date(session[session.length - 1].captured_at),
                              "HH:mm",
                            )}
                          </div>
                        </div>

                        {/* RIGHT COLUMN: Dot & Stats */}
                        <div className="flex items-start gap-1.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                              selectedSessionIndex === idx
                                ? "bg-blue-600 animate-pulse"
                                : "bg-slate-300"
                            }`}
                          ></div>

                          {(() => {
                            const sessionStart = new Date(
                              session[0].captured_at,
                            );
                            const sessionEnd = new Date(
                              session[session.length - 1].captured_at,
                            );
                            let sessionHourPatrolled = 0;
                            let sessionManHour = 0;
                            let personnelAssignedForSession = 0;
                            let scheduleEnd = new Date();

                            if (session.length > 1) {
                              // Calculate personnel assigned based on schedule overlap
                              personnelAssignedForSession = schedules.reduce(
                                (total, schedule) => {
                                  const scheduleStart = new Date(
                                    `${selectedDate}T${schedule.time_from}`,
                                  );
                                  scheduleEnd = new Date(
                                    `${selectedDate}T${schedule.time_to}`,
                                  );
                                  if (
                                    sessionStart <= scheduleEnd &&
                                    sessionEnd >= scheduleStart
                                  ) {
                                    return (
                                      total +
                                      (schedule.schedule_assignments?.length ||
                                        0)
                                    );
                                  }
                                  return total;
                                },
                                0,
                              );

                              sessionHourPatrolled =
                                (scheduleEnd.getTime() -
                                  sessionStart.getTime()) /
                                (1000 * 60 * 60);

                              sessionManHour =
                                sessionHourPatrolled *
                                personnelAssignedForSession;
                            }
                            return (
                              <div className="text-right space-y-1">
                                <div className="font-bold">
                                  Hour patrolled:{" "}
                                  {formatHoursToHoursAndMinutes(
                                    sessionHourPatrolled,
                                  )}
                                </div>
                                <div className="">
                                  Personnel Assigned:{" "}
                                  {personnelAssignedForSession}
                                </div>
                                <div className="">
                                  Man-hour:{" "}
                                  {formatHoursToHoursAndMinutes(sessionManHour)}
                                </div>
                                <div className="">
                                  {calculateDistance(session)} km
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-slate-400">No logs for this date</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl transition-colors">
              <p className=" font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Session Summary
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-1">Total Hour Patrolled</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">
                    {formatHoursToHoursAndMinutes(overallHourPatrolled)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-800 dark:text-slate-500 mb-1">
                    Total Man-Hour
                  </p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">
                    {formatHoursToHoursAndMinutes(overallManHour)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-800 dark:text-slate-500 mb-1">
                    Total Kilometers
                  </p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">
                    {calculateDistance(logs)}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                Patrol Schedule
              </h3>

              {/* PERSONNEL AND PATROL SCHEDULE SECTION - MOVED FROM LIVE MAP PAGE */}
              <div className="mt-4">
                {/* Patrol Schedules Section */}
                {schedules?.length > 0 ? (
                  <div className="mt-4">
                    <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                      Today's Patrol Schedules
                    </p>
                    <div className="space-y-3">
                      {schedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 transition-colors"
                        >
                          {/* Patrol Schedule Details */}
                          <div className="grid grid-cols-3 gap-4 font-bold">
                            <div>
                              Time: {(schedule.time_from || "").slice(0, 5)} -{" "}
                              {(schedule.time_to || "").slice(0, 5)}
                            </div>
                            <div>Sector: {schedule.sector}</div>
                          </div>
                          <hr />
                          {/* Personnel Assigned Section */}
                          {schedule.schedule_assignments &&
                            schedule.schedule_assignments.length > 0 && (
                              <div className="space-y-1">
                                {schedule.schedule_assignments.map(
                                  (assign, index) => (
                                    <div
                                      key={index}
                                      className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800"
                                    >
                                      <div className="flex items-start space-x-1">
                                        <div className="flex-shrink-0 w-8 text-center text-slate-600 dark:text-slate-400">
                                          {index + 1}.
                                        </div>
                                        <div className="flex items-start space-x-1">
                                          {/* Row container for name and details to sit side-by-side */}
                                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                                            <div className="text-slate-700 dark:text-slate-200 font-medium">
                                              {assign.personnel?.rank
                                                ?.rank_name || ""}{" "}
                                              {assign.personnel?.fullname || ""}
                                            </div>

                                            {assign.personnel?.phone_number && (
                                              <div className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                                                <a
                                                  href={`tel:${assign.personnel?.phone_number}`}
                                                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                                                >
                                                  <Phone className="w-5 h-5" />
                                                  <span>
                                                    {
                                                      assign.personnel
                                                        ?.phone_number
                                                    }
                                                  </span>
                                                </a>
                                              </div>
                                            )}

                                            {assign.personnel?.viber_number && (
                                              <div className="flex items-center gap-1 text-purple-600 hover:text-purple-800">
                                                <a
                                                  href={`tel:${assign.personnel?.viber_number}`}
                                                  className="flex items-center gap-2 text-purple-600 hover:text-purple-800"
                                                >
                                                  <MessageCircle className="w-5 h-5" />
                                                  <span>
                                                    {
                                                      assign.personnel
                                                        ?.viber_number
                                                    }
                                                  </span>
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors">
                    <p className="text-slate-400 dark:text-slate-500">
                      No schedule found for this date.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-1 rounded-full"
        style={{ backgroundColor: color }}
      ></div>
      <span className="font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}
