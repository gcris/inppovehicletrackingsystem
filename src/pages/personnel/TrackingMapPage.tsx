import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  GoogleMap,
  useJsApiLoader,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../../lib/googleMapsConfig";
import {
  supabase,
  MobilityAsset,
  PatrolLog,
  PatrolSchedule,
  Personnel,
} from "../../lib/supabase";
import { format } from "date-fns";
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  Activity,
  History as HistoryIcon,
  RefreshCcw,
  Users,
  MapPin,
} from "lucide-react";
import { cleanPatrolRoute } from "../../lib/cleanPatrolRoute";

/*
|--------------------------------------------------------------------------
| GPS VALIDATION
|--------------------------------------------------------------------------
*/

const isValidCoordinate = (lat: unknown, lng: unknown) => {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude !== 0 &&
    longitude !== 0
  );
};

/*
|--------------------------------------------------------------------------
| SPEED COLOR
|--------------------------------------------------------------------------
*/

const getSpeedColor = (speed: number) => {
  if (speed > 80) return "#ef4444";
  if (speed > 50) return "#f59e0b";
  if (speed > 20) return "#22c55e";
  return "#3b82f6";
};

/*
|--------------------------------------------------------------------------
| DISTANCE CALCULATION
|--------------------------------------------------------------------------
*/

const calculateDistance = (logs: PatrolLog[] | null) => {
  if (!logs || logs.length < 2) return 0;

  const EARTH_RADIUS_KM = 6371;

  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  let totalDistance = 0;

  for (let i = 0; i < logs.length - 1; i++) {
    const current = logs[i];
    const next = logs[i + 1];

    if (
      !isValidCoordinate(current.latitude, current.longitude) ||
      !isValidCoordinate(next.latitude, next.longitude)
    ) {
      continue;
    }

    const currentLat = Number(current.latitude);
    const currentLng = Number(current.longitude);
    const nextLat = Number(next.latitude);
    const nextLng = Number(next.longitude);

    const dLat = deg2rad(nextLat - currentLat);
    const dLng = deg2rad(nextLng - currentLng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(currentLat)) *
        Math.cos(deg2rad(nextLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = EARTH_RADIUS_KM * c;

    /*
    |--------------------------------------------------------------------------
    | JITTER FILTER
    |--------------------------------------------------------------------------
    |
    | Ignore GPS movements smaller than 5 meters.
    |
    */

    if (distance > 0.005) {
      totalDistance += distance;
    }
  }

  return parseFloat(totalDistance.toFixed(2));
};

/*
|--------------------------------------------------------------------------
| HOURS FORMATTER
|--------------------------------------------------------------------------
*/

const formatHoursToHoursAndMinutes = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);

  const hoursPart = Math.floor(totalMinutes / 60);
  const minutesPart = totalMinutes % 60;

  if (hoursPart === 0) {
    return `${minutesPart} min${minutesPart !== 1 ? "s" : ""}`;
  }

  if (minutesPart === 0) {
    return `${hoursPart} hr${hoursPart !== 1 ? "s" : ""}`;
  }

  return `${hoursPart} hr ${minutesPart} min`;
};

/*
|--------------------------------------------------------------------------
| GROUP LOGS INTO PATROL SESSIONS
|--------------------------------------------------------------------------
*/

const groupLogsBySession = (allLogs: PatrolLog[], thresholdMinutes = 10) => {
  if (allLogs.length === 0) return [];

  const sessions: PatrolLog[][] = [];

  let currentSession: PatrolLog[] = [allLogs[0]];

  for (let i = 1; i < allLogs.length; i++) {
    const prevLog = allLogs[i - 1];
    const currLog = allLogs[i];

    const diffMinutes =
      (new Date(currLog.captured_at).getTime() -
        new Date(prevLog.captured_at).getTime()) /
      60000;

    if (
      diffMinutes > thresholdMinutes ||
      prevLog.duty_type !== currLog.duty_type
    ) {
      sessions.push(currentSession);

      currentSession = [currLog];
    } else {
      currentSession.push(currLog);
    }
  }

  sessions.push(currentSession);

  return sessions;
};

/*
|--------------------------------------------------------------------------
| ADVANCED TRACKING MARKER
|--------------------------------------------------------------------------
|
| Uses Google Maps AdvancedMarkerElement instead of the deprecated
| google.maps.Marker.
|
*/

type AdvancedTrackingMarkerProps = {
  map: google.maps.Map | null;
  position: google.maps.LatLngLiteral;
  onClick: () => void;
};

function AdvancedTrackingMarker({
  map,
  position,
  onClick,
}: AdvancedTrackingMarkerProps) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null,
  );

  const contentRef = useRef<HTMLDivElement | null>(null);

  /*
  |--------------------------------------------------------------------------
  | CREATE MARKER
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!map || !window.google?.maps) {
      return;
    }

    let cancelled = false;

    const createMarker = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary(
          "marker",
        )) as google.maps.MarkerLibrary;

        if (cancelled) {
          return;
        }

        /*
        |--------------------------------------------------------------------------
        | CREATE CUSTOM HTML CONTENT
        |--------------------------------------------------------------------------
        */

        const content = document.createElement("div");

        content.style.width = "42px";
        content.style.height = "42px";

        content.style.display = "flex";
        content.style.alignItems = "center";
        content.style.justifyContent = "center";

        content.style.cursor = "pointer";

        content.style.background = "#ffffff";

        content.style.border = "3px solid #2563eb";

        content.style.borderRadius = "50%";

        content.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.30)";

        content.style.transition =
          "transform 120ms ease, box-shadow 120ms ease";

        content.style.userSelect = "none";

        /*
        |--------------------------------------------------------------------------
        | LOCATION ICON
        |--------------------------------------------------------------------------
        */

        content.innerHTML = `
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563eb"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 4.993-8 12-8 12S4 14.993 4 10a8 8 0 1 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        `;

        /*
        |--------------------------------------------------------------------------
        | HOVER
        |--------------------------------------------------------------------------
        |
        | Do NOT use transform to position the marker.
        |
        | AdvancedMarkerElement handles the geographic positioning itself.
        | We only use transform for the visual hover scale.
        |
        */

        content.addEventListener("mouseenter", () => {
          content.style.transform = "scale(1.10)";

          content.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.35)";
        });

        content.addEventListener("mouseleave", () => {
          content.style.transform = "scale(1)";

          content.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.30)";
        });

        contentRef.current = content;

        /*
        |--------------------------------------------------------------------------
        | CREATE ADVANCED MARKER
        |--------------------------------------------------------------------------
        */

        const marker = new AdvancedMarkerElement({
          map,
          position,
          content,
          title: "Last patrol position",
          gmpClickable: true,
        });

        markerRef.current = marker;

        /*
        |--------------------------------------------------------------------------
        | CLICK EVENT
        |--------------------------------------------------------------------------
        |
        | AdvancedMarkerElement uses the standard DOM event:
        |
        | "gmp-click"
        |
        */

        marker.addEventListener("gmp-click", onClick);
      } catch (error) {
        console.error("Failed to create AdvancedMarkerElement:", error);
      }
    };

    void createMarker();

    /*
    |--------------------------------------------------------------------------
    | CLEANUP
    |--------------------------------------------------------------------------
    */

    return () => {
      cancelled = true;

      const marker = markerRef.current;

      if (marker) {
        marker.removeEventListener("gmp-click", onClick);

        marker.map = null;

        markerRef.current = null;
      }

      contentRef.current = null;
    };
  }, [map, onClick]);

  /*
  |--------------------------------------------------------------------------
  | UPDATE POSITION
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | We update the existing marker rather than destroying and recreating it.
  |
  */

  useEffect(() => {
    if (!markerRef.current) {
      return;
    }

    markerRef.current.position = position;
  }, [position]);

  return null;
}

/*
|--------------------------------------------------------------------------
| MAIN PAGE
|--------------------------------------------------------------------------
*/

export default function TrackingMapPage() {
  const { id } = useParams();

  const navigate = useNavigate();

  /*
  |--------------------------------------------------------------------------
  | DATA STATES
  |--------------------------------------------------------------------------
  */

  const [vehicle, setVehicle] = useState<MobilityAsset | null>(null);

  const [personnel, setPersonnel] = useState<Personnel | null>(null);

  const [unitId, setUnitId] = useState<string | null>(null);

  const [logs, setLogs] = useState<PatrolLog[]>([]);

  const [schedules, setSchedules] = useState<PatrolSchedule[]>([]);

  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );

  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[]>([]);

  /*
  |--------------------------------------------------------------------------
  | UI STATES
  |--------------------------------------------------------------------------
  */

  const [loadingCount, setLoadingCount] = useState(0);

  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(0);

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const [activeMarker, setActiveMarker] = useState<boolean>(false);

  /*
  |--------------------------------------------------------------------------
  | CAMERA CONTROL REFS
  |--------------------------------------------------------------------------
  |
  | The camera is intentionally NOT controlled by React state.
  |
  */

  const initialFitDoneRef = useRef(false);

  /*
  |--------------------------------------------------------------------------
  | GOOGLE MAPS
  |--------------------------------------------------------------------------
  */

  const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  /*
  |--------------------------------------------------------------------------
  | LOADING HELPERS
  |--------------------------------------------------------------------------
  */

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(prev - 1, 0));
  }, []);

  /*
  |--------------------------------------------------------------------------
  | FETCH VEHICLE / PERSONNEL
  |--------------------------------------------------------------------------
  */

  const fetchVehicleOrPersonnel = useCallback(async (targetId: string) => {
    try {
      /*
        |--------------------------------------------------------------------------
        | TRY VEHICLE FIRST
        |--------------------------------------------------------------------------
        */

      const { data, error } = await supabase
        .from("mobility_assets")
        .select("*, unit:unit!vehicles_unit_id_fkey(*)")
        .eq("id", targetId)
        .single();

      if (!error && data) {
        setVehicle(data);

        setPersonnel(null);

        setUnitId(data.unit_id);

        return;
      }

      /*
        |--------------------------------------------------------------------------
        | IF NOT VEHICLE, TRY PERSONNEL
        |--------------------------------------------------------------------------
        */

      const { data: pData, error: pError } = await supabase
        .from("personnel")
        .select("*, unit:unit!personnel_unit_id_fkey(*), rank(*)")
        .eq("id", targetId)
        .single();

      if (!pError && pData) {
        setPersonnel(pData);

        setVehicle(null);

        setUnitId(pData.unit_id);
      }
    } catch (err) {
      console.error("Error fetching vehicle/personnel:", err);
    }
  }, []);

  /*
  |--------------------------------------------------------------------------
  | FETCH SCHEDULES
  |--------------------------------------------------------------------------
  */

  const fetchSchedules = useCallback(
    async (uId: string, targetId: string, dateStr: string) => {
      try {
        const selectQuery = `
          *,
          mobility_assets(*),
          unit:unit!personnel_unit_id_fkey(*),
          schedule_assignments(
            *,
            personnel:personnel_id(
              *,
              rank:rank_id(*)
            )
          )
        `;

        /*
        |--------------------------------------------------------------------------
        | FIRST CHECK VEHICLE ASSIGNMENT
        |--------------------------------------------------------------------------
        */

        let { data, error } = await supabase
          .from("patrol_schedule")
          .select(selectQuery)
          .eq("unit_id", uId)
          .eq("date", dateStr)
          .eq("mobility_id", targetId)
          .order("time_from", {
            ascending: true,
          });

        /*
        |--------------------------------------------------------------------------
        | IF NO VEHICLE ASSIGNMENT,
        | CHECK PERSONNEL ASSIGNMENT
        |--------------------------------------------------------------------------
        */

        if (!error && (!data || data.length === 0)) {
          const result = await supabase
            .from("patrol_schedule")
            .select(selectQuery)
            .eq("unit_id", uId)
            .eq("date", dateStr)
            .eq("schedule_assignments.personnel_id", targetId)
            .order("time_from", {
              ascending: true,
            });

          data = result.data;

          error = result.error;
        }

        if (error) {
          console.error("Error fetching schedules:", error);

          setSchedules([]);

          return;
        }

        setSchedules(data ?? []);
      } catch (err) {
        console.error("Error fetching schedules:", err);

        setSchedules([]);
      }
    },
    [],
  );

  /*
  |--------------------------------------------------------------------------
  | FETCH HISTORY
  |--------------------------------------------------------------------------
  */

  const fetchHistory = useCallback(
    async (targetId: string, dateStr: string) => {
      try {
        const localStart = `${dateStr}T00:00:00+08:00`;

        const localEnd = `${dateStr}T23:59:59.999+08:00`;

        let allData: PatrolLog[] = [];

        let pageNum = 1;

        let hasMore = true;

        while (hasMore && allData.length < 10000) {
          const fromRange = (pageNum - 1) * 1000;

          const toRange = pageNum * 1000 - 1;

          const { data, error } = await supabase
            .from("patrol_logs")
            .select("*")
            .or(`vehicle_id.eq.${targetId},personnel_id.eq.${targetId}`)
            .gte("captured_at", localStart)
            .lte("captured_at", localEnd)
            .order("captured_at", {
              ascending: true,
            })
            .range(fromRange, toRange);

          if (error) {
            console.error("Error fetching patrol history:", error);

            break;
          }

          if (data && data.length > 0) {
            allData = [...allData, ...data];

            pageNum++;

            if (data.length < 1000) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE BOTH LATITUDE AND LONGITUDE
        |--------------------------------------------------------------------------
        */

        const validLogs = allData.filter((log) =>
          isValidCoordinate(log.latitude, log.longitude),
        );

        setLogs(validLogs);
      } catch (err) {
        console.error("Error fetching patrol history:", err);

        setLogs([]);
      }
    },
    [],
  );

  /*
  |--------------------------------------------------------------------------
  | INITIAL DATA LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!id) return;

    const fetchInitial = async () => {
      startLoading();

      try {
        await Promise.all([
          fetchVehicleOrPersonnel(id),

          fetchHistory(id, selectedDate),
        ]);
      } finally {
        stopLoading();
      }
    };

    void fetchInitial();
  }, [
    id,
    selectedDate,
    fetchVehicleOrPersonnel,
    fetchHistory,
    startLoading,
    stopLoading,
  ]);

  /*
  |--------------------------------------------------------------------------
  | FETCH SCHEDULES WHEN VEHICLE / PERSONNEL IS READY
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const target = vehicle || personnel;

    if (!target || !unitId) {
      return;
    }

    void fetchSchedules(unitId, target.id, selectedDate);
  }, [vehicle, personnel, unitId, selectedDate, fetchSchedules]);

  /*
  |--------------------------------------------------------------------------
  | RESET SESSION / CAMERA STATE WHEN DATE CHANGES
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    setSelectedSessionIndex(0);

    setActiveMarker(false);

    initialFitDoneRef.current = false;
  }, [selectedDate]);

  /*
  |--------------------------------------------------------------------------
  | PROCESSED PATROL SESSIONS
  |--------------------------------------------------------------------------
  */

  const processedSessions = useMemo(() => {
    const grouped = groupLogsBySession(logs, 10);

    return grouped.map((session) => {
      const start = new Date(session[0].captured_at);
      const end = new Date(session[session.length - 1].captured_at);

      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      const distance = calculateDistance(session);

      let personnelCount = 0;

      // =========================================================
      // PERSONNEL SESSION
      // Count the personnel themselves as 1
      // =========================================================
      if (session[0].personnel_id) {
        personnelCount = 1;
      }

      // =========================================================
      // VEHICLE SESSION
      // Find the corresponding schedule and count assigned personnel
      // =========================================================
      else if (session[0].vehicle_id) {
        schedules.forEach((sched) => {
          const schedStart = new Date(`${selectedDate}T${sched.time_from}`);

          const schedEnd = new Date(`${selectedDate}T${sched.time_to}`);

          if (start <= schedEnd && end >= schedStart) {
            personnelCount += sched.schedule_assignments?.length || 0;
          }
        });
      }

      return {
        logs: session,
        startTime: start,
        endTime: end,
        hoursPatrolled: hours,
        personnelAssigned: personnelCount,
        manHours: hours * personnelCount,
        distance,
        dutyType: session[0].duty_type,
      };
    });
  }, [logs, schedules, selectedDate]);

  /*
  |--------------------------------------------------------------------------
  | TOTALS
  |--------------------------------------------------------------------------
  */

  const { totalHours, totalManHours } = useMemo(() => {
    return processedSessions.reduce(
      (acc, curr) => ({
        totalHours: acc.totalHours + curr.hoursPatrolled,

        totalManHours: acc.totalManHours + curr.manHours,
      }),
      {
        totalHours: 0,

        totalManHours: 0,
      },
    );
  }, [processedSessions]);

  /*
  |--------------------------------------------------------------------------
  | ACTIVE SESSION
  |--------------------------------------------------------------------------
  */

  const activeSession = processedSessions[selectedSessionIndex] || null;

  /*
  |--------------------------------------------------------------------------
  | CLEAN THE ACTIVE PATROL SESSION GPS ROUTE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const sessionLogs = activeSession?.logs ?? [];

    if (sessionLogs.length === 0) {
      setRoutePath([]);
      return;
    }

    const rawPoints = sessionLogs
      .filter((log) => isValidCoordinate(log.latitude, log.longitude))
      .map((log) => ({
        latitude: Number(log.latitude),
        longitude: Number(log.longitude),
        captured_at: log.captured_at,
      }));

    const cleanedPath = cleanPatrolRoute(rawPoints);

    // Keep the original GPS path as a fallback.
    const rawPath = rawPoints.map((point) => ({
      lat: point.latitude,
      lng: point.longitude,
    }));

    setRoutePath(cleanedPath.length >= 2 ? cleanedPath : rawPath);
  }, [activeSession]);

  /*
  |--------------------------------------------------------------------------
  | FIT MAP TO SESSION
  |--------------------------------------------------------------------------
  */

  const fitMapToSession = useCallback(
    (session: (typeof processedSessions)[number]) => {
      if (
        !mapInstance ||
        !window.google?.maps ||
        !session ||
        session.logs.length === 0
      ) {
        return;
      }

      const bounds = new window.google.maps.LatLngBounds();

      let validPointCount = 0;

      session.logs.forEach((log) => {
        if (isValidCoordinate(log.latitude, log.longitude)) {
          bounds.extend({
            lat: Number(log.latitude),

            lng: Number(log.longitude),
          });

          validPointCount++;
        }
      });

      /*
        |--------------------------------------------------------------------------
        | NO VALID POINTS
        |--------------------------------------------------------------------------
        */

      if (validPointCount === 0) {
        return;
      }

      /*
        |--------------------------------------------------------------------------
        | ONE POINT
        |--------------------------------------------------------------------------
        */

      if (validPointCount === 1) {
        const firstValidLog = session.logs.find((log) =>
          isValidCoordinate(log.latitude, log.longitude),
        );

        if (!firstValidLog) {
          return;
        }

        mapInstance.setCenter({
          lat: Number(firstValidLog.latitude),

          lng: Number(firstValidLog.longitude),
        });

        mapInstance.setZoom(17);

        return;
      }

      /*
        |--------------------------------------------------------------------------
        | MULTIPLE POINTS
        |--------------------------------------------------------------------------
        */

      mapInstance.fitBounds(bounds, 50);
    },
    [mapInstance],
  );

  /*
  |--------------------------------------------------------------------------
  | INITIAL CAMERA FIT
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !mapInstance ||
      !activeSession ||
      activeSession.logs.length === 0 ||
      initialFitDoneRef.current
    ) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Mark immediately.
    |--------------------------------------------------------------------------
    */

    initialFitDoneRef.current = true;

    /*
    |--------------------------------------------------------------------------
    | Wait for map container layout.
    |--------------------------------------------------------------------------
    */

    requestAnimationFrame(() => {
      fitMapToSession(activeSession);
    });
  }, [mapInstance, activeSession, fitMapToSession]);

  /*
  |--------------------------------------------------------------------------
  | SESSION SELECT
  |--------------------------------------------------------------------------
  */

  const handleSessionSelect = useCallback(
    (idx: number) => {
      const session = processedSessions[idx];

      setSelectedSessionIndex(idx);

      setActiveMarker(false);

      if (session) {
        fitMapToSession(session);
      }
    },
    [processedSessions, fitMapToSession],
  );

  /*
  |--------------------------------------------------------------------------
  | LAST MARKER CLICK
  |--------------------------------------------------------------------------
  |
  | useCallback prevents AdvancedTrackingMarker from being unnecessarily
  | destroyed and recreated on every render.
  |
  */

  const handleLastMarkerClick = useCallback(() => {
    setActiveMarker(true);
  }, []);

  /*
  |--------------------------------------------------------------------------
  | MAP LOAD
  |--------------------------------------------------------------------------
  */

  const onLoadMap = useCallback((map: google.maps.Map) => {
    /*
        |--------------------------------------------------------------------------
        | Store map instance only.
        |
        | No setCenter()
        | No panTo()
        | No fitBounds()
        | No resize trigger
        |--------------------------------------------------------------------------
        */

    setMapInstance(map);
  }, []);

  /*
  |--------------------------------------------------------------------------
  | DISPLAY ROUTE
  |--------------------------------------------------------------------------
  */

  const mapSegments = useMemo(() => {
    if (routePath.length === 0) {
      return [];
    }

    // Road-matched coordinates are displayed as one continuous route.
    // The raw GPS path remains the fallback when matching fails.
    return [
      {
        path: routePath,
        color: "#2563eb",
      },
    ];
  }, [routePath]);

  /*
  |--------------------------------------------------------------------------
  | LAST LOG
  |--------------------------------------------------------------------------
  */

  const lastLog =
    activeSession && activeSession.logs.length > 0
      ? activeSession.logs[activeSession.logs.length - 1]
      : null;

  /*
  |--------------------------------------------------------------------------
  | LOADING SCREEN
  |--------------------------------------------------------------------------
  */

  if (!isLoaded) {
    return (
      <div className="animate-pulse bg-slate-100 dark:bg-slate-900 rounded-xl min-h-[600px] w-full" />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="flex flex-col gap-6 relative min-h-screen">
      {/* ============================================================
          HEADER
      ============================================================ */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <HistoryIcon className="w-6 h-6 text-blue-600" />
              Tracking Map
            </h1>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {vehicle
                  ? vehicle.plate_number
                  : personnel
                    ? `${personnel.rank?.rank_name ?? ""} ${personnel.fullname}`
                    : "Loading..."}
              </span>

              {(vehicle || personnel) && (
                <>
                  <span>•</span>

                  <span>
                    {vehicle
                      ? vehicle.unit?.unit_name
                      : personnel?.unit?.unit_name}
                  </span>
                </>
              )}

              {vehicle && (
                <>
                  <span>•</span>

                  <span
                    className={
                      vehicle.status === "Serviceable"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }
                  >
                    {vehicle.status || "Serviceable"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2.5 pl-10 pr-4 font-semibold outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200 transition-shadow"
            />
          </div>

          <button
            onClick={() => {
              if (!id) return;

              /*
              |--------------------------------------------------------------------------
              | Allow refresh to fit newly fetched history once.
              |--------------------------------------------------------------------------
              */

              initialFitDoneRef.current = false;

              void fetchHistory(id, selectedDate);
            }}
            className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <RefreshCcw
              className={`w-5 h-5 ${loadingCount > 0 ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ============================================================
          MAIN CONTENT
      ============================================================ */}

      <div className="flex gap-6 h-[calc(100vh-250px)] min-h-[600px]">
        {/* ==========================================================
            MAP
        ========================================================== */}

        <div className="flex-[2] rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 relative">
          <GoogleMap
            mapContainerStyle={{
              width: "100%",
              height: "100%",
            }}
            mapTypeId="hybrid"
            options={{
              /*
              |--------------------------------------------------------------------------
              | ADVANCED MARKER MAP ID
              |--------------------------------------------------------------------------
              */

              mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,

              streetViewControl: true,

              mapTypeControl: true,

              fullscreenControl: true,

              zoomControl: true,

              /*
              |--------------------------------------------------------------------------
              | IMPORTANT
              |--------------------------------------------------------------------------
              |
              | No dynamic center.
              |
              | No dynamic zoom.
              |
              | This prevents React rerenders from moving the user's camera.
              |
              */
            }}
            onLoad={onLoadMap}
          >
            {/* ======================================================
                PATROL ROUTE
            ====================================================== */}

            {mapSegments.map((seg, i) => (
              <Polyline
                key={`route-segment-${i}`}
                path={seg.path}
                options={{
                  strokeColor: seg.color,

                  strokeWeight: 5,

                  strokeOpacity: 0.8,
                }}
              />
            ))}

            {/* ======================================================
                LAST POSITION ADVANCED MARKER
            ====================================================== */}

            {lastLog &&
              isValidCoordinate(lastLog.latitude, lastLog.longitude) && (
                <>
                  <AdvancedTrackingMarker
                    map={mapInstance}
                    position={{
                      lat: Number(lastLog.latitude),

                      lng: Number(lastLog.longitude),
                    }}
                    onClick={handleLastMarkerClick}
                  />

                  {/* ==================================================
                      INFO WINDOW
                  ================================================== */}

                  {activeMarker && (
                    <InfoWindow
                      position={{
                        lat: Number(lastLog.latitude),

                        lng: Number(lastLog.longitude),
                      }}
                      onCloseClick={() => setActiveMarker(false)}
                    >
                      <div className="p-2 text-slate-900 font-medium">
                        <p className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-blue-600" />

                          {format(new Date(lastLog.captured_at), "HH:mm:ss")}
                        </p>

                        <p className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          {lastLog.speed ?? 0} km/h
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </>
              )}
          </GoogleMap>
        </div>

        {/* ==========================================================
            SIDEBAR
        ========================================================== */}

        <div className="flex-[1] bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          {/* ========================================================
              SIDEBAR HEADER
          ======================================================== */}

          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              Patrol Sessions
            </h3>
          </div>

          {/* ========================================================
              SESSION LIST
          ======================================================== */}

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {processedSessions.length > 0 ? (
              processedSessions.map((session, idx) => (
                <button
                  key={`session-${idx}`}
                  onClick={() => handleSessionSelect(idx)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${
                    selectedSessionIndex === idx
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50 shadow-inner"
                      : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* ==================================================
                        SESSION HEADER
                    ================================================== */}

                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          selectedSessionIndex === idx
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-500"
                        }`}
                      >
                        Session {idx + 1}
                      </span>

                      <h4 className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {session.dutyType}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5" />
                      {format(session.startTime, "HH:mm")} -{" "}
                      {format(session.endTime, "HH:mm")}
                    </div>
                  </div>

                  {/* ==================================================
                        SESSION DETAILS
                    ================================================== */}

                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-500" />

                      <span>{session.distance} km</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" />

                      <span>
                        {formatHoursToHoursAndMinutes(session.hoursPatrolled)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-500" />

                      <span>{session.personnelAssigned} Pax</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <MapPin className="w-8 h-8 opacity-50" />
                </div>

                <p>No patrol logs recorded for this date.</p>
              </div>
            )}
          </div>

          {/* ========================================================
              TOTALS FOOTER
          ======================================================== */}

          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Daily Summary
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* ====================================================
                  TOTAL PATROL TIME
              ==================================================== */}

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Total Patrolled</p>

                <p className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {formatHoursToHoursAndMinutes(totalHours)}
                </p>
              </div>

              {/* ====================================================
                  TOTAL MAN HOURS
              ==================================================== */}

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Total Man-Hours</p>

                <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                  {formatHoursToHoursAndMinutes(totalManHours)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
